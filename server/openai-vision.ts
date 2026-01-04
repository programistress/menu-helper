import 'dotenv/config';
import OpenAI from "openai";
import { log } from "./simple-logger.js";
import { rateLimiter } from "./rate-limiter.js";
import { analyzeImage } from "./vision.js";

// Configure OpenAI client (lazy initialization to ensure env vars are loaded)
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 2,
            timeout: 15000
        });
    }
    return openai;
}

// This flag allows easier turning on/off of the OpenAI API
const ENABLE_OPENAI = process.env.ENABLE_OPENAI !== "false";


/**
 * Check if the OpenAI API key is configured
 * @returns boolean indicating if the API key is available
 */
function isOpenAIConfigured(): boolean {
    const apiKey = process.env.OPENAI_API_KEY;
    return !!apiKey && apiKey.length > 5 && apiKey !== "your-api-key-here"; // Basic validation
}

/**
 * Main function to analyze a restaurant menu image and extract dish names
 * Implements rate limiting and cost controls with fallback to Google Vision
 */
export async function analyzeMenuImage(base64Image: string): Promise<{
    dishNames: string[],
    isMenu: boolean
}> {
    try {
        // if openai is disabled in env
        if (!ENABLE_OPENAI) {
            log("OpenAI API is disabled by configuration", "vision");
            return await fallbackToGoogleVision(base64Image);
        }

        // if openai api key is not properly configured
        if (!isOpenAIConfigured()) {
            log("OpenAI API key is not properly configured", "vision");
            return await fallbackToGoogleVision(base64Image);
        }

        // Check rate limits and atomically increment if allowed
        if (!(await rateLimiter.checkAndIncrement('openai'))) {
            log("Rate limit reached for OpenAI API. Using fallback.", "vision");
            return await fallbackToGoogleVision(base64Image);
        }

        log("Processing image with OpenAI Vision API", "vision");

        const response = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a precise menu reader assistant. Your task is to identify dish names from restaurant menu photos. Extract the names of dishes/food items you can clearly read. Do not include prices, or section headers. If text is unclear or partially visible, skip it."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "This is a photo of a restaurant menu. Extract all dish names that are clearly visible and readable.\n\nRespond with a JSON object containing:\n\n1. 'dishNames': An array of dish names exactly as written on the menu. Include only food/drink item names, not prices, descriptions, or category headers.\n\n2. 'isMenu': A boolean - true if this image shows a restaurant menu, false otherwise.\n\nIMPORTANT: Only include dish names you can read with certainty. Do not guess or invent names. If the image is not a menu, return an empty array for dishNames and false for isMenu."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 800
        });

        // Parse the response
        const content = response.choices[0].message.content || '';
        let result;

        try {
            result = JSON.parse(content);
        } catch (error) {
            log(`Error parsing OpenAI response: ${error}`, "vision");
            // Fallback to Google Vision if JSON parsing fails
            return await fallbackToGoogleVision(base64Image);
        }

        log(`OpenAI identified ${result.dishNames?.length || 0} dishes`, "vision");

        return {
            dishNames: result.dishNames || [],
            isMenu: result.isMenu || false
        };
    } catch (error) {
        // Check if this is a rate limit error from the API itself
        if (error instanceof Error && (
            error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.includes('too many requests') ||
            error.message.includes('quota exceeded')
        )) {
            log(`OpenAI Vision API rate limit error: ${error.message}`, "vision");
            return await fallbackToGoogleVision(base64Image);
        }

        log(`Error analyzing image with OpenAI: ${error instanceof Error ? error.message : String(error)}`, "vision");

        // Try the fallback option if OpenAI fails
        return await fallbackToGoogleVision(base64Image);
    }
}

/**
 * Fallback function using Google Vision API instead of OpenAI
 * This provides a more cost-effective option when OpenAI is unavailable
 */
async function fallbackToGoogleVision(base64Image: string): Promise<{
    dishNames: string[],
    isMenu: boolean
}> {
    try {
        log("Falling back to Google Vision API for image analysis", "vision");

        // Check rate limits and atomically increment if allowed
        if (!(await rateLimiter.checkAndIncrement('google-vision'))) {
            log("Rate limit reached for Google Vision fallback API", "vision");
            return { dishNames: [], isMenu: false };
        }

        const visionResult = await analyzeImage(base64Image);

        // Extract potential dish names from the Google Vision text
        const text = visionResult.text || '';

        // Very basic extraction of potential dish names from the text
        // This is a simple implementation - dish name extraction from raw text
        // would need more sophisticated NLP in a production environment
        const lines = text.split('\n').filter((line: string) => line.trim().length > 0);

        // Filter lines that might be dish names (more than 2 words, less than 50 chars)
        const potentialTitles = lines.filter((line: string) => {
            const words = line.trim().split(/\s+/);
            return words.length >= 2 && words.length <= 10 && line.length <= 50;
        });

        log(`Google Vision extracted ${potentialTitles.length} potential dish names`, "vision");

        return {
            dishNames: potentialTitles,
            isMenu: visionResult.isMenu || false
        };
    } catch (error) {
        log(`Error in Google Vision fallback: ${error instanceof Error ? error.message : String(error)}`, "vision");

        // Return empty results if all methods fail
        return {
            dishNames: [],
            isMenu: false
        };
    }
}  