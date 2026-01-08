-- ============================================================
-- FIX: Analytics Events RLS for Published Sites
-- ============================================================
-- Problem: The previous RLS policy used is_request_for_website() which checks
-- the HTTP host header. When published sites insert analytics directly to
-- Supabase, the host is the Supabase API URL, not the published site's domain.
-- 
-- Solution: Allow anonymous INSERT for any website that is published.
-- This is safe because:
-- 1. Analytics events don't contain sensitive data (privacy-first design)
-- 2. The website_id must be a valid, published website
-- 3. We sanitize all event data before insertion
-- ============================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "analytics_events_insert_anon" ON analytics_events;

-- Create a new policy that allows insert for any published website
CREATE POLICY "analytics_events_insert_anon" ON analytics_events
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

-- Also ensure authenticated users can insert for any published website they own
DROP POLICY IF EXISTS "analytics_events_insert_owner" ON analytics_events;
CREATE POLICY "analytics_events_insert_owner" ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_website(website_id) 
    OR public.is_website_published(website_id)
  );

-- ============================================================
-- Verification: After applying this migration, test by:
-- 1. Visit a published site
-- 2. Accept cookies
-- 3. Check analytics_events table for new rows with the website_id
-- ============================================================
