-- Verification only: vendors + product_vendor_pricing
-- Read-only queries (no schema changes)

-- 1) Confirm both tables exist
SELECT
  t.table_name,
  CASE
    WHEN to_regclass('public.' || t.table_name) IS NOT NULL THEN 'exists'
    ELSE 'missing'
  END AS table_status
FROM (
  VALUES ('vendors'), ('product_vendor_pricing')
) AS t(table_name);

-- 2) List columns, types, nullability, and defaults for both tables
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('vendors', 'product_vendor_pricing')
ORDER BY c.table_name, c.ordinal_position;

-- 3) Verify constraints (PK, FK, UNIQUE)
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('vendors', 'product_vendor_pricing')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 4) Verify indexes for pricing table
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'product_vendor_pricing'
ORDER BY indexname;
