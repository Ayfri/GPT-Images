import type { ImageGenerationParams, ImageEditParams } from '$lib/types/image';

const GENERATION_API_URL = 'https://api.openai.com/v1/images/generations';
const EDIT_API_URL = 'https://api.openai.com/v1/images/edits';

export async function generateImage(apiKey: string, params: ImageGenerationParams): Promise<string[]> {
	const requestBody: any = {
		model: 'gpt-image-1',
		prompt: params.prompt,
		quality: params.quality,
		size: params.size,
		n: params.n
	};

	// Only add parameters that are valid for generation
	if (params.output_compression !== undefined) {
		requestBody.output_compression = params.output_compression;
	}
	if (params.output_format !== undefined) {
		requestBody.output_format = params.output_format;
	}
	if (params.background !== undefined) {
		requestBody.background = params.background;
	}

	// NOTE: input_fidelity is NOT supported for generation, only for editing

	const response = await fetch(GENERATION_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to generate image');
	}

	const data = await response.json();
	if (!data.data || data.data.length === 0) {
		throw new Error('API did not return image data');
	}

	// Return array of base64 images
	return data.data.map((item: any) => item.b64_json);
}

export async function editImage(apiKey: string, params: ImageEditParams): Promise<string[]> {
	const formData = new FormData();

	// Add all images to the form data
	params.images.forEach((image, index) => {
		formData.append(`image`, image);
	});

	formData.append('prompt', params.prompt);
	formData.append('model', 'gpt-image-1');
	formData.append('size', params.size);
	formData.append('n', params.n.toString());
	formData.append('quality', params.quality);

	// Add optional parameters that are valid for editing
	if (params.input_fidelity !== undefined) {
		formData.append('input_fidelity', params.input_fidelity);
	}
	if (params.output_compression !== undefined) {
		formData.append('output_compression', params.output_compression.toString());
	}
	if (params.output_format !== undefined) {
		formData.append('output_format', params.output_format);
	}
	if (params.background !== undefined) {
		formData.append('background', params.background);
	}

	// Add mask if provided
	if (params.mask) {
		formData.append('mask', params.mask);
	}

	const response = await fetch(EDIT_API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`
		},
		body: formData
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'Failed to edit image');
	}

	const data = await response.json();
	if (!data.data || data.data.length === 0) {
		throw new Error('API did not return image data');
	}

	// Return array of base64 images
	return data.data.map((item: any) => item.b64_json);
}
