import type { ImageBackground, ImageQuality, ImageSize, InputFidelity, OutputFormat } from '$lib/types/image';
import OpenAI from 'openai';
import type {
	ImageEditParamsNonStreaming,
	ImageGenerateParamsNonStreaming
} from 'openai/resources/images';

export interface GenerateImageParams {
	background?: ImageBackground;
	n: number;
	output_compression?: number;
	output_format?: OutputFormat;
	prompt: string;
	quality: ImageQuality;
	size: ImageSize;
}

export async function generateImage(apiKey: string, params: GenerateImageParams): Promise<string[]> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	try {
		const generateParams: ImageGenerateParamsNonStreaming = {
			model: 'gpt-image-1',
			prompt: params.prompt,
			quality: params.quality,
			size: params.size,
			n: params.n,
			response_format: 'b64_json'
		};

		// Ajouter les paramètres optionnels seulement s'ils sont définis
		if (params.background !== undefined) {
			generateParams.background = params.background;
		}
		if (params.output_compression !== undefined) {
			generateParams.output_compression = params.output_compression;
		}
		if (params.output_format !== undefined) {
			generateParams.output_format = params.output_format;
		}

		const response = await client.images.generate(generateParams);

		if (!response.data || response.data.length === 0) {
			throw new Error('API did not return image data');
		}

		// Return array of base64 images
		return response.data.map(item => {
			if (!item.b64_json) {
				throw new Error('Image data is not in base64 format');
			}
			return item.b64_json;
		});
	} catch (error: any) {
		if (error?.status) {
			throw new Error(error.message || `OpenAI API error: ${error.status}`);
		}
		throw new Error(error.message || 'Failed to generate image');
	}
}

export interface EditImageParams {
	background?: ImageBackground;
	images: File[];
	input_fidelity?: InputFidelity;
	mask?: File;
	n: number;
	output_compression?: number;
	output_format?: OutputFormat;
	prompt: string;
	quality: ImageQuality;
	size: ImageSize;
}

export async function editImage(apiKey: string, params: EditImageParams): Promise<string[]> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	try {
		// For editing, we need to use the first image as the base
		const imageFile = params.images[0];
		if (!imageFile) {
			throw new Error('At least one image is required for editing');
		}

		const editParams: ImageEditParamsNonStreaming = {
			model: 'gpt-image-1',
			image: imageFile,
			prompt: params.prompt,
			size: params.size,
			n: params.n,
			quality: params.quality,
			response_format: 'b64_json'
		};

		// Add optional parameters that are valid for editing
		if (params.input_fidelity !== undefined) {
			editParams.input_fidelity = params.input_fidelity;
		}
		if (params.output_compression !== undefined) {
			editParams.output_compression = params.output_compression;
		}
		if (params.output_format !== undefined) {
			editParams.output_format = params.output_format;
		}
		if (params.background !== undefined) {
			editParams.background = params.background;
		}
		if (params.mask) {
			editParams.mask = params.mask;
		}

		const response = await client.images.edit(editParams);

		if (!response.data || response.data.length === 0) {
			throw new Error('API did not return image data');
		}

		// Return array of base64 images
		return response.data.map(item => {
			if (!item.b64_json) {
				throw new Error('Image data is not in base64 format');
			}
			return item.b64_json;
		});
	} catch (error: any) {
		if (error?.status) {
			throw new Error(error.message || `OpenAI API error: ${error.status}`);
		}
		throw new Error(error.message || 'Failed to edit image');
	}
}
