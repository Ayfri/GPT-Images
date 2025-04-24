export interface ImageGenerationParams {
  prompt: string;
  size?: string;
  quality?: 'low' | 'medium' | 'high';
  background?: 'auto' | 'transparent' | 'opaque';
}