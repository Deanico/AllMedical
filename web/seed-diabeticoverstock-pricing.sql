-- Seed: Diabetic Overstock pricing (exact-name match only)
-- Safe behavior:
-- - Matches products and vendor by name (no hardcoded UUIDs)
-- - Uses ONLY existing products (joins on products.name)
-- - Uses current catalog names where they differ from canonical naming
-- - Upserts product_vendor_pricing
-- - Updates existing tiers and inserts missing tiers
-- - Does not delete existing rows
-- - Ignores products not listed below

BEGIN;

-- Ensure vendor exists (upsert by exact name)
INSERT INTO vendors (name, is_active)
VALUES ('Diabetic Overstock', true)
ON CONFLICT (name) DO UPDATE
SET is_active = true;

-- Step 1: upsert base pricing into product_vendor_pricing (one row per product/vendor)
WITH input_base AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text, 109.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text, 299.99::numeric(10,2)),
    ('Dexcom G6 Transmitter'::text, 199.99::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 209.99::numeric(10,2)),

    ('Autosoft XC 6mm 23"'::text, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 32"'::text, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 43"'::text, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 23"'::text, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 32"'::text, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 43"'::text, 119.99::numeric(10,2)),

    ('AutoSoft 90 6mm 23"'::text, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 32"'::text, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 43"'::text, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 23"'::text, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 32"'::text, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 43"'::text, 119.99::numeric(10,2)),

    ('Autosoft 30 13mm 23"'::text, 94.99::numeric(10,2)),
    ('Autosoft 30 13mm 43"'::text, 94.99::numeric(10,2)),

    ('Quick-set 6mm 23"'::text, 139.99::numeric(10,2)),
    ('Quick-set 6mm 32"'::text, 139.99::numeric(10,2)),
    ('Quick-set 9mm 23"'::text, 139.99::numeric(10,2)),
    ('Quick-set 9mm 32"'::text, 139.99::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text, 144.99::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 49.99::numeric(10,2)),

    ('MiniMed Reservoir 3mL'::text, 32.99::numeric(10,2)),
    ('MiniMed Reservoir 1.8mL'::text, 27.99::numeric(10,2)),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text, 34.99::numeric(10,2))
  ) AS v(product_name, base_price)
),
matched AS (
  SELECT
    p.id AS product_id,
    vnd.id AS vendor_id,
    ib.base_price
  FROM input_base ib
  JOIN products p   ON p.name   = ib.product_name
  JOIN vendors vnd  ON vnd.name = 'Diabetic Overstock'
)
INSERT INTO product_vendor_pricing (
  product_id,
  vendor_id,
  price,
  is_available,
  price_source,
  approval_required,
  last_updated
)
SELECT
  m.product_id,
  m.vendor_id,
  m.base_price,
  true,
  'manual',
  true,
  NOW()
FROM matched m
ON CONFLICT (product_id, vendor_id) DO UPDATE
SET
  price             = EXCLUDED.price,
  price_source      = 'manual',
  approval_required = true,
  is_available      = true,
  last_updated      = NOW();

-- Step 2: update existing single-tier rows (min_quantity=1, max_quantity=NULL)
WITH input_tiers AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text, 1::int, NULL::int, 109.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text, 1::int, NULL::int, 299.99::numeric(10,2)),
    ('Dexcom G6 Transmitter'::text, 1::int, NULL::int, 199.99::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 1::int, NULL::int, 209.99::numeric(10,2)),

    ('Autosoft XC 6mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),

    ('AutoSoft 90 6mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),

    ('Autosoft 30 13mm 23"'::text, 1::int, NULL::int, 94.99::numeric(10,2)),
    ('Autosoft 30 13mm 43"'::text, 1::int, NULL::int, 94.99::numeric(10,2)),

    ('Quick-set 6mm 23"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 6mm 32"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 9mm 23"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 9mm 32"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 1::int, NULL::int, 49.99::numeric(10,2)),

    ('MiniMed Reservoir 3mL'::text, 1::int, NULL::int, 32.99::numeric(10,2)),
    ('MiniMed Reservoir 1.8mL'::text, 1::int, NULL::int, 27.99::numeric(10,2)),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text, 1::int, NULL::int, 34.99::numeric(10,2))
  ) AS v(product_name, min_quantity, max_quantity, unit_price)
),
wanted AS (
  SELECT
    pvp.id AS product_vendor_pricing_id,
    it.min_quantity,
    it.max_quantity,
    it.unit_price
  FROM input_tiers it
  JOIN products p   ON p.name   = it.product_name
  JOIN vendors vnd  ON vnd.name = 'Diabetic Overstock'
  JOIN product_vendor_pricing pvp
    ON pvp.product_id = p.id
   AND pvp.vendor_id  = vnd.id
)
UPDATE product_vendor_price_tiers t
SET unit_price = w.unit_price
FROM wanted w
WHERE t.product_vendor_pricing_id = w.product_vendor_pricing_id
  AND t.min_quantity = w.min_quantity
  AND (
    (t.max_quantity IS NULL AND w.max_quantity IS NULL)
    OR t.max_quantity = w.max_quantity
  );

-- Step 3: insert missing single-tier rows
WITH input_tiers AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text, 1::int, NULL::int, 109.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text, 1::int, NULL::int, 299.99::numeric(10,2)),
    ('Dexcom G6 Transmitter'::text, 1::int, NULL::int, 199.99::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 1::int, NULL::int, 209.99::numeric(10,2)),

    ('Autosoft XC 6mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 6mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('Autosoft XC 9mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),

    ('AutoSoft 90 6mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 6mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 23"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 32"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),
    ('AutoSoft 90 9mm 43"'::text, 1::int, NULL::int, 119.99::numeric(10,2)),

    ('Autosoft 30 13mm 23"'::text, 1::int, NULL::int, 94.99::numeric(10,2)),
    ('Autosoft 30 13mm 43"'::text, 1::int, NULL::int, 94.99::numeric(10,2)),

    ('Quick-set 6mm 23"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 6mm 32"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 9mm 23"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),
    ('Quick-set 9mm 32"'::text, 1::int, NULL::int, 139.99::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text, 1::int, NULL::int, 144.99::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 1::int, NULL::int, 49.99::numeric(10,2)),

    ('MiniMed Reservoir 3mL'::text, 1::int, NULL::int, 32.99::numeric(10,2)),
    ('MiniMed Reservoir 1.8mL'::text, 1::int, NULL::int, 27.99::numeric(10,2)),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text, 1::int, NULL::int, 34.99::numeric(10,2))
  ) AS v(product_name, min_quantity, max_quantity, unit_price)
),
wanted AS (
  SELECT
    pvp.id AS product_vendor_pricing_id,
    it.min_quantity,
    it.max_quantity,
    it.unit_price
  FROM input_tiers it
  JOIN products p   ON p.name   = it.product_name
  JOIN vendors vnd  ON vnd.name = 'Diabetic Overstock'
  JOIN product_vendor_pricing pvp
    ON pvp.product_id = p.id
   AND pvp.vendor_id  = vnd.id
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
FROM wanted w
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

-- Verification (read-only)
SELECT
  p.name AS product_name,
  v.name AS vendor_name,
  t.unit_price
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p                  ON p.id  = pvp.product_id
JOIN vendors  v                  ON v.id  = pvp.vendor_id
WHERE v.name = 'Diabetic Overstock'
  AND t.min_quantity = 1
  AND t.max_quantity IS NULL
  AND p.name IN (
    'Dexcom G6 Sensor (1)',
    'Dexcom G6 Sensors',
    'Dexcom G6 Transmitter',
    'Dexcom G7 Sensors (10-day)',
    'Dexcom G7 Sensors (15-day)',
    'Autosoft XC 6mm 23"',
    'Autosoft XC 6mm 32"',
    'Autosoft XC 6mm 43"',
    'Autosoft XC 9mm 23"',
    'Autosoft XC 9mm 32"',
    'Autosoft XC 9mm 43"',
    'AutoSoft 90 6mm 23"',
    'AutoSoft 90 6mm 32"',
    'AutoSoft 90 6mm 43"',
    'AutoSoft 90 9mm 23"',
    'AutoSoft 90 9mm 32"',
    'AutoSoft 90 9mm 43"',
    'Autosoft 30 13mm 23"',
    'Autosoft 30 13mm 43"',
    'Quick-set 6mm 23"',
    'Quick-set 6mm 32"',
    'Quick-set 9mm 23"',
    'Quick-set 9mm 32"',
    'MiniMed Mio Advance Infusion Set 6mm 23in',
    'MiniMed Mio Advance Infusion Set 6mm 43in',
    'MiniMed Mio Advance Infusion Set 9mm 23in',
    'MiniMed Mio Advance Infusion Set 9mm 43in',
    'Tandem t:slim X2 Cartridge 3mL',
    'MiniMed Reservoir 3mL',
    'MiniMed Reservoir 1.8mL',
    'Medtronic Extended Reservoir 3mL (10ct)'
  )
ORDER BY p.name;

-- Diagnostics (read-only): desired products not currently present in products table
WITH expected_products AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text),
    ('Dexcom G6 Sensors'::text),
    ('Dexcom G6 Transmitter'::text),
    ('Dexcom G7 Sensors (10-day)'::text),
    ('Dexcom G7 Sensors (15-day)'::text),
    ('Autosoft XC 6mm 23"'::text),
    ('Autosoft XC 6mm 32"'::text),
    ('Autosoft XC 6mm 43"'::text),
    ('Autosoft XC 9mm 23"'::text),
    ('Autosoft XC 9mm 32"'::text),
    ('Autosoft XC 9mm 43"'::text),
    ('AutoSoft 90 6mm 23"'::text),
    ('AutoSoft 90 6mm 32"'::text),
    ('AutoSoft 90 6mm 43"'::text),
    ('AutoSoft 90 9mm 23"'::text),
    ('AutoSoft 90 9mm 32"'::text),
    ('AutoSoft 90 9mm 43"'::text),
    ('Autosoft 30 13mm 23"'::text),
    ('Autosoft 30 13mm 43"'::text),
    ('Quick-set 6mm 23"'::text),
    ('Quick-set 6mm 32"'::text),
    ('Quick-set 9mm 23"'::text),
    ('Quick-set 9mm 32"'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text),
    ('Tandem t:slim X2 Cartridge 3mL'::text),
    ('MiniMed Reservoir 3mL'::text),
    ('MiniMed Reservoir 1.8mL'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text)
  ) AS v(product_name)
)
SELECT ep.product_name AS missing_in_products
FROM expected_products ep
LEFT JOIN products p ON p.name = ep.product_name
WHERE p.id IS NULL
ORDER BY ep.product_name;

-- Diagnostics (read-only): expected names missing vendor tier row after seed
WITH expected_products AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text),
    ('Dexcom G6 Sensors'::text),
    ('Dexcom G6 Transmitter'::text),
    ('Dexcom G7 Sensors (10-day)'::text),
    ('Dexcom G7 Sensors (15-day)'::text),
    ('Autosoft XC 6mm 23"'::text),
    ('Autosoft XC 6mm 32"'::text),
    ('Autosoft XC 6mm 43"'::text),
    ('Autosoft XC 9mm 23"'::text),
    ('Autosoft XC 9mm 32"'::text),
    ('Autosoft XC 9mm 43"'::text),
    ('AutoSoft 90 6mm 23"'::text),
    ('AutoSoft 90 6mm 32"'::text),
    ('AutoSoft 90 6mm 43"'::text),
    ('AutoSoft 90 9mm 23"'::text),
    ('AutoSoft 90 9mm 32"'::text),
    ('AutoSoft 90 9mm 43"'::text),
    ('Autosoft 30 13mm 23"'::text),
    ('Autosoft 30 13mm 43"'::text),
    ('Quick-set 6mm 23"'::text),
    ('Quick-set 6mm 32"'::text),
    ('Quick-set 9mm 23"'::text),
    ('Quick-set 9mm 32"'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text),
    ('Tandem t:slim X2 Cartridge 3mL'::text),
    ('MiniMed Reservoir 3mL'::text),
    ('MiniMed Reservoir 1.8mL'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text)
  ) AS v(product_name)
)
SELECT ep.product_name AS missing_vendor_tier
FROM expected_products ep
LEFT JOIN products p ON p.name = ep.product_name
LEFT JOIN vendors v ON v.name = 'Diabetic Overstock'
LEFT JOIN product_vendor_pricing pvp
  ON pvp.product_id = p.id
 AND pvp.vendor_id = v.id
LEFT JOIN product_vendor_price_tiers t
  ON t.product_vendor_pricing_id = pvp.id
 AND t.min_quantity = 1
 AND t.max_quantity IS NULL
WHERE p.id IS NOT NULL
  AND t.id IS NULL
ORDER BY ep.product_name;

-- Diagnostics (read-only): likely catalog variants for missing expected names
WITH expected_products AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text),
    ('Dexcom G6 Sensors'::text),
    ('Autosoft XC 6mm 43"'::text),
    ('Autosoft XC 9mm 43"'::text),
    ('AutoSoft 90 6mm 23"'::text),
    ('AutoSoft 90 6mm 32"'::text),
    ('AutoSoft 90 6mm 43"'::text),
    ('AutoSoft 90 9mm 23"'::text),
    ('AutoSoft 90 9mm 32"'::text),
    ('AutoSoft 90 9mm 43"'::text),
    ('Autosoft 30 13mm 23"'::text),
    ('Autosoft 30 13mm 43"'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 43in'::text),
    ('MiniMed Reservoir 3mL'::text),
    ('MiniMed Reservoir 1.8mL'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text)
  ) AS v(expected_name)
),
missing_expected AS (
  SELECT ep.expected_name
  FROM expected_products ep
  LEFT JOIN products p ON p.name = ep.expected_name
  WHERE p.id IS NULL
)
SELECT
  me.expected_name,
  p.name AS candidate_name,
  p.category,
  p.brand,
  p.sku
FROM missing_expected me
JOIN products p
  ON (
       (me.expected_name ILIKE '%autosoft%' AND p.name ILIKE '%autosoft%')
    OR (me.expected_name ILIKE '%mio advance%' AND p.name ILIKE '%mio%')
    OR (me.expected_name ILIKE '%quick-set%' AND p.name ILIKE '%quick%set%')
    OR (me.expected_name ILIKE '%t-slim cartridge%' AND (p.name ILIKE '%t:slim%cartridge%' OR p.name ILIKE '%tslim%cartridge%'))
    OR (me.expected_name ILIKE '%paradigm reservoir%' AND p.name ILIKE '%reservoir%')
    OR (me.expected_name ILIKE '%extended reservoir%' AND p.name ILIKE '%reservoir%')
    OR (me.expected_name ILIKE '%dexcom g6 sensor%' AND p.name ILIKE '%dexcom%g6%sensor%')
  )
ORDER BY me.expected_name, p.name;
