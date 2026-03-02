import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
import { calculateVideoPrice } from '$lib/utils/videoPrice';

interface GeneratedVideo {
	duration?: VideoDuration;
	id: string;
	model?: VideoModel;
	prompt: string;
	resolution?: VideoResolution;
	timestamp: number;
	videoData: string;
}

interface VideoDB extends DBSchema {
	'generated-videos': {
		indexes: {
			'by-timestamp': number;
		};
		key: string;
		value: GeneratedVideo;
	};
}

let db: IDBPDatabase<VideoDB> | null = null;

export async function getDb() {
	if (!db) {
		db = await openDB<VideoDB>('gpt-video-generator', 1, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					const store = db.createObjectStore('generated-videos', { keyPath: 'id' });
					store.createIndex('by-timestamp', 'timestamp');
				}
			}
		});
	}
	return db;
}

export async function addVideo(
	duration: VideoDuration,
	model: VideoModel,
	prompt: string,
	resolution: VideoResolution,
	videoData: string
): Promise<GeneratedVideo> {
	const db = await getDb();
	const video: GeneratedVideo = {
		duration,
		id: crypto.randomUUID(),
		model,
		prompt,
		resolution,
		timestamp: Date.now(),
		videoData
	};

	await db.add('generated-videos', video);
	return video;
}

export async function getVideos(limit: number, offset: number): Promise<GeneratedVideo[]> {
	const db = await getDb();
	const index = db.transaction('generated-videos', 'readonly').objectStore('generated-videos').index('by-timestamp');
	let cursor = await index.openCursor(null, 'prev');
	if (offset > 0 && cursor) cursor = await cursor.advance(offset);
	const videos: GeneratedVideo[] = [];
	while (cursor && videos.length < limit) {
		videos.push(cursor.value);
		cursor = await cursor.continue();
	}
	return videos;
}

export async function countVideos(): Promise<number> {
	const db = await getDb();
	return db.count('generated-videos');
}

export async function getAllVideos(): Promise<GeneratedVideo[]> {
	const db = await getDb();
	return db.getAllFromIndex('generated-videos', 'by-timestamp').then(videos =>
		videos.sort((a, b) => b.timestamp - a.timestamp)
	);
}

export async function deleteVideo(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('generated-videos', id);
}

export async function clearVideos(): Promise<void> {
	const db = await getDb();
	await db.clear('generated-videos');
}

const VIDEO_COST_CACHE_KEY = 'gpt-video-cost-cache';
type VideoCostCache = { totalCost: number; count: number };

export function getVideoCostCache(): VideoCostCache | null {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VIDEO_COST_CACHE_KEY) : null;
		return raw ? JSON.parse(raw) : null;
	} catch { return null; }
}

export function setVideoCostCache(totalCost: number, count: number): void {
	try {
		if (typeof localStorage !== 'undefined')
			localStorage.setItem(VIDEO_COST_CACHE_KEY, JSON.stringify({ totalCost, count }));
	} catch { /* ignore */ }
}

export function invalidateVideoCostCache(): void {
	try { if (typeof localStorage !== 'undefined') localStorage.removeItem(VIDEO_COST_CACHE_KEY); }
	catch { /* ignore */ }
}

export async function computeVideoCostTotal(): Promise<number> {
	const db = await getDb();
	const store = db.transaction('generated-videos', 'readonly').objectStore('generated-videos');
	let totalCost = 0;
	let cursor = await store.openCursor();
	while (cursor) {
		const { model, resolution, duration } = cursor.value;
		totalCost += calculateVideoPrice(model, resolution, duration);
		cursor = await cursor.continue();
	}
	return totalCost;
}

const MAX_STORAGE_SIZE_MB = 100;
const STORAGE_WARNING_THRESHOLD_MB = 80;

function estimateDataUrlSize(dataUrl: string): number {
	const base64Data = dataUrl.split(',')[1];
	if (!base64Data) return 0;
	return Math.ceil((base64Data.length * 3) / 4);
}

export async function getTotalStorageSize(): Promise<number> {
	const videos = await getAllVideos();
	return videos.reduce((total, v) => total + estimateDataUrlSize(v.videoData), 0);
}

export async function getStorageSizeMB(): Promise<number> {
	return (await getTotalStorageSize()) / (1024 * 1024);
}

export async function getStorageStatus() {
	const sizeMB = await getStorageSizeMB();
	const percentage = (sizeMB / MAX_STORAGE_SIZE_MB) * 100;
	return {
		sizeMB: Math.round(sizeMB * 100) / 100,
		isNearLimit: sizeMB >= STORAGE_WARNING_THRESHOLD_MB,
		isOverLimit: sizeMB >= MAX_STORAGE_SIZE_MB,
		percentage: Math.round(percentage * 100) / 100
	};
}

export async function cleanupOldVideos(targetSizeMB = 70): Promise<number> {
	const db = await getDb();
	const videos = await getAllVideos();
	const targetSizeBytes = targetSizeMB * 1024 * 1024;
	let currentSize = await getTotalStorageSize();
	let deletedCount = 0;
	for (let i = videos.length - 1; i >= 0 && currentSize > targetSizeBytes; i--) {
		const video = videos[i];
		await db.delete('generated-videos', video.id);
		currentSize -= estimateDataUrlSize(video.videoData);
		deletedCount++;
	}
	return deletedCount;
}

export async function addVideoWithCleanup(
	duration: VideoDuration,
	model: VideoModel,
	prompt: string,
	resolution: VideoResolution,
	videoData: string
): Promise<{ video: GeneratedVideo; cleanedCount: number }> {
	const newVideoSize = estimateDataUrlSize(videoData);
	const currentSize = await getTotalStorageSize();
	let cleanedCount = 0;
	if (currentSize + newVideoSize >= MAX_STORAGE_SIZE_MB * 1024 * 1024) {
		cleanedCount = await cleanupOldVideos(60);
		const newSize = await getTotalStorageSize();
		if (newSize + newVideoSize >= MAX_STORAGE_SIZE_MB * 1024 * 1024)
			cleanedCount += await cleanupOldVideos(40);
	}
	const video = await addVideo(duration, model, prompt, resolution, videoData);
	return { video, cleanedCount };
}
