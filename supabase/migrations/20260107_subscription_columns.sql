-- Add subscription billing columns to profiles and websites tables
-- Apply this in Supabase Dashboard SQL Editor

-- Add Stripe customer ID to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add subscription fields to websites
ALTER TABLE websites ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_websites_stripe_subscription_id ON websites(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
