<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { ClipboardPaste, Film, Loader2, Sparkles, X } from '@lucide/svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { addVideoWithStorageManagement } from '$lib/stores/videoStore';
	import { generateVideo, getVideoStatus, remixVideo } from '$lib/services/video';
	import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
	import { DURATION_OPTIONS, MODEL_OPTIONS, PRICING, RESOLUTION_OPTIONS_BY_MODEL } from '$lib/types/video';
	import { browser } from '$app/environment';
	import { resizeImageToResolution } from '$lib/utils/imageResize';
	import ImageUploadZone from '$lib/components/ImageUploadZone.svelte';

	const FORM_OPTIONS_KEY = 'video-generator-options';

	function loadFormOptions() {
		if (!browser) return;
		const raw = localStorage.getItem(FORM_OPTIONS_KEY);
		if (!raw) return;
		try {
			const opts = JSON.parse(raw);
			if (opts.selectedModel) selectedModel = opts.selectedModel;
			if (opts.selectedResolution) selectedResolution = opts.selectedResolution;
			if (opts.selectedDuration) selectedDuration = opts.selectedDuration;
			if (opts.prompt) prompt = opts.prompt;
		} catch {}
	}

	function saveFormOptions() {
		if (!browser) return;
		localStorage.setItem(
			FORM_OPTIONS_KEY,
			JSON.stringify({ selectedDuration, selectedModel, selectedResolution, prompt }),
		);
	}

	interface Props {
		prompt?: string;
		remixVideoId?: string | null;
	}

	let { prompt = $bindable(''), remixVideoId = $bindable(null) }: Props = $props();

	let error: string | null = $state(null);
	let generationProgress = $state(0);
	let generationStatus = $state('');
	let inputImages: File[] = $state([]);
	let inputImagePreviews: string[] = $state([]);
	let isGenerating = $state(false);
	let isProcessingImage = $state(false);
	let lastProcessedResolution: string | null = $state(null);
	let pasteFlash = $state(false);
	let pollingInterval: ReturnType<typeof setTimeout> | null = null;
	let selectedDuration: VideoDuration = $state(4);
	let selectedModel: VideoModel = $state('sora-2');
	let selectedResolution: VideoResolution = $state('720x1280');
	let sourceImageFile: File | string | null = $state(null);

	let availableResolutions = $derived(RESOLUTION_OPTIONS_BY_MODEL[selectedModel]);

	let currentPrice = $derived(
		PRICING[selectedModel]?.[selectedResolution]?.[selectedDuration] ?? 0
	);

	$effect(() => {
		if (selectedModel && availableResolutions && !(selectedResolution in availableResolutions)) {
			selectedResolution = Object.keys(availableResolutions)[0] as VideoResolution;
		}
	});

	$effect(() => {
		saveFormOptions();
	});

	$effect(() => {
		if (sourceImageFile && selectedResolution !== lastProcessedResolution && !isProcessingImage) {
			processImage(sourceImageFile);
		}
	});

	onMount(() => {
		loadFormOptions();
		if (!prompt) prompt = 'A futuristic city with flying cars at sunset';
		error = null;

		function handleGlobalPaste(e: ClipboardEvent) {
			if (remixVideoId) return;
			const target = e.target as HTMLElement;
			if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
			const items = e.clipboardData?.items;
			if (!items) return;
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.startsWith('image/')) {
					const file = items[i].getAsFile();
					if (!file) continue;
					processImage(file).then(() => {
						pasteFlash = true;
						setTimeout(() => (pasteFlash = false), 1200);
					});
					return;
				}
			}
		}

		document.addEventListener('paste', handleGlobalPaste);
		return () => {
			document.removeEventListener('paste', handleGlobalPaste);
			if (pollingInterval) clearInterval(pollingInterval);
		};
	});

	async function pollVideoStatus(videoId: string) {
		try {
			const status = await getVideoStatus($apiKey, videoId);

			if (status.status === 'failed') {
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}
				error = status.error ? `${status.error.code}: ${status.error.message}` : 'Video generation failed';
				isGenerating = false;
				generationStatus = '';
				generationProgress = 0;
				return;
			}

			if (status.status === 'completed') {
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}

				if (status.video_data) {
					const wasRemix = remixVideoId !== null;
					const { cleanedCount } = await addVideoWithStorageManagement(
						selectedDuration,
						selectedModel,
						prompt,
						selectedResolution,
						status.video_data,
					);

					remixVideoId = null;
					inputImages = [];
					inputImagePreviews = [];
					lastProcessedResolution = null;
					sourceImageFile = null;
					isGenerating = false;
					generationProgress = 100;

					if (cleanedCount > 0) {
						generationStatus = `${cleanedCount} old video${cleanedCount > 1 ? 's' : ''} removed to free space`;
						setTimeout(() => {
							generationStatus = wasRemix ? 'Remix complete!' : 'Video complete!';
						}, 3000);
					} else {
						generationStatus = wasRemix ? 'Remix complete!' : 'Video complete!';
					}
				} else {
					error =
						status.error ?
							`${status.error.code}: ${status.error.message}`
						:	'Video completed but failed to download';
					isGenerating = false;
					generationStatus = '';
					generationProgress = 0;
				}
			} else if (status.status === 'in_progress') {
				const progress = status.progress || 0;
				generationStatus = progress >= 100 ? 'Finalizing…' : 'Generating…';
				generationProgress = progress;
			} else if (status.status === 'queued') {
				generationStatus = 'Queued…';
				generationProgress = 0;
			}
		} catch (err) {
			console.error('Error polling video status:', err);
			if (pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
			error = err instanceof Error ? err.message : 'Failed to check video status';
			isGenerating = false;
			generationStatus = '';
			generationProgress = 0;
		}
	}

	async function processImage(file: File | string) {
		isProcessingImage = true;
		error = null;
		try {
			sourceImageFile = file;
			const resizedFile = await resizeImageToResolution(file, selectedResolution);
			inputImages = [resizedFile];
			lastProcessedResolution = selectedResolution;
			const reader = new FileReader();
			reader.onload = (e) => {
				inputImagePreviews = [e.target?.result as string];
				isProcessingImage = false;
			};
			reader.readAsDataURL(resizedFile);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to process image';
			isProcessingImage = false;
		}
	}

	function removeImage() {
		inputImages = [];
		inputImagePreviews = [];
		lastProcessedResolution = null;
		sourceImageFile = null;
	}

	function clearRemixMode() {
		remixVideoId = null;
		removeImage();
	}

	async function handleGenerate() {
		if (!$apiKey) {
			error = 'Please enter your OpenAI API key first';
			return;
		}
		if (!prompt.trim()) {
			error = 'Please enter a prompt';
			return;
		}

		isGenerating = true;
		error = null;
		generationStatus = remixVideoId ? 'Starting remix…' : 'Starting generation…';
		generationProgress = 0;

		try {
			let videoId: string;
			if (remixVideoId) {
				videoId = await remixVideo($apiKey, { prompt, videoId: remixVideoId });
			} else {
				videoId = await generateVideo($apiKey, {
					duration: selectedDuration,
					inputReference: inputImages[0] || undefined,
					model: selectedModel,
					prompt,
					resolution: selectedResolution,
				});
			}
			pollingInterval = setInterval(() => pollVideoStatus(videoId), 5000);
			pollVideoStatus(videoId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate video';
			isGenerating = false;
			generationStatus = '';
		}
	}
</script>

<div class="glass-panel rounded-2xl overflow-hidden">
	<!-- Header -->
	<div class="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Film class="h-4 w-4 text-purple-400" />
			<h2 class="text-sm font-semibold text-gray-100 tracking-wide uppercase">
				{remixVideoId ? 'Remix Video'
				: inputImages.length > 0 ? 'Generate from image'
				: 'Create Video'}
			</h2>
		</div>
		{#if remixVideoId}
			<div class="flex items-center gap-2">
				<span
					in:fade={{ duration: 200 }}
					class="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40"
				>
					Remix mode
				</span>
				<button
					type="button"
					onclick={clearRemixMode}
					class="p-1 rounded-full hover:bg-error-700/30 transition-colors cursor-pointer"
					aria-label="Cancel remix"
				>
					<X class="w-3.5 h-3.5 text-error-400" />
				</button>
			</div>
		{:else if inputImages.length > 0}
			<span
				in:fade={{ duration: 200 }}
				class="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40"
			>
				1 reference
			</span>
		{:else}
			<span in:fade={{ duration: 200 }} class="text-xs text-gray-600 flex items-center gap-1">
				<ClipboardPaste class="h-3 w-3" />
				Ctrl+V to attach image
			</span>
		{/if}
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleGenerate();
		}}
		class="p-5 space-y-4"
	>
		<!-- Prompt -->
		<textarea
			id="prompt"
			bind:value={prompt}
			rows="4"
			placeholder={remixVideoId ? 'Describe the changes to make to the video…'
			: inputImages.length > 0 ? 'Describe what to generate from this image…'
			: 'Describe the video you want to create…'}
			class="input w-full resize-none leading-relaxed"
			disabled={isGenerating}
		></textarea>

		<!-- Reference image - hidden in remix mode -->
		{#if !remixVideoId}
			<div>
				<div class="flex items-center justify-between mb-2">
					<label
						class="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5"
						for="video-image-upload"
					>
						<Film class="h-3.5 w-3.5" />
						Reference image
						<span class="text-gray-700 font-normal normal-case tracking-normal">(optional)</span>
					</label>
					{#if isProcessingImage}
						<span class="text-xs text-blue-400 flex items-center gap-1">
							<Loader2 class="h-3 w-3 animate-spin" /> Resizing…
						</span>
					{/if}
				</div>

				<div class="{pasteFlash ? 'ring-2 ring-purple-500/60 rounded-lg' : ''} transition-shadow duration-300">
					<ImageUploadZone
						images={inputImages}
						imagePreviews={inputImagePreviews}
						maxImages={1}
						acceptedExtensions="image/jpeg,image/png,image/webp"
						isGenerating={isGenerating || isProcessingImage}
						singleImage={true}
						onImagesChange={(imgs, previews) => {
							if (imgs.length > 0) {
								sourceImageFile = imgs[0];
								lastProcessedResolution = selectedResolution;
								inputImages = imgs;
								inputImagePreviews = previews;
							} else {
								removeImage();
							}
						}}
					/>
				</div>
				{#if inputImages.length === 0}
					<p class="text-xs text-gray-700 mt-1.5">
						Drop, paste (Ctrl+V) or browse - will be auto-resized to {selectedResolution}
					</p>
				{:else}
					<p class="text-xs text-gray-700 mt-1.5">Auto-resized to {selectedResolution} with black padding</p>
				{/if}
			</div>
		{/if}

		<!-- Model / Resolution / Duration - hidden in remix mode -->
		{#if !remixVideoId}
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label for="v-model" class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider"
						>Model</label
					>
					<select
						id="v-model"
						bind:value={selectedModel}
						class="input w-full text-sm"
						disabled={isGenerating}
					>
						{#each Object.entries(MODEL_OPTIONS) as [key, option] (key)}
							<option value={key}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label
						for="v-resolution"
						class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider"
						>Resolution</label
					>
					<select
						id="v-resolution"
						bind:value={selectedResolution}
						class="input w-full text-sm"
						disabled={isGenerating}
					>
						{#each Object.entries(availableResolutions) as [key, option] (key)}
							<option value={key}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label
						for="v-duration"
						class="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Duration</label
					>
					<select
						id="v-duration"
						bind:value={selectedDuration}
						class="input w-full text-sm"
						disabled={isGenerating}
					>
						{#each Object.entries(DURATION_OPTIONS) as [key, option] (key)}
							<option value={Number(key)}>{option.label}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

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
					{remixVideoId ? 'Remixing' : 'Generating'}
					<span class="flex items-end gap-0.5 pb-px">
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:0ms]"></span>
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:150ms]"></span>
						<span class="block h-1 w-1 rounded-full bg-white/80 animate-bounce [animation-delay:300ms]"></span>
					</span>
				</span>
			{:else}
				<Sparkles class="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
				{remixVideoId ? 'Remix video'
				: inputImages.length > 0 ? 'Generate from image'
				: 'Generate video'}
			{/if}
		</button>

		<!-- Progress -->
		{#if isGenerating}
			<div in:fly={{ y: 6, duration: 200 }} class="space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-xs text-gray-400">{generationStatus}</span>
					{#if generationProgress > 0 && generationProgress < 100}
						<span class="text-xs text-gray-500">{generationProgress}%</span>
					{/if}
				</div>
				{#if generationProgress > 0 && generationProgress < 100}
					<div class="w-full bg-gray-800 rounded-full h-1.5">
						<div
							class="bg-linear-to-r from-purple-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
							style="width: {generationProgress}%"
						></div>
					</div>
				{/if}
			</div>
		{/if}

		{#if !$apiKey}
			<div class="text-sm text-warning-400 bg-warning-900/20 border border-warning-600/20 p-2 rounded-md">
				Please add your OpenAI API key to generate videos
			</div>
		{/if}

		{#if error}
			<div
				in:fly={{ y: 8, duration: 250 }}
				class="text-sm text-error-400 bg-error-900/20 border border-error-600/20 p-2 rounded-md"
			>
				{error}
			</div>
		{/if}

		<!-- Footer -->
		<div class="text-xs text-gray-600 flex justify-between pt-0.5">
			{#if remixVideoId}
				<span class="text-purple-500/70">Remix inherits settings from the original video</span>
			{:else}
				<span>{MODEL_OPTIONS[selectedModel].label}</span>
				<span class="text-secondary-500">${currentPrice.toFixed(2)} per video</span>
			{/if}
		</div>
	</form>
</div>
