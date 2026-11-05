<script lang="ts">
	import ApiKeyForm from '#lib/components/ApiKeyForm.svelte';
	import ImageGenerator from '#lib/components/ImageGenerator.svelte';
	import ImageGrid from '#lib/components/ImageGrid.svelte';
	import UsageStats from '#lib/components/UsageStats.svelte';

	let generator = $state<ReturnType<typeof ImageGenerator>>();
</script>

<div class="mb-10 text-center animate-slide-up">
	<h1 class="text-3xl sm:text-5xl font-bold mb-4 tracking-tight">
		<span class="gradient-text">GPT Image Generator</span>
	</h1>
	<p class="text-gray-400 max-w-xl mx-auto leading-relaxed">
		Generate or edit images, GIFs and SVGs with OpenAI's GPT Image models. Runs in your browser with your own API key, and your history stays on your device.
	</p>
</div>

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
	<div class="md:col-span-2">
		<div class="mb-8">
			<ImageGenerator bind:this={generator} />
		</div>

		<div>
			<ImageGrid onEdit={(image) => generator?.edit(image)} onRegenerate={(prompt) => generator?.regenerate(prompt)} />
		</div>
	</div>

	<div class="space-y-8">
		<ApiKeyForm />
		<UsageStats />
	</div>
</div>
