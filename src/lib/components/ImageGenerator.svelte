<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { Upload, X, ChevronDown, ChevronRight, LoaderCircle, Sparkles, ImagePlus, ClipboardPaste, Brush } from '@lucide/svelte';
	import { apiKey } from '#lib/stores/apiKey.svelte.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { generateImage, editImage, type ImageResult } from '#lib/services/openai.ts';
	import type { ImageComplexity, ImageModel, ImageQuality, ImageSize, OutputFormat, ImageBackground, ImageModeration, SvgAuthorModel, SvgEffort } from '#lib/types/image.ts';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import 	{
		MODEL_OPTIONS,
		QUALITY_OPTIONS,
		SIZE_OPTIONS,
		COMPLEXITY_OPTIONS,
		DEFAULT_IMAGE_MODEL,
		GIF_LIMITS,
		GIF_SIZES,
		GPT_IMAGE_MODEL_PROMPT_MAX_CHARS,
		getImagePrice,
		IMAGE_UPLOAD_LIMITS,
		OUTPUT_FORMAT_OPTIONS,
		BACKGROUND_OPTIONS,
		MODEL_SUPPORT,
		MODERATION_OPTIONS,
		STANDARD_SIZES,
		SVG_AUTHOR_MODEL_OPTIONS,
		SVG_EFFORT_OPTIONS,
		isImageSize,
		isSelectableModel,
		usageCostUsd
	} from '#lib/types/image.ts';
	import { browser } from '$app/env';
	import ImageUploadZone from './ImageUploadZone.svelte';
	import MarkupCanvas from './MarkupCanvas.svelte';
	import { sanitizeSvgBase64 } from '#lib/utils/sanitizeSvg.ts';

	// Storage keys
	const FORM_OPTIONS_KEY = 'image-generator-options';

	// Load options from localStorage if available
	function loadFormOptions() {
		if (!browser) return
		const raw = localStorage.getItem(FORM_OPTIONS_KEY)
		if (!raw) return
		try {
			const opts = JSON.parse(raw)
			if (isSelectableModel(opts.selectedModel)) selectedModel = opts.selectedModel
			if (opts.selectedQuality) selectedQuality = opts.selectedQuality
			if (opts.selectedSize) selectedSize = opts.selectedSize
			if (opts.imageCount) imageCount = opts.imageCount
			if (Object.hasOwn(COMPLEXITY_OPTIONS, opts.complexity)) complexity = opts.complexity
			if (Number.isInteger(opts.frameCount) && opts.frameCount >= GIF_LIMITS.minFrameCount && opts.frameCount <= GIF_LIMITS.maxFrameCount) frameCount = opts.frameCount
			if (Number.isInteger(opts.frameDurationMs) && opts.frameDurationMs >= GIF_LIMITS.minFrameDurationMs && opts.frameDurationMs <= GIF_LIMITS.maxFrameDurationMs) frameDurationMs = opts.frameDurationMs
			if (Object.hasOwn(SVG_AUTHOR_MODEL_OPTIONS, opts.svgModel)) svgModel = opts.svgModel
			if (Object.hasOwn(SVG_EFFORT_OPTIONS, opts.svgEffort)) svgEffort = opts.svgEffort
			if (opts.outputCompression !== undefined) outputCompression = opts.outputCompression
			if (opts.outputFormat) outputFormat = opts.outputFormat
			if (opts.selectedBackground) selectedBackground = opts.selectedBackground
			if (opts.selectedModeration) selectedModeration = opts.selectedModeration
			if (opts.prompt) prompt = opts.prompt
		} catch {}
	}

	function saveFormOptions() {
		if (!browser) return
		const opts = {
			selectedModel,
			selectedQuality,
			selectedSize,
			imageCount,
			complexity,
			frameCount,
			frameDurationMs,
			svgModel,
			svgEffort,
			outputCompression,
			outputFormat,
			selectedBackground,
			selectedModeration,
			prompt
		}
		localStorage.setItem(FORM_OPTIONS_KEY, JSON.stringify(opts))
	}

	interface Props {
		prompt?: string;
		imageToEdit?: ImageRecord | null;
	}

	let { prompt = $bindable(''), imageToEdit = $bindable(null) }: Props = $props();
	let isGenerating = $state(false);
	let error: string | null = $state(null);
	let selectedModel: ImageModel = $state(DEFAULT_IMAGE_MODEL);
	let selectedQuality: ImageQuality = $state('low');
	let selectedSize: ImageSize = $state('1024x1024');
	let imageCount = $state(1);
	let inputImages: File[] = $state([]);
	let imagePreviews: string[] = $state([]);
	let inputMask: File | null = $state(null);
	let maskPreview: string | null = $state(null);
	let showMarkup = $state(false);
	let markupHasStrokes = $state(false);
	let markupCanvas: ReturnType<typeof MarkupCanvas> | undefined = $state();
	const firstReference = $derived(inputImages[0]);
	let pasteFlash = $state(false);

	// Mode is auto-derived: if images are attached → edit/compose, otherwise → pure generation
	let mode = $derived<'generate' | 'edit'>(inputImages.length > 0 ? 'edit' : 'generate');

	// Advanced options
	let showAdvanced = $state(false);
	let complexity: ImageComplexity = $state('high');
	let frameCount = $state<number>(GIF_LIMITS.defaultFrameCount);
	let frameDurationMs = $state<number>(GIF_LIMITS.defaultFrameDurationMs);
	let svgModel: SvgAuthorModel = $state('gpt-5.4-nano');
	let svgEffort: SvgEffort = $state('default');
	let outputCompression = $state(100);
	let outputFormat = $state<OutputFormat>('png');
	let selectedBackground: ImageBackground = $state('auto');
	let selectedModeration: ImageModeration = $state('auto');
	let support = $derived(MODEL_SUPPORT[selectedModel]);
	let gifAllowed = $derived(mode === 'generate' && support.gif);
	let svgAllowed = $derived(mode === 'generate' && support.svg);
	let availableSizes = $derived(outputFormat === 'gif' ? GIF_SIZES : STANDARD_SIZES);
	let effectiveCount = $derived(outputFormat === 'svg' ? 1 : imageCount);
	/** `xhigh` and `max` only exist on GPT Image 2.5 and 2.6, so fall back when switching to a model without them. */
	$effect(() => {
		if (!support.qualities.includes(selectedQuality)) selectedQuality = 'high';
		if ((outputFormat === 'gif' && !gifAllowed) || (outputFormat === 'svg' && !svgAllowed)) outputFormat = 'png';
		if (!availableSizes.includes(selectedSize)) selectedSize = 'auto';
		if (mode === 'generate' || !support.markup || !showAdvanced) showMarkup = false;
	});
	let displayPrice = $derived(outputFormat === 'gif' || outputFormat === 'svg' ? null : getImagePrice(selectedModel, selectedQuality, selectedSize));

	// Calculate price dynamically
	let currentPrice = $derived((displayPrice ?? 0) * effectiveCount);
	let promptCharCount = $derived(prompt.length);
	let promptExceedsApiLimit = $derived(promptCharCount > GPT_IMAGE_MODEL_PROMPT_MAX_CHARS);

	onMount(() => {
		loadFormOptions()
		if (!prompt) {
			prompt = "A cyberpunk city at night with neon lights and flying cars";
		}
		error = null;

		// Global paste handler: Ctrl+V anywhere on the page adds images
		function handleGlobalPaste(e: ClipboardEvent) {
			// Don't intercept if user is typing in a text input/textarea
			const target = e.target as HTMLElement;
			if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;

			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.startsWith('image/')) {
					const file = items[i].getAsFile();
					if (!file) continue;
					if (inputImages.length >= IMAGE_UPLOAD_LIMITS.maxImages) return;
					const validationError = validateImageFile(file);
					if (validationError) { error = validationError; return; }

					const newImages = [...inputImages, file];
					const newPreviews = [...imagePreviews];
					const reader = new FileReader();
					reader.onload = (ev) => {
						newPreviews.push(ev.target?.result as string);
						inputImages = newImages;
						imagePreviews = newPreviews;
						pasteFlash = true;
						setTimeout(() => (pasteFlash = false), 1200);
					};
					reader.readAsDataURL(file);
					return;
				}
			}

			// URL paste
			const text = e.clipboardData?.getData('text');
			if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
				fetch(text.trim())
					.then(r => r.blob())
					.then(blob => {
						if (!blob.type.startsWith('image/')) return;
						const file = new File([blob], 'pasted-image', { type: blob.type });
						if (inputImages.length >= IMAGE_UPLOAD_LIMITS.maxImages) return;
						const newImages = [...inputImages, file];
						const newPreviews = [...imagePreviews];
						const reader = new FileReader();
						reader.onload = (ev) => {
							newPreviews.push(ev.target?.result as string);
							inputImages = newImages;
							imagePreviews = newPreviews;
							pasteFlash = true;
							setTimeout(() => (pasteFlash = false), 1200);
						};
						reader.readAsDataURL(file);
					})
					.catch(() => {});
			}
		}

		document.addEventListener('paste', handleGlobalPaste);
		return () => document.removeEventListener('paste', handleGlobalPaste);
	});

	// Save options whenever they change
	$effect(() => {
		saveFormOptions();
	});

	// Reactively set prompt and image for editing
	$effect(() => {
		if (imageToEdit) {
			prompt = imageToEdit.prompt;
			// Convert the stored image to a File object for inputImages
			const { id } = imageToEdit;
			const format = imageToEdit.output_format ?? 'png';
			gallery.url(imageToEdit)
				.then(async (url) => {
					if (!url) throw new Error('Image file not found');
					const blob = await (await fetch(url)).blob();
					const file = new File([blob], `edited_image_${id}.${format}`, { type: OUTPUT_FORMAT_OPTIONS[format].mime });
					inputImages = [file];
					imagePreviews = [url];
				})
				.catch(e => console.error("Error converting image data to File:", e));

			// Set other image properties if available
			selectedModel = imageToEdit.model && isSelectableModel(imageToEdit.model) ? imageToEdit.model : DEFAULT_IMAGE_MODEL;
			selectedQuality = imageToEdit.quality ?? 'low';
			selectedSize = imageToEdit.size && isImageSize(imageToEdit.size) ? imageToEdit.size : '1024x1024';
			if (imageToEdit.complexity) complexity = imageToEdit.complexity;
			outputCompression = imageToEdit.output_compression ?? 100;
			outputFormat = format;
			selectedBackground = imageToEdit.background ?? 'auto';
		}
	});

	function validateImageFile(file: File): string | null {
		// Check file size
		if (file.size > IMAGE_UPLOAD_LIMITS.maxFileSize) {
			return `File "${file.name}" is too large. Maximum size is 50MB.`;
		}

		// Check file type
		if (!IMAGE_UPLOAD_LIMITS.acceptedFormats.includes(file.type as any)) {
			return `File "${file.name}" has an unsupported format. Please use PNG, WEBP, or JPEG.`;
		}

		return null;
	}

	function handleMaskUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Mask specific validation
		if (file.type !== 'image/png') {
			error = 'Mask image must be a PNG file.';
			return;
		}
		if (file.size > IMAGE_UPLOAD_LIMITS.maskMaxSize) {
			error = `Mask file "${file.name}" is too large. Maximum size is ${IMAGE_UPLOAD_LIMITS.maskMaxSize / (1024 * 1024)}MB.`;
			return;
		}

		// Clear any previous errors
		error = null;

		inputMask = file;
		const reader = new FileReader();
		reader.onload = (e) => {
			maskPreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		// Clear the input
		target.value = '';
	}

	function removeMask() {
		inputMask = null;
		maskPreview = null;
	}

	async function handleGenerate() {
		if (!apiKey.value) {
			error = "Please enter your OpenAI API key first";
			return;
		}

		if (!prompt.trim()) {
			error = "Please enter a prompt";
			return;
		}

		if (prompt.length > GPT_IMAGE_MODEL_PROMPT_MAX_CHARS) {
			error = `Prompt exceeds the API limit (${GPT_IMAGE_MODEL_PROMPT_MAX_CHARS.toLocaleString("en-US")} characters for GPT Image models). Shorten the text and try again.`;
			return;
		}

		if (mode === 'edit' && inputImages.length === 0) {
			error = "Please upload at least one image to edit";
			return;
		}

		if (selectedBackground === 'transparent' && outputFormat === 'jpeg') {
			error = 'Transparent background is not supported for JPEG output format. Please select PNG or WebP.';
			return;
		}

		if (outputFormat === 'gif' && !(Number.isInteger(frameDurationMs) && frameDurationMs >= GIF_LIMITS.minFrameDurationMs && frameDurationMs <= GIF_LIMITS.maxFrameDurationMs)) {
			error = `Frame duration must be a whole number between ${GIF_LIMITS.minFrameDurationMs} and ${GIF_LIMITS.maxFrameDurationMs} ms.`;
			return;
		}

		isGenerating = true;
		error = null;

		try {
			const markup = mode === 'edit' && support.markup && showMarkup && markupHasStrokes ? await markupCanvas?.toFile() : null;
			if (markup && inputMask) throw new Error("Markup and mask can't be combined.");
			if (markup && markup.size >= IMAGE_UPLOAD_LIMITS.maxFileSize) throw new Error('Markup must be under 50 MB.');

			const format = outputFormat;
			const compression = format === 'jpeg' || format === 'webp' ? { output_compression: outputCompression } : {};
			const shared = {
				background: selectedBackground,
				model: selectedModel,
				n: effectiveCount,
				prompt,
				quality: selectedQuality,
				size: selectedSize,
				...compression,
				...(support.complexity && { complexity })
			};

			let result: ImageResult;
			if (mode === 'edit') {
				if (format === 'gif' || format === 'svg') throw new Error('GIF and SVG output only work without reference images.');
				result = await editImage(apiKey.value, { ...shared, image: inputImages, output_format: format, ...(inputMask && { mask: inputMask }), ...(markup && { markup }) });
			} else {
				result = await generateImage(apiKey.value, {
					...shared,
					moderation: selectedModeration,
					output_format: format,
					...(format === 'gif' && { frame_count: frameCount, frame_duration_ms: frameDurationMs }),
					...(format === 'svg' && { svg: { model: svgModel, ...(svgEffort !== 'default' && { reasoning: { effort: svgEffort } }) } })
				});
			}

			/** The usage covers the whole request, so each image gets an equal share. */
			const cost = result.usage && usageCostUsd(result.usage) / result.images.length;
			const blobs = result.images.map((b64) => new Blob(
				[Uint8Array.from(atob(format === 'svg' ? sanitizeSvgBase64(b64) : b64), (c) => c.charCodeAt(0))],
				{ type: OUTPUT_FORMAT_OPTIONS[format].mime }
			));
			await gallery.add(blobs, {
				background: selectedBackground,
				model: selectedModel,
				output_format: format,
				prompt,
				quality: selectedQuality,
				size: result.size ?? selectedSize,
				...compression,
				...(support.complexity && { complexity }),
				...(format === 'gif' && { frame_count: frameCount, frame_duration_ms: frameDurationMs }),
				...(cost !== undefined && { cost }),
				...(result.svgUsage && { svg_usage: result.svgUsage })
			});

			// Clear images if editing (but keep the prompt)
			if (mode === 'edit') {
				inputImages = [];
				imagePreviews = [];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Image generation failed';
		} finally {
			isGenerating = false;
		}
	}
</script>

<div class="glass-panel rounded-2xl overflow-hidden">
	<!-- Header -->
	<div class="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Sparkles class="h-4 w-4 text-purple-400" />
			<h2 class="text-sm font-semibold text-gray-100 tracking-wide uppercase">
				{inputImages.length > 0 ? 'Generate with references' : 'Create Image'}
			</h2>
		</div>
		{#if inputImages.length > 0}
			<span
				in:fade={{ duration: 200 }}
				class="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40"
			>
				{inputImages.length} reference{inputImages.length > 1 ? 's' : ''} attached
			</span>
		{:else}
			<span
				in:fade={{ duration: 200 }}
				class="text-xs text-gray-600 flex items-center gap-1"
			>
				<ClipboardPaste class="h-3 w-3" />
				Ctrl+V to attach image
			</span>
		{/if}
	</div>

	<form onsubmit={(e) => { e.preventDefault(); handleGenerate(); }} class="p-5 space-y-4">
		<!-- Prompt -->
		<div>
			<div class="relative">
				<textarea
					id="prompt"
					bind:value={prompt}
					rows="4"
					placeholder={inputImages.length > 0
						? 'Describe what to generate using these references - style, subject, composition…'
						: 'Describe the image you want to create…'}
					class="input w-full resize-none leading-relaxed pb-8"
					disabled={isGenerating}
					aria-describedby="prompt-char-count"
				></textarea>
				<div
					id="prompt-char-count"
					class="pointer-events-none absolute inset-e-2.5 bottom-2.5 text-xs leading-none tabular-nums select-none {promptExceedsApiLimit
						? 'text-amber-400/95'
						: 'text-gray-500'}"
				>
					{promptCharCount} / {GPT_IMAGE_MODEL_PROMPT_MAX_CHARS}
				</div>
			</div>
		</div>

		<!-- Reference images zone - always visible -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<label class="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5" for="image-upload">
					<ImagePlus class="h-3.5 w-3.5" />
					Reference images
					<span class="text-gray-700 font-normal normal-case tracking-normal">(optional)</span>
				</label>
				{#if inputImages.length > 0}
					<span class="text-xs text-gray-600">{inputImages.length}/{IMAGE_UPLOAD_LIMITS.maxImages}</span>
				{/if}
			</div>

			<div class="{pasteFlash ? 'ring-2 ring-purple-500/60 rounded-lg' : ''}  transition-shadow duration-300">
				<ImageUploadZone
					acceptedExtensions={IMAGE_UPLOAD_LIMITS.acceptedExtensions}
					{isGenerating}
					images={inputImages}
					imagePreviews={imagePreviews}
					maxImages={IMAGE_UPLOAD_LIMITS.maxImages}
					onImagesChange={(imgs, previews) => {
						inputImages = imgs;
						imagePreviews = previews;
					}}
					validateFile={validateImageFile}
				/>
			</div>
			{#if inputImages.length === 0}
				<p class="text-xs text-gray-700 mt-1.5">
					Drop, paste (Ctrl+V) or browse - PNG, WEBP, JPEG up to 50 MB
				</p>
			{/if}
		</div>

		<!-- Model + Quality + Size in a compact row -->
		<div class="grid grid-cols-3 gap-3">
			<div>
				<label for="model" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Model</label>
				<select id="model" bind:value={selectedModel} class="input w-full text-sm" disabled={isGenerating}>
					{#each Object.entries(MODEL_OPTIONS) as [key, option] (key)}
						<option value={key}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="quality" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Quality</label>
				<select id="quality" bind:value={selectedQuality} class="input w-full text-sm" disabled={isGenerating}>
					{#each support.qualities as key (key)}
						<option value={key}>{QUALITY_OPTIONS[key].label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="size" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Size</label>
				<select id="size" bind:value={selectedSize} class="input w-full text-sm" disabled={isGenerating}>
					{#each availableSizes as key (key)}
						<option value={key}>{SIZE_OPTIONS[key].label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Count slider -->
		<div class="flex items-center gap-3">
			<label for="imageCount" class="text-xs font-medium text-gray-500 uppercase tracking-wider shrink-0 w-20">
				Count
			</label>
			<input
				id="imageCount"
				type="range"
				min="1"
				max="10"
				bind:value={imageCount}
				class="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
				disabled={isGenerating || outputFormat === 'svg'}
			/>
			<span class="text-sm font-medium text-gray-300 w-5 text-right">{effectiveCount}</span>
		</div>

		<!-- Advanced Options -->
		<div class="border-t border-white/5 pt-3">
			<button
				type="button"
				class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider transition-colors {isGenerating ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-gray-300 cursor-pointer'}"
				onclick={() => !isGenerating && (showAdvanced = !showAdvanced)}
				disabled={isGenerating}
			>
				{#if showAdvanced}
					<ChevronDown class="h-3.5 w-3.5" />
				{:else}
					<ChevronRight class="h-3.5 w-3.5" />
				{/if}
				Advanced
			</button>

			{#if showAdvanced}
				<div class="mt-4 space-y-4 pl-4 border-l border-gray-700/60" in:fly={{ y: -6, duration: 180 }}>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="outputFormat" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
								Output Format
							</label>
							<select id="outputFormat" bind:value={outputFormat} class="input w-full text-sm" disabled={isGenerating}>
								{#each Object.entries(OUTPUT_FORMAT_OPTIONS) as [key, option] (key)}
									<option value={key} disabled={(key === 'gif' && !gifAllowed) || (key === 'svg' && !svgAllowed) || (key === 'jpeg' && selectedBackground === 'transparent')}>{option.label}</option>
								{/each}
							</select>
							<p class="text-xs text-gray-600 mt-1">{OUTPUT_FORMAT_OPTIONS[outputFormat].description}</p>
						</div>
						{#if support.complexity}
							<div>
								<label for="complexity" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
									Complexity
								</label>
								<select id="complexity" bind:value={complexity} class="input w-full text-sm" disabled={isGenerating}>
									{#each Object.entries(COMPLEXITY_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-600 mt-1">Planning effort, independent of quality</p>
							</div>
						{/if}
					</div>

					{#if outputFormat === 'gif'}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<div class="flex items-center justify-between mb-1.5">
									<label for="frameCount" class="text-xs font-medium text-gray-500 uppercase tracking-wider">
										Frames
									</label>
									<span class="text-xs text-gray-400">{frameCount}</span>
								</div>
								<input
									id="frameCount"
									type="range"
									min={GIF_LIMITS.minFrameCount}
									max={GIF_LIMITS.maxFrameCount}
									bind:value={frameCount}
									class="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
									disabled={isGenerating}
								/>
							</div>
							<div>
								<label for="frameDuration" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
									Frame duration (ms)
								</label>
								<input
									id="frameDuration"
									type="number"
									min={GIF_LIMITS.minFrameDurationMs}
									max={GIF_LIMITS.maxFrameDurationMs}
									step="1"
									bind:value={frameDurationMs}
									class="input w-full text-sm"
									disabled={isGenerating}
								/>
							</div>
						</div>
						<p class="text-xs text-gray-600 -mt-2">Sizes are limited to small squares because frames share one sheet.</p>
					{/if}

					{#if outputFormat === 'svg'}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="svgModel" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
									SVG author
								</label>
								<select id="svgModel" bind:value={svgModel} class="input w-full text-sm" disabled={isGenerating}>
									{#each Object.entries(SVG_AUTHOR_MODEL_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="svgEffort" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
									Author effort
								</label>
								<select id="svgEffort" bind:value={svgEffort} class="input w-full text-sm" disabled={isGenerating}>
									{#each Object.entries(SVG_EFFORT_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
							</div>
						</div>
						<p class="text-xs text-gray-600 -mt-2">One image per request. Author tokens are billed separately and not included in the cost.</p>
					{/if}

					{#if mode === 'generate'}
						<div>
							<label for="moderation" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
								Moderation
							</label>
							<select id="moderation" bind:value={selectedModeration} class="input w-full text-sm" disabled={isGenerating}>
								{#each Object.entries(MODERATION_OPTIONS) as [key, option] (key)}
									<option value={key}>{option.label}</option>
								{/each}
							</select>
							<p class="text-xs text-gray-600 mt-1">{MODERATION_OPTIONS[selectedModeration].description}</p>
						</div>
					{/if}

					<div>
						<label for="background" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
							Background
						</label>
						<select id="background" bind:value={selectedBackground} class="input w-full text-sm" disabled={isGenerating}>
							{#each Object.entries(BACKGROUND_OPTIONS) as [key, option] (key)}
								<option value={key}>{option.label}</option>
							{/each}
						</select>
						<p class="text-xs text-gray-600 mt-1">{BACKGROUND_OPTIONS[selectedBackground].description}</p>
					</div>

					{#if outputFormat === 'jpeg' || outputFormat === 'webp'}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<label for="outputCompression" class="text-xs font-medium text-gray-500 uppercase tracking-wider">
									Compression
								</label>
								<span class="text-xs text-gray-400">{outputCompression}%</span>
							</div>
							<input
								id="outputCompression"
								type="range"
								min="0"
								max="100"
								bind:value={outputCompression}
								class="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
								disabled={isGenerating}
							/>
						</div>
					{/if}

					{#if mode === 'edit'}
						<div>
							<label class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider" for="mask-upload">
								Mask (Optional)
							</label>
							<div class="flex items-center gap-3">
								<label class="cursor-pointer">
									<input
										id="mask-upload"
										type="file"
										accept=".png"
										class="hidden"
										onchange={handleMaskUpload}
										disabled={isGenerating || inputMask !== null || showMarkup}
									/>
									<div class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors {inputMask !== null || showMarkup ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
										<Upload class="h-3.5 w-3.5" />
										Upload PNG mask
									</div>
								</label>
								{#if maskPreview}
									<div class="relative">
										<img src={maskPreview} alt="Mask Preview" class="w-12 h-12 object-cover rounded-lg border border-gray-700" />
										<button
											type="button"
											class="absolute -top-1.5 -right-1.5 rounded-full p-0.5 {isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 cursor-pointer'}"
											onclick={() => !isGenerating && removeMask()}
											disabled={isGenerating}
										>
											<X class="h-3 w-3" />
										</button>
									</div>
								{/if}
							</div>
							<p class="text-xs text-gray-600 mt-1">PNG only, max 4 MB. Controls editable regions on the first image.</p>
						</div>
					{/if}

					{#if mode === 'edit' && support.markup}
						<div>
							<span class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Markup (Optional)</span>
							<button
								type="button"
								class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm transition-colors cursor-pointer"
								disabled={isGenerating || inputMask !== null}
								onclick={() => (showMarkup = !showMarkup)}
							>
								<Brush class="h-3.5 w-3.5" />
								{showMarkup ? 'Discard markup' : 'Draw markup'}
							</button>
							{#if showMarkup}
								<div class="mt-3">
									<MarkupCanvas bind:this={markupCanvas} bind:hasStrokes={markupHasStrokes} disabled={isGenerating || inputMask !== null} image={firstReference} />
								</div>
							{/if}
							<p class="text-xs text-gray-600 mt-1">Can't be combined with a mask.</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Submit -->
		<button
			type="submit"
			class="btn group relative bg-linear-to-r ring-transparent ring-2 duration-300 from-purple-700 via-violet-600 to-cyan-600 w-full flex items-center justify-center gap-2 py-3 font-semibold text-white shadow-lg shadow-purple-950/60 overflow-hidden
				{isGenerating
					? 'cursor-not-allowed'
					: !apiKey.value
					? 'opacity-50 cursor-not-allowed'
					: 'hover:ring-white/70 hover:shadow-purple-600/50 hover:scale-[1.01] hover:from-purple-600 hover:via-violet-500 hover:to-cyan-500 cursor-pointer'}"
			disabled={isGenerating || !apiKey.value}
		>
			{#if isGenerating}
				<!-- Sheen sweep -->
				<span class="pointer-events-none absolute inset-0 overflow-hidden">
					<span class="absolute top-0 bottom-0 w-20 bg-linear-to-r from-transparent via-white/20 to-transparent animate-sheen"></span>
				</span>
				<LoaderCircle class="relative z-10 h-4 w-4 animate-spin shrink-0" />
				<span class="relative z-10 flex items-center gap-2">
					{mode === 'generate' ? 'Generating' : 'Generating from references'}
					<span class="flex items-end gap-0.5 pb-px">
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:0ms]"></span>
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:150ms]"></span>
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:300ms]"></span>
					</span>
				</span>
			{:else}
				<Sparkles class="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
				{mode === 'generate'
					? `Generate ${effectiveCount > 1 ? `${effectiveCount} images` : 'image'}`
					: `Generate ${effectiveCount > 1 ? `${effectiveCount} images` : 'image'} from references`}
			{/if}
		</button>

		{#if !apiKey.value}
			<div class="text-sm text-warning-400 bg-warning-900/20 border border-warning-600/20 p-2 rounded-md">
				Please add your OpenAI API key to generate images
			</div>
		{/if}

		{#if error}
			<div in:fly={{ y: 8, duration: 250 }} class="text-sm text-error-400 bg-error-900/20 border border-error-600/20 p-2 rounded-md">
				{error}
			</div>
		{/if}

		<div class="text-xs text-gray-600 flex justify-between pt-0.5">
			<span>{MODEL_OPTIONS[selectedModel].label}</span>
			{#if displayPrice !== null}
				<span class="text-secondary-500">${currentPrice.toFixed(3)} for {effectiveCount} {effectiveCount > 1 ? 'images' : 'image'}</span>
			{:else}
				<span class="text-gray-500">Price estimate unavailable, the real cost is recorded after generation</span>
			{/if}
		</div>
	</form>
</div>
