<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Image as ImageIcon } from 'lucide-svelte';
  import ImageCard from './ImageCard.svelte';
  import type { ImageRecord } from '$lib/stores/imageStore';
  import { images, initImageStore } from '$lib/stores/imageStore';
  
  export let onRegenerate: (prompt: string) => void;
  
  let loading = true;
  
  onMount(async () => {
    await initImageStore();
    loading = false;
  });
  
  function handleRegenerate(event: CustomEvent<{ prompt: string }>) {
    onRegenerate(event.detail.prompt);
  }
</script>

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
      {#each $images as image (image.id)}
        <div in:fly={{ y: 20, duration: 300, delay: 50 * $images.indexOf(image) }}>
          <ImageCard 
            id={image.id}
            prompt={image.prompt}
            imageData={image.imageData}
            timestamp={image.timestamp}
            on:regenerate={handleRegenerate}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>