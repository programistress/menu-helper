import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { insertPreferenceSchema } from "../shared/schema";
import { storage } from "./storage.ts";
import { log } from './simple-logger.ts';
import multer from "multer";
import { analyzeMenuImage } from "./openai-vision.ts";
import { searchDishImage } from "./image-search.ts";

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
            // Extract deviceId from request
            const deviceId = req.deviceId;

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
            // Extract deviceId from request
            const deviceId = req.deviceId;

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

    // Upload and analyze menu image
    app.post('/api/menu/analyze', upload.single('image'), async (req: Request, res: Response) => {
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

            // Use the dish names identified by OpenAI Vision
            const dishNames = visionAnalysis.dishNames;

            if (process.env.NODE_ENV === 'development') {
                log(`OpenAI identified ${dishNames.length} dish names`, 'vision-api');
            }

            if (dishNames.length === 0) {
                return res.status(200).json({
                    dishes: [],
                    message: "No dish names could be clearly identified in the image. Try taking a clearer photo with better lighting and make sure dish names are visible."
                });
            }

            // Transform dish names into full dish objects with images
            log(`Searching for images for ${dishNames.length} dishes`, 'menu-analyze');

            const dishesWithDetails = await Promise.all(
                dishNames.map(async (dishName) => {
                    // Search for dish image (with caching)
                    const imageResult = await searchDishImage(dishName);

                    // Check if we have cached description
                    const cachedDish = await storage.findDishInCache(dishName.toLowerCase().trim());

                    return {
                        name: dishName,
                        description: cachedDish?.description || `A delicious ${dishName}`,
                        imageUrl: imageResult.imageUrl || 'https://placehold.co/400x300?text=No+Image',
                        metadata: {
                            source: imageResult.source,
                            thumbnailUrl: imageResult.thumbnailUrl
                        }
                    };
                })
            );

            log(`Successfully processed ${dishesWithDetails.length} dishes with images and descriptions`, 'menu-analyze');

            // Return the full dish objects
            return res.status(200).json({
                dishes: dishesWithDetails,
                message: `Found ${dishesWithDetails.length} dishes in your photo.`
            });

        } catch (error) {
            log(`Error processing image: ${error instanceof Error ? error.message : String(error)}`);
            return res.status(500).json({
                message: 'Error processing image',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.post('api/recommendations', async (req: Request, res: Response)) => {
        try {
            
        } catch (error) {
            
        }
    }

    // Create HTTP server
    const server = createServer(app);
    return server;
}