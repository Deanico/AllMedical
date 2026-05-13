-- Migration: add AI/vendor price-checking columns to product_vendor_pricing
-- Safe additive change: only adds missing columns.

BEGIN;

ALTER TABLE IF EXISTS product_vendor_pricing
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_successful_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scrape_status TEXT,
  ADD COLUMN IF NOT EXISTS scrape_error TEXT,
  ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT true;

COMMIT;
