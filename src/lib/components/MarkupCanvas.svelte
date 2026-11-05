<script lang="ts">
	import { Brush, Eraser, Undo2 } from '@lucide/svelte';

	type Point = { x: number; y: number };
	type Stroke = { color: string; points: Point[]; width: number };

	interface Props {
		disabled: boolean;
		image: File;
		markup: File | null;
	}

	let { disabled, image, markup = $bindable(null) }: Props = $props();

	let color = $state('#ef4444');
	let size = $state(12);
	let strokes = $state.raw<Stroke[]>([]);
	let current: Stroke | null = null;
	let ctx: CanvasRenderingContext2D | null = null;

	const src = $derived(URL.createObjectURL(image));
	$effect(() => {
		const url = src;
		return () => URL.revokeObjectURL(url);
	});

	/** The canvas matches the natural size (EXIF orientation applied), which is the pixel size the API expects for the markup. */
	function reset({ currentTarget: img }: Event) {
		if (!ctx || !(img instanceof HTMLImageElement)) return;
		ctx.canvas.width = img.naturalWidth;
		ctx.canvas.height = img.naturalHeight;
		strokes = [];
		markup = null;
	}

	type CanvasPointerEvent = PointerEvent & { currentTarget: HTMLCanvasElement };

	/** Maps the pointer from displayed pixels to canvas pixels. */
	function toCanvas({ clientX, clientY, currentTarget: canvas }: CanvasPointerEvent): Point {
		const rect = canvas.getBoundingClientRect();
		return { x: ((clientX - rect.left) * canvas.width) / rect.width, y: ((clientY - rect.top) * canvas.height) / rect.height };
	}

	/** Draws the segments from `points[from - 1]` on, so a move only paints its new segment and `from = 0` paints a dot. */
	function paint({ color, points, width }: Stroke, from: number) {
		if (!ctx) return;
		const { x, y } = points[Math.max(0, from - 1)];
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.lineCap = ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(x, y);
		for (const point of points.slice(from)) ctx.lineTo(point.x, point.y);
		ctx.stroke();
	}

	function onpointerdown(e: CanvasPointerEvent) {
		if (disabled || !ctx || e.button !== 0) return;
		const canvas = e.currentTarget;
		canvas.setPointerCapture(e.pointerId);
		current = { color, points: [toCanvas(e)], width: (size * canvas.width) / canvas.getBoundingClientRect().width };
		paint(current, 0);
	}

	function onpointermove(e: CanvasPointerEvent) {
		if (!current) return;
		current.points.push(toCanvas(e));
		paint(current, current.points.length - 1);
	}

	function end() {
		if (!current) return;
		strokes = [...strokes, current];
		current = null;
		exportMarkup();
	}

	/** Out-of-order or late encodes are dropped when the strokes changed in the meantime. */
	function exportMarkup() {
		if (!ctx) return;
		if (!strokes.length) {
			markup = null;
			return;
		}
		const snapshot = strokes;
		ctx.canvas.toBlob((blob) => {
			if (blob && strokes === snapshot) markup = new File([blob], 'markup.png', { type: 'image/png' });
		}, 'image/png');
	}

	function undo() {
		if (!ctx) return;
		strokes = strokes.slice(0, -1);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		for (const stroke of strokes) paint(stroke, 0);
		exportMarkup();
	}

	function clear() {
		if (!ctx) return;
		strokes = [];
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		markup = null;
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
		<Brush class="h-3.5 w-3.5" />
		<input type="color" bind:value={color} {disabled} aria-label="Brush color" class="h-7 w-9 cursor-pointer rounded bg-transparent" />
		<label for="markup-size" class="uppercase tracking-wider">Brush</label>
		<input
			id="markup-size"
			type="range"
			min="2"
			max="64"
			bind:value={size}
			{disabled}
			class="w-28 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
		/>
		<span class="w-6 text-gray-400">{size}</span>
		<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-200 transition-colors" onclick={undo} disabled={disabled || !strokes.length}>
			<Undo2 class="h-3.5 w-3.5" />
			Undo
		</button>
		<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-gray-200 transition-colors" onclick={clear} disabled={disabled || !strokes.length}>
			<Eraser class="h-3.5 w-3.5" />
			Clear
		</button>
	</div>

	<div class="relative">
		<img {src} alt="First reference, drawing surface" draggable="false" class="w-full h-auto rounded-lg select-none" onload={reset} />
		<canvas
			{@attach (canvas) => {
				ctx = canvas.getContext('2d');
			}}
			class="absolute inset-0 h-full w-full touch-none cursor-crosshair"
			{onpointerdown}
			{onpointermove}
			onpointerup={end}
			onpointercancel={end}
		></canvas>
	</div>

	<p class="text-xs text-gray-600">Draw on the first reference image to show the model what to change.</p>
</div>
