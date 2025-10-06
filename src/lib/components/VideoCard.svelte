<script lang="ts">
	import { Copy, Download, RefreshCw, Sparkles, Trash2 } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { deleteVideo } from '$lib/db/videoStore';
	import { videos } from '$lib/stores/videoStore';
	import { createEventDispatcher } from 'svelte';
	import { calculateVideoPrice } from '$lib/utils/videoPrice';

	export let duration: number | undefined;
	export let id: string;
	export let model: string | undefined;
	export let prompt: string;
	export let resolution: string | undefined;
	export let timestamp: number;
	export let videoData: string;

	const dispatch = createEventDispatcher<{
		deleted: { id: string };
		regenerate: { prompt: string };
		remix: { id: string; prompt: string };
		view: { id: string };
	}>();

	let copied = false;
	let showControls = false;
	let price: number;

	$: {
		const rec = $videos.find(vid => vid.id === id);
		if (rec) {
			price = calculateVideoPrice(rec.model, rec.resolution, rec.duration);
		} else {
			price = 1.0;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}

	async function copyPrompt() {
		await navigator.clipboard.writeText(prompt);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}

	async function handleDelete() {
		if (confirm('Are you sure you want to delete this video?')) {
			await deleteVideo(id);
			videos.update(vids => vids.filter(vid => vid.id !== id));
			dispatch('deleted', { id });
		}
	}

	function handleDownload() {
		// Create a link to download the video
		const a = document.createElement('a');
		a.href = videoData;
		a.download = `video-${Date.now()}.mp4`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function handleRegenerate() {
		dispatch('regenerate', { prompt });
	}

	function handleRemix() {
		dispatch('remix', { id, prompt });
	}

	function handleView() {
		dispatch('view', { id });
	}
</script>

<div
	class="card group relative overflow-hidden transition-all duration-300"
	on:mouseenter={() => showControls = true}
	on:mouseleave={() => showControls = false}
	on:focusin={() => showControls = true}
	on:focusout={() => showControls = false}
	role="article"
	aria-label="Generated video card"
>
	<div class="relative aspect-video cursor-pointer overflow-hidden" on:click={handleView}>
		<video
			src={videoData}
			class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
			muted
			loop
			playsinline
			on:mouseenter={(e) => e.currentTarget.play()}
			on:mouseleave={(e) => e.currentTarget.pause()}
		>
			<track kind="captions" />
		</video>

		{#if showControls}
			<div
				transition:fade={{ duration: 150 }}
				class="absolute inset-0 bg-linear-to-t from-dark-300/90 via-dark-300/40 to-transparent flex flex-col justify-end p-3"
			>
				<div class="flex justify-between items-center mb-2">
					<button
						on:click|stopPropagation={handleDelete}
						class="btn-ghost p-2 rounded-full hover:bg-error-700/30"
						aria-label="Delete video"
						title="Delete video"
					>
						<Trash2 class="w-4 h-4 text-error-400" />
					</button>

					<div class="flex space-x-1">
						<button
							on:click|stopPropagation={copyPrompt}
							class="btn-ghost p-2 rounded-full hover:bg-primary-700/30"
							aria-label="Copy prompt"
							title="Copy prompt"
						>
							<Copy class="w-4 h-4 text-primary-400" />
						</button>

						<button
							on:click|stopPropagation={handleDownload}
							class="btn-ghost p-2 rounded-full hover:bg-secondary-700/30"
							aria-label="Download video"
							title="Download video"
						>
							<Download class="w-4 h-4 text-secondary-400" />
						</button>

						<button
							on:click|stopPropagation={handleRemix}
							class="btn-ghost p-2 rounded-full hover:bg-purple-700/30"
							aria-label="Remix this video"
							title="Remix this video"
						>
							<Sparkles class="w-4 h-4 text-purple-400" />
						</button>

						<button
							on:click|stopPropagation={handleRegenerate}
							class="btn-ghost p-2 rounded-full hover:bg-accent-700/30"
							aria-label="Regenerate with this prompt"
							title="Regenerate with this prompt"
						>
							<RefreshCw class="w-4 h-4 text-accent-400" />
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if copied}
			<div
				in:fly={{ y: 20, duration: 200 }}
				out:fade={{ duration: 150 }}
				class="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-primary-800 text-white text-xs py-1 px-3 rounded-full"
			>
				Copied!
			</div>
		{/if}
	</div>

	<div class="p-4">
		<p class="text-sm text-gray-300 line-clamp-2 mb-2" title={prompt}>
			{prompt}
		</p>
		<p class="text-xs text-gray-500 flex justify-between items-center">
			<span>{formatDate(timestamp)}</span>
			<span class="text-gray-400">${price.toFixed(2)}</span>
		</p>
	</div>
</div>
