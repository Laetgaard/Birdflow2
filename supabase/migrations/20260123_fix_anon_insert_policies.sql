-- ============================================================
-- FIX: Anonymous Insert Policies for Published Sites
-- ============================================================
-- Problem: The previous RLS policies used is_request_for_website() which checks
-- the HTTP host header. When published sites insert data directly to Supabase,
-- the host is the Supabase API URL, not the published site's domain.
-- 
-- Solution: Allow anonymous INSERT for any website that is published.
-- This matches the fix applied in 20260108_fix_analytics_rls.sql
--
-- Tables affected:
-- - orders (anon insert)
-- - order_items (anon insert)
-- - bookings (anon insert)
-- - form_submissions (anon insert)
-- - customers (anon insert)
-- ============================================================

-- ORDERS: Fix anon insert
DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
CREATE POLICY "orders_insert_anon" ON orders
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- ORDER ITEMS: Fix anon insert
DROP POLICY IF EXISTS "order_items_insert_anon" ON order_items;
CREATE POLICY "order_items_insert_anon" ON order_items
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- BOOKINGS: Fix anon insert
DROP POLICY IF EXISTS "bookings_insert_anon" ON bookings;
CREATE POLICY "bookings_insert_anon" ON bookings
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- FORM SUBMISSIONS: Fix anon insert
DROP POLICY IF EXISTS "form_submissions_insert_anon" ON form_submissions;
CREATE POLICY "form_submissions_insert_anon" ON form_submissions
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- CUSTOMERS: Fix anon insert
DROP POLICY IF EXISTS "customers_insert_anon" ON customers;
CREATE POLICY "customers_insert_anon" ON customers
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- ============================================================
-- Verification: After applying this migration, test by:
-- 1. Visit a published site
-- 2. Submit a form, place an order, or make a booking
-- 3. Check the respective tables for new rows with the website_id
-- ============================================================
