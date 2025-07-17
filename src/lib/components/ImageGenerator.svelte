<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Send, Loader2, Upload, X } from 'lucide-svelte';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { addImage } from '$lib/db/imageStore';
  import { images, refreshImageStore } from '$lib/stores/imageStore';
  import { generateImage, editImage } from '$lib/services/openai';
  import type { ImageQuality, ImageSize } from '$lib/types/image';
  import { QUALITY_OPTIONS, SIZE_OPTIONS, PRICING, IMAGE_UPLOAD_LIMITS } from '$lib/types/image';

  export let prompt = '';
  let isGenerating = false;
  let error: string | null = null;
  let selectedQuality: ImageQuality = 'low';
  let selectedSize: ImageSize = '1024x1024';
  let imageCount = 1;
  let mode: 'generate' | 'edit' = 'generate';
  let inputImages: File[] = [];
  let imagePreviews: string[] = [];

  // Calculate price dynamically
  $: currentPrice = PRICING[selectedQuality][selectedSize] * imageCount;

  onMount(() => {
    prompt = "A cyberpunk city at night with neon lights and flying cars";
    error = null;
  });

  function validateImageFile(file: File): string | null {
    // Check file size
    if (file.size > IMAGE_UPLOAD_LIMITS.maxFileSize) {
      return `File "${file.name}" is too large. Maximum size is 50MB.`;
    }

    // Check file type
    if (!IMAGE_UPLOAD_LIMITS.acceptedFormats.includes(file.type as any)) {
      return `File "${file.name}" has an unsupported format. Please use PNG, WEBP, or JPEG.`;
    }

    return null;
  }

  function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);

    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (inputImages.length + files.length > IMAGE_UPLOAD_LIMITS.maxImages) {
      error = `You can upload up to ${IMAGE_UPLOAD_LIMITS.maxImages} images maximum.`;
      return;
    }

    // Validate each file
    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        error = validationError;
        return;
      }
    }

    // Clear any previous errors
    error = null;

    // Add files and create previews
    files.forEach((file) => {
      inputImages = [...inputImages, file];

      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreviews = [...imagePreviews, e.target?.result as string];
      };
      reader.readAsDataURL(file);
    });

    // Clear the input
    target.value = '';
  }

  function removeImage(index: number) {
    inputImages = inputImages.filter((_, i) => i !== index);
    imagePreviews = imagePreviews.filter((_, i) => i !== index);
  }

  function clearAllImages() {
    inputImages = [];
    imagePreviews = [];
  }

  async function handleGenerate() {
    if (!$apiKey) {
      error = "Please enter your OpenAI API key first";
      return;
    }

    if (!prompt.trim()) {
      error = "Please enter a prompt";
      return;
    }

    if (mode === 'edit' && inputImages.length === 0) {
      error = "Please upload at least one image to edit";
      return;
    }

    isGenerating = true;
    error = null;

    try {
      let imageDataArray: string[];

      if (mode === 'edit' && inputImages.length > 0) {
        imageDataArray = await editImage($apiKey, {
          images: inputImages,
          prompt,
          quality: selectedQuality,
          size: selectedSize,
          n: imageCount
        });
      } else {
        imageDataArray = await generateImage($apiKey, {
          prompt,
          quality: selectedQuality,
          size: selectedSize,
          n: imageCount
        });
      }

      // Store each generated image
      for (const imageData of imageDataArray) {
        const imageDataUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
        await addImage(
          imageDataUrl,
          prompt,
          'gpt-image-1',
          selectedQuality,
          selectedSize
        );
      }

      // Refresh the image store
      await refreshImageStore();

      // Clear the prompt and images if editing
      prompt = '';
      if (mode === 'edit') {
        clearAllImages();
      }

    } catch (err) {
      console.error('Error generating image:', err);
      error = err instanceof Error ? err.message : 'Failed to generate image';
    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="glass-effect p-5 rounded-xl">
  <h2 class="text-lg font-medium text-gray-100 mb-4">
    {mode === 'generate' ? 'Generate New Image' : 'Edit Image'}
  </h2>

  <!-- Mode Toggle -->
  <div class="mb-4">
    <div class="flex bg-gray-800 rounded-lg p-1">
      <button
        type="button"
        class="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 {mode === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}"
        on:click={() => mode = 'generate'}
      >
        Generate
      </button>
      <button
        type="button"
        class="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 {mode === 'edit' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}"
        on:click={() => mode = 'edit'}
      >
        Edit
      </button>
    </div>
  </div>

  <form on:submit|preventDefault={handleGenerate} class="space-y-4">
    <!-- Image Upload Section (only for edit mode) -->
    {#if mode === 'edit'}
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Images ({inputImages.length}/{IMAGE_UPLOAD_LIMITS.maxImages})
        </label>

        <div class="flex items-center gap-4 mb-3">
          <label class="cursor-pointer">
            <input
              type="file"
              accept={IMAGE_UPLOAD_LIMITS.acceptedExtensions}
              class="hidden"
              multiple
              on:change={handleImageUpload}
              disabled={isGenerating || inputImages.length >= IMAGE_UPLOAD_LIMITS.maxImages}
            />
            <div class="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors {inputImages.length >= IMAGE_UPLOAD_LIMITS.maxImages ? 'opacity-50 cursor-not-allowed' : ''}">
              <Upload class="h-4 w-4" />
              <span class="text-sm">Upload Images</span>
            </div>
          </label>

          {#if inputImages.length > 0}
            <button
              type="button"
              class="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
              on:click={clearAllImages}
            >
              Clear All
            </button>
          {/if}
        </div>

        {#if imagePreviews.length > 0}
          <div class="grid grid-cols-4 gap-2 mb-3">
            {#each imagePreviews as preview, index (index)}
              <div class="relative">
                <img src={preview} alt="Preview {index + 1}" class="w-full h-16 object-cover rounded-lg" />
                <button
                  type="button"
                  class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1"
                  on:click={() => removeImage(index)}
                >
                  <X class="h-3 w-3" />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <p class="text-xs text-gray-500">
          PNG, WEBP, or JPEG files, up to 50MB each. You can upload up to 16 images.
        </p>
      </div>
    {/if}

    <div>
      <label for="prompt" class="block text-sm font-medium text-gray-300 mb-2">
        Prompt
      </label>
      <textarea
        id="prompt"
        bind:value={prompt}
        rows="4"
        placeholder={mode === 'generate' ? 'Describe the image you want to generate...' : 'Describe how you want to edit the image...'}
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
          {#each Object.entries(QUALITY_OPTIONS) as [key, option] (key)}
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
          {#each Object.entries(SIZE_OPTIONS) as [key, option] (key)}
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
      class="btn group bg-gradient-to-r ring-transparent ring-2 duration-300 hover:ring-white from-purple-700 to-cyan-600 w-full flex items-center justify-center gap-2"
      disabled={isGenerating || !$apiKey || (mode === 'edit' && inputImages.length === 0)}
    >
      {#if isGenerating}
        <Loader2 class="h-5 w-5 animate-spin" />
        {mode === 'generate' ? 'Generating...' : 'Editing...'}
      {:else}
        <Send class="h-5 w-5" />
        {mode === 'generate' ? `Generate ${imageCount > 1 ? `${imageCount} Images` : 'Image'}` : 'Edit Image'}
      {/if}
    </button>

    {#if !$apiKey}
      <div class="text-sm text-warning-400 bg-warning-900/20 border border-warning-600/20 p-2 rounded-md">
        Please add your OpenAI API key to generate images
      </div>
    {/if}

    {#if mode === 'edit'}
      <div class="text-sm text-blue-400 bg-blue-900/20 border border-blue-600/20 p-2 rounded-md">
        Image editing uses GPT Image 1 with high input fidelity. Upload clear images for best results.
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
