import type { VideoModel, VideoDuration, VideoResolution } from '$lib/types/video';
import { PRICING } from '$lib/types/video';

export function calculateVideoPrice(
	model: VideoModel | string | undefined,
	resolution: VideoResolution | string | undefined,
	duration: VideoDuration | number | undefined
): number {
	const videoModel = (model || 'sora-2') as VideoModel;

	if (!resolution || !duration) {
		return 1.0;
	}

	try {
		const modelPricing = PRICING[videoModel]?.['standard'];
		if (modelPricing && resolution in modelPricing) {
			const resolutionPricing = (modelPricing as any)[resolution];
			if (resolutionPricing && duration in resolutionPricing) {
				return resolutionPricing[duration] || 1.0;
			}
		}
	} catch (e) {
		// Fallback on error
	}

	return 1.0;
}
