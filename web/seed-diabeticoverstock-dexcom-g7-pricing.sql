-- Seed: Diabetic Overstock Dexcom G7 pricing
-- Safe behavior:
-- - Matches products and vendor by name (no hardcoded UUIDs)
-- - Upserts product_vendor_pricing
-- - Updates existing tiers, inserts missing tiers
-- - Does not delete existing rows
-- - Does not create products; only uses products that already exist

BEGIN;

-- Ensure vendor exists (upsert by name)
INSERT INTO vendors (name, is_active)
VALUES ('Diabetic Overstock', true)
ON CONFLICT (name) DO UPDATE
SET is_active = true;

-- ── Step 1: upsert product_vendor_pricing (one row per product/vendor pair) ───
WITH input_base AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G7 Sensors (10-day)'::text, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 209.99::numeric(10,2))
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
  product_url,
  price_source,
  approval_required,
  last_updated
)
SELECT
  m.product_id,
  m.vendor_id,
  m.base_price,
  true,
  'https://diabeticoverstock.com/search?options%5Bprefix%5D=last&q=G7+sensor',
  'manual',
  true,
  NOW()
FROM matched m
ON CONFLICT (product_id, vendor_id) DO UPDATE
SET
  price             = EXCLUDED.price,
  product_url       = EXCLUDED.product_url,
  price_source      = 'manual',
  approval_required = true,
  is_available      = true,
  last_updated      = NOW();

-- ── Step 2: update existing tier unit_prices ──────────────────────────────────
WITH input_tiers AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 3::int, 3::int,    133.33::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 1::int, NULL::int, 209.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 2::int, 2::int,    204.99::numeric(10,2))
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

-- ── Step 3: insert missing tiers ─────────────────────────────────────────────
WITH input_tiers AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G7 Sensors (10-day)'::text, 1::int, NULL::int, 99.99::numeric(10,2)),
    ('Dexcom G7 Sensors (10-day)'::text, 3::int, 3::int,    133.33::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 1::int, NULL::int, 209.99::numeric(10,2)),
    ('Dexcom G7 Sensors (15-day)'::text, 2::int, 2::int,    204.99::numeric(10,2))
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

-- ── Verification (read-only) ──────────────────────────────────────────────────
SELECT
  p.name  AS product_name,
  v.name  AS vendor_name,
  t.min_quantity,
  t.max_quantity,
  t.unit_price
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p                  ON p.id  = pvp.product_id
JOIN vendors  v                  ON v.id  = pvp.vendor_id
WHERE v.name = 'Diabetic Overstock'
  AND p.name IN ('Dexcom G7 Sensors (10-day)', 'Dexcom G7 Sensors (15-day)')
ORDER BY p.name, t.min_quantity;
