const API_URL = 'https://api.openai.com/v1/images/generations';

export async function generateImage(apiKey: string, params: ImageGenerationParams): Promise<string[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: params.prompt,
      quality: params.quality, // Use quality directly from params
      size: params.size, // Use size directly from params
      n: params.n // Number of images to generate
    })
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

// Define the type for parameters
export interface ImageGenerationParams {
  prompt: string;
  quality: 'low' | 'medium' | 'high'; // Use the correct quality values for gpt-image-1
  size: '1024x1024' | '1024x1536' | '1536x1024'; // Use the correct size values for gpt-image-1
  n: number; // Number of images to generate (1-10)
}
