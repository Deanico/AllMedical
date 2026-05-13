-- Seed: RapidRXUSA pricing (exact-name match only)
-- Safe behavior:
-- - Matches products and vendor by name (no hardcoded UUIDs)
-- - Uses ONLY existing catalog product names (see name mapping notes below)
-- - Upserts product_vendor_pricing
-- - Updates existing tiers and inserts missing tiers
-- - Does not delete existing rows
-- - Ignores products not listed below
--
-- Canonical → DB name mappings applied:
--   "Dexcom G6 Sensor (3-pack)" → "Dexcom G6 Sensors"
--   "T-Slim Cartridge 3mL (10ct)" → "Tandem t:slim X2 Cartridge 3mL"
--   "Mio Advance 6mm 23\"" → "MiniMed Mio Advance Infusion Set 6mm 23in"
--   "Mio Advance 6mm 43\"" → "MiniMed Mio Advance Infusion Set 6mm 43in"
--   "Mio Advance 9mm 23\"" → "MiniMed Mio Advance Infusion Set 9mm 23in"
--   "Medtronic Paradigm Reservoir 3mL (10ct)" → "MiniMed Reservoir 3mL"
--   "Omnipod 5 Pods (5-pack)" → "Omnipod 5 Pods (Dexcom G6)"

BEGIN;

-- Ensure vendor exists (upsert by exact name)
INSERT INTO vendors (name, is_active)
VALUES ('RapidRXUSA', true)
ON CONFLICT (name) DO UPDATE
SET is_active = true;

-- Step 1: upsert base pricing into product_vendor_pricing (one row per product/vendor)
WITH input_base AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text,          99.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text,            269.99::numeric(10,2)),  -- canonical: "Dexcom G6 Sensor (3-pack)"
    ('Dexcom G6 Transmitter'::text,        134.99::numeric(10,2)),

    ('Dexcom G7 Sensors (10-day)'::text,   109.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text,   159.95::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 28.99::numeric(10,2)),  -- canonical: "T-Slim Cartridge 3mL (10ct)"

    ('Quick-set 6mm 23"'::text,             89.95::numeric(10,2)),
    ('Quick-set 9mm 23"'::text,             89.95::numeric(10,2)),
    ('Quick-set 9mm 43"'::text,             89.95::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 104.99::numeric(10,2)),  -- canonical: "Mio Advance 6mm 23\""
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 104.99::numeric(10,2)),  -- canonical: "Mio Advance 6mm 43\""
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 104.99::numeric(10,2)),  -- canonical: "Mio Advance 9mm 23\""

    ('MiniMed Reservoir 3mL'::text,         24.99::numeric(10,2)),  -- canonical: "Medtronic Paradigm Reservoir 3mL (10ct)"

    ('Omnipod 5 Pods (Dexcom G6)'::text,   269.95::numeric(10,2))  -- canonical: "Omnipod 5 Pods (5-pack)"
  ) AS v(product_name, base_price)
),
matched AS (
  SELECT
    p.id AS product_id,
    vnd.id AS vendor_id,
    ib.base_price
  FROM input_base ib
  JOIN products p   ON p.name   = ib.product_name
  JOIN vendors vnd  ON vnd.name = 'RapidRXUSA'
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
    ('Dexcom G6 Sensor (1)'::text,          1::int, NULL::int,  99.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text,             1::int, NULL::int, 269.99::numeric(10,2)),
    ('Dexcom G6 Transmitter'::text,         1::int, NULL::int, 134.99::numeric(10,2)),

    ('Dexcom G7 Sensors (10-day)'::text,    1::int, NULL::int, 109.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text,    1::int, NULL::int, 159.95::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 1::int, NULL::int,  28.99::numeric(10,2)),

    ('Quick-set 6mm 23"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),
    ('Quick-set 9mm 23"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),
    ('Quick-set 9mm 43"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),

    ('MiniMed Reservoir 3mL'::text,         1::int, NULL::int,  24.99::numeric(10,2)),

    ('Omnipod 5 Pods (Dexcom G6)'::text,    1::int, NULL::int, 269.95::numeric(10,2))
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
  JOIN vendors vnd  ON vnd.name = 'RapidRXUSA'
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
    ('Dexcom G6 Sensor (1)'::text,          1::int, NULL::int,  99.99::numeric(10,2)),
    ('Dexcom G6 Sensors'::text,             1::int, NULL::int, 269.99::numeric(10,2)),
    ('Dexcom G6 Transmitter'::text,         1::int, NULL::int, 134.99::numeric(10,2)),

    ('Dexcom G7 Sensors (10-day)'::text,    1::int, NULL::int, 109.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text,    1::int, NULL::int, 159.95::numeric(10,2)),

    ('Tandem t:slim X2 Cartridge 3mL'::text, 1::int, NULL::int,  28.99::numeric(10,2)),

    ('Quick-set 6mm 23"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),
    ('Quick-set 9mm 23"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),
    ('Quick-set 9mm 43"'::text,             1::int, NULL::int,  89.95::numeric(10,2)),

    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text, 1::int, NULL::int, 104.99::numeric(10,2)),

    ('MiniMed Reservoir 3mL'::text,         1::int, NULL::int,  24.99::numeric(10,2)),

    ('Omnipod 5 Pods (Dexcom G6)'::text,    1::int, NULL::int, 269.95::numeric(10,2))
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
  JOIN vendors vnd  ON vnd.name = 'RapidRXUSA'
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
  p.name  AS product_name,
  v.name  AS vendor_name,
  t.unit_price
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p                  ON p.id  = pvp.product_id
JOIN vendors  v                  ON v.id  = pvp.vendor_id
WHERE v.name = 'RapidRXUSA'
  AND t.min_quantity = 1
  AND t.max_quantity IS NULL
  AND p.name IN (
    'Dexcom G6 Sensor (1)',
    'Dexcom G6 Sensors',
    'Dexcom G6 Transmitter',
    'Dexcom G7 Sensors (10-day)',
    'Dexcom G7 Sensors (15-day)',
    'Tandem t:slim X2 Cartridge 3mL',
    'Quick-set 6mm 23"',
    'Quick-set 9mm 23"',
    'Quick-set 9mm 43"',
    'MiniMed Mio Advance Infusion Set 6mm 23in',
    'MiniMed Mio Advance Infusion Set 6mm 43in',
    'MiniMed Mio Advance Infusion Set 9mm 23in',
    'MiniMed Reservoir 3mL',
    'Omnipod 5 Pods (Dexcom G6)'
  )
ORDER BY p.name;

-- Diagnostics: products in the list that don't exist in the catalog yet
WITH expected AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text),
    ('Dexcom G6 Sensors'::text),
    ('Dexcom G6 Transmitter'::text),
    ('Dexcom G7 Sensors (10-day)'::text),
    ('Dexcom G7 Sensors (15-day)'::text),
    ('Tandem t:slim X2 Cartridge 3mL'::text),
    ('Quick-set 6mm 23"'::text),
    ('Quick-set 9mm 23"'::text),
    ('Quick-set 9mm 43"'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 23in'::text),
    ('MiniMed Mio Advance Infusion Set 6mm 43in'::text),
    ('MiniMed Mio Advance Infusion Set 9mm 23in'::text),
    ('MiniMed Reservoir 3mL'::text),
    ('Omnipod 5 Pods (Dexcom G6)'::text)
  ) AS v(expected_name)
)
SELECT e.expected_name AS missing_from_products_table
FROM expected e
LEFT JOIN products p ON p.name = e.expected_name
WHERE p.id IS NULL
ORDER BY e.expected_name;
