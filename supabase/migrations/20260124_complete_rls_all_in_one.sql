-- ============================================================
-- COMPLETE ROW LEVEL SECURITY (RLS) FOR BIRDFLOW - ALL-IN-ONE
-- Multi-tenant isolation with owner, website, public, and admin access
-- ============================================================
--
-- IMPORTANT: Run this migration directly in your Supabase Dashboard:
-- 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute
--
-- This migration is self-contained and includes all helper functions
-- with correct VARCHAR parameter types to match your table columns.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (with VARCHAR parameter types)
-- ============================================================

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()::text),
    false
  );
$$;

-- Check if current user owns a specific website (VARCHAR version)
CREATE OR REPLACE FUNCTION public.owns_website(p_website_id varchar)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM websites
    WHERE id = p_website_id
    AND owner_id = auth.uid()::text
  );
$$;

-- Check if user can access a website (owner or admin) (VARCHAR version)
CREATE OR REPLACE FUNCTION public.can_access_website(p_website_id varchar)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.owns_website(p_website_id) OR public.is_admin();
$$;

-- Check if a website is published (for public access) (VARCHAR version)
CREATE OR REPLACE FUNCTION public.is_website_published(p_website_id varchar)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM websites
    WHERE id = p_website_id
    AND status = 'published'
  );
$$;

-- Resolve website_id from request host header
CREATE OR REPLACE FUNCTION public.website_for_host()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_host text;
  v_website_id text;
BEGIN
  v_host := current_setting('request.headers', true)::json->>'host';
  
  IF v_host IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT website_id INTO v_website_id
  FROM custom_domains
  WHERE domain = v_host
  AND status = 'active'
  LIMIT 1;
  
  IF v_website_id IS NOT NULL THEN
    RETURN v_website_id;
  END IF;
  
  SELECT id INTO v_website_id
  FROM websites
  WHERE deployment_url LIKE '%' || v_host || '%'
  LIMIT 1;
  
  RETURN v_website_id;
END;
$$;

-- Check if current request is for a specific published website (VARCHAR version)
CREATE OR REPLACE FUNCTION public.is_request_for_website(p_website_id varchar)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.website_for_host() = p_website_id
    AND public.is_website_published(p_website_id);
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
-- Read-only for everyone, write for admins only
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
-- PAGES TABLE
-- Owner CRUD via website ownership
-- ============================================================

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pages_select" ON pages;
CREATE POLICY "pages_select" ON pages
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "pages_insert" ON pages;
CREATE POLICY "pages_insert" ON pages
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "pages_update" ON pages;
CREATE POLICY "pages_update" ON pages
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "pages_delete" ON pages;
CREATE POLICY "pages_delete" ON pages
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- PRODUCTS TABLE
-- Owner CRUD + domain-scoped public read for published websites
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_owner" ON products;
CREATE POLICY "products_select_owner" ON products
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "products_select_anon" ON products;
CREATE POLICY "products_select_anon" ON products
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

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
-- SERVICES TABLE
-- Owner CRUD + domain-scoped public read for published websites
-- ============================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_owner" ON services;
CREATE POLICY "services_select_owner" ON services
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "services_select_anon" ON services;
CREATE POLICY "services_select_anon" ON services
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

DROP POLICY IF EXISTS "services_insert" ON services;
CREATE POLICY "services_insert" ON services
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "services_update" ON services;
CREATE POLICY "services_update" ON services
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_delete" ON services
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- BOOKING_SERVICES TABLE
-- Owner CRUD + domain-scoped public read for published websites
-- ============================================================

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_services_select_owner" ON booking_services;
CREATE POLICY "booking_services_select_owner" ON booking_services
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "booking_services_select_anon" ON booking_services;
CREATE POLICY "booking_services_select_anon" ON booking_services
  FOR SELECT TO anon
  USING (public.is_website_published(website_id));

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
-- ORDERS TABLE
-- Owner CRUD + domain-scoped public insert for checkout
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "orders_insert_owner" ON orders;
CREATE POLICY "orders_insert_owner" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "orders_insert_anon" ON orders;
CREATE POLICY "orders_insert_anon" ON orders
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

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
-- Owner CRUD + domain-scoped public insert for checkout
-- ============================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "order_items_insert_owner" ON order_items;
CREATE POLICY "order_items_insert_owner" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "order_items_insert_anon" ON order_items;
CREATE POLICY "order_items_insert_anon" ON order_items
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

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
-- Owner CRUD + domain-scoped public insert for booking
-- ============================================================

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "bookings_insert_owner" ON bookings;
CREATE POLICY "bookings_insert_owner" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "bookings_insert_anon" ON bookings;
CREATE POLICY "bookings_insert_anon" ON bookings
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

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
-- FORM SUBMISSIONS TABLE
-- Owner CRUD + domain-scoped public insert for forms
-- ============================================================

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form_submissions_select" ON form_submissions;
CREATE POLICY "form_submissions_select" ON form_submissions
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "form_submissions_insert_owner" ON form_submissions;
CREATE POLICY "form_submissions_insert_owner" ON form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "form_submissions_insert_anon" ON form_submissions;
CREATE POLICY "form_submissions_insert_anon" ON form_submissions
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

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
-- Owner CRUD + domain-scoped public insert for checkout
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "customers_insert_owner" ON customers;
CREATE POLICY "customers_insert_owner" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "customers_insert_anon" ON customers;
CREATE POLICY "customers_insert_anon" ON customers
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

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
-- CUSTOM DOMAINS TABLE
-- Owner CRUD via website ownership
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
-- EMAIL SETTINGS TABLE
-- Owner CRUD via website ownership
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
-- Owner CRUD via website ownership
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
-- ANALYTICS EVENTS TABLE
-- Owner read + domain-scoped public insert for tracking
-- ============================================================

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_select" ON analytics_events;
CREATE POLICY "analytics_events_select" ON analytics_events
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "analytics_events_insert_owner" ON analytics_events;
CREATE POLICY "analytics_events_insert_owner" ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "analytics_events_insert_anon" ON analytics_events;
CREATE POLICY "analytics_events_insert_anon" ON analytics_events
  FOR INSERT TO anon
  WITH CHECK (public.is_website_published(website_id));

DROP POLICY IF EXISTS "analytics_events_delete" ON analytics_events;
CREATE POLICY "analytics_events_delete" ON analytics_events
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SHIPPING SETTINGS TABLE
-- Owner CRUD via website ownership
-- ============================================================

ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_settings_select" ON shipping_settings;
CREATE POLICY "shipping_settings_select" ON shipping_settings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_settings_insert" ON shipping_settings;
CREATE POLICY "shipping_settings_insert" ON shipping_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "shipping_settings_update" ON shipping_settings;
CREATE POLICY "shipping_settings_update" ON shipping_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_settings_delete" ON shipping_settings;
CREATE POLICY "shipping_settings_delete" ON shipping_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SHIPPING ZONES TABLE
-- Owner CRUD via website ownership
-- ============================================================

ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_zones_select" ON shipping_zones;
CREATE POLICY "shipping_zones_select" ON shipping_zones
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_zones_insert" ON shipping_zones;
CREATE POLICY "shipping_zones_insert" ON shipping_zones
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "shipping_zones_update" ON shipping_zones;
CREATE POLICY "shipping_zones_update" ON shipping_zones
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "shipping_zones_delete" ON shipping_zones;
CREATE POLICY "shipping_zones_delete" ON shipping_zones
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- PAYMENT SETTINGS TABLE
-- Owner CRUD via website ownership (sensitive - no public access)
-- ============================================================

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings_select" ON payment_settings;
CREATE POLICY "payment_settings_select" ON payment_settings
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "payment_settings_insert" ON payment_settings;
CREATE POLICY "payment_settings_insert" ON payment_settings
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "payment_settings_update" ON payment_settings;
CREATE POLICY "payment_settings_update" ON payment_settings
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "payment_settings_delete" ON payment_settings;
CREATE POLICY "payment_settings_delete" ON payment_settings
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- WEBSITE PLANS TABLE
-- Owner CRUD via website ownership
-- ============================================================

ALTER TABLE website_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_plans_select" ON website_plans;
CREATE POLICY "website_plans_select" ON website_plans
  FOR SELECT
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_plans_insert" ON website_plans;
CREATE POLICY "website_plans_insert" ON website_plans
  FOR INSERT
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "website_plans_update" ON website_plans;
CREATE POLICY "website_plans_update" ON website_plans
  FOR UPDATE
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "website_plans_delete" ON website_plans;
CREATE POLICY "website_plans_delete" ON website_plans
  FOR DELETE
  USING (public.can_access_website(website_id));

-- ============================================================
-- SUBSCRIPTIONS TABLE
-- User's own subscriptions only
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "subscriptions_delete" ON subscriptions;
CREATE POLICY "subscriptions_delete" ON subscriptions
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- PHASED BUILD STATE TABLE
-- Owner access only (internal AI builder state)
-- ============================================================

ALTER TABLE phased_build_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phased_build_state_select" ON phased_build_state;
CREATE POLICY "phased_build_state_select" ON phased_build_state
  FOR SELECT TO authenticated
  USING (public.can_access_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_insert" ON phased_build_state;
CREATE POLICY "phased_build_state_insert" ON phased_build_state
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_update" ON phased_build_state;
CREATE POLICY "phased_build_state_update" ON phased_build_state
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "phased_build_state_delete" ON phased_build_state;
CREATE POLICY "phased_build_state_delete" ON phased_build_state
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- PRODUCT REVIEWS TABLE
-- Owner CRUD + public read/insert for published websites
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
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "product_reviews_delete" ON product_reviews;
CREATE POLICY "product_reviews_delete" ON product_reviews
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE AVAILABILITY TABLE
-- Owner CRUD + public read for published websites (active only)
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
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_availability_update" ON service_availability;
CREATE POLICY "service_availability_update" ON service_availability
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_availability_delete" ON service_availability;
CREATE POLICY "service_availability_delete" ON service_availability
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE BLOCKED DATES TABLE
-- Owner CRUD + public read for published websites
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
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_update" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_update" ON service_blocked_dates
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_blocked_dates_delete" ON service_blocked_dates;
CREATE POLICY "service_blocked_dates_delete" ON service_blocked_dates
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- SERVICE DATE RANGES TABLE
-- Owner CRUD + public read for published websites (active only)
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
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "service_date_ranges_update" ON service_date_ranges;
CREATE POLICY "service_date_ranges_update" ON service_date_ranges
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "service_date_ranges_delete" ON service_date_ranges;
CREATE POLICY "service_date_ranges_delete" ON service_date_ranges
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- BILLING LEADS TABLE
-- User's own leads + admin access
-- ============================================================

ALTER TABLE billing_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_leads_select" ON billing_leads;
CREATE POLICY "billing_leads_select" ON billing_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "billing_leads_insert" ON billing_leads;
CREATE POLICY "billing_leads_insert" ON billing_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "billing_leads_update" ON billing_leads;
CREATE POLICY "billing_leads_update" ON billing_leads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "billing_leads_delete" ON billing_leads;
CREATE POLICY "billing_leads_delete" ON billing_leads
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- LEGAL SETTINGS TABLE
-- Owner CRUD + public read for published websites
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
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_website(website_id));

DROP POLICY IF EXISTS "legal_settings_update" ON legal_settings;
CREATE POLICY "legal_settings_update" ON legal_settings
  FOR UPDATE TO authenticated
  USING (public.can_access_website(website_id))
  WITH CHECK (public.can_access_website(website_id));

DROP POLICY IF EXISTS "legal_settings_delete" ON legal_settings;
CREATE POLICY "legal_settings_delete" ON legal_settings
  FOR DELETE TO authenticated
  USING (public.can_access_website(website_id));

-- ============================================================
-- SUPPORT TICKETS TABLE
-- User's own tickets + admin access
-- ============================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select" ON support_tickets;
CREATE POLICY "support_tickets_select" ON support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
CREATE POLICY "support_tickets_insert" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "support_tickets_update" ON support_tickets;
CREATE POLICY "support_tickets_update" ON support_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS "support_tickets_delete" ON support_tickets;
CREATE POLICY "support_tickets_delete" ON support_tickets
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- AI CONTEXT TABLE (if exists)
-- Owner access only
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_context') THEN
    ALTER TABLE ai_context ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "ai_context_select" ON ai_context;
    CREATE POLICY "ai_context_select" ON ai_context
      FOR SELECT TO authenticated
      USING (public.can_access_website(website_id));
    
    DROP POLICY IF EXISTS "ai_context_insert" ON ai_context;
    CREATE POLICY "ai_context_insert" ON ai_context
      FOR INSERT TO authenticated
      WITH CHECK (public.owns_website(website_id));
    
    DROP POLICY IF EXISTS "ai_context_update" ON ai_context;
    CREATE POLICY "ai_context_update" ON ai_context
      FOR UPDATE TO authenticated
      USING (public.can_access_website(website_id))
      WITH CHECK (public.can_access_website(website_id));
    
    DROP POLICY IF EXISTS "ai_context_delete" ON ai_context;
    CREATE POLICY "ai_context_delete" ON ai_context
      FOR DELETE TO authenticated
      USING (public.can_access_website(website_id));
  END IF;
END $$;

-- ============================================================
-- BUILDER STATE TABLE (if exists)
-- Owner access only
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'builder_state') THEN
    ALTER TABLE builder_state ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "builder_state_select" ON builder_state;
    CREATE POLICY "builder_state_select" ON builder_state
      FOR SELECT TO authenticated
      USING (public.can_access_website(website_id));
    
    DROP POLICY IF EXISTS "builder_state_insert" ON builder_state;
    CREATE POLICY "builder_state_insert" ON builder_state
      FOR INSERT TO authenticated
      WITH CHECK (public.owns_website(website_id));
    
    DROP POLICY IF EXISTS "builder_state_update" ON builder_state;
    CREATE POLICY "builder_state_update" ON builder_state
      FOR UPDATE TO authenticated
      USING (public.can_access_website(website_id))
      WITH CHECK (public.can_access_website(website_id));
    
    DROP POLICY IF EXISTS "builder_state_delete" ON builder_state;
    CREATE POLICY "builder_state_delete" ON builder_state
      FOR DELETE TO authenticated
      USING (public.can_access_website(website_id));
  END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after migration to confirm policies are in place
-- ============================================================

-- Check that RLS is enabled on all tables
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('profiles', 'websites', 'products', 'services', 'orders', 
--   'bookings', 'customers', 'analytics_events', 'phased_build_state', 
--   'product_reviews', 'service_availability', 'legal_settings', 'support_tickets');

-- List all policies
-- SELECT schemaname, tablename, policyname, cmd, qual 
-- FROM pg_policies WHERE schemaname = 'public';
