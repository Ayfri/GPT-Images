<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { Upload, X, ChevronDown, ChevronRight, LoaderCircle, Sparkles, ImagePlus, ClipboardPaste, Brush } from '@lucide/svelte';
	import { apiKey } from '#lib/stores/apiKey.svelte.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { generateImage, editImage, type ImageResult } from '#lib/services/openai.ts';
	import type { ImageComplexity, ImageModel, ImageQuality, ImageSize, OutputFormat, ImageBackground, ImageModeration, SvgAuthorModel, SvgEffort } from '#lib/types/image.ts';
	import type { ImageRecord, NewImage } from '#lib/db/imageStore.ts';
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
	import { fileSrc } from '#lib/utils/fileSrc.ts';
	import ImageUploadZone from './ImageUploadZone.svelte';
	import MarkupCanvas from './MarkupCanvas.svelte';
	import { sanitizeSvgBase64 } from '#lib/utils/sanitizeSvg.ts';

	const FORM_OPTIONS_KEY = 'image-generator-options';

	interface FormOptions {
		complexity: ImageComplexity;
		frameCount: number;
		frameDurationMs: number;
		imageCount: number;
		outputCompression: number;
		outputFormat: OutputFormat;
		prompt: string;
		selectedBackground: ImageBackground;
		selectedModel: ImageModel;
		selectedModeration: ImageModeration;
		selectedQuality: ImageQuality;
		selectedSize: ImageSize;
		svgEffort: SvgEffort;
		svgModel: SvgAuthorModel;
	}

	const oneOf = <T extends string>(options: object) => (value: unknown): value is T => typeof value === 'string' && Object.hasOwn(options, value);
	const intIn = (min: number, max: number) => (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

	/** One validator per saved field: stored options are untrusted, so an invalid or outdated value keeps its default. */
	const VALID: { [K in keyof FormOptions]: (value: unknown) => value is FormOptions[K] } = {
		complexity: oneOf<ImageComplexity>(COMPLEXITY_OPTIONS),
		frameCount: intIn(GIF_LIMITS.minFrameCount, GIF_LIMITS.maxFrameCount),
		frameDurationMs: intIn(GIF_LIMITS.minFrameDurationMs, GIF_LIMITS.maxFrameDurationMs),
		imageCount: intIn(1, 10),
		outputCompression: intIn(0, 100),
		outputFormat: oneOf<OutputFormat>(OUTPUT_FORMAT_OPTIONS),
		prompt: (value): value is string => typeof value === 'string' && value !== '',
		selectedBackground: oneOf<ImageBackground>(BACKGROUND_OPTIONS),
		selectedModel: oneOf<ImageModel>(MODEL_SUPPORT),
		selectedModeration: oneOf<ImageModeration>(MODERATION_OPTIONS),
		selectedQuality: oneOf<ImageQuality>(QUALITY_OPTIONS),
		selectedSize: oneOf<ImageSize>(SIZE_OPTIONS),
		svgEffort: oneOf<SvgEffort>(SVG_EFFORT_OPTIONS),
		svgModel: oneOf<SvgAuthorModel>(SVG_AUTHOR_MODEL_OPTIONS)
	};

	const isOptionKey = (key: string): key is keyof FormOptions => Object.hasOwn(VALID, key);

	let opts = $state<FormOptions>({
		complexity: 'high',
		frameCount: GIF_LIMITS.defaultFrameCount,
		frameDurationMs: GIF_LIMITS.defaultFrameDurationMs,
		imageCount: 1,
		outputCompression: 100,
		outputFormat: 'png',
		prompt: 'A cyberpunk city at night with neon lights and flying cars',
		selectedBackground: 'auto',
		selectedModel: DEFAULT_IMAGE_MODEL,
		selectedModeration: 'auto',
		selectedQuality: 'low',
		selectedSize: '1024x1024',
		svgEffort: 'default',
		svgModel: 'gpt-6-luna'
	});

	function restore<K extends keyof FormOptions>(key: K, value: unknown) {
		if (VALID[key](value)) opts[key] = value;
	}

	/** Registered before the persistence effect, so the first save writes the restored options and not the defaults. */
	onMount(() => {
		try {
			for (const [key, value] of Object.entries(JSON.parse(localStorage.getItem(FORM_OPTIONS_KEY) ?? '{}'))) if (isOptionKey(key)) restore(key, value);
		} catch {}
	});

	$effect(() => localStorage.setItem(FORM_OPTIONS_KEY, JSON.stringify(opts)));

	let root: HTMLDivElement | undefined;
	let isGenerating = $state(false);
	let error: string | null = $state(null);
	let inputImages: File[] = $state([]);
	let inputMask: File | null = $state(null);
	let showAdvanced = $state(false);
	let showMarkup = $state(false);
	let markupHasStrokes = $state(false);
	let markupCanvas: ReturnType<typeof MarkupCanvas> | undefined = $state();
	const firstReference = $derived(inputImages[0]);

	/** Reference images attached means edit/compose, none means pure generation. */
	const mode = $derived<'generate' | 'edit'>(inputImages.length > 0 ? 'edit' : 'generate');
	const support = $derived(MODEL_SUPPORT[opts.selectedModel]);
	const gifAllowed = $derived(mode === 'generate' && support.gif);
	const svgAllowed = $derived(mode === 'generate' && support.svg);
	const markupAllowed = $derived(mode === 'edit' && support.markup && showAdvanced);
	const markupOpen = $derived(markupAllowed && showMarkup);

	/**
	 * Effective options: a saved choice the current model or mode can't take is replaced here and stays saved, so it comes back with them.
	 * `xhigh` and `max` only exist on GPT Image 2.5 and 2.6, so other models fall back to high.
	 */
	const quality = $derived<ImageQuality>(support.qualities.includes(opts.selectedQuality) ? opts.selectedQuality : 'high');
	const format = $derived<OutputFormat>((opts.outputFormat === 'gif' && !gifAllowed) || (opts.outputFormat === 'svg' && !svgAllowed) ? 'png' : opts.outputFormat);
	const availableSizes = $derived(format === 'gif' ? GIF_SIZES : STANDARD_SIZES);
	const size = $derived<ImageSize>(availableSizes.includes(opts.selectedSize) ? opts.selectedSize : 'auto');
	const effectiveCount = $derived(format === 'svg' ? 1 : opts.imageCount);
	const price = $derived(format === 'gif' || format === 'svg' ? null : getImagePrice(opts.selectedModel, quality, size));

	const problem = $derived(
		!apiKey.value
			? 'Please enter your OpenAI API key first'
			: !opts.prompt.trim()
				? 'Please enter a prompt'
				: opts.prompt.length > GPT_IMAGE_MODEL_PROMPT_MAX_CHARS
					? `Prompt exceeds the API limit (${GPT_IMAGE_MODEL_PROMPT_MAX_CHARS.toLocaleString('en-US')} characters for GPT Image models). Shorten the text and try again.`
					: opts.selectedBackground === 'transparent' && format === 'jpeg'
						? 'Transparent background is not supported for JPEG output format. Please select PNG or WebP.'
						: format === 'gif' && !VALID.frameDurationMs(opts.frameDurationMs)
							? `Frame duration must be a whole number between ${GIF_LIMITS.minFrameDurationMs} and ${GIF_LIMITS.maxFrameDurationMs} ms.`
							: null
	);

	/** Loads a history image and its options into the form, so editing the same image twice still resets the form. */
	export async function edit(image: ImageRecord) {
		const imageFormat = image.output_format ?? 'png';
		opts = {
			...opts,
			complexity: image.complexity ?? opts.complexity,
			outputCompression: image.output_compression ?? 100,
			outputFormat: imageFormat,
			prompt: image.prompt,
			selectedBackground: image.background ?? 'auto',
			selectedModel: image.model && isSelectableModel(image.model) ? image.model : DEFAULT_IMAGE_MODEL,
			selectedQuality: image.quality ?? 'low',
			selectedSize: image.size && isImageSize(image.size) ? image.size : '1024x1024'
		};
		root?.scrollIntoView({ behavior: 'smooth' });

		try {
			const url = await gallery.url(image);
			if (!url) throw new Error('Image file not found');
			const blob = await (await fetch(url)).blob();
			inputImages = [new File([blob], `edited_image_${image.id}.${imageFormat}`, { type: OUTPUT_FORMAT_OPTIONS[imageFormat].mime })];
		} catch (e) {
			console.error('Error converting image data to File:', e);
		}
	}

	export function regenerate(prompt: string) {
		opts.prompt = prompt;
		root?.scrollIntoView({ behavior: 'smooth' });
	}

	function handleMaskUpload(input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;

		if (file.type !== 'image/png') {
			error = 'Mask image must be a PNG file.';
			return;
		}
		if (file.size > IMAGE_UPLOAD_LIMITS.maskMaxSize) {
			error = `Mask file "${file.name}" is too large. Maximum size is ${IMAGE_UPLOAD_LIMITS.maskMaxSize / (1024 * 1024)}MB.`;
			return;
		}

		error = null;
		inputMask = file;
		input.value = '';
	}

	async function handleGenerate() {
		if (problem) return void (error = problem);

		isGenerating = true;
		error = null;

		try {
			const markup = markupHasStrokes && markupCanvas ? await markupCanvas.toFile() : null;
			if (markup && inputMask) throw new Error("Markup and mask can't be combined.");
			if (markup && markup.size >= IMAGE_UPLOAD_LIMITS.maxFileSize) throw new Error('Markup must be under 50 MB.');

			const meta = {
				background: opts.selectedBackground,
				model: opts.selectedModel,
				output_format: format,
				prompt: opts.prompt,
				quality,
				size,
				...((format === 'jpeg' || format === 'webp') && { output_compression: opts.outputCompression }),
				...(support.complexity && { complexity: opts.complexity }),
				...(format === 'gif' && { frame_count: opts.frameCount, frame_duration_ms: opts.frameDurationMs })
			} satisfies NewImage;

			let result: ImageResult;
			if (mode === 'edit') {
				if (format === 'gif' || format === 'svg') throw new Error('GIF and SVG output only work without reference images.');
				result = await editImage(apiKey.value, { ...meta, n: effectiveCount, image: inputImages, output_format: format, ...(inputMask && { mask: inputMask }), ...(markup && { markup }) });
			} else {
				result = await generateImage(apiKey.value, {
					...meta,
					n: effectiveCount,
					moderation: opts.selectedModeration,
					...(format === 'svg' && { svg: { model: opts.svgModel, ...(opts.svgEffort !== 'default' && { reasoning: { effort: opts.svgEffort } }) } })
				});
			}

			/** The usage covers the whole request, so each image gets an equal share. */
			const cost = result.usage && usageCostUsd(result.usage) / result.images.length;
			const blobs = result.images.map((b64) => new Blob(
				[Uint8Array.fromBase64(format === 'svg' ? sanitizeSvgBase64(b64) : b64)],
				{ type: OUTPUT_FORMAT_OPTIONS[format].mime }
			));
			await gallery.add(blobs, {
				...meta,
				size: result.size ?? size,
				...(cost !== undefined && { cost }),
				...(result.svgUsage && { svg_usage: result.svgUsage })
			});

			/** Editing consumes the references and the markup, the prompt stays. */
			if (mode === 'edit') {
				inputImages = [];
				showMarkup = false;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Image generation failed';
		} finally {
			isGenerating = false;
		}
	}
</script>

<div bind:this={root} class="glass-panel rounded-2xl overflow-hidden">
	<div class="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Sparkles class="h-4 w-4 text-brand-400" />
			<h2 class="text-sm font-semibold text-gray-100 tracking-wide uppercase">
				{inputImages.length > 0 ? 'Generate with references' : 'Create Image'}
			</h2>
		</div>
		{#if inputImages.length > 0}
			<span
				in:fade={{ duration: 200 }}
				class="text-xs px-2 py-0.5 rounded-full bg-brand-900/50 text-brand-300 border border-brand-700/40"
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
		<div>
			<div class="relative">
				<textarea
					id="prompt"
					bind:value={opts.prompt}
					rows="4"
					placeholder={inputImages.length > 0
						? 'Describe what to generate using these references - style, subject, composition…'
						: 'Describe the image you want to create…'}
					class="input resize-none leading-relaxed pb-8"
					disabled={isGenerating}
					aria-describedby="prompt-char-count"
				></textarea>
				<div
					id="prompt-char-count"
					class={['pointer-events-none absolute inset-e-2.5 bottom-2.5 text-xs leading-none tabular-nums select-none', opts.prompt.length > GPT_IMAGE_MODEL_PROMPT_MAX_CHARS ? 'text-warning-400/95' : 'text-gray-500']}
				>
					{opts.prompt.length} / {GPT_IMAGE_MODEL_PROMPT_MAX_CHARS}
				</div>
			</div>
		</div>

		<div>
			<div class="flex items-center justify-between mb-2">
				<label class="field-label flex items-center gap-1.5" for="image-upload">
					<ImagePlus class="h-3.5 w-3.5" />
					Reference images
					<span class="text-gray-700 font-normal normal-case tracking-normal">(optional)</span>
				</label>
				{#if inputImages.length > 0}
					<span class="text-xs text-gray-600">{inputImages.length}/{IMAGE_UPLOAD_LIMITS.maxImages}</span>
				{/if}
			</div>

			<ImageUploadZone bind:files={inputImages} disabled={isGenerating} onerror={(message) => (error = message)}
				onsvg={(text) => (opts.prompt = opts.prompt.trim() ? `${opts.prompt}\n\n${text}` : text)}
			/>
			{#if inputImages.length === 0}
				<p class="text-xs text-gray-700 mt-1.5">
					Drop, paste (Ctrl+V) or browse - any image up to 50 MB, SVG files are added to the prompt as text
				</p>
			{/if}
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div>
				<label for="model" class="field-label block mb-1.5">Model</label>
				<select id="model" bind:value={opts.selectedModel} class="input" disabled={isGenerating}>
					{#each Object.entries(MODEL_OPTIONS) as [key, option] (key)}
						<option value={key}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="quality" class="field-label block mb-1.5">Quality</label>
				<select id="quality" bind:value={() => quality, (value) => (opts.selectedQuality = value)} class="input" disabled={isGenerating}>
					{#each support.qualities as key (key)}
						<option value={key}>{QUALITY_OPTIONS[key].label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="size" class="field-label block mb-1.5">Size</label>
				<select id="size" bind:value={() => size, (value) => (opts.selectedSize = value)} class="input" disabled={isGenerating}>
					{#each availableSizes as key (key)}
						<option value={key}>{SIZE_OPTIONS[key].label}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<label for="imageCount" class="field-label shrink-0 w-20">
				Count
			</label>
			<input
				id="imageCount"
				type="range"
				min="1"
				max="10"
				bind:value={opts.imageCount}
				class="range flex-1"
				disabled={isGenerating || format === 'svg'}
			/>
			<span class="text-sm font-medium text-gray-300 w-5 text-right">{effectiveCount}</span>
		</div>

		<div class="border-t border-white/5 pt-3">
			<button
				type="button"
				class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider transition-colors text-gray-500 cursor-pointer enabled:hover:text-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
				onclick={() => (showAdvanced = !showAdvanced)}
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
							<label for="outputFormat" class="field-label block mb-1.5">
								Output Format
							</label>
							<select id="outputFormat" bind:value={() => format, (value) => (opts.outputFormat = value)} class="input" disabled={isGenerating}>
								{#each Object.entries(OUTPUT_FORMAT_OPTIONS) as [key, option] (key)}
									<option value={key} disabled={(key === 'gif' && !gifAllowed) || (key === 'svg' && !svgAllowed) || (key === 'jpeg' && opts.selectedBackground === 'transparent')}>{option.label}</option>
								{/each}
							</select>
							<p class="text-xs text-gray-600 mt-1">{OUTPUT_FORMAT_OPTIONS[format].description}</p>
						</div>
						{#if support.complexity}
							<div>
								<label for="complexity" class="field-label block mb-1.5">
									Complexity
								</label>
								<select id="complexity" bind:value={opts.complexity} class="input" disabled={isGenerating}>
									{#each Object.entries(COMPLEXITY_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-600 mt-1">Planning effort, independent of quality</p>
							</div>
						{/if}
					</div>

					{#if format === 'gif'}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<div class="flex items-center justify-between mb-1.5">
									<label for="frameCount" class="field-label">
										Frames
									</label>
									<span class="text-xs text-gray-400">{opts.frameCount}</span>
								</div>
								<input
									id="frameCount"
									type="range"
									min={GIF_LIMITS.minFrameCount}
									max={GIF_LIMITS.maxFrameCount}
									bind:value={opts.frameCount}
									class="range w-full"
									disabled={isGenerating}
								/>
							</div>
							<div>
								<label for="frameDuration" class="field-label block mb-1.5">
									Frame duration (ms)
								</label>
								<input
									id="frameDuration"
									type="number"
									min={GIF_LIMITS.minFrameDurationMs}
									max={GIF_LIMITS.maxFrameDurationMs}
									step="1"
									bind:value={opts.frameDurationMs}
									class="input"
									disabled={isGenerating}
								/>
							</div>
						</div>
						<p class="text-xs text-gray-600 -mt-2">Sizes are limited to small squares because frames share one sheet.</p>
					{/if}

					{#if format === 'svg'}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="svgModel" class="field-label block mb-1.5">
									SVG author
								</label>
								<select id="svgModel" bind:value={opts.svgModel} class="input" disabled={isGenerating}>
									{#each Object.entries(SVG_AUTHOR_MODEL_OPTIONS) as [key, option] (key)}
										<option value={key}>{option.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="svgEffort" class="field-label block mb-1.5">
									Author effort
								</label>
								<select id="svgEffort" bind:value={opts.svgEffort} class="input" disabled={isGenerating}>
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
							<label for="moderation" class="field-label block mb-1.5">
								Moderation
							</label>
							<select id="moderation" bind:value={opts.selectedModeration} class="input" disabled={isGenerating}>
								{#each Object.entries(MODERATION_OPTIONS) as [key, option] (key)}
									<option value={key}>{option.label}</option>
								{/each}
							</select>
							<p class="text-xs text-gray-600 mt-1">{MODERATION_OPTIONS[opts.selectedModeration].description}</p>
						</div>
					{/if}

					<div>
						<label for="background" class="field-label block mb-1.5">
							Background
						</label>
						<select id="background" bind:value={opts.selectedBackground} class="input" disabled={isGenerating}>
							{#each Object.entries(BACKGROUND_OPTIONS) as [key, option] (key)}
								<option value={key}>{option.label}</option>
							{/each}
						</select>
						<p class="text-xs text-gray-600 mt-1">{BACKGROUND_OPTIONS[opts.selectedBackground].description}</p>
					</div>

					{#if format === 'jpeg' || format === 'webp'}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<label for="outputCompression" class="field-label">
									Compression
								</label>
								<span class="text-xs text-gray-400">{opts.outputCompression}%</span>
							</div>
							<input
								id="outputCompression"
								type="range"
								min="0"
								max="100"
								bind:value={opts.outputCompression}
								class="range w-full"
								disabled={isGenerating}
							/>
						</div>
					{/if}

					{#if mode === 'edit'}
						<div>
							<label class="field-label block mb-1.5" for="mask-upload">
								Mask (Optional)
							</label>
							<div class="flex items-center gap-3">
								<label class="cursor-pointer">
									<input
										id="mask-upload"
										type="file"
										accept=".png"
										class="hidden"
										onchange={(event) => handleMaskUpload(event.currentTarget)}
										disabled={isGenerating || inputMask !== null || markupOpen}
									/>
									<div class={['flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors', inputMask !== null || markupOpen ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer']}>
										<Upload class="h-3.5 w-3.5" />
										Upload PNG mask
									</div>
								</label>
								{#if inputMask}
									<div class="relative">
										<img {@attach fileSrc(inputMask)} alt="Mask Preview" class="w-12 h-12 object-cover rounded-lg border border-gray-700" />
										<button
											type="button"
											class="absolute -top-1.5 -right-1.5 rounded-full p-0.5 bg-error-500 hover:bg-error-600 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed"
											onclick={() => (inputMask = null)}
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

					{#if markupAllowed}
						<div>
							<span class="field-label block mb-1.5">Markup (Optional)</span>
							<button
								type="button"
								class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm transition-colors cursor-pointer"
								disabled={isGenerating || inputMask !== null}
								onclick={() => (showMarkup = !showMarkup)}
							>
								<Brush class="h-3.5 w-3.5" />
								{markupOpen ? 'Discard markup' : 'Draw markup'}
							</button>
							{#if markupOpen}
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

		<button
			type="submit"
			class={[
				'btn group relative bg-linear-to-r ring-transparent ring-2 duration-300 from-brand-700 via-highlight-600 to-aqua-600 w-full flex items-center justify-center gap-2 py-3 font-semibold text-white shadow-lg shadow-brand-950/60 overflow-hidden disabled:cursor-not-allowed',
				'enabled:hover:ring-white/70 enabled:hover:shadow-brand-600/50 enabled:hover:scale-[1.01] enabled:hover:from-brand-600 enabled:hover:via-highlight-500 enabled:hover:to-aqua-500',
				!isGenerating && !apiKey.value && 'opacity-50'
			]}
			disabled={isGenerating || !apiKey.value}
		>
			{#if isGenerating}
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
			<span>{MODEL_OPTIONS[opts.selectedModel].label}</span>
			{#if price !== null}
				<span class="text-secondary-500">${(price * effectiveCount).toFixed(3)} for {effectiveCount} {effectiveCount > 1 ? 'images' : 'image'}</span>
			{:else}
				<span class="text-gray-500">Price estimate unavailable, the real cost is recorded after generation</span>
			{/if}
		</div>
	</form>
</div>
