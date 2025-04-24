import { writable, derived } from 'svelte/store';
import { getAllImages } from '$lib/db/imageStore';
import type { Writable, Readable } from 'svelte/store';

// Define the interface for our image records
export interface ImageRecord {
  id: string;
  prompt: string;
  imageData: string;
  timestamp: number;
  model?: string;
  quality?: 'low' | 'medium' | 'high';
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}

// Pricing based on quality and size
export const pricing = {
  low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
  medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
  high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 }
};

// Create a store to hold our image records
export const images: Writable<ImageRecord[]> = writable([]);

// Create a derived store for total cost calculation
export const totalCost: Readable<number> = derived(images, ($images) => {
  return $images.reduce((total, image) => {
    // If we have quality and size info, use specific pricing
    if (image.quality && image.size && pricing[image.quality]?.[image.size]) {
      return total + pricing[image.quality][image.size];
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
