-- ============================================================
-- COMPREHENSIVE ROW LEVEL SECURITY (RLS) FOR BIRDFLOW
-- Multi-tenant isolation with owner, website, public, and admin access
-- ============================================================
--
-- IMPORTANT: Run this migration directly in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
--
-- This cannot be run via the development database because it uses
-- Supabase's auth.uid() function which only exists in Supabase.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()::text),
    false
  );
$$;

-- Check if current user owns a specific website
CREATE OR REPLACE FUNCTION public.owns_website(website_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM websites
    WHERE id = website_id
    AND owner_id = auth.uid()::text
  );
$$;

-- Check if user can access a website (owner or admin)
CREATE OR REPLACE FUNCTION public.can_access_website(website_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.owns_website(website_id) OR public.is_admin();
$$;

-- Check if a website is published (for public access)
CREATE OR REPLACE FUNCTION public.is_website_published(website_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM websites
    WHERE id = website_id
    AND status = 'published'
  );
$$;

-- ============================================================
-- PROFILES TABLE
-- Self-access for users, full access for admins
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid()::text OR public.is_admin())
  WITH CHECK (id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- PUBLIC STATS TABLE
-- Read-only for everyone, write for admins
-- ============================================================

ALTER TABLE public_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_stats_select_all" ON public_stats;
CREATE POLICY "public_stats_select_all" ON public_stats
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "public_stats_insert_admin" ON public_stats;
CREATE POLICY "public_stats_insert_admin" ON public_stats
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_stats_update_admin" ON public_stats;
CREATE POLICY "public_stats_update_admin" ON public_stats
  FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "public_stats_delete_admin" ON public_stats;
CREATE POLICY "public_stats_delete_admin" ON public_stats
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- WEBSITES TABLE
-- Owner CRUD, admin full access
-- ============================================================

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "websites_select_owner" ON websites;
CREATE POLICY "websites_select_owner" ON websites
  FOR SELECT
  USING (owner_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "websites_insert_owner" ON websites;
CREATE POLICY "websites_insert_owner" ON websites
  FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "websites_update_owner" ON websites;
CREATE POLICY "websites_update_owner" ON websites
  FOR UPDATE
  USING (owner_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (owner_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "websites_delete_owner" ON websites;
CREATE POLICY "websites_delete_owner" ON websites
  FOR DELETE
  USING (owner_id = auth.uid()::text OR public.is_admin());

-- ============================================================
-- WEBSITE INPUTS TABLE
-- Access via website ownership
-- ============================================================

ALTER TABLE website_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_inputs_select" ON website_inputs;
CREATE POLICY "website_inputs_select" ON website_inputs
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_inputs_insert" ON website_inputs;
CREATE POLICY "website_inputs_insert" ON website_inputs
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "website_inputs_update" ON website_inputs;
CREATE POLICY "website_inputs_update" ON website_inputs
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_inputs_delete" ON website_inputs;
CREATE POLICY "website_inputs_delete" ON website_inputs
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- BUILDER STATE TABLE
-- Owner access, public read for published websites
-- ============================================================

ALTER TABLE builder_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "builder_state_select" ON builder_state;
CREATE POLICY "builder_state_select" ON builder_state
  FOR SELECT
  USING (
    public.can_access_website(website_id) 
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "builder_state_insert" ON builder_state;
CREATE POLICY "builder_state_insert" ON builder_state
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "builder_state_update" ON builder_state;
CREATE POLICY "builder_state_update" ON builder_state
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "builder_state_delete" ON builder_state;
CREATE POLICY "builder_state_delete" ON builder_state
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- PRODUCTS TABLE
-- Owner CRUD, public read for published websites
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
  FOR SELECT
  USING (
    public.can_access_website(website_id)
    OR (public.is_website_published(website_id) AND status = 'active')
  );

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- ORDERS TABLE
-- Owner read/update, public insert for published websites
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- ORDER ITEMS TABLE
-- Access via website ownership
-- ============================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "order_items_insert" ON order_items;
CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "order_items_update" ON order_items;
CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "order_items_delete" ON order_items;
CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- BOOKINGS TABLE
-- Owner CRUD, public insert for published websites
-- ============================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "bookings_insert" ON bookings;
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "bookings_update" ON bookings;
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "bookings_delete" ON bookings;
CREATE POLICY "bookings_delete" ON bookings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- BOOKING SERVICES TABLE
-- Owner CRUD, public read for published websites
-- ============================================================

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_services_select" ON booking_services;
CREATE POLICY "booking_services_select" ON booking_services
  FOR SELECT
  USING (
    public.can_access_website(website_id)
    OR (public.is_website_published(website_id) AND active = 'true')
  );

DROP POLICY IF EXISTS "booking_services_insert" ON booking_services;
CREATE POLICY "booking_services_insert" ON booking_services
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "booking_services_update" ON booking_services;
CREATE POLICY "booking_services_update" ON booking_services
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "booking_services_delete" ON booking_services;
CREATE POLICY "booking_services_delete" ON booking_services
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- FORM SUBMISSIONS TABLE
-- Owner access, public insert for published websites
-- ============================================================

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_submissions_select" ON form_submissions;
CREATE POLICY "form_submissions_select" ON form_submissions
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "form_submissions_insert" ON form_submissions;
CREATE POLICY "form_submissions_insert" ON form_submissions
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "form_submissions_update" ON form_submissions;
CREATE POLICY "form_submissions_update" ON form_submissions
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "form_submissions_delete" ON form_submissions;
CREATE POLICY "form_submissions_delete" ON form_submissions
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- CUSTOMERS TABLE
-- Owner access only
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- MEDIA ASSETS TABLE
-- Owner CRUD, public read for published websites
-- ============================================================

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_select" ON media_assets;
CREATE POLICY "media_assets_select" ON media_assets
  FOR SELECT
  USING (
    public.can_access_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "media_assets_insert" ON media_assets;
CREATE POLICY "media_assets_insert" ON media_assets
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "media_assets_update" ON media_assets;
CREATE POLICY "media_assets_update" ON media_assets
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "media_assets_delete" ON media_assets;
CREATE POLICY "media_assets_delete" ON media_assets
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- CUSTOM DOMAINS TABLE
-- Owner access only
-- ============================================================

ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_domains_select" ON custom_domains;
CREATE POLICY "custom_domains_select" ON custom_domains
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "custom_domains_insert" ON custom_domains;
CREATE POLICY "custom_domains_insert" ON custom_domains
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "custom_domains_update" ON custom_domains;
CREATE POLICY "custom_domains_update" ON custom_domains
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "custom_domains_delete" ON custom_domains;
CREATE POLICY "custom_domains_delete" ON custom_domains
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SHIPPING METHODS TABLE
-- Owner CRUD, public read for published websites
-- ============================================================

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_methods_select" ON shipping_methods;
CREATE POLICY "shipping_methods_select" ON shipping_methods
  FOR SELECT
  USING (
    public.can_access_website(website_id)
    OR (public.is_website_published(website_id) AND is_active = true)
  );

DROP POLICY IF EXISTS "shipping_methods_insert" ON shipping_methods;
CREATE POLICY "shipping_methods_insert" ON shipping_methods
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "shipping_methods_update" ON shipping_methods;
CREATE POLICY "shipping_methods_update" ON shipping_methods
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_methods_delete" ON shipping_methods;
CREATE POLICY "shipping_methods_delete" ON shipping_methods
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SHIPPING CARRIER CREDENTIALS TABLE
-- Owner access only (sensitive data)
-- ============================================================

ALTER TABLE shipping_carrier_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_carrier_credentials_select" ON shipping_carrier_credentials;
CREATE POLICY "shipping_carrier_credentials_select" ON shipping_carrier_credentials
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_carrier_credentials_insert" ON shipping_carrier_credentials;
CREATE POLICY "shipping_carrier_credentials_insert" ON shipping_carrier_credentials
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "shipping_carrier_credentials_update" ON shipping_carrier_credentials;
CREATE POLICY "shipping_carrier_credentials_update" ON shipping_carrier_credentials
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_carrier_credentials_delete" ON shipping_carrier_credentials;
CREATE POLICY "shipping_carrier_credentials_delete" ON shipping_carrier_credentials
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SHIPPING CONFIG TABLE
-- Owner access only
-- ============================================================

ALTER TABLE shipping_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_config_select" ON shipping_config;
CREATE POLICY "shipping_config_select" ON shipping_config
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_config_insert" ON shipping_config;
CREATE POLICY "shipping_config_insert" ON shipping_config
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "shipping_config_update" ON shipping_config;
CREATE POLICY "shipping_config_update" ON shipping_config
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_config_delete" ON shipping_config;
CREATE POLICY "shipping_config_delete" ON shipping_config
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- WEBSITE PAYMENT SETTINGS TABLE
-- Owner access only (highly sensitive)
-- ============================================================

ALTER TABLE website_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_payment_settings_select" ON website_payment_settings;
CREATE POLICY "website_payment_settings_select" ON website_payment_settings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_payment_settings_insert" ON website_payment_settings;
CREATE POLICY "website_payment_settings_insert" ON website_payment_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "website_payment_settings_update" ON website_payment_settings;
CREATE POLICY "website_payment_settings_update" ON website_payment_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_payment_settings_delete" ON website_payment_settings;
CREATE POLICY "website_payment_settings_delete" ON website_payment_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- EMAIL SETTINGS TABLE
-- Owner access only
-- ============================================================

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_settings_select" ON email_settings;
CREATE POLICY "email_settings_select" ON email_settings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "email_settings_insert" ON email_settings;
CREATE POLICY "email_settings_insert" ON email_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "email_settings_update" ON email_settings;
CREATE POLICY "email_settings_update" ON email_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "email_settings_delete" ON email_settings;
CREATE POLICY "email_settings_delete" ON email_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- EMAIL TEMPLATES TABLE
-- Owner access only
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_select" ON email_templates;
CREATE POLICY "email_templates_select" ON email_templates
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "email_templates_insert" ON email_templates;
CREATE POLICY "email_templates_insert" ON email_templates
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "email_templates_update" ON email_templates;
CREATE POLICY "email_templates_update" ON email_templates
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "email_templates_delete" ON email_templates;
CREATE POLICY "email_templates_delete" ON email_templates
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- COOKIE SETTINGS TABLE
-- Owner access only
-- ============================================================

ALTER TABLE cookie_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cookie_settings_select" ON cookie_settings;
CREATE POLICY "cookie_settings_select" ON cookie_settings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "cookie_settings_insert" ON cookie_settings;
CREATE POLICY "cookie_settings_insert" ON cookie_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "cookie_settings_update" ON cookie_settings;
CREATE POLICY "cookie_settings_update" ON cookie_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "cookie_settings_delete" ON cookie_settings;
CREATE POLICY "cookie_settings_delete" ON cookie_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- ANALYTICS EVENTS TABLE
-- Owner read, public insert for published websites
-- ============================================================

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_select" ON analytics_events;
CREATE POLICY "analytics_events_select" ON analytics_events
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "analytics_events_insert" ON analytics_events;
CREATE POLICY "analytics_events_insert" ON analytics_events
  FOR INSERT
  WITH CHECK (
    public.owns_website(website_id)
    OR public.is_website_published(website_id)
  );

DROP POLICY IF EXISTS "analytics_events_update" ON analytics_events;
CREATE POLICY "analytics_events_update" ON analytics_events
  FOR UPDATE
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "analytics_events_delete" ON analytics_events;
CREATE POLICY "analytics_events_delete" ON analytics_events
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- GRANT EXECUTE ON HELPER FUNCTIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.owns_website(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_website(text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_access_website(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_website(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_website_published(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_website_published(text) TO anon;

-- ============================================================
-- VERIFICATION: List all tables with RLS enabled
-- ============================================================
-- Run this query to verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND rowsecurity = true;
