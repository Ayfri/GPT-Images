<script lang="ts">
	import ApiKeyForm from '$lib/components/ApiKeyForm.svelte';
	import VideoUsageStats from '$lib/components/VideoUsageStats.svelte';
	import VideoGenerator from '$lib/components/VideoGenerator.svelte';
	import MediaGrid from '$lib/components/MediaGrid.svelte';

	let currentPrompt = $state('');
	let remixVideoId: string | null = $state(null);

	function handleRegenerate(newPrompt: string) {
		currentPrompt = newPrompt;
		remixVideoId = null;
		scrollToGenerator();
	}

	function handleRemix(videoId: string, prompt: string) {
		currentPrompt = prompt;
		remixVideoId = videoId;
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

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
	<div class="md:col-span-2">
		<div id="generator-section" class="mb-8">
			<VideoGenerator bind:prompt={currentPrompt} bind:remixVideoId />
		</div>

		<div>
			<MediaGrid onRegenerate={handleRegenerate} onRemix={handleRemix} variant="video" />
		</div>
	</div>

	<div class="space-y-8">
		<ApiKeyForm />
		<VideoUsageStats />
	</div>
</div>
