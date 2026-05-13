-- Seed: TestStripz Dexcom G7 pricing
-- Safe behavior:
-- - Matches rows by product/vendor names (no hardcoded UUIDs)
-- - Upserts product_vendor_pricing
-- - Updates existing tiers and inserts missing tiers
-- - Does not delete existing rows
-- - Does not create products; only uses products that already exist

BEGIN;

-- Ensure vendor exists (matched by name)
INSERT INTO vendors (name, website_url, is_active)
VALUES ('TestStripz', 'https://shop.teststripz.com', true)
ON CONFLICT (name) DO UPDATE
SET
  website_url = COALESCE(vendors.website_url, EXCLUDED.website_url),
  is_active = true;

-- Resolve product names from existing products table:
-- - 10-day product uses confirmed exact name
-- - 15-day product is matched by pattern and only included if found
WITH product_name_map AS (
  SELECT 'Dexcom G7 Sensors (10-day)'::text AS source_label, p.name AS actual_product_name
  FROM products p
  WHERE p.name = 'Dexcom G7 Sensors (10-day)'
  UNION ALL
  SELECT 'Dexcom G7 Sensor 15-day'::text AS source_label, p.name AS actual_product_name
  FROM products p
  WHERE p.name ILIKE '%Dexcom%G7%15%day%'
  ORDER BY source_label, actual_product_name
  LIMIT 2
),
input_rows AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 94.95::numeric(10,2), 94.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 2::int, 2::int, 97.48::numeric(10,2), 194.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 3::int, 3::int, 91.65::numeric(10,2), 274.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 6::int, 6::int, 91.66::numeric(10,2), 549.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 1::int, NULL::int, 139.95::numeric(10,2), 139.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 2::int, 2::int, 134.98::numeric(10,2), 269.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 6::int, 6::int, 133.33::numeric(10,2), 799.95::numeric(10,2))
  ) AS v(product_name, min_quantity, max_quantity, unit_price, pack_price)
),
resolved_input_rows AS (
  SELECT
    COALESCE(m.actual_product_name, i.product_name) AS product_name,
    i.min_quantity,
    i.max_quantity,
    i.unit_price,
    i.pack_price
  FROM input_rows i
  LEFT JOIN product_name_map m ON m.source_label = i.product_name
  WHERE i.product_name <> 'Dexcom G7 Sensor 15-day'
     OR m.actual_product_name IS NOT NULL
),
matched AS (
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    v.id AS vendor_id,
    v.name AS vendor_name,
    i.min_quantity,
    i.max_quantity,
    i.unit_price,
    i.pack_price
  FROM resolved_input_rows i
  JOIN products p ON p.name = i.product_name
  JOIN vendors v ON v.name = 'TestStripz'
),
base_prices AS (
  SELECT
    m.product_id,
    m.vendor_id,
    -- Base price is tier with min_quantity = 1
    MAX(CASE WHEN m.min_quantity = 1 THEN m.unit_price END) AS base_price
  FROM matched m
  GROUP BY m.product_id, m.vendor_id
),
upsert_pvp AS (
  INSERT INTO product_vendor_pricing (
    product_id,
    vendor_id,
    price,
    is_available,
    product_url,
    price_source,
    approval_required,
    last_updated
  )
  SELECT
    bp.product_id,
    bp.vendor_id,
    bp.base_price,
    true,
    'https://shop.teststripz.com/collections/dexcom-g7-products',
    'manual',
    true,
    NOW()
  FROM base_prices bp
  ON CONFLICT (product_id, vendor_id) DO UPDATE
  SET
    price = EXCLUDED.price,
    product_url = EXCLUDED.product_url,
    price_source = 'manual',
    approval_required = true,
    is_available = true,
    last_updated = NOW()
  RETURNING id, product_id, vendor_id
),
resolved_pvp AS (
  -- Include rows that existed before this script too
  SELECT pvp.id, pvp.product_id, pvp.vendor_id
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
  JOIN products p ON p.id = pvp.product_id
  WHERE v.name = 'TestStripz'
    AND p.name IN (
      'Dexcom G7 Sensors (10-day)',
      COALESCE((SELECT actual_product_name FROM product_name_map WHERE source_label = 'Dexcom G7 Sensor 15-day' LIMIT 1), '__NO_MATCH__')
    )
),
wanted_tiers AS (
  SELECT
    rp.id AS product_vendor_pricing_id,
    m.product_name,
    m.min_quantity,
    m.max_quantity,
    m.unit_price
  FROM matched m
  JOIN resolved_pvp rp
    ON rp.product_id = m.product_id
   AND rp.vendor_id = m.vendor_id
)
-- Update any existing matching tiers
UPDATE product_vendor_price_tiers t
SET unit_price = w.unit_price
FROM wanted_tiers w
WHERE t.product_vendor_pricing_id = w.product_vendor_pricing_id
  AND t.min_quantity = w.min_quantity
  AND (
    (t.max_quantity IS NULL AND w.max_quantity IS NULL)
    OR t.max_quantity = w.max_quantity
  );

-- Insert missing tiers
WITH product_name_map AS (
  SELECT 'Dexcom G7 Sensors (10-day)'::text AS source_label, p.name AS actual_product_name
  FROM products p
  WHERE p.name = 'Dexcom G7 Sensors (10-day)'
  UNION ALL
  SELECT 'Dexcom G7 Sensor 15-day'::text AS source_label, p.name AS actual_product_name
  FROM products p
  WHERE p.name ILIKE '%Dexcom%G7%15%day%'
  ORDER BY source_label, actual_product_name
  LIMIT 2
),
input_rows AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 94.95::numeric(10,2), 94.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 2::int, 2::int, 97.48::numeric(10,2), 194.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 3::int, 3::int, 91.65::numeric(10,2), 274.95::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 6::int, 6::int, 91.66::numeric(10,2), 549.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 1::int, NULL::int, 139.95::numeric(10,2), 139.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 2::int, 2::int, 134.98::numeric(10,2), 269.95::numeric(10,2)),
    ('Dexcom G7 Sensor 15-day'::text, 6::int, 6::int, 133.33::numeric(10,2), 799.95::numeric(10,2))
  ) AS v(product_name, min_quantity, max_quantity, unit_price, pack_price)
),
resolved_input_rows AS (
  SELECT
    COALESCE(m.actual_product_name, i.product_name) AS product_name,
    i.min_quantity,
    i.max_quantity,
    i.unit_price,
    i.pack_price
  FROM input_rows i
  LEFT JOIN product_name_map m ON m.source_label = i.product_name
  WHERE i.product_name <> 'Dexcom G7 Sensor 15-day'
     OR m.actual_product_name IS NOT NULL
),
matched AS (
  SELECT
    p.id AS product_id,
    v.id AS vendor_id,
    i.min_quantity,
    i.max_quantity,
    i.unit_price
  FROM resolved_input_rows i
  JOIN products p ON p.name = i.product_name
  JOIN vendors v ON v.name = 'TestStripz'
),
resolved_pvp AS (
  SELECT pvp.id, pvp.product_id, pvp.vendor_id
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
  JOIN products p ON p.id = pvp.product_id
  WHERE v.name = 'TestStripz'
    AND p.name IN (
      'Dexcom G7 Sensors (10-day)',
      COALESCE((SELECT actual_product_name FROM product_name_map WHERE source_label = 'Dexcom G7 Sensor 15-day' LIMIT 1), '__NO_MATCH__')
    )
),
wanted_tiers AS (
  SELECT
    rp.id AS product_vendor_pricing_id,
    m.min_quantity,
    m.max_quantity,
    m.unit_price
  FROM matched m
  JOIN resolved_pvp rp
    ON rp.product_id = m.product_id
   AND rp.vendor_id = m.vendor_id
)
INSERT INTO product_vendor_price_tiers (
  product_vendor_pricing_id,
  min_quantity,
  max_quantity,
  unit_price
)
SELECT
  w.product_vendor_pricing_id,
  w.min_quantity,
  w.max_quantity,
  w.unit_price
FROM wanted_tiers w
WHERE NOT EXISTS (
  SELECT 1
  FROM product_vendor_price_tiers t
  WHERE t.product_vendor_pricing_id = w.product_vendor_pricing_id
    AND t.min_quantity = w.min_quantity
    AND (
      (t.max_quantity IS NULL AND w.max_quantity IS NULL)
      OR t.max_quantity = w.max_quantity
    )
);

COMMIT;

-- Verification query (read-only): show pricing tiers + URL
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
  AND p.name IN (
    'Dexcom G7 Sensors (10-day)',
    COALESCE((SELECT p2.name FROM products p2 WHERE p2.name ILIKE '%Dexcom%G7%15%day%' ORDER BY p2.name LIMIT 1), '__NO_MATCH__')
  )
ORDER BY p.name, v.name, t.min_quantity;

-- Optional read-only helper: show missing expected products by name
SELECT expected.product_name
FROM (
  VALUES ('Dexcom G7 Sensors (10-day)'::text), ('Dexcom G7 Sensor 15-day (pattern match)'::text)
) AS expected(product_name)
LEFT JOIN products p ON p.name = expected.product_name
WHERE expected.product_name = 'Dexcom G7 Sensors (10-day)'
  AND p.id IS NULL;
