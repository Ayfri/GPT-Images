// Common types for image generation and editing
import type { ImagesResponse } from 'openai/resources/images';

export type ImageModel = 'gpt-image-2' | 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'gpt-image-2.6-flare' | 'gpt-image-2.6-sunburst';
/** No longer offered: gpt-image-1 is shut down, gpt-image-1-mini and gpt-image-1.5 retire on 2026-12-01. History records keep them for display and pricing. */
export type LegacyImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5';
export type StoredImageModel = ImageModel | LegacyImageModel;
export type ImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';
export type ImageSize =
	| 'auto'
	| '512x512'
	| '768x768'
	| '1024x1024'
	| '1024x1536'
	| '1536x1024'
	| '2048x2048'
	| '2048x1152'
	| '3840x2160'
	| '2160x3840';
/** The API returns the real size, which can fall outside the sizes offered (e.g. `512x512` for `auto` GIFs). */
export type StoredImageSize = ImageSize | (string & {});
export type PricedImageSize = '1024x1024' | '1024x1536' | '1536x1024';
export type ImageComplexity = 'low' | 'medium' | 'high';
export type InputFidelity = 'low' | 'high';
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';
export type SvgAuthorModel = 'gpt-5.4-nano' | 'gpt-5.4-mini' | 'gpt-5.5';
export type SvgEffort = 'default' | 'low' | 'medium' | 'high';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageModeration = 'auto' | 'low';

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2.6-flare';

/**
 * OpenAI Images API: max `prompt` length in characters.
 */
export const GPT_IMAGE_MODEL_PROMPT_MAX_CHARS = 32_000;

export const MODEL_OPTIONS = {
	'gpt-image-2': { description: 'Highest quality with flexible sizing', label: 'GPT Image 2' },
	'gpt-image-2.5-flare': { description: 'Fast everyday generation, up to 50% lower latency', label: 'GPT Image 2.5 Flare' },
	'gpt-image-2.5-sunburst': { description: 'Premium detail and precise edits', label: 'GPT Image 2.5 Sunburst' },
	'gpt-image-2.6-flare': { description: 'Flare variant of GPT Image 2.6', label: 'GPT Image 2.6 Flare' },
	'gpt-image-2.6-sunburst': { description: 'Sunburst variant of GPT Image 2.6', label: 'GPT Image 2.6 Sunburst' }
} as const satisfies Record<ImageModel, { description: string; label: string }>;

export const QUALITY_OPTIONS = {
	low: { label: 'Low' },
	medium: { label: 'Medium' },
	high: { label: 'High' },
	xhigh: { label: 'Extra High' },
	max: { label: 'Max' },
	auto: { label: 'Auto' }
} as const;

export const SIZE_OPTIONS = {
	auto: { label: 'Auto' },
	'512x512': { label: '512×512' },
	'768x768': { label: '768×768' },
	'1024x1024': { label: '1024×1024' },
	'1024x1536': { label: '1024×1536 (Portrait)' },
	'1536x1024': { label: '1536×1024 (Landscape)' },
	'2048x2048': { label: '2048×2048 (2K Square)' },
	'2048x1152': { label: '2048×1152 (2K Landscape)' },
	'3840x2160': { label: '3840×2160 (4K Landscape)' },
	'2160x3840': { label: '2160×3840 (4K Portrait)' }
} as const;

export const STANDARD_SIZES: readonly ImageSize[] = ['auto', '1024x1024', '1024x1536', '1536x1024', '2048x2048', '2048x1152', '3840x2160', '2160x3840'];

/** GIF frames are packed into one sprite sheet that must fit the size limits: 1024x1024 rejects even 2 frames, auto returns 512x512 (verified 2026-11-05). */
export const GIF_SIZES: readonly ImageSize[] = ['auto', '512x512', '768x768'];

/** 17 frames and 10 ms are rejected by the live API, the SDK only documents the 655,350 ms cap. */
export const GIF_LIMITS = { defaultFrameCount: 9, defaultFrameDurationMs: 200, maxFrameCount: 16, maxFrameDurationMs: 655_350, minFrameCount: 2, minFrameDurationMs: 20 } as const;

export const PRICED_SIZE_OPTIONS: Record<PricedImageSize, { label: string }> = {
	'1024x1024': { label: '1024×1024' },
	'1024x1536': { label: '1024×1536' },
	'1536x1024': { label: '1536×1024' }
} as const;

export const COMPLEXITY_OPTIONS = {
	low: { label: 'Low' },
	medium: { label: 'Medium' },
	high: { label: 'High' }
} as const satisfies Record<ImageComplexity, { label: string }>;

export const OUTPUT_FORMAT_OPTIONS = {
	png: { label: 'PNG', description: 'Lossless, larger file size', mime: 'image/png' },
	jpeg: { label: 'JPEG', description: 'Lossy, smaller file size', mime: 'image/jpeg' },
	webp: { label: 'WebP', description: 'Modern format, good compression', mime: 'image/webp' },
	gif: { label: 'GIF', description: 'Looping animation, generation only', mime: 'image/gif' },
	svg: { label: 'SVG', description: 'Vector image authored by a text model, generation only', mime: 'image/svg+xml' }
} as const satisfies Record<OutputFormat, { description: string; label: string; mime: string }>;

export const SVG_AUTHOR_MODEL_OPTIONS = {
	'gpt-5.4-nano': { label: 'GPT-5.4 Nano' },
	'gpt-5.4-mini': { label: 'GPT-5.4 Mini' },
	'gpt-5.5': { label: 'GPT-5.5' }
} as const satisfies Record<SvgAuthorModel, { label: string }>;

export const SVG_EFFORT_OPTIONS = {
	default: { label: 'Model default' },
	low: { label: 'Low' },
	medium: { label: 'Medium' },
	high: { label: 'High' }
} as const satisfies Record<SvgEffort, { label: string }>;

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

// Per-image pricing from developers.openai.com; token-priced models follow $/image-output-token rules.
// Columns: 1024×1024 | 1024×1536 (portrait) | 1536×1024 (landscape)
type PricingByQuality = Partial<Record<ImageQuality, Partial<Record<string, number>>>>;
export const PRICING: Record<StoredImageModel, PricingByQuality> = {
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
	/** GPT Image 2.6 has no published per-image table: its estimates come from SQUARE_OUTPUT_TOKENS measured on the live API. */
	'gpt-image-2.6-flare': {},
	'gpt-image-2.6-sunburst': {},
};

/** Image output tokens billed at this rate for every GPT Image model (openai.com/api/pricing). */
export const IMAGE_OUTPUT_USD_PER_MILLION = 30;

/** Input token rates shared by every selectable model. */
export const TOKEN_INPUT_USD_PER_MILLION = { image: 8, imageCached: 2, text: 5, textCached: 1.25 } as const;

type AspectBucket = 'landscape' | 'portrait' | 'square';

/** Reference resolutions matching OpenAI's pricing table rows (image generation guide). */
const REF_PX: Record<AspectBucket, { h: number; w: number }> = {
	landscape: { h: 1024, w: 1536 },
	portrait: { h: 1536, w: 1024 },
	square: { h: 1024, w: 1024 },
};

/** Image output tokens of a square reference render, implied by the published per-image estimates at $30 / 1M. */
const SQUARE_OUTPUT_TOKENS: Record<ImageModel, Partial<Record<PaidImageQuality, number>>> = {
	'gpt-image-2': { high: 7033 + 1 / 3, low: 200, medium: 1766 + 2 / 3 },
	'gpt-image-2.5-flare': { high: 1756, low: 196, max: 7024, medium: 439, xhigh: 3122 },
	'gpt-image-2.5-sunburst': { high: 1756, low: 196, max: 7024, medium: 439, xhigh: 3122 },
	/** 2.6 values are image output tokens of a 1024x1024 render measured on 2026-11-05, complexity does not change them. */
	'gpt-image-2.6-flare': { high: 1758, low: 824, max: 7024, medium: 1449, xhigh: 3122 },
	'gpt-image-2.6-sunburst': { high: 1758, low: 824, max: 7024, medium: 1449, xhigh: 3122 },
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
function estimateImageOutputUsd(model: ImageModel, quality: PaidImageQuality, size: string): number | null {
	const fixed = PRICING[model][quality]?.[size];
	if (fixed !== undefined) return fixed;

	const baseline = SQUARE_OUTPUT_TOKENS[model][quality];
	if (baseline === undefined) return null;

	const m = /^(\d+)x(\d+)$/.exec(size);
	if (!m) return null;
	const w = Number.parseInt(m[1], 10);
	const h = Number.parseInt(m[2], 10);
	if (w <= 0 || h <= 0) return null;

	const bucket = aspectBucket(w, h);
	const ref = REF_PX[bucket];
	const tokens = baseline * (bucket === 'square' ? 1 : NON_SQUARE_TOKEN_RATIO) * Math.sqrt((w * h) / (ref.w * ref.h));
	return (tokens / 1_000_000) * IMAGE_OUTPUT_USD_PER_MILLION;
}

export function getImagePrice(model: StoredImageModel, quality: ImageQuality, size: StoredImageSize): number | null {
	if (isSelectableModel(model)) return estimateImageOutputUsd(model, quality === 'auto' ? 'medium' : quality, size === 'auto' ? '1024x1024' : size);
	return PRICING[model][quality]?.[size] ?? null;
}

/** Real cost of a GPT Image 2.x request: the API returns usage for 2.6 too, although the SDK documents it for gpt-image-1 only. */
export function usageCostUsd({ input_tokens_details, output_tokens }: ImagesResponse.Usage): number {
	return (
		((input_tokens_details?.text_tokens ?? 0) * TOKEN_INPUT_USD_PER_MILLION.text +
			(input_tokens_details?.image_tokens ?? 0) * TOKEN_INPUT_USD_PER_MILLION.image +
			(output_tokens ?? 0) * IMAGE_OUTPUT_USD_PER_MILLION) /
		1_000_000
	);
}

/** Stored real cost when present, otherwise the estimate: records saved before usage tracking have no cost. */
export function getRecordPrice({ cost, model = 'gpt-image-2', quality, size }: { cost?: number; model?: StoredImageModel; quality?: ImageQuality; size?: StoredImageSize }): number {
	return cost ?? (quality && size ? (getImagePrice(model, quality, size) ?? 0.01) : 0.01);
}

const BASE_QUALITIES = ['low', 'medium', 'high', 'auto'] as const satisfies readonly ImageQuality[];
const EXTENDED_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'] as const satisfies readonly ImageQuality[];

interface ModelSupport {
	complexity: boolean;
	gif: boolean;
	markup: boolean;
	qualities: readonly ImageQuality[];
	svg: boolean;
}

/** markup is documented for 2.5 and verified on 2.6, gpt-image-2 is untested. */
export const MODEL_SUPPORT: Record<ImageModel, ModelSupport> = {
	'gpt-image-2': { complexity: false, gif: false, markup: false, qualities: BASE_QUALITIES, svg: false },
	'gpt-image-2.5-flare': { complexity: false, gif: false, markup: true, qualities: EXTENDED_QUALITIES, svg: false },
	'gpt-image-2.5-sunburst': { complexity: false, gif: false, markup: true, qualities: EXTENDED_QUALITIES, svg: false },
	'gpt-image-2.6-flare': { complexity: true, gif: true, markup: true, qualities: EXTENDED_QUALITIES, svg: true },
	'gpt-image-2.6-sunburst': { complexity: true, gif: true, markup: true, qualities: EXTENDED_QUALITIES, svg: true }
};

export const isSelectableModel = (model: string): model is ImageModel => Object.hasOwn(MODEL_SUPPORT, model);
export const isImageSize = (size: string): size is ImageSize => Object.hasOwn(SIZE_OPTIONS, size);

// GPT Image 1 specifications for image uploads
export const IMAGE_UPLOAD_LIMITS = {
	maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
	maxImages: 16,
	acceptedFormats: ['image/png', 'image/webp', 'image/jpeg', 'image/jpg'],
	acceptedExtensions: '.png,.webp,.jpg,.jpeg',
	maskMaxSize: 4 * 1024 * 1024 // 4MB in bytes
} as const;
