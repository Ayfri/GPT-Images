<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { downloadImage } from '#lib/utils/downloadImage.ts';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { getRecordPrice } from '#lib/types/image.ts';
	import MediaCard from './MediaCard.svelte';

	interface Props {
		image: ImageRecord;
		onRegenerate?: (prompt: string) => void;
		onView?: (id: string) => void;
		onEdit?: (image: ImageRecord) => void;
	}

	let { image, onRegenerate, onView, onEdit }: Props = $props();

	let copied = $state(false);
	const price = $derived(getRecordPrice(image));

	async function handleCopy() {
		await navigator.clipboard.writeText(image.prompt);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	async function handleDownload() {
		const url = await gallery.url(image);
		if (url) downloadImage(url, image.prompt, image.output_format ?? 'png');
	}
</script>

<MediaCard
	prompt={image.prompt}
	{price}
	timestamp={image.timestamp}
	{copied}
	onDelete={() => confirm('Are you sure you want to delete this image?') && gallery.remove(image)}
	onCopy={handleCopy}
	onDownload={handleDownload}
	onRegenerate={() => onRegenerate?.(image.prompt)}
	onView={() => onView?.(image.id)}
>
	{#snippet media()}
		{#await gallery.url(image) then src}
			{#if src}
				<img
					alt={image.prompt}
					class="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
					decoding="async"
					loading="lazy"
					{src}
				/>
			{/if}
		{/await}
	{/snippet}

	{#snippet extraAction()}
		{#if image.output_format !== 'gif' && image.output_format !== 'svg'}
			<button
				onclick={(e) => {
					e.stopPropagation();
					onEdit?.(image);
				}}
				class="btn-ghost p-2 rounded-xl hover:bg-blue-700/25 group/edit"
				aria-label="Edit image"
				title="Edit image"
			>
				<Pencil class="w-4 h-4 text-blue-300 group-hover/edit:scale-110 transition-transform" />
			</button>
		{/if}
	{/snippet}
</MediaCard>
