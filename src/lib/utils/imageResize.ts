export async function resizeImageToResolution(
	file: File | string,
	targetResolution: string
): Promise<File> {
	const [targetWidth, targetHeight] = targetResolution.split('x').map(Number);

	// Create an image element
	const img = new Image();
	const imageUrl = typeof file === 'string' ? file : URL.createObjectURL(file);

	return new Promise((resolve, reject) => {
		img.onload = () => {
			// Clean up object URL if it was created
			if (typeof file !== 'string') {
				URL.revokeObjectURL(imageUrl);
			}

			// Create canvas with target dimensions
			const canvas = document.createElement('canvas');
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			// Fill with black background
			ctx.fillStyle = '#000000';
			ctx.fillRect(0, 0, targetWidth, targetHeight);

			// Calculate scale to fit image while maintaining aspect ratio
			const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
			const scaledWidth = img.width * scale;
			const scaledHeight = img.height * scale;

			// Center the image
			const x = (targetWidth - scaledWidth) / 2;
			const y = (targetHeight - scaledHeight) / 2;

			// Draw the image
			ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

			// Convert canvas to blob
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Failed to create blob'));
						return;
					}

					// Create a new File from the blob
					const fileName = typeof file === 'string' ? 'pasted-image.jpg' : file.name;
					const resizedFile = new File([blob], fileName, { type: 'image/jpeg' });
					resolve(resizedFile);
				},
				'image/jpeg',
				0.95
			);
		};

		img.onerror = () => {
			if (typeof file !== 'string') {
				URL.revokeObjectURL(imageUrl);
			}
			reject(new Error('Failed to load image'));
		};

		img.src = imageUrl;
	});
}
