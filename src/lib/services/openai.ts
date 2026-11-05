import OpenAI from 'openai';
import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming, ImagesResponse } from 'openai/resources/images';

export interface ImageResult {
	images: string[];
	svgUsage?: ImagesResponse.SvgUsage;
	usage?: ImagesResponse.Usage;
}

function toResult({ data, svg_usage, usage }: ImagesResponse): ImageResult {
	const images = (data ?? []).map((item) => item.b64_json).filter((b64) => b64 !== undefined);
	if (images.length === 0) throw new Error('API did not return image data');
	return { images, svgUsage: svg_usage, usage };
}

export async function generateImage(apiKey: string, params: ImageGenerateParamsNonStreaming): Promise<ImageResult> {
	return toResult(await new OpenAI({ apiKey, dangerouslyAllowBrowser: true }).images.generate(params));
}

/** No selectable model takes input_fidelity: gpt-image-2 and 2.5 always use high fidelity and 2.6 rejects it (verified 2026-11-05), so edits never send it. */
export async function editImage(apiKey: string, params: ImageEditParamsNonStreaming): Promise<ImageResult> {
	return toResult(await new OpenAI({ apiKey, dangerouslyAllowBrowser: true }).images.edit(params));
}
