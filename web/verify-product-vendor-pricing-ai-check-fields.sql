-- Verification only: product_vendor_pricing AI/vendor price-checking columns
-- Read-only queries (no schema changes)

-- 1) Show whether each expected column exists
SELECT
  expected.column_name,
  CASE WHEN actual.column_name IS NOT NULL THEN 'exists' ELSE 'missing' END AS column_status
FROM (
  VALUES
    ('product_url'),
    ('last_checked_at'),
    ('last_successful_check_at'),
    ('scrape_status'),
    ('scrape_error'),
    ('price_source'),
    ('approval_required')
) AS expected(column_name)
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'public'
 AND actual.table_name = 'product_vendor_pricing'
 AND actual.column_name = expected.column_name
ORDER BY expected.column_name;

-- 2) List details for the expected columns
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'product_vendor_pricing'
  AND c.column_name IN (
    'product_url',
    'last_checked_at',
    'last_successful_check_at',
    'scrape_status',
    'scrape_error',
    'price_source',
    'approval_required'
  )
ORDER BY c.ordinal_position;
