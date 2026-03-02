import type { ImageBackground, ImageModel, ImageQuality, ImageSize, InputFidelity, OutputFormat } from '$lib/types/image';
import OpenAI from 'openai';
import type {
	ImageEditParamsNonStreaming,
	ImageGenerateParamsNonStreaming
} from 'openai/resources/images';

export interface GenerateImageParams {
	background?: ImageBackground;
	model: ImageModel;
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
		const response = await client.images.generate({
			model: params.model,
			prompt: params.prompt,
			quality: params.quality,
			size: params.size,
			n: params.n,
			...(params.background !== undefined && { background: params.background }),
			...(params.output_compression !== undefined && { output_compression: params.output_compression }),
			...(params.output_format !== undefined && { output_format: params.output_format }),
		} as ImageGenerateParamsNonStreaming);

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
	model: ImageModel;
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

		const response = await client.images.edit({
			model: params.model,
			image: imageFile,
			prompt: params.prompt,
			size: params.size,
			n: params.n,
			quality: params.quality,
			...(params.input_fidelity !== undefined && { input_fidelity: params.input_fidelity }),
			...(params.output_compression !== undefined && { output_compression: params.output_compression }),
			...(params.output_format !== undefined && { output_format: params.output_format }),
			...(params.background !== undefined && { background: params.background }),
			...(params.mask && { mask: params.mask }),
		} as ImageEditParamsNonStreaming);

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
