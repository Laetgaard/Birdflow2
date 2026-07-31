-- ============================================================
-- ORDERS: delivery date + tracking (fulfilment fields)
-- Sketch: "give customer a delivery date, send confirmation +
-- tracking mail" from the manage/orders drawing.
-- ============================================================
--
-- IMPORTANT: Run this migration directly in your Supabase Dashboard
-- (or via SUPABASE_DB_URL like the 20260731 booking migration):
-- 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
--
-- All columns are nullable additions - no existing rows change and
-- no RLS changes are needed (orders policies already exist).
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_email_sent_at timestamp;
