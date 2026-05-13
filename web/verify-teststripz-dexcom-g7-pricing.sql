-- Verification only: TestStripz Dexcom G7 pricing seed
-- Read-only queries (no schema changes)

-- 1) Confirm vendor exists
SELECT
  v.id,
  v.name,
  v.website_url,
  v.is_active,
  v.created_at
FROM vendors v
WHERE v.name = 'TestStripz';

-- 2) Confirm target products exist
SELECT
  p.id,
  p.name,
  p.active,
  p.created_at
FROM products p
WHERE p.name IN ('Dexcom G7 Sensor 10-day', 'Dexcom G7 Sensor 15-day')
ORDER BY p.name;

-- 3) Verify product_vendor_pricing rows + core fields
SELECT
  p.name AS product_name,
  v.name AS vendor_name,
  pvp.id AS product_vendor_pricing_id,
  pvp.price,
  pvp.is_available,
  pvp.product_url,
  pvp.price_source,
  pvp.approval_required,
  pvp.last_updated
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE v.name = 'TestStripz'
  AND p.name IN ('Dexcom G7 Sensor 10-day', 'Dexcom G7 Sensor 15-day')
ORDER BY p.name, v.name;

-- 4) Verify tier rows + requested output shape
SELECT
  p.name AS product_name,
  v.name AS vendor_name,
  t.min_quantity,
  t.max_quantity,
  t.unit_price,
  pvp.product_url
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE v.name = 'TestStripz'
  AND p.name IN ('Dexcom G7 Sensor 10-day', 'Dexcom G7 Sensor 15-day')
ORDER BY p.name, v.name, t.min_quantity;

-- 5) Show expected tiers vs actual counts by product
SELECT
  p.name AS product_name,
  COUNT(*) AS actual_tier_count,
  CASE
    WHEN p.name = 'Dexcom G7 Sensor 10-day' THEN 4
    WHEN p.name = 'Dexcom G7 Sensor 15-day' THEN 3
    ELSE NULL
  END AS expected_tier_count
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE v.name = 'TestStripz'
  AND p.name IN ('Dexcom G7 Sensor 10-day', 'Dexcom G7 Sensor 15-day')
GROUP BY p.name
ORDER BY p.name;

-- 6) Optional: show missing expected products by name
SELECT expected.product_name
FROM (
  VALUES ('Dexcom G7 Sensor 10-day'::text), ('Dexcom G7 Sensor 15-day'::text)
) AS expected(product_name)
LEFT JOIN products p ON p.name = expected.product_name
WHERE p.id IS NULL;
