<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { ImagePlus, Loader2, Send, Sparkles, X } from 'lucide-svelte';
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { videos, totalVideoCount, addVideoWithStorageManagement } from '$lib/stores/videoStore';
	import { generateVideo, getVideoStatus, remixVideo } from '$lib/services/video';
	import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
	import { DURATION_OPTIONS, MODEL_OPTIONS, PRICING, RESOLUTION_OPTIONS_BY_MODEL } from '$lib/types/video';
	import { browser } from '$app/environment';
	import { resizeImageToResolution } from '$lib/utils/imageResize';

	// Storage keys
	const FORM_OPTIONS_KEY = 'video-generator-options';

	// Load options from localStorage if available
	function loadFormOptions() {
		if (!browser) return;
		const raw = localStorage.getItem(FORM_OPTIONS_KEY);
		if (!raw) return;
		try {
			const opts = JSON.parse(raw);
			if (opts.selectedModel) selectedModel = opts.selectedModel;
			if (opts.selectedResolution) selectedResolution = opts.selectedResolution;
			if (opts.selectedDuration) selectedDuration = opts.selectedDuration;
		} catch {}
	}

	function saveFormOptions() {
		if (!browser) return;
		const opts = {
			selectedDuration,
			selectedModel,
			selectedResolution
		};
		localStorage.setItem(FORM_OPTIONS_KEY, JSON.stringify(opts));
	}

	interface Props {
		prompt?: string;
		remixVideoId?: string | null;
	}

	let { prompt = $bindable(''), remixVideoId = $bindable(null) }: Props = $props();

	let error: string | null = $state(null);
	let generationProgress = $state(0);
	let generationStatus = $state('');
	let imageDropZone: HTMLDivElement | undefined = $state();
	let inputImage: File | null = null;
	let inputImagePreview: string | null = $state(null);
	let isDragging = $state(false);
	let isGenerating = $state(false);
	let isProcessingImage = $state(false);
	let lastProcessedResolution: string | null = $state(null);
	let pollingInterval: ReturnType<typeof setTimeout> | null = null;
	let selectedDuration: VideoDuration = $state(4);
	let selectedModel: VideoModel = $state('sora-2');
	let selectedResolution: VideoResolution = $state('720x1280');
	let sourceImageFile: File | string | null = $state(null);
	let urlInput = $state('');




	onMount(() => {
		loadFormOptions();
		if (!prompt) {
			prompt = "A futuristic city with flying cars at sunset";
		}
		error = null;

		// Clean up polling on unmount
		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
			}
		};
	});



	async function pollVideoStatus(videoId: string) {
		try {
			const status = await getVideoStatus($apiKey, videoId);

			if (status.status === 'failed') {
				// Video generation failed
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}
				const errorMessage = status.error
					? `${status.error.code}: ${status.error.message}`
					: 'Video generation failed';
				error = errorMessage;
				isGenerating = false;
				generationStatus = '';
				generationProgress = 0;
				return;
			}

			if (status.status === 'completed') {
				// Video is ready
				if (pollingInterval) {
					clearInterval(pollingInterval);
					pollingInterval = null;
				}

				if (status.video_data) {
					// Store the video with automatic cleanup if needed
					const { id: videoId, cleanedCount } = await addVideoWithStorageManagement(
						selectedDuration,
						selectedModel,
						prompt,
						selectedResolution,
						status.video_data
					);

					// Show cleanup notification if videos were deleted
					if (cleanedCount > 0) {
						// We could add a toast notification here, but for now we'll just update the status
						generationStatus = `${cleanedCount} ancienne${cleanedCount > 1 ? 's' : ''} vidéo${cleanedCount > 1 ? 's' : ''} supprimée${cleanedCount > 1 ? 's' : ''} pour libérer de l'espace`;
						setTimeout(() => {
							generationStatus = wasRemix ? 'Remix completed!' : 'Video completed!';
						}, 3000);
					}

					// Determine status message before clearing
					const wasRemix = remixVideoId !== null;

					// Clear the form
					prompt = '';
					remixVideoId = null;
					inputImage = null;
					inputImagePreview = null;
					lastProcessedResolution = null;
					sourceImageFile = null;
					urlInput = '';
					isGenerating = false;
					generationStatus = wasRemix ? 'Remix completed!' : 'Video completed!';
					generationProgress = 100;
				} else {
					// Video completed but failed to download content
					const errorMessage = status.error
						? `${status.error.code}: ${status.error.message}`
						: 'Video generation completed but failed to download content';
					error = errorMessage;
					isGenerating = false;
					generationStatus = '';
					generationProgress = 0;
				}
			} else if (status.status === 'in_progress') {
				const progress = status.progress || 0;
				if (progress >= 100) {
					generationStatus = 'Finalizing video...';
				} else {
					generationStatus = 'Generating video...';
				}
				generationProgress = progress;
			} else if (status.status === 'queued') {
				generationStatus = 'Video queued...';
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
			// Store the source file
			sourceImageFile = file;

			// Resize image to match target resolution
			const resizedFile = await resizeImageToResolution(file, selectedResolution);
			inputImage = resizedFile;
			lastProcessedResolution = selectedResolution;

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				inputImagePreview = e.target?.result as string;
				isProcessingImage = false;
			};
			reader.readAsDataURL(resizedFile);
		} catch (err) {
			console.error('Error processing image:', err);
			error = err instanceof Error ? err.message : 'Failed to process image';
			isProcessingImage = false;
		}
	}

	async function handleImageUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			await processImage(file);
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const file = event.dataTransfer?.files[0];
		if (file && file.type.startsWith('image/')) {
			await processImage(file);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleUrlSubmit() {
		if (!urlInput.trim()) return;

		await processImage(urlInput.trim());
		urlInput = '';
	}

	async function handlePaste(event: ClipboardEvent) {
		// Check for image file
		const items = event.clipboardData?.items;
		if (items) {
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.startsWith('image/')) {
					const file = items[i].getAsFile();
					if (file) {
						event.preventDefault();
						await processImage(file);
						return;
					}
				}
			}
		}

		// Check for URL
		const text = event.clipboardData?.getData('text');
		if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
			event.preventDefault();
			urlInput = text;
			await handleUrlSubmit();
		}
	}

	function removeImage() {
		inputImage = null;
		inputImagePreview = null;
		lastProcessedResolution = null;
		sourceImageFile = null;
		urlInput = '';
	}

	function clearRemixMode() {
		remixVideoId = null;
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

		isGenerating = true;
		error = null;
		generationStatus = remixVideoId ? 'Starting remix...' : 'Starting generation...';
		generationProgress = 0;

		try {
			let videoId: string;

			if (remixVideoId) {
				// Remix mode
				videoId = await remixVideo($apiKey, {
					prompt,
					videoId: remixVideoId
				});
			} else {
				// Regular generation mode
				videoId = await generateVideo($apiKey, {
					duration: selectedDuration,
					inputReference: inputImage || undefined,
					model: selectedModel,
					prompt,
					resolution: selectedResolution
				});
			}

			// Start polling for video status
			pollingInterval = setInterval(() => {
				pollVideoStatus(videoId);
			}, 5000); // Poll every 5 seconds

			// Do an initial poll immediately
			pollVideoStatus(videoId);

		} catch (err) {
			console.error('Error generating video:', err);
			error = err instanceof Error ? err.message : 'Failed to generate video';
			isGenerating = false;
			generationStatus = '';
		}
	}
	// Available resolutions for selected model
	let availableResolutions = $derived(RESOLUTION_OPTIONS_BY_MODEL[selectedModel]);
	// Auto-select first available resolution when model changes
	$effect(() => {
		if (selectedModel && availableResolutions && !(selectedResolution in availableResolutions)) {
			selectedResolution = Object.keys(availableResolutions)[0] as VideoResolution;
		}
	});
	// Calculate price dynamically
	let currentPrice = $derived((() => {
		const modelPricing = PRICING[selectedModel]?.['standard'];
		if (modelPricing && selectedResolution in modelPricing) {
			return modelPricing[selectedResolution as keyof typeof modelPricing][selectedDuration] || 0;
		}
		return 0;
	})());
	// Save options whenever they change
	$effect(() => {
		saveFormOptions();
	});
	// Re-process image if resolution changes
	$effect(() => {
		if (sourceImageFile && selectedResolution !== lastProcessedResolution && !isProcessingImage) {
			processImage(sourceImageFile);
		}
	});
</script>

<div class="glass-effect p-5 rounded-xl">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-medium text-gray-100">
			{remixVideoId ? 'Remix Video' : 'Generate New Video'}
		</h2>
		{#if remixVideoId}
			<button
				type="button"
				onclick={clearRemixMode}
				class="btn-ghost p-2 rounded-full hover:bg-error-700/30"
				aria-label="Cancel remix"
				title="Cancel remix"
			>
				<X class="w-4 h-4 text-error-400" />
			</button>
		{/if}
	</div>

	{#if remixVideoId}
		<div
			in:fly={{ y: -10, duration: 200 }}
			class="mb-4 text-sm text-purple-400 bg-purple-900/20 border border-purple-600/20 p-3 rounded-md flex items-center gap-2"
		>
			<Sparkles class="w-4 h-4" />
			<span>Remix mode: The video will be modified based on your new prompt while keeping the original structure.</span>
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); handleGenerate(); }} class="space-y-4">
		<div>
			<label for="prompt" class="block text-sm font-medium text-gray-300 mb-2">
				Prompt
			</label>
			<textarea
				id="prompt"
				bind:value={prompt}
				rows="4"
				placeholder={remixVideoId ? "Describe what changes you want to make..." : "Describe the video you want to generate..."}
				class="input w-full"
				disabled={isGenerating}
			></textarea>
		</div>

		{#if !remixVideoId}
			<div>
				<label for="input-image" class="block text-sm font-medium text-gray-300 mb-2">
					Input Image (Optional)
				</label>

				{#if inputImagePreview}
					<div class="relative group inline-block mb-2">
						<img
							src={inputImagePreview}
							alt="Input preview"
							class="w-24 h-24 object-cover rounded-lg border-2 border-gray-700"
						/>
						<button
							type="button"
							onclick={removeImage}
							class="absolute -top-2 -right-2 bg-error-600 hover:bg-error-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
							aria-label="Remove image"
						>
							<X class="w-4 h-4" />
						</button>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						aria-label="Image drop zone"
						bind:this={imageDropZone}
						class="border-2 border-dashed rounded-lg p-3 transition-colors {isDragging ? 'border-primary-500 bg-primary-900/10' : 'border-gray-700'}"
						class:opacity-50={isProcessingImage}
						ondragleave={handleDragLeave}
						ondragover={handleDragOver}
						ondrop={handleDrop}
						onpaste={handlePaste}
						role="region"
						tabindex="0"
					>
						<div class="flex items-center gap-3">
							<label
								for="input-image"
								class="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded cursor-pointer transition-colors"
							>
								<ImagePlus class="w-4 h-4" />
								Choose
							</label>
							<input
								id="input-image"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onchange={handleImageUpload}
								class="hidden"
								disabled={isGenerating || isProcessingImage}
							/>

							<div class="flex-1 flex items-center gap-2">
								<input
									type="text"
									bind:value={urlInput}
									placeholder="or paste image URL"
									onkeydown={(e) => e.key === 'Enter' && handleUrlSubmit()}
									class="flex-1 bg-transparent border-0 text-sm text-gray-400 placeholder-gray-600 focus:outline-none"
									disabled={isGenerating || isProcessingImage}
								/>
								{#if urlInput}
									<button
										type="button"
										onclick={handleUrlSubmit}
										class="text-xs text-primary-400 hover:text-primary-300"
										disabled={isProcessingImage}
									>
										Load
									</button>
								{/if}
							</div>
						</div>
						<p class="text-xs text-gray-600 mt-2">
							Drop image, paste URL/image (Ctrl+V), or click to browse
						</p>
					</div>
				{/if}

				{#if isProcessingImage}
					<p class="text-xs text-blue-400 mt-1">Processing image...</p>
				{:else}
					<p class="text-xs text-gray-500 mt-1">
						Image will be auto-resized to {selectedResolution} with black padding
					</p>
				{/if}
			</div>
		{/if}

		{#if !remixVideoId}
			<div>
				<label for="model" class="block text-sm font-medium text-gray-300 mb-2">
					Model
				</label>
				<select
					id="model"
					bind:value={selectedModel}
					class="input w-full"
					disabled={isGenerating}
				>
					{#each Object.entries(MODEL_OPTIONS) as [key, option] (key)}
						<option value={key}>{option.label}</option>
					{/each}
				</select>
				<p class="text-xs text-gray-500 mt-1">
					{MODEL_OPTIONS[selectedModel].description}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="resolution" class="block text-sm font-medium text-gray-300 mb-2">
						Resolution
					</label>
					<select
						id="resolution"
						bind:value={selectedResolution}
						class="input w-full"
						disabled={isGenerating}
					>
						{#each Object.entries(availableResolutions) as [key, option] (key)}
							<option value={key}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="duration" class="block text-sm font-medium text-gray-300 mb-2">
						Duration
					</label>
					<select
						id="duration"
						bind:value={selectedDuration}
						class="input w-full"
						disabled={isGenerating}
					>
						{#each Object.entries(DURATION_OPTIONS) as [key, option] (key)}
							<option value={Number(key)}>{option.label}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}


		<button
			type="submit"
			class="btn group bg-linear-to-r ring-transparent ring-2 duration-300 from-purple-700 to-cyan-600 w-full flex items-center justify-center gap-2 {isGenerating || !$apiKey ? 'opacity-50 cursor-not-allowed' : 'hover:ring-white cursor-pointer'}"
			disabled={isGenerating || !$apiKey}
		>
			{#if isGenerating}
				<Loader2 class="h-5 w-5 animate-spin" />
				{remixVideoId ? 'Remixing Video...' : 'Generating Video...'}
			{:else if remixVideoId}
				<Sparkles class="h-5 w-5" />
				Remix Video
			{:else}
				<Send class="h-5 w-5" />
				Generate Video
			{/if}
		</button>

		{#if isGenerating}
			<div class="mt-4">
				{#if generationProgress > 0 && generationProgress < 100}
					<!-- Barre de progression pendant la génération -->
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm text-gray-300">{generationStatus}</span>
						<span class="text-sm text-gray-400">{generationProgress}%</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div
							class="bg-linear-to-r from-purple-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
							style="width: {generationProgress}%"
						></div>
					</div>
				{:else}
					<!-- Statut textuel pour queued, finalizing, ou erreurs -->
					<div class="flex items-center justify-center">
						<span class="text-sm text-gray-300">{generationStatus}</span>
					</div>
				{/if}
			</div>
		{/if}

		{#if !$apiKey}
			<div class="text-sm text-warning-400 bg-warning-900/20 border border-warning-600/20 p-2 rounded-md">
				Please add your OpenAI API key to generate videos
			</div>
		{/if}

		{#if generationStatus && isGenerating && !generationStatus.includes('completed')}
			<div
				in:fly={{ y: 10, duration: 300 }}
				class="text-sm text-blue-400 bg-blue-900/20 border border-blue-600/20 p-2 rounded-md"
			>
				{generationStatus}
			</div>
		{/if}

		{#if error}
			<div
				in:fly={{ y: 10, duration: 300 }}
				class="text-sm text-error-400 bg-error-900/20 border border-error-600/20 p-2 rounded-md"
			>
				{error}
			</div>
		{/if}

		{#if !remixVideoId}
			<div class="text-xs text-gray-500 flex justify-between pt-1">
				<span>Model: {MODEL_OPTIONS[selectedModel].label}</span>
				<span class="text-secondary-400">${currentPrice.toFixed(2)} per video</span>
			</div>
		{:else}
			<div class="text-xs text-gray-500 pt-1">
				<span class="text-purple-400">Note: Remix inherits settings from the original video</span>
			</div>
		{/if}
	</form>
</div>
