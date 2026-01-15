import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Debug: check if API keys loaded
console.log('\n🔑 API Keys Status:');
console.log('  OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Yes (length: ' + process.env.OPENAI_API_KEY.length + ')' : '❌ No');
console.log('  Google Search API Key:', process.env.GOOGLE_SEARCH_API_KEY ? '✅ Yes (length: ' + process.env.GOOGLE_SEARCH_API_KEY.length + ')' : '❌ No');
console.log('  Google Search CX:', process.env.GOOGLE_SEARCH_CX ? '✅ Yes (value: ' + process.env.GOOGLE_SEARCH_CX + ')' : '❌ No');
console.log('  Database URL:', process.env.DATABASE_URL ? '✅ Yes' : '❌ No');
console.log('');

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { setupVite, serveStatic, log } from "./vite.js";
import { registerRoutes } from './routes.js';
import { ensureDeviceId } from "./middleware/deviceId.js";

const app = express();

// Increase payload limit to 50MB for handling large CSV files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.use(ensureDeviceId);

// Logging middleware for API requests
app.use((req, res, next) => {
    const start = Date.now(); // for calculating request duration
    const path = req.path; // for logging the request path
    let capturedJsonResponse: Record<string, any> | undefined = undefined; // for capturing the response body
  
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  
    res.on("finish", () => { 
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {  // log api routes only
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
  
        if (logLine.length > 80) { // truncate the log line if it's too long
          logLine = logLine.slice(0, 79) + "…";
        }
  
        log(logLine);
      }
    });
  
    next();
  });


(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on configurable port with fallback to 5000
  // In development, we can use any available port
  // In production on Vercel, this will be handled differently
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  const host = process.env.NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';
  
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
