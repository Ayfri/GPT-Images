import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageData: string;
  timestamp: number;
  model?: string;
  quality?: 'low' | 'medium' | 'high';
  size?: '1024x1024' | '1024x1536' | '1536x1024';
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
    db = await openDB<ImageDB>('gpt-image-generator', 2, {
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
      }
    });
  }
  return db;
}

export async function addImage(
  imageData: string,
  prompt: string,
  model: string = 'gpt-image-1',
  quality: 'low' | 'medium' | 'high' = 'low',
  size: '1024x1024' | '1024x1536' | '1536x1024' = '1024x1024'
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
    size
  };

  await db.add('generated-images', image);
  return id;
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
