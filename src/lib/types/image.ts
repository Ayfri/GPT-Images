// Common types for image generation and editing
export type ImageModel = 'gpt-image-1' | 'gpt-image-1-mini';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type InputFidelity = 'low' | 'high';
export type OutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';


export const MODEL_OPTIONS = {
	'gpt-image-1': { label: 'GPT Image 1', description: 'High quality images' },
	'gpt-image-1-mini': { label: 'GPT Image 1 Mini', description: 'Fast and cost-effective' }
} as const;

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

export const INPUT_FIDELITY_OPTIONS = {
	low: { label: 'Low', description: 'Faster editing, less strict matching' },
	high: { label: 'High', description: 'Better matching of style and facial features (editing only)' }
} as const;

export const OUTPUT_FORMAT_OPTIONS = {
	png: { label: 'PNG', description: 'Lossless, larger file size' },
	jpeg: { label: 'JPEG', description: 'Lossy, smaller file size' },
	webp: { label: 'WebP', description: 'Modern format, good compression' }
} as const;

export const BACKGROUND_OPTIONS = {
	auto: { label: 'Auto', description: 'Model automatically determines the best background' },
	opaque: { label: 'Opaque', description: 'Ensures a solid background' },
	transparent: { label: 'Transparent', description: 'Generates image with transparent background (PNG/WebP only)' }
} as const;

// Token counts per image based on size and quality
const TOKEN_COUNTS: Record<ImageQuality, Record<ImageSize, number>> = {
	low: { '1024x1024': 272, '1024x1536': 408, '1536x1024': 400 },
	medium: { '1024x1024': 1056, '1024x1536': 1584, '1536x1024': 1568 },
	high: { '1024x1024': 4160, '1024x1536': 6240, '1536x1024': 6208 }
};

// Cost per 1M output tokens
const COST_PER_MILLION_TOKENS = {
	'gpt-image-1': 40.00,
	'gpt-image-1-mini': 8.00
};

// Calculate pricing based on token counts and cost per million tokens
export const PRICING: Record<ImageModel, Record<ImageQuality, Record<ImageSize, number>>> = {
	'gpt-image-1': {
		low: { '1024x1024': 0.01088, '1024x1536': 0.01632, '1536x1024': 0.016 },
		medium: { '1024x1024': 0.04224, '1024x1536': 0.06336, '1536x1024': 0.06272 },
		high: { '1024x1024': 0.1664, '1024x1536': 0.2496, '1536x1024': 0.24832 }
	},
	'gpt-image-1-mini': {
		low: { '1024x1024': 0.002176, '1024x1536': 0.003264, '1536x1024': 0.0032 },
		medium: { '1024x1024': 0.008448, '1024x1536': 0.012672, '1536x1024': 0.012544 },
		high: { '1024x1024': 0.03328, '1024x1536': 0.04992, '1536x1024': 0.049664 }
	}
};

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
