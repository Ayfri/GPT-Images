<script lang="ts">
	import { Pencil } from 'lucide-svelte';
	import { downloadImage } from '$lib/utils/downloadImage';
	import { deleteImage } from '$lib/db/imageStore';
	import { images, totalImageCount, totalCostAll, invalidateImageStats } from '$lib/stores/imageStore';
	import { PRICING, type ImageModel } from '$lib/types/image';
	import MediaCard from './MediaCard.svelte';

	interface Props {
		id: string;
		prompt: string;
		imageData: string;
		timestamp: number;
		onRegenerate?: (prompt: string) => void;
		onDeleted?: (id: string) => void;
		onView?: (id: string) => void;
		onEdit?: (id: string) => void;
	}

	let { id, prompt, imageData, timestamp, onRegenerate, onDeleted, onView, onEdit }: Props = $props();

	let copied = $state(false);
	let price = $state(0.01);

	$effect(() => {
		const rec = $images.find((img) => img.id === id);
		price =
			rec?.quality && rec?.size && PRICING[rec.model as ImageModel]?.[rec.quality]?.[rec.size] ?
				PRICING[rec.model as ImageModel][rec.quality][rec.size]
			:	0.01;
	});

	async function handleCopy() {
		await navigator.clipboard.writeText(prompt);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	async function handleDelete() {
		if (confirm('Are you sure you want to delete this image?')) {
			const rec = $images.find((img) => img.id === id);
			if (rec) {
				const deletedCost =
					rec.quality && rec.size && PRICING[rec.model as ImageModel]?.[rec.quality]?.[rec.size] ?
						PRICING[rec.model as ImageModel][rec.quality][rec.size]
					:	0.01;
				totalCostAll.update((c) => Math.max(0, c - deletedCost));
			}
			await deleteImage(id);
			images.update((imgs) => imgs.filter((img) => img.id !== id));
			totalImageCount.update((n) => Math.max(0, n - 1));
			invalidateImageStats();
			onDeleted?.(id);
		}
	}
</script>

<MediaCard
	{prompt}
	{price}
	priceDecimals={3}
	{timestamp}
	aspectClass="aspect-square"
	{copied}
	onDelete={handleDelete}
	onCopy={handleCopy}
	onDownload={() => downloadImage(imageData, prompt)}
	onRegenerate={() => onRegenerate?.(prompt)}
	onView={() => onView?.(id)}
>
	{#snippet media()}
		<img
			alt={prompt}
			class="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
			decoding="async"
			loading="lazy"
			src={imageData}
		/>
	{/snippet}

	{#snippet extraAction()}
		<button
			onclick={(e) => {
				e.stopPropagation();
				onEdit?.(id);
			}}
			class="btn-ghost p-2 rounded-xl hover:bg-blue-700/25 group/edit"
			aria-label="Edit image"
			title="Edit image"
		>
			<Pencil class="w-4 h-4 text-blue-300 group-hover/edit:scale-110 transition-transform" />
		</button>
	{/snippet}
</MediaCard>
