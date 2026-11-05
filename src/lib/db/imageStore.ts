import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { ImagesResponse } from 'openai/resources/images';
import type { ImageBackground, ImageComplexity, ImageQuality, InputFidelity, OutputFormat, StoredImageModel, StoredImageSize } from '#lib/types/image.ts';

export const STORE = 'generated-images';

export interface ImageRecord {
	background?: ImageBackground;
	complexity?: ImageComplexity;
	/** Real USD cost of this image from the API usage, absent on records saved before usage tracking. */
	cost?: number;
	frame_count?: number;
	frame_duration_ms?: number;
	id: string;
	/** Inline data URL of records saved before OPFS storage, emptied by migration 1. */
	imageData?: string;
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

export type NewImage = Omit<ImageRecord, 'id' | 'imageData' | 'timestamp'>;

interface ImageDB extends DBSchema {
	[STORE]: {
		key: string;
		value: ImageRecord;
		indexes: {
			'by-timestamp': number;
		};
	};
}

let db: Promise<IDBPDatabase<ImageDB>> | undefined;

export const getDb = () =>
	(db ??= openDB<ImageDB>('gpt-image-generator', 4, {
		async upgrade(db, oldVersion, _newVersion, transaction) {
			if (oldVersion < 1) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('by-timestamp', 'timestamp');

			/** One cursor fills every missing default: separate cursors per version read each record before the others' updates and overwrite them. */
			for (let cursor = oldVersion ? await transaction.objectStore(STORE).openCursor() : null; cursor; cursor = await cursor.continue()) {
				const record = cursor.value;
				if (oldVersion < 2) {
					record.model ||= 'gpt-image-1';
					record.quality ||= 'low';
					record.size ||= '1024x1024';
				}
				if (oldVersion < 3) {
					record.input_fidelity ||= 'low';
					record.output_compression ||= 100;
					record.output_format ||= 'png';
				}
				record.background ||= 'auto';
				await cursor.update(record);
			}
		}
	}));
