-- ============================================================
-- verify-vendor-pricing-readiness.sql
-- READ-ONLY — no INSERT, UPDATE, DELETE, or ALTER statements.
-- Goal: Confirm readiness to move from vendor pricing setup
--       into n8n automation and vendor selection.
--
-- Run all sections top-to-bottom in Supabase SQL editor.
-- The final summary (Section 8) gives a pass/fail checklist.
-- ============================================================
--
-- CANONICAL → DB NAME MAPPINGS
-- Several canonical names differ from actual products.name values:
--   Canonical                                        DB Name
--   "Dexcom G6 Sensor (3-pack)"               →  "Dexcom G6 Sensors"
--   "Dexcom G6 Sensor (1)"                    →  "Dexcom G6 Sensor (1)"            [same]
--   "Omnipod 5 Pods (5-pack)"                 →  "Omnipod 5 Pods (Dexcom G6)"
--   "T-Slim Cartridge 3mL (10ct)"             →  "Tandem t:slim X2 Cartridge 3mL"
--   "Medtronic Paradigm Reservoir 3mL (10ct)" →  "MiniMed Reservoir 3mL"
--   "Medtronic Paradigm Reservoir 1.8mL(10ct)"→  "MiniMed Reservoir 1.8mL"
--   "Medtronic Extended Reservoir 3mL (10ct)" →  "Medtronic Extended Reservoir 3mL (10ct)" [same]
-- ============================================================


-- ============================================================
-- SECTION 1A: CANONICAL PRODUCTS EXIST (named list)
-- PASS = exactly 1 row with that name.
-- MISSING = 0, DUPLICATE = >1.
-- ============================================================
SELECT
  c.canonical_name,
  c.db_name,
  COALESCE(p.row_count, 0)                       AS found_count,
  CASE
    WHEN COALESCE(p.row_count, 0) = 1 THEN 'PASS'
    WHEN COALESCE(p.row_count, 0) = 0 THEN 'MISSING'
    ELSE 'DUPLICATE'
  END                                             AS status
FROM (VALUES
  ('Dexcom G6 Sensor (1)',                     'Dexcom G6 Sensor (1)'),
  ('Dexcom G6 Sensor (3-pack)',                'Dexcom G6 Sensors'),
  ('Dexcom G6 Transmitter',                    'Dexcom G6 Transmitter'),
  ('Dexcom G7 Sensors (10-day)',               'Dexcom G7 Sensors (10-day)'),
  ('Dexcom G7 Sensors (15-day)',               'Dexcom G7 Sensors (15-day)'),
  ('Omnipod 5 Pods (5-pack)',                  'Omnipod 5 Pods (Dexcom G6)'),
  ('T-Slim Cartridge 3mL (10ct)',              'Tandem t:slim X2 Cartridge 3mL'),
  ('Tandem Mobi Cartridge 2mL (10ct)',         'Tandem Mobi Cartridge 2mL (10ct)'),
  ('Medtronic Paradigm Reservoir 3mL (10ct)',  'MiniMed Reservoir 3mL'),
  ('Medtronic Paradigm Reservoir 1.8mL (10ct)','MiniMed Reservoir 1.8mL'),
  ('Medtronic Extended Reservoir 3mL (10ct)',  'Medtronic Extended Reservoir 3mL (10ct)')
) AS c(canonical_name, db_name)
LEFT JOIN (
  SELECT name, COUNT(*) AS row_count
  FROM products
  GROUP BY name
) p ON p.name = c.db_name
ORDER BY status DESC, c.canonical_name;


-- ============================================================
-- SECTION 1B: ILIKE-MATCHED CATALOG PRODUCTS
-- Shows all Autosoft / Quick-set / Mio / Reservoir / Cartridge
-- products currently in the products table.
-- ============================================================
SELECT
  name     AS product_name,
  sku,
  category,
  active
FROM products
WHERE
  name ILIKE '%autosoft%'
  OR name ILIKE '%quick-set%'
  OR name ILIKE '%quick set%'
  OR name ILIKE '%mio%'
  OR name ILIKE '%reservoir%'
  OR name ILIKE '%cartridge%'
ORDER BY category, name;


-- ============================================================
-- SECTION 2: VENDOR COVERAGE
-- For each active vendor × expected product, shows whether
-- a product_vendor_pricing row and price_tier row exist.
-- ============================================================
WITH canonical_products AS (
  SELECT db_name AS product_name
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'),
    ('Dexcom G6 Sensors'),
    ('Dexcom G6 Transmitter'),
    ('Dexcom G7 Sensors (10-day)'),
    ('Dexcom G7 Sensors (15-day)'),
    ('Omnipod 5 Pods (Dexcom G6)'),
    ('Tandem t:slim X2 Cartridge 3mL'),
    ('Tandem Mobi Cartridge 2mL (10ct)'),
    ('MiniMed Reservoir 3mL'),
    ('MiniMed Reservoir 1.8mL'),
    ('Medtronic Extended Reservoir 3mL (10ct)')
  ) AS v(db_name)

  UNION

  -- Include ILIKE-matched infusion set products already in catalog
  SELECT name
  FROM products
  WHERE
    name ILIKE '%autosoft%'
    OR name ILIKE '%quick-set%'
    OR name ILIKE '%quick set%'
    OR (name ILIKE '%mio%' AND name ILIKE '%infusion%')
),
active_vendors AS (
  SELECT id, name
  FROM vendors
  WHERE name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
),
coverage AS (
  SELECT
    cp.product_name,
    av.name                                     AS vendor_name,
    p.id                                        AS product_id,
    pvp.id                                      AS pvp_id,
    pvp.price,
    pvp.is_available,
    pvp.price_source,
    pvp.approval_required,
    pvp.product_url,
    t.id                                        AS tier_id,
    t.unit_price
  FROM canonical_products cp
  CROSS JOIN active_vendors av
  LEFT JOIN products p    ON p.name      = cp.product_name
  LEFT JOIN product_vendor_pricing pvp
    ON pvp.product_id = p.id
   AND pvp.vendor_id  = av.id
  LEFT JOIN product_vendor_price_tiers t
    ON t.product_vendor_pricing_id = pvp.id
   AND t.min_quantity = 1
   AND t.max_quantity IS NULL
)
SELECT
  vendor_name,
  product_name,
  CASE WHEN product_id  IS NULL THEN 'NO PRODUCT'
       WHEN pvp_id      IS NULL THEN 'NO PRICING ROW'
       WHEN tier_id     IS NULL THEN 'NO PRICE TIER'
       WHEN unit_price IS NULL OR unit_price <= 0 THEN 'BAD PRICE'
       ELSE 'OK'
  END                                           AS coverage_status,
  price                                         AS pvp_price,
  unit_price                                    AS tier_unit_price,
  is_available,
  price_source,
  approval_required,
  product_url
FROM coverage
ORDER BY vendor_name, product_name;


-- ============================================================
-- SECTION 3: MISSING PRICING
-- Product/vendor combinations with no pricing row or no tier.
-- ============================================================
WITH canonical_products AS (
  SELECT db_name AS product_name
  FROM (VALUES
    ('Dexcom G6 Sensor (1)'),
    ('Dexcom G6 Sensors'),
    ('Dexcom G6 Transmitter'),
    ('Dexcom G7 Sensors (10-day)'),
    ('Dexcom G7 Sensors (15-day)'),
    ('Omnipod 5 Pods (Dexcom G6)'),
    ('Tandem t:slim X2 Cartridge 3mL'),
    ('MiniMed Reservoir 3mL'),
    ('MiniMed Reservoir 1.8mL'),
    ('Medtronic Extended Reservoir 3mL (10ct)')
  ) AS v(db_name)

  UNION

  SELECT name FROM products
  WHERE
    name ILIKE '%autosoft%'
    OR name ILIKE '%quick-set%'
    OR name ILIKE '%quick set%'
    OR (name ILIKE '%mio%' AND name ILIKE '%infusion%')
),
active_vendors AS (
  SELECT id, name FROM vendors
  WHERE name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
)
SELECT
  av.name                                       AS vendor_name,
  cp.product_name,
  CASE
    WHEN p.id   IS NULL THEN 'product row missing'
    WHEN pvp.id IS NULL THEN 'product_vendor_pricing row missing'
    WHEN t.id   IS NULL THEN 'product_vendor_price_tiers row missing'
  END                                           AS missing_reason
FROM canonical_products cp
CROSS JOIN active_vendors av
LEFT JOIN products p    ON p.name      = cp.product_name
LEFT JOIN product_vendor_pricing pvp
  ON pvp.product_id = p.id
 AND pvp.vendor_id  = av.id
LEFT JOIN product_vendor_price_tiers t
  ON t.product_vendor_pricing_id = pvp.id
 AND t.min_quantity = 1
 AND t.max_quantity IS NULL
WHERE p.id IS NULL OR pvp.id IS NULL OR t.id IS NULL
ORDER BY av.name, cp.product_name;


-- ============================================================
-- SECTION 4: DUPLICATES
-- ============================================================

-- 4A: Duplicate products by normalized name
SELECT
  lower(trim(name))                             AS normalized_name,
  COUNT(*)                                      AS count,
  array_agg(id::text ORDER BY created_at)      AS product_ids,
  array_agg(name ORDER BY created_at)          AS names,
  array_agg(sku ORDER BY created_at)           AS skus
FROM products
GROUP BY lower(trim(name))
HAVING COUNT(*) > 1
ORDER BY count DESC, normalized_name;

-- 4B: Duplicate product_vendor_pricing rows (same product + vendor)
SELECT
  p.name                                        AS product_name,
  v.name                                        AS vendor_name,
  COUNT(pvp.id)                                 AS pvp_row_count,
  array_agg(pvp.id::text ORDER BY pvp.last_updated) AS pvp_ids
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
GROUP BY pvp.product_id, pvp.vendor_id, p.name, v.name
HAVING COUNT(pvp.id) > 1
ORDER BY pvp_row_count DESC, p.name;

-- 4C: Duplicate price tier rows (same pvp_id + min_quantity + max_quantity)
SELECT
  p.name                                        AS product_name,
  v.name                                        AS vendor_name,
  t.min_quantity,
  t.max_quantity,
  COUNT(t.id)                                   AS tier_row_count,
  array_agg(t.id::text ORDER BY t.id)          AS tier_ids
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
GROUP BY t.product_vendor_pricing_id, t.min_quantity, t.max_quantity, p.name, v.name
HAVING COUNT(t.id) > 1
ORDER BY tier_row_count DESC, p.name;


-- ============================================================
-- SECTION 5: BAD PRICING
-- ============================================================

-- 5A: Null or zero prices in product_vendor_pricing
SELECT
  p.name                                        AS product_name,
  v.name                                        AS vendor_name,
  pvp.price,
  pvp.is_available,
  pvp.price_source,
  'pvp.price null or <= 0'                      AS issue
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
WHERE pvp.price IS NULL OR pvp.price <= 0

UNION ALL

-- 5B: Null or zero unit_price in price_tiers
SELECT
  p.name,
  v.name,
  t.unit_price,
  pvp.is_available,
  pvp.price_source,
  'tier.unit_price null or <= 0'
FROM product_vendor_price_tiers t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
WHERE t.unit_price IS NULL OR t.unit_price <= 0

UNION ALL

-- 5C: is_available is NULL
SELECT
  p.name,
  v.name,
  pvp.price,
  pvp.is_available,
  pvp.price_source,
  'is_available is NULL'
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
WHERE pvp.is_available IS NULL

UNION ALL

-- 5D: Pricing rows linked to an inactive vendor
SELECT
  p.name,
  v.name,
  pvp.price,
  pvp.is_available,
  pvp.price_source,
  'vendor is inactive'
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors  v ON v.id = pvp.vendor_id
WHERE v.is_active = false

ORDER BY issue, product_name, vendor_name;


-- ============================================================
-- SECTION 6: BEST PRICE VIEW READINESS
-- ============================================================

-- 6A: Confirm product_vendor_pricing_view exists
SELECT
  table_name AS view_name,
  'EXISTS'                                      AS status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name   = 'product_vendor_pricing_view';

-- 6B: Multi-vendor price ties per product per qty tier
-- (rows where ≥2 vendors share the exact minimum unit_price)
WITH ranked AS (
  SELECT
    p.name                                      AS product_name,
    t.min_quantity,
    t.max_quantity,
    t.unit_price,
    v.name                                      AS vendor_name,
    MIN(t.unit_price) OVER (
      PARTITION BY pvp.product_id, t.min_quantity, t.max_quantity
    )                                           AS min_price_for_tier,
    COUNT(*) OVER (
      PARTITION BY pvp.product_id, t.min_quantity, t.max_quantity, t.unit_price
    )                                           AS vendors_at_this_price
  FROM product_vendor_price_tiers t
  JOIN product_vendor_pricing pvp ON pvp.id     = t.product_vendor_pricing_id
  JOIN products p                  ON p.id      = pvp.product_id
  JOIN vendors  v                  ON v.id      = pvp.vendor_id
  WHERE pvp.is_available = true
    AND v.is_active = true
)
SELECT
  product_name,
  min_quantity,
  max_quantity,
  unit_price                                    AS tied_price,
  vendors_at_this_price                         AS vendor_tie_count,
  vendor_name
FROM ranked
WHERE unit_price = min_price_for_tier
  AND vendors_at_this_price > 1
ORDER BY product_name, min_quantity, vendor_name;

-- 6C: Duplicate rows in product_vendor_pricing_view
-- (should be 0 if no underlying pvp duplicates)
SELECT
  product_name,
  vendor_name,
  COUNT(*)                                      AS duplicate_view_rows
FROM product_vendor_pricing_view
GROUP BY product_name, vendor_name
HAVING COUNT(*) > 1
ORDER BY duplicate_view_rows DESC, product_name;


-- ============================================================
-- SECTION 7: PENDING AUTOMATION READINESS
-- ============================================================

-- 7A: Required columns on client_products
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE WHEN column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'client_products'
  AND column_name  IN ('active', 'auto_ship_enabled', 'product_id', 'next_ship_date')
ORDER BY column_name;

-- 7B: Required columns on pending_orders
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE WHEN column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'pending_orders'
  AND column_name  IN ('client_product_id', 'ship_date')
ORDER BY column_name;

-- 7C: Duplicate-prevention unique index on pending_orders(client_product_id, ship_date)
SELECT
  indexname,
  indexdef,
  'EXISTS'                                      AS status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'pending_orders'
  AND (
    indexdef ILIKE '%client_product_id%ship_date%'
    OR indexdef ILIKE '%ship_date%client_product_id%'
  );

-- 7D: client_products health snapshot
SELECT
  COUNT(*)                                        AS total_client_products,
  COUNT(*) FILTER (WHERE active = true)           AS active_count,
  COUNT(*) FILTER (WHERE auto_ship_enabled = true) AS auto_ship_enabled_count,
  COUNT(*) FILTER (WHERE next_ship_date IS NULL)  AS missing_next_ship_date,
  COUNT(*) FILTER (WHERE product_id IS NULL)      AS orphaned_no_product
FROM client_products;

-- 7E: pending_orders health snapshot
SELECT
  COUNT(*)                                            AS total_pending_orders,
  COUNT(*) FILTER (WHERE ship_date IS NULL)           AS missing_ship_date,
  COUNT(*) FILTER (WHERE client_product_id IS NULL)   AS missing_client_product_link,
  COUNT(*) FILTER (WHERE status = 'pending')          AS pending_status_count,
  COUNT(*) FILTER (WHERE ship_date < CURRENT_DATE AND status = 'pending') AS overdue_pending
FROM pending_orders;


-- ============================================================
-- SECTION 8: FINAL SUMMARY CHECKLIST
-- Returns: check_name | status (PASS/FAIL) | issue_count | next_action
-- ============================================================
WITH
-- 8-1: canonical products missing or duplicated
chk_canonical AS (
  SELECT COUNT(*) AS issue_count
  FROM (
    SELECT c.db_name
    FROM (VALUES
      ('Dexcom G6 Sensor (1)'),
      ('Dexcom G6 Sensors'),
      ('Dexcom G6 Transmitter'),
      ('Dexcom G7 Sensors (10-day)'),
      ('Dexcom G7 Sensors (15-day)'),
      ('Omnipod 5 Pods (Dexcom G6)'),
      ('Tandem t:slim X2 Cartridge 3mL'),
      ('Tandem Mobi Cartridge 2mL (10ct)'),
      ('MiniMed Reservoir 3mL'),
      ('MiniMed Reservoir 1.8mL'),
      ('Medtronic Extended Reservoir 3mL (10ct)')
    ) AS c(db_name)
    LEFT JOIN (
      SELECT name, COUNT(*) AS cnt FROM products GROUP BY name
    ) p ON p.name = c.db_name
    WHERE COALESCE(p.cnt, 0) != 1
  ) sub
),

-- 8-2: vendors exist and are active
chk_vendors AS (
  SELECT COUNT(*) AS issue_count
  FROM (VALUES
    ('TestStripz'), ('Diabetic Overstock'), ('AffordableOTC'), ('RapidRXUSA')
  ) AS expected(vname)
  LEFT JOIN vendors v ON v.name = expected.vname AND v.is_active = true
  WHERE v.id IS NULL
),

-- 8-3: missing pricing rows (product_vendor_pricing)
chk_missing_pvp AS (
  SELECT COUNT(*) AS issue_count
  FROM (
    SELECT db_name AS product_name
    FROM (VALUES
      ('Dexcom G6 Sensor (1)'), ('Dexcom G6 Sensors'), ('Dexcom G6 Transmitter'),
      ('Dexcom G7 Sensors (10-day)'), ('Dexcom G7 Sensors (15-day)'),
      ('Omnipod 5 Pods (Dexcom G6)'), ('Tandem t:slim X2 Cartridge 3mL'),
      ('MiniMed Reservoir 3mL'), ('MiniMed Reservoir 1.8mL'),
      ('Medtronic Extended Reservoir 3mL (10ct)')
    ) AS v(db_name)
  ) cp
  CROSS JOIN (
    SELECT id, name FROM vendors
    WHERE name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  ) av
  LEFT JOIN products p    ON p.name     = cp.product_name
  LEFT JOIN product_vendor_pricing pvp
    ON pvp.product_id = p.id AND pvp.vendor_id = av.id
  WHERE p.id IS NOT NULL AND pvp.id IS NULL
),

-- 8-4: missing price tier rows
chk_missing_tiers AS (
  SELECT COUNT(*) AS issue_count
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
    AND v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  WHERE NOT EXISTS (
    SELECT 1 FROM product_vendor_price_tiers t
    WHERE t.product_vendor_pricing_id = pvp.id
  )
),

-- 8-5: duplicate product names (normalized)
chk_dup_products AS (
  SELECT COUNT(*) AS issue_count
  FROM (
    SELECT lower(trim(name)) FROM products
    GROUP BY lower(trim(name)) HAVING COUNT(*) > 1
  ) sub
),

-- 8-6: duplicate pvp rows
chk_dup_pvp AS (
  SELECT COUNT(*) AS issue_count
  FROM (
    SELECT product_id, vendor_id FROM product_vendor_pricing
    GROUP BY product_id, vendor_id HAVING COUNT(*) > 1
  ) sub
),

-- 8-7: duplicate tier rows
chk_dup_tiers AS (
  SELECT COUNT(*) AS issue_count
  FROM (
    SELECT product_vendor_pricing_id, min_quantity, max_quantity
    FROM product_vendor_price_tiers
    GROUP BY product_vendor_pricing_id, min_quantity, max_quantity
    HAVING COUNT(*) > 1
  ) sub
),

-- 8-8: bad pricing (null or zero prices)
chk_bad_prices AS (
  SELECT COUNT(*) AS issue_count
  FROM product_vendor_pricing pvp
  JOIN vendors v ON v.id = pvp.vendor_id
    AND v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  WHERE pvp.price IS NULL OR pvp.price <= 0
),

-- 8-9: bad tier prices (null or zero unit_price)
chk_bad_tier_prices AS (
  SELECT COUNT(*) AS issue_count
  FROM product_vendor_price_tiers t
  JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
  JOIN vendors v ON v.id = pvp.vendor_id
    AND v.name IN ('TestStripz', 'Diabetic Overstock', 'AffordableOTC', 'RapidRXUSA')
  WHERE t.unit_price IS NULL OR t.unit_price <= 0
),

-- 8-10: product_vendor_pricing_view exists
chk_view_exists AS (
  SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END AS issue_count
  FROM information_schema.views
  WHERE table_schema = 'public' AND table_name = 'product_vendor_pricing_view'
),

-- 8-11: client_products required columns
chk_cp_cols AS (
  SELECT (4 - COUNT(*)) AS issue_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'client_products'
    AND column_name  IN ('active', 'auto_ship_enabled', 'product_id', 'next_ship_date')
),

-- 8-12: pending_orders required columns
chk_po_cols AS (
  SELECT (2 - COUNT(*)) AS issue_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'pending_orders'
    AND column_name  IN ('client_product_id', 'ship_date')
),

-- 8-13: duplicate-prevention index on pending_orders
chk_po_index AS (
  SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END AS issue_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename  = 'pending_orders'
    AND (
      indexdef ILIKE '%client_product_id%ship_date%'
      OR indexdef ILIKE '%ship_date%client_product_id%'
    )
),

-- 8-14: overdue pending orders still in 'pending' status
chk_overdue AS (
  SELECT COUNT(*) AS issue_count
  FROM pending_orders
  WHERE ship_date < CURRENT_DATE AND status = 'pending'
)

SELECT
  check_name,
  CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  issue_count,
  next_action
FROM (
  SELECT 'Canonical products exist (1-to-1)'     AS check_name, issue_count, 'Run Section 1A; add missing products via add-missing-pump-products.sql' AS next_action FROM chk_canonical
  UNION ALL
  SELECT 'Active vendors registered',             issue_count, 'Run vendor upsert in relevant seed file'               FROM chk_vendors
  UNION ALL
  SELECT 'No missing pvp pricing rows',           issue_count, 'Run Section 3; run missing vendor seed files'          FROM chk_missing_pvp
  UNION ALL
  SELECT 'No missing price tier rows',            issue_count, 'Run Section 3; re-run seed Steps 2+3 for each vendor' FROM chk_missing_tiers
  UNION ALL
  SELECT 'No duplicate product names',            issue_count, 'Run Section 4A; delete bare-name duplicates'          FROM chk_dup_products
  UNION ALL
  SELECT 'No duplicate pvp rows',                 issue_count, 'Run Section 4B; delete extra pvp rows manually'       FROM chk_dup_pvp
  UNION ALL
  SELECT 'No duplicate price tier rows',          issue_count, 'Run Section 4C; delete extra tier rows manually'      FROM chk_dup_tiers
  UNION ALL
  SELECT 'All pvp prices > 0',                    issue_count, 'Run Section 5A; update 0.00 prices in seed files'     FROM chk_bad_prices
  UNION ALL
  SELECT 'All tier unit_prices > 0',              issue_count, 'Run Section 5B; update 0.00 tiers in seed files'      FROM chk_bad_tier_prices
  UNION ALL
  SELECT 'product_vendor_pricing_view exists',    issue_count, 'Run create-product-vendor-pricing-view.sql'           FROM chk_view_exists
  UNION ALL
  SELECT 'client_products has required columns',  issue_count, 'Run add-pending-orders-client-product-link.sql'       FROM chk_cp_cols
  UNION ALL
  SELECT 'pending_orders has required columns',   issue_count, 'Run add-pending-orders-client-product-link.sql'       FROM chk_po_cols
  UNION ALL
  SELECT 'pending_orders dedup index exists',     issue_count, 'Run add-pending-orders-client-product-link.sql'       FROM chk_po_index
  UNION ALL
  SELECT 'No overdue pending orders',             issue_count, 'Review and resolve orders past ship_date'             FROM chk_overdue
) summary
ORDER BY
  CASE WHEN issue_count = 0 THEN 1 ELSE 0 END ASC, -- FAILs first
  check_name;
