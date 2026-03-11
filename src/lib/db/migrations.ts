/**
 * Versioned migration engine.
 *
 * The current schema version is persisted in a dedicated IndexedDB database
 * ("app-meta") so it is entirely separate from the data stores.
 *
 * How to add a migration:
 *   1. Write an async function that performs the work.
 *   2. Append it to MIGRATIONS with the next version number.
 *
 * Migrations run once, in order, atomically stepping the stored version after
 * each one succeeds.  runMigrations() is a singleton promise, calling it
 * concurrently is safe.
 */

import { openDB } from 'idb';
import { writeMediaFile } from './opfsStore';

async function getMetaDb() {
	return openDB('app-meta', 1, {
		upgrade(db) {
			db.createObjectStore('meta');
		}
	});
}

async function getStorageVersion(): Promise<number> {
	const db = await getMetaDb();
	return (await db.get('meta', 'version')) ?? 0;
}

async function setStorageVersion(version: number): Promise<void> {
	const db = await getMetaDb();
	await db.put('meta', version, 'version');
}

/**
 * v1: Move binary image/video blobs from IndexedDB into OPFS.
 *
 * After this migration every IDB record that previously held a data-URL in
 * `imageData` / `videoData` will have that field set to '' instead, and the
 * corresponding binary payload will live in OPFS under images/{id} or
 * videos/{id}.
 *
 * The output_format field is back-filled from the data-URL MIME type for old
 * records that were saved before that column existed.
 */
async function migration1(): Promise<void> {
	// Dynamic imports avoid a circular static dependency with the DB modules.
	const { getDb: getImageDb } = await import('./imageStore');
	const imageDb = await getImageDb();
	const images = await imageDb.getAll('generated-images');

	for (const image of images) {
		if (!image.imageData?.startsWith('data:')) continue;

		// Back-fill output_format from the data URL MIME when missing.
		if (!image.output_format) {
			const mime = image.imageData.split(';')[0].split(':')[1]; // e.g. 'image/png'
			const fmt = mime?.split('/')[1]; // 'png', 'jpeg', 'webp'
			if (fmt === 'png' || fmt === 'jpeg' || fmt === 'webp') {
				image.output_format = fmt;
			}
		}

		await writeMediaFile('images', image.id, image.imageData);
		await imageDb.put('generated-images', { ...image, imageData: '' });
	}

	const { getDb: getVideoDb } = await import('./videoStore');
	const videoDb = await getVideoDb();
	const videos = await videoDb.getAll('generated-videos');

	for (const video of videos) {
		if (!video.videoData?.startsWith('data:')) continue;
		await writeMediaFile('videos', video.id, video.videoData);
		await videoDb.put('generated-videos', { ...video, videoData: '' });
	}
}

type Migration = {
	name: string;
	run: () => Promise<void>;
	version: number;
};

const MIGRATIONS: Migration[] = [
	{ name: 'Move blobs from IDB to OPFS', run: migration1, version: 1 }
];

async function _runMigrations(): Promise<void> {
	if (typeof navigator === 'undefined' || !('storage' in navigator)) return;

	const currentVersion = await getStorageVersion();
	const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

	for (const migration of pending) {
		console.log(`[migrations] Running v${migration.version}: ${migration.name}`);
		await migration.run();
		await setStorageVersion(migration.version);
		console.log(`[migrations] v${migration.version} complete`);
	}
}

let migrationPromise: Promise<void> | null = null;

/**
 * Run all pending migrations exactly once per page load.
 * Safe to call from multiple places, subsequent calls return the same promise.
 */
export function runMigrations(): Promise<void> {
	if (!migrationPromise) migrationPromise = _runMigrations();
	return migrationPromise;
}
