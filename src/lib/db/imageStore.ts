import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { ImageQuality, ImageSize, InputFidelity, OutputFormat, ImageBackground } from '$lib/types/image';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageData: string;
  timestamp: number;
  model?: string;
  quality?: ImageQuality;
  size?: ImageSize;
  input_fidelity?: InputFidelity;
  output_compression?: number;
  output_format?: OutputFormat;
  background?: ImageBackground;
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
          // First time setup
          const store = db.createObjectStore('generated-images', {
            keyPath: 'id'
          });
          store.createIndex('by-timestamp', 'timestamp');
        }

        // Migrate from version 1 to 2 to add new fields
        if (oldVersion < 2) {
          // Get all existing records
          const tx = transaction.objectStore('generated-images');
          tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
            if (!cursor) return;

            // Add new fields to existing records
            const updatedRecord = { ...cursor.value };
            if (!updatedRecord.model) updatedRecord.model = 'gpt-image-1';
            if (!updatedRecord.quality) updatedRecord.quality = 'low';
            if (!updatedRecord.size) updatedRecord.size = '1024x1024';

            cursor.update(updatedRecord);
            return cursor.continue().then(updateRecords);
          });
        }

        // Migrate from version 2 to 3 to add advanced options
        if (oldVersion < 3) {
          const tx = transaction.objectStore('generated-images');
          tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
            if (!cursor) return;

            // Add new advanced options fields to existing records
            const updatedRecord = { ...cursor.value };
            if (!updatedRecord.input_fidelity) updatedRecord.input_fidelity = 'low';
            if (!updatedRecord.output_compression) updatedRecord.output_compression = 100;
            if (!updatedRecord.output_format) updatedRecord.output_format = 'png';

            cursor.update(updatedRecord);
            return cursor.continue().then(updateRecords);
          });
        }

        // Migrate from version 3 to 4 to add background option
        if (oldVersion < 4) {
          const tx = transaction.objectStore('generated-images');
          tx.openCursor().then(function updateRecords(cursor): Promise<void> | void {
            if (!cursor) return;

            const updatedRecord = { ...cursor.value };
            if (!updatedRecord.background) updatedRecord.background = 'auto';

            cursor.update(updatedRecord);
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
  model: string = 'gpt-image-1',
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

export async function getImages(
  offset: number,
  limit: number
): Promise<GeneratedImage[]> {
  const db = await getDb();
  const tx = db.transaction('generated-images', 'readonly');
  const store = tx.objectStore('generated-images');
  const index = store.index('by-timestamp');

  const images: GeneratedImage[] = [];
  let cursor = await index.openCursor(null, 'prev'); // 'prev' for newest first
  let i = 0;

  while (cursor && images.length < limit) {
    if (i >= offset) {
      images.push(cursor.value);
    }
    cursor = await cursor.continue();
    i++;
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
