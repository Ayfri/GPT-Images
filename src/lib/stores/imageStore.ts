import { writable, get } from 'svelte/store';
import { countImages, getImages, getCostCache, setCostCache, invalidateCostCache, computeImageCostTotal } from '$lib/db/imageStore';
import { runMigrations } from '$lib/db/migrations';
import type { Writable } from 'svelte/store';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground, ImageModel } from '$lib/types/image';

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

export const images: Writable<ImageRecord[]> = writable([]);
export const totalImageCount: Writable<number> = writable(0);
export const totalCostAll: Writable<number> = writable(0);
export const currentImageOffset: Writable<number> = writable(0);
const PAGE_SIZE = 12;

const idle = typeof requestIdleCallback !== 'undefined'
	? (cb: () => void) => requestIdleCallback(cb)
	: (cb: () => void) => setTimeout(cb, 50);

export const initImageStore = async () => {
	try {
		await runMigrations();
		const count = await countImages();
		totalImageCount.set(count);
		const initialImages = await getImages(0, PAGE_SIZE);
		images.set(initialImages as ImageRecord[]);
		currentImageOffset.set(initialImages.length);

		const cached = getCostCache();
		if (cached && cached.count === count) {
			totalCostAll.set(cached.totalCost);
		} else {
			idle(async () => {
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

export const loadMoreImages = async () => {
	const offset = get(currentImageOffset);
	const newImages = await getImages(offset, PAGE_SIZE);
	images.update(existing => [...existing, ...newImages] as ImageRecord[]);
	currentImageOffset.update(o => o + newImages.length);
};

export const refreshImageStore = () => initImageStore();

export const invalidateImageStats = () => invalidateCostCache();
