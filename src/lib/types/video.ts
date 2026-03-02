// Types for video generation
export type VideoModel = 'sora-2' | 'sora-2-pro';
export type VideoResolution = '720x1280' | '1280x720' | '1024x1792' | '1792x1024';
export type VideoDuration = 4 | 8 | 12;

export interface RemixVideoParams {
	prompt: string;
	videoId: string;
}

export const MODEL_OPTIONS = {
	'sora-2': { description: 'High quality video generation with Sora 2', label: 'Sora 2' },
	'sora-2-pro': { description: 'Premium video generation at up to 1080p', label: 'Sora 2 Pro' }
} as const;

// Resolution options by model
export const RESOLUTION_OPTIONS_BY_MODEL = {
	'sora-2': {
		'720x1280': { label: '720×1280 (Portrait)' },
		'1280x720': { label: '1280×720 (Landscape)' }
	},
	'sora-2-pro': {
		'720x1280':  { label: '720×1280 (Portrait)' },
		'1280x720':  { label: '1280×720 (Landscape)' },
		'1024x1792': { label: '1024×1792 (Portrait HD)' },
		'1792x1024': { label: '1792×1024 (Landscape HD)' }
	}
} as const;

export const DURATION_OPTIONS = {
	4:  { label: '4 seconds' },
	8:  { label: '8 seconds' },
	12: { label: '12 seconds' }
} as const;

// Official OpenAI pricing: $0.10/s (sora-2), $0.30/s or $0.50/s (sora-2-pro)
// Source: developers.openai.com/api/docs/pricing (March 2026)
export const PRICING: Record<VideoModel, Partial<Record<VideoResolution, Record<VideoDuration, number>>>> = {
	'sora-2': {
		'720x1280': { 4: 0.40, 8: 0.80, 12: 1.20 },
		'1280x720': { 4: 0.40, 8: 0.80, 12: 1.20 }
	},
	'sora-2-pro': {
		'720x1280':  { 4: 1.20, 8: 2.40, 12: 3.60 },
		'1280x720':  { 4: 1.20, 8: 2.40, 12: 3.60 },
		'1024x1792': { 4: 2.00, 8: 4.00, 12: 6.00 },
		'1792x1024': { 4: 2.00, 8: 4.00, 12: 6.00 }
	}
};
