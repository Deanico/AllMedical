-- Migration: add product_vendor_price_tiers table (safe, additive only)
-- Does not modify or remove existing tables.

BEGIN;

CREATE TABLE IF NOT EXISTS product_vendor_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_vendor_pricing_id UUID REFERENCES product_vendor_pricing(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT product_vendor_price_tiers_min_quantity_check
    CHECK (min_quantity > 0),
  CONSTRAINT product_vendor_price_tiers_max_quantity_check
    CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

-- Ensure required constraints exist if the table already existed without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'product_vendor_price_tiers'
      AND constraint_name = 'product_vendor_price_tiers_min_quantity_check'
  ) THEN
    ALTER TABLE product_vendor_price_tiers
      ADD CONSTRAINT product_vendor_price_tiers_min_quantity_check
      CHECK (min_quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'product_vendor_price_tiers'
      AND constraint_name = 'product_vendor_price_tiers_max_quantity_check'
  ) THEN
    ALTER TABLE product_vendor_price_tiers
      ADD CONSTRAINT product_vendor_price_tiers_max_quantity_check
      CHECK (max_quantity IS NULL OR max_quantity >= min_quantity);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_vendor_price_tiers_pvp_id
  ON product_vendor_price_tiers(product_vendor_pricing_id);

COMMIT;
