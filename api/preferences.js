import 'dotenv/config';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { storage } = await import('../server/storage.js');
        const { insertPreferenceSchema } = await import('../shared/schema.js');
        const { logInfo, logError } = await import('../server/simple-error-logger.js');

        console.log('Modules imported successfully');

        if (req.method === 'GET') {
            const deviceId = req.query.deviceId || req.cookies?.deviceId;

            if (!deviceId) {
                return res.status(400).json({ error: 'Device ID is required' });
            }

            const preferences = await storage.getPreferencesByDeviceId(deviceId);

            // return preferences (or null if none found)
            return res.status(200).json({
                preferences: preferences || null,
                deviceId: deviceId
            });
        }

        if (req.method === 'POST') {
            const deviceId = req.query.deviceId || req.cookies?.deviceId;

            if (!deviceId) {
                return res.status(400).json({ error: 'Device ID is required' });
            }

            // Validate the request body using Zod schema
            // This ensures the data matches what our database expects
            const dataToValidate = {
                ...req.body,      // The preferences data from the request
                deviceId: deviceId // Add deviceId to the data
            };

            const validation = insertPreferenceSchema.safeParse(dataToValidate);

            if (!validation.success) {
                return res.status(400).json({
                    error: 'Invalid preference data',
                    details: validation.error.errors
                });
            }

            const preferenceData = validation.data;

            // Check if this device already has preferences saved
            const existingPreferences = await storage.getPreferencesByDeviceId(deviceId);

            let result;
            if (existingPreferences) {
                // UPDATE existing preferences
                result = await storage.updatePreference(existingPreferences.id, preferenceData);
            } else {
                // CREATE new preferences
                result = await storage.createPreference(preferenceData);
            }

            return res.status(200).json({
                success: true,
                preference: result,
                message: existingPreferences
                    ? 'Preferences updated successfully'
                    : 'Preferences saved successfully'
            });
        }

       
        return res.status(405).json({
            error: 'Method not allowed',
            allowedMethods: ['GET', 'POST']
        });

    } catch (error) {
        console.error('Preferences API error:', error);

        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            // Only show stack trace in development (for security)
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

