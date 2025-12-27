import OpenAI from "openai";
import { log } from './simple-logger.js';
import { rateLimiter } from './rate-limiter.js';

// Configure OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 20000
});

// dish from a scanned menu
interface MenuDish {
    name: string;
    description?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
}

interface UserPreferences {
    dietary?: string[];
    cuisines?: string[];
    allergies?: string[];
    flavors?: string[];
    dislikedIngredients?: string[];
}

// what we return to frontend
interface DishRecommendation {
    name: string;
    description?: string;
    imageUrl?: string;
    matchScore?: number;
    matchReason?: string;
}

/**
 * Get dish recommendations using OpenAI
 * Selects the best matching dishes from a scanned menu based on user preferences
 * 
 * @param menuDishes Array of dishes detected from the menu
 * @param preferences User food preferences (dietary, cuisines, allergies, flavors, dislikedIngredients)
 * @param _deviceId Optional user device ID for analytics (unused)
 * @returns Array of 3 dish recommendations
 */
export async function getOpenAIRecommendations(
    menuDishes: MenuDish[],
    preferences: UserPreferences = {},
    _deviceId?: string
): Promise<DishRecommendation[]> {
    try {
        // Check if OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            log('OpenAI API key not configured for recommendations', 'openai');
            throw new Error("OpenAI API key is required for recommendations");
        }

        // Validate we have dishes to recommend from
        if (!menuDishes || menuDishes.length === 0) {
            log('No dishes provided for recommendations', 'openai');
            throw new Error("No dishes provided for recommendations");
        }

        // Check rate limits and atomically increment if allowed
        if (!(await rateLimiter.checkAndIncrement('openai'))) {
            log('Rate limit reached for OpenAI, unable to generate recommendations', 'openai');
            throw new Error("Rate limit reached for AI recommendations");
        }

        // Generate recommendations using OpenAI
        log(`Generating dish recommendations based on ${menuDishes.length} menu items`, 'openai');

        try {
            // Create a list of dish names and descriptions from the menu
            const dishList = menuDishes.map(dish => ({
                name: dish.name,
                description: dish.description || ''
            }));

            // Convert to JSON string for the prompt
            const dishListJSON = JSON.stringify(dishList, null, 2);

            // Format user preferences for the prompt
            const formattedDietary = preferences.dietary && preferences.dietary.length > 0
                ? `Dietary preferences: ${preferences.dietary.join(', ')}.`
                : '';

            const formattedCuisines = preferences.cuisines && preferences.cuisines.length > 0
                ? `Favorite cuisines: ${preferences.cuisines.join(', ')}.`
                : '';

            const formattedFlavors = preferences.flavors && preferences.flavors.length > 0
                ? `Flavor preferences: ${preferences.flavors.join(', ')}.`
                : '';

            // These are exclusions - dishes to avoid
            const formattedAllergies = preferences.allergies && preferences.allergies.length > 0
                ? `ALLERGIES (MUST AVOID): ${preferences.allergies.join(', ')}.`
                : '';

            const formattedDisliked = preferences.dislikedIngredients && preferences.dislikedIngredients.length > 0
                ? `Disliked ingredients (avoid if possible): ${preferences.dislikedIngredients.join(', ')}.`
                : '';

            // Combine all preference information
            const userPreferencesText = [
                formattedDietary,
                formattedCuisines,
                formattedFlavors,
                formattedAllergies,
                formattedDisliked
            ].filter(text => text.length > 0).join(' ');

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are a culinary recommendation expert. Your task is to select dishes from a provided menu that best match the user's food preferences, dietary restrictions, and taste preferences.

CRITICAL INSTRUCTIONS:
1. You MUST ONLY select dishes from the exact menu list provided to you
2. Do NOT invent or suggest dishes that are not in the provided list
3. Do NOT recommend dishes that contain ingredients the user is ALLERGIC to - this is a safety requirement
4. Avoid dishes with ingredients the user has listed as disliked
5. Prioritize dishes that match the user's dietary preferences (vegetarian, vegan, etc.)
6. Favor dishes from cuisines the user enjoys
7. Consider flavor preferences when making selections
8. Return exactly 3 dish recommendations, ranked by match quality
9. For each dish, provide a SPECIFIC, CONCISE reason (1-2 sentences) explaining the match
10. Match reasons should ONLY reference preferences the user explicitly mentioned
11. Higher scoring dishes should have clearer connections to stated preferences`
                    },
                    {
                        role: "user",
                        content: `Here is the menu:

${dishListJSON}

My food preferences:
${userPreferencesText || "I'm open to trying various dishes."}

From ONLY this menu above, recommend the 3 dishes that would best match my preferences.

Format your response as a JSON object with a "recommendations" array containing ONLY dishes from this menu.
Each recommendation should include:
- name: The exact dish name from the menu
- matchScore: A number between 1-100 indicating how well this dish matches my preferences
- matchReason: A SPECIFIC, CONCISE reason (1-2 sentences) why this dish matches my preferences. Explain exactly HOW it connects to my stated preferences.

IMPORTANT: 
- You can ONLY recommend dishes from the menu I provided
- Do NOT recommend dishes that may contain my allergens
- Rank dishes by match quality (best match first)

Example format:
{
  "recommendations": [
    {
      "name": "Dish Name From Menu",
      "matchScore": 95,
      "matchReason": "This dish perfectly matches your preference for spicy Thai flavors with its authentic curry base and fresh herbs."
    }
  ]
}

Only return the JSON object with no additional text.`
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 800,
                temperature: 0.7
            });

            // Parse the recommendations
            const content = response.choices[0].message.content;
            if (!content) {
                log("Empty response from OpenAI API", 'openai');
                throw new Error("OpenAI API returned an empty response");
            }

            try {
                // Log the raw response for debugging
                log(`Raw OpenAI response: ${content.substring(0, 200)}...`, 'openai');

                const parsed = JSON.parse(content);

                // Check if we have recommendations in the expected format
                if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
                    log(`Successfully parsed ${parsed.recommendations.length} recommendations from OpenAI`, 'openai');

                    // Create a map of dishes from the menu for easy lookup
                    const menuDishesMap = new Map<string, MenuDish>();
                    menuDishes.forEach(dish => {
                        const key = dish.name.toLowerCase().trim();
                        menuDishesMap.set(key, dish);
                    });

                    // Validate that each recommendation is from the menu
                    // And enhance with original properties (like imageUrl, description) from the menu
                    const validatedRecommendations = parsed.recommendations
                        .filter((rec: any) => {
                            if (!rec.name) return false;

                            const key = rec.name.toLowerCase().trim();
                            const isInMenu = menuDishesMap.has(key);

                            if (!isInMenu) {
                                log(`Filtering out recommendation "${rec.name}" as it's not in the menu`, 'openai');
                            }

                            return isInMenu;
                        })
                        .slice(0, 3) // Ensure we only return 3 recommendations
                        .map((rec: any): DishRecommendation => {
                            // Enhance the recommendation with original properties from the menu
                            const key = rec.name.toLowerCase().trim();
                            const originalDish = menuDishesMap.get(key);

                            return {
                                name: originalDish?.name || rec.name,
                                description: originalDish?.description,
                                imageUrl: originalDish?.imageUrl,
                                matchScore: rec.matchScore,
                                matchReason: rec.matchReason || `This dish scores ${rec.matchScore || 75}/100 for your preferences.`
                            };
                        });

                    log(`Validated ${validatedRecommendations.length} recommendations are from the menu`, 'openai');
                    return validatedRecommendations;
                }

                log("No valid recommendations structure found in OpenAI response", 'openai');
                throw new Error("Could not extract valid dish recommendations from OpenAI response");
                
            } catch (parseError) {
                log(`Error parsing OpenAI recommendations: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 'openai');
                throw new Error("Failed to parse OpenAI dish recommendations");
            }
        } catch (apiError) {
            log(`Error from OpenAI API: ${apiError instanceof Error ? apiError.message : String(apiError)}`, 'openai');
            throw new Error(`Failed to generate dish recommendations: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
    } catch (error) {
        log(`Error generating OpenAI recommendations: ${error instanceof Error ? error.message : String(error)}`, 'openai');
        throw error;
    }
}
