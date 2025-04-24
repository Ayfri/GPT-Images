<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Send, Loader2 } from 'lucide-svelte';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { addImage } from '$lib/db/imageStore';
  import { images, refreshImageStore } from '$lib/stores/imageStore';
  import { generateImage } from '$lib/services/openai';

  export let prompt = '';
  let isGenerating = false;
  let error: string | null = null;
  let selectedQuality: 'low' | 'medium' | 'high' = 'low'; // Default to low
  let selectedSize: '1024x1024' | '1024x1536' | '1536x1024' = '1024x1024'; // Default size
  let imageCount = 1; // Default number of images to generate

  // Pricing based on the provided image
  const pricing = {
    low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
    medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
    high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 }
  };

  const qualityOptions = {
    low: { label: 'Low', apiValue: 'low' },
    medium: { label: 'Medium', apiValue: 'medium' },
    high: { label: 'High', apiValue: 'high' }
  };

  const sizeOptions = {
    '1024x1024': { label: '1024×1024' },
    '1024x1536': { label: '1024×1536 (Portrait)' },
    '1536x1024': { label: '1536×1024 (Landscape)' }
  };

  // Calculate price dynamically
  $: currentPrice = pricing[selectedQuality][selectedSize] * imageCount;
  $: qualityApiValue = qualityOptions[selectedQuality].apiValue; // Keep this for API call if needed, though API expects 'low', 'medium', 'high' directly

  onMount(() => {
    prompt = "A cyberpunk city at night with neon lights and flying cars";
    error = null;
  });

  async function handleGenerate() {
    if (!$apiKey) {
      error = "Please enter your OpenAI API key first";
      return;
    }

    if (!prompt.trim()) {
      error = "Please enter a prompt";
      return;
    }

    isGenerating = true;
    error = null;

    try {
      const imageDataArray = await generateImage($apiKey, {
        prompt,
        quality: selectedQuality,
        size: selectedSize,
        n: imageCount
      });

      // Store each generated image
      for (const imageData of imageDataArray) {
        await addImage(
          `data:image/png;base64,${imageData}`,
          prompt,
          'gpt-image-1',
          selectedQuality,
          selectedSize
        );
      }

      // Refresh the image store
      await refreshImageStore();

      // Clear the prompt
      prompt = '';

    } catch (err) {
      console.error('Error generating image:', err);
      error = err instanceof Error ? err.message : 'Failed to generate image';
    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="glass-effect p-5 rounded-xl">
  <h2 class="text-lg font-medium text-gray-100 mb-4">Generate New Image</h2>

  <form on:submit|preventDefault={handleGenerate} class="space-y-4">
    <div>
      <label for="prompt" class="block text-sm font-medium text-gray-300 mb-2">
        Prompt
      </label>
      <textarea
        id="prompt"
        bind:value={prompt}
        rows="4"
        placeholder="Describe the image you want to generate..."
        class="input w-full"
        disabled={isGenerating}
      ></textarea>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="quality" class="block text-sm font-medium text-gray-300 mb-2">
          Quality
        </label>
        <select
          id="quality"
          bind:value={selectedQuality}
          class="input w-full"
          disabled={isGenerating}
        >
          {#each Object.entries(qualityOptions) as [key, option] (key)}
            <option value={key}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="size" class="block text-sm font-medium text-gray-300 mb-2">
          Size
        </label>
        <select
          id="size"
          bind:value={selectedSize}
          class="input w-full"
          disabled={isGenerating}
        >
          {#each Object.entries(sizeOptions) as [key, option] (key)}
            <option value={key}>{option.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <div>
      <label for="imageCount" class="block text-sm font-medium text-gray-300 mb-2">
        Number of Images: {imageCount}
      </label>
      <div class="flex items-center gap-2">
        <input
          id="imageCount"
          type="range"
          min="1"
          max="10"
          bind:value={imageCount}
          class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          disabled={isGenerating}
        />
        <span class="text-sm text-gray-400 w-6">{imageCount}</span>
      </div>
    </div>

    <button
      type="submit"
      class="btn btn-accent w-full flex items-center justify-center gap-2"
      disabled={isGenerating || !$apiKey}
    >
      {#if isGenerating}
        <Loader2 class="h-5 w-5 animate-spin" />
        Generating...
      {:else}
        <Send class="h-5 w-5" />
        Generate {imageCount > 1 ? `${imageCount} Images` : 'Image'}
      {/if}
    </button>

    {#if !$apiKey}
      <div class="text-sm text-warning-400 bg-warning-900/20 border border-warning-600/20 p-2 rounded-md">
        Please add your OpenAI API key to generate images
      </div>
    {/if}

    {#if error}
      <div
        in:fly={{ y: 10, duration: 300 }}
        class="text-sm text-error-400 bg-error-900/20 border border-error-600/20 p-2 rounded-md"
      >
        {error}
      </div>
    {/if}

    <div class="text-xs text-gray-500 flex justify-between pt-1">
      <span>Model: gpt-image-1</span>
      <span class="text-secondary-400">${currentPrice.toFixed(3)} for {imageCount} {imageCount > 1 ? 'images' : 'image'}</span>
    </div>
  </form>
</div>
