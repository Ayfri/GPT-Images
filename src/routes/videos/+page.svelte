<script lang="ts">
	import ApiKeyForm from '$lib/components/ApiKeyForm.svelte';
	import VideoUsageStats from '$lib/components/VideoUsageStats.svelte';
	import VideoGenerator from '$lib/components/VideoGenerator.svelte';
	import VideoGrid from '$lib/components/VideoGrid.svelte';

	let currentPrompt = '';
	let remixVideoId: string | null = null;

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

<div class="mb-6">
	<h1 class="text-3xl font-bold mb-2 text-center">
		<span class="bg-linear-to-r from-accent-400 via-primary-400 to-secondary-400 bg-clip-text text-transparent">
			GPT Video Generator
		</span>
	</h1>
	<p class="text-gray-400 text-center max-w-2xl mx-auto">
		Generate stunning videos using OpenAI's GPT-Video models. Simply enter your API key, provide a prompt, and watch AI bring your ideas to life.
	</p>
</div>

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
	<div class="md:col-span-2">
		<div id="generator-section" class="mb-8">
			<VideoGenerator bind:prompt={currentPrompt} bind:remixVideoId />
		</div>

		<div>
			<VideoGrid onRegenerate={handleRegenerate} onRemix={handleRemix} />
		</div>
	</div>

	<div class="space-y-8">
		<ApiKeyForm />
		<VideoUsageStats />
	</div>
</div>
