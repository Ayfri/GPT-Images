import { LIBRARY_STORE, STORE, dbEvents, getDb } from '#lib/db/imageStore.ts';
import type { ImageRecord, Library, NewImage } from '#lib/db/imageStore.ts';
import { runMigrations } from '#lib/db/migrations.ts';
import { mediaFiles } from '#lib/db/opfsStore.ts';
import { OUTPUT_FORMAT_OPTIONS, getRecordPrice, parseSize } from '#lib/types/image.ts';

class Gallery {
	dbState = $state<'blocked' | 'ok' | 'outdated'>('ok');
	/** Metadata of every image, newest first: records stay small since files live in OPFS, so sorting and totals cover the whole history. Always reassigned, never mutated. */
	images = $state.raw<ImageRecord[]>([]);
	/** Libraries in creation order. Always reassigned, never mutated. */
	libraries = $state.raw<Library[]>([]);
	libraryCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const { libraries = [] } of this.images) for (const id of libraries) counts.set(id, (counts.get(id) ?? 0) + 1);
		return counts;
	});
	loaded = $state(false);
	totalCost = $derived(this.images.reduce((sum, image) => sum + getRecordPrice(image), 0));
	#creating = new Map<string, Promise<Library>>();

	constructor() {
		dbEvents.addEventListener('blocked', () => (this.dbState = 'blocked'));
		dbEvents.addEventListener('outdated', () => (this.dbState = 'outdated'));
	}

	load = async () => {
		try {
			/** Migrations move legacy inline blobs to OPFS and wipe retired video data, so they run before the first read. */
			await runMigrations();
			const db = await getDb();
			if (this.dbState === 'blocked') this.dbState = 'ok';
			const [images, libraries] = await Promise.all([db.getAllFromIndex(STORE, 'by-timestamp'), db.getAll(LIBRARY_STORE)]);
			this.images = images.reverse();
			this.libraries = libraries.sort((a, b) => a.created - b.created);
		} catch (error) {
			console.error('Failed to load images from IndexedDB:', error);
		} finally {
			this.loaded = true;
		}
	};

	add = async (blobs: Blob[], meta: NewImage) => {
		/** Timestamps are one ms apart so the images of a batch keep their order when the history is read back by timestamp. */
		const timestamp = Date.now();
		/** A library can be deleted while the request runs, so only the ones that still exist are kept. */
		const { libraries, ...rest } = meta;
		const kept = libraries?.filter((id) => this.libraries.some((library) => library.id === id));
		const records = blobs.map((_, index): ImageRecord => ({ ...rest, ...(kept?.length && { libraries: kept }), id: crypto.randomUUID(), timestamp: timestamp + index }));
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

	libraryNamed = (name: string) => this.libraries.find((library) => library.name.toLowerCase() === name.trim().toLowerCase());

	/** Returns the existing library on a case-insensitive name match, so quick create is idempotent, and a double submit shares the creation still in flight. Callers skip empty names. */
	createLibrary = async (name: string): Promise<Library> => {
		const existing = this.libraryNamed(name);
		if (existing) return existing;

		const key = name.trim().toLowerCase();
		const pending = this.#creating.get(key) ?? this.#insertLibrary(name.trim()).finally(() => this.#creating.delete(key));
		this.#creating.set(key, pending);
		return pending;
	};

	async #insertLibrary(name: string) {
		const library: Library = { created: Date.now(), id: crypto.randomUUID(), name };
		await (await getDb()).put(LIBRARY_STORE, library);
		this.libraries = [...this.libraries, library];
		return library;
	}

	renameLibrary = async (id: string, name: string) => {
		const library = this.libraries.find((entry) => entry.id === id);
		if (!library) return;

		const renamed = { ...library, name: name.trim() };
		await (await getDb()).put(LIBRARY_STORE, renamed);
		this.libraries = this.libraries.map((entry) => (entry.id === id ? renamed : entry));
	};

	/** Replaces the libraries of an image. Ids of deleted libraries are dropped and the rest follow the library order. Read and write share one transaction so concurrent writes can't overwrite each other. */
	setLibraries = async (imageId: string, libraryIds: string[]) => {
		const libraries = this.libraries.filter(({ id }) => libraryIds.includes(id)).map(({ id }) => id);
		const tx = (await getDb()).transaction(STORE, 'readwrite');
		const record = await tx.store.get(imageId);
		if (!record) return;

		const next = { ...record, libraries };
		await Promise.all([tx.store.put(next), tx.done]);
		this.images = this.images.map((image) => (image.id === imageId ? next : image));
	};

	/** Images stay in the history, only their membership goes. Records are read inside the transaction so a concurrent membership write isn't overwritten. */
	deleteLibrary = async (libraryId: string) => {
		const tx = (await getDb()).transaction([STORE, LIBRARY_STORE], 'readwrite');
		const updated = new Map<string, ImageRecord>();
		const members = this.images.filter((image) => image.libraries?.includes(libraryId));
		await Promise.all([
			...members.map(async ({ id }) => {
				const record = await tx.objectStore(STORE).get(id);
				if (!record) return;
				const next = { ...record, libraries: record.libraries?.filter((memberOf) => memberOf !== libraryId) };
				await tx.objectStore(STORE).put(next);
				updated.set(id, next);
			}),
			tx.objectStore(LIBRARY_STORE).delete(libraryId),
			tx.done
		]);

		this.images = this.images.map((image) => updated.get(image.id) ?? image);
		this.libraries = this.libraries.filter(({ id }) => id !== libraryId);
	};

	/** Legacy records keep their inline data URL until migration 1 succeeds. */
	url = (image: ImageRecord) =>
		image.imageData ? Promise.resolve(image.imageData) : mediaFiles.url(image.id, OUTPUT_FORMAT_OPTIONS[image.output_format ?? 'png'].mime);

	/**
	 * Grid and lightbox placeholder. GIF stays animated and SVG is vector, so both use the original. Images with a short side of 768 px or less
	 * are about the thumbnail size already, so building one saves nothing. Sizes that don't parse (`auto`) get a thumbnail.
	 */
	thumbUrl = (image: ImageRecord) => {
		const size = parseSize(image.size);
		if (image.imageData || image.output_format === 'gif' || image.output_format === 'svg' || (size && Math.min(size.width, size.height) <= 768)) return this.url(image);
		return mediaFiles.thumb(image.id, OUTPUT_FORMAT_OPTIONS[image.output_format ?? 'png'].mime);
	};
}

export const gallery = new Gallery();
