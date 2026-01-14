-- Migration: Add variants column to products table
-- Purpose: Enable product variant support (size, color, etc.) with price adjustments
-- Apply in Supabase Dashboard SQL Editor for production

-- Add variants column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN products.variants IS 'JSON array of ProductVariant objects: [{id, name, options: [{id, name, priceAdjustment, stockQuantity?, sku?}]}]';
