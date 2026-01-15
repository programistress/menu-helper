-- MenuHelper Production Schema Setup
-- Run this SQL in your production database if you can't use drizzle-kit push

-- Create preferences table
CREATE TABLE IF NOT EXISTS "preferences" (
    "id" SERIAL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "dietary" TEXT[],
    "cuisines" TEXT[],
    "allergies" TEXT[],
    "flavors" TEXT[],
    "dislikedIngredients" TEXT[]
);

-- Create dish cache table
CREATE TABLE IF NOT EXISTS "dish_cache" (
    "id" SERIAL PRIMARY KEY,
    "dish_name" TEXT NOT NULL,
    "dish_id" TEXT NOT NULL UNIQUE,
    "image_urls" TEXT[],
    "description" TEXT,
    "metadata" JSONB,
    "cached_at" TIMESTAMP DEFAULT NOW(),
    "expires_at" TIMESTAMP
);

-- Create users table (if you plan to use it)
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "preferences_device_id_idx" ON "preferences" ("device_id");
CREATE INDEX IF NOT EXISTS "dish_cache_dish_id_idx" ON "dish_cache" ("dish_id");
CREATE INDEX IF NOT EXISTS "dish_cache_dish_name_idx" ON "dish_cache" ("dish_name");

-- Grant necessary permissions (adjust if needed)
-- If you're using a specific role, replace 'neondb_owner' with your role
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neondb_owner;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neondb_owner;

SELECT 'Schema created successfully!' as status;
