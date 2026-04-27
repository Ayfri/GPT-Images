import type { RemixVideoParams, VideoDuration, VideoModel, VideoResolution } from '$lib/types/video';
import OpenAI from 'openai';
import type { VideoCreateParams } from 'openai/resources/videos';

/**
 * Converts an ArrayBuffer to base64 string using chunked processing to avoid stack overflow
 * with large binary files
 */
function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
	const bytes = new Uint8Array(arrayBuffer);
	const chunkSize = 8192; // Process in 8KB chunks
	let result = '';

	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.slice(i, i + chunkSize);
		result += String.fromCharCode.apply(null, Array.from(chunk));
	}

	return btoa(result);
}

export interface GenerateVideoParams {
	duration?: VideoDuration;
	inputReference?: File;
	model: VideoModel;
	prompt: string;
	resolution?: VideoResolution;
}

export async function generateVideo(apiKey: string, params: GenerateVideoParams): Promise<string> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	try {
		const body: VideoCreateParams = {
			prompt: params.prompt,
			...(params.model !== undefined && { model: params.model }),
			...(params.resolution !== undefined && { size: params.resolution }),
			...(params.duration !== undefined && { seconds: params.duration.toString() as VideoCreateParams['seconds'] }),
			...(params.inputReference !== undefined && { input_reference: params.inputReference }),
		};
		const response = await client.videos.create(body);

		// Return the video ID which will be used to poll for completion
		return response.id;
	} catch (error: any) {
		if (error?.status) {
			throw new Error(error.message || `OpenAI API error: ${error.status}`);
		}
		throw new Error(error.message || 'Failed to generate video');
	}
}

export async function remixVideo(apiKey: string, params: RemixVideoParams): Promise<string> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	try {
		const response = await client.videos.remix(params.videoId, {
			prompt: params.prompt
		});

		// Return the new video ID which will be used to poll for completion
		return response.id;
	} catch (error: any) {
		if (error?.status) {
			throw new Error(error.message || `OpenAI API error: ${error.status}`);
		}
		throw new Error(error.message || 'Failed to remix video');
	}
}

export async function getVideoStatus(apiKey: string, videoId: string): Promise<{
	video_data?: string;
	status: 'completed' | 'failed' | 'in_progress' | 'queued';
	progress?: number;
	error?: {
		code: string;
		message: string;
	};
}> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	try {
		const response = await client.videos.retrieve(videoId);

		// If completed, download the video content
		if (response.status === 'completed') {
			try {
				const content = await client.videos.downloadContent(videoId);
				const arrayBuffer = await content.arrayBuffer();
				// Convert to base64 data URL using chunked approach to avoid stack overflow
				const base64 = arrayBufferToBase64(arrayBuffer);
				const videoDataUrl = `data:video/mp4;base64,${base64}`;

				return {
					video_data: videoDataUrl,
					status: response.status,
					progress: response.progress
				};
			} catch (downloadError: any) {
				// Video completed but download failed - return completed status without video data
				console.error('Failed to download completed video content:', downloadError);
				return {
					status: response.status,
					progress: response.progress,
					error: { code: 'DOWNLOAD_FAILED', message: 'Video completed but download failed' }
				};
			}
		}

		return {
			status: response.status,
			progress: response.progress,
			error: response.status === 'failed' ? response.error ?? undefined : undefined
		};
	} catch (error: any) {
		if (error?.status) {
			throw new Error(error.message || `OpenAI API error: ${error.status}`);
		}
		throw new Error(error.message || 'Failed to retrieve video status');
	}
}
