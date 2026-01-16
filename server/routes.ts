import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { insertPreferenceSchema } from "../shared/schema";
import { storage } from "./storage.js";
import { log } from './simple-logger.js';
import multer from "multer";
import { analyzeMenuImage, type ExtractedDish } from "./openai-vision.js";
import { searchDishImage, isImageQuotaExceeded } from "./image-search.js";
import { getOpenAIDescription, getDetailedDescription } from "./openai-descriptions.js";
import { getOpenAIRecommendations } from "./openai-recommendations.js";

// In-memory storage for multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});


export async function registerRoutes(app: Express): Promise<Server> {
    // Test endpoint to verify device ID middleware is working
    app.get('/api/device-id', (req: Request, res: Response) => {
        res.json({
            deviceId: req.deviceId,
            source: req.cookies?.deviceId ? 'cookie' : req.header('X-Device-ID') ? 'header' : 'generated',
            timestamp: new Date().toISOString()
        });
    });

    app.post('/api/preferences', async (req: Request, res: Response) => {
        try {
            // Extract deviceId from request (middleware or query param fallback)
            const deviceId = req.deviceId || (req.query.deviceId as string);

            if (!deviceId) {
                return res.status(400).json({ message: 'Device ID is required' });
            }

            // Validate request body
            const validatedData = insertPreferenceSchema.parse({
                ...req.body,
                deviceId
            });

            // Check if preferences already exist for this specific device
            const existingPreferences = await storage.getPreferencesByDeviceId(deviceId);

            let preferences;
            if (existingPreferences) {
                // Update existing preferences
                preferences = await storage.updatePreference(existingPreferences.id, validatedData);
            } else {
                // Create brand new preferences for this device
                preferences = await storage.createPreference(validatedData);
            }

            return res.status(201).json(preferences);
        } catch (error) {
            log(`Error saving preferences: ${error instanceof Error ? error.message : String(error)}`);
            return res.status(400).json({
                message: 'Error saving preferences',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.get('/api/preferences', async (req: Request, res: Response) => {
        try {
            // Extract deviceId from request (middleware or query param fallback)
            const deviceId = req.deviceId || (req.query.deviceId as string);

            if (!deviceId) {
                return res.status(400).json({ message: 'Device ID is required' });
            }

            // Only get preferences specific to this device ID
            const preferences = await storage.getPreferencesByDeviceId(deviceId);

            if (!preferences) {
                return res.status(404).json({ message: 'Preferences not found' });
            }

            return res.status(200).json(preferences);
        } catch (error) {
            log(`Error getting preferences: ${error instanceof Error ? error.message : String(error)}`);
            return res.status(500).json({
                message: 'Error getting preferences',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Upload and analyze menu image (also aliased as /api/analyze for frontend compatibility)
    app.post('/api/analyze', upload.single('image'), async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No image file provided' });
            }
            // Extract deviceId from request
            const deviceId = req.deviceId;

            if (!deviceId) {
                return res.status(400).json({ message: 'Device ID is required' });
            }

            // Convert buffer to base64
            const base64Image = req.file.buffer.toString('base64');

            // Use OpenAI Vision API to identify menu items in the image
            const visionAnalysis = await analyzeMenuImage(base64Image);

            if (!visionAnalysis.isMenu) {
                return res.status(200).json({
                    dishes: [],
                    message: "The image doesn't appear to be a menu. Please upload a photo of a menu."
                });
            }

            // Use the dishes identified by OpenAI Vision (with optional descriptions)
            const extractedDishes = visionAnalysis.dishes;

            if (process.env.NODE_ENV === 'development') {
                const withDesc = extractedDishes.filter(d => d.originalDescription).length;
                log(`OpenAI identified ${extractedDishes.length} dishes (${withDesc} with menu descriptions)`, 'vision-api');
            }

            if (extractedDishes.length === 0) {
                return res.status(200).json({
                    dishes: [],
                    message: "No dish names could be clearly identified in the image. Try taking a clearer photo with better lighting and make sure dish names are visible."
                });
            }

            // Transform extracted dishes into full dish objects with images
            log(`Searching for images for ${extractedDishes.length} dishes`, 'menu-analyze');

            const dishesWithDetails = await Promise.all(
                extractedDishes.map(async (extractedDish: ExtractedDish) => {
                    const { name: dishName, originalDescription } = extractedDish;
                    const normalizedName = dishName.toLowerCase().trim();

                    log(`Searching for "${dishName}" using dish name only`, 'menu-analyze');

                    // Check cache first for both image and description
                    const cachedDish = await storage.findDishInCache(normalizedName);

                    // If we have a complete cache hit (image + description), use it
                    if (cachedDish?.imageUrls?.length && cachedDish?.description) {
                        log(`Full cache hit for "${dishName}"`, 'menu-analyze');
                        return {
                            name: dishName,
                            description: cachedDish.description,
                            originalDescription, // Keep menu description for detailed view
                            imageUrl: cachedDish.imageUrls[0],
                            metadata: {
                                thumbnailUrl: cachedDish.imageUrls[1] || null,
                                allImageUrls: cachedDish.imageUrls || []
                            }
                        };
                    }

                    // Search for image by dish name only
                    console.log(`📸 [ROUTE] Calling searchDishImage for: "${dishName}"`);
                    const imageResult = await searchDishImage(dishName);
                    console.log(`📸 [ROUTE] Image result for "${dishName}":`, JSON.stringify(imageResult));

                    // Get short description for card display:
                    // - If menu has description, use first part of it or generate brief one
                    // - If no menu description, generate with OpenAI
                    let description = cachedDish?.description;
                    if (!description) {
                        if (originalDescription) {
                            // Menu has description - use it as-is for short display (truncate if needed)
                            description = originalDescription.length > 80
                                ? originalDescription.substring(0, 77) + '...'
                                : originalDescription;
                            log(`Using menu description for "${dishName}"`, 'menu-analyze');
                        } else {
                            // No menu description - generate with OpenAI
                            log(`[DB CACHE] Miss for "${dishName}" - calling OpenAI`, 'menu-analyze');
                            description = await getOpenAIDescription(dishName);
                        }

                        // Cache the description and ALL image URLs to database
                        try {
                            await storage.cacheDish({
                                dishName: normalizedName,
                                description,
                                // Store all image URLs for carousel, not just the first two
                                imageUrls: imageResult.allImageUrls?.length 
                                    ? imageResult.allImageUrls 
                                    : (imageResult.imageUrl ? [imageResult.imageUrl] : undefined)
                            });
                            log(`Cached description and ${imageResult.allImageUrls?.length || 0} images for "${dishName}"`, 'menu-analyze');
                        } catch (cacheError) {
                            log(`Failed to cache description: ${cacheError}`, 'menu-analyze');
                        }
                    }

                    const finalDish = {
                        name: dishName,
                        description,
                        originalDescription, // Keep for generating detailed description on click
                        imageUrl: imageResult.imageUrl || 'https://placehold.co/400x300?text=No+Image',
                        metadata: {
                            thumbnailUrl: imageResult.thumbnailUrl,
                            allImageUrls: imageResult.allImageUrls || []
                        }
                    };
                    console.log(`📸 [ROUTE] Final dish object for "${dishName}":`, JSON.stringify(finalDish));
                    return finalDish;
                })
            );

            log(`Successfully processed ${dishesWithDetails.length} dishes with images and descriptions`, 'menu-analyze');

            // Check if image quota was exceeded during processing
            const imageQuotaExceeded = isImageQuotaExceeded();

            // Return the full dish objects
            return res.status(200).json({
                dishes: dishesWithDetails,
                message: `Found ${dishesWithDetails.length} dishes in your photo.`,
                imageQuotaExceeded
            });

        } catch (error) {
            log(`Error processing image: ${error instanceof Error ? error.message : String(error)}`);
            
            // Check for timeout errors
            if (error instanceof Error && error.message.includes('timed out')) {
                return res.status(504).json({
                    message: 'Image processing took too long. This can happen with large or complex menus. Please try with a smaller section of the menu, or try again.',
                    error: 'Request timeout'
                });
            }
            
            return res.status(500).json({
                message: 'Error processing image',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Get personalized dish recommendations based on menu and user preferences
    app.post('/api/recommendations', async (req: Request, res: Response) => {
        try {
            // Extract deviceId from request (middleware or query param fallback)
            const deviceId = req.deviceId || (req.query.deviceId as string);

            if (!deviceId) {
                return res.status(400).json({ message: 'Device ID is required' });
            }

            // Get dishes from request body (from menu scan)
            const { dishes } = req.body;

            if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
                return res.status(400).json({
                    message: 'No dishes provided. Please scan a menu first.'
                });
            }

            log(`Generating recommendations for ${dishes.length} dishes`, 'recommendations');

            // Get user preferences from database
            const userPreferences = await storage.getPreferencesByDeviceId(deviceId);

            if (!userPreferences) {
                return res.status(400).json({
                    message: 'No preferences found. Please set your food preferences first.'
                });
            }

            // Format dishes for the recommendation function
            const menuDishes = dishes.map((dish: any) => ({
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

            log(`User preferences: dietary=${preferences.dietary?.length || 0}, cuisines=${preferences.cuisines?.length || 0}, allergies=${preferences.allergies?.length || 0}`, 'recommendations');

            // Get AI-powered recommendations
            const recommendations = await getOpenAIRecommendations(
                menuDishes,
                preferences,
                deviceId
            );

            log(`Generated ${recommendations.length} recommendations`, 'recommendations');

            return res.status(200).json({
                recommendations,
                message: `Found ${recommendations.length} dishes that match your preferences!`
            });

        } catch (error) {
            log(`Error generating recommendations: ${error instanceof Error ? error.message : String(error)}`, 'recommendations');

            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('Rate limit')) {
                    return res.status(429).json({
                        message: 'Too many requests. Please try again in a moment.',
                        error: error.message
                    });
                }
                if (error.message.includes('API key')) {
                    return res.status(503).json({
                        message: 'Recommendation service temporarily unavailable.',
                        error: 'Service configuration error'
                    });
                }
            }

            return res.status(500).json({
                message: 'Error generating recommendations',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Get detailed description for a specific dish (on-demand when user clicks)
    app.post('/api/dish/detail', async (req: Request, res: Response) => {
        try {
            const { name, originalDescription } = req.body;

            if (!name || typeof name !== 'string') {
                return res.status(400).json({
                    message: 'Dish name is required'
                });
            }

            log(`Generating detailed description for "${name}"`, 'dish-detail');

            // Generate a rich, detailed description for the modal view
            const detailedDescription = await getDetailedDescription(name, originalDescription);

            return res.status(200).json({
                name,
                detailedDescription,
                success: true
            });

        } catch (error) {
            log(`Error generating dish detail: ${error instanceof Error ? error.message : String(error)}`, 'dish-detail');

            return res.status(500).json({
                message: 'Error generating dish details',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Create HTTP server
    const server = createServer(app);
    return server;
}