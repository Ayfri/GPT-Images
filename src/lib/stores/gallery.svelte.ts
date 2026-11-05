import { STORE, getDb } from '#lib/db/imageStore.ts';
import type { ImageRecord, NewImage } from '#lib/db/imageStore.ts';
import { runMigrations } from '#lib/db/migrations.ts';
import { mediaFiles } from '#lib/db/opfsStore.ts';
import { OUTPUT_FORMAT_OPTIONS, getRecordPrice } from '#lib/types/image.ts';

class Gallery {
	/** Metadata of every image, newest first: records stay small since files live in OPFS, so sorting and totals cover the whole history. Always reassigned, never mutated. */
	images = $state.raw<ImageRecord[]>([]);
	loaded = $state(false);
	totalCost = $derived(this.images.reduce((sum, image) => sum + getRecordPrice(image), 0));

	load = async () => {
		try {
			/** Migrations move legacy inline blobs to OPFS and wipe retired video data, so they run before the first read. */
			await runMigrations();
			this.images = (await (await getDb()).getAllFromIndex(STORE, 'by-timestamp')).reverse();
		} catch (error) {
			console.error('Failed to load images from IndexedDB:', error);
		} finally {
			this.loaded = true;
		}
	};

	add = async (blobs: Blob[], meta: NewImage) => {
		/** Timestamps are one ms apart so the images of a batch keep their order when the history is read back by timestamp. */
		const timestamp = Date.now();
		const records = blobs.map((_, index): ImageRecord => ({ ...meta, id: crypto.randomUUID(), timestamp: timestamp + index }));
		await Promise.all(records.map((record, index) => mediaFiles.write(record.id, blobs[index])));
		const tx = (await getDb()).transaction(STORE, 'readwrite');
		await Promise.all([...records.map((record) => tx.store.add(record)), tx.done]);
		this.images = [...records.toReversed(), ...this.images];
	};

	remove = async (image: ImageRecord) => {
		await Promise.all([(await getDb()).delete(STORE, image.id), mediaFiles.remove(image.id)]);
		this.images = this.images.filter(({ id }) => id !== image.id);
	};

	/** Legacy records keep their inline data URL until migration 1 succeeds. */
	url = (image: ImageRecord) =>
		image.imageData ? Promise.resolve(image.imageData) : mediaFiles.url(image.id, OUTPUT_FORMAT_OPTIONS[image.output_format ?? 'png'].mime);
}

export const gallery = new Gallery();
