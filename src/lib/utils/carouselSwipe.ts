export const CAROUSEL_SWIPE_MIN_DISTANCE_PX = 52;

export function getCarouselSwipeDirection(
	dx: number,
	dy: number,
): 'next' | 'prev' | null {
	if (Math.abs(dx) < CAROUSEL_SWIPE_MIN_DISTANCE_PX) {
		return null;
	}
	if (Math.abs(dx) <= Math.abs(dy)) {
		return null;
	}
	return dx > 0 ? 'prev' : 'next';
}
