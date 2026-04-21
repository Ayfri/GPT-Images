// Common types for image generation and editing
export type ImageModel = 'gpt-image-2' | 'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini';
export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type ImageSize =
	| 'auto'
	| '1024x1024'
	| '1024x1536'
	| '1536x1024'
	| '2048x2048'
	| '2048x1152'
	| '3840x2160'
	| '2160x3840';
export type PricedImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type InputFidelity = 'low' | 'high';
export type OutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageModeration = 'auto' | 'low';


export const MODEL_OPTIONS = {
	'gpt-image-2': { label: 'GPT Image 2', description: 'Highest quality with flexible sizing' },
	'gpt-image-1.5': { label: 'GPT Image 1.5', description: 'Latest previous-generation model' },
	'gpt-image-1': { label: 'GPT Image 1', description: 'High quality images' },
	'gpt-image-1-mini': { label: 'GPT Image 1 Mini', description: 'Fast and cost-effective' }
} as const;

export const QUALITY_OPTIONS = {
	low: { label: 'Low', apiValue: 'low' },
	medium: { label: 'Medium', apiValue: 'medium' },
	high: { label: 'High', apiValue: 'high' },
	auto: { label: 'Auto', apiValue: 'auto' }
} as const;

export const SIZE_OPTIONS = {
	auto: { label: 'Auto' },
	'1024x1024': { label: '1024×1024' },
	'1024x1536': { label: '1024×1536 (Portrait)' },
	'1536x1024': { label: '1536×1024 (Landscape)' },
	'2048x2048': { label: '2048×2048 (2K Square)' },
	'2048x1152': { label: '2048×1152 (2K Landscape)' },
	'3840x2160': { label: '3840×2160 (4K Landscape)' },
	'2160x3840': { label: '2160×3840 (4K Portrait)' }
} as const;

export const PRICED_SIZE_OPTIONS: Record<PricedImageSize, { label: string }> = {
	'1024x1024': { label: '1024×1024' },
	'1024x1536': { label: '1024×1536' },
	'1536x1024': { label: '1536×1024' }
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

export const MODERATION_OPTIONS = {
	auto: { label: 'Auto', description: 'Standard filtering' },
	low: { label: 'Low', description: 'Less restrictive filtering' }
} as const;

// Per-image pricing from developers.openai.com (March 2026)
// Columns: 1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape)
type PricingByQuality = Record<ImageQuality, Partial<Record<PricedImageSize, number>>>;
export const PRICING: Record<ImageModel, PricingByQuality> = {
	'gpt-image-2': {
		low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
		medium: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
		high: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
		auto: {}
	},
	'gpt-image-1.5': {
		low:    { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
		medium: { '1024x1024': 0.034, '1024x1536': 0.05,  '1536x1024': 0.05  },
		high:   { '1024x1024': 0.133, '1024x1536': 0.2,   '1536x1024': 0.2   },
		auto: {}
	},
	'gpt-image-1': {
		low:    { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
		medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
		high:   { '1024x1024': 0.167, '1024x1536': 0.25,  '1536x1024': 0.25  },
		auto: {}
	},
	'gpt-image-1-mini': {
		low:    { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
		medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
		high:   { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 },
		auto: {}
	}
};

export function getImagePrice(model: ImageModel, quality: ImageQuality, size: ImageSize): number | null {
	const table = PRICING[model]?.[quality];
	if (!table) return null;
	return (table as Partial<Record<ImageSize, number>>)[size] ?? null;
}

export const MODEL_SUPPORT = {
	'gpt-image-2': { transparentBackground: false, inputFidelityConfigurable: false },
	'gpt-image-1.5': { transparentBackground: true, inputFidelityConfigurable: true },
	'gpt-image-1': { transparentBackground: true, inputFidelityConfigurable: true },
	'gpt-image-1-mini': { transparentBackground: true, inputFidelityConfigurable: true }
} as const;

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
