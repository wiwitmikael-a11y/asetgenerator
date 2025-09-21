import { GoogleGenAI } from "@google/genai";

const SUPPORTED_ASPECT_RATIOS: Record<string, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

const getClosestAspectRatio = (width: number, height: number): string => {
    if (height === 0) return "1:1";
    const targetRatio = width / height;
    
    return Object.keys(SUPPORTED_ASPECT_RATIOS).reduce((prev, curr) => {
        const prevDiff = Math.abs(SUPPORTED_ASPECT_RATIOS[prev] - targetRatio);
        const currDiff = Math.abs(SUPPORTED_ASPECT_RATIOS[curr] - targetRatio);
        return currDiff < prevDiff ? curr : prev;
    });
};

export const generateImageAsset = async (prompt: string, width: number, height: number, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured. Please set it in the settings panel.");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    try {
        const aspectRatio = getClosestAspectRatio(width, height);

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio,
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error("No image was generated.");
        }

    } catch (error) {
        console.error("Error generating image with Gemini API:", error);
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
                if (errorMessage.includes('limit: 0')) {
                     throw new Error("API Key Error (429): Your quota is 0 requests/minute. Please verify your Google AI Studio project has billing enabled and the API is active.");
                }
                throw new Error("Rate limit exceeded (429). You may have exceeded your quota. Please check your plan/billing and try again later.");
            }
            if (errorMessage.includes('api key not valid')) {
                throw new Error("Invalid Gemini API key. Please check your key in the settings.");
            }
        }
        throw new Error("Failed to generate image. The API returned an unexpected error.");
    }
};

/**
 * Creates a deterministic numeric seed from a string.
 * This ensures that the same prompt will generate the same seed,
 * leading to more consistent image generation from APIs that support seeding.
 * @param str The input string (e.g., the generation prompt).
 * @returns A non-negative integer seed.
 */
const stringToSeed = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const generatePlaceholder = (prompt: string, width: number, height: number): Promise<string> => {
    return new Promise((resolve) => {
        console.warn(`Generating fallback placeholder for prompt: "${prompt}"`);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // A dark, reddish background to indicate an error
            ctx.fillStyle = '#4a2525';
            ctx.fillRect(0, 0, width, height);

            // A border to make it look like a proper asset box
            ctx.strokeStyle = '#8a4a4a';
            ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.025);
            ctx.strokeRect(0, 0, width, height);

            // Text styling for better readability
            ctx.fillStyle = '#fde8e8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fontFamily = 'ui-sans-serif, system-ui, sans-serif';

            // Main error message - font size scales with asset size
            const mainFontSize = Math.max(12, Math.min(width / 5, height / 4));
            ctx.font = `bold ${mainFontSize}px ${fontFamily}`;
            ctx.fillText('FAILED', width / 2, height * 0.45);

            // Dimensions text below the main message
            const detailFontSize = Math.max(10, Math.min(width / 8, height / 6));
            ctx.font = `${detailFontSize}px ${fontFamily}`;
            ctx.fillText(`${width}x${height}`, width / 2, height * 0.65);
        }
        
        resolve(canvas.toDataURL('image/png'));
    });
};

export const generateWithPublicModel = async (
    prompt: string, 
    width: number, 
    height: number, 
    onRetry?: (attempt: number, delay: number) => void
): Promise<string> => {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = stringToSeed(prompt);
            // FIX: Swapped kreatise.ai with pollinations.ai, which supports client-side CORS requests.
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}`;
            
            const response = await fetch(imageUrl);
            
            if (response.ok) {
                const blob = await response.blob();
                if (blob.type.startsWith('image/')) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => reader.result ? resolve(reader.result as string) : reject(new Error("Failed to convert image blob to base64."));
                        reader.onerror = () => reject(new Error("Error reading image blob."));
                        reader.readAsDataURL(blob);
                    });
                } else {
                    lastError = new Error(`Public model returned non-image content (type: ${blob.type}).`);
                }
            } else {
                 lastError = new Error(`Public model API failed with status: ${response.status}.`);
                 if (response.status < 500 && response.status !== 429) {
                     break; 
                 }
            }
            
            if (attempt < MAX_RETRIES) {
                 const delay = Math.pow(2, attempt) * 1000;
                 if (onRetry) onRetry(attempt, delay);
                 await new Promise(resolve => setTimeout(resolve, delay));
            }

        } catch (error) {
            console.error(`Attempt ${attempt} for public model failed with network error:`, error);
            lastError = error instanceof Error ? error : new Error("An unknown network error occurred.");
            if (attempt < MAX_RETRIES) {
                 const delay = Math.pow(2, attempt) * 1000;
                 if (onRetry) onRetry(attempt, delay);
                 await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // If all retries fail, generate a local, informative placeholder image.
    // This is more reliable than a second network-based fallback.
    return generatePlaceholder(prompt, width, height);
};