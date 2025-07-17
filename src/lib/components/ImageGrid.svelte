<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-svelte';
  import ImageCard from './ImageCard.svelte';
  import { images, initImageStore, pricing, type ImageRecord } from '$lib/stores/imageStore';
  import { quintOut } from 'svelte/easing';

  export let onRegenerate: (prompt: string) => void;

  let loading = true;
  let largeViewIndex: number | null = null;
  let currentImage: ImageRecord | null = null;
  let currentImagePrice = 0;

  $: if (largeViewIndex !== null) {
    currentImage = $images[largeViewIndex];
  } else {
    currentImage = null;
  }

  $: if (currentImage) {
    currentImagePrice =
      currentImage.quality && currentImage.size && pricing[currentImage.quality]?.[currentImage.size]
        ? pricing[currentImage.quality][currentImage.size]
        : 0.01;
  }


  onMount(async () => {
    await initImageStore();
    loading = false;
  });

  function handleRegenerate(event: CustomEvent<{ prompt: string }>) {
    onRegenerate(event.detail.prompt);
  }

  function handleView(event: CustomEvent<{ id: string }>) {
    const imageId = event.detail.id;
    largeViewIndex = $images.findIndex(img => img.id === imageId);
  }

  function closeLargeImage() {
    largeViewIndex = null;
  }

  function showNext() {
    if (largeViewIndex === null) return;
    largeViewIndex = (largeViewIndex + 1) % $images.length;
  }

  function showPrev() {
    if (largeViewIndex === null) return;
    largeViewIndex = (largeViewIndex - 1 + $images.length) % $images.length;
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
  <h2 class="text-xl font-medium text-gray-100 mb-6">Image History</h2>

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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each $images as image, i (image.id)}
        <div in:fly={{ y: 20, duration: 300, delay: 50 * i }}>
          <ImageCard
            id={image.id}
            prompt={image.prompt}
            imageData={image.imageData}
            timestamp={image.timestamp}
            on:regenerate={handleRegenerate}
            on:view={handleView}
          />
        </div>
      {/each}
    </div>
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
