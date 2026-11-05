<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { quintOut } from 'svelte/easing';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { getRecordPrice } from '#lib/types/image.ts';

	let { id = $bindable(), images }: { id: string | null; images: ImageRecord[] } = $props();

	/** The viewed image is tracked by id: an index would point at another image when a finished generation shifts the list. */
	const index = $derived(images.findIndex((image) => image.id === id));
	const image = $derived(images[index]);
	const arrowClass =
		'btn-ghost absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 shadow-arrow hover:bg-white/20';

	let swipeStart: Touch | null = null;

	$effect(() => {
		if (id !== null && index === -1) id = null;
	});

	function step(delta: number) {
		id = images[(index + delta + images.length) % images.length].id;
	}

	/** Horizontal swipes of 52 px or more that are wider than tall change the image, vertical ones keep scrolling the details. */
	function endSwipe({ changedTouches: [end] }: TouchEvent) {
		if (swipeStart?.identifier !== end.identifier) return;
		const dx = end.clientX - swipeStart.clientX;
		const dy = end.clientY - swipeStart.clientY;
		swipeStart = null;
		if (Math.abs(dx) >= 52 && Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? -1 : 1);
	}
</script>

{#if image}
	<!-- The image, arrows and details sit directly in the dialog: only a click on the empty dark area has the dialog itself as target. -->
	<dialog
		{@attach (dialog) => dialog.showModal()}
		aria-label="Image viewer"
		class="m-0 size-full max-h-none max-w-none touch-pan-y items-center justify-center border-0 bg-black/80 p-4 text-inherit select-none open:flex"
		in:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
		onclose={() => (id = null)}
		onkeydown={(e) => {
			if (e.key === 'ArrowLeft') step(-1);
			if (e.key === 'ArrowRight') step(1);
		}}
		ontouchcancel={() => (swipeStart = null)}
		ontouchend={endSwipe}
		ontouchstart={(e) => (swipeStart = e.touches.length === 1 ? e.touches[0] : null)}
	>
		{#if images.length > 1}
			<button aria-label="Previous image" class="{arrowClass} left-4" onclick={() => step(-1)} type="button">
				<ChevronLeft class="h-8 w-8 text-white" />
			</button>
		{/if}

		{#key image.id}
			{#await gallery.url(image) then src}
				{#if src}
					<img
						alt={image.prompt}
						class="isolate max-h-[min(90dvh,90vh)] max-w-[92vw] object-contain select-none sm:max-w-[80vw]"
						draggable="false"
						in:fly|global={{ x: 30, duration: 300, easing: quintOut }}
						{src}
					/>
				{/if}
			{/await}
		{/key}

		<div
			class="absolute z-20 flex max-h-[40vh] select-text flex-col gap-2 overflow-y-auto rounded-xl bg-black/80 p-3 text-xs text-gray-200 shadow-lg backdrop-blur-sm max-sm:inset-x-4 max-sm:top-auto max-sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] sm:top-4 sm:left-4 sm:max-h-none sm:max-w-xs sm:overflow-visible"
		>
			<span>Quality: {image.quality ?? 'N/A'}</span>
			<span>Size: {image.size ?? 'N/A'}</span>
			{#if image.input_fidelity && image.input_fidelity !== 'low'}
				<span>Input fidelity: {image.input_fidelity}</span>
			{/if}
			{#if image.output_compression && image.output_compression !== 100}
				<span>Output compression: {image.output_compression}%</span>
			{/if}
			{#if image.output_format && image.output_format !== 'png'}
				<span>Output format: {image.output_format}</span>
			{/if}
			{#if image.background && image.background !== 'auto'}
				<span>Background: {image.background}</span>
			{/if}
			{#if image.model}
				<span>Model: {image.model}</span>
			{/if}
			{#if image.complexity}
				<span>Complexity: {image.complexity}</span>
			{/if}
			{#if image.frame_count && image.frame_duration_ms}
				<span>Frames: {image.frame_count} × {image.frame_duration_ms} ms</span>
			{/if}
			{#if image.svg_usage}
				<span>SVG author: {image.svg_usage.model}, {image.svg_usage.input_tokens} in / {image.svg_usage.output_tokens} out tokens (not in cost)</span>
			{/if}
			<span>{image.cost === undefined ? 'Estimated cost' : 'Cost'}: ${getRecordPrice(image).toFixed(3)}</span>
		</div>

		{#if images.length > 1}
			<button aria-label="Next image" class="{arrowClass} right-4" onclick={() => step(1)} type="button">
				<ChevronRight class="h-8 w-8 text-white" />
			</button>
		{/if}
	</dialog>
{/if}
