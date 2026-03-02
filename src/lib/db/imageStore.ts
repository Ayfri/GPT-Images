import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground, ImageModel } from '$lib/types/image';
import { PRICING } from '$lib/types/image';

interface GeneratedImage {
	background?: ImageBackground;
	id: string;
	imageData: string;
	input_fidelity?: InputFidelity;
	model?: ImageModel;
	output_compression?: number;
	output_format?: OutputFormat;
	prompt: string;
	quality?: ImageQuality;
	size?: ImageSize;
	timestamp: number;
}

interface ImageDB extends DBSchema {
	'generated-images': {
		key: string;
		value: GeneratedImage;
		indexes: {
			'by-timestamp': number;
		};
	};
}

let db: IDBPDatabase<ImageDB> | null = null;

export async function getDb() {
	if (!db) {
		db = await openDB<ImageDB>('gpt-image-generator', 4, {
			upgrade(db, oldVersion, newVersion, transaction) {
				if (oldVersion < 1) {
					const store = db.createObjectStore('generated-images', { keyPath: 'id' });
					store.createIndex('by-timestamp', 'timestamp');
				}

				if (oldVersion < 2) {
					const tx = transaction.objectStore('generated-images');
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.model) r.model = 'gpt-image-1';
						if (!r.quality) r.quality = 'low';
						if (!r.size) r.size = '1024x1024';
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}

				if (oldVersion < 3) {
					const tx = transaction.objectStore('generated-images');
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.input_fidelity) r.input_fidelity = 'low';
						if (!r.output_compression) r.output_compression = 100;
						if (!r.output_format) r.output_format = 'png';
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}

				if (oldVersion < 4) {
					const tx = transaction.objectStore('generated-images');
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.background) r.background = 'auto';
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}
			}
		});
	}
	return db;
}

export async function addImage(
	imageData: string,
	prompt: string,
	model: ImageModel = 'gpt-image-1',
	quality: ImageQuality = 'low',
	size: ImageSize = '1024x1024',
	input_fidelity: InputFidelity = 'low',
	output_compression: number = 100,
	output_format: OutputFormat = 'png',
	background: ImageBackground = 'auto'
): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();

	const image: GeneratedImage = {
		id,
		prompt,
		imageData,
		timestamp: Date.now(),
		model,
		quality,
		size,
		input_fidelity,
		output_compression,
		output_format,
		background
	};

	await db.add('generated-images', image);
	return id;
}

export async function getImages(offset: number, limit: number): Promise<GeneratedImage[]> {
	const db = await getDb();
	const index = db.transaction('generated-images', 'readonly').objectStore('generated-images').index('by-timestamp');
	let cursor = await index.openCursor(null, 'prev');
	if (offset > 0 && cursor) cursor = await cursor.advance(offset);
	const images: GeneratedImage[] = [];
	while (cursor && images.length < limit) {
		images.push(cursor.value);
		cursor = await cursor.continue();
	}
	return images;
}

export async function countImages(): Promise<number> {
	const db = await getDb();
	return db.count('generated-images');
}

export async function getAllImages(): Promise<GeneratedImage[]> {
	const db = await getDb();
	return db.getAllFromIndex('generated-images', 'by-timestamp').then(images =>
		images.sort((a, b) => b.timestamp - a.timestamp)
	);
}

export async function deleteImage(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('generated-images', id);
}

export async function clearImages(): Promise<void> {
	const db = await getDb();
	await db.clear('generated-images');
}

const COST_CACHE_KEY = 'gpt-image-cost-cache';
type CostCache = { totalCost: number; count: number };

export function getCostCache(): CostCache | null {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(COST_CACHE_KEY) : null;
		return raw ? JSON.parse(raw) : null;
	} catch { return null; }
}

export function setCostCache(totalCost: number, count: number): void {
	try {
		if (typeof localStorage !== 'undefined')
			localStorage.setItem(COST_CACHE_KEY, JSON.stringify({ totalCost, count }));
	} catch { /* ignore */ }
}

export function invalidateCostCache(): void {
	try { if (typeof localStorage !== 'undefined') localStorage.removeItem(COST_CACHE_KEY); }
	catch { /* ignore */ }
}

export async function computeImageCostTotal(): Promise<number> {
	const db = await getDb();
	const store = db.transaction('generated-images', 'readonly').objectStore('generated-images');
	let totalCost = 0;
	let cursor = await store.openCursor();
	while (cursor) {
		const { model = 'gpt-image-1', quality, size } = cursor.value;
		const m = model as ImageModel;
		totalCost += quality && size && PRICING[m]?.[quality]?.[size] ? PRICING[m][quality][size] : 0.01;
		cursor = await cursor.continue();
	}
	return totalCost;
}
