import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
import { calculateVideoPrice } from '$lib/utils/videoPrice';
import { clearMediaFolder, deleteMediaFile, getMediaFileSize, getTotalFolderSize, readMediaObjectUrl, revokeMediaObjectUrl, writeMediaFile } from './opfsStore';

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

/** Populate videoData from OPFS for records that have an empty field. */
async function withVideoBlobs(records: GeneratedVideo[]): Promise<GeneratedVideo[]> {
	return Promise.all(
		records.map(async (vid) => {
			if (vid.videoData) return vid;
			const url = await readMediaObjectUrl('videos', vid.id);
			return { ...vid, videoData: url ?? '' };
		})
	);
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

	// Persist binary to OPFS; only metadata goes into IDB.
	await writeMediaFile('videos', video.id, videoData);
	await db.add('generated-videos', { ...video, videoData: '' });

	// Return the full record (with videoData) so the caller can display it immediately.
	return video;
}

export async function getVideos(limit: number, offset: number): Promise<GeneratedVideo[]> {
	const db = await getDb();
	const index = db.transaction('generated-videos', 'readonly').objectStore('generated-videos').index('by-timestamp');
	let cursor = await index.openCursor(null, 'prev');
	if (offset > 0 && cursor) cursor = await cursor.advance(offset);
	const records: GeneratedVideo[] = [];
	while (cursor && records.length < limit) {
		records.push(cursor.value);
		cursor = await cursor.continue();
	}
	return withVideoBlobs(records);
}

export async function countVideos(): Promise<number> {
	const db = await getDb();
	return db.count('generated-videos');
}

export async function getAllVideos(): Promise<GeneratedVideo[]> {
	const db = await getDb();
	const records = await db.getAllFromIndex('generated-videos', 'by-timestamp');
	records.sort((a, b) => b.timestamp - a.timestamp);
	return withVideoBlobs(records);
}

/** Returns all video records without blobs — used internally for metadata-only operations. */
async function getAllVideosMeta(): Promise<GeneratedVideo[]> {
	const db = await getDb();
	const records = await db.getAllFromIndex('generated-videos', 'by-timestamp');
	records.sort((a, b) => b.timestamp - a.timestamp);
	return records;
}

export async function deleteVideo(id: string): Promise<void> {
	const db = await getDb();
	await Promise.all([
		db.delete('generated-videos', id),
		deleteMediaFile('videos', id)
	]);
	revokeMediaObjectUrl('videos', id);
}

export async function clearVideos(): Promise<void> {
	const db = await getDb();
	await Promise.all([
		db.clear('generated-videos'),
		clearMediaFolder('videos')
	]);
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

export async function getTotalStorageSize(): Promise<number> {
	return getTotalFolderSize('videos');
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
	const videos = await getAllVideosMeta();
	const targetSizeBytes = targetSizeMB * 1024 * 1024;
	let currentSize = await getTotalStorageSize();
	let deletedCount = 0;
	for (let i = videos.length - 1; i >= 0 && currentSize > targetSizeBytes; i--) {
		const video = videos[i];
		const videoSize = await getMediaFileSize('videos', video.id);
		await db.delete('generated-videos', video.id);
		await deleteMediaFile('videos', video.id);
		currentSize -= videoSize;
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
	// Estimate the incoming video's binary size from the base64 payload.
	const base64 = videoData.split(',')[1] ?? '';
	const newVideoSize = Math.ceil((base64.length * 3) / 4);
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
