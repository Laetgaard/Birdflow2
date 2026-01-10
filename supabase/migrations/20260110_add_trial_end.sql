-- Add trial_end column to websites table for tracking subscription trial periods
ALTER TABLE websites ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP;
