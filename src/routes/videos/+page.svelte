<script lang="ts">
	import ApiKeyForm from '$lib/components/ApiKeyForm.svelte';
	import VideoUsageStats from '$lib/components/VideoUsageStats.svelte';
	import VideoGenerator from '$lib/components/VideoGenerator.svelte';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import { SORA_API_SHUTDOWN_DATE } from '$lib/types/video';
	import { TriangleAlert } from '@lucide/svelte';

	let currentPrompt = $state('');
	let editVideoId: string | null = $state(null);

	function handleRegenerate(newPrompt: string) {
		currentPrompt = newPrompt;
		editVideoId = null;
		scrollToGenerator();
	}

	function handleEdit(videoId: string, prompt: string) {
		currentPrompt = prompt;
		editVideoId = videoId;
		scrollToGenerator();
	}

	function scrollToGenerator() {
		const generatorElement = document.getElementById('generator-section');
		if (generatorElement) {
			generatorElement.scrollIntoView({ behavior: 'smooth' });
		}
	}
</script>

<div class="mb-10 text-center animate-slide-up">
	<h1 class="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
		<span class="gradient-text">Video Generator</span>
	</h1>
	<p class="text-gray-400 max-w-xl mx-auto leading-relaxed">
		Generate videos from text - or attach a reference image to guide the visual style and composition.
	</p>
</div>

<div class="mb-8 flex items-start gap-3 rounded-2xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
	<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
	<p class="leading-relaxed">
		OpenAI removes the Videos API and every Sora model on <span class="font-semibold">{SORA_API_SHUTDOWN_DATE}</span>, with no
		replacement endpoint. Video generation stops working on that date - download anything you want to keep.
	</p>
</div>

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
	<div class="md:col-span-2">
		<div id="generator-section" class="mb-8">
			<VideoGenerator bind:prompt={currentPrompt} bind:editVideoId />
		</div>

		<div>
			<MediaGrid onRegenerate={handleRegenerate} onEditVideo={handleEdit} variant="video" />
		</div>
	</div>

	<div class="space-y-8">
		<ApiKeyForm />
		<VideoUsageStats />
	</div>
</div>
