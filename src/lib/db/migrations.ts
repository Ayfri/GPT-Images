import { deleteDB, openDB } from 'idb';
import type { DBSchema } from 'idb';
import { STORE, getDb } from '#lib/db/imageStore.ts';
import { mediaFiles } from '#lib/db/opfsStore.ts';

interface MetaDB extends DBSchema {
	meta: { key: 'version'; value: number };
}

async function moveBlobsToOpfs() {
	const imageDb = await getDb();

	for (const image of await imageDb.getAll(STORE)) {
		if (!image.imageData?.startsWith('data:')) continue;
		const format = image.imageData.slice(11, image.imageData.indexOf(';'));
		if (format === 'png' || format === 'jpeg' || format === 'webp') image.output_format ??= format;
		await mediaFiles.write(image.id, await (await fetch(image.imageData)).blob());
		await imageDb.put(STORE, { ...image, imageData: '' });
	}
}

/** OpenAI retired the Videos API on 2026-09-24: the video history, its OPFS files and its settings are wiped. */
async function wipeVideoData() {
	localStorage.removeItem('video-generator-options');
	localStorage.removeItem('gpt-video-cost-cache');
	/** A tab still on the old video page blocks the deletion, which then finishes once that tab closes: resolving on blocked keeps the image page from hanging. */
	await new Promise<void>((resolve, reject) => void deleteDB('gpt-video-generator', { blocked: () => resolve() }).then(resolve, reject));
	try {
		await (await navigator.storage.getDirectory()).removeEntry('videos', { recursive: true });
	} catch (error) {
		/** No videos folder (NotFoundError) or OPFS blocked (SecurityError, Firefox private mode): there are no video files to wipe. */
		if (!(error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'SecurityError'))) throw error;
	}
}

/** Migration version = index + 1. */
const MIGRATIONS = [moveBlobsToOpfs, wipeVideoData];

async function migrate() {
	const meta = await openDB<MetaDB>('app-meta', 1, {
		upgrade: (db) => void db.createObjectStore('meta')
	});
	try {
		for (let version = ((await meta.get('meta', 'version')) ?? 0) + 1; version <= MIGRATIONS.length; version++) {
			const migration = MIGRATIONS[version - 1];
			try {
				await migration();
				await meta.put('meta', version, 'version');
			} catch (error) {
				console.error(`[migration] v${version} ${migration.name} failed:`, error);
				/** Later migrations wait for a failed one: bumping the version past it would skip it forever. */
				break;
			}
		}
	} finally {
		meta.close();
	}
}

let migrationPromise: Promise<void> | undefined;
export const runMigrations = () => (migrationPromise ??= migrate());
