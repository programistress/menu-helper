import { log } from './simple-logger.js';
import { rateLimiter } from './rate-limiter.js';
import { storage } from './storage.js';

const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;
const ENABLE_IMAGE_SEARCH = process.env.ENABLE_IMAGE_SEARCH !== "false";

const GOOGLE_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * Normalize a dish name for consistent cache lookups
 * Ensures "Pizza", "pizza", "  PIZZA  " all become "pizza"
 */
function normalizeDishName(dishName: string): string {
    return dishName
        .toLowerCase()           // "Pizza" → "pizza"
        .trim()                  // "  pizza  " → "pizza"
        .replace(/\s+/g, ' ');   // "spaghetti   bolognese" → "spaghetti bolognese"
}

/**
 * Build an optimized search query for food images
 */
function buildSearchQuery(dishName: string): string {
    return `${dishName.trim()} food dish photo`;
}

// metadata about the image
interface GoogleSearchImage {
    contextLink: string; // URL of the webpage where the image was found
    height: number;
    width: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
}

// one search result item
interface GoogleSearchItem {
    title: string; // image/page title
    link: string; // actual full size image url
    displayLink: string; // domain name
    snippet: string; // brief desc
    image: GoogleSearchImage;
}

//top level response 
interface GoogleSearchResponse {
    items?: GoogleSearchItem[];
    error?: {
        code: number;
        message: string;
    };
}
// our custom result
export interface DishImageResult {
    imageUrl: string | null;
    thumbnailUrl: string | null;
    title: string | null;
}

// ============================================
// MAIN SEARCH FUNCTION
// ============================================
/**
 * Search for a dish image using Google Custom Search API
 * @param dishName - Name of the dish to search for
 * @returns DishImageResult with image URLs or null values if not found
*/
export async function searchDishImage(dishName: string): Promise<DishImageResult> {
    console.log(`\n🖼️ [IMAGE-SEARCH] ========== START ==========`);
    console.log(`🖼️ [IMAGE-SEARCH] Searching for: "${dishName}"`);
    console.log(`🖼️ [IMAGE-SEARCH] ENABLE_IMAGE_SEARCH: ${ENABLE_IMAGE_SEARCH}`);
    console.log(`🖼️ [IMAGE-SEARCH] GOOGLE_API_KEY configured: ${!!GOOGLE_API_KEY}`);
    console.log(`🖼️ [IMAGE-SEARCH] GOOGLE_CX configured: ${!!GOOGLE_CX}`);
    
    // Default empty result
    const emptyResult: DishImageResult = {
        imageUrl: null,
        thumbnailUrl: null,
        title: null
    };

    try {
        // Check if feature is enabled
        if (!ENABLE_IMAGE_SEARCH) {
            console.log("🖼️ [IMAGE-SEARCH] ❌ Image search is DISABLED by configuration");
            return emptyResult;
        }

        // Check if API is configured
        if (!GOOGLE_API_KEY || !GOOGLE_CX) {
            console.log("🖼️ [IMAGE-SEARCH] ❌ MISSING CONFIG:");
            console.log("🖼️ [IMAGE-SEARCH]   GOOGLE_SEARCH_API_KEY:", GOOGLE_API_KEY ? "set" : "NOT SET");
            console.log("🖼️ [IMAGE-SEARCH]   GOOGLE_SEARCH_CX:", GOOGLE_CX ? "set" : "NOT SET");
            console.log("🖼️ [IMAGE-SEARCH] ========== END ==========\n");
            return emptyResult;
        }

        // Validate input
        if (!dishName || dishName.trim().length === 0) {
            log("Empty dish name provided", "image-search");
            return emptyResult;
        }

        // Normalize dish name for consistent cache lookups
        const normalizedName = normalizeDishName(dishName);

        // Check database cache first
        const cached = await storage.findDishInCache(normalizedName);
        if (cached && cached.imageUrls && cached.imageUrls.length > 0) {
            log(`Cache hit for dish image: ${dishName} (normalized: ${normalizedName})`, "image-search");
            return {
                imageUrl: cached.imageUrls[0] || null,
                thumbnailUrl: cached.imageUrls[1] || null, // Second URL can be thumbnail
                title: cached.dishName
            };
        }

        // Check rate limits
        if (!(await rateLimiter.checkAndIncrement('google-search'))) {
            log("Rate limit reached for Google Search API", "image-search");
            return emptyResult;
        }

        // Build the search query
        const query = buildSearchQuery(dishName);

        // Construct the API URL with parameters
        const params = new URLSearchParams({
            key: GOOGLE_API_KEY!,
            cx: GOOGLE_CX!,
            q: query,
            searchType: 'image',
            num: '3',           // Get top 3 results to have fallbacks
            imgSize: 'large',   // Prefer larger images
            imgType: 'photo',   // Prefer photos over clipart
            safe: 'active'      // Safe search enabled
        });

        const url = `${GOOGLE_SEARCH_API_URL}?${params.toString()}`;

        log(`Searching for dish image: ${dishName}`, "image-search");

        // Make the API request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        // Handle HTTP errors
        if (!response.ok) {
            const errorText = await response.text();
            log(`Google Search API error (${response.status}): ${errorText}`, "image-search");
            return emptyResult;
        }

        // Parse the response
        const data: GoogleSearchResponse = await response.json();

        // Check for API-level errors
        if (data.error) {
            log(`Google Search API error: ${data.error.message}`, "image-search");
            return emptyResult;
        }

        // Check if we got any results
        if (!data.items || data.items.length === 0) {
            log(`No images found for: ${dishName}`, "image-search");
            return emptyResult;
        }

        // Get the first (best) result
        const firstResult = data.items[0];

        const result: DishImageResult = {
            imageUrl: firstResult.link,
            thumbnailUrl: firstResult.image?.thumbnailLink || null,
            title: firstResult.title
        };

        log(`Found image for ${dishName}: ${result.imageUrl}`, "image-search");

        // Cache the result in database using normalized name
        try {
            await storage.cacheDish({
                dishName: normalizedName,  // Use normalized name for consistent cache keys
                imageUrls: [result.imageUrl, result.thumbnailUrl].filter((url): url is string => url !== null)
            });
        } catch (cacheError) {
            // Don't fail the whole request if caching fails
            log(`Failed to cache dish image: ${cacheError}`, "image-search");
        }

        return result;

    } catch (error) {
        log(`Error searching for dish image: ${error instanceof Error ? error.message : String(error)}`, "image-search");
        return emptyResult;
    }
}
// ============================================
// BATCH SEARCH (for multiple dishes)
// ============================================

/**
 * Search for images for multiple dishes
 * @param dishNames - Array of dish names
 * @returns Map of dish names to their image results
 */
export async function searchMultipleDishImages(
    dishNames: string[]
): Promise<Map<string, DishImageResult>> {
    const results = new Map<string, DishImageResult>();

    // Process in parallel with a concurrency limit
    const BATCH_SIZE = 5;

    for (let i = 0; i < dishNames.length; i += BATCH_SIZE) {
        const batch = dishNames.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(async (dishName) => {
                const result = await searchDishImage(dishName);
                return { dishName, result };
            })
        );

        for (const { dishName, result } of batchResults) {
            results.set(dishName, result);
        }

        // Small delay between batches to be nice to the API
        if (i + BATCH_SIZE < dishNames.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}
