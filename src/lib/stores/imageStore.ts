import { writable } from 'svelte/store';
import { getAllImages } from '$lib/db/imageStore';
import type { Writable } from 'svelte/store';

// Define the interface for our image records
export interface ImageRecord {
  id: string;
  prompt: string;
  imageData: string;
  timestamp: number;
}

// Create a store to hold our image records
export const images: Writable<ImageRecord[]> = writable([]);

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