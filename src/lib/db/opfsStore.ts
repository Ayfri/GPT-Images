/** OPFS image files, with one blob: URL per file cached so a file is read once and never goes through base64. */
class MediaFiles {
	#dir?: Promise<FileSystemDirectoryHandle>;
	/** The promise is cached so concurrent reads from cards and the lightbox share one OPFS read. */
	#urls = new Map<string, Promise<string | null>>();

	#root() {
		return (this.#dir ??= navigator.storage.getDirectory().then((root) => root.getDirectoryHandle('images', { create: true })));
	}

	async #read(id: string, type: string) {
		try {
			const file = await (await (await this.#root()).getFileHandle(id)).getFile();
			/** OPFS files carry no MIME type and browsers never sniff SVG, so the blob gets the record's type back. */
			return URL.createObjectURL(new Blob([file], { type }));
		} catch {
			return null;
		}
	}

	async write(id: string, blob: Blob) {
		/** The object URL is cached before the OPFS write so the next read is a cache hit. */
		this.#urls.set(id, Promise.resolve(URL.createObjectURL(blob)));
		const handle = await (await this.#root()).getFileHandle(id, { create: true });
		await blob.stream().pipeTo(await handle.createWritable());
	}

	url(id: string, type: string) {
		let url = this.#urls.get(id);
		if (!url) this.#urls.set(id, (url = this.#read(id, type)));
		return url;
	}

	async remove(id: string) {
		const url = await this.#urls.get(id);
		if (url) URL.revokeObjectURL(url);
		this.#urls.delete(id);
		try {
			await (await this.#root()).removeEntry(id);
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
		}
	}
}

export const mediaFiles = new MediaFiles();
