<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon
  } from 'lucide-svelte';
  import ImageCard from './ImageCard.svelte';
  import { images, initImageStore, loadMoreImages, totalImageCount, type ImageRecord } from '$lib/stores/imageStore';
  import { PRICING } from '$lib/types/image';
  import { quintOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';

  export let onRegenerate: (prompt: string) => void;
  export let onEditImage: (image: ImageRecord) => void; // New prop for editing

  let loading = true;
  let loadingMore = false; // New state for loading more images
  let largeViewIndex: number | null = null;
  let currentImage: ImageRecord | null = null;
  let currentImagePrice = 0;
  let sortDirection: 'asc' | 'desc' = 'desc';
  let sortField: 'timestamp' | 'prompt' | 'quality' | 'size' | 'price' = 'timestamp';

  let observer: IntersectionObserver;
  let imageGridRef: HTMLElement;

  const qualityOrder = { high: 3, low: 1, medium: 2 };

  function getImagePrice(image: ImageRecord): number {
    return image.quality && image.size && PRICING[image.quality]?.[image.size]
      ? PRICING[image.quality][image.size]
      : 0.01;
  }

  function getImageSizeArea(size: string | undefined): number {
    if (!size) return 0;
    const [w, h] = size.split('x').map(Number);
    return w * h;
  }

  function getSortValue(
    image: ImageRecord,
    field: typeof sortField
  ): string | number {
    switch (field) {
      case 'price':
        return getImagePrice(image);
      case 'quality':
        return qualityOrder[image.quality ?? 'low'] ?? 0;
      case 'size':
        return getImageSizeArea(image.size);
      case 'prompt':
        return image.prompt.toLowerCase();
      case 'timestamp':
        return image.timestamp;
    }
  }

  $: sortedImages = [...$images].sort((a, b) => {
    const aValue = getSortValue(a, sortField);
    const bValue = getSortValue(b, sortField);

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  $: if (largeViewIndex !== null) {
    currentImage = sortedImages[largeViewIndex];
  } else {
    currentImage = null;
  }

  $: if (currentImage) {
    currentImagePrice =
      currentImage.quality && currentImage.size && PRICING[currentImage.quality]?.[currentImage.size]
        ? PRICING[currentImage.quality][currentImage.size]
        : 0.01;
  }


  onMount(async () => {
    await initImageStore();
    loading = false;

    // Set up intersection observer for infinite scroll
    observer = new IntersectionObserver(
      async (entries) => {
        const lastImageCard = entries[0];
        if (lastImageCard.isIntersecting && !loadingMore && $images.length < $totalImageCount) {
          loadingMore = true;
          await loadMoreImages();
          loadingMore = false;
        }
      },
      { threshold: 0.5 }
    );

    // Observe the last element if images are already loaded
    if (sortedImages.length > 0 && imageGridRef) {
      const lastCard = imageGridRef.lastElementChild;
      if (lastCard) {
        observer.observe(lastCard);
      }
    }

    // Cleanup observer on component destroy
    return () => observer.disconnect();
  });

  // Reactively observe the last element when sortedImages changes
  $: if (sortedImages.length > 0 && imageGridRef) {
    // Disconnect old observer if it exists
    if (observer) {
      observer.disconnect();
    }
    // Re-observe the new last element
    const lastCard = imageGridRef.lastElementChild;
    if (lastCard) {
      observer.observe(lastCard);
    }
  }

  function handleRegenerate(event: CustomEvent<{ prompt: string }>) {
    onRegenerate(event.detail.prompt);
  }

  function handleView(event: CustomEvent<{ id: string }>) {
    const imageId = event.detail.id;
    largeViewIndex = sortedImages.findIndex(img => img.id === imageId);
  }

  function handleEdit(event: CustomEvent<{ id: string }>) {
    const imageId = event.detail.id;
    const imageToEdit = sortedImages.find(img => img.id === imageId);
    if (imageToEdit) {
      onEditImage(imageToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
    }
  }

  function closeLargeImage() {
    largeViewIndex = null;
  }

  function showNext() {
    if (largeViewIndex === null) return;
    largeViewIndex = (largeViewIndex + 1) % sortedImages.length;
  }

  function showPrev() {
    if (largeViewIndex === null) return;
    largeViewIndex = (largeViewIndex - 1 + sortedImages.length) % sortedImages.length;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (largeViewIndex === null) return;

    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'Escape') closeLargeImage();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div>
  <div class="mb-6 flex items-center justify-between">
    <h2 class="text-xl font-medium text-gray-100">Image History</h2>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-400" for="sort-by">Sort by</label>
        <select
          bind:value={sortField}
          class="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
          id="sort-by"
        >
          <option value="timestamp">Date</option>
          <option value="price">Price</option>
          <option value="prompt">Prompt</option>
          <option value="quality">Quality</option>
          <option value="size">Size</option>
        </select>
      </div>
      <button
        class="rounded-md border border-gray-700 bg-gray-800 p-1.5 text-white hover:bg-gray-700"
        on:click={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
      >
        {#if sortDirection === 'asc'}
          <ArrowUp class="h-4 w-4" />
        {:else}
          <ArrowDown class="h-4 w-4" />
        {/if}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-40">
      <div class="animate-pulse-slow text-gray-500">Loading images...</div>
    </div>
  {:else if $images.length === 0}
    <div
      in:fly={{ y: 20, duration: 300 }}
      class="text-center py-10 px-4 border border-dashed border-gray-700 rounded-xl"
    >
      <ImageIcon class="h-10 w-10 text-gray-600 mx-auto mb-3" />
      <h3 class="text-lg font-medium text-gray-400">No images yet</h3>
      <p class="text-gray-500 text-sm mt-1">
        Generate your first image to see it here
      </p>
    </div>
  {:else}
    <div class="image-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" bind:this={imageGridRef}>
      {#each sortedImages as image, i (image.id)}
        <div animate:flip={{ duration: 300 }} in:fly={{ y: 20, duration: 300, delay: 50 * i }}>
          <ImageCard
            id={image.id}
            prompt={image.prompt}
            imageData={image.imageData}
            timestamp={image.timestamp}
            on:regenerate={handleRegenerate}
            on:view={handleView}
            on:edit={handleEdit}
          />
        </div>
      {/each}
    </div>

    {#if $images.length < $totalImageCount}
      <div class="mt-8 flex justify-center">
        <div
          class="animate-pulse-slow text-gray-500"
          class:hidden={!loadingMore}
        >
          Loading more images...
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if currentImage}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    transition:fade={{ duration: 150 }}
    on:click={closeLargeImage}
  >
    <button
      class="btn-ghost absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
      on:click|stopPropagation={showPrev}
      aria-label="Previous image"
    >
      <ChevronLeft class="h-8 w-8 text-white" />
    </button>

    <div class="relative h-full w-full" on:click|self={closeLargeImage}>
      {#key currentImage.id}
        <div
          class="absolute inset-0 flex items-center justify-center"
          in:fly={{ x: 30, duration: 300, easing: quintOut }}
        >
          <img
            alt={currentImage.prompt}
            class="max-h-[90vh] max-w-[80vw] object-contain"
            src={currentImage.imageData}
            on:click|stopPropagation
          />
        </div>
      {/key}
    </div>

    <div class="absolute left-4 top-4 flex flex-col gap-2 text-xs text-gray-400">
      <span>Quality: {currentImage.quality ?? 'N/A'}</span>
      <span>Size: {currentImage.size ?? 'N/A'}</span>
      {#if currentImage.input_fidelity && currentImage.input_fidelity !== 'low'}
        <span>Input Fidelity: {currentImage.input_fidelity}</span>
      {/if}
      {#if currentImage.output_compression && currentImage.output_compression !== 100}
        <span>Output Compression: {currentImage.output_compression}</span>
      {/if}
      {#if currentImage.output_format && currentImage.output_format !== 'png'}
        <span>Output Format: {currentImage.output_format}</span>
      {/if}
      {#if currentImage.background && currentImage.background !== 'auto'}
        <span>Background: {currentImage.background}</span>
      {/if}
      <span>Cost: ${currentImagePrice.toFixed(3)}</span>
    </div>

    <button
      class="btn-ghost absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 hover:bg-white/20"
      on:click|stopPropagation={showNext}
      aria-label="Next image"
    >
      <ChevronRight class="h-8 w-8 text-white" />
    </button>
  </div>
{/if}
