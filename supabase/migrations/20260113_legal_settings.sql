-- Create legal_settings table for storing company/legal information per website
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS legal_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id VARCHAR NOT NULL UNIQUE,
  website_name TEXT,
  company_name TEXT,
  contact_email TEXT,
  business_address TEXT,
  terms_custom_content TEXT,
  privacy_custom_content TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add RLS policies
ALTER TABLE legal_settings ENABLE ROW LEVEL SECURITY;

-- Allow owners to read their own settings
CREATE POLICY "Users can read their own legal settings" ON legal_settings
  FOR SELECT USING (
    website_id IN (
      SELECT id FROM websites WHERE owner_id = auth.uid()::text
    )
  );

-- Allow owners to insert their own settings
CREATE POLICY "Users can insert their own legal settings" ON legal_settings
  FOR INSERT WITH CHECK (
    website_id IN (
      SELECT id FROM websites WHERE owner_id = auth.uid()::text
    )
  );

-- Allow owners to update their own settings
CREATE POLICY "Users can update their own legal settings" ON legal_settings
  FOR UPDATE USING (
    website_id IN (
      SELECT id FROM websites WHERE owner_id = auth.uid()::text
    )
  );

-- Allow admins full access
CREATE POLICY "Admins have full access to legal settings" ON legal_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()::text AND is_admin = true
    )
  );
