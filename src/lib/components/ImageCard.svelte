<script lang="ts">
  import { Download, Copy, Trash2, RefreshCw, Edit } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { downloadImage } from '$lib/utils/downloadImage';
  import { deleteImage } from '$lib/db/imageStore';
  import { images } from '$lib/stores/imageStore';
  import { createEventDispatcher } from 'svelte';
  import { PRICING } from '$lib/types/image';
  import type { ImageRecord } from '$lib/stores/imageStore';

  export let id: string;
  export let prompt: string;
  export let imageData: string;
  export let timestamp: number;

  const dispatch = createEventDispatcher<{
    regenerate: { prompt: string };
    deleted: { id: string };
    view: { id: string };
    edit: { id: string }; // New edit event
  }>();

  let copied = false;
  let showControls = false;
  let price: number;

  $: {
    const rec = $images.find(img => img.id === id);
    price = rec && rec.quality && rec.size && PRICING[rec.quality]?.[rec.size] ? PRICING[rec.quality][rec.size] : 0.01;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  async function handleDelete() {
    if (confirm('Are you sure you want to delete this image?')) {
      await deleteImage(id);
      images.update(imgs => imgs.filter(img => img.id !== id));
      dispatch('deleted', { id });
    }
  }

  function handleDownload() {
    downloadImage(imageData, prompt);
  }

  function handleRegenerate() {
    dispatch('regenerate', { prompt });
  }

  function handleView() {
    dispatch('view', { id });
  }
</script>

<div
  class="card group relative overflow-hidden transition-all duration-300"
  on:mouseenter={() => showControls = true}
  on:mouseleave={() => showControls = false}
  on:focusin={() => showControls = true}
  on:focusout={() => showControls = false}
  role="article"
  aria-label="Generated image card"
>
  <div class="relative aspect-square cursor-pointer overflow-hidden" on:click={handleView}>
    <img
      src={imageData}
      alt={prompt}
      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />

    {#if showControls}
      <div
        transition:fade={{ duration: 150 }}
        class="absolute inset-0 bg-gradient-to-t from-dark-300/90 via-dark-300/40 to-transparent flex flex-col justify-end p-3"
      >
        <div class="flex justify-between items-center mb-2">
          <button
            on:click|stopPropagation={handleDelete}
            class="btn-ghost p-2 rounded-full hover:bg-error-700/30"
            aria-label="Delete image"
            title="Delete image"
          >
            <Trash2 class="w-4 h-4 text-error-400" />
          </button>

          <div class="flex space-x-1">
            <button
              on:click|stopPropagation={copyPrompt}
              class="btn-ghost p-2 rounded-full hover:bg-primary-700/30"
              aria-label="Copy prompt"
              title="Copy prompt"
            >
              <Copy class="w-4 h-4 text-primary-400" />
            </button>

            <button
              on:click|stopPropagation={handleDownload}
              class="btn-ghost p-2 rounded-full hover:bg-secondary-700/30"
              aria-label="Download image"
              title="Download image"
            >
              <Download class="w-4 h-4 text-secondary-400" />
            </button>

            <button
              on:click|stopPropagation={handleRegenerate}
              class="btn-ghost p-2 rounded-full hover:bg-accent-700/30"
              aria-label="Regenerate with this prompt"
              title="Regenerate with this prompt"
            >
              <RefreshCw class="w-4 h-4 text-accent-400" />
            </button>
            <button
              on:click|stopPropagation={() => dispatch('edit', { id })}
              class="btn-ghost p-2 rounded-full hover:bg-blue-700/30"
              aria-label="Edit image"
              title="Edit image"
            >
              <Edit class="w-4 h-4 text-blue-400" />
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if copied}
      <div
        in:fly={{ y: 20, duration: 200 }}
        out:fade={{ duration: 150 }}
        class="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-primary-800 text-white text-xs py-1 px-3 rounded-full"
      >
        Copied!
      </div>
    {/if}
  </div>

  <div class="p-4">
    <p class="text-sm text-gray-300 line-clamp-2 mb-2" title={prompt}>
      {prompt}
    </p>
    <p class="text-xs text-gray-500 flex justify-between items-center">
      <span>{formatDate(timestamp)}</span>
      <span class="text-gray-400">${price.toFixed(3)}</span>
    </p>
  </div>
</div>
