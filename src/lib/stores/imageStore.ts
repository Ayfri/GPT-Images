import { writable, derived, get } from 'svelte/store';
import { getAllImages, countImages, getImages } from '$lib/db/imageStore';
import type { Writable, Readable } from 'svelte/store';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground } from '$lib/types/image';
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
  background?: ImageBackground;
}

// Create a store to hold our image records
export const images: Writable<ImageRecord[]> = writable([]);
export const totalImageCount: Writable<number> = writable(0);
export const currentImageOffset: Writable<number> = writable(0);
const PAGE_SIZE = 12; // Adjust as needed

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
    const count = await countImages();
    totalImageCount.set(count);

    const initialImages = await getImages(0, PAGE_SIZE);
    images.set(initialImages);
    currentImageOffset.set(initialImages.length);
  } catch (error) {
    console.error('Failed to load images from IndexedDB:', error);
    images.set([]);
    totalImageCount.set(0);
    currentImageOffset.set(0);
  }
};

// Function to load more images
export const loadMoreImages = async () => {
  const currentOffset = await get(currentImageOffset);
  const newImages = await getImages(currentOffset, PAGE_SIZE);
  images.update((existingImages) => [...existingImages, ...newImages]);
  currentImageOffset.update((offset) => offset + newImages.length);
};

// Function to refresh the image store
export const refreshImageStore = async () => {
  await initImageStore();
};
