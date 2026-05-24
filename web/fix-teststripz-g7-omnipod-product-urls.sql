-- Normalize TestStripz URL + unit price for 3-month purchasing priority.
-- Scope is intentionally narrow:
-- 1) Only TestStripz vendor rows
-- 2) Omnipod 5 rows use 20-pack URL and unit price 184.99
-- 3) Dexcom G7 10-day rows use 3-pack URL and unit price 91.65
-- 4) Dexcom G7 15-day rows use 6-pack URL and unit price 133.34
-- 5) Also syncs any existing price-tier unit_price rows for those same products

BEGIN;

WITH mapped AS (
  SELECT
    pvp.id,
    p.name AS product_name,
    p.sku,
    pvp.product_url AS current_url,
    CASE
      -- Dexcom G7 15-day canonical row: use 6-pack PDP
      WHEN (
        lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      ) THEN 'https://shop.teststripz.com/products/dexcom-g7-sensor-15-day-6-pack?_pos=7&_sid=7ed8cac01&_ss=r&variant=46671393521854'

      -- Dexcom G7 10-day canonical row: use 3-pack PDP
      WHEN (
        lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      ) THEN 'https://shop.teststripz.com/products/dexcom-g7-sensor-3-pack?variant=43582075011262'

      -- Omnipod 5 rows: use 20-pack PDP for 3-month strategy
      WHEN (
        lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      ) THEN 'https://shop.teststripz.com/products/omnipod-5-pods-20-pack?_pos=5&_sid=391b369e6&_ss=r'

      ELSE NULL
    END AS target_url,
    CASE
      WHEN (
        lower(p.name) LIKE '%dexcom%g7%15%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-15D%'
      ) THEN 133.34::numeric(10,2)
      WHEN (
        lower(p.name) LIKE '%dexcom%g7%10%day%'
        OR coalesce(p.sku, '') ILIKE 'DX-G7-10D%'
      ) THEN 91.65::numeric(10,2)
      WHEN (
        lower(p.name) LIKE '%omnipod%5%'
        AND lower(p.name) NOT LIKE '%dash%'
      ) THEN 184.99::numeric(10,2)
      ELSE NULL
    END AS target_unit_price
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
  JOIN products p ON p.id = pvp.product_id
  WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
), updated AS (
  UPDATE product_vendor_pricing pvp
  SET product_url = m.target_url,
      price = m.target_unit_price,
      last_updated = NOW()
  FROM mapped m
  WHERE pvp.id = m.id
    AND m.target_url IS NOT NULL
    AND m.target_unit_price IS NOT NULL
  RETURNING pvp.id
), updated_tiers AS (
  UPDATE product_vendor_price_tiers t
  SET unit_price = m.target_unit_price
  FROM mapped m
  WHERE t.product_vendor_pricing_id = m.id
    AND m.target_unit_price IS NOT NULL
  RETURNING t.id
)
SELECT COUNT(*) AS rows_updated
FROM updated;

COMMIT;

-- Verification: inspect TestStripz rows relevant to this mapping
SELECT
  p.name AS product_name,
  p.sku,
  pvp.price,
  t.min_quantity,
  t.max_quantity,
  t.unit_price AS tier_unit_price,
  pvp.product_url,
  v.name AS vendor_name
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
LEFT JOIN product_vendor_price_tiers t ON t.product_vendor_pricing_id = pvp.id
WHERE regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g') = 'teststripz'
  AND (
    lower(p.name) LIKE '%dexcom%g7%10%day%'
    OR lower(p.name) LIKE '%dexcom%g7%15%day%'
    OR lower(p.name) LIKE '%omnipod%5%'
  )
ORDER BY p.name, t.min_quantity NULLS FIRST;
