import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageData: string;
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
    db = await openDB<ImageDB>('gpt-image-generator', 1, {
      upgrade(db) {
        const store = db.createObjectStore('generated-images', {
          keyPath: 'id'
        });
        store.createIndex('by-timestamp', 'timestamp');
      }
    });
  }
  return db;
}

export async function addImage(imageData: string, prompt: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  
  const image: GeneratedImage = {
    id,
    prompt,
    imageData,
    timestamp: Date.now()
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