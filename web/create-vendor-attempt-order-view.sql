-- Vendor attempt order view for n8n automation
-- Purpose: return ALL vendors for each product ranked by lowest price first.
-- Notes:
-- - is_available is included for information only and is NOT used to filter rows.
-- - NULL prices are ranked last (NULLS LAST).

CREATE OR REPLACE VIEW vendor_purchase_attempt_order AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  v.id AS vendor_id,
  v.name AS vendor_name,
  pvp.price,
  pvp.product_url,
  pvp.is_available,
  ROW_NUMBER() OVER (
    PARTITION BY p.id
    ORDER BY pvp.price ASC NULLS LAST, v.name ASC
  ) AS rank_number
FROM product_vendor_pricing pvp
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id;

-- Example for n8n (single product_id input)
-- SELECT
--   product_id,
--   product_name,
--   vendor_id,
--   vendor_name,
--   price,
--   product_url,
--   is_available,
--   rank_number
-- FROM vendor_purchase_attempt_order
-- WHERE product_id = '00000000-0000-0000-0000-000000000000'::uuid
-- ORDER BY rank_number;
