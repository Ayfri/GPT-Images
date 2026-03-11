import { openDB } from 'idb';

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
	const imageDb = await (await import('./imageStore')).getDb();
	const videoDb = await (await import('./videoStore')).getDb();
	const { writeMediaFile } = await import('./opfsStore');

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
		await writeMediaFile('images', image.id, image.imageData);
		await imageDb.put('generated-images', { ...image, imageData: '' });
	}

	const videos = await videoDb.getAll('generated-videos');
	for (const video of videos) {
		if (!video.videoData?.startsWith('data:')) continue;
		await writeMediaFile('videos', video.id, video.videoData);
		await videoDb.put('generated-videos', { ...video, videoData: '' });
	}
}

type Migration = { name: string; run: () => Promise<void>; version: number };
const MIGRATIONS: Migration[] = [
	{ name: 'Move blobs from IDB to OPFS', run: migration1, version: 1 }
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
		}
	}
}

let migrationPromise: Promise<void> | null = null;
export function runMigrations(): Promise<void> {
	if (!migrationPromise) migrationPromise = _runMigrations();
	return migrationPromise;
}
