// Common types for image generation and editing
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface ImageGenerationParams {
	prompt: string;
	quality: ImageQuality;
	size: ImageSize;
	n: number;
}

export interface ImageEditParams {
	images: File[];
	prompt: string;
	quality: ImageQuality;
	size: ImageSize;
	n: number;
}

export const QUALITY_OPTIONS = {
	low: { label: 'Low', apiValue: 'low' },
	medium: { label: 'Medium', apiValue: 'medium' },
	high: { label: 'High', apiValue: 'high' }
} as const;

export const SIZE_OPTIONS = {
	'1024x1024': { label: '1024×1024' },
	'1024x1536': { label: '1024×1536 (Portrait)' },
	'1536x1024': { label: '1536×1024 (Landscape)' }
} as const;

export const PRICING: Record<ImageQuality, Record<ImageSize, number>> = {
	low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
	medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
	high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 }
};

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg'
} as const;
