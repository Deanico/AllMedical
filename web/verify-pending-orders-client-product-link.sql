-- Verification queries for add-pending-orders-client-product-link.sql migration
-- Run this file in Supabase SQL editor to validate migration success
-- All queries are read-only (SELECT only)

-- ============================================================
-- 1. How many pending_orders got backfilled with client_product_id
-- ============================================================
SELECT
  'Backfilled pending_orders' AS check_name,
  COUNT(*) AS count
FROM pending_orders
WHERE client_product_id IS NOT NULL;

-- ============================================================
-- 2. Any remaining pending_orders with NULL client_product_id
-- ============================================================
SELECT
  'Pending orders with NULL client_product_id' AS issue,
  COUNT(*) AS count,
  STRING_AGG(id::TEXT, ', ' ORDER BY id::TEXT) AS pending_order_ids
FROM pending_orders
WHERE client_product_id IS NULL;

-- ============================================================
-- 3. Pending duplicates that would violate the new unique index rule
--    (only for active statuses: pending, reviewed, ordered)
-- ============================================================
SELECT
  'POTENTIAL DUPLICATE VIOLATIONS' AS issue,
  cp.id AS client_product_id,
  po.ship_date,
  COUNT(*) AS duplicate_count,
  STRING_AGG(po.id::TEXT, ', ' ORDER BY po.id::TEXT) AS pending_order_ids,
  STRING_AGG(DISTINCT po.status, ', ') AS statuses
FROM pending_orders po
JOIN client_products cp ON po.client_product_id = cp.id
WHERE po.client_product_id IS NOT NULL
  AND po.ship_date IS NOT NULL
  AND po.status IN ('pending', 'reviewed', 'ordered')
GROUP BY cp.id, po.ship_date
HAVING COUNT(*) > 1
ORDER BY cp.id, po.ship_date;

-- if no rows returned above, constraint can be applied safely

-- ============================================================
-- 4. Confirmation: client_products.auto_ship_enabled exists
-- ============================================================
SELECT
  'client_products.auto_ship_enabled column exists' AS verification,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_products'
      AND column_name = 'auto_ship_enabled'
  ) AS exists_column,
  COALESCE(
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_products'
       AND column_name = 'auto_ship_enabled'),
    'N/A'
  ) AS column_type,
  COALESCE(
    (SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'client_products'
       AND column_name = 'auto_ship_enabled'),
    'N/A'
  ) AS default_value;

-- ============================================================
-- 5. Confirmation: pending_orders.client_product_id exists
-- ============================================================
SELECT
  'pending_orders.client_product_id column exists' AS verification,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pending_orders'
      AND column_name = 'client_product_id'
  ) AS exists_column,
  COALESCE(
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pending_orders'
       AND column_name = 'client_product_id'),
    'N/A'
  ) AS column_type,
  -- Check for FK constraint
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'pending_orders'
      AND constraint_name = 'fk_pending_orders_client_product'
      AND constraint_type = 'FOREIGN KEY'
  ) AS fk_constraint_exists;

-- ============================================================
-- 6. Confirmation: pending_orders.ship_date exists
-- ============================================================
SELECT
  'pending_orders.ship_date column exists' AS verification,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pending_orders'
      AND column_name = 'ship_date'
  ) AS exists_column,
  COALESCE(
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pending_orders'
       AND column_name = 'ship_date'),
    'N/A'
  ) AS column_type;

-- ============================================================
-- 7. Confirmation: unique duplicate-prevention constraint/index exists
-- ============================================================
SELECT
  'Duplicate-prevention unique index exists' AS verification,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'pending_orders'
      AND indexname = 'uq_pending_orders_client_product_ship_date_active'
  ) AS exists_index,
  COALESCE(
    (SELECT indexdef FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'pending_orders'
       AND indexname = 'uq_pending_orders_client_product_ship_date_active'),
    'N/A'
  ) AS index_definition;

-- ============================================================
-- Summary: overall client_products.auto_ship_enabled coverage
-- ============================================================
SELECT
  'client_products auto_ship_enabled summary' AS metric,
  COUNT(*) AS total_client_products,
  COUNT(CASE WHEN auto_ship_enabled = true THEN 1 END) AS auto_ship_true,
  COUNT(CASE WHEN auto_ship_enabled = false THEN 1 END) AS auto_ship_false,
  COUNT(CASE WHEN auto_ship_enabled IS NULL THEN 1 END) AS auto_ship_null
FROM client_products;

-- ============================================================
-- Summary: pending_orders client_product_id backfill coverage
-- ============================================================
SELECT
  'pending_orders client_product_id backfill summary' AS metric,
  COUNT(*) AS total_pending_orders,
  COUNT(CASE WHEN client_product_id IS NOT NULL THEN 1 END) AS client_product_id_filled,
  COUNT(CASE WHEN client_product_id IS NULL THEN 1 END) AS client_product_id_null,
  COUNT(DISTINCT status) AS unique_statuses,
  STRING_AGG(DISTINCT status, ', ') AS statuses
FROM pending_orders;
