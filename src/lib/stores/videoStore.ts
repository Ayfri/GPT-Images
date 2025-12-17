import { derived, get, writable } from 'svelte/store';
import { countVideos, getVideos, addVideoWithCleanup, getStorageStatus } from '$lib/db/videoStore';
import type { Readable, Writable } from 'svelte/store';
import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
import { calculateVideoPrice } from '$lib/utils/videoPrice';

// Define the interface for our video records
export interface VideoRecord {
	duration?: VideoDuration;
	id: string;
	model?: VideoModel;
	prompt: string;
	resolution?: VideoResolution;
	timestamp: number;
	videoData: string;
}

// Create a store to hold our video records
export const videos: Writable<VideoRecord[]> = writable([]);
export const totalVideoCount: Writable<number> = writable(0);
export const currentVideoOffset: Writable<number> = writable(0);
export const storageStatus: Writable<{
	sizeMB: number;
	isNearLimit: boolean;
	isOverLimit: boolean;
	percentage: number;
} | null> = writable(null);
const PAGE_SIZE = 12; // Adjust as needed

// Keep track of total storage size to avoid recalculating from all videos
let cachedTotalSizeBytes: number | null = null;

/**
 * Get cached total storage size, or calculate it if not cached
 */
async function getCachedTotalSize(): Promise<number> {
	if (cachedTotalSizeBytes === null) {
		// Calculate from all videos (expensive operation)
		const { getTotalStorageSize } = await import('$lib/db/videoStore');
		cachedTotalSizeBytes = await getTotalStorageSize();
	}
	return cachedTotalSizeBytes;
}

/**
 * Update cached total size when videos are added or removed
 */
function updateCachedSize(deltaBytes: number) {
	if (cachedTotalSizeBytes !== null) {
		cachedTotalSizeBytes += deltaBytes;
		// Ensure it doesn't go negative
		if (cachedTotalSizeBytes < 0) cachedTotalSizeBytes = 0;
	}
}

/**
 * Reset cached size (force recalculation on next access)
 */
function resetCachedSize() {
	cachedTotalSizeBytes = null;
}

// Helper function to safely get video price
function getVideoPrice(video: VideoRecord): number {
	return calculateVideoPrice(video.model, video.resolution, video.duration);
}

// Create a derived store for total cost calculation
export const totalCost: Readable<number> = derived(videos, ($videos) => {
	return $videos.reduce((total, video) => {
		return total + getVideoPrice(video);
	}, 0);
});

/**
 * Get optimized storage status using cached size
 */
async function getOptimizedStorageStatus(): Promise<{
	sizeMB: number;
	isNearLimit: boolean;
	isOverLimit: boolean;
	percentage: number;
}> {
	const MAX_STORAGE_SIZE_MB = 100;
	const STORAGE_WARNING_THRESHOLD_MB = 80;

	const sizeBytes = await getCachedTotalSize();
	const sizeMB = sizeBytes / (1024 * 1024);
	const percentage = (sizeMB / MAX_STORAGE_SIZE_MB) * 100;

	return {
		sizeMB: Math.round(sizeMB * 100) / 100,
		isNearLimit: sizeMB >= STORAGE_WARNING_THRESHOLD_MB,
		isOverLimit: sizeMB >= MAX_STORAGE_SIZE_MB,
		percentage: Math.round(percentage * 100) / 100
	};
}

// Initialize the store with data from IndexedDB
export const initVideoStore = async () => {
	try {
		const count = await countVideos();
		totalVideoCount.set(count);

		const initialVideos = await getVideos(PAGE_SIZE, 0);
		videos.set(initialVideos as VideoRecord[]);
		currentVideoOffset.set(initialVideos.length);

		// Load storage status using optimized method (with error handling)
		try {
			const status = await getOptimizedStorageStatus();
			storageStatus.set(status);
		} catch (storageError) {
			console.warn('Failed to load storage status, continuing without it:', storageError);
			storageStatus.set(null);
		}
	} catch (error) {
		console.error('Failed to load videos from IndexedDB:', error);
		videos.set([]);
		totalVideoCount.set(0);
		currentVideoOffset.set(0);
		storageStatus.set(null);
		resetCachedSize(); // Reset cache on error
	}
};

// Function to load more videos
export const loadMoreVideos = async () => {
	const currentOffset = get(currentVideoOffset);
	const newVideos = await getVideos(PAGE_SIZE, currentOffset);
	videos.update((existingVideos) => [...existingVideos, ...newVideos] as VideoRecord[]);
	currentVideoOffset.update((offset) => offset + newVideos.length);
};

// Function to add video with automatic cleanup and smart refresh
export const addVideoWithStorageManagement = async (
	duration: VideoDuration,
	model: VideoModel,
	prompt: string,
	resolution: VideoResolution,
	videoData: string
): Promise<{ id: string; cleanedCount: number }> => {
	const { video, cleanedCount } = await addVideoWithCleanup(duration, model, prompt, resolution, videoData);

	// Reset cache since videos may have been added/deleted
	resetCachedSize();

	// Add the new video to the top of the list
	videos.update(current => [video as VideoRecord, ...current]);
	currentVideoOffset.update(offset => offset + 1);
	totalVideoCount.update(count => count + 1);

	// Update storage status
	try {
		const status = await getOptimizedStorageStatus();
		storageStatus.set(status);
	} catch (error) {
		console.warn('Failed to update storage status:', error);
	}

	return { id: video.id, cleanedCount };
};

// Function to refresh the video store
export const refreshVideoStore = async () => {
	await initVideoStore();
};
