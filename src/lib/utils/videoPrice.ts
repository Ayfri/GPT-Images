import type { VideoModel, VideoDuration, VideoResolution } from '$lib/types/video';
import { PRICING } from '$lib/types/video';

export function calculateVideoPrice(
	model: string | undefined,
	resolution: string | undefined,
	duration: number | undefined
): number {
	const videoModel = (model || 'sora-2') as VideoModel;

	if (!resolution || !duration) {
		return 1.0;
	}

	try {
		const resolutionPricing = PRICING[videoModel]?.[resolution as VideoResolution];
		if (resolutionPricing && duration in resolutionPricing) {
			return resolutionPricing[duration as VideoDuration] ?? 1.0;
		}
	} catch {
		// Fallback on error
	}

	return 1.0;
}
