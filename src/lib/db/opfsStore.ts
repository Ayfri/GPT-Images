/**
 * OPFS (Origin Private File System) helpers for storing binary media files.
 *
 * Layout inside the origin's private storage root:
 *   images/{uuid}   ← raw image bytes (PNG / JPEG / WebP)
 *   videos/{uuid}   ← raw video bytes (MP4)
 *
 * All public functions are no-ops when the OPFS API is unavailable (SSR / old browsers).
 */

function isOpfsAvailable(): boolean {
	return typeof navigator !== 'undefined' && 'storage' in navigator;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array<ArrayBuffer> {
	const base64 = dataUrl.split(',')[1];
	const binaryString = atob(base64);
	const buffer = new ArrayBuffer(binaryString.length);
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
	// Process in chunks to avoid maximum call stack size exceeded with large files
	const CHUNK = 0x8000;
	const chunks: string[] = [];
	for (let i = 0; i < bytes.length; i += CHUNK) {
		chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
	}
	return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

async function getMediaDir(folder: 'images' | 'videos'): Promise<FileSystemDirectoryHandle> {
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle(folder, { create: true });
}

export async function writeMediaFile(
	folder: 'images' | 'videos',
	id: string,
	dataUrl: string
): Promise<void> {
	if (!isOpfsAvailable()) return;
	const dir = await getMediaDir(folder);
	const fileHandle = await dir.getFileHandle(id, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(new Blob([dataUrlToUint8Array(dataUrl)]));
	await writable.close();
}

export async function readMediaFile(
	folder: 'images' | 'videos',
	id: string,
	mimeType: string
): Promise<string | null> {
	if (!isOpfsAvailable()) return null;
	try {
		const dir = await getMediaDir(folder);
		const fileHandle = await dir.getFileHandle(id);
		const file = await fileHandle.getFile();
		const buffer = await file.arrayBuffer();
		return uint8ArrayToDataUrl(new Uint8Array(buffer), mimeType);
	} catch {
		return null;
	}
}

export async function deleteMediaFile(
	folder: 'images' | 'videos',
	id: string
): Promise<void> {
	if (!isOpfsAvailable()) return;
	try {
		const dir = await getMediaDir(folder);
		await dir.removeEntry(id);
	} catch { /* not found, ignore */ }
}

export async function clearMediaFolder(folder: 'images' | 'videos'): Promise<void> {
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

        for await (const handle of dir.values()) {
            if (handle.kind === 'file') {
                const file = await (handle as FileSystemFileHandle).getFile();
                total += file.size;
            }
        }
        return total;
    } catch {
        return 0;
    }
}
