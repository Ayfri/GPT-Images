<script lang="ts">
  import { onMount } from 'svelte';
  import ApiKeyForm from '$lib/components/ApiKeyForm.svelte';
  import ImageGenerator from '$lib/components/ImageGenerator.svelte';
  import ImageGrid from '$lib/components/ImageGrid.svelte';
  import UsageStats from '$lib/components/UsageStats.svelte';
  import type { ImageRecord } from '$lib/stores/imageStore';

  let currentPrompt = '';
  let imageForEdit: ImageRecord | null = null; // New state variable

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

<div class="mb-6">
  <h1 class="text-3xl font-bold mb-2 text-center">
    <span class="bg-gradient-to-r from-accent-400 via-primary-400 to-secondary-400 bg-clip-text text-transparent">
      GPT Image Generator
    </span>
  </h1>
  <p class="text-gray-400 text-center max-w-2xl mx-auto">
    Generate stunning images using OpenAI's GPT-Image-1 model. Simply enter your API key, provide a prompt, and watch AI bring your ideas to life.
  </p>
</div>

<div class="grid gap-8 grid-cols-1 md:grid-cols-3">
  <div class="md:col-span-2">
    <div id="generator-section" class="mb-8">
      <ImageGenerator bind:prompt={currentPrompt} bind:imageToEdit={imageForEdit} />
    </div>

    <div>
      <ImageGrid onRegenerate={handleRegenerate} onEditImage={handleEditImage} />
    </div>
  </div>

  <div class="space-y-8">
    <ApiKeyForm />
    <UsageStats />
  </div>
</div>
