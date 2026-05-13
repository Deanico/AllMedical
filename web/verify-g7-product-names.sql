-- Verification only: list G7 products to confirm exact naming
-- Read-only query (no schema changes)

SELECT
  p.id,
  p.name,
  p.category,
  p.manufacturer,
  p.active,
  p.created_at
FROM products p
WHERE p.name ILIKE '%G7%'
ORDER BY p.name;
