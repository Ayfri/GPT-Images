<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { ImageRecord } from '$lib/stores/imageStore';
	import type { VideoRecord } from '$lib/stores/videoStore';
	import { getCarouselSwipeDirection } from '$lib/utils/carouselSwipe';
	import { quintOut } from 'svelte/easing';

	interface Props {
		currentItem: ImageRecord | VideoRecord | null;
		itemCount: number;
		mediaPrice: number;
		onClose: () => void;
		onNext: () => void;
		onPrev: () => void;
		priceDecimals: number;
		variant: 'image' | 'video';
	}

	let { currentItem, itemCount, mediaPrice, onClose, onNext, onPrev, priceDecimals, variant }: Props = $props();

	let showNav = $derived(itemCount > 1);

	const arrowBtnClass =
		'absolute -translate-y-1/2 bg-black/30 btn-ghost hover:bg-white/20 p-2 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.42)] top-1/2 z-10';

	let swipeActiveTouchId: number | null = null;
	let swipeTouchStartX = 0;
	let swipeTouchStartY = 0;

	function onCarouselTouchCancel() {
		swipeActiveTouchId = null;
	}

	function onCarouselTouchEnd(e: TouchEvent) {
		if (!showNav || currentItem === null || swipeActiveTouchId === null) return;
		for (const touch of e.changedTouches) {
			if (touch.identifier !== swipeActiveTouchId) continue;
			swipeActiveTouchId = null;
			const dir = getCarouselSwipeDirection(
				touch.clientX - swipeTouchStartX,
				touch.clientY - swipeTouchStartY,
			);
			if (dir === 'next') onNext();
			else if (dir === 'prev') onPrev();
			return;
		}
	}

	function onCarouselTouchStart(e: TouchEvent) {
		if (currentItem === null) return;
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		swipeActiveTouchId = touch.identifier;
		swipeTouchStartX = touch.clientX;
		swipeTouchStartY = touch.clientY;
	}
</script>

{#if currentItem}
	<div
		aria-label={variant === 'image' ? 'Image viewer' : 'Video viewer'}
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="dialog"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		{#if showNav}
			<button
				class="{arrowBtnClass} left-4"
				aria-label="Previous {variant}"
				onclick={(e) => {
					e.stopPropagation();
					onPrev();
				}}
			>
				<ChevronLeft class="h-8 w-8 text-white" />
			</button>
		{/if}

		<div class="relative h-full w-full">
			{#key currentItem.id}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					aria-label={showNav ? `Swipe horizontally to change ${variant}` : undefined}
					class="absolute inset-0 flex items-center justify-center p-2 touch-pan-y sm:p-4"
					in:fly={{ x: 30, duration: 300, easing: quintOut }}
					onkeydown={(e) => {
						if (e.key === 'Enter') e.stopPropagation();
					}}
					ontouchcancel={onCarouselTouchCancel}
					ontouchend={onCarouselTouchEnd}
					ontouchstart={onCarouselTouchStart}
					role={variant === 'image' ? 'button' : 'region'}
					tabindex={variant === 'image' ? 0 : -1}
				>
					{#if variant === 'image'}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<img
							alt={(currentItem as ImageRecord).prompt}
							class="max-h-[min(90dvh,90vh)] max-w-[92vw] object-contain isolate sm:max-w-[80vw]"
							onclick={(e) => e.stopPropagation()}
							src={(currentItem as ImageRecord).imageData}
						/>
					{:else}
						<video
							autoplay
							class="max-h-[min(90dvh,90vh)] max-w-[92vw] sm:max-w-[80vw]"
							controls
							loop
							onclick={(e) => e.stopPropagation()}
							src={(currentItem as VideoRecord).videoData}
						>
							<track kind="captions" />
						</video>
					{/if}
				</div>
			{/key}
		</div>

		{#if variant === 'image'}
			{@const img = currentItem as ImageRecord}
			<div
				class="absolute backdrop-blur-sm bg-black/80 flex flex-col gap-2 max-h-[40vh] max-sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] max-sm:inset-x-4 max-sm:top-auto overflow-y-auto p-3 rounded-xl shadow-lg sm:left-4 sm:max-h-none sm:max-w-xs sm:overflow-visible sm:top-4 text-xs text-gray-200 z-20"
			>
				<span>Quality: {img.quality ?? 'N/A'}</span>
				<span>Size: {img.size ?? 'N/A'}</span>
				{#if img.input_fidelity && img.input_fidelity !== 'low'}
					<span>Input Fidelity: {img.input_fidelity}</span>
				{/if}
				{#if img.output_compression && img.output_compression !== 100}
					<span>Output Compression: {img.output_compression}</span>
				{/if}
				{#if img.output_format && img.output_format !== 'png'}
					<span>Output Format: {img.output_format}</span>
				{/if}
				{#if img.background && img.background !== 'auto'}
					<span>Background: {img.background}</span>
				{/if}
				{#if img.model}
					<span>Model: {img.model}</span>
				{/if}
				<span>Cost: ${mediaPrice.toFixed(priceDecimals)}</span>
			</div>
		{:else}
			{@const vid = currentItem as VideoRecord}
			<div
				class="absolute backdrop-blur-sm bg-black/80 flex flex-col gap-2 max-h-[40vh] max-sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] max-sm:inset-x-4 max-sm:top-auto overflow-y-auto p-3 rounded-xl shadow-lg sm:left-4 sm:max-h-none sm:max-w-xs sm:overflow-visible sm:top-4 text-xs text-gray-200 z-20"
			>
				<span>Resolution: {vid.resolution ?? 'N/A'}</span>
				<span>Duration: {vid.duration ?? 'N/A'}s</span>
				{#if vid.model}
					<span>Model: {vid.model}</span>
				{/if}
				<span>Cost: ${mediaPrice.toFixed(priceDecimals)}</span>
			</div>
		{/if}

		{#if showNav}
			<button
				class="{arrowBtnClass} right-4"
				aria-label="Next {variant}"
				onclick={(e) => {
					e.stopPropagation();
					onNext();
				}}
			>
				<ChevronRight class="h-8 w-8 text-white" />
			</button>
		{/if}
	</div>
{/if}
