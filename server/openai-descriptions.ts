import OpenAI from "openai";
import { log } from './simple-logger.js';
import { rateLimiter } from './rate-limiter.js';

// Configure OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 15000
});

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

        // Check if we have this description cached in memory
        if (descriptionCache.has(cacheKey)) {
            const cachedDescription = descriptionCache.get(cacheKey);
            log(`Using cached description for "${name}"`, 'openai');
            return cachedDescription!;
        }

        log(`Generating fresh OpenAI description for "${name}"`, 'openai');

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
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Using the latest model
            messages: [
                {
                    role: "system",
                    content: `You are a culinary expert creating concise, appetizing dish descriptions.
          Create descriptions that highlight the dish's key ingredients, flavor profile, and cooking style in 2-3 sentences.
          Focus on what makes the dish appealing and distinctive.
          Avoid excessive marketing language, overly technical jargon, or lengthy descriptions.
          Keep it informative yet enticing.`
                },
                {
                    role: "user",
                    content: `Please provide a concise 2-3 sentence description for the dish "${name}".
          Focus on main ingredients, flavor characteristics, and what makes this dish special.
          Keep your response under 100 words and be appetizing but not overly promotional.
          Only return the description text with no additional commentary.`
                }
            ],
            max_tokens: 150,
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
