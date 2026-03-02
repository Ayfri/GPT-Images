<script lang="ts">
	import { Upload, X } from 'lucide-svelte';
	import { IMAGE_UPLOAD_LIMITS } from '$lib/types/image';

	interface Props {
		images: File[];
		imagePreviews: string[];
		maxImages: number;
		acceptedExtensions: string;
		isGenerating: boolean;
		singleImage?: boolean;
		onImagesChange: (images: File[], previews: string[]) => void;
		validateFile?: (file: File) => string | null;
	}

	let { images, imagePreviews, maxImages, acceptedExtensions, isGenerating, singleImage = false, onImagesChange, validateFile }: Props = $props();

	let isDragging = $state(false);
	let urlInput = $state('');
	let dropZone: HTMLDivElement | undefined = $state();

	function validateImageFile(file: File): string | null {
		if (validateFile) {
			return validateFile(file);
		}

		// Default validation
		if (file.size > IMAGE_UPLOAD_LIMITS.maxFileSize) {
			return `File "${file.name}" is too large. Maximum size is 50MB.`;
		}

		if (!IMAGE_UPLOAD_LIMITS.acceptedFormats.includes(file.type as any)) {
			return `File "${file.name}" has an unsupported format. Please use PNG, WEBP, or JPEG.`;
		}

		return null;
	}

	function handleImageUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = Array.from(target.files || []);

		if (files.length === 0) return;

		// Check if adding these files would exceed the limit
		if (images.length + files.length > maxImages) {
			// You might want to emit an error event here
			return;
		}

		// Validate each file
		for (const file of files) {
			const validationError = validateImageFile(file);
			if (validationError) {
				// You might want to emit an error event here
				return;
			}
		}

		// Add files and create previews
		const newImages = singleImage ? [] : [...images];
		const newPreviews = singleImage ? [] : [...imagePreviews];

		files.forEach((file) => {
			newImages.push(file);

			const reader = new FileReader();
			reader.onload = (e) => {
				newPreviews.push(e.target?.result as string);
				onImagesChange(newImages, newPreviews);
			};
			reader.readAsDataURL(file);
		});

		// Clear the input
		target.value = '';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = Array.from(event.dataTransfer?.files || []);
		if (files.length === 0) return;

		// Check if adding these files would exceed the limit
		if (images.length + files.length > maxImages) {
			return;
		}

		// Filter and validate image files
		const imageFiles = files.filter(file => file.type.startsWith('image/'));

		for (const file of imageFiles) {
			const validationError = validateImageFile(file);
			if (validationError) {
				return;
			}
		}

		if (imageFiles.length === 0) return;

		// Add files and create previews
		const newImages = singleImage ? [] : [...images];
		const newPreviews = singleImage ? [] : [...imagePreviews];

		imageFiles.forEach((file) => {
			newImages.push(file);

			const reader = new FileReader();
			reader.onload = (e) => {
				newPreviews.push(e.target?.result as string);
				onImagesChange(newImages, newPreviews);
			};
			reader.readAsDataURL(file);
		});
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	async function handleUrlSubmit() {
		if (!urlInput.trim()) return;

		// Check if adding one more file would exceed the limit
		if (images.length + 1 > maxImages) {
			return;
		}

		try {
			const response = await fetch(urlInput.trim());
			const blob = await response.blob();

			// Validate the blob
			if (!blob.type.startsWith('image/')) {
				return;
			}

			const file = new File([blob], 'image-from-url', { type: blob.type });
			const validationError = validateImageFile(file);
			if (validationError) {
				return;
			}

			// Add file and create preview
			const newImages = singleImage ? [file] : [...images, file];
			const newPreviews = singleImage ? [] : [...imagePreviews];

			const reader = new FileReader();
			reader.onload = (e) => {
				newPreviews.push(e.target?.result as string);
				onImagesChange(newImages, newPreviews);
			};
			reader.readAsDataURL(file);

			urlInput = '';
		} catch (err) {
			console.error('Error loading image from URL:', err);
		}
	}

	async function handlePaste(event: ClipboardEvent) {
		// Check for image file
		const items = event.clipboardData?.items;
		if (items) {
			for (let i = 0; i < items.length; i++) {
				if (items[i].type.startsWith('image/')) {
					const file = items[i].getAsFile();
					if (file) {
						event.preventDefault();

						// Check if adding one more file would exceed the limit
						if (images.length + 1 > maxImages) {
							return;
						}

						const validationError = validateImageFile(file);
						if (validationError) {
							return;
						}

						// Add file and create preview
						const newImages = singleImage ? [file] : [...images, file];
						const newPreviews = singleImage ? [] : [...imagePreviews];

						const reader = new FileReader();
						reader.onload = (e) => {
							newPreviews.push(e.target?.result as string);
							onImagesChange(newImages, newPreviews);
						};
						reader.readAsDataURL(file);
						return;
					}
				}
			}
		}

		// Check for URL
		const text = event.clipboardData?.getData('text');
		if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
			event.preventDefault();
			urlInput = text;
			await handleUrlSubmit();
		}
	}

	function removeImage(index: number) {
		const newImages = images.filter((_, i) => i !== index);
		const newPreviews = imagePreviews.filter((_, i) => i !== index);
		onImagesChange(newImages, newPreviews);
	}

	function clearAllImages() {
		onImagesChange([], []);
	}
</script>

<div class="space-y-2">
	{#if imagePreviews.length > 0}
		{#if singleImage}
			<div class="relative group inline-block">
				<img
					src={imagePreviews[0]}
					alt="Input preview"
					class="w-20 h-20 object-cover rounded-lg border border-gray-700"
				/>
				<button
					type="button"
					onclick={() => !isGenerating && clearAllImages()}
					class="absolute -top-1.5 -right-1.5 bg-error-600 hover:bg-error-700 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
					aria-label="Remove image"
					disabled={isGenerating}
				>
					<X class="w-3.5 h-3.5" />
				</button>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2 mb-1">
				{#each imagePreviews as preview, index (index)}
					<div class="relative group">
						<img src={preview} alt="Reference {index + 1}" class="w-16 h-16 object-cover rounded-lg border border-gray-700/60" />
						<button
							type="button"
							class="absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity {isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 cursor-pointer'}"
							onclick={() => !isGenerating && removeImage(index)}
							disabled={isGenerating}
						>
							<X class="h-3 w-3" />
						</button>
					</div>
				{/each}
				<!-- Add more button if not at max -->
				{#if images.length < maxImages}
					<label
						class="w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center cursor-pointer transition-colors {isGenerating ? 'opacity-40 cursor-not-allowed' : ''}"
					>
						<input
							type="file"
							accept={acceptedExtensions}
							multiple
							onchange={handleImageUpload}
							class="hidden"
							disabled={isGenerating || images.length >= maxImages}
						/>
						<Upload class="w-5 h-5 text-gray-600" />
					</label>
				{/if}
			</div>
			{#if images.length > 0}
				<button
					type="button"
					class="text-xs text-red-500/70 hover:text-red-400 transition-colors {isGenerating ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}"
					onclick={() => !isGenerating && clearAllImages()}
					disabled={isGenerating}
				>
					Clear all
				</button>
			{/if}
		{/if}
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	{#if imagePreviews.length === 0}
	<div
		aria-label="Image drop zone"
		bind:this={dropZone}
		class="border border-dashed rounded-lg px-4 py-3 transition-all {isDragging ? 'border-primary-500 bg-primary-900/10' : 'border-gray-700/70 hover:border-gray-600'}"
		ondragleave={handleDragLeave}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		onpaste={handlePaste}
		role="region"
		tabindex="0"
	>
		<div class="flex items-center gap-3">
			<label
				for="image-upload"
				class="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-md cursor-pointer transition-colors shrink-0 {images.length >= maxImages ? 'opacity-40 cursor-not-allowed' : ''}"
			>
				<Upload class="w-3.5 h-3.5" />
				Browse
			</label>
			<input
				id="image-upload"
				type="file"
				accept={acceptedExtensions}
				multiple
				onchange={handleImageUpload}
				class="hidden"
				disabled={isGenerating || images.length >= maxImages}
			/>

			<input
				type="text"
				bind:value={urlInput}
				placeholder="or paste image URL…"
				onkeydown={(e) => e.key === 'Enter' && handleUrlSubmit()}
				class="flex-1 bg-transparent border-0 text-xs text-gray-500 placeholder-gray-700 focus:outline-none min-w-0"
				disabled={isGenerating || images.length >= maxImages}
			/>
			{#if urlInput}
				<button
					type="button"
					onclick={handleUrlSubmit}
					class="text-xs text-primary-500 hover:text-primary-400 shrink-0"
					disabled={isGenerating || images.length >= maxImages}
				>
					Load
				</button>
			{/if}
		</div>
		<p class="text-xs text-gray-700 mt-1.5">Drop here or Ctrl+V anywhere on the page</p>
	</div>
	{/if}
</div>
