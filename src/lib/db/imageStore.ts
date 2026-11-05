import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { ImagesResponse } from "openai/resources/images";
import type { ImageBackground, ImageComplexity, ImageQuality, InputFidelity, OutputFormat, StoredImageModel, StoredImageSize } from "#lib/types/image.ts";
import { OUTPUT_FORMAT_OPTIONS, getRecordPrice } from "#lib/types/image.ts";
import { clearMediaFolder, deleteMediaFile, readMediaObjectUrl, writeMediaFile } from "./opfsStore";

export interface ImageRecord {
	background?: ImageBackground;
	complexity?: ImageComplexity;
	/** Real USD cost of this image from the API usage, absent on records saved before usage tracking. */
	cost?: number;
	frame_count?: number;
	frame_duration_ms?: number;
	id: string;
	imageData: string;
	input_fidelity?: InputFidelity;
	model?: StoredImageModel;
	output_compression?: number;
	output_format?: OutputFormat;
	prompt: string;
	quality?: ImageQuality;
	size?: StoredImageSize;
	svg_usage?: ImagesResponse.SvgUsage;
	timestamp: number;
}

interface ImageDB extends DBSchema {
	"generated-images": {
		key: string;
		value: ImageRecord;
		indexes: {
			"by-timestamp": number;
		};
	};
}

let db: IDBPDatabase<ImageDB> | null = null;

export async function getDb() {
	if (!db) {
		db = await openDB<ImageDB>("gpt-image-generator", 4, {
			upgrade(db, oldVersion, newVersion, transaction) {
				if (oldVersion < 1) {
					const store = db.createObjectStore("generated-images", { keyPath: "id" });
					store.createIndex("by-timestamp", "timestamp");
				}

				if (oldVersion < 2) {
					const tx = transaction.objectStore("generated-images");
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.model) r.model = "gpt-image-1";
						if (!r.quality) r.quality = "low";
						if (!r.size) r.size = "1024x1024";
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}

				if (oldVersion < 3) {
					const tx = transaction.objectStore("generated-images");
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.input_fidelity) r.input_fidelity = "low";
						if (!r.output_compression) r.output_compression = 100;
						if (!r.output_format) r.output_format = "png";
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}

				if (oldVersion < 4) {
					const tx = transaction.objectStore("generated-images");
					tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
						if (!cursor) return;
						const r = { ...cursor.value };
						if (!r.background) r.background = "auto";
						cursor.update(r);
						return cursor.continue().then(updateRecords);
					});
				}
			},
		});
	}
	return db;
}

/** Populate imageData from OPFS for records with empty field. */
async function withImageBlobs(records: ImageRecord[]): Promise<ImageRecord[]> {
	return Promise.all(
		records.map(async (img) => {
			if (img.imageData) return img;
			const url = await readMediaObjectUrl(img.id, OUTPUT_FORMAT_OPTIONS[img.output_format ?? "png"].mime);
			return { ...img, imageData: url ?? "" };
		}),
	);
}

export async function addImage(imageData: string, meta: Omit<ImageRecord, "id" | "imageData" | "timestamp">): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();

	// Persist binary to OPFS; only metadata goes into IDB.
	await writeMediaFile(id, imageData);

	await db.add("generated-images", { ...meta, id, imageData: "", timestamp: Date.now() });
	return id;
}

export async function getImages(offset: number, limit: number): Promise<ImageRecord[]> {
	const db = await getDb();
	const index = db.transaction("generated-images", "readonly").objectStore("generated-images").index("by-timestamp");
	let cursor = await index.openCursor(null, "prev");
	if (offset > 0 && cursor) cursor = await cursor.advance(offset);
	const records: ImageRecord[] = [];
	while (cursor && records.length < limit) {
		records.push(cursor.value);
		cursor = await cursor.continue();
	}
	return withImageBlobs(records);
}

export async function countImages(): Promise<number> {
	const db = await getDb();
	return db.count("generated-images");
}

export async function getAllImages(): Promise<ImageRecord[]> {
	const db = await getDb();
	const records = await db.getAllFromIndex("generated-images", "by-timestamp");
	records.sort((a, b) => b.timestamp - a.timestamp);
	return withImageBlobs(records);
}

export async function deleteImage(id: string): Promise<void> {
	const db = await getDb();
	await Promise.all([db.delete("generated-images", id), deleteMediaFile(id)]);
}

export async function clearImages(): Promise<void> {
	const db = await getDb();
	await Promise.all([db.clear("generated-images"), clearMediaFolder()]);
}

const COST_CACHE_KEY = "gpt-image-cost-cache";
type CostCache = { totalCost: number; count: number };

export function getCostCache(): CostCache | null {
	try {
		const raw = typeof localStorage !== "undefined" ? localStorage.getItem(COST_CACHE_KEY) : null;
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function setCostCache(totalCost: number, count: number): void {
	try {
		if (typeof localStorage !== "undefined") localStorage.setItem(COST_CACHE_KEY, JSON.stringify({ totalCost, count }));
	} catch {
		/* ignore */
	}
}

export function invalidateCostCache(): void {
	try {
		if (typeof localStorage !== "undefined") localStorage.removeItem(COST_CACHE_KEY);
	} catch {
		/* ignore */
	}
}

export async function computeImageCostTotal(): Promise<number> {
	const db = await getDb();
	const store = db.transaction("generated-images", "readonly").objectStore("generated-images");
	let totalCost = 0;
	let cursor = await store.openCursor();
	while (cursor) {
		totalCost += getRecordPrice(cursor.value);
		cursor = await cursor.continue();
	}
	return totalCost;
}
