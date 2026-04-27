<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { Upload, X, ChevronDown, ChevronRight, Loader2, Sparkles, ImagePlus, ClipboardPaste } from 'lucide-svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { addImage } from '$lib/db/imageStore';
	import { refreshImageStore } from '$lib/stores/imageStore';
	import { generateImage, editImage } from '$lib/services/openai';
	import type { ImageModel, ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground } from '$lib/types/image';
	import type { ImageRecord } from '$lib/stores/imageStore';
	import { MODEL_OPTIONS, QUALITY_OPTIONS, SIZE_OPTIONS, PRICING, IMAGE_UPLOAD_LIMITS, INPUT_FIDELITY_OPTIONS, OUTPUT_FORMAT_OPTIONS, BACKGROUND_OPTIONS } from '$lib/types/image';
	import { browser } from '$app/environment';
	import ImageUploadZone from './ImageUploadZone.svelte';

	// Storage keys
	const FORM_OPTIONS_KEY = 'image-generator-options';

	// Load options from localStorage if available
	function loadFormOptions() {
		if (!browser) return
		const raw = localStorage.getItem(FORM_OPTIONS_KEY)
		if (!raw) return
		try {
			const opts = JSON.parse(raw)
			if (opts.selectedModel) selectedModel = opts.selectedModel
			if (opts.selectedQuality) selectedQuality = opts.selectedQuality
			if (opts.selectedSize) selectedSize = opts.selectedSize
			if (opts.imageCount) imageCount = opts.imageCount
			if (opts.inputFidelity) inputFidelity = opts.inputFidelity
			if (opts.outputCompression !== undefined) outputCompression = opts.outputCompression
			if (opts.outputFormat) outputFormat = opts.outputFormat
			if (opts.selectedBackground) selectedBackground = opts.selectedBackground
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
			inputFidelity,
			outputCompression,
			outputFormat,
			selectedBackground,
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
	let selectedModel: ImageModel = $state('gpt-image-1.5');
	let selectedQuality: ImageQuality = $state('low');
	let selectedSize: ImageSize = $state('1024x1024');
	let imageCount = $state(1);
	let inputImages: File[] = $state([]);
	let imagePreviews: string[] = $state([]);
	let inputMask: File | null = $state(null);
	let maskPreview: string | null = $state(null);
	let pasteFlash = $state(false);

	// Mode is auto-derived: if images are attached → edit/compose, otherwise → pure generation
	let mode = $derived<'generate' | 'edit'>(inputImages.length > 0 ? 'edit' : 'generate');

	// Advanced options
	let showAdvanced = $state(false);
	let inputFidelity: InputFidelity = $state('low');
	let outputCompression = $state(100);
	let outputFormat: OutputFormat = $state('png');
	let selectedBackground: ImageBackground = $state('auto');

	// Calculate price dynamically
	let currentPrice = $derived(PRICING[selectedModel][selectedQuality][selectedSize] * imageCount);

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
			// Convert base64 image data URL to a File object for inputImages
			fetch(imageToEdit.imageData)
				.then(res => res.blob())
				.then(blob => {
					const filename = `edited_image_${imageToEdit?.id}.png`;
					const file = new File([blob], filename, { type: blob.type });
					inputImages = [file];
					imagePreviews = [imageToEdit!.imageData];
				})
				.catch(e => console.error("Error converting image data to File:", e));

			// Set other image properties if available
			if (imageToEdit) {
				selectedModel = (imageToEdit.model as ImageModel) ?? 'gpt-image-1';
				selectedQuality = imageToEdit.quality ?? 'low';
				selectedSize = imageToEdit.size ?? '1024x1024';
				inputFidelity = imageToEdit.input_fidelity ?? 'low';
				outputCompression = imageToEdit.output_compression ?? 100;
				outputFormat = imageToEdit.output_format ?? 'png';
				selectedBackground = imageToEdit.background ?? 'auto';
			}
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
		if (!$apiKey) {
			error = "Please enter your OpenAI API key first";
			return;
		}

		if (!prompt.trim()) {
			error = "Please enter a prompt";
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

		isGenerating = true;
		error = null;

		try {
			let imageDataArray: string[];

			const baseParams = {
				model: selectedModel,
				prompt,
				quality: selectedQuality,
				size: selectedSize,
				n: imageCount,
				input_fidelity: inputFidelity,
				output_compression: outputCompression,
				output_format: outputFormat,
				background: selectedBackground
			};

			if (mode === 'edit' && inputImages.length > 0) {
				imageDataArray = await editImage($apiKey, {
					...baseParams,
					input_fidelity: inputFidelity, // Only add input_fidelity for editing
					images: inputImages,
					mask: inputMask || undefined
				});
			} else {
				// For generation, create params without input_fidelity
				const generationParams = {
					model: selectedModel,
					prompt,
					quality: selectedQuality,
					size: selectedSize,
					n: imageCount,
					output_compression: outputCompression,
					output_format: outputFormat,
					background: selectedBackground
				};
				imageDataArray = await generateImage($apiKey, generationParams);
			}

			// Store each generated image
			for (const imageData of imageDataArray) {
				const imageDataUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
				await addImage(
					imageDataUrl,
					prompt,
					selectedModel,
					selectedQuality,
					selectedSize,
					inputFidelity,
					outputCompression,
					outputFormat,
					selectedBackground
				);
			}

			// Refresh the image store
			await refreshImageStore();

			// Clear images if editing (but keep the prompt)
			if (mode === 'edit') {
				inputImages = [];
				imagePreviews = [];
			}
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
			<textarea
				id="prompt"
				bind:value={prompt}
				rows="4"
				placeholder={inputImages.length > 0
					? 'Describe what to generate using these references - style, subject, composition…'
					: 'Describe the image you want to create…'}
				class="input w-full resize-none leading-relaxed"
				disabled={isGenerating}
			></textarea>
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
					{#each Object.entries(QUALITY_OPTIONS) as [key, option] (key)}
						<option value={key}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="size" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Size</label>
				<select id="size" bind:value={selectedSize} class="input w-full text-sm" disabled={isGenerating}>
					{#each Object.entries(SIZE_OPTIONS) as [key, option] (key)}
						<option value={key}>{option.label}</option>
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
				disabled={isGenerating}
			/>
			<span class="text-sm font-medium text-gray-300 w-5 text-right">{imageCount}</span>
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
						{#if mode === 'edit'}
							<div>
								<label for="inputFidelity" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
									Input Fidelity
								</label>
								<select id="inputFidelity" bind:value={inputFidelity} class="input w-full text-sm" disabled={isGenerating}>
									{#each Object.entries(INPUT_FIDELITY_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-600 mt-1">{INPUT_FIDELITY_OPTIONS[inputFidelity].description}</p>
							</div>
						{/if}
						<div>
							<label for="outputFormat" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
								Output Format
							</label>
							<select id="outputFormat" bind:value={outputFormat} class="input w-full text-sm" disabled={isGenerating}>
								{#each Object.entries(OUTPUT_FORMAT_OPTIONS) as [key, option] (key)}
									<option value={key} disabled={selectedBackground === 'transparent' && key === 'jpeg'}>{option.label}</option>
								{/each}
							</select>
							<p class="text-xs text-gray-600 mt-1">{OUTPUT_FORMAT_OPTIONS[outputFormat].description}</p>
						</div>
					</div>

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
										disabled={isGenerating || inputMask !== null}
									/>
									<div class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors {inputMask !== null ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
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
				</div>
			{/if}
		</div>

		<!-- Submit -->
		<button
			type="submit"
			class="btn group relative bg-linear-to-r ring-transparent ring-2 duration-300 from-purple-700 via-violet-600 to-cyan-600 w-full flex items-center justify-center gap-2 py-3 font-semibold text-white shadow-lg shadow-purple-950/60 overflow-hidden
				{isGenerating
					? 'cursor-not-allowed'
					: !$apiKey
					? 'opacity-50 cursor-not-allowed'
					: 'hover:ring-white/70 hover:shadow-purple-600/50 hover:scale-[1.01] hover:from-purple-600 hover:via-violet-500 hover:to-cyan-500 cursor-pointer'}"
			disabled={isGenerating || !$apiKey}
		>
			{#if isGenerating}
				<!-- Sheen sweep -->
				<span class="pointer-events-none absolute inset-0 overflow-hidden">
					<span class="absolute top-0 bottom-0 w-20 bg-linear-to-r from-transparent via-white/20 to-transparent animate-sheen"></span>
				</span>
				<Loader2 class="relative z-10 h-4 w-4 animate-spin shrink-0" />
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
					? `Generate ${imageCount > 1 ? `${imageCount} images` : 'image'}`
					: `Generate ${imageCount > 1 ? `${imageCount} images` : 'image'} from references`}
			{/if}
		</button>

		{#if !$apiKey}
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
			<span class="text-secondary-500">${currentPrice.toFixed(3)} for {imageCount} {imageCount > 1 ? 'images' : 'image'}</span>
		</div>
	</form>
</div>
