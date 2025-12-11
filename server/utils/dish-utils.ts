/**
 * Utility functions for dish-related operations
 */

/**
 * Normalize a dish name for consistent caching and comparison
 * - Removes prices ($12.99, £10, €15.50, etc.)
 * - Removes descriptions in parentheses or brackets ((spicy), [v], [vegan], etc.)
 * - Trims whitespace
 * - Converts to lowercase
 * 
 * @param dishName Raw dish name from menu
 * @returns Normalized dish name for caching
 * 
 * @example
 * normalizeDishName("  Pad Thai $12.99  ") // "pad thai"
 * normalizeDishName("Margherita Pizza (vegetarian) [v]") // "margherita pizza"
 * normalizeDishName("Chicken Curry £10.50") // "chicken curry"
 */
export function normalizeDishName(dishName: string): string {
    if (!dishName) return "";

    let normalized = dishName;

    // Remove prices: $12.99, £10, €15.50, ¥1000, ₹500, etc.
    // Matches currency symbols followed by numbers (with optional decimals)
    normalized = normalized.replace(/[$£€¥₹₩฿]\s*\d+([.,]\d{1,2})?/g, "");
    
    // Also remove prices written as "12.99" or "10.50" at end of string
    normalized = normalized.replace(/\s+\d+([.,]\d{1,2})?\s*$/g, "");

    // Remove descriptions in parentheses: (spicy), (contains nuts), (GF), etc.
    normalized = normalized.replace(/\([^)]*\)/g, "");

    // Remove descriptions in square brackets: [v], [vegan], [GF], etc.
    normalized = normalized.replace(/\[[^\]]*\]/g, "");

    // Remove descriptions in curly braces: {new}, {popular}, etc.
    normalized = normalized.replace(/\{[^}]*\}/g, "");

    // Remove common menu markers/symbols
    normalized = normalized.replace(/[*†‡•◆★☆🌶️🔥🥬🌱]/g, "");

    // Normalize multiple spaces to single space
    normalized = normalized.replace(/\s+/g, " ");

    // Trim whitespace and convert to lowercase
    return normalized.trim().toLowerCase();
}


/**
 * Generate a cache key for a dish
 * 
 * @param dishName Dish name
 * @returns Cache-safe key string
 */
export function getDishCacheKey(dishName: string): string {
    const normalized = normalizeDishName(dishName);
    // Replace spaces with hyphens for URL-safe keys
    return normalized.replace(/\s+/g, "-");
}

