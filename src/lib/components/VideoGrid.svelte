<script lang="ts">
	import { run, stopPropagation, self, createBubbler } from 'svelte/legacy';

	const bubble = createBubbler();
	import { onMount, onDestroy } from 'svelte';
	import { tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		ArrowDown,
		ArrowUp,
		ChevronLeft,
		ChevronRight,
		Video as VideoIcon
	} from 'lucide-svelte';
	import VideoCard from './VideoCard.svelte';
	import { videos, initVideoStore, loadMoreVideos, totalVideoCount, type VideoRecord } from '$lib/stores/videoStore';
	import { quintOut } from 'svelte/easing';
	import { flip } from 'svelte/animate';
	import { calculateVideoPrice } from '$lib/utils/videoPrice';

	interface Props {
		onRegenerate: (prompt: string) => void;
		onRemix: (id: string, prompt: string) => void;
	}

	let { onRegenerate, onRemix }: Props = $props();

	let loading = $state(true);
	let loadingMore = $state(false);
	let largeViewIndex: number | null = $state(null);
	let currentVideo: VideoRecord | null = $state(null);
	let currentVideoPrice = $state(0);
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let sortField: 'duration' | 'price' | 'prompt' | 'resolution' | 'timestamp' = $state('timestamp');

	let observer: IntersectionObserver | undefined = $state();
	let videoGridRef: HTMLElement | undefined = $state();

	function getVideoPrice(video: VideoRecord): number {
		return calculateVideoPrice(video.model, video.resolution, video.duration);
	}

	function getResolutionArea(resolution: string | undefined): number {
		if (!resolution) return 0;
		const [w, h] = resolution.split('x').map(Number);
		return w * h;
	}

	function getSortValue(
		video: VideoRecord,
		field: typeof sortField
	): string | number {
		switch (field) {
			case 'duration':
				return video.duration ?? 0;
			case 'price':
				return getVideoPrice(video);
			case 'prompt':
				return video.prompt.toLowerCase();
			case 'resolution':
				return getResolutionArea(video.resolution);
			case 'timestamp':
				return video.timestamp;
		}
	}

	let sortedVideos = $derived([...$videos].sort((a, b) => {
		const aValue = getSortValue(a, sortField);
		const bValue = getSortValue(b, sortField);

		if (aValue < bValue) {
			return sortDirection === 'asc' ? -1 : 1;
		}
		if (aValue > bValue) {
			return sortDirection === 'asc' ? 1 : -1;
		}
		return 0;
	}));

	run(() => {
		if (largeViewIndex !== null) {
			currentVideo = sortedVideos[largeViewIndex];
		} else {
			currentVideo = null;
		}
	});

	run(() => {
		if (currentVideo) {
			currentVideoPrice = getVideoPrice(currentVideo);
		}
	});

	onMount(async () => {
		await initVideoStore();
		loading = false;

		// Set up intersection observer for infinite scroll
		observer = new IntersectionObserver(
			async (entries) => {
				const lastVideoCard = entries[0];
				if (lastVideoCard.isIntersecting && !loadingMore && $videos.length < $totalVideoCount) {
					loadingMore = true;
					try {
						await loadMoreVideos();
						// Re-setup observer after loading more videos
						await setupObserver();
					} finally {
						loadingMore = false;
					}
				}
			},
			{ threshold: 0.5 }
		);

		// Observe the last element if videos are already loaded
		if (sortedVideos.length > 0 && videoGridRef) {
			const lastCard = videoGridRef.lastElementChild;
			if (lastCard) {
				observer.observe(lastCard);
			}
		}
	});

	// Cleanup observer on component destroy
	onDestroy(() => {
		if (observer) {
			observer.disconnect();
		}
	});

	// Only reconnect observer after loading more videos, not when videos are added to the store
	async function setupObserver() {
		if (observer && videoGridRef && sortedVideos.length > 0 && $videos.length < $totalVideoCount && !loadingMore) {
			// Wait for DOM updates
			await tick();
			// Disconnect and reconnect to ensure we're observing the correct last element
			observer.disconnect();
			const lastCard = videoGridRef.lastElementChild;
			if (lastCard) {
				observer.observe(lastCard);
			}
		}
	}

	// Setup observer after loading more videos
	run(() => {
		if (!loadingMore && sortedVideos.length > 0) {
			setupObserver();
		}
	});

	function handleRegenerate(prompt: string) {
		onRegenerate(prompt);
	}

	function handleRemix(id: string, prompt: string) {
		onRemix(id, prompt);
	}

	function handleView(videoId: string) {
		largeViewIndex = sortedVideos.findIndex(vid => vid.id === videoId);
	}

	function closeLargeVideo() {
		largeViewIndex = null;
	}

	function showNext() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex + 1) % sortedVideos.length;
	}

	function showPrev() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex - 1 + sortedVideos.length) % sortedVideos.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (largeViewIndex === null) return;

		if (e.key === 'ArrowRight') showNext();
		if (e.key === 'ArrowLeft') showPrev();
		if (e.key === 'Escape') closeLargeVideo();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div>
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-xl font-medium text-gray-100">Video History</h2>
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<label class="text-sm text-gray-400" for="sort-by">Sort by</label>
				<select
					bind:value={sortField}
					class="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
					id="sort-by"
				>
					<option value="timestamp">Date</option>
					<option value="duration">Duration</option>
					<option value="price">Price</option>
					<option value="prompt">Prompt</option>
					<option value="resolution">Resolution</option>
				</select>
			</div>
			<button
				class="cursor-pointer rounded-md border border-gray-700 bg-gray-800 p-1.5 text-white hover:bg-gray-700"
				onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
			>
				{#if sortDirection === 'asc'}
					<ArrowUp class="h-4 w-4" />
				{:else}
					<ArrowDown class="h-4 w-4" />
				{/if}
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center items-center h-40">
			<div class="animate-pulse-slow text-gray-500">Loading videos...</div>
		</div>
	{:else if $videos.length === 0}
		<div
			in:fly={{ y: 20, duration: 300 }}
			class="text-center py-10 px-4 border border-dashed border-gray-700 rounded-xl"
		>
			<VideoIcon class="h-10 w-10 text-gray-600 mx-auto mb-3" />
			<h3 class="text-lg font-medium text-gray-400">No videos yet</h3>
			<p class="text-gray-500 text-sm mt-1">
				Generate your first video to see it here
			</p>
		</div>
	{:else}
		<div class="video-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" bind:this={videoGridRef}>
			{#each sortedVideos as video, i (video.id)}
				<div animate:flip={{ duration: 300 }} in:fly={{ y: 20, duration: 300, delay: 50 * i }}>
					<VideoCard
						duration={video.duration}
						id={video.id}
						model={video.model}
						prompt={video.prompt}
						resolution={video.resolution}
						timestamp={video.timestamp}
						videoData={video.videoData}
						onRegenerate={handleRegenerate}
						onRemix={handleRemix}
						onView={handleView}
					/>
				</div>
			{/each}
		</div>

		{#if $videos.length < $totalVideoCount}
			<div class="mt-8 flex justify-center">
				<div
					class="animate-pulse-slow text-gray-500"
					class:hidden={!loadingMore}
				>
					Loading more videos...
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if currentVideo}
	<div
		aria-label="Video viewer"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={closeLargeVideo}
		onkeydown={(e) => e.key === 'Escape' && closeLargeVideo()}
		role="dialog"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<button
			class="btn-ghost absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
			onclick={stopPropagation(showPrev)}
			aria-label="Previous video"
		>
			<ChevronLeft class="h-8 w-8 text-white" />
		</button>

		<div class="relative h-full w-full" onclick={self(closeLargeVideo)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && closeLargeVideo()}>
			{#key currentVideo.id}
				<div
					class="absolute inset-0 flex items-center justify-center"
					in:fly={{ x: 30, duration: 300, easing: quintOut }}
				>
					<video
						src={currentVideo.videoData}
						class="max-h-[90vh] max-w-[80vw]"
						controls
						autoplay
						loop
						onclick={stopPropagation(bubble('click'))}
					>
						<track kind="captions" />
					</video>
				</div>
			{/key}
		</div>

		<div class="absolute left-4 top-4 flex flex-col gap-2 text-xs text-gray-400">
			<span>Resolution: {currentVideo.resolution ?? 'N/A'}</span>
			<span>Duration: {currentVideo.duration ?? 'N/A'}s</span>
			{#if currentVideo.model}
				<span>Model: {currentVideo.model}</span>
			{/if}
			<span>Cost: ${currentVideoPrice.toFixed(2)}</span>
		</div>

		<button
			class="btn-ghost absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
			onclick={stopPropagation(showNext)}
			aria-label="Next video"
		>
			<ChevronRight class="h-8 w-8 text-white" />
		</button>
	</div>
{/if}
