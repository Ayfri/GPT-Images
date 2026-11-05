/**
 * OPFS helpers for storing binary media.
 * Caches blob: URLs to avoid repeated OPFS reads and base64 overhead.
 */

const FOLDER = 'images';
const objectUrlCache = new Map<string, string>();
let dirHandle: FileSystemDirectoryHandle | null = null;

function isOpfsAvailable(): boolean {
	return typeof navigator !== 'undefined' && 'storage' in navigator;
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

async function getMediaDir(): Promise<FileSystemDirectoryHandle> {
	if (dirHandle) return dirHandle;
	const root = await navigator.storage.getDirectory();
	dirHandle = await root.getDirectoryHandle(FOLDER, { create: true });
	return dirHandle;
}

/**
 * Write data URL to OPFS and cache a blob: URL for instant reads.
 */
export async function writeMediaFile(id: string, dataUrl: string): Promise<void> {
	if (!isOpfsAvailable()) return;
	const blob = dataUrlToBlob(dataUrl);

	/** The object URL is cached before the OPFS write so the next read is a cache hit. */
	const existing = objectUrlCache.get(id);
	if (existing) URL.revokeObjectURL(existing);
	objectUrlCache.set(id, URL.createObjectURL(blob));

	const dir = await getMediaDir();
	const fileHandle = await dir.getFileHandle(id, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(blob);
	await writable.close();
}

/**
 * Return cached blob: URL for the file. First call reads from OPFS and caches.
 * Prefer over data URLs, no base64 overhead.
 */
export async function readMediaObjectUrl(id: string, type: string): Promise<string | null> {
	if (!isOpfsAvailable()) return null;
	const cached = objectUrlCache.get(id);
	if (cached) return cached;
	try {
		const dir = await getMediaDir();
		const fileHandle = await dir.getFileHandle(id);
		const file = await fileHandle.getFile();
		/** OPFS files carry no MIME type and browsers never sniff SVG, so the blob gets the record's type back. */
		const url = URL.createObjectURL(new Blob([file], { type }));
		objectUrlCache.set(id, url);
		return url;
	} catch {
		return null;
	}
}

export async function deleteMediaFile(id: string): Promise<void> {
	const url = objectUrlCache.get(id);
	if (url) {
		URL.revokeObjectURL(url);
		objectUrlCache.delete(id);
	}
	if (!isOpfsAvailable()) return;
	try {
		const dir = await getMediaDir();
		await dir.removeEntry(id);
	} catch { /* not found */ }
}

export async function clearMediaFolder(): Promise<void> {
	for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
	objectUrlCache.clear();
	dirHandle = null;
	if (!isOpfsAvailable()) return;
	try {
		const root = await navigator.storage.getDirectory();
		await root.removeEntry(FOLDER, { recursive: true });
	} catch { /* ignore */ }
}
