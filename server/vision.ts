import axios from 'axios';
import { log } from './simple-logger.js';

// Request structure for Google Vision API
interface VisionRequest {
    requests: {
        image: {
            content: string; // base64 encoded image
        };
        features: {
            type: string; // DOCUMENT_TEXT_DETECTION or LABEL_DETECTION
            maxResults?: number; // optional
        }[];
    }[];
}

// Response structure from Google Vision API
interface VisionResponse {
    responses: {
        labelAnnotations?: {
            description: string;
            score: number;
        }[];
        textAnnotations?: {
            description: string;
        }[];
        fullTextAnnotation?: {
            text: string;
        };
        error?: {
            message: string;
        };
    }[];
}

// Return type for menu analysis
export interface MenuAnalysisResult {
    isMenu: boolean;           // Whether the image appears to be a menu
    text: string;              // All text extracted from the image (menu items, prices, etc.)
    labels: {                  // What Google Vision detected in the image
        description: string;
        score: number;
    }[];
    confidence: number;        // How confident we are this is a menu (0-1)
}

/**
 * Analyzes a menu image using Google Vision API to extract text and information
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns MenuAnalysisResult with extracted text and menu detection
 */
export async function analyzeMenuImage(base64Image: string): Promise<MenuAnalysisResult> {
    try {
        const apiKey = process.env.GOOGLE_VISION_API_KEY;
        if (!apiKey) {
            throw new Error('Google Vision API key is not configured');
        }

        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        let imageContent = base64Image;
        if (imageContent.includes(',')) {
            imageContent = imageContent.split(',')[1];
        }

        // Validate image data
        if (!imageContent || imageContent.length < 100) {
            throw new Error('Invalid image data provided');
        }

        log(`Processing menu image with Google Vision API, content length: ${imageContent.length}`, 'vision');

        // Build the Vision API request
        // DOCUMENT_TEXT_DETECTION is better for menus than TEXT_DETECTION
        // because menus are structured documents with columns, prices, etc.
        const visionRequest: VisionRequest = {
            requests: [
                {
                    image: {
                        content: imageContent,
                    },
                    features: [
                        {
                            type: 'DOCUMENT_TEXT_DETECTION',  // Better OCR for structured documents like menus
                        },
                        {
                            type: 'LABEL_DETECTION',          // Detect what's in the image
                            maxResults: 10,
                        },
                    ],
                },
            ],
        };

        // Call Google Vision API
        const response = await axios.post<VisionResponse>(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            visionRequest
        );

        const visionResponse = response.data.responses[0];

        // Check for API errors
        if (visionResponse.error) {
            throw new Error(`Vision API error: ${visionResponse.error.message}`);
        }

        // Extract all text from the image (menu items, prices, descriptions)
        let extractedText = '';
        if (visionResponse.fullTextAnnotation) {
            extractedText = visionResponse.fullTextAnnotation.text;
        } else if (visionResponse.textAnnotations && visionResponse.textAnnotations.length > 0) {
            extractedText = visionResponse.textAnnotations[0].description;
        }

        // Check if labels indicate this is a menu or food-related image
        const menuKeywords = [
            'menu', 'food', 'restaurant', 'dish', 'cuisine',
            'meal', 'dining', 'recipe', 'text', 'document',
            'paper', 'cafe', 'bistro', 'drink', 'beverage'
        ];

        const matchingLabels = visionResponse.labelAnnotations?.filter(
            label => menuKeywords.some(keyword =>
                label.description.toLowerCase().includes(keyword)
            )
        ) || [];

        const isMenu = matchingLabels.length > 0;

        // Calculate confidence based on matching labels and their scores
        const confidence = matchingLabels.length > 0
            ? matchingLabels.reduce((sum, label) => sum + label.score, 0) / matchingLabels.length
            : 0;

        log(`Menu analysis complete: isMenu=${isMenu}, confidence=${confidence.toFixed(2)}, text length=${extractedText.length}`, 'vision');

        return {
            isMenu,
            text: extractedText,
            labels: visionResponse.labelAnnotations || [],
            confidence,
        };
    } catch (error) {
        log(`Error analyzing menu image: ${error instanceof Error ? error.message : String(error)}`, 'vision');

        // Return user-friendly error response
        return {
            isMenu: false,
            text: "Error analyzing menu image. Please try again with a clearer photo.",
            labels: [],
            confidence: 0,
        };
    }
}

// Backwards compatibility alias (in case old code uses analyzeImage)
export const analyzeImage = analyzeMenuImage;
