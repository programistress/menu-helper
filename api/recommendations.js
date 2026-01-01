import 'dotenv/config';

export default async function handler(req, res) {
    console.log('recommendations.js called');
    console.log('Method:', req.method);

    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            hint: 'Use POST with dishes array in body'
        });
    }

    try {
        const { storage } = await import('../server/storage.js');
        const { getOpenAIRecommendations } = await import('../server/openai-recommendations.js');

        console.log('Modules imported successfully');

        // Get deviceId from query or cookies
        const deviceId = req.query.deviceId || req.cookies?.deviceId;

        if (!deviceId) {
            return res.status(400).json({
                error: 'Device ID is required',
                hint: 'Pass deviceId as query parameter'
            });
        }

        // Get dishes from request body (sent from menu scan step)
        const { dishes } = req.body;

        if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
            return res.status(400).json({
                error: 'No dishes provided',
                hint: 'Please scan a menu first to get dishes'
            });
        }

        console.log(`Processing ${dishes.length} dishes for recommendations`);

        // Get user preferences from database
        const userPreferences = await storage.getPreferencesByDeviceId(deviceId);

        if (!userPreferences) {
            return res.status(400).json({
                error: 'No preferences found',
                hint: 'Please set your food preferences first'
            });
        }

        // Format dishes for the recommendation function
        const menuDishes = dishes.map((dish) => ({
            name: dish.name,
            description: dish.description,
            imageUrl: dish.imageUrl,
            metadata: dish.metadata
        }));

        // Format preferences for the recommendation function
        const preferences = {
            dietary: userPreferences.dietary || [],
            cuisines: userPreferences.cuisines || [],
            allergies: userPreferences.allergies || [],
            flavors: userPreferences.flavors || [],
            dislikedIngredients: userPreferences.dislikedIngredients || []
        };

        console.log(`User preferences: dietary=${preferences.dietary.length}, cuisines=${preferences.cuisines.length}`);

        // Get AI-powered recommendations
        const recommendations = await getOpenAIRecommendations(
            menuDishes,
            preferences,
            deviceId
        );

        console.log(`Generated ${recommendations.length} recommendations`);

        return res.status(200).json({
            recommendations,
            message: `Found ${recommendations.length} dishes that match your preferences!`
        });

    } catch (error) {
        console.error('Recommendations error:', error);

        // Handle specific error types
        if (error.message?.includes('Rate limit')) {
            return res.status(429).json({
                error: 'Too many requests',
                message: 'Please try again in a moment'
            });
        }

        if (error.message?.includes('API key')) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Recommendation service temporarily unavailable'
            });
        }

        return res.status(500).json({
            error: 'Error generating recommendations',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

