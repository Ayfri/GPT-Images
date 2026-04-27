// Common types for image generation and editing
export type ImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2';
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


/**
 * OpenAI Images API: max `prompt` length in characters.
 */
export const GPT_IMAGE_MODEL_PROMPT_MAX_CHARS = 32_000;

export const MODEL_OPTIONS = {
	'gpt-image-1': { description: 'High quality images', label: 'GPT Image 1' },
	'gpt-image-1-mini': { description: 'Fast and cost-effective', label: 'GPT Image 1 Mini' },
	'gpt-image-1.5': { description: 'Latest previous-generation model', label: 'GPT Image 1.5' },
	'gpt-image-2': { description: 'Highest quality with flexible sizing', label: 'GPT Image 2' }
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

// Per-image pricing from developers.openai.com (April 2026); `gpt-image-2` output follows $/image-output-token rules.
// Columns: 1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape)
type PricingByQuality = Record<ImageQuality, Partial<Record<PricedImageSize, number>>>;
export const PRICING: Record<ImageModel, PricingByQuality> = {
	'gpt-image-1': {
		auto: {},
		high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 },
		low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
		medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
	},
	'gpt-image-1-mini': {
		auto: {},
		high: { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 },
		low: { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
		medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
	},
	'gpt-image-1.5': {
		auto: {},
		high: { '1024x1024': 0.133, '1024x1536': 0.2, '1536x1024': 0.2 },
		low: { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
		medium: { '1024x1024': 0.034, '1024x1536': 0.05, '1536x1024': 0.05 },
	},
	'gpt-image-2': {
		auto: {},
		high: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
		low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
		medium: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
	},
};

/** Image output tokens billed at this rate for `gpt-image-2` (openai.com/api/pricing). */
export const GPT_IMAGE_2_IMAGE_OUTPUT_USD_PER_MILLION = 30;

type AspectBucket = 'landscape' | 'portrait' | 'square';

const GPT_IMAGE_2_CANONICAL_SIZES = ['1024x1024', '1024x1536', '1536x1024'] as const satisfies readonly PricedImageSize[];

/** Reference resolutions matching OpenAI's pricing table rows (image generation guide). */
const GPT_IMAGE_2_REF_PX: Record<AspectBucket, { h: number; w: number }> = {
	landscape: { h: 1024, w: 1536 },
	portrait: { h: 1536, w: 1024 },
	square: { h: 1024, w: 1024 },
};

/**
 * Baseline output token counts implied by official per-image estimates at $30 / 1M image output tokens.
 * Other resolutions are estimated by √(pixel ratio) within the nearest aspect bucket (OpenAI notes non-square
 * costs can be lower than a naive area rule).
 */
const GPT_IMAGE_2_BASELINE_OUTPUT_TOKENS: Record<
	'high' | 'low' | 'medium',
	Record<AspectBucket, number>
> = {
	high: {
		landscape: 5500,
		portrait: 5500,
		square: 211 / 0.03,
	},
	low: {
		landscape: 500 / 3,
		portrait: 500 / 3,
		square: 200,
	},
	medium: {
		landscape: 1366 + 2 / 3,
		portrait: 1366 + 2 / 3,
		square: 1766 + 2 / 3,
	},
};

function gptImage2AspectBucket(w: number, h: number): AspectBucket {
	const ar = w / h;
	const targets: { ar: number; bucket: AspectBucket }[] = [
		{ ar: 1, bucket: 'square' },
		{ ar: 1024 / 1536, bucket: 'portrait' },
		{ ar: 1536 / 1024, bucket: 'landscape' },
	];
	let best = targets[0];
	let bestDist = Math.abs(ar - best.ar);
	for (const t of targets) {
		const d = Math.abs(ar - t.ar);
		if (d < bestDist) {
			bestDist = d;
			best = t;
		}
	}
	return best.bucket;
}

function estimateGptImage2ImageOutputUsd(qualityEff: 'high' | 'low' | 'medium', sizeStr: string): number | null {
	const m = /^(\d+)x(\d+)$/.exec(sizeStr);
	if (!m) return null;
	const w = Number.parseInt(m[1], 10);
	const h = Number.parseInt(m[2], 10);
	if (w <= 0 || h <= 0) return null;

	const canonicalKey = sizeStr as PricedImageSize;
	if ((GPT_IMAGE_2_CANONICAL_SIZES as readonly string[]).includes(canonicalKey)) {
		const fixed = PRICING['gpt-image-2'][qualityEff][canonicalKey];
		if (fixed !== undefined) return fixed;
	}

	const bucket = gptImage2AspectBucket(w, h);
	const ref = GPT_IMAGE_2_REF_PX[bucket];
	const baseline = GPT_IMAGE_2_BASELINE_OUTPUT_TOKENS[qualityEff][bucket];
	const scale = Math.sqrt((w * h) / (ref.w * ref.h));
	const tokens = baseline * scale;
	return (tokens / 1_000_000) * GPT_IMAGE_2_IMAGE_OUTPUT_USD_PER_MILLION;
}

export function getImagePrice(model: ImageModel, quality: ImageQuality, size: ImageSize): number | null {
	if (model === 'gpt-image-2') {
		const qualityEff: 'high' | 'low' | 'medium' = quality === 'auto' ? 'medium' : quality;
		const sizeStr = size === 'auto' ? '1024x1024' : size;
		return estimateGptImage2ImageOutputUsd(qualityEff, sizeStr);
	}
	const table = PRICING[model]?.[quality];
	if (!table) return null;
	return (table as Partial<Record<ImageSize, number>>)[size] ?? null;
}

export const MODEL_SUPPORT = {
	'gpt-image-1': { inputFidelityConfigurable: true, transparentBackground: true },
	'gpt-image-1-mini': { inputFidelityConfigurable: true, transparentBackground: true },
	'gpt-image-1.5': { inputFidelityConfigurable: true, transparentBackground: true },
	'gpt-image-2': { inputFidelityConfigurable: false, transparentBackground: false }
} as const;

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
