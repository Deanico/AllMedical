-- Migration: add fulfillment strategy fields to product_vendor_pricing
-- Purpose: Store pack sizes and 90-day cart quantities for vendor fulfillment optimization
-- Scope: Adds columns + populates TestStripz mappings for Dexcom G7 and Omnipod

BEGIN;

-- 1) Add fulfillment strategy columns to product_vendor_pricing
ALTER TABLE IF EXISTS product_vendor_pricing
  ADD COLUMN IF NOT EXISTS fulfillment_pack_size INTEGER,
  ADD COLUMN IF NOT EXISTS cart_quantity_for_90_days INTEGER,
  ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;

-- 2) Populate TestStripz fulfillment mappings (3-month strategy):
--    G7 10-day:  3-pack, need 3 packs for 90 days (9 sensors total)
--    G7 15-day:  6-pack, need 1 pack for 90 days (6 sensors total)
--    Omnipod 5:  20-pack, need 2 packs for 90 days (40 pods total)
WITH teststripz_fulfillment AS (
  SELECT
    pvp.id,
    p.name,
    CASE
      WHEN lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      THEN 'Dexcom G7 Sensors (10-day)'
      WHEN lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      THEN 'Dexcom G7 Sensors (15-day)'
      WHEN lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      THEN 'Omnipod 5'
      ELSE NULL
    END AS product_category,
    CASE
      WHEN lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      THEN 3
      WHEN lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      THEN 6
      WHEN lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      THEN 20
      ELSE NULL
    END AS pack_size,
    CASE
      WHEN lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      THEN 3
      WHEN lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      THEN 1
      WHEN lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      THEN 2
      ELSE NULL
    END AS cart_qty_90d,
    CASE
      WHEN lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      THEN '3-pack sensors, 9 total for 90-day supply (change sensor every 10 days)'
      WHEN lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      THEN '6-pack sensors, 6 total for 90-day supply (wear 2 simultaneously)'
      WHEN lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      THEN '20-pack pods, 40 total for 90-day supply (~1.3 pods/day average)'
      ELSE NULL
    END AS notes
  FROM product_vendor_pricing pvp
  JOIN products p ON p.id = pvp.product_id
  JOIN vendors v ON v.id = pvp.vendor_id
  WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
    AND (
      lower(p.name) LIKE '%dexcom%g7%10%day%'
      OR lower(p.name) LIKE '%dexcom%g7%15%day%'
      OR (lower(p.name) LIKE '%omnipod%5%' AND lower(p.name) NOT LIKE '%dash%')
    )
)
UPDATE product_vendor_pricing pvp
SET
  fulfillment_pack_size = t.pack_size,
  cart_quantity_for_90_days = t.cart_qty_90d,
  fulfillment_notes = t.notes
FROM teststripz_fulfillment t
WHERE pvp.id = t.id;

COMMIT;

-- Verification: inspect TestStripz fulfillment mappings
SELECT
  p.name AS product_name,
  p.sku,
  v.name AS vendor_name,
  pvp.fulfillment_pack_size,
  pvp.cart_quantity_for_90_days,
  pvp.fulfillment_notes
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
  AND (
    lower(p.name) LIKE '%dexcom%g7%10%day%'
    OR lower(p.name) LIKE '%dexcom%g7%15%day%'
    OR lower(p.name) LIKE '%omnipod%5%'
  )
ORDER BY p.name;
