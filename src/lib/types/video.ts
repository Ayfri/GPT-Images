// Types for video generation
export type VideoModel = 'sora-2' | 'sora-2-pro';
export type VideoQuality = 'draft' | 'standard' | 'high';
export type VideoResolution = '720x1280' | '1280x720' | '1024x1792' | '1792x1024';
export type VideoDuration = 4 | 8 | 12;

export interface RemixVideoParams {
	prompt: string;
	videoId: string;
}

export const MODEL_OPTIONS = {
	'sora-2': { description: 'High quality video generation with Sora 2', label: 'Sora 2' },
	'sora-2-pro': { description: 'Premium video generation with enhanced quality', label: 'Sora 2 Pro' }
} as const;

export const QUALITY_OPTIONS = {
	draft: { apiValue: 'draft', label: 'Draft' },
	high: { apiValue: 'high', label: 'High' },
	standard: { apiValue: 'standard', label: 'Standard' }
} as const;

// Resolution options by model
export const RESOLUTION_OPTIONS_BY_MODEL = {
	'sora-2': {
		'720x1280': { label: '720×1280 (Portrait)' },
		'1280x720': { label: '1280×720 (Landscape)' }
	},
	'sora-2-pro': {
		'720x1280': { label: '720×1280 (Portrait)' },
		'1280x720': { label: '1280×720 (Landscape)' },
		'1024x1792': { label: '1024×1792 (Portrait HD)' },
		'1792x1024': { label: '1792×1024 (Landscape HD)' }
	}
} as const;

export const DURATION_OPTIONS = {
	4: { label: '4 seconds' },
	8: { label: '8 seconds' },
	12: { label: '12 seconds' }
} as const;


// Cost per second based on Sora pricing
const COST_PER_SECOND = {
	'sora-2': {
		'720x1280': 0.10,  // Portrait
		'1280x720': 0.10   // Landscape
	},
	'sora-2-pro': {
		'720x1280': 0.30,  // Portrait
		'1280x720': 0.30,  // Landscape
		'1024x1792': 0.50,  // Portrait HD
		'1792x1024': 0.50   // Landscape HD
	}
};

// Calculate pricing based on model and resolution with cost per second
export const PRICING = {
	'sora-2': {
		'standard': {
			'720x1280': {
				4: 4 * COST_PER_SECOND['sora-2']['720x1280'],
				8: 8 * COST_PER_SECOND['sora-2']['720x1280'],
				12: 12 * COST_PER_SECOND['sora-2']['720x1280']
			},
			'1280x720': {
				4: 4 * COST_PER_SECOND['sora-2']['1280x720'],
				8: 8 * COST_PER_SECOND['sora-2']['1280x720'],
				12: 12 * COST_PER_SECOND['sora-2']['1280x720']
			}
		}
	},
	'sora-2-pro': {
		'standard': {
			'720x1280': {
				4: 4 * COST_PER_SECOND['sora-2-pro']['720x1280'],
				8: 8 * COST_PER_SECOND['sora-2-pro']['720x1280'],
				12: 12 * COST_PER_SECOND['sora-2-pro']['720x1280']
			},
			'1280x720': {
				4: 4 * COST_PER_SECOND['sora-2-pro']['1280x720'],
				8: 8 * COST_PER_SECOND['sora-2-pro']['1280x720'],
				12: 12 * COST_PER_SECOND['sora-2-pro']['1280x720']
			},
			'1024x1792': {
				4: 4 * COST_PER_SECOND['sora-2-pro']['1024x1792'],
				8: 8 * COST_PER_SECOND['sora-2-pro']['1024x1792'],
				12: 12 * COST_PER_SECOND['sora-2-pro']['1024x1792']
			},
			'1792x1024': {
				4: 4 * COST_PER_SECOND['sora-2-pro']['1792x1024'],
				8: 8 * COST_PER_SECOND['sora-2-pro']['1792x1024'],
				12: 12 * COST_PER_SECOND['sora-2-pro']['1792x1024']
			}
		}
	}
};
