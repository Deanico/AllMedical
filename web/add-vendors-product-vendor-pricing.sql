-- Migration: add vendors and product_vendor_pricing tables (safe, additive only)
-- This migration does not alter or remove any existing tables.

BEGIN;

-- 1) Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Product-vendor pricing table
CREATE TABLE IF NOT EXISTS product_vendor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Unique constraint for one price row per product/vendor pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'product_vendor_pricing'
      AND constraint_name = 'product_vendor_pricing_product_id_vendor_id_key'
  ) THEN
    ALTER TABLE product_vendor_pricing
      ADD CONSTRAINT product_vendor_pricing_product_id_vendor_id_key
      UNIQUE (product_id, vendor_id);
  END IF;
END $$;

-- Optional indexes for lookup performance
CREATE INDEX IF NOT EXISTS idx_product_vendor_pricing_product_id
  ON product_vendor_pricing(product_id);

CREATE INDEX IF NOT EXISTS idx_product_vendor_pricing_vendor_id
  ON product_vendor_pricing(vendor_id);

COMMIT;

-- 5) Verification query: confirms both tables exist and lists columns
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('vendors', 'product_vendor_pricing')
ORDER BY c.table_name, c.ordinal_position;

SELECT
  t.table_name,
  CASE WHEN to_regclass('public.' || t.table_name) IS NOT NULL THEN 'exists' ELSE 'missing' END AS table_status
FROM (
  VALUES ('vendors'), ('product_vendor_pricing')
) AS t(table_name);
