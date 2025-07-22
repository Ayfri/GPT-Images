<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Send, Loader2, Upload, X, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { addImage } from '$lib/db/imageStore';
  import { images, refreshImageStore } from '$lib/stores/imageStore';
  import { generateImage, editImage } from '$lib/services/openai';
  import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground } from '$lib/types/image';
  import type { ImageRecord } from '$lib/stores/imageStore';
  import { QUALITY_OPTIONS, SIZE_OPTIONS, PRICING, IMAGE_UPLOAD_LIMITS, INPUT_FIDELITY_OPTIONS, OUTPUT_FORMAT_OPTIONS, BACKGROUND_OPTIONS } from '$lib/types/image';
  import { browser } from '$app/environment';

  // Storage keys
  const FORM_OPTIONS_KEY = 'image-generator-options';

  // Load options from localStorage if available
  function loadFormOptions() {
    if (!browser) return
    const raw = localStorage.getItem(FORM_OPTIONS_KEY)
    if (!raw) return
    try {
      const opts = JSON.parse(raw)
      if (opts.selectedQuality) selectedQuality = opts.selectedQuality
      if (opts.selectedSize) selectedSize = opts.selectedSize
      if (opts.imageCount) imageCount = opts.imageCount
      if (opts.inputFidelity) inputFidelity = opts.inputFidelity
      if (opts.outputCompression !== undefined) outputCompression = opts.outputCompression
      if (opts.outputFormat) outputFormat = opts.outputFormat
      if (opts.selectedBackground) selectedBackground = opts.selectedBackground
    } catch {}
  }

  function saveFormOptions() {
    if (!browser) return
    const opts = {
      selectedQuality,
      selectedSize,
      imageCount,
      inputFidelity,
      outputCompression,
      outputFormat,
      selectedBackground
    }
    localStorage.setItem(FORM_OPTIONS_KEY, JSON.stringify(opts))
  }

  export let prompt = '';
  export let imageToEdit: ImageRecord | null = null; // New prop to receive image for editing
  let isGenerating = false;
  let error: string | null = null;
  let selectedQuality: ImageQuality = 'low';
  let selectedSize: ImageSize = '1024x1024';
  let imageCount = 1;
  let mode: 'generate' | 'edit' = 'generate';
  let inputImages: File[] = [];
  let imagePreviews: string[] = [];
  let inputMask: File | null = null;
  let maskPreview: string | null = null;

  // Advanced options
  let showAdvanced = false;
  let inputFidelity: InputFidelity = 'low';
  let outputCompression = 100;
  let outputFormat: OutputFormat = 'png';
  let selectedBackground: ImageBackground = 'auto';

  // Calculate price dynamically
  $: currentPrice = PRICING[selectedQuality][selectedSize] * imageCount;

  onMount(() => {
    loadFormOptions()
    prompt = "A cyberpunk city at night with neon lights and flying cars";
    error = null;
  });

  // Save options whenever they change
  $: saveFormOptions(), [selectedQuality, selectedSize, imageCount, inputFidelity, outputCompression, outputFormat, selectedBackground]

  // Reactively set prompt and image for editing
  $: if (imageToEdit) {
    prompt = imageToEdit.prompt;
    mode = 'edit';
    // Convert base64 image data URL to a File object for inputImages
    fetch(imageToEdit.imageData)
      .then(res => res.blob())
      .then(blob => {
        const filename = `edited_image_${imageToEdit?.id}.png`;
        const file = new File([blob], filename, { type: blob.type });
        inputImages = [file];
        imagePreviews = [imageToEdit.imageData];
      })
      .catch(e => console.error("Error converting image data to File:", e));

    // Set other image properties if available
    if (imageToEdit) {
      selectedQuality = imageToEdit.quality ?? 'low';
      selectedSize = imageToEdit.size ?? '1024x1024';
      inputFidelity = imageToEdit.input_fidelity ?? 'low';
      outputCompression = imageToEdit.output_compression ?? 100;
      outputFormat = imageToEdit.output_format ?? 'png';
      selectedBackground = imageToEdit.background ?? 'auto';
    }
  }

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

  function handleMaskUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Mask specific validation
    if (file.type !== 'image/png') {
      error = 'Mask image must be a PNG file.';
      return;
    }
    if (file.size > IMAGE_UPLOAD_LIMITS.maskMaxSize) {
      error = `Mask file "${file.name}" is too large. Maximum size is ${IMAGE_UPLOAD_LIMITS.maskMaxSize / (1024 * 1024)}MB.`;
      return;
    }

    // Clear any previous errors
    error = null;

    inputMask = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      maskPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Clear the input
    target.value = '';
  }

  function removeMask() {
    inputMask = null;
    maskPreview = null;
  }

  function removeImage(index: number) {
    inputImages = inputImages.filter((_, i) => i !== index);
    imagePreviews = imagePreviews.filter((_, i) => i !== index);
  }

  function clearAllImages() {
    inputImages = [];
    imagePreviews = [];
    inputMask = null;
    maskPreview = null;
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

    if (selectedBackground === 'transparent' && outputFormat === 'jpeg') {
      error = 'Transparent background is not supported for JPEG output format. Please select PNG or WebP.';
      return;
    }

    isGenerating = true;
    error = null;

    try {
      let imageDataArray: string[];

      const baseParams = {
        prompt,
        quality: selectedQuality,
        size: selectedSize,
        n: imageCount,
        input_fidelity: inputFidelity,
        output_compression: outputCompression,
        output_format: outputFormat,
        background: selectedBackground
      };

      if (mode === 'edit' && inputImages.length > 0) {
        imageDataArray = await editImage($apiKey, {
          ...baseParams,
          input_fidelity: inputFidelity, // Only add input_fidelity for editing
          images: inputImages,
          mask: inputMask || undefined
        });
      } else {
        // For generation, create params without input_fidelity
        const generationParams = {
          prompt,
          quality: selectedQuality,
          size: selectedSize,
          n: imageCount,
          output_compression: outputCompression,
          output_format: outputFormat,
          background: selectedBackground
        };
        imageDataArray = await generateImage($apiKey, generationParams);
      }

      // Store each generated image
      for (const imageData of imageDataArray) {
        const imageDataUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
        await addImage(
          imageDataUrl,
          prompt,
          'gpt-image-1',
          selectedQuality,
          selectedSize,
          inputFidelity,
          outputCompression,
          outputFormat,
          selectedBackground
        );
      }

      // Refresh the image store
      await refreshImageStore();

      // Clear the prompt and images if editing
      prompt = '';
      if (mode === 'edit') {
        clearAllImages();
        imageToEdit = null; // Clear the imageToEdit prop after successful edit
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
        <label class="block text-sm font-medium text-gray-300 mb-2" for="image-upload">
          Images ({inputImages.length}/{IMAGE_UPLOAD_LIMITS.maxImages})
        </label>

        <div class="flex items-center gap-4 mb-3">
          <label class="cursor-pointer">
            <input
              id="image-upload"
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

    <!-- Advanced Options -->
    <div class="border-t border-gray-700 pt-4">
      <button
        type="button"
        class="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        on:click={() => showAdvanced = !showAdvanced}
      >
        {#if showAdvanced}
          <ChevronDown class="h-4 w-4" />
        {:else}
          <ChevronRight class="h-4 w-4" />
        {/if}
        Advanced Options
      </button>

      {#if showAdvanced}
        <div class="mt-4 space-y-4 pl-6 border-l-2 border-gray-700">
          <div class="grid grid-cols-2 gap-4">
            {#if mode === 'edit'}
              <div>
                <label for="inputFidelity" class="block text-sm font-medium text-gray-300 mb-2">
                  Input Fidelity
                </label>
                <select
                  id="inputFidelity"
                  bind:value={inputFidelity}
                  class="input w-full"
                  disabled={isGenerating}
                >
                  {#each Object.entries(INPUT_FIDELITY_OPTIONS) as [key, option] (key)}
                    <option value={key}>{option.label}</option>
                  {/each}
                </select>
                <p class="text-xs text-gray-500 mt-1">
                  {INPUT_FIDELITY_OPTIONS[inputFidelity].description}
                </p>
              </div>
            {/if}

            <div>
              <label for="outputFormat" class="block text-sm font-medium text-gray-300 mb-2">
                Output Format
              </label>
              <select
                id="outputFormat"
                bind:value={outputFormat}
                class="input w-full"
                disabled={isGenerating}
              >
                {#each Object.entries(OUTPUT_FORMAT_OPTIONS) as [key, option] (key)}
                  <option value={key} disabled={selectedBackground === 'transparent' && key === 'jpeg'}>{option.label}</option>
                {/each}
              </select>
              <p class="text-xs text-gray-500 mt-1">
                {OUTPUT_FORMAT_OPTIONS[outputFormat].description}
              </p>
            </div>
          </div>

          <div>
            <label for="background" class="block text-sm font-medium text-gray-300 mb-2">
              Background
            </label>
            <select
              id="background"
              bind:value={selectedBackground}
              class="input w-full"
              disabled={isGenerating}
            >
              {#each Object.entries(BACKGROUND_OPTIONS) as [key, option] (key)}
                <option value={key}>{option.label}</option>
              {/each}
            </select>
            <p class="text-xs text-gray-500 mt-1">
              {BACKGROUND_OPTIONS[selectedBackground].description}
            </p>
          </div>

          {#if outputFormat === 'jpeg' || outputFormat === 'webp'}
            <div>
              <label for="outputCompression" class="block text-sm font-medium text-gray-300 mb-2">
                Output Compression: {outputCompression}%
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="outputCompression"
                  type="range"
                  min="0"
                  max="100"
                  bind:value={outputCompression}
                  class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  disabled={isGenerating}
                />
                <span class="text-sm text-gray-400 w-12">{outputCompression}%</span>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                Higher values = better quality, larger file size
              </p>
            </div>
          {/if}

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2 mt-4" for="mask-upload">
              Mask (Optional)
            </label>
            <div class="flex items-center gap-4 mb-3">
              <label class="cursor-pointer">
                <input
                  id="mask-upload"
                  type="file"
                  accept=".png"
                  class="hidden"
                  on:change={handleMaskUpload}
                  disabled={isGenerating || inputMask !== null}
                />
                <div class="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors {inputMask !== null ? 'opacity-50 cursor-not-allowed' : ''}">
                  <Upload class="h-4 w-4" />
                  <span class="text-sm">Upload Mask (PNG)</span>
                </div>
              </label>

              {#if maskPreview}
                <div class="relative">
                  <img src={maskPreview} alt="Mask Preview" class="w-16 h-16 object-cover rounded-lg" />
                  <button
                    type="button"
                    class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1"
                    on:click={removeMask}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              {/if}
            </div>
            <p class="text-xs text-gray-500">
              Optional PNG file (max 4MB) to control image editing areas. Applied to the first image.
            </p>
          </div>
        </div>
      {/if}
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
