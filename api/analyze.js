import 'dotenv/config';

export default async function handler(req, res) {
    console.log('menu/analyze.js called');
    console.log('Method:', req.method);

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only POST is allowed (we're uploading an image)
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            hint: 'Use POST to upload a menu image'
        });
    }

    try {
        const formidable = await import('formidable'); // Parses multipart form data (file uploads)
        const fs = await import('fs/promises'); // Read the uploaded file
        const { analyzeMenuImage } = await import('../../server/openai-vision.js');
        const { searchDishImage } = await import('../../server/image-search.js');
        const { getOpenAIDescription } = await import('../../server/openai-descriptions.js');
        const { storage } = await import('../../server/storage.js');

        console.log('Modules imported successfully');

        if (!process.env.DATABASE_URL) {
            console.error('Missing DATABASE_URL');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Database connection not configured'
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('Missing OPENAI_API_KEY');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'OpenAI API key not configured'
            });
        }

        // Parse the uploaded image (vercel doesnt have file handling like express + multer)
        const form = formidable.default({
            maxFileSize: 10 * 1024 * 1024, // 10MB limit
            keepExtensions: true,
        });

        // Parse the request to get the uploaded file
        const { files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve({ fields, files });
            });
        });

        console.log('Form parsed, files received:', Object.keys(files));

        // Get the image file (frontend sends it as 'image')
        const file = files.image;
        if (!file) {
            return res.status(400).json({ 
                error: 'No image file provided',
                hint: 'Send image as form-data with key "image"'
            });
        }

        // Handle both single file and array
        const imageFile = Array.isArray(file) ? file[0] : file;
        
        // Read the file into memory
        const buffer = await fs.default.readFile(imageFile.filepath);

        // Check file size
        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(413).json({ 
                error: 'Image too large',
                message: 'Please upload an image smaller than 5MB'
            });
        }

        // Convert to base64 (required by OpenAI Vision API)
        const base64Image = buffer.toString('base64');
        console.log('Image converted to base64, length:', base64Image.length);

        // Send the image to OpenAI to extract dish names
        const visionAnalysis = await analyzeMenuImage(base64Image);
        console.log('Vision analysis result:', visionAnalysis);

        // Check if it's actually a menu
        if (!visionAnalysis.isMenu) {
            return res.status(200).json({
                dishes: [],
                message: "The image doesn't appear to be a menu. Please upload a photo of a restaurant menu."
            });
        }

        const dishNames = visionAnalysis.dishNames;

        // No dishes found
        if (!dishNames || dishNames.length === 0) {
            return res.status(200).json({
                dishes: [],
                message: "No dish names could be clearly identified. Try taking a clearer photo with better lighting."
            });
        }

        console.log(`Found ${dishNames.length} dishes:`, dishNames);

        
        // For each dish name, get an image and description
        const dishesWithDetails = await Promise.all(
            dishNames.map(async (dishName) => {
                const normalizedName = dishName.toLowerCase().trim();

                // Check cache first
                const cachedDish = await storage.findDishInCache(normalizedName);

                if (cachedDish?.imageUrls?.length && cachedDish?.description) {
                    // Full cache hit - use cached data
                    console.log(`Cache hit for "${dishName}"`);
                    return {
                        name: dishName,
                        description: cachedDish.description,
                        imageUrl: cachedDish.imageUrls[0],
                        metadata: {
                            source: cachedDish.source,
                            thumbnailUrl: cachedDish.imageUrls[1] || null
                        }
                    };
                }

                // Search for image
                const imageResult = await searchDishImage(dishName);

                // Get description (from cache or generate new)
                let description = cachedDish?.description;
                if (!description) {
                    console.log(`Generating description for "${dishName}"`);
                    description = await getOpenAIDescription(dishName);

                    // Cache the result
                    try {
                        await storage.cacheDish({
                            dishName: normalizedName,
                            description,
                            imageUrls: imageResult.imageUrl
                                ? [imageResult.imageUrl, imageResult.thumbnailUrl].filter(Boolean)
                                : undefined,
                            source: 'openai'
                        });
                    } catch (cacheError) {
                        console.log('Cache error (non-fatal):', cacheError.message);
                    }
                }

                return {
                    name: dishName,
                    description: description || ' ',
                    imageUrl: imageResult.imageUrl || 'https://placehold.co/400x300?text=No+Image',
                    metadata: {
                        source: imageResult.source,
                        thumbnailUrl: imageResult.thumbnailUrl
                    }
                };
            })
        );

        console.log(`Processed ${dishesWithDetails.length} dishes with details`);


        return res.status(200).json({
            dishes: dishesWithDetails,
            message: `Found ${dishesWithDetails.length} dishes in your menu photo.`
        });

    } catch (error) {
        console.error('Menu analyze error:', error);

        // Handle specific error types
        if (error.message?.includes('maxFileSize')) {
            return res.status(413).json({
                error: 'Image too large',
                message: 'Please upload an image smaller than 5MB'
            });
        }

        return res.status(500).json({
            error: 'Error analyzing menu',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

