import {
  preferences, type Preference, type InsertPreference,
  dishCache, type DishCache
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and, sql, gte } from "drizzle-orm";
import { log } from "./simple-logger.js";

// Custom type for cacheDish input (avoids Zod type inference issues)
export interface CacheDishInput {
  dishName: string;
  dishId?: string;
  imageUrls?: string[];
  description?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface IStorage {
  // User methods
  // getUser(id: number): Promise<User | undefined>;
  // getUserByUsername(username: string): Promise<User | undefined>;
  // createUser(user: InsertUser): Promise<User>;

  // Preferences methods
  // getPreferencesByUserId(userId: number): Promise<Preference | undefined>;
  getPreferencesByDeviceId(deviceId: string): Promise<Preference | undefined>;
  createPreference(preference: InsertPreference): Promise<Preference>;
  updatePreference(id: number, preference: Partial<InsertPreference>): Promise<Preference | undefined>;

  //Dish Cache methods
  findDishInCache(dishName: string): Promise<DishCache | undefined>;
  findDishById(dishId: string): Promise<DishCache | undefined>;
  getDishCacheById(id: number): Promise<DishCache | undefined>;
  cacheDish(dishData: CacheDishInput): Promise<DishCache>;


}

export class DatabaseStorage implements IStorage {
  // Preferences methods
  async getPreferencesByDeviceId(deviceId: string): Promise<Preference | undefined> {
    const [preference] = await db.select().from(preferences).where(eq(preferences.deviceId, deviceId));
    return preference || undefined;
  }

  async createPreference(insertPreference: InsertPreference): Promise<Preference> {
    const [preference] = await db.insert(preferences).values(insertPreference).returning();
    return preference;
  }

  async updatePreference(id: number, partialPreference: Partial<InsertPreference>): Promise<Preference | undefined> {
    const [updatedPreference] = await db
      .update(preferences)
      .set(partialPreference)
      .where(eq(preferences.id, id))
      .returning();
    return updatedPreference || undefined;
  }

  // Dish Cache methods
  // removed partial matching for more accuracy 
  async findDishInCache(dishName: string): Promise<DishCache | undefined> {
    // Normalize inputs for better matching
    const normalizedDishName = dishName.toLowerCase().trim();

    try {
      const [exactMatch] = await db.select().from(dishCache).where(
        and(
          eq(sql`LOWER(${dishCache.dishName})`, normalizedDishName),
          gte(dishCache.expiresAt, new Date())
        )
      );

      if (exactMatch) {
        log(`Cache hit for "${dishName}"`, 'cache');
        return exactMatch;
      }

      log(`Cache miss for "${dishName}"`, 'cache');
      return undefined;
    } catch (error) {
      log(`Error finding dish in cache: ${error instanceof Error ? error.message : String(error)}`, 'cache');
      return undefined;
    }
  }

  async findDishById(dishId: string): Promise<DishCache | undefined> {
    if (!dishId) { return undefined; }

    try {
      const [dish] = await db.select().from(dishCache).where(
        and(
          eq(dishCache.dishId, dishId),
          gte(dishCache.expiresAt, new Date()) // Not expired
        )
      );

      if (dish) {
        log(`Dish cache hit for ${dishId}`, 'cache');
      } else {
        log(`Dish cache miss for ${dishId}`, 'cache');
      }

      return dish;
    } catch (error) {
      log(`Error finding dish by ID: ${error instanceof Error ? error.message : String(error)}`, 'cache');
      return undefined;
    }
  }

  async getDishCacheById(id: number): Promise<DishCache | undefined> {
    try {
      const [dish] = await db.select().from(dishCache).where(eq(dishCache.id, id));

      if (dish) {
        log(`Dish cache retrieved for ID ${id}`, 'cache');
      } else {
        log(`No dish cache found for ID ${id}`, 'cache');
      }

      return dish;
    } catch (error) {
      log(`Error getting dish cache by ID: ${error instanceof Error ? error.message : String(error)}`, 'cache');
      return undefined;
    }
  }

  async cacheDish(dishData: CacheDishInput): Promise<DishCache> {
    try {
      // Generate a unique dishId from the dish name if not provided
      const normalizedName = dishData.dishName.toLowerCase().trim();
      const dishId = dishData.dishId || `dish_${normalizedName.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}`;

      // Set default expiration (90 days from now)
      const expiresAt = dishData.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // Build the complete dish data
      const dishDataWithId = {
        ...dishData,
        dishId,
        expiresAt
      };

      // Check if dish already exists by dishId
      const [existingDish] = await db.select().from(dishCache).where(eq(dishCache.dishId, dishId));

      if (existingDish) {
        // Update the existing dish
        log(`Updating existing cache entry for "${dishData.dishName}" (ID: ${dishId})`, 'cache');
        const [updatedDish] = await db
          .update(dishCache)
          .set({
            dishName: dishData.dishName || existingDish.dishName,
            imageUrls: dishData.imageUrls || existingDish.imageUrls,
            description: dishData.description || existingDish.description,
            metadata: dishData.metadata || existingDish.metadata,
            expiresAt: expiresAt,
            cachedAt: new Date()
          })
          .where(eq(dishCache.id, existingDish.id))
          .returning();

        return updatedDish;
      } else {
        // Insert new dish
        log(`Creating new cache entry for "${dishData.dishName}" (ID: ${dishId})`, 'cache');
        const [dish] = await db
          .insert(dishCache)
          .values(dishDataWithId)
          .returning();

        return dish;
      }
    } catch (error) {
      log(`Error caching dish: ${error instanceof Error ? error.message : String(error)}`, 'cache');
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();