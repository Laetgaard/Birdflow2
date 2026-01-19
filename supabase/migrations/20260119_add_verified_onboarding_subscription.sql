-- Add verified_onboarding_subscription_id column to profiles table
-- This column stores the verified Stripe subscription ID during onboarding
-- It is set when user completes checkout and cleared after website creation

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS verified_onboarding_subscription_id TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN profiles.verified_onboarding_subscription_id IS 
  'Stores the verified Stripe subscription ID during onboarding. Set after successful checkout, cleared after website creation.';
