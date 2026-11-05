<script lang="ts">
	import { onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { fly } from 'svelte/transition';
	import { ArrowDown, ArrowUp, Image as ImageIcon } from '@lucide/svelte';
	import ImageCard from './ImageCard.svelte';
	import MediaLightbox from './MediaLightbox.svelte';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import type { ImageQuality } from '#lib/types/image.ts';
	import { getRecordPrice } from '#lib/types/image.ts';
	import { flip } from 'svelte/animate';

	interface Props {
		onRegenerate: (prompt: string) => void;
		onEditImage?: (image: ImageRecord) => void;
	}

	let { onRegenerate, onEditImage }: Props = $props();

	const PAGE_SIZE = 12;
	const qualityOrder: Record<ImageQuality, number> = { auto: 0, high: 3, low: 1, max: 5, medium: 2, xhigh: 4 };
	const SORT_KEYS = {
		price: getRecordPrice,
		prompt: ({ prompt }) => prompt.toLowerCase(),
		quality: ({ quality }) => qualityOrder[quality ?? 'low'],
		size: ({ size }) => size?.split('x').map(Number).reduce((a, b) => a * b) || 0,
		timestamp: ({ timestamp }) => timestamp
	} satisfies Record<string, (image: ImageRecord) => number | string>;

	let largeViewIndex: number | null = $state(null);
	let shown = $state(PAGE_SIZE);
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let sortField: keyof typeof SORT_KEYS = $state('timestamp');

	const sorted = $derived.by(() => {
		const sign = sortDirection === 'asc' ? 1 : -1;
		return gallery.images
			.map((image) => ({ image, key: SORT_KEYS[sortField](image) }))
			.sort((a, b) => (a.key < b.key ? -sign : a.key > b.key ? sign : 0))
			.map(({ image }) => image);
	});
	const visible = $derived(sorted.slice(0, shown));
	const currentItem = $derived(largeViewIndex !== null ? sorted[largeViewIndex] ?? null : null);

	/** Reading `shown` re-creates the observer after each page, so a sentinel still in view keeps loading the next page. */
	const sentinel: Attachment<HTMLDivElement> = (target) => {
		const nextShown = shown + PAGE_SIZE;
		const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && (shown = nextShown), { rootMargin: '200px' });
		observer.observe(target);
		return () => observer.disconnect();
	};

	onMount(gallery.load);

	function closeLightbox() {
		largeViewIndex = null;
	}

	function handleEdit(image: ImageRecord) {
		if (!onEditImage) return;
		onEditImage(image);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (largeViewIndex === null) return;
		if (sorted.length > 1) {
			if (e.key === 'ArrowRight') showNext();
			if (e.key === 'ArrowLeft') showPrev();
		}
		if (e.key === 'Escape') closeLightbox();
	}

	function handleView(mediaId: string) {
		largeViewIndex = sorted.findIndex((m) => m.id === mediaId);
	}

	function showNext() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex + 1) % sorted.length;
	}

	function showPrev() {
		if (largeViewIndex === null) return;
		largeViewIndex = (largeViewIndex - 1 + sorted.length) % sorted.length;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div>
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-base font-semibold text-gray-100">Image History</h2>
			<p class="mt-0.5 text-xs text-gray-600">
				{gallery.images.length} image{gallery.images.length !== 1 ? 's' : ''} generated
			</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="glass-panel flex items-center gap-2 px-3 py-1.5">
				<label class="text-xs text-gray-500" for="sort-by-images">Sort</label>
				<select
					bind:value={sortField}
					class="appearance-none cursor-pointer rounded bg-dark-100 pr-1 text-sm text-gray-200 focus:outline-none"
					id="sort-by-images"
					style="color-scheme: dark"
				>
					<option value="timestamp">Date</option>
					<option value="price">Price</option>
					<option value="prompt">Prompt</option>
					<option value="quality">Quality</option>
					<option value="size">Size</option>
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

	{#if !gallery.loaded}
		<div class="flex h-40 items-center justify-center">
			<div class="animate-pulse-slow text-gray-500">Loading images...</div>
		</div>
	{:else if gallery.images.length === 0}
		<div
			class="rounded-2xl border border-dashed border-white/8 bg-white/2 px-6 py-16 text-center"
			in:fly={{ duration: 400, y: 20 }}
		>
			<div class="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
				<div class="absolute inset-0 animate-pulse rounded-2xl bg-primary-500/10"></div>
				<ImageIcon class="relative h-8 w-8 text-primary-400/60" />
			</div>
			<h3 class="mb-1 text-base font-semibold text-gray-300">No images yet</h3>
			<p class="mx-auto max-w-xs text-sm text-gray-600">
				Generate your first image above and it will appear here
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each visible as image, i (image.id)}
				<div animate:flip={{ duration: 300 }} in:fly={{ delay: 50 * (i % PAGE_SIZE), duration: 300, y: 20 }}>
					<ImageCard {image} onEdit={handleEdit} {onRegenerate} onView={handleView} />
				</div>
			{/each}
		</div>

		{#if visible.length < sorted.length}
			<div {@attach sentinel} class="mt-8 min-h-px"></div>
		{/if}
	{/if}
</div>

<MediaLightbox
	currentItem={currentItem}
	itemCount={sorted.length}
	onClose={closeLightbox}
	onNext={showNext}
	onPrev={showPrev}
/>
