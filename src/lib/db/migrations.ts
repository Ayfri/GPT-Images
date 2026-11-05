import { deleteDB, openDB } from 'idb';
import { getDb } from './imageStore';
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

async function migration1(): Promise<void> {
	const imageDb = await getDb();

	const images = await imageDb.getAll('generated-images');
	for (const image of images) {
		if (!image.imageData?.startsWith('data:')) continue;
		if (!image.output_format) {
			const mime = image.imageData.split(';')[0].split(':')[1];
			const fmt = mime?.split('/')[1];
			if (fmt === 'png' || fmt === 'jpeg' || fmt === 'webp') {
				image.output_format = fmt;
			}
		}
		await writeMediaFile(image.id, image.imageData);
		await imageDb.put('generated-images', { ...image, imageData: '' });
	}
}

/** OpenAI retired the Videos API on 2026-09-24: the video history, its OPFS files and its settings are wiped. */
async function migration2(): Promise<void> {
	localStorage.removeItem('video-generator-options');
	localStorage.removeItem('gpt-video-cost-cache');
	/** A tab still on the old video page blocks the deletion, which then finishes once that tab closes: resolving on blocked keeps the image page from hanging. */
	await new Promise<void>((resolve, reject) => void deleteDB('gpt-video-generator', { blocked: () => resolve() }).then(resolve, reject));
	await (await navigator.storage.getDirectory()).removeEntry('videos', { recursive: true }).catch((error: unknown) => {
		if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
	});
}

type Migration = { name: string; run: () => Promise<void>; version: number };
const MIGRATIONS: Migration[] = [
	{ name: 'Move blobs from IDB to OPFS', run: migration1, version: 1 },
	{ name: 'Wipe retired video data', run: migration2, version: 2 }
];

async function _runMigrations(): Promise<void> {
	if (typeof navigator === 'undefined' || !('storage' in navigator)) return;
	const currentVersion = await getStorageVersion();
	const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
	for (const migration of pending) {
		console.log(`[migration] v${migration.version}: ${migration.name}`);
		try {
			await migration.run();
			await setStorageVersion(migration.version);
			console.log(`[migration] v${migration.version} done`);
		} catch (err) {
			console.error(`[migration] v${migration.version} failed:`, err);
			/** Later migrations wait for a failed one: bumping the version past it would skip it forever. */
			break;
		}
	}
}

let migrationPromise: Promise<void> | null = null;
export function runMigrations(): Promise<void> {
	if (!migrationPromise) migrationPromise = _runMigrations();
	return migrationPromise;
}
