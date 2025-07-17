import { writable, derived } from 'svelte/store';
import { getAllImages } from '$lib/db/imageStore';
import type { Writable, Readable } from 'svelte/store';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat } from '$lib/types/image';
import { PRICING } from '$lib/types/image';

// Define the interface for our image records
export interface ImageRecord {
  id: string;
  prompt: string;
  imageData: string;
  timestamp: number;
  model?: string;
  quality?: ImageQuality;
  size?: ImageSize;
  input_fidelity?: InputFidelity;
  output_compression?: number;
  output_format?: OutputFormat;
}

// Create a store to hold our image records
export const images: Writable<ImageRecord[]> = writable([]);

// Create a derived store for total cost calculation
export const totalCost: Readable<number> = derived(images, ($images) => {
  return $images.reduce((total, image) => {
    // If we have quality and size info, use specific pricing
    if (image.quality && image.size && PRICING[image.quality]?.[image.size]) {
      return total + PRICING[image.quality][image.size];
    }
    // Default fallback price for images without detailed info
    return total + 0.01;
  }, 0);
});

// Initialize the store with data from IndexedDB
export const initImageStore = async () => {
  try {
    const allImages = await getAllImages();
    images.set(allImages);
  } catch (error) {
    console.error('Failed to load images from IndexedDB:', error);
    images.set([]);
  }
};

// Function to refresh the image store
export const refreshImageStore = async () => {
  await initImageStore();
};
