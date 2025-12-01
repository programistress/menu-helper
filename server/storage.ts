import { 
    users, type User, type InsertUser,
    preferences, type Preference, type InsertPreference,
    savedDishes, type SavedDish, type InsertSavedDish,
    dishCache, type DishCache, type InsertDishCache
  } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and, desc, or, sql, gte } from "drizzle-orm";

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
    
    // Dish Cache methods
    // findDishInCache(dishName: string): Promise<DishCache | undefined>;
    // findDishById(dishId: string): Promise<DishCache | undefined>;
    // getDishCacheById(id: number): Promise<DishCache | undefined>;
    // cacheDish(dishData: InsertDishCache): Promise<DishCache>;
    // getRecentlyAddedDishes(limit?: number): Promise<DishCache[]>;
    
    // Saved Dishes methods
    // getSavedDishesByDeviceId(deviceId: string): Promise<SavedDish[]>;
    // findSavedDish(deviceId: string, dishName: string): Promise<SavedDish | undefined>;
    // createSavedDish(savedDish: InsertSavedDish): Promise<SavedDish>;
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
}

export const storage = new DatabaseStorage();