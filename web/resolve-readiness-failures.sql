-- ============================================================
-- resolve-readiness-failures.sql
-- Purpose: Triage and fix the FAIL checks from verify-vendor-pricing-readiness.sql
--
-- Sections A-D are READ-ONLY diagnostics.
-- Sections E-G generate SQL statements or provide safe INSERT...SELECT fixes.
-- Nothing here deletes data.
-- ============================================================

-- ------------------------------------------------------------
-- Shared expected canonical (mapped to actual products.name)
-- ------------------------------------------------------------
WITH expected AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text,                      'Dexcom G6 Sensor (1)'::text,                      'sensor'::text,      'Dexcom'::text,   'DX-G6-1PK'::text),
    ('Dexcom G6 Sensor (3-pack)'::text,                 'Dexcom G6 Sensors'::text,                         'sensor'::text,      'Dexcom'::text,   'DX-G6-3PK'::text),
    ('Dexcom G6 Transmitter'::text,                     'Dexcom G6 Transmitter'::text,                     'transmitter'::text, 'Dexcom'::text,   'DX-G6-TX'::text),
    ('Dexcom G7 Sensors (10-day)'::text,                'Dexcom G7 Sensors (10-day)'::text,                'sensor'::text,      'Dexcom'::text,   'DX-G7-10D'::text),
    ('Dexcom G7 Sensors (15-day)'::text,                'Dexcom G7 Sensors (15-day)'::text,                'sensor'::text,      'Dexcom'::text,   'DX-G7-15D-3PK'::text),
    ('Omnipod 5 Pods (5-pack)'::text,                   'Omnipod 5 Pods (Dexcom G6)'::text,                'pod'::text,         'Insulet'::text,  'OP5-G6-5PK'::text),
    ('T-Slim Cartridge 3mL (10ct)'::text,               'Tandem t:slim X2 Cartridge 3mL'::text,            'cartridge'::text,   'Tandem'::text,   'TSLIM-3ML'::text),
    ('Tandem Mobi Cartridge 2mL (10ct)'::text,          'Tandem Mobi Cartridge 2mL (10ct)'::text,          'cartridge'::text,   'Tandem'::text,   'MOBI-2ML-10CT'::text),
    ('Medtronic Paradigm Reservoir 3mL (10ct)'::text,   'MiniMed Reservoir 3mL'::text,                     'reservoir'::text,   'Medtronic'::text,'MM-RES-3ML'::text),
    ('Medtronic Paradigm Reservoir 1.8mL (10ct)'::text, 'MiniMed Reservoir 1.8mL'::text,                   'reservoir'::text,   'Medtronic'::text,'MM-RES-1.8ML'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text,   'Medtronic Extended Reservoir 3mL (10ct)'::text,   'reservoir'::text,   'Medtronic'::text,'MM-EXT-RES-3ML'::text)
  ) AS t(canonical_name, db_name, category, manufacturer, sku)
),
vendors_expected AS (
  SELECT * FROM (VALUES
    ('TestStripz'::text),
    ('Diabetic Overstock'::text),
    ('AffordableOTC'::text),
    ('RapidRXUSA'::text)
  ) AS v(vendor_name)
)
SELECT 'Loaded expected canonical + vendors' AS info;


-- ============================================================
-- A) Which canonical product is missing/duplicate?
-- READ-ONLY
-- ============================================================
WITH expected AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text, 'Dexcom G6 Sensor (1)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G6-1PK'::text),
    ('Dexcom G6 Sensor (3-pack)'::text, 'Dexcom G6 Sensors'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G6-3PK'::text),
    ('Dexcom G6 Transmitter'::text, 'Dexcom G6 Transmitter'::text, 'transmitter'::text, 'Dexcom'::text, 'DX-G6-TX'::text),
    ('Dexcom G7 Sensors (10-day)'::text, 'Dexcom G7 Sensors (10-day)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G7-10D'::text),
    ('Dexcom G7 Sensors (15-day)'::text, 'Dexcom G7 Sensors (15-day)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G7-15D-3PK'::text),
    ('Omnipod 5 Pods (5-pack)'::text, 'Omnipod 5 Pods (Dexcom G6)'::text, 'pod'::text, 'Insulet'::text, 'OP5-G6-5PK'::text),
    ('T-Slim Cartridge 3mL (10ct)'::text, 'Tandem t:slim X2 Cartridge 3mL'::text, 'cartridge'::text, 'Tandem'::text, 'TSLIM-3ML'::text),
    ('Tandem Mobi Cartridge 2mL (10ct)'::text, 'Tandem Mobi Cartridge 2mL (10ct)'::text, 'cartridge'::text, 'Tandem'::text, 'MOBI-2ML-10CT'::text),
    ('Medtronic Paradigm Reservoir 3mL (10ct)'::text, 'MiniMed Reservoir 3mL'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-RES-3ML'::text),
    ('Medtronic Paradigm Reservoir 1.8mL (10ct)'::text, 'MiniMed Reservoir 1.8mL'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-RES-1.8ML'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text, 'Medtronic Extended Reservoir 3mL (10ct)'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-EXT-RES-3ML'::text)
  ) AS t(canonical_name, db_name, category, manufacturer, sku)
)
SELECT
  e.canonical_name,
  e.db_name,
  COALESCE(cnt.n, 0) AS product_name_count,
  CASE WHEN COALESCE(cnt.n, 0) = 1 THEN 'OK'
       WHEN COALESCE(cnt.n, 0) = 0 THEN 'MISSING'
       ELSE 'DUPLICATE'
  END AS status
FROM expected e
LEFT JOIN (
  SELECT name, COUNT(*) AS n
  FROM products
  GROUP BY name
) cnt ON cnt.name = e.db_name
ORDER BY status DESC, e.canonical_name;

-- Optional helper: generate INSERT ONLY for missing canonical products
-- (uses mapped DB name; does NOT run insert, only prints SQL text)
WITH expected AS (
  SELECT *
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text, 'Dexcom G6 Sensor (1)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G6-1PK'::text),
    ('Dexcom G6 Sensor (3-pack)'::text, 'Dexcom G6 Sensors'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G6-3PK'::text),
    ('Dexcom G6 Transmitter'::text, 'Dexcom G6 Transmitter'::text, 'transmitter'::text, 'Dexcom'::text, 'DX-G6-TX'::text),
    ('Dexcom G7 Sensors (10-day)'::text, 'Dexcom G7 Sensors (10-day)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G7-10D'::text),
    ('Dexcom G7 Sensors (15-day)'::text, 'Dexcom G7 Sensors (15-day)'::text, 'sensor'::text, 'Dexcom'::text, 'DX-G7-15D-3PK'::text),
    ('Omnipod 5 Pods (5-pack)'::text, 'Omnipod 5 Pods (Dexcom G6)'::text, 'pod'::text, 'Insulet'::text, 'OP5-G6-5PK'::text),
    ('T-Slim Cartridge 3mL (10ct)'::text, 'Tandem t:slim X2 Cartridge 3mL'::text, 'cartridge'::text, 'Tandem'::text, 'TSLIM-3ML'::text),
    ('Tandem Mobi Cartridge 2mL (10ct)'::text, 'Tandem Mobi Cartridge 2mL (10ct)'::text, 'cartridge'::text, 'Tandem'::text, 'MOBI-2ML-10CT'::text),
    ('Medtronic Paradigm Reservoir 3mL (10ct)'::text, 'MiniMed Reservoir 3mL'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-RES-3ML'::text),
    ('Medtronic Paradigm Reservoir 1.8mL (10ct)'::text, 'MiniMed Reservoir 1.8mL'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-RES-1.8ML'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text, 'Medtronic Extended Reservoir 3mL (10ct)'::text, 'reservoir'::text, 'Medtronic'::text, 'MM-EXT-RES-3ML'::text)
  ) AS t(canonical_name, db_name, category, manufacturer, sku)
)
SELECT
  format(
    'INSERT INTO products (name, category, manufacturer, sku, active) ' ||
    'SELECT %L, %L, %L, %L, true ' ||
    'WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = %L OR sku = %L);',
    e.db_name, e.category, e.manufacturer, e.sku, e.db_name, e.sku
  ) AS insert_sql
FROM expected e
LEFT JOIN products p ON p.name = e.db_name
WHERE p.id IS NULL
ORDER BY e.db_name;


-- ============================================================
-- B) Missing price tiers (why FAIL=30)
-- READ-ONLY list + generated INSERT statements
-- ============================================================

-- B1) exact rows missing tier
SELECT
  v.name AS vendor_name,
  p.name AS product_name,
  p.category,
  pvp.id AS product_vendor_pricing_id,
  pvp.price,
  pvp.is_available,
  pvp.price_source
FROM product_vendor_pricing pvp
JOIN vendors v ON v.id = pvp.vendor_id
JOIN products p ON p.id = pvp.product_id
WHERE v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  AND NOT EXISTS (
    SELECT 1
    FROM product_vendor_price_tiers t
    WHERE t.product_vendor_pricing_id = pvp.id
  )
ORDER BY v.name, p.name;

-- B2) generated INSERT statements for missing tiers
-- Rule requested:
--   - unit_price = price / 10 for box items
--   - unit_price = price for single items
SELECT
  format(
    'INSERT INTO product_vendor_price_tiers (product_vendor_pricing_id, min_quantity, max_quantity, unit_price) ' ||
    'VALUES (%L, 1, NULL, %s);',
    pvp.id::text,
    CASE
      WHEN (
        p.name ILIKE '%10ct%'
        OR p.name ILIKE '%10 count%'
        OR p.name ILIKE '%10-pack%'
        OR p.name ILIKE '%10 pack%'
        OR p.name ILIKE '%quick-set%'
        OR p.name ILIKE '%autosoft%'
        OR p.name ILIKE '%mio%infusion%'
        OR p.name ILIKE '%reservoir%'
        OR p.name ILIKE '%cartridge%'
      )
      THEN to_char((pvp.price / 10.0)::numeric(10,4), 'FM999999990.0000')
      ELSE to_char((pvp.price)::numeric(10,4), 'FM999999990.0000')
    END
  ) AS insert_tier_sql
FROM product_vendor_pricing pvp
JOIN vendors v ON v.id = pvp.vendor_id
JOIN products p ON p.id = pvp.product_id
WHERE v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  AND pvp.price IS NOT NULL
  AND pvp.price > 0
  AND NOT EXISTS (
    SELECT 1
    FROM product_vendor_price_tiers t
    WHERE t.product_vendor_pricing_id = pvp.id
  )
ORDER BY v.name, p.name;

-- B3) one-shot safe INSERT...SELECT for missing tiers (executes inserts if you run it)
-- Comment this out if you want read-only only.
/*
INSERT INTO product_vendor_price_tiers (
  product_vendor_pricing_id,
  min_quantity,
  max_quantity,
  unit_price
)
SELECT
  pvp.id,
  1,
  NULL,
  CASE
    WHEN (
      p.name ILIKE '%10ct%'
      OR p.name ILIKE '%10 count%'
      OR p.name ILIKE '%10-pack%'
      OR p.name ILIKE '%10 pack%'
      OR p.name ILIKE '%quick-set%'
      OR p.name ILIKE '%autosoft%'
      OR p.name ILIKE '%mio%infusion%'
      OR p.name ILIKE '%reservoir%'
      OR p.name ILIKE '%cartridge%'
    )
    THEN (pvp.price / 10.0)::numeric(10,4)
    ELSE pvp.price::numeric(10,4)
  END
FROM product_vendor_pricing pvp
JOIN vendors v ON v.id = pvp.vendor_id
JOIN products p ON p.id = pvp.product_id
WHERE v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  AND pvp.price IS NOT NULL
  AND pvp.price > 0
  AND NOT EXISTS (
    SELECT 1
    FROM product_vendor_price_tiers t
    WHERE t.product_vendor_pricing_id = pvp.id
  );
*/


-- ============================================================
-- C) Missing vendor pricing rows (FAIL=16)
-- READ-ONLY list + generated INSERT statements
-- ============================================================
WITH expected AS (
  SELECT db_name AS product_name
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'::text),
    ('Dexcom G6 Sensors'::text),
    ('Dexcom G6 Transmitter'::text),
    ('Dexcom G7 Sensors (10-day)'::text),
    ('Dexcom G7 Sensors (15-day)'::text),
    ('Omnipod 5 Pods (Dexcom G6)'::text),
    ('Tandem t:slim X2 Cartridge 3mL'::text),
    ('Tandem Mobi Cartridge 2mL (10ct)'::text),
    ('MiniMed Reservoir 3mL'::text),
    ('MiniMed Reservoir 1.8mL'::text),
    ('Medtronic Extended Reservoir 3mL (10ct)'::text)
  ) AS v(db_name)
),
vendors_expected AS (
  SELECT * FROM (VALUES
    ('TestStripz'::text),
    ('Diabetic Overstock'::text),
    ('AffordableOTC'::text),
    ('RapidRXUSA'::text)
  ) AS v(vendor_name)
),
missing AS (
  SELECT
    ve.vendor_name,
    e.product_name,
    p.id AS product_id,
    v.id AS vendor_id,
    -- suggested price from any existing vendor for same product
    (
      SELECT MIN(pvp2.price)
      FROM product_vendor_pricing pvp2
      WHERE pvp2.product_id = p.id
        AND pvp2.price IS NOT NULL
        AND pvp2.price > 0
    ) AS suggested_price
  FROM expected e
  CROSS JOIN vendors_expected ve
  LEFT JOIN products p ON p.name = e.product_name
  LEFT JOIN vendors v ON v.name = ve.vendor_name
  LEFT JOIN product_vendor_pricing pvp
    ON pvp.product_id = p.id
   AND pvp.vendor_id = v.id
  WHERE p.id IS NOT NULL
    AND v.id IS NOT NULL
    AND pvp.id IS NULL
)
SELECT
  vendor_name,
  product_name,
  suggested_price,
  format(
    'INSERT INTO product_vendor_pricing (product_id, vendor_id, price, is_available, price_source, approval_required, last_updated) ' ||
    'VALUES ((SELECT id FROM products WHERE name = %L), (SELECT id FROM vendors WHERE name = %L), %s, true, ''manual'', true, NOW()) ' ||
    'ON CONFLICT (product_id, vendor_id) DO UPDATE SET price = EXCLUDED.price, is_available = true, price_source = ''manual'', approval_required = true, last_updated = NOW();',
    product_name,
    vendor_name,
    COALESCE(to_char(suggested_price, 'FM999999990.00'), 'NULL')
  ) AS upsert_pvp_sql
FROM missing
ORDER BY vendor_name, product_name;


-- ============================================================
-- D) Overdue pending orders (FAIL=1)
-- READ-ONLY rows for your decision (mark shipped or delete test)
-- ============================================================
SELECT
  po.id,
  po.lead_id,
  po.client_product_id,
  po.ship_date,
  po.status,
  po.created_at,
  po.updated_at,
  l.name AS patient_name,
  p.name AS product_name
FROM pending_orders po
LEFT JOIN leads l ON l.id = po.lead_id
LEFT JOIN client_products cp ON cp.id = po.client_product_id
LEFT JOIN products p ON p.id = cp.product_id
WHERE po.ship_date < CURRENT_DATE
  AND po.status = 'pending'
ORDER BY po.ship_date ASC, po.created_at ASC;
