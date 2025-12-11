import { pgTable, text, serial, integer, jsonb, timestamp, varchar, pgSchema } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


// Get the schema name based on environment and deployment context
const getSchemaName = () => {
    // For Vercel deployments, check VERCEL_ENV and git branch
    if (process.env.VERCEL_ENV) {
      // On Vercel production (main branch)
      if (process.env.VERCEL_ENV === 'production') {
        return 'public';
      }
      
      // On Vercel preview deployments (feature branches) or development
      if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development') {
        return 'development';
      }
    }
    
    // For local development, check git branch
    if (process.env.NODE_ENV === 'development') {
      return 'development';
    }
    
    // Check git branch name (useful for local and CI/CD)
    const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || process.env.BRANCH;
    if (gitBranch && gitBranch !== 'main' && gitBranch !== 'master') {
      return 'development';
    }
    
    // Default to public schema for production/main branch
    if (process.env.NODE_ENV === 'production') {
      return 'public';
    }
    
    // Default to development for everything else
    return 'development';
  };
  
// Create the schema object
const currentSchemaName = getSchemaName();

// Log which schema is being used for debugging
if (typeof console !== 'undefined') {
    const _context = process.env.VERCEL_ENV ? `Vercel ${process.env.VERCEL_ENV}` : 
                  process.env.NODE_ENV === 'development' ? 'Local development' : 'Unknown';
    const _branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || process.env.BRANCH || 'unknown';
    console.log(`📊 Database Schema: "${currentSchemaName}" | Context: ${_context} | Branch: ${_branch}`); // REMOVED: DB config may expose sensitive deployment info
  }

// if dev we use pgSchema(development), otherwise we use public default schema
export const appSchema = currentSchemaName === 'public' 
    ? undefined  // Use default (public) schema
    : pgSchema(currentSchemaName); // Create/use development schema

// Helper function to create table in the correct schema
const createTable = (name: string, columns: any) => {
    return appSchema ? appSchema.table(name, columns) : pgTable(name, columns);
  };

// admin user schema
export const users = createTable("users", {
    id: serial("id").primaryKey(), // auto id
    username: text("username").notNull().unique(),
    password: text("password").notNull(), // hashed password
  });
  
export const insertUserSchema = createInsertSchema(users).pick({
    username: true,
    password: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
  

// food preferences schema
export const preferences = createTable("preferences", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  dietary: text("dietary").array(),
  cuisines: text("cuisines").array(),
  allergies: text("allergies").array(),
  flavors: text("flavors").array(),
  dislikedIngredients: text("dislikedIngredients").array(),
});

export const insertPreferenceSchema = createInsertSchema(preferences).pick({
  deviceId: true,
  dietary: true,
  cuisines: true,
  allergies: true,
  flavors: true,
  dislikedIngredients: true,
});

export type Preference = typeof preferences.$inferSelect;
export type InsertPreference = z.infer<typeof insertPreferenceSchema>;

// Dish cache schema for storing dish metadata to reduce external API calls
export const dishCache = createTable("dish_cache", {
  id: serial("id").primaryKey(),
  dishName: text("dish_name").notNull(),
  dishId: text("dish_id").notNull().unique(),
  imageUrls: text("image_urls").array(),
  description: text("description"),
  source: varchar("source", { length: 20 }).notNull(), //  'openai', 'bing', 'google'
  metadata: jsonb("metadata"), // { cuisine, spiciness, ingredients }
  cachedAt: timestamp("cached_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Cache expiration time
});

export const insertDishCacheSchema = createInsertSchema(dishCache).pick({
  dishName: true,
  dishId: true,
  imageUrls: true,
  description: true,
  source: true,
  metadata: true,
  expiresAt: true,
});

export type DishCache = typeof dishCache.$inferSelect;
export type InsertDishCache = z.infer<typeof insertDishCacheSchema>;

// Saved dishes schema - now with reference to dish_cache table
export const savedDishes = createTable("saved_dishes", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  dishCacheId: integer("dish_cache_id").references(() => dishCache.id),
  dishName: text("dish_name").notNull(),
  imageUrls: text("image_urls").array(),
  description: text("description"),
  savedAt: timestamp("saved_at").defaultNow(),
});

export const insertSavedDishSchema = createInsertSchema(savedDishes).pick({
  deviceId: true,
  dishCacheId: true,
  dishName: true,
  imageUrls: true,
  description: true,
});

export type SavedDish = typeof savedDishes.$inferSelect;
export type InsertSavedDish = z.infer<typeof insertSavedDishSchema>;

// Recommendation types are defined as interfaces since we're using ephemeral recommendations
export interface Recommendation {
  dishName: string;
  imageUrls?: string[];
  description?: string;
  matchScore?: number;
  matchReason?: string;
}