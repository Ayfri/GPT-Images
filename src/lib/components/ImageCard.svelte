<script lang="ts">
	import { Pencil } from '@lucide/svelte';
	import { downloadImage } from '#lib/utils/downloadImage.ts';
	import { deleteImage } from '#lib/db/imageStore.ts';
	import { images, totalImageCount, totalCostAll, invalidateImageStats, type ImageRecord } from '#lib/stores/imageStore.ts';
	import { getRecordPrice } from '#lib/types/image.ts';
	import MediaCard from './MediaCard.svelte';

	interface Props {
		image: ImageRecord;
		onRegenerate?: (prompt: string) => void;
		onDeleted?: (id: string) => void;
		onView?: (id: string) => void;
		onEdit?: (image: ImageRecord) => void;
	}

	let { image, onRegenerate, onDeleted, onView, onEdit }: Props = $props();

	let copied = $state(false);
	const price = $derived(getRecordPrice(image));

	async function handleCopy() {
		await navigator.clipboard.writeText(image.prompt);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	async function handleDelete() {
		if (confirm('Are you sure you want to delete this image?')) {
			totalCostAll.update((c) => Math.max(0, c - price));
			await deleteImage(image.id);
			images.update((imgs) => imgs.filter((img) => img.id !== image.id));
			totalImageCount.update((n) => Math.max(0, n - 1));
			invalidateImageStats();
			onDeleted?.(image.id);
		}
	}
</script>

<MediaCard
	prompt={image.prompt}
	{price}
	timestamp={image.timestamp}
	{copied}
	onDelete={handleDelete}
	onCopy={handleCopy}
	onDownload={() => downloadImage(image.imageData, image.prompt, image.output_format ?? 'png')}
	onRegenerate={() => onRegenerate?.(image.prompt)}
	onView={() => onView?.(image.id)}
>
	{#snippet media()}
		<img
			alt={image.prompt}
			class="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
			decoding="async"
			loading="lazy"
			src={image.imageData}
		/>
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
