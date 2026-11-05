<script lang="ts">
	import { Upload, X } from '@lucide/svelte';
	import { ACCEPTED_IMAGE_TYPES, IMAGE_UPLOAD_LIMITS } from '#lib/types/image.ts';
	import { fileSrc } from '#lib/utils/fileSrc.ts';

	interface Props {
		disabled?: boolean;
		files: File[];
		onerror: (message: string) => void;
		onsvg: (text: string) => void;
	}

	let { disabled = false, files = $bindable(), onerror, onsvg }: Props = $props();

	let isDragging = $state(false);
	let pasteFlash = $state(false);
	let urlInput = $state('');
	const blocked = $derived(disabled || files.length >= IMAGE_UPLOAD_LIMITS.maxImages);

	const isSvg = (file: File) => file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

	/** The edits endpoint only takes PNG, WEBP and JPEG: other formats the browser can decode (GIF first frame, AVIF, BMP...) are redrawn as PNG. */
	async function toSupported(file: File) {
		if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return file;

		const bitmap = await createImageBitmap(file);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
		bitmap.close();
		return new File([await canvas.convertToBlob({ type: 'image/png' })], `${file.name.replace(/\.[^.]*$/, '')}.png`, { type: 'image/png' });
	}

	function flash() {
		pasteFlash = true;
		setTimeout(() => (pasteFlash = false), 1200);
	}

	async function add(incoming: File[]) {
		const valid: File[] = [];
		for (const file of incoming) {
			/** SVG is untrusted markup and the edits endpoint rejects it, so its text goes to the prompt and it is never rendered. */
			if (isSvg(file)) {
				onsvg((await file.text()).trim());
				flash();
				continue;
			}

			try {
				const prepared = await toSupported(file);
				if (prepared.size > IMAGE_UPLOAD_LIMITS.maxFileSize) onerror(`File "${file.name}" is too large. Maximum size is ${IMAGE_UPLOAD_LIMITS.maxFileSize / (1024 * 1024)}MB.`);
				else valid.push(prepared);
			} catch {
				onerror(`Unsupported image format: ${file.name}`);
			}
		}
		if (!valid.length) return;
		if (files.length + valid.length > IMAGE_UPLOAD_LIMITS.maxImages) return onerror(`You can attach up to ${IMAGE_UPLOAD_LIMITS.maxImages} reference images.`);

		files = [...files, ...valid];
		flash();
	}

	async function addUrl(url: string) {
		try {
			const blob = await (await fetch(url)).blob();
			await add([new File([blob], new URL(url).pathname.split('/').pop() || 'image-from-url', { type: blob.type })]);
		} catch {
			onerror(`Could not load an image from ${url}. The server may block cross-origin requests.`);
		}
	}

	function submitUrl() {
		if (!urlInput.trim() || blocked) return;
		addUrl(urlInput.trim());
		urlInput = '';
	}

	/** Pasting inside a text field keeps its native behavior, so the URL field still takes a pasted link as text. */
	function onpaste(event: ClipboardEvent) {
		const { clipboardData, target } = event;
		if (disabled || !clipboardData || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

		if (clipboardData.files.length) {
			event.preventDefault();
			add([...clipboardData.files]);
			return;
		}

		const text = clipboardData.getData('text').trim();
		if (/^https?:\/\//.test(text)) {
			event.preventDefault();
			addUrl(text);
		}
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (!disabled) add([...(event.dataTransfer?.files ?? [])]);
	}
</script>

<svelte:document {onpaste} />

<div
	aria-label="Image drop zone"
	class={['space-y-2 rounded-lg transition-shadow duration-300', isDragging && 'bg-primary-900/10', pasteFlash && 'ring-2 ring-purple-500/60']}
	ondragleave={() => (isDragging = false)}
	ondragover={(event) => {
		event.preventDefault();
		isDragging = true;
	}}
	{ondrop}
	role="region"
>
	<input
		id="image-upload"
		type="file"
		accept="image/*"
		multiple
		onchange={(event) => {
			add([...(event.currentTarget.files ?? [])]);
			event.currentTarget.value = '';
		}}
		class="hidden"
		disabled={blocked}
	/>

	{#if files.length}
		<div class="flex flex-wrap gap-2 mb-1">
			{#each files as file, index (file)}
				<div class="relative group">
					<img {@attach fileSrc(file)} alt="Reference {index + 1}" class="w-16 h-16 object-cover rounded-lg border border-gray-700/60" />
					<button
						type="button"
						class="absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed"
						onclick={() => (files = files.filter((f) => f !== file))}
						{disabled}
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			{/each}
			{#if files.length < IMAGE_UPLOAD_LIMITS.maxImages}
				<label
					for="image-upload"
					class={['w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center cursor-pointer transition-colors', blocked && 'opacity-40 cursor-not-allowed']}
				>
					<Upload class="w-5 h-5 text-gray-600" />
				</label>
			{/if}
		</div>
		<button
			type="button"
			class="text-xs text-red-500/70 hover:text-red-400 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => (files = [])}
			{disabled}
		>
			Clear all
		</button>
	{:else}
		<div class={['border border-dashed rounded-lg px-4 py-3 transition-all', isDragging ? 'border-primary-500 bg-primary-900/10' : 'border-gray-700/70 hover:border-gray-600']}>
			<div class="flex items-center gap-3">
				<label
					for="image-upload"
					class={['flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-md cursor-pointer transition-colors shrink-0', blocked && 'opacity-40 cursor-not-allowed']}
				>
					<Upload class="w-3.5 h-3.5" />
					Browse
				</label>

				<input
					type="text"
					bind:value={urlInput}
					placeholder="or paste image URL…"
					onkeydown={(event) => event.key === 'Enter' && submitUrl()}
					class="flex-1 bg-transparent border-0 text-xs text-gray-500 placeholder-gray-700 focus:outline-none min-w-0"
					disabled={blocked}
				/>
				{#if urlInput}
					<button type="button" onclick={submitUrl} class="text-xs text-primary-500 hover:text-primary-400 shrink-0" disabled={blocked}>Load</button>
				{/if}
			</div>
			<p class="text-xs text-gray-700 mt-1.5">Drop here or Ctrl+V anywhere on the page</p>
		</div>
	{/if}
</div>
