type Folder = 'images' | 'thumbs';

const FOLDERS: readonly Folder[] = ['images', 'thumbs'];
const THUMB_TYPE = 'image/webp';
/** Multi-column cards are square object-cover, 190-300 CSS px wide (~600 device px at DPR 2): the short side is 640. Phones get the original. */
export const THUMB_SHORT_SIDE = 640;
/** A decoded 4K bitmap is ~33 MB: two at a time keep the peak low while the second still hides the encode latency of the first. */
const MAX_THUMB_JOBS = 2;

/** OPFS image files and their grid thumbnails, with one blob: URL per file cached so a file is read once and never goes through base64. */
class MediaFiles {
	/** Background thumbnail builds, so remove() can wait for the one of its image. */
	#builds = new Map<string, Promise<void>>();
	#dirs = new Map<Folder, Promise<FileSystemDirectoryHandle>>();
	#jobs = 0;
	#queue: (() => void)[] = [];
	/** The promises are cached so concurrent reads from cards and the lightbox share one OPFS read. */
	#thumbs = new Map<string, Promise<string | null>>();
	#urls = new Map<string, Promise<string | null>>();

	#folder(name: Folder) {
		let dir = this.#dirs.get(name);
		if (!dir) {
			/** A failed lookup is not cached, so the next call retries instead of replaying the same rejection. */
			dir = navigator.storage
				.getDirectory()
				.then((root) => root.getDirectoryHandle(name, { create: true }))
				.catch((error: unknown) => {
					this.#dirs.delete(name);
					throw error;
				});
			this.#dirs.set(name, dir);
		}
		return dir;
	}

	async #file(folder: Folder, id: string) {
		try {
			return await (await (await this.#folder(folder)).getFileHandle(id)).getFile();
		} catch {
			return null;
		}
	}

	/** OPFS files carry no MIME type and browsers never sniff SVG, so the blob gets the record's type back. */
	#blobUrl(file: Blob, type: string) {
		return URL.createObjectURL(new Blob([file], { type }));
	}

	async #save(folder: Folder, id: string, blob: Blob) {
		const handle = await (await this.#folder(folder)).getFileHandle(id, { create: true });
		await blob.stream().pipeTo(await handle.createWritable());
	}

	/** Runs the task once fewer than MAX_THUMB_JOBS are running. A finishing job hands its slot straight to the next waiter, so the limit holds. */
	async #limited<T>(task: () => Promise<T>) {
		if (this.#jobs >= MAX_THUMB_JOBS) await new Promise<void>((resolve) => this.#queue.push(resolve));
		else this.#jobs++;
		try {
			return await task();
		} finally {
			const next = this.#queue.shift();
			if (next) next();
			else this.#jobs--;
		}
	}

	/** The full bitmap is decoded first because the resize needs the short side, which only the decoded size tells. Images already small enough are not upscaled. */
	async #encode(file: Blob) {
		const full = await createImageBitmap(file);
		let bitmap = full;
		try {
			const scale = THUMB_SHORT_SIDE / Math.min(full.width, full.height);
			if (scale < 1) {
				bitmap = await createImageBitmap(full, {
					resizeHeight: Math.round(full.height * scale),
					resizeQuality: 'high',
					resizeWidth: Math.round(full.width * scale)
				});
			}
			const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
			if (!context) throw new Error('No 2D canvas context.');
			context.drawImage(bitmap, 0, 0);
			/** Safari can't encode WebP and returns a PNG: still fine, <img> sniffs raster types. */
			return await context.canvas.convertToBlob({ quality: 0.8, type: THUMB_TYPE });
		} finally {
			full.close();
			bitmap.close();
		}
	}

	async #readUrl(id: string, type: string) {
		const file = await this.#file('images', id);
		return file && this.#blobUrl(file, type);
	}

	async #readThumb(id: string, type: string) {
		const stored = await this.#file('thumbs', id);
		if (stored) return this.#blobUrl(stored, THUMB_TYPE);

		const original = await this.#file('images', id);
		if (!original) return null;
		/**
		 * A build takes 100-200 ms per image, 2.5-9x the original's decode (measured in Chrome 157 on 1-3K PNGs), so a missing thumbnail
		 * shows the original now and is built in the background for the next visit. remove() drops the #thumbs entry then waits for the build,
		 * so a removed image is neither decoded nor left with a thumbnail file.
		 */
		const build = this.#limited(async () => {
			if (!this.#thumbs.has(id)) return;
			const thumb = await this.#encode(original);
			if (this.#thumbs.has(id)) await this.#save('thumbs', id, thumb);
		})
			.catch((error: unknown) => console.error('Failed to build a thumbnail:', error))
			.finally(() => this.#builds.delete(id));
		this.#builds.set(id, build);
		return this.url(id, type);
	}

	async write(id: string, blob: Blob) {
		/** No object URL is cached here: it would pin the whole in-memory blob for the session, so the first url() reads the disk-backed file instead. */
		await this.#save('images', id, blob);
	}

	url(id: string, type: string) {
		let url = this.#urls.get(id);
		if (!url) this.#urls.set(id, (url = this.#readUrl(id, type)));
		return url;
	}

	/** Grid thumbnail kept in OPFS. `type` is the MIME type of the original, which shows until the thumbnail exists. Null when the original is missing. */
	thumb(id: string, type: string) {
		let url = this.#thumbs.get(id);
		if (!url) this.#thumbs.set(id, (url = this.#readThumb(id, type)));
		return url;
	}

	async remove(id: string) {
		for (const url of await Promise.all([this.#urls.get(id), this.#thumbs.get(id)])) if (url) URL.revokeObjectURL(url);
		this.#urls.delete(id);
		this.#thumbs.delete(id);
		await this.#builds.get(id);
		await Promise.all(
			FOLDERS.map(async (folder) => {
				try {
					await (await this.#folder(folder)).removeEntry(id);
				} catch (error) {
					if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
				}
			})
		);
	}
}

export const mediaFiles = new MediaFiles();
