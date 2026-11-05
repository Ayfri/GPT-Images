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
		const writes = await Promise.allSettled(records.map((record, index) => mediaFiles.write(record.id, blobs[index])));
		for (const write of writes) if (write.status === 'rejected') console.error('Failed to write an image file:', write.reason);
		let saved = records.filter((_, index) => writes[index].status === 'fulfilled');
		/** The images are already paid for: whatever can be saved is kept, and the caller is told how many were lost. Best-effort removal keeps failed writes from leaving orphan files. */
		await Promise.allSettled(records.filter((record) => !saved.includes(record)).map(({ id }) => mediaFiles.remove(id)));

		try {
			const tx = (await getDb()).transaction(STORE, 'readwrite');
			await Promise.all([...saved.map((record) => tx.store.add(record)), tx.done]);
		} catch (error) {
			console.error('Failed to save image records:', error);
			await Promise.allSettled(saved.map(({ id }) => mediaFiles.remove(id)));
			saved = [];
		}

		this.images = [...saved.toReversed(), ...this.images];
		if (saved.length < records.length) throw new Error(`${records.length - saved.length} of ${records.length} images could not be saved to this browser's storage.`);
	};

	/** The record goes first so the card never outlives a removed file, and a leftover file is only wasted space. */
	remove = async (image: ImageRecord) => {
		await (await getDb()).delete(STORE, image.id);
		this.images = this.images.filter(({ id }) => id !== image.id);
		await mediaFiles.remove(image.id).catch((error: unknown) => console.error('Failed to delete an image file:', error));
	};

	/** Legacy records keep their inline data URL until migration 1 succeeds. */
	url = (image: ImageRecord) =>
		image.imageData ? Promise.resolve(image.imageData) : mediaFiles.url(image.id, OUTPUT_FORMAT_OPTIONS[image.output_format ?? 'png'].mime);
}

export const gallery = new Gallery();
