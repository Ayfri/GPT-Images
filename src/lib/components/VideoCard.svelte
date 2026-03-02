<script lang="ts">
	import { Sparkles } from 'lucide-svelte';
	import { deleteVideo } from '$lib/db/videoStore';
	import { videos, totalVideoCount, totalCostAll, invalidateVideoStats } from '$lib/stores/videoStore';
	import { calculateVideoPrice } from '$lib/utils/videoPrice';
	import MediaCard from './MediaCard.svelte';

	interface Props {
		duration: number | undefined;
		id: string;
		model: string | undefined;
		prompt: string;
		resolution: string | undefined;
		timestamp: number;
		videoData: string;
		onDeleted?: (id: string) => void;
		onRegenerate?: (prompt: string) => void;
		onRemix?: (id: string, prompt: string) => void;
		onView?: (id: string) => void;
	}

	let {
		duration,
		id,
		model,
		prompt,
		resolution,
		timestamp,
		videoData,
		onDeleted,
		onRegenerate,
		onRemix,
		onView,
	}: Props = $props();

	let copied = $state(false);
	let price = $state(1.0);
	let videoElement: HTMLVideoElement | undefined = $state();

	$effect(() => {
		const rec = $videos.find((vid) => vid.id === id);
		price = rec ? calculateVideoPrice(rec.model, rec.resolution, rec.duration) : 1.0;
	});

	async function handleCopy() {
		await navigator.clipboard.writeText(prompt);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	async function handleDelete() {
		if (confirm('Are you sure you want to delete this video?')) {
			const rec = $videos.find((vid) => vid.id === id);
			if (rec) {
				totalCostAll.update((c) =>
					Math.max(0, c - calculateVideoPrice(rec.model, rec.resolution, rec.duration)),
				);
			}
			await deleteVideo(id);
			videos.update((vids) => vids.filter((vid) => vid.id !== id));
			totalVideoCount.update((n) => Math.max(0, n - 1));
			invalidateVideoStats();
			onDeleted?.(id);
		}
	}

	function handleDownload() {
		const a = document.createElement('a');
		a.href = videoData;
		a.download = `video-${Date.now()}.mp4`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function handleCardHover(hovering: boolean) {
		if (videoElement) {
			if (hovering) {
				videoElement.play().catch(() => {});
			} else {
				videoElement.pause();
				videoElement.currentTime = 0;
			}
		}
	}
</script>

<MediaCard
	{prompt}
	{price}
	priceDecimals={2}
	{timestamp}
	aspectClass="aspect-video"
	{copied}
	onDelete={handleDelete}
	onCopy={handleCopy}
	onDownload={handleDownload}
	onRegenerate={() => onRegenerate?.(prompt)}
	onView={() => onView?.(id)}
	onCardHoverChange={handleCardHover}
>
	{#snippet media()}
		<video
			bind:this={videoElement}
			class="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
			loop
			muted
			playsinline
			src={videoData}
		>
			<track kind="captions" />
		</video>
	{/snippet}

	{#snippet extraAction()}
		<button
			onclick={(e) => {
				e.stopPropagation();
				onRemix?.(id, prompt);
			}}
			class="btn-ghost p-2 rounded-xl hover:bg-purple-700/25 group/remix"
			aria-label="Remix this video"
			title="Remix this video"
		>
			<Sparkles class="w-4 h-4 text-purple-300 group-hover/remix:scale-110 transition-transform" />
		</button>
	{/snippet}
</MediaCard>
