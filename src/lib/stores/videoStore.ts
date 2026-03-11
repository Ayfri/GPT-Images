import { get, writable } from 'svelte/store';
import {
	countVideos, getVideos, addVideoWithCleanup,
	getVideoCostCache, setVideoCostCache, invalidateVideoCostCache, computeVideoCostTotal,
	getTotalStorageSize
} from '$lib/db/videoStore';
import { runMigrations } from '$lib/db/migrations';
import type { Writable } from 'svelte/store';
import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
import { calculateVideoPrice } from '$lib/utils/videoPrice';

export interface VideoRecord {
	duration?: VideoDuration;
	id: string;
	model?: VideoModel;
	prompt: string;
	resolution?: VideoResolution;
	timestamp: number;
	videoData: string;
}

export const videos: Writable<VideoRecord[]> = writable([]);
export const totalVideoCount: Writable<number> = writable(0);
export const totalCostAll: Writable<number> = writable(0);
export const currentVideoOffset: Writable<number> = writable(0);
export const storageStatus: Writable<{ sizeMB: number; isNearLimit: boolean; isOverLimit: boolean; percentage: number } | null> = writable(null);
const PAGE_SIZE = 12;

let cachedTotalSizeBytes: number | null = null;

async function getCachedTotalSize(): Promise<number> {
	if (cachedTotalSizeBytes === null) cachedTotalSizeBytes = await getTotalStorageSize();
	return cachedTotalSizeBytes;
}

function resetCachedSize() { cachedTotalSizeBytes = null; }

function getVideoPrice(video: VideoRecord): number {
	return calculateVideoPrice(video.model, video.resolution, video.duration);
}

async function getOptimizedStorageStatus() {
	const MAX = 100, WARN = 80;
	const sizeBytes = await getCachedTotalSize();
	const sizeMB = sizeBytes / (1024 * 1024);
	const percentage = (sizeMB / MAX) * 100;
	return {
		sizeMB: Math.round(sizeMB * 100) / 100,
		isNearLimit: sizeMB >= WARN,
		isOverLimit: sizeMB >= MAX,
		percentage: Math.round(percentage * 100) / 100
	};
}

const idle = typeof requestIdleCallback !== 'undefined'
	? (cb: () => void) => requestIdleCallback(cb)
	: (cb: () => void) => setTimeout(cb, 50);

export const initVideoStore = async () => {
	try {
		await runMigrations();
		const count = await countVideos();
		totalVideoCount.set(count);
		const initialVideos = await getVideos(PAGE_SIZE, 0);
		videos.set(initialVideos as VideoRecord[]);
		currentVideoOffset.set(initialVideos.length);

		const cached = getVideoCostCache();
		if (cached && cached.count === count) {
			totalCostAll.set(cached.totalCost);
		} else {
			idle(async () => {
				try {
					const cost = await computeVideoCostTotal();
					totalCostAll.set(cost);
					setVideoCostCache(cost, count);
				} catch (e) {
					console.warn('Failed to compute video cost total', e);
				}
			});
		}

		try {
			storageStatus.set(await getOptimizedStorageStatus());
		} catch {
			storageStatus.set(null);
		}
	} catch (error) {
		console.error('Failed to load videos from IndexedDB:', error);
		videos.set([]);
		totalVideoCount.set(0);
		totalCostAll.set(0);
		currentVideoOffset.set(0);
		storageStatus.set(null);
		resetCachedSize();
	}
};

export const loadMoreVideos = async () => {
	const offset = get(currentVideoOffset);
	const newVideos = await getVideos(PAGE_SIZE, offset);
	videos.update(existing => [...existing, ...newVideos] as VideoRecord[]);
	currentVideoOffset.update(o => o + newVideos.length);
};

export const addVideoWithStorageManagement = async (
	duration: VideoDuration,
	model: VideoModel,
	prompt: string,
	resolution: VideoResolution,
	videoData: string
): Promise<{ id: string; cleanedCount: number }> => {
	const { video, cleanedCount } = await addVideoWithCleanup(duration, model, prompt, resolution, videoData);
	resetCachedSize();
	invalidateVideoCostCache();
	videos.update(current => [video as VideoRecord, ...current]);
	currentVideoOffset.update(o => o + 1);
	totalVideoCount.update(n => n + 1);
	totalCostAll.update(c => c + getVideoPrice(video as VideoRecord));
	try {
		storageStatus.set(await getOptimizedStorageStatus());
	} catch {
		console.warn('Failed to update storage status');
	}
	return { id: video.id, cleanedCount };
};

export const refreshVideoStore = () => initVideoStore();
export const invalidateVideoStats = () => invalidateVideoCostCache();
