<script lang="ts">
	import ApiKeyForm from '$lib/components/ApiKeyForm.svelte';
	import ImageGenerator from '$lib/components/ImageGenerator.svelte';
	import MediaGrid from '$lib/components/MediaGrid.svelte';
	import UsageStats from '$lib/components/UsageStats.svelte';
	import type { ImageRecord } from '$lib/stores/imageStore';

	let currentPrompt = $state('');
	let imageForEdit: ImageRecord | null = $state(null); // New state variable

	function handleRegenerate(newPrompt: string) {
		currentPrompt = newPrompt;
		imageForEdit = null; // Clear imageForEdit when regenerating
		// Scroll to form
		const generatorElement = document.getElementById('generator-section');
		if (generatorElement) {
			generatorElement.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function handleEditImage(image: ImageRecord) {
		imageForEdit = image;
		// Scroll to form
		const generatorElement = document.getElementById('generator-section');
		if (generatorElement) {
			generatorElement.scrollIntoView({ behavior: 'smooth' });
		}
	}
</script>

<div class="mb-10 text-center animate-slide-up">
	<h1 class="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
		<span class="gradient-text">Image Generator</span>
	</h1>
	<p class="text-gray-400 max-w-xl mx-auto leading-relaxed">
		Generate images from text - or drag, paste, or click to attach reference images and let AI use them as a visual guide.
	</p>
</div>

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
	<div class="md:col-span-2">
		<div id="generator-section" class="mb-8">
			<ImageGenerator bind:prompt={currentPrompt} bind:imageToEdit={imageForEdit} />
		</div>

		<div>
			<MediaGrid onEditImage={handleEditImage} onRegenerate={handleRegenerate} variant="image" />
		</div>
	</div>

	<div class="space-y-8">
		<ApiKeyForm />
		<UsageStats />
	</div>
</div>
