// DALL-E 3 and other compatible models often support standard sizes.
const OPENAI_COMPATIBLE_SIZE = "1024x1024"; 

export const generateWithOpenAICompatibleModel = async (prompt: string, apiKey: string, endpoint: string, model: string): Promise<string> => {
    try {
        if (!apiKey) {
            throw new Error("OpenAI API key is not configured. Please set it in the settings panel.");
        }

        const apiUrl = new URL(endpoint);
        apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, '')}/images/generations`;

        const response = await fetch(apiUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                n: 1,
                size: OPENAI_COMPATIBLE_SIZE,
                response_format: "b64_json",
                quality: "standard", // Can be "hd" for more detail, but standard is faster
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`${model} API Error:`, errorData);
            const errorMessage = errorData?.error?.message || `API failed with status: ${response.status}`;
            
            if (response.status === 401) {
                throw new Error(`Invalid API key (401). Please check your key.`);
            }
            if (response.status === 429) {
                if (errorMessage.includes('billing')) {
                   throw new Error(`Billing issue (429): Please check your credit balance or plan.`);
                }
                throw new Error(`Rate limit exceeded for ${model} API (429). Please try again later.`);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (data.data && data.data.length > 0 && data.data[0].b64_json) {
            return `data:image/png;base64,${data.data[0].b64_json}`;
        } else {
            throw new Error(`No image data received from ${model}.`);
        }

    } catch (error) {
        console.error(`Error calling ${model} API:`, error);
        if (error instanceof Error) {
            // Re-throw a more user-friendly error message.
            throw new Error(`${model} generation failed: ${error.message}`);
        }
        throw new Error(`An unknown error occurred while generating with ${model}.`);
    }
};
