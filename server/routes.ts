import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { insertPreferenceSchema } from "../shared/schema";
import { storage } from "./storage.ts";
import { log } from './simple-logger.ts';



export async function registerRoutes(app: Express): Promise<Server> {
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

    // Create HTTP server
    const server = createServer(app);
    return server;
}