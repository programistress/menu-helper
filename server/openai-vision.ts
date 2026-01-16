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
            maxRetries: 3, // Increased from 2
            timeout: 60000 // Increased from 15s to 60s for vision API
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

// Dish extracted from menu with optional description
export interface ExtractedDish {
    name: string;
    originalDescription?: string; // Description from the menu itself (if available)
}

/**
 * Main function to analyze a restaurant menu image and extract dish names with descriptions
 * Implements rate limiting and cost controls with fallback to Google Vision
 */
export async function analyzeMenuImage(base64Image: string): Promise<{
    dishes: ExtractedDish[],
    dishNames: string[], // Keep for backward compatibility
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
                    content: "You are a precise menu reader and translator. Extract dish names AND their descriptions from menu photos. ALWAYS translate to English. Combine food-type categories with items (Toast, Salad, Bowl, etc). IGNORE generic categories (Main Dish, Appetizers, Sides, Starters, Mains, etc)."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract dish names AND descriptions from this menu.

IMPORTANT: If the menu is in a foreign language (Chinese, Japanese, Korean, Spanish, French, etc.), TRANSLATE all dish names to English. Use the common English name for the dish.

Examples of translation:
- "宫保鸡丁" → "Kung Pao Chicken"
- "麻婆豆腐" → "Mapo Tofu"  
- "炒饭" → "Fried Rice"
- "担担面" → "Dan Dan Noodles"
- "Pad Thai" → "Pad Thai" (already English/common name)

For EACH dish, extract:
1. The dish NAME (translated to English)
2. The DESCRIPTION if visible on the menu (ingredients, preparation details). If no description is visible, omit it.

APPEND these food-type categories to items:
Toast, Salad, Bowl, Sandwich, Burger, Wrap, Pizza, Pasta, Soup, Taco, Curry, Steak, Smoothie, Coffee, Juice

Examples: "Avocado" under "TOAST" → "Avocado Toast"

IGNORE these generic categories (don't append):
Main Dish, Mains, Appetizers, Starters, Sides, Entrees, Specials, Chef's Picks, Favorites, Small Plates, Large Plates, Breakfast, Lunch, Dinner

Respond with JSON:
{
  "dishes": [
    {"name": "Kung Pao Chicken", "originalDescription": "chicken, peanuts, dried chili"},
    {"name": "Duck Burger", "originalDescription": "crispy duck, mango chutney, arugula, brioche bun"},
    {"name": "Caesar Salad", "originalDescription": "lettuce, romaine, tomatoes, croutons, parmesan cheese"}
  ],
  "isMenu": true/false
}

ONLY include originalDescription if the menu shows one.
All names MUST be in English.`
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
            max_tokens: 1500
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

        // Handle both new format (dishes array) and legacy format (dishNames array)
        const dishes: ExtractedDish[] = result.dishes ||
            (result.dishNames || []).map((name: string) => ({ name }));

        // Extract dish names for backward compatibility
        const dishNames = dishes.map(d => d.name);

        log(`OpenAI identified ${dishes.length} dishes (${dishes.filter(d => d.originalDescription).length} with descriptions)`, "vision");

        return {
            dishes,
            dishNames,
            isMenu: result.isMenu || false
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for unsupported image format - this should be shown to user
        if (errorMessage.includes('unsupported image') ||
            errorMessage.includes('image format') ||
            errorMessage.includes("['png', 'jpeg', 'gif', 'webp']")) {
            log(`OpenAI Vision API unsupported image format: ${errorMessage}`, "vision");
            throw new Error('Unsupported image format. Please upload a PNG, JPEG, GIF, or WebP image.');
        }

        // Check if this is a rate limit error from the API itself
        if (error instanceof Error && (
            errorMessage.includes('rate limit') ||
            errorMessage.includes('429') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('quota exceeded')
        )) {
            log(`OpenAI Vision API rate limit error: ${errorMessage}`, "vision");
            return await fallbackToGoogleVision(base64Image);
        }

        log(`Error analyzing image with OpenAI: ${errorMessage}`, "vision");

        // Try the fallback option if OpenAI fails
        return await fallbackToGoogleVision(base64Image);
    }
}

/**
 * Fallback function using Google Vision API instead of OpenAI
 * This provides a more cost-effective option when OpenAI is unavailable
 */
async function fallbackToGoogleVision(base64Image: string): Promise<{
    dishes: ExtractedDish[],
    dishNames: string[],
    isMenu: boolean
}> {
    try {
        log("Falling back to Google Vision API for image analysis", "vision");

        // Check rate limits and atomically increment if allowed
        if (!(await rateLimiter.checkAndIncrement('google-vision'))) {
            log("Rate limit reached for Google Vision fallback API", "vision");
            return { dishes: [], dishNames: [], isMenu: false };
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

        // Convert to ExtractedDish format (no descriptions from Google Vision)
        const dishes: ExtractedDish[] = potentialTitles.map(name => ({ name }));

        return {
            dishes,
            dishNames: potentialTitles,
            isMenu: visionResult.isMenu || false
        };
    } catch (error) {
        log(`Error in Google Vision fallback: ${error instanceof Error ? error.message : String(error)}`, "vision");

        // Return empty results if all methods fail
        return {
            dishes: [],
            dishNames: [],
            isMenu: false
        };
    }
}  