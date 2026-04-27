<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { ArrowDown, ArrowUp, Image as ImageIcon, Video as VideoIcon } from '@lucide/svelte';
	import ImageCard from './ImageCard.svelte';
	import MediaLightbox from './MediaLightbox.svelte';
	import VideoCard from './VideoCard.svelte';
	import {
		images,
		initImageStore,
		loadMoreImages,
		totalImageCount,
		type ImageRecord,
	} from '$lib/stores/imageStore';
	import {
		videos,
		initVideoStore,
		loadMoreVideos,
		totalVideoCount,
		type VideoRecord,
	} from '$lib/stores/videoStore';
	import type { ImageModel } from '$lib/types/image';
	import { getImagePrice as getModelPrice } from '$lib/types/image';
	import { flip } from 'svelte/animate';
	import { calculateVideoPrice } from '$lib/utils/videoPrice';

	interface Props {
		onRegenerate: (prompt: string) => void;
		onEditImage?: (image: ImageRecord) => void;
		onRemix?: (id: string, prompt: string) => void;
		variant: 'image' | 'video';
	}

	let { onRegenerate, onEditImage, onRemix, variant }: Props = $props();

	const qualityOrder = { auto: 0, high: 3, low: 1, medium: 2 };

	let loading = $state(true);
	let loadingMore = $state(false);
	let largeViewIndex: number | null = $state(null);
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let sortField = $state<string>('timestamp');

	let observer: IntersectionObserver | undefined = $state();
	let sentinelRef: HTMLDivElement | undefined = $state();

	function getImageRecordPrice(image: ImageRecord): number {
		const model = (image.model || 'gpt-image-2') as ImageModel;
		return image.quality && image.size ? (getModelPrice(model, image.quality, image.size) ?? 0.01) : 0.01;
	}

	function getImageSizeArea(size: string | undefined): number {
		if (!size) return 0;
		const [w, h] = size.split('x').map(Number);
		return w * h;
	}

	function getResolutionArea(resolution: string | undefined): number {
		if (!resolution) return 0;
		const [w, h] = resolution.split('x').map(Number);
		return w * h;
	}

	function getSortValue(item: ImageRecord | VideoRecord): string | number {
		if (variant === 'image') {
			const image = item as ImageRecord;
			switch (sortField) {
				case 'price':
					return getImageRecordPrice(image);
				case 'quality':
					return qualityOrder[image.quality ?? 'low'] ?? 0;
				case 'size':
					return getImageSizeArea(image.size);
				case 'prompt':
					return image.prompt.toLowerCase();
				case 'timestamp':
					return image.timestamp;
				default:
					return image.timestamp;
			}
		}
		const video = item as VideoRecord;
		switch (sortField) {
			case 'duration':
				return video.duration ?? 0;
			case 'price':
				return calculateVideoPrice(video.model, video.resolution, video.duration);
			case 'prompt':
				return video.prompt.toLowerCase();
			case 'resolution':
				return getResolutionArea(video.resolution);
			case 'timestamp':
				return video.timestamp;
			default:
				return video.timestamp;
		}
	}

	let sortedItems = $derived.by(() => {
		const raw = variant === 'image' ? [...$images] : [...$videos];
		return raw.sort((a, b) => {
			const aValue = getSortValue(a);
			const bValue = getSortValue(b);
			if (aValue < bValue) {
				return sortDirection === 'asc' ? -1 : 1;
			}
			if (aValue > bValue) {
				return sortDirection === 'asc' ? 1 : -1;
			}
			return 0;
		});
	});

	let currentItem = $derived(largeViewIndex !== null ? sortedItems[largeViewIndex] ?? null : null);

	let lightboxPrice = $derived(
		currentItem && variant === 'image'
			? getImageRecordPrice(currentItem as ImageRecord)
			: currentItem && variant === 'video'
				? calculateVideoPrice(
						(currentItem as VideoRecord).model,
						(currentItem as VideoRecord).resolution,
						(currentItem as VideoRecord).duration,
					)
				: 0,
	);

	let priceDecimals = $derived(variant === 'image' ? 3 : 2);

	let showLoadMoreSentinel = $derived(
		variant === 'image' ? $images.length < $totalImageCount : $videos.length < $totalVideoCount,
	);

	let sortSelectId = $derived(variant === 'image' ? 'sort-by-images' : 'sort-by-videos');

	let gridClass = $derived(
		variant === 'image'
			? 'image-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
			: 'video-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
	);

	onMount(async () => {
		if (variant === 'image') {
			await initImageStore();
		} else {
			await initVideoStore();
		}
		loading = false;

		observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0].isIntersecting || loadingMore) return;
				if (variant === 'image') {
					if ($images.length >= $totalImageCount) return;
				} else if ($videos.length >= $totalVideoCount) {
					return;
				}
				loadingMore = true;
				const schedule =
					typeof requestIdleCallback !== 'undefined'
						? (cb: () => void) => requestIdleCallback(cb, { timeout: 500 })
						: (cb: () => void) => setTimeout(cb, 0);
				schedule(async () => {
					if (variant === 'image') {
						await loadMoreImages();
					} else {
						await loadMoreVideos();
					}
					loadingMore = false;
				});
			},
			{ rootMargin: '200px' },
		);

		if (sentinelRef) observer.observe(sentinelRef);
	});

	$effect(() => {
		if (sentinelRef && observer) observer.observe(sentinelRef);
	});

	function closeLightbox() {
		largeViewIndex = null;
	}

	function handleEdit(imageId: string) {
		if (variant !== 'image' || !onEditImage) return;
		const imageToEdit = sortedItems.find((img) => img.id === imageId) as ImageRecord | undefined;
		if (imageToEdit) {
			onEditImage(imageToEdit);
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (largeViewIndex === null) return;
		if (sortedItems.length > 1) {
			if (e.key === 'ArrowRight') showNext();
			if (e.key === 'ArrowLeft') showPrev();
		}
		if (e.key === 'Escape') closeLightbox();
	}

	function handleRemix(id: string, prompt: string) {
		onRemix?.(id, prompt);
	}

	function handleView(mediaId: string) {
		largeViewIndex = sortedItems.findIndex((m) => m.id === mediaId);
	}

	function showNext() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex + 1) % sortedItems.length;
	}

	function showPrev() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex - 1 + sortedItems.length) % sortedItems.length;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div>
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-base font-semibold text-gray-100">
				{variant === 'image' ? 'Image History' : 'Video History'}
			</h2>
			<p class="mt-0.5 text-xs text-gray-600">
				{#if variant === 'image'}
					{$totalImageCount} image{$totalImageCount !== 1 ? 's' : ''} generated
				{:else}
					{$totalVideoCount} video{$totalVideoCount !== 1 ? 's' : ''} generated
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="glass-panel flex items-center gap-2 px-3 py-1.5">
				<label class="text-xs text-gray-500" for={sortSelectId}>Sort</label>
				<select
					bind:value={sortField}
					class="appearance-none cursor-pointer rounded bg-dark-100 pr-1 text-sm text-gray-200 focus:outline-none"
					id={sortSelectId}
					style="color-scheme: dark"
				>
					{#if variant === 'image'}
						<option value="timestamp">Date</option>
						<option value="price">Price</option>
						<option value="prompt">Prompt</option>
						<option value="quality">Quality</option>
						<option value="size">Size</option>
					{:else}
						<option value="timestamp">Date</option>
						<option value="duration">Duration</option>
						<option value="price">Price</option>
						<option value="prompt">Prompt</option>
						<option value="resolution">Resolution</option>
					{/if}
				</select>
			</div>
			<button
				class="glass-panel cursor-pointer rounded-xl p-1.5 text-gray-400 transition-all duration-200 hover:bg-white/8 hover:text-white"
				onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
				title={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
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
		<div class="flex h-40 items-center justify-center">
			<div class="animate-pulse-slow text-gray-500">
				{variant === 'image' ? 'Loading images...' : 'Loading videos...'}
			</div>
		</div>
	{:else if variant === 'image' ? $images.length === 0 : $videos.length === 0}
		<div
			class="rounded-2xl border border-dashed border-white/8 bg-white/2 px-6 py-16 text-center"
			in:fly={{ duration: 400, y: 20 }}
		>
			<div class="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
				{#if variant === 'image'}
					<div class="absolute inset-0 animate-pulse rounded-2xl bg-primary-500/10"></div>
					<ImageIcon class="relative h-8 w-8 text-primary-400/60" />
				{:else}
					<div class="absolute inset-0 animate-pulse rounded-2xl bg-secondary-500/10"></div>
					<VideoIcon class="relative h-8 w-8 text-secondary-400/60" />
				{/if}
			</div>
			<h3 class="mb-1 text-base font-semibold text-gray-300">
				{variant === 'image' ? 'No images yet' : 'No videos yet'}
			</h3>
			<p class="mx-auto max-w-xs text-sm text-gray-600">
				{variant === 'image'
					? 'Generate your first image above and it will appear here'
					: 'Generate your first video above and it will appear here'}
			</p>
		</div>
	{:else}
		<div class={gridClass}>
			{#each sortedItems as item, i (item.id)}
				<div animate:flip={{ duration: 300 }} in:fly={{ delay: 50 * i, duration: 300, y: 20 }}>
					{#if variant === 'image'}
						{@const image = item as ImageRecord}
						<ImageCard
							id={image.id}
							imageData={image.imageData}
							prompt={image.prompt}
							timestamp={image.timestamp}
							onEdit={handleEdit}
							onRegenerate={onRegenerate}
							onView={handleView}
						/>
					{:else}
						{@const video = item as VideoRecord}
						<VideoCard
							duration={video.duration}
							id={video.id}
							model={video.model}
							prompt={video.prompt}
							resolution={video.resolution}
							timestamp={video.timestamp}
							videoData={video.videoData}
							onRegenerate={onRegenerate}
							onRemix={handleRemix}
							onView={handleView}
						/>
					{/if}
				</div>
			{/each}
		</div>

		{#if showLoadMoreSentinel}
			<div bind:this={sentinelRef} class="mt-8 flex min-h-px justify-center">
				{#if loadingMore}
					<div class="animate-pulse-slow text-gray-500">
						{variant === 'image' ? 'Loading more images...' : 'Loading more videos...'}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<MediaLightbox
	currentItem={currentItem}
	itemCount={sortedItems.length}
	mediaPrice={lightboxPrice}
	onClose={closeLightbox}
	onNext={showNext}
	onPrev={showPrev}
	priceDecimals={priceDecimals}
	{variant}
/>
