import { untrack } from 'svelte';

interface Point {
	x: number;
	y: number;
}

/**
 * Zoom and pan state of the image viewer. `scale` 1 fits the image in the dialog, `x` and `y` are the translation in px.
 * The pan is clamped against the layout size of the image (it ignores transforms) and the dialog, which centers the image with flex.
 */
export class PanZoom {
	/** True during a drag or a pinch, so the CSS transition doesn't lag behind the finger. */
	dragging = $state(false);
	/** Scale that shows the native pixels of the image, 2 when the browser can't tell (SVG without intrinsic size). */
	nativeScale = $state(2);
	scale = $state(1);
	x = $state(0);
	y = $state(0);

	#image: HTMLImageElement | null = null;
	#lastTap: (Point & { time: number }) | null = null;
	#pinched = false;
	#pointers = new Map<number, Point>();
	#travel = 0;
	#viewport: HTMLElement | null = null;

	get maxScale() {
		return Math.max(4, this.nativeScale * 2);
	}

	/** `{@attach}` for the image. Untracked, so panning and zooming don't re-run it. A pointer held while the image is destroyed is dropped. */
	attach = (image: HTMLImageElement) => {
		this.#image = image;
		this.#viewport = image.closest('dialog');
		untrack(this.resize);
		return () => {
			this.#pointers.clear();
			this.dragging = false;
			if (this.#image === image) this.#image = null;
		};
	};

	/** Measures the native scale (a width attribute is the original's size, a thumbnail's naturalWidth isn't) and clamps the pan. */
	resize = () => {
		const image = this.#image;
		if (!image) return;
		const naturalWidth = Number(image.getAttribute('width')) || image.naturalWidth;
		this.nativeScale = naturalWidth && image.offsetWidth ? naturalWidth / image.offsetWidth : 2;
		this.clamp();
	};

	clamp() {
		const image = this.#image;
		const viewport = this.#viewport;
		if (!image || !viewport) return;
		const maxX = Math.max(0, (image.offsetWidth * this.scale - viewport.clientWidth) / 2);
		const maxY = Math.max(0, (image.offsetHeight * this.scale - viewport.clientHeight) / 2);
		this.x = Math.min(maxX, Math.max(-maxX, this.x));
		this.y = Math.min(maxY, Math.max(-maxY, this.y));
	}

	panBy(dx: number, dy: number) {
		this.x += dx;
		this.y += dy;
		this.clamp();
	}

	reset() {
		this.scale = 1;
		this.x = 0;
		this.y = 0;
	}

	/** Zooms to `target` while the image point under (clientX, clientY) stays fixed. The image center is the viewport center. */
	zoomAt(clientX: number, clientY: number, target: number) {
		const viewport = this.#viewport;
		if (!viewport) return;
		/** Scales just above 1 snap to 1, so zooming in then out never leaves a hairline zoom that blocks clicks and swipes. */
		const next = target < 1.02 ? 1 : Math.min(this.maxScale, target);
		const ratio = next / this.scale;
		const rect = viewport.getBoundingClientRect();
		const qx = clientX - (rect.left + rect.width / 2);
		const qy = clientY - (rect.top + rect.height / 2);
		this.x = qx - (qx - this.x) * ratio;
		this.y = qy - (qy - this.y) * ratio;
		this.scale = next;
		this.clamp();
	}

	/** Zooms around the viewport center. */
	zoomBy(factor: number) {
		const rect = this.#viewport?.getBoundingClientRect();
		if (rect) this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, this.scale * factor);
	}

	/** Back to fit when zoomed, else to the native pixels (at least 2x) around the point. */
	#toggle(clientX: number, clientY: number) {
		if (this.scale > 1) this.reset();
		else this.zoomAt(clientX, clientY, Math.max(2, this.nativeScale));
	}

	wheel = (e: WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
		/** Chrome reports a trackpad pinch as ctrl+wheel with small deltas. */
		this.zoomAt(e.clientX, e.clientY, this.scale * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002)));
	};

	down = (e: PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (!this.#pointers.size) {
			this.#travel = 0;
			this.#pinched = false;
		}
		this.#pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (this.#pointers.size > 1) this.#pinched = true;
		/** Capturing keeps a drag that ends over the dark area from sending a click to the dialog, which would close it. */
		this.#image?.setPointerCapture(e.pointerId);
	};

	move = (e: PointerEvent) => {
		const prev = this.#pointers.get(e.pointerId);
		if (!prev) return;
		const next = { x: e.clientX, y: e.clientY };
		this.#pointers.set(e.pointerId, next);

		if (this.#pointers.size === 1) {
			this.#travel += Math.hypot(next.x - prev.x, next.y - prev.y);
			if (this.scale > 1) {
				this.dragging = true;
				this.panBy(next.x - prev.x, next.y - prev.y);
			}
			return;
		}

		const other = [...this.#pointers.values()].find((point) => point !== next);
		const before = other && Math.hypot(prev.x - other.x, prev.y - other.y);
		if (this.#pointers.size !== 2 || !other || !before) return;
		this.dragging = true;
		this.zoomAt((prev.x + other.x) / 2, (prev.y + other.y) / 2, (this.scale * Math.hypot(next.x - other.x, next.y - other.y)) / before);
		this.panBy((next.x - prev.x) / 2, (next.y - prev.y) / 2);
	};

	/** A mouse click toggles the zoom, a touch needs a double tap so a single tap never zooms by accident. */
	up = (e: PointerEvent) => {
		if (!this.#pointers.delete(e.pointerId) || this.#pointers.size) return;
		this.dragging = false;
		const touch = e.pointerType === 'touch';
		if (e.type === 'pointercancel' || this.#pinched || this.#travel >= (touch ? 10 : 5)) return;
		if (!touch) return this.#toggle(e.clientX, e.clientY);

		const last = this.#lastTap;
		if (last && e.timeStamp - last.time < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
			this.#lastTap = null;
			this.#toggle(e.clientX, e.clientY);
		} else this.#lastTap = { time: e.timeStamp, x: e.clientX, y: e.clientY };
	};
}
