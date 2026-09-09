// Common types for image generation and editing
export type ImageModel =
	| 'gpt-image-1'
	| 'gpt-image-1-mini'
	| 'gpt-image-1.5'
	| 'gpt-image-2'
	| 'gpt-image-2.5-flare'
	| 'gpt-image-2.5-sunburst';
export type ImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';
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

/**
 * OpenAI shuts down `gpt-image-1-mini`, `gpt-image-1.5` and `chatgpt-image-latest` on this date; `gpt-image-2` replaces them.
 */
export const LEGACY_IMAGE_MODEL_SHUTDOWN_DATE = '2026-12-01';

/** Snapshot both GPT Image 2.5 aliases resolve to. */
export const GPT_IMAGE_2_5_SNAPSHOT = '2026-09-08';

export const MODEL_OPTIONS = {
	'gpt-image-1': { deprecated: false, description: 'High quality images', label: 'GPT Image 1' },
	'gpt-image-1-mini': { deprecated: true, description: 'Fast and cost-effective', label: 'GPT Image 1 Mini' },
	'gpt-image-1.5': { deprecated: true, description: 'Previous generation', label: 'GPT Image 1.5' },
	'gpt-image-2': { deprecated: false, description: 'Highest quality with flexible sizing', label: 'GPT Image 2' },
	'gpt-image-2.5-flare': { deprecated: false, description: 'Fast everyday generation, up to 50% lower latency', label: 'GPT Image 2.5 Flare' },
	'gpt-image-2.5-sunburst': { deprecated: false, description: 'Premium detail and precise edits', label: 'GPT Image 2.5 Sunburst' }
} as const;

export const QUALITY_OPTIONS = {
	low: { label: 'Low', apiValue: 'low' },
	medium: { label: 'Medium', apiValue: 'medium' },
	high: { label: 'High', apiValue: 'high' },
	xhigh: { label: 'Extra High', apiValue: 'xhigh' },
	max: { label: 'Max', apiValue: 'max' },
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

type PaidImageQuality = Exclude<ImageQuality, 'auto'>;

/** Models billing image output per token, which is what unlocks arbitrary `WIDTHxHEIGHT` sizes. */
export type TokenPricedImageModel = 'gpt-image-2' | 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst';

// Per-image pricing from developers.openai.com; token-priced models follow $/image-output-token rules.
// Columns: 1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape)
type PricingByQuality = Partial<Record<ImageQuality, Partial<Record<PricedImageSize, number>>>>;
export const PRICING: Record<ImageModel, PricingByQuality> = {
	'gpt-image-1': {
		high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 },
		low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
		medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
	},
	'gpt-image-1-mini': {
		high: { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 },
		low: { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
		medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
	},
	'gpt-image-1.5': {
		high: { '1024x1024': 0.133, '1024x1536': 0.2, '1536x1024': 0.2 },
		low: { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
		medium: { '1024x1024': 0.034, '1024x1536': 0.05, '1536x1024': 0.05 },
	},
	'gpt-image-2': {
		high: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
		low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
		medium: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
	},
	// GPT Image 2.5 keeps GPT Image 2 token rates but respreads them over six tiers: its high costs what 2 charged at medium, its max what 2 charged at high.
	'gpt-image-2.5-flare': {
		high: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
		low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
		max: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
		medium: { '1024x1024': 0.013, '1024x1536': 0.01, '1536x1024': 0.01 },
		xhigh: { '1024x1024': 0.094, '1024x1536': 0.073, '1536x1024': 0.073 },
	},
	'gpt-image-2.5-sunburst': {
		high: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
		low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
		max: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
		medium: { '1024x1024': 0.013, '1024x1536': 0.01, '1536x1024': 0.01 },
		xhigh: { '1024x1024': 0.094, '1024x1536': 0.073, '1536x1024': 0.073 },
	},
};

/** Image output tokens billed at this rate for every GPT Image model (openai.com/api/pricing). */
export const IMAGE_OUTPUT_USD_PER_MILLION = 30;

/** Input token rates shared by `gpt-image-2` and both GPT Image 2.5 variants. */
export const TOKEN_INPUT_USD_PER_MILLION = { image: 8, imageCached: 2, text: 5, textCached: 1.25 } as const;

type AspectBucket = 'landscape' | 'portrait' | 'square';

/** Reference resolutions matching OpenAI's pricing table rows (image generation guide). */
const REF_PX: Record<AspectBucket, { h: number; w: number }> = {
	landscape: { h: 1024, w: 1536 },
	portrait: { h: 1536, w: 1024 },
	square: { h: 1024, w: 1024 },
};

/** Image output tokens of a square reference render, implied by the published per-image estimates at $30 / 1M. */
const SQUARE_OUTPUT_TOKENS: Record<TokenPricedImageModel, Partial<Record<PaidImageQuality, number>>> = {
	'gpt-image-2': { high: 7033 + 1 / 3, low: 200, medium: 1766 + 2 / 3 },
	'gpt-image-2.5-flare': { high: 1756, low: 196, max: 7024, medium: 439, xhigh: 3122 },
	'gpt-image-2.5-sunburst': { high: 1756, low: 196, max: 7024, medium: 439, xhigh: 3122 },
};

/** Portrait and landscape renders bill ~22% fewer output tokens than a square one at the same quality (OpenAI per-image table). */
const NON_SQUARE_TOKEN_RATIO = 0.78;

function aspectBucket(w: number, h: number): AspectBucket {
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

/**
 * Prices a token-billed render: exact for the three sizes OpenAI publishes, otherwise scaled by √(pixel ratio)
 * inside the nearest aspect bucket (OpenAI notes non-square costs can be lower than a naive area rule).
 */
function estimateImageOutputUsd(model: TokenPricedImageModel, quality: PaidImageQuality, sizeStr: string): number | null {
	const fixed = PRICING[model][quality]?.[sizeStr as PricedImageSize];
	if (fixed !== undefined) return fixed;

	const baseline = SQUARE_OUTPUT_TOKENS[model][quality];
	if (baseline === undefined) return null;

	const m = /^(\d+)x(\d+)$/.exec(sizeStr);
	if (!m) return null;
	const w = Number.parseInt(m[1], 10);
	const h = Number.parseInt(m[2], 10);
	if (w <= 0 || h <= 0) return null;

	const bucket = aspectBucket(w, h);
	const ref = REF_PX[bucket];
	const tokens = baseline * (bucket === 'square' ? 1 : NON_SQUARE_TOKEN_RATIO) * Math.sqrt((w * h) / (ref.w * ref.h));
	return (tokens / 1_000_000) * IMAGE_OUTPUT_USD_PER_MILLION;
}

export function getImagePrice(model: ImageModel, quality: ImageQuality, size: ImageSize): number | null {
	if (model in SQUARE_OUTPUT_TOKENS) {
		const qualityEff = quality === 'auto' ? 'medium' : quality;
		return estimateImageOutputUsd(model as TokenPricedImageModel, qualityEff, size === 'auto' ? '1024x1024' : size);
	}
	return PRICING[model]?.[quality]?.[size as PricedImageSize] ?? null;
}

const BASE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const satisfies readonly ImageQuality[];
const GPT_IMAGE_2_5_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] as const satisfies readonly ImageQuality[];

// `gpt-image-2` and both 2.5 variants always process image inputs at high fidelity, so `input_fidelity` must be omitted.
export const MODEL_SUPPORT = {
	'gpt-image-1': { arbitrarySize: false, inputFidelityConfigurable: true, qualities: BASE_QUALITIES, transparentBackground: true },
	'gpt-image-1-mini': { arbitrarySize: false, inputFidelityConfigurable: true, qualities: BASE_QUALITIES, transparentBackground: true },
	'gpt-image-1.5': { arbitrarySize: false, inputFidelityConfigurable: true, qualities: BASE_QUALITIES, transparentBackground: true },
	'gpt-image-2': { arbitrarySize: true, inputFidelityConfigurable: false, qualities: BASE_QUALITIES, transparentBackground: true },
	'gpt-image-2.5-flare': { arbitrarySize: true, inputFidelityConfigurable: false, qualities: GPT_IMAGE_2_5_QUALITIES, transparentBackground: true },
	'gpt-image-2.5-sunburst': { arbitrarySize: true, inputFidelityConfigurable: false, qualities: GPT_IMAGE_2_5_QUALITIES, transparentBackground: true }
} as const satisfies Record<ImageModel, { arbitrarySize: boolean; inputFidelityConfigurable: boolean; qualities: readonly ImageQuality[]; transparentBackground: boolean }>;

/** Resolution constraints the arbitrary-size models enforce on `size` values (image generation guide). */
export const ARBITRARY_SIZE_CONSTRAINTS = {
	edgeMultiple: 16,
	/** Past this pixel count OpenAI marks the output as experimental (~2560×1440). */
	experimentalPixels: 3_686_400,
	maxAspectRatio: 3,
	maxEdge: 3840,
	maxPixels: 8_294_400,
	minPixels: 655_360
} as const;

/** Returns null when the resolution is valid for an arbitrary-size model, otherwise a human-readable reason. */
export function validateArbitraryImageSize(width: number, height: number): string | null {
	const { edgeMultiple, maxAspectRatio, maxEdge, maxPixels, minPixels } = ARBITRARY_SIZE_CONSTRAINTS;
	if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return 'Width and height must be positive integers.';
	if (width % edgeMultiple !== 0 || height % edgeMultiple !== 0) return `Both edges must be multiples of ${edgeMultiple}px.`;
	if (Math.max(width, height) > maxEdge) return `The longest edge must be at most ${maxEdge}px.`;
	if (Math.max(width, height) / Math.min(width, height) > maxAspectRatio) return `The aspect ratio must not exceed ${maxAspectRatio}:1.`;
	const pixels = width * height;
	if (pixels < minPixels) return `The image must have at least ${minPixels.toLocaleString('en-US')} pixels.`;
	if (pixels > maxPixels) return `The image must have at most ${maxPixels.toLocaleString('en-US')} pixels.`;
	return null;
}

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
