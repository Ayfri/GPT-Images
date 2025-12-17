import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';

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
			upgrade(db, oldVersion, newVersion, transaction) {
				if (oldVersion < 1) {
					// First time setup
					const store = db.createObjectStore('generated-videos', {
						keyPath: 'id'
					});
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

export async function getVideos(
	limit: number,
	offset: number
): Promise<GeneratedVideo[]> {
	const db = await getDb();
	const tx = db.transaction('generated-videos', 'readonly');
	const store = tx.objectStore('generated-videos');
	const index = store.index('by-timestamp');

	const videos: GeneratedVideo[] = [];
	let cursor = await index.openCursor(null, 'prev'); // 'prev' for newest first
	let i = 0;

	while (cursor && videos.length < limit) {
		if (i >= offset) {
			videos.push(cursor.value);
		}
		cursor = await cursor.continue();
		i++;
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

// Storage management constants
const MAX_STORAGE_SIZE_MB = 100;
const STORAGE_WARNING_THRESHOLD_MB = 80; // Warn when approaching 80MB

/**
 * Estimate the size of a base64 data URL in bytes
 */
function estimateDataUrlSize(dataUrl: string): number {
	// Remove the data URL prefix (e.g., "data:video/mp4;base64,")
	const base64Data = dataUrl.split(',')[1];
	if (!base64Data) return 0;

	// Base64 encodes 3 bytes as 4 characters, so size is approximately (length * 3) / 4
	return Math.ceil((base64Data.length * 3) / 4);
}

/**
 * Calculate total storage size of all videos in bytes
 */
export async function getTotalStorageSize(): Promise<number> {
	const videos = await getAllVideos();
	let totalSize = 0;

	for (const video of videos) {
		totalSize += estimateDataUrlSize(video.videoData);
	}

	return totalSize;
}

/**
 * Get storage size in MB
 */
export async function getStorageSizeMB(): Promise<number> {
	const bytes = await getTotalStorageSize();
	return bytes / (1024 * 1024);
}

/**
 * Check if storage is approaching the limit
 */
export async function getStorageStatus(): Promise<{
	sizeMB: number;
	isNearLimit: boolean;
	isOverLimit: boolean;
	percentage: number;
}> {
	const sizeMB = await getStorageSizeMB();
	const percentage = (sizeMB / MAX_STORAGE_SIZE_MB) * 100;

	return {
		sizeMB: Math.round(sizeMB * 100) / 100,
		isNearLimit: sizeMB >= STORAGE_WARNING_THRESHOLD_MB,
		isOverLimit: sizeMB >= MAX_STORAGE_SIZE_MB,
		percentage: Math.round(percentage * 100) / 100
	};
}

/**
 * Clean up oldest videos to free up space
 * @param targetSizeMB Target size to reach (defaults to 70MB to leave some buffer)
 */
export async function cleanupOldVideos(targetSizeMB: number = 70): Promise<number> {
	const db = await getDb();
	const videos = await getAllVideos(); // Already sorted by timestamp (newest first)
	const targetSizeBytes = targetSizeMB * 1024 * 1024;

	let currentSize = await getTotalStorageSize();
	let deletedCount = 0;

	// Start deleting from the oldest videos (end of the array)
	for (let i = videos.length - 1; i >= 0 && currentSize > targetSizeBytes; i--) {
		const video = videos[i];
		const videoSize = estimateDataUrlSize(video.videoData);

		await db.delete('generated-videos', video.id);
		currentSize -= videoSize;
		deletedCount++;
	}

	return deletedCount;
}

/**
 * Add video with automatic cleanup if storage limit is exceeded
 */
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

	// Check if adding this video would exceed the limit
	if (currentSize + newVideoSize >= MAX_STORAGE_SIZE_MB * 1024 * 1024) {
		// Clean up old videos first, targeting 60MB to leave room for the new video
		cleanedCount = await cleanupOldVideos(60);

		// If cleanup wasn't enough, clean up more aggressively
		const newSize = await getTotalStorageSize();
		if (newSize + newVideoSize >= MAX_STORAGE_SIZE_MB * 1024 * 1024) {
			cleanedCount += await cleanupOldVideos(40);
		}
	}

	// Add the new video and return it
	const video = await addVideo(duration, model, prompt, resolution, videoData);
	return { video, cleanedCount };
}
