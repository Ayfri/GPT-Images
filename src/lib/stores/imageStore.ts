import { writable, get } from 'svelte/store';
import {
	countImages,
	getImages,
	getCostCache,
	setCostCache,
	invalidateCostCache,
	computeImageCostTotal
} from '$lib/db/imageStore';
import type { Writable } from 'svelte/store';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground, ImageModel } from '$lib/types/image';

// Define the interface for our image records
export interface ImageRecord {
	id: string;
	prompt: string;
	imageData: string;
	timestamp: number;
	model?: ImageModel;
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
/** Total cost computed from ALL records in IndexedDB (not just loaded page) */
export const totalCostAll: Writable<number> = writable(0);
export const currentImageOffset: Writable<number> = writable(0);
const PAGE_SIZE = 12;

// Initialize the store with data from IndexedDB
export const initImageStore = async () => {
	try {
		const count = await countImages();
		totalImageCount.set(count);

		const initialImages = await getImages(0, PAGE_SIZE);
		images.set(initialImages as ImageRecord[]);
		currentImageOffset.set(initialImages.length);

		// --- Cost stats: try cache first, then compute in background ---
		const cached = getCostCache();
		if (cached && cached.count === count) {
			totalCostAll.set(cached.totalCost);
		} else {
			// Compute lazily so it doesn't block the initial render
			const schedule =
				typeof requestIdleCallback !== 'undefined'
					? (cb: () => void) => requestIdleCallback(cb)
					: (cb: () => void) => setTimeout(cb, 50);

			schedule(async () => {
				try {
					const cost = await computeImageCostTotal();
					totalCostAll.set(cost);
					setCostCache(cost, count);
				} catch (e) {
					console.warn('Failed to compute image cost total', e);
				}
			});
		}
	} catch (error) {
		console.error('Failed to load images from IndexedDB:', error);
		images.set([]);
		totalImageCount.set(0);
		totalCostAll.set(0);
		currentImageOffset.set(0);
	}
};

// Function to load more images
export const loadMoreImages = async () => {
	const currentOffset = get(currentImageOffset);
	const newImages = await getImages(currentOffset, PAGE_SIZE);
	images.update((existingImages) => [...existingImages, ...newImages] as ImageRecord[]);
	currentImageOffset.update((offset) => offset + newImages.length);
};

// Function to refresh the image store
export const refreshImageStore = async () => {
	await initImageStore();
};

/** Call after adding or deleting an image to keep count + cost in sync */
export const invalidateImageStats = () => {
	invalidateCostCache();
};
