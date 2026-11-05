import type { Attachment } from 'svelte/attachments';

/** Shows a File in an <img> through a blob: URL, revoked when the file or the element goes away. */
export const fileSrc = (file: Blob): Attachment<HTMLImageElement> => (img) => {
	img.src = URL.createObjectURL(file);
	return () => URL.revokeObjectURL(img.src);
};
