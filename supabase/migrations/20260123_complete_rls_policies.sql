-- ============================================================
-- COMPLETE RLS POLICIES - Adding Missing Tables
-- Multi-tenant isolation with owner, website, public, and admin access
-- ============================================================
--
-- IMPORTANT: Run this migration directly in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
--
-- This migration adds RLS policies for tables that were added after
-- the initial RLS migration (20260107_rls_policies.sql)
--
-- PUBLIC ACCESS PATTERNS:
-- - All public access policies use is_website_published() to allow access
--   for any published website. This is required because published sites
--   access Supabase REST directly where the host header is the Supabase
--   endpoint, not the published domain.
-- - This is safe because data is still scoped to the specific website_id
--   and only published websites can be accessed publicly.
-- ============================================================

-- ============================================================
-- PHASED BUILD STATE TABLE
-- Owner access only (internal AI builder state)
-- ============================================================

ALTER TABLE phased_build_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phased_build_state_select" ON phased_build_state;
CREATE POLICY "phased_build_state_select" ON phased_build_state
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_insert" ON phased_build_state;
CREATE POLICY "phased_build_state_insert" ON phased_build_state
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_update" ON phased_build_state;
CREATE POLICY "phased_build_state_update" ON phased_build_state
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_delete" ON phased_build_state;
CREATE POLICY "phased_build_state_delete" ON phased_build_state
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- PRODUCT REVIEWS TABLE
-- Owner CRUD + domain-scoped public read/insert for published websites
-- ============================================================

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_reviews_select_owner" ON product_reviews;
CREATE POLICY "product_reviews_select_owner" ON product_reviews
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "product_reviews_select_anon" ON product_reviews;
CREATE POLICY "product_reviews_select_anon" ON product_reviews
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

DROP POLICY IF EXISTS "product_reviews_insert_owner" ON product_reviews;
CREATE POLICY "product_reviews_insert_owner" ON product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "product_reviews_insert_anon" ON product_reviews;
CREATE POLICY "product_reviews_insert_anon" ON product_reviews
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

DROP POLICY IF EXISTS "product_reviews_update" ON product_reviews;
CREATE POLICY "product_reviews_update" ON product_reviews
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "product_reviews_delete" ON product_reviews;
CREATE POLICY "product_reviews_delete" ON product_reviews
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE AVAILABILITY TABLE
-- Owner CRUD + domain-scoped public read for published websites (booking)
-- ============================================================

ALTER TABLE service_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_availability_select_owner" ON service_availability;
CREATE POLICY "service_availability_select_owner" ON service_availability
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_availability_select_anon" ON service_availability;
CREATE POLICY "service_availability_select_anon" ON service_availability
  FOR SELECT TO anon
  USING (
    public.is_website_published(website_id)
    AND is_active = true
  );

DROP POLICY IF EXISTS "service_availability_insert" ON service_availability;
CREATE POLICY "service_availability_insert" ON service_availability
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_availability_update" ON service_availability;
CREATE POLICY "service_availability_update" ON service_availability
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_availability_delete" ON service_availability;
CREATE POLICY "service_availability_delete" ON service_availability
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE BLOCKED DATES TABLE
-- Owner CRUD + domain-scoped public read for published websites (booking)
-- ============================================================

ALTER TABLE service_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_blocked_dates_select_owner" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_select_owner" ON service_blocked_dates
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_select_anon" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_select_anon" ON service_blocked_dates
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_insert" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_insert" ON service_blocked_dates
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_update" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_update" ON service_blocked_dates
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_delete" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_delete" ON service_blocked_dates
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE DATE RANGES TABLE
-- Owner CRUD + domain-scoped public read for published websites (booking)
-- ============================================================

ALTER TABLE service_date_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_date_ranges_select_owner" ON service_date_ranges;
CREATE POLICY "service_date_ranges_select_owner" ON service_date_ranges
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_date_ranges_select_anon" ON service_date_ranges;
CREATE POLICY "service_date_ranges_select_anon" ON service_date_ranges
  FOR SELECT TO anon
  USING (
    public.is_website_published(website_id)
    AND is_active = true
  );

DROP POLICY IF EXISTS "service_date_ranges_insert" ON service_date_ranges;
CREATE POLICY "service_date_ranges_insert" ON service_date_ranges
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_date_ranges_update" ON service_date_ranges;
CREATE POLICY "service_date_ranges_update" ON service_date_ranges
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_date_ranges_delete" ON service_date_ranges;
CREATE POLICY "service_date_ranges_delete" ON service_date_ranges
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- BILLING LEADS TABLE
-- User can only see their own leads, admins can see all
-- ============================================================

ALTER TABLE billing_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_leads_select" ON billing_leads;
CREATE POLICY "billing_leads_select" ON billing_leads
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "billing_leads_insert" ON billing_leads;
CREATE POLICY "billing_leads_insert" ON billing_leads
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "billing_leads_update" ON billing_leads;
CREATE POLICY "billing_leads_update" ON billing_leads
  FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "billing_leads_delete" ON billing_leads;
CREATE POLICY "billing_leads_delete" ON billing_leads
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- LEGAL SETTINGS TABLE
-- Owner access + domain-scoped public read for published websites
-- ============================================================

ALTER TABLE legal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_settings_select_owner" ON legal_settings;
CREATE POLICY "legal_settings_select_owner" ON legal_settings
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "legal_settings_select_anon" ON legal_settings;
CREATE POLICY "legal_settings_select_anon" ON legal_settings
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

DROP POLICY IF EXISTS "legal_settings_insert" ON legal_settings;
CREATE POLICY "legal_settings_insert" ON legal_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "legal_settings_update" ON legal_settings;
CREATE POLICY "legal_settings_update" ON legal_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "legal_settings_delete" ON legal_settings;
CREATE POLICY "legal_settings_delete" ON legal_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SUPPORT TICKETS TABLE
-- User can only see their own tickets, admins can see all
-- ============================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select" ON support_tickets;
CREATE POLICY "support_tickets_select" ON support_tickets
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "support_tickets_update" ON support_tickets;
CREATE POLICY "support_tickets_update" ON support_tickets
  FOR UPDATE
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "support_tickets_delete" ON support_tickets;
CREATE POLICY "support_tickets_delete" ON support_tickets
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after applying to verify RLS is enabled
-- ============================================================

-- List all tables with RLS enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = true;

-- List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public';

-- Count policies per table:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;
