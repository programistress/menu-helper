import OpenAI from "openai";
import { log } from "./simple-logger.js";
import { rateLimiter } from "./rate-limiter.js";
import { analyzeImage } from "./vision.js";

// Configure OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2, // Limit retries to reduce costs
    timeout: 15000 // 15 second timeout to prevent hanging
});

// This flag allows easier turning on/off of the OpenAI API
const ENABLE_OPENAI = process.env.ENABLE_OPENAI !== "false";
