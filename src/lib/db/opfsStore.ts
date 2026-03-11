/**
 * OPFS helpers for storing binary media.
 * Caches blob: URLs to avoid repeated OPFS reads and base64 overhead.
 */

const objectUrlCache = new Map<string, string>();
const dirHandleCache = new Map<string, FileSystemDirectoryHandle>();

function isOpfsAvailable(): boolean {
	return typeof navigator !== 'undefined' && 'storage' in navigator;
}

function cacheKey(folder: 'images' | 'videos', id: string): string {
	return `${folder}/${id}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
	const [header, base64] = dataUrl.split(',');
	const mimeType = header.split(':')[1]?.split(';')[0] ?? 'application/octet-stream';
	const binaryString = atob(base64);
	const buffer = new ArrayBuffer(binaryString.length);
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
}

async function getMediaDir(folder: 'images' | 'videos'): Promise<FileSystemDirectoryHandle> {
	const cached = dirHandleCache.get(folder);
	if (cached) return cached;
	const root = await navigator.storage.getDirectory();
	const dir = await root.getDirectoryHandle(folder, { create: true });
	dirHandleCache.set(folder, dir);
	return dir;
}

/**
 * Write data URL to OPFS and cache a blob: URL for instant reads.
 */
export async function writeMediaFile(
	folder: 'images' | 'videos',
	id: string,
	dataUrl: string
): Promise<void> {
	if (!isOpfsAvailable()) return;
	const blob = dataUrlToBlob(dataUrl);

	// Cache an object URL immediately — the next read will be a cache hit.
	const key = cacheKey(folder, id);
	const existing = objectUrlCache.get(key);
	if (existing) URL.revokeObjectURL(existing);
	objectUrlCache.set(key, URL.createObjectURL(blob));

	const dir = await getMediaDir(folder);
	const fileHandle = await dir.getFileHandle(id, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(blob);
	await writable.close();
}

/**
 * Return cached blob: URL for the file. First call reads from OPFS and caches.
 * Prefer over data URLs — no base64 overhead.
 */
export async function readMediaObjectUrl(
	folder: 'images' | 'videos',
	id: string
): Promise<string | null> {
	if (!isOpfsAvailable()) return null;
	const key = cacheKey(folder, id);
	const cached = objectUrlCache.get(key);
	if (cached) return cached;
	try {
		const dir = await getMediaDir(folder);
		const fileHandle = await dir.getFileHandle(id);
		const file = await fileHandle.getFile();
		const url = URL.createObjectURL(file);
		objectUrlCache.set(key, url);
		return url;
	} catch {
		return null;
	}
}

/**
 * Revoke and remove cached blob: URL.
 */
export function revokeMediaObjectUrl(folder: 'images' | 'videos', id: string): void {
	const key = cacheKey(folder, id);
	const url = objectUrlCache.get(key);
	if (url) {
		URL.revokeObjectURL(url);
		objectUrlCache.delete(key);
	}
}

export async function deleteMediaFile(
	folder: 'images' | 'videos',
	id: string
): Promise<void> {
	revokeMediaObjectUrl(folder, id);
	if (!isOpfsAvailable()) return;
	try {
		const dir = await getMediaDir(folder);
		await dir.removeEntry(id);
	} catch { /* not found */ }
}

export async function clearMediaFolder(folder: 'images' | 'videos'): Promise<void> {
	const prefix = cacheKey(folder, '');
	for (const [key, url] of objectUrlCache) {
		if (key.startsWith(prefix)) {
			URL.revokeObjectURL(url);
			objectUrlCache.delete(key);
		}
	}
	dirHandleCache.delete(folder);
	if (!isOpfsAvailable()) return;
	try {
		const root = await navigator.storage.getDirectory();
		await root.removeEntry(folder, { recursive: true });
	} catch { /* ignore */ }
}

export async function getMediaFileSize(
	folder: 'images' | 'videos',
	id: string
): Promise<number> {
	if (!isOpfsAvailable()) return 0;
	try {
		const dir = await getMediaDir(folder);
		const fileHandle = await dir.getFileHandle(id);
		const file = await fileHandle.getFile();
		return file.size;
	} catch {
		return 0;
	}
}

export async function getTotalFolderSize(folder: 'images' | 'videos'): Promise<number> {
	if (!isOpfsAvailable()) return 0;
	try {
		const dir = await getMediaDir(folder);
		let total = 0;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for await (const handle of (dir as any).values()) {
			if ((handle as FileSystemHandle).kind === 'file') {
				const file = await (handle as FileSystemFileHandle).getFile();
				total += file.size;
			}
		}
		return total;
	} catch {
		return 0;
	}
}
