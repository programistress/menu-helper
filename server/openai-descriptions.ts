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
            maxRetries: 3, // Increased from 2
            timeout: 30000 // Increased from 15s to 30s
        });
    }
    return openai;
}

// In-memory cache to reduce API calls and improve performance
const descriptionCache = new Map<string, string>();
const detailedDescriptionCache = new Map<string, string>();


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

/**
 * Generate a detailed, rich description for a dish - used when user clicks on a dish
 * This provides more comprehensive information including taste, texture, origin, and pairing suggestions
 * 
 * @param name Dish name
 * @param originalDescription Optional original description from the menu (for context)
 * @returns A detailed, engaging description
 */
export async function getDetailedDescription(
    name: string,
    originalDescription?: string
): Promise<string> {
    try {
        // Create a cache key including original description context
        const cacheKey = `detailed:${name}:${originalDescription || ''}`.toLowerCase();

        // Check cache first
        if (detailedDescriptionCache.has(cacheKey)) {
            const cached = detailedDescriptionCache.get(cacheKey);
            log(`[MEMORY CACHE] Hit for detailed "${name}"`, 'openai');
            return cached!;
        }

        log(`[OPENAI API] Generating detailed description for "${name}"`, 'openai');

        // Check if OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            log('OpenAI API key not configured for detailed description', 'openai');
            return originalDescription || "No detailed description available";
        }

        // Check rate limits
        if (!(await rateLimiter.checkAndIncrement('openai'))) {
            log('Rate limit reached for OpenAI, skipping detailed description', 'openai');
            return originalDescription || "Detailed description temporarily unavailable";
        }

        // Build the prompt with context if available
        const contextPrompt = originalDescription
            ? `The menu describes it as: "${originalDescription}". Use this as reference but expand on it.`
            : '';

        const response = await getOpenAIClient().chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a friendly server describing dishes naturally, like you're talking to a friend. Keep it SHORT, casual, and real - 1-2 sentences max. No fancy language, no flowery words.`
                },
                {
                    role: "user",
                    content: `Describe "${name}" to a customer. ${contextPrompt}

Write like a REAL person talks:
- Be direct and simple
- NO recommendation phrases ("You've got to try", "You'll love", "Delightful")
- NO pretentious words ("nestled", "adorned", "features", "boasts")
- Just say what it is and what makes it good

GOOD examples:
- "Tender beef braised in red wine with mushrooms and onions. Really rich and savory."
- "Crispy tempura shrimp with avocado and spicy mayo. Super fresh and crunchy."
- "Chicken nanban and braised pork over sushi rice. Packed with umami flavor."

BAD examples:
- "A delightful fusion where juicy chicken meets richly flavored pork, all nestled on a bed of rice."
- "You'll love this dish! It features tender beef adorned with pearl onions."

Keep it to 1-2 short sentences. Talk like a normal person.`
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        });

        const description = response.choices[0].message.content?.trim() ||
            originalDescription ||
            "No detailed description available";

        log(`Generated detailed description for "${name}" (${description.length} chars)`, 'openai');

        // Cache it
        detailedDescriptionCache.set(cacheKey, description);

        return description;
    } catch (error) {
        // Handle rate limit errors
        if (error instanceof Error && (
            error.message.includes('rate limit') ||
            error.message.includes('429')
        )) {
            log(`OpenAI rate limit for detailed description: ${error.message}`, 'openai');
            return originalDescription || "Detailed description temporarily unavailable";
        }

        log(`Error generating detailed description: ${error instanceof Error ? error.message : String(error)}`, 'openai');
        return originalDescription || "Detailed description unavailable";
    }
}
