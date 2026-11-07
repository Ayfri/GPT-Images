<script lang="ts">
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Check, ChevronLeft, ChevronRight, Copy, EyeOff, Info, X, ZoomIn, ZoomOut } from '@lucide/svelte';
	import { quintOut } from 'svelte/easing';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { BACKGROUND_OPTIONS, COMPLEXITY_OPTIONS, getRecordPrice, modelLabel, OUTPUT_FORMAT_OPTIONS, parseSize, QUALITY_OPTIONS } from '#lib/types/image.ts';
	import { PanZoom } from '#lib/utils/panZoom.svelte.ts';

	let { id = $bindable(), images }: { id: string | null; images: ImageRecord[] } = $props();

	/** The viewed image is tracked by id: an index would point at another image when a finished generation shifts the list. */
	const index = $derived(images.findIndex((image) => image.id === id));
	const image = $derived(images[index]);
	const arrowClass =
		'btn-ghost absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 shadow-arrow hover:bg-white/20';
	const toolClass = 'btn-ghost rounded-full p-2 disabled:pointer-events-none disabled:opacity-40';
	const panelClass = 'border border-white/8 bg-dark-200/85 shadow-xl backdrop-blur-xl';

	const panZoom = new PanZoom();

	let collapsed = $state(false);
	let copied = $state(false);
	let expanded = $state(false);
	let overflowing = $state(false);
	let swipeStart: Touch | null = null;
	/** Decoded neighbors, replaced on each change so only the current ones stay alive. */
	let preloaded: HTMLImageElement[] = [];
	/** Tagged with its image id, so the previous image's URL never shows for a tick after a step. */
	let shown = $state<{ id: string; url: string } | null>(null);

	/** An SVG's viewBox ratio can differ from its recorded size, so it is never sized from the record. */
	const sizeOf = (record?: ImageRecord) => (record?.output_format === 'svg' ? null : parseSize(record?.size));

	const src = $derived(shown?.id === id ? shown.url : null);
	const size = $derived(sizeOf(image));
	const libraries = $derived(image?.libraries?.flatMap((libraryId) => gallery.libraries.find((library) => library.id === libraryId) ?? []) ?? []);

	/** Quality and size always show, the other details only when they differ from the defaults. */
	const details = $derived.by(() => {
		const rows: [string, string][] = [];
		if (!image) return rows;
		const { background, complexity, frame_count, frame_duration_ms, input_fidelity, output_compression, output_format, quality, size } = image;
		rows.push(['Quality', quality ? QUALITY_OPTIONS[quality].label : 'N/A'], ['Size', size ? size.replace('x', '×') : 'N/A']);
		if (output_format && output_format !== 'png') rows.push(['Format', OUTPUT_FORMAT_OPTIONS[output_format].label]);
		if (background && background !== 'auto') rows.push(['Background', BACKGROUND_OPTIONS[background].label]);
		if (complexity) rows.push(['Complexity', COMPLEXITY_OPTIONS[complexity].label]);
		if (input_fidelity && input_fidelity !== 'low') rows.push(['Input fidelity', 'High']);
		if (output_compression && output_compression !== 100) rows.push(['Compression', `${output_compression}%`]);
		if (frame_count && frame_duration_ms) rows.push(['Frames', `${frame_count} × ${frame_duration_ms} ms`]);
		return rows;
	});

	$effect(() => {
		if (id !== null && index === -1) id = null;
	});

	/** Runs before the DOM update on every id change (step, close, a removed image), so the next image never shows with the previous zoom. */
	$effect.pre(() => {
		void id;
		panZoom.reset();
		copied = false;
		expanded = false;
	});

	/** Tracks the id only: an edit of the record (libraries) must not restart the load and flash the placeholder again. */
	$effect(() => {
		const viewing = id;
		const record = untrack(() => image);
		if (viewing === null || !record) return;
		let stale = false;
		let upgraded = false;

		/** Without a parsable size the placeholder would render at the thumbnail size and jump on the swap, so the original is shown alone. */
		if (sizeOf(record)) {
			void gallery.thumbUrl(record).then((url) => {
				/** `shown` survives a close: a reopened image keeps its original instead of going back to the thumbnail. */
				if (url && !stale && !upgraded && shown?.id !== viewing) shown = { id: viewing, url };
			});
		}

		void gallery.url(record).then(async (url) => {
			if (!url || stale) return;
			if (shown?.id !== viewing || shown.url !== url) {
				const original = new Image();
				original.src = url;
				/** A failed decode still swaps, the <img> then shows or reports the error itself. */
				await original.decode().catch(() => {});
				if (stale) return;
			}
			upgraded = true;
			shown = { id: viewing, url };
		});

		return () => (stale = true);
	});

	$effect(() => {
		preloaded = [];
		if (index === -1 || images.length < 2) return;
		let stale = false;
		for (const neighbor of new Set([images[(index - 1 + images.length) % images.length], images[(index + 1) % images.length]])) {
			void gallery.url(neighbor).then((url) => {
				if (!url || stale) return;
				const preload = new Image();
				preload.src = url;
				preloaded.push(preload);
				return preload.decode().catch(() => {});
			});
		}
		return () => (stale = true);
	});

	function step(delta: number) {
		id = images[(index + delta + images.length) % images.length].id;
	}

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(image.prompt);
		} catch (error) {
			return console.error('Failed to copy the prompt:', error);
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	/** Horizontal swipes of 52 px or more that are wider than tall change the image, vertical ones keep scrolling the details. */
	function endSwipe({ changedTouches: [end] }: TouchEvent) {
		if (swipeStart?.identifier !== end.identifier) return;
		const dx = end.clientX - swipeStart.clientX;
		const dy = end.clientY - swipeStart.clientY;
		swipeStart = null;
		if (panZoom.scale > 1) return;
		if (Math.abs(dx) >= 52 && Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? -1 : 1);
	}
</script>

<!-- On the window, not the dialog: focus falls to the body when the focused button gets disabled or removed (zoom out at fit, the details toggle). -->
<svelte:window
	onkeydown={(e) => {
		if (!image) return;
		if (e.key === 'ArrowLeft') step(-1);
		if (e.key === 'ArrowRight') step(1);
		if (e.ctrlKey || e.metaKey) return;
		if (e.key === '+' || e.key === '=') panZoom.zoomBy(1.5);
		if (e.key === '-') panZoom.zoomBy(1 / 1.5);
		if (e.key === '0') panZoom.reset();
		if (e.key === 'i') collapsed = !collapsed;
	}}
	onresize={panZoom.resize}
/>

{#if image}
	<!-- The image, arrows and details sit directly in the dialog: only a click on the empty dark area has the dialog itself as target. -->
	<dialog
		{@attach (dialog) => dialog.showModal()}
		aria-label="Image viewer"
		class="m-0 size-full max-h-none max-w-none touch-pan-y items-center justify-center overflow-hidden border-0 bg-black/80 p-4 text-inherit select-none open:flex"
		in:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
		onclose={() => (id = null)}
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
			{#if src}
				<!-- The attributes and inline width give the thumbnail the original's box (never upscaled), so the swap doesn't resize the image. -->
				<img
					{@attach panZoom.attach}
					alt={image.prompt}
					class={[
						'isolate max-h-[min(90dvh,90vh)] max-w-(--max-w) touch-none object-contain select-none [--max-w:92vw] sm:[--max-w:80vw]',
						panZoom.dragging ? 'cursor-grabbing' : panZoom.scale > 1 ? 'cursor-grab' : 'cursor-zoom-in',
						!panZoom.dragging && 'transition-[translate,scale] duration-200 ease-out'
					]}
					draggable="false"
					height={size?.height}
					in:fly|global={{ x: 30, duration: 300, easing: quintOut }}
					onload={panZoom.resize}
					onpointercancel={panZoom.up}
					onpointerdown={panZoom.down}
					onpointermove={panZoom.move}
					onpointerup={panZoom.up}
					onwheel={panZoom.wheel}
					{src}
					style:scale={panZoom.scale}
					style:translate="{panZoom.x}px {panZoom.y}px"
					style:width={size && `min(${size.width}px, var(--max-w), calc(min(90dvh, 90vh) * ${size.width / size.height}))`}
					width={size?.width}
				/>
			{/if}
		{/key}

		<div class="{panelClass} absolute top-4 right-4 z-20 flex items-center gap-0.5 rounded-full p-1">
			<button aria-label="Zoom out" class={toolClass} disabled={panZoom.scale <= 1} onclick={() => panZoom.zoomBy(1 / 1.5)} title="Zoom out" type="button">
				<ZoomOut class="h-4 w-4" />
			</button>
			<button
				aria-label="Fit to screen"
				class="btn-ghost min-w-14 rounded-full px-2 py-1.5 text-xs font-semibold tabular-nums"
				onclick={() => panZoom.reset()}
				title="Fit to screen"
				type="button"
			>
				{Math.round((panZoom.scale / panZoom.nativeScale) * 100)}%
			</button>
			<button
				aria-label="Zoom in"
				class={toolClass}
				disabled={panZoom.scale >= panZoom.maxScale}
				onclick={() => panZoom.zoomBy(1.5)}
				title="Zoom in"
				type="button"
			>
				<ZoomIn class="h-4 w-4" />
			</button>
			<button aria-label="Close" class={toolClass} onclick={(e) => e.currentTarget.closest('dialog')?.close()} title="Close" type="button">
				<X class="h-4 w-4" />
			</button>
		</div>

		{#if collapsed}
			<button
				aria-label="Show details"
				class="{panelClass} absolute z-20 cursor-pointer rounded-full p-2.5 text-gray-200 hover:text-white max-sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] max-sm:left-4 sm:top-4 sm:left-4"
				onclick={() => (collapsed = false)}
				title="Show details"
				type="button"
			>
				<Info class="h-5 w-5" />
			</button>
		{:else}
			<div
				class="{panelClass} absolute z-20 flex max-h-[40vh] select-text rounded-2xl flex-col gap-3 overflow-y-auto p-4 text-xs text-gray-200 max-sm:inset-x-4 max-sm:top-auto max-sm:bottom-[max(1rem,env(safe-area-inset-bottom,0px))] sm:top-4 sm:left-4 sm:max-h-[calc(100dvh-2rem)] sm:w-80"
			>
				<div>
					<div class="flex items-start justify-between gap-2">
						<h2 class="text-sm font-semibold text-white">{modelLabel(image.model)}</h2>
						<div class="flex shrink-0 items-center gap-1.5">
							<span
								class="rounded-md border border-secondary-500/20 bg-secondary-500/10 px-2 py-0.5 text-xs font-semibold text-secondary-400"
								title={image.cost === undefined ? 'Estimated cost' : 'Cost'}
							>
								<span class="sr-only">{image.cost === undefined ? 'Estimated cost' : 'Cost'}:</span>
								{image.cost === undefined ? '~' : ''}${getRecordPrice(image).toFixed(3)}
							</span>
							<button
								aria-label="Hide details"
								class="btn-ghost rounded-full p-1.5"
								onclick={() => (collapsed = true)}
								title="Hide details"
								type="button"
							>
								<EyeOff class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
					<p class="mt-0.5 text-gray-500">
						{new Date(image.timestamp).toLocaleString()}{images.length > 1 ? ` · ${index + 1} / ${images.length}` : ''}
					</p>
				</div>

				<div class="flex items-start gap-2">
					{#key image.id}
						<p
							{@attach (prompt) => {
								/** Observed because the dialog is still display:none when this runs, and the width changes on resize. Not tracked, so no re-run on expand. */
								const observer = new ResizeObserver(() => {
									if (!expanded) overflowing = prompt.scrollHeight > prompt.clientHeight;
								});
								observer.observe(prompt);
								return () => observer.disconnect();
							}}
							class={['min-w-0 flex-1 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap text-gray-200', !expanded && 'line-clamp-4']}
						>{image.prompt}</p>
					{/key}
					<button
						aria-label="Copy prompt"
						class="btn-ghost shrink-0 rounded-lg p-1.5"
						onclick={copyPrompt}
						title="Copy prompt"
						type="button"
					>
						{#if copied}
							<Check class="h-4 w-4 text-secondary-400" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>
				</div>
				{#if overflowing}
					<button class="-mt-1.5 cursor-pointer self-start text-primary-300 hover:underline" aria-expanded={expanded} onclick={() => (expanded = !expanded)} type="button">
						{expanded ? 'Show less' : 'Show more'}
					</button>
				{/if}

				<dl class="grid grid-cols-2 gap-x-4 gap-y-2">
					{#each details as [label, value] (label)}
						<div>
							<dt class="field-label text-[10px]">{label}</dt>
							<dd class="text-gray-200">{value}</dd>
						</div>
					{/each}
				</dl>

				{#if libraries.length}
					<div>
						<h3 class="field-label mb-1 text-[10px]">Libraries</h3>
						<ul class="flex flex-wrap gap-1.5">
							{#each libraries as library (library.id)}
								<li class="rounded-full bg-white/6 px-2 py-0.5 text-[11px] text-gray-300">{library.name}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if image.svg_usage}
					<p class="text-[11px] text-gray-500">
						SVG author: {image.svg_usage.model}, {image.svg_usage.input_tokens} in / {image.svg_usage.output_tokens} out tokens (not in cost)
					</p>
				{/if}
			</div>
		{/if}

		{#if images.length > 1}
			<button aria-label="Next image" class="{arrowClass} right-4" onclick={() => step(1)} type="button">
				<ChevronRight class="h-8 w-8 text-white" />
			</button>
		{/if}
	</dialog>
{/if}
