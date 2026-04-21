// Common types for image generation and editing
export type ImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5';
export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type InputFidelity = 'low' | 'high';
export type OutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';


export const MODEL_OPTIONS = {
	'gpt-image-1.5': { label: 'GPT Image 2', description: 'Latest model with improved quality and prompt adherence' },
	'gpt-image-1': { label: 'GPT Image 1', description: 'Previous generation model' },
	'gpt-image-1-mini': { label: 'GPT Image 1 Mini', description: 'Cost-efficient previous generation model' }
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

// Per-image pricing from developers.openai.com (March 2026)
// Columns: 1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape)
export const PRICING: Record<ImageModel, Record<ImageQuality, Record<ImageSize, number>>> = {
	'gpt-image-1.5': {
		low:    { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
		medium: { '1024x1024': 0.034, '1024x1536': 0.05,  '1536x1024': 0.05  },
		high:   { '1024x1024': 0.133, '1024x1536': 0.2,   '1536x1024': 0.2   }
	},
	'gpt-image-1': {
		low:    { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
		medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
		high:   { '1024x1024': 0.167, '1024x1536': 0.25,  '1536x1024': 0.25  }
	},
	'gpt-image-1-mini': {
		low:    { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
		medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
		high:   { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 }
	}
};

// GPT Image model specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
