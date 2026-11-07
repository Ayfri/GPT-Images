<script lang="ts">
	import { Copy, Download, Pencil, RefreshCw, Trash } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import ConfirmPopover from './ConfirmPopover.svelte';
	import LibraryPopover from './LibraryPopover.svelte';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { THUMB_SHORT_SIDE } from '#lib/db/opfsStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { getRecordPrice, parseSize } from '#lib/types/image.ts';

	interface Props {
		image: ImageRecord;
		onEdit: (image: ImageRecord) => void;
		onRegenerate: (prompt: string) => void;
		onView: () => void;
	}

	let { image, onEdit, onRegenerate, onView }: Props = $props();

	/** Below sm the grid has one column as wide as the viewport, from sm up cards are 190-300 px (the page is a 2/3 column from md). */
	const sizes = '(max-width: 639px) 100vw, 300px';
	const size = $derived(parseSize(image.size));
	const shortSide = $derived(size && Math.min(size.width, size.height));

	let copied = $state(false);

	async function copyPrompt() {
		await navigator.clipboard.writeText(image.prompt);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	/** A failed delete keeps the card: the record is only dropped once the database delete succeeded. */
	const remove = () => gallery.remove(image).catch((error: unknown) => console.error('Failed to delete the image:', error));

	async function download() {
		const href = await gallery.url(image);
		if (!href) return;

		const a = document.createElement('a');
		a.href = href;
		a.download = `${image.prompt.replace(/\W/g, '_').slice(0, 30)}_${image.timestamp}.${image.output_format ?? 'png'}`;
		a.click();
	}
</script>

<!-- Off-screen cards skip rendering, on the article since it clips overflow anyway. 28rem is a phone card, the real height is remembered. -->
<article
	class="card card-gradient-border group relative overflow-hidden transition-all duration-300 [contain-intrinsic-size:auto_28rem] [content-visibility:auto] hover:-translate-y-1"
>
	<div class="relative aspect-square overflow-hidden">
		<button aria-label="View image" class="block size-full cursor-pointer select-none" onclick={onView} type="button">
			{#await Promise.all([gallery.thumbUrl(image), gallery.url(image)]) then [src, original]}
				{#if src}
					<!-- The w descriptors are the short sides: the card is a square object-cover, so the short side is what must cover it. -->
					<img
						alt={image.prompt}
						class="size-full object-cover transition-transform duration-400 group-hover:scale-110"
						decoding="async"
						draggable="false"
						loading="lazy"
						{sizes}
						{src}
						srcset={original && original !== src && shortSide ? `${src} ${THUMB_SHORT_SIDE}w, ${original} ${shortSide}w` : undefined}
					/>
				{/if}
			{/await}
		</button>

		<!-- visibility keeps the hidden buttons untappable and out of the tab order until the card is hovered, focused or has an open popover, which leaves the card's hover box -->
		<div
			class="pointer-events-none invisible absolute inset-0 flex flex-col justify-end bg-linear-to-t from-dark-300/95 via-dark-300/50 via-40% to-transparent to-70% opacity-0 transition-[opacity,visibility] duration-200 group-focus-within:visible group-focus-within:opacity-100 group-has-[:popover-open]:visible group-has-[:popover-open]:opacity-100 group-hover:visible group-hover:opacity-100"
		>
			<div class="pointer-events-auto absolute top-3 right-3">
				<LibraryPopover {image} />
			</div>

			<div class="pointer-events-auto flex items-center justify-between p-3">
				<ConfirmPopover
					class="btn-ghost group/del rounded-xl p-2 hover:bg-error-700/25"
					confirmLabel="Delete image"
					label="Delete"
					message="Delete this image? This can't be undone."
					onconfirm={remove}
				>
					<Trash class="h-4 w-4 text-error-400 transition-transform group-hover/del:scale-110" />
				</ConfirmPopover>

				<div class="flex items-center gap-1">
					<button
						aria-label="Copy prompt"
						class="btn-ghost group/copy rounded-xl p-2 hover:bg-primary-700/25"
						onclick={copyPrompt}
						title="Copy prompt"
						type="button"
					>
						<Copy class="h-4 w-4 text-primary-300 transition-transform group-hover/copy:scale-110" />
					</button>

					<button
						aria-label="Download"
						class="btn-ghost group/dl rounded-xl p-2 hover:bg-secondary-700/25"
						onclick={download}
						title="Download"
						type="button"
					>
						<Download class="h-4 w-4 text-secondary-300 transition-transform group-hover/dl:scale-110" />
					</button>

					{#if image.output_format !== 'gif' && image.output_format !== 'svg'}
						<button
							aria-label="Edit image"
							class="btn-ghost group/edit rounded-xl p-2 hover:bg-info-700/25"
							onclick={() => onEdit(image)}
							title="Edit image"
							type="button"
						>
							<Pencil class="h-4 w-4 text-info-300 transition-transform group-hover/edit:scale-110" />
						</button>
					{/if}

					<button
						aria-label="Regenerate with this prompt"
						class="btn-ghost group/regen rounded-xl p-2 hover:bg-accent-700/25"
						onclick={() => onRegenerate(image.prompt)}
						title="Regenerate"
						type="button"
					>
						<RefreshCw class="h-4 w-4 text-accent-300 transition-transform duration-300 group-hover/regen:rotate-180 group-hover/regen:scale-110" />
					</button>
				</div>
			</div>
		</div>

		{#if copied}
			<div
				class="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-primary-600/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
				in:fly={{ y: 10, duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				Copied!
			</div>
		{/if}
	</div>

	<div class="p-3.5">
		<p class="mb-2.5 line-clamp-2 text-sm leading-relaxed text-gray-300" title={image.prompt}>{image.prompt}</p>
		<div class="flex items-center justify-between">
			<span class="text-xs text-gray-600">{new Date(image.timestamp).toLocaleString()}</span>
			<span class="rounded-md border border-secondary-500/20 bg-secondary-500/10 px-2 py-0.5 text-xs font-semibold text-secondary-400">
				${getRecordPrice(image).toFixed(3)}
			</span>
		</div>
	</div>
</article>
