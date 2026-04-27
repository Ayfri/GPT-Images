<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		ArrowDown,
		ArrowUp,
		ChevronLeft,
		ChevronRight,
		Image as ImageIcon
	} from 'lucide-svelte';
	import ImageCard from './ImageCard.svelte';
	import { images, initImageStore, loadMoreImages, totalImageCount, type ImageRecord } from '$lib/stores/imageStore';
	import type { ImageModel } from '$lib/types/image';
	import { PRICING } from '$lib/types/image';
	import { quintOut } from 'svelte/easing';
	import { flip } from 'svelte/animate';

	interface Props {
		onRegenerate: (prompt: string) => void;
		onEditImage: (image: ImageRecord) => void;
	}

	let { onRegenerate, onEditImage }: Props = $props();

	let loading = $state(true);
	let loadingMore = $state(false);
	let largeViewIndex: number | null = $state(null);
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let sortField: 'timestamp' | 'prompt' | 'quality' | 'size' | 'price' = $state('timestamp');

	let observer: IntersectionObserver | undefined = $state();
	let sentinelRef: HTMLDivElement | undefined = $state();

	const qualityOrder = { high: 3, low: 1, medium: 2 };

	function getImagePrice(image: ImageRecord): number {
		const model = (image.model || 'gpt-image-1') as ImageModel;
		return image.quality && image.size && PRICING[model]?.[image.quality]?.[image.size]
			? PRICING[model][image.quality][image.size]
			: 0.01;
	}

	function getImageSizeArea(size: string | undefined): number {
		if (!size) return 0;
		const [w, h] = size.split('x').map(Number);
		return w * h;
	}

	function getSortValue(
		image: ImageRecord,
		field: typeof sortField
	): string | number {
		switch (field) {
			case 'price':
				return getImagePrice(image);
			case 'quality':
				return qualityOrder[image.quality ?? 'low'] ?? 0;
			case 'size':
				return getImageSizeArea(image.size);
			case 'prompt':
				return image.prompt.toLowerCase();
			case 'timestamp':
				return image.timestamp;
		}
	}

	let sortedImages = $derived([...$images].sort((a, b) => {
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

	let currentImage = $derived(largeViewIndex !== null ? sortedImages[largeViewIndex] : null);

	let currentImagePrice = $derived(currentImage ? (() => {
		const model = (currentImage.model || 'gpt-image-1') as ImageModel;
		return currentImage.quality && currentImage.size && PRICING[model]?.[currentImage.quality]?.[currentImage.size]
			? PRICING[model][currentImage.quality][currentImage.size]
			: 0.01;
	})() : 0);


	onMount(async () => {
		await initImageStore();
		loading = false;

		// Observe a stable sentinel div - unaffected by sorting or adding items
		observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0].isIntersecting || loadingMore || $images.length >= $totalImageCount) return;
				loadingMore = true;

				// Defer the heavy IDB read + store update so scroll stays smooth
				const schedule =
					typeof requestIdleCallback !== 'undefined'
						? (cb: () => void) => requestIdleCallback(cb, { timeout: 500 })
						: (cb: () => void) => setTimeout(cb, 0);

				schedule(async () => {
					await loadMoreImages();
					loadingMore = false;
				});
			},
			{ rootMargin: '200px' }
		);

		if (sentinelRef) observer.observe(sentinelRef);
	});

	// Watch for sentinelRef becoming available after first render
	$effect(() => {
		if (sentinelRef && observer) observer.observe(sentinelRef);
	});

	function handleRegenerate(prompt: string) {
		onRegenerate(prompt);
	}

	function handleView(imageId: string) {
		largeViewIndex = sortedImages.findIndex(img => img.id === imageId);
	}

	function handleEdit(imageId: string) {
		const imageToEdit = sortedImages.find(img => img.id === imageId);
		if (imageToEdit) {
			onEditImage(imageToEdit);
			window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
		}
	}

	function closeLargeImage() {
		largeViewIndex = null;
	}

	function showNext() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex + 1) % sortedImages.length;
	}

	function showPrev() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex - 1 + sortedImages.length) % sortedImages.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (largeViewIndex === null) return;

		if (e.key === 'ArrowRight') showNext();
		if (e.key === 'ArrowLeft') showPrev();
		if (e.key === 'Escape') closeLargeImage();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div>
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-base font-semibold text-gray-100">Image History</h2>
			<p class="text-xs text-gray-600 mt-0.5">{$totalImageCount} image{$totalImageCount !== 1 ? 's' : ''} generated</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-2 glass-panel px-3 py-1.5">
				<label class="text-xs text-gray-500" for="sort-by">Sort</label>
				<select
					bind:value={sortField}
					class="bg-dark-100 text-sm text-gray-200 focus:outline-none cursor-pointer appearance-none pr-1 rounded"
					style="color-scheme: dark"
					id="sort-by"
				>
					<option value="timestamp">Date</option>
					<option value="price">Price</option>
					<option value="prompt">Prompt</option>
					<option value="quality">Quality</option>
					<option value="size">Size</option>
				</select>
			</div>
			<button
				class="glass-panel p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all duration-200 cursor-pointer"
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
		<div class="flex justify-center items-center h-40">
			<div class="animate-pulse-slow text-gray-500">Loading images...</div>
		</div>
	{:else if $images.length === 0}
		<div
			in:fly={{ y: 20, duration: 400 }}
			class="text-center py-16 px-6 rounded-2xl border border-dashed border-white/8 bg-white/2"
		>
			<div class="relative inline-flex items-center justify-center w-16 h-16 mb-4">
				<div class="absolute inset-0 rounded-2xl bg-primary-500/10 animate-pulse"></div>
				<ImageIcon class="h-8 w-8 text-primary-400/60 relative" />
			</div>
			<h3 class="text-base font-semibold text-gray-300 mb-1">No images yet</h3>
			<p class="text-sm text-gray-600 max-w-xs mx-auto">
				Generate your first image above and it will appear here
			</p>
		</div>
	{:else}
		<div class="image-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each sortedImages as image, i (image.id)}
				<div animate:flip={{ duration: 300 }} in:fly={{ y: 20, duration: 300, delay: 50 * i }}>
					<ImageCard
						id={image.id}
						prompt={image.prompt}
						imageData={image.imageData}
						timestamp={image.timestamp}
						onRegenerate={handleRegenerate}
						onView={handleView}
						onEdit={handleEdit}
					/>
				</div>
			{/each}
		</div>

		<!-- Sentinel for infinite scroll - always rendered at bottom, not affected by sorting -->
		{#if $images.length < $totalImageCount}
			<div bind:this={sentinelRef} class="mt-8 flex justify-center min-h-px">
				{#if loadingMore}
					<div class="animate-pulse-slow text-gray-500">Loading more images...</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

{#if currentImage}
	<div
		aria-label="Image viewer"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={closeLargeImage}
		onkeydown={(e) => e.key === 'Escape' && closeLargeImage()}
		role="dialog"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<button
			class="btn-ghost absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
			onclick={(e) => { e.stopPropagation(); showPrev(); }}
			aria-label="Previous image"
		>
			<ChevronLeft class="h-8 w-8 text-white" />
		</button>

		<div class="relative h-full w-full">
			{#key currentImage.id}
				<div
					class="flex items-center justify-center"
					in:fly={{ x: 30, duration: 300, easing: quintOut }}
					onkeydown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
					role="button"
					tabindex="0"
				>
					<img
						alt={currentImage.prompt}
						class="max-h-[90vh] max-w-[80vw] object-contain isolate"
						onclick={(e) => e.stopPropagation()}
						src={currentImage.imageData}
					/>
				</div>
			{/key}
		</div>

		<div class="absolute left-4 top-4 flex flex-col gap-2 text-xs text-gray-400">
			<span>Quality: {currentImage.quality ?? 'N/A'}</span>
			<span>Size: {currentImage.size ?? 'N/A'}</span>
			{#if currentImage.input_fidelity && currentImage.input_fidelity !== 'low'}
				<span>Input Fidelity: {currentImage.input_fidelity}</span>
			{/if}
			{#if currentImage.output_compression && currentImage.output_compression !== 100}
				<span>Output Compression: {currentImage.output_compression}</span>
			{/if}
			{#if currentImage.output_format && currentImage.output_format !== 'png'}
				<span>Output Format: {currentImage.output_format}</span>
			{/if}
			{#if currentImage.background && currentImage.background !== 'auto'}
				<span>Background: {currentImage.background}</span>
			{/if}
			{#if currentImage.model}
				<span>Model: {currentImage.model}</span>
			{/if}
			<span>Cost: ${currentImagePrice.toFixed(3)}</span>
		</div>

		<button
			class="btn-ghost absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
			onclick={(e) => { e.stopPropagation(); showNext(); }}
			aria-label="Next image"
		>
			<ChevronRight class="h-8 w-8 text-white" />
		</button>
	</div>
{/if}
