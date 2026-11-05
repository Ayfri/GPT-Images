import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming, ImagesResponse } from 'openai/resources/images';

export interface ImageResult {
	images: string[];
	size?: ImagesResponse['size'];
	svgUsage?: ImagesResponse.SvgUsage;
	usage?: ImagesResponse.Usage;
}

const part = (value: unknown) => (value instanceof Blob ? value : String(value));

/** Encodes flat fields only: Files stay Files, arrays repeat as `key[]`, other values are stringified, so a nested object would become "[object Object]". */
function toForm(params: ImageEditParamsNonStreaming) {
	const form = new FormData();
	const fields: [string, unknown][] = Object.entries(params);
	for (const [key, value] of fields) {
		if (value == null) continue;
		if (Array.isArray(value)) for (const entry of value) form.append(`${key}[]`, part(entry));
		else form.append(key, part(value));
	}
	return form;
}

/** The SDK's automatic retries on 429 and 5xx are not reproduced: a failed request surfaces its error right away. */
async function request(apiKey: string, endpoint: 'generations' | 'edits', body: FormData | ImageGenerateParamsNonStreaming): Promise<ImageResult> {
	const isForm = body instanceof FormData;
	const res = await fetch(`https://api.openai.com/v1/images/${endpoint}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, ...(!isForm && { 'Content-Type': 'application/json' }) },
		body: isForm ? body : JSON.stringify(body)
	}).catch((cause: unknown) => {
		throw new Error('Could not reach the OpenAI API. Check your connection and try again.', { cause });
	});
	/** Non-JSON error pages (proxies, gateways) parse to an empty object and HTTP/2 has no statusText, so the status code is the last-resort message. */
	const json: ImagesResponse & { error?: { message: string } } = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);

	const images = (json.data ?? []).map((item) => item.b64_json).filter((b64) => b64 !== undefined);
	if (images.length === 0) throw new Error('The API returned no image data');
	return { images, size: json.size, svgUsage: json.svg_usage, usage: json.usage };
}

export const generateImage = (apiKey: string, params: ImageGenerateParamsNonStreaming) => request(apiKey, 'generations', params);

/** No selectable model takes input_fidelity: gpt-image-2 and 2.5 always use high fidelity and 2.6 rejects it (verified 2026-11-05), so edits never send it. */
export const editImage = (apiKey: string, params: ImageEditParamsNonStreaming) => request(apiKey, 'edits', toForm(params));
