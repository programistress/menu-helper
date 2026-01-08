import 'dotenv/config';
import OpenAI from "openai";
import { log } from './simple-logger.js';
import { rateLimiter } from './rate-limiter.js';

// Configure OpenAI client (lazy initialization)
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

// In-memory cache to reduce API calls and improve performance
const descriptionCache = new Map<string, string>();


/**
 * Generate a fresh dish description using OpenAI
 * This ensures we always use AI-generated descriptions 
 * 
 * @param name Dish name
 * @returns A concise OpenAI-generated dish description
 */
export async function getOpenAIDescription(name: string): Promise<string> {
    try {
        // Create a cache key
        const cacheKey = `${name}`.toLowerCase();

        // Check if we have this description cached in memory (session only)
        if (descriptionCache.has(cacheKey)) {
            const cachedDescription = descriptionCache.get(cacheKey);
            log(`[MEMORY CACHE] Hit for "${name}"`, 'openai');
            return cachedDescription!;
        }

        log(`[OPENAI API] Generating description for "${name}"`, 'openai');

        // Check if OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            log('OpenAI API key not configured for description generation', 'openai');
            return "No description available";
        }

        // Check rate limits and atomically increment if allowed
        if (!(await rateLimiter.checkAndIncrement('openai'))) {
            log('Rate limit reached for OpenAI, skipping description generation', 'openai');
            return "Description temporarily unavailable";
        }

        // Generate a high-quality description using OpenAI
        const response = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o", // Using the latest model
            messages: [
                {
                    role: "system",
                    content: `Write a 5-8 word flavor description. No dish name. No punctuation. Just key flavors/ingredients.`
                },
                {
                    role: "user",
                    content: `"${name}" - give 5-8 words describing taste/ingredients only. Example: "tender beef in rich red wine"`
                }
            ],
            max_tokens: 50,
            temperature: 0.7
        });

        // Extract and return the description
        const description = response.choices[0].message.content?.trim() || "No description available";
        log(`Generated OpenAI description for "${name}" (${description.length} chars)`, 'openai');

        // Cache the description for future use
        descriptionCache.set(cacheKey, description);

        return description;
    } catch (error) {
        // Check if this is a rate limit error from the API itself
        if (error instanceof Error && (
            error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.includes('too many requests') ||
            error.message.includes('quota exceeded')
        )) {
            log(`OpenAI API rate limit error: ${error.message}`, 'openai');
            return "Description temporarily unavailable due to rate limits";
        }

        log(`Error generating OpenAI description: ${error instanceof Error ? error.message : String(error)}`, 'openai');
        return "Description unavailable";
    }
}
