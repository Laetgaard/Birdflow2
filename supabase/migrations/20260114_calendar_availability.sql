-- Calendar Availability System Migration
-- Adds blocked dates and date ranges for booking services

-- Create service_blocked_dates table for specific unavailable dates
CREATE TABLE IF NOT EXISTS service_blocked_dates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id VARCHAR NOT NULL,
  website_id VARCHAR NOT NULL,
  blocked_date TEXT NOT NULL,
  reason TEXT,
  is_recurring_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for blocked dates
CREATE INDEX IF NOT EXISTS idx_blocked_dates_service ON service_blocked_dates(service_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_website ON service_blocked_dates(website_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON service_blocked_dates(blocked_date);

-- Create service_date_ranges table for active service periods
CREATE TABLE IF NOT EXISTS service_date_ranges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id VARCHAR NOT NULL,
  website_id VARCHAR NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for date ranges
CREATE INDEX IF NOT EXISTS idx_date_ranges_service ON service_date_ranges(service_id);
CREATE INDEX IF NOT EXISTS idx_date_ranges_website ON service_date_ranges(website_id);
CREATE INDEX IF NOT EXISTS idx_date_ranges_active ON service_date_ranges(is_active);

-- Enable RLS on new tables
ALTER TABLE service_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_date_ranges ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_blocked_dates
-- Owner can manage their blocked dates
CREATE POLICY "owner_blocked_dates_select" ON service_blocked_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_blocked_dates.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "owner_blocked_dates_insert" ON service_blocked_dates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_blocked_dates.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "owner_blocked_dates_delete" ON service_blocked_dates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_blocked_dates.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

-- Public read for published websites
CREATE POLICY "public_blocked_dates_select" ON service_blocked_dates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_blocked_dates.website_id 
      AND w.is_published = true
    )
  );

-- RLS policies for service_date_ranges
-- Owner can manage their date ranges
CREATE POLICY "owner_date_ranges_select" ON service_date_ranges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_date_ranges.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "owner_date_ranges_insert" ON service_date_ranges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_date_ranges.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "owner_date_ranges_update" ON service_date_ranges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_date_ranges.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "owner_date_ranges_delete" ON service_date_ranges
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_date_ranges.website_id 
      AND w.owner_id = auth.uid()::text
    )
  );

-- Public read for published websites
CREATE POLICY "public_date_ranges_select" ON service_date_ranges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w 
      WHERE w.id = service_date_ranges.website_id 
      AND w.is_published = true
    )
  );
