-- Verification only: product_vendor_price_tiers
-- Read-only queries (no schema changes)

-- 1) Confirm table exists
SELECT
  'product_vendor_price_tiers' AS table_name,
  CASE
    WHEN to_regclass('public.product_vendor_price_tiers') IS NOT NULL THEN 'exists'
    ELSE 'missing'
  END AS table_status;

-- 2) List columns and definitions
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'product_vendor_price_tiers'
ORDER BY c.ordinal_position;

-- 3) Verify constraints, including required CHECK constraints
SELECT
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM information_schema.table_constraints tc
JOIN pg_constraint con
  ON con.conname = tc.constraint_name
JOIN pg_namespace nsp
  ON nsp.oid = con.connamespace
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'product_vendor_price_tiers'
  AND nsp.nspname = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 4) Verify FK target
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'product_vendor_price_tiers'
  AND tc.constraint_type = 'FOREIGN KEY';
