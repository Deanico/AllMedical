-- View: product_best_price_view
-- Returns the lowest unit_price for each product/min_quantity/max_quantity combination

CREATE OR REPLACE VIEW product_best_price_view AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  v.id AS vendor_id,
  v.name AS vendor_name,
  t.min_quantity,
  t.max_quantity,
  t.unit_price,
  pvp.product_url
FROM (
  SELECT
    t.id,
    t.product_vendor_pricing_id,
    t.min_quantity,
    t.max_quantity,
    t.unit_price,
    ROW_NUMBER() OVER (
      PARTITION BY t.product_vendor_pricing_id, t.min_quantity, t.max_quantity
      ORDER BY t.unit_price ASC
    ) AS price_rank
  FROM product_vendor_price_tiers t
) t
JOIN product_vendor_pricing pvp ON pvp.id = t.product_vendor_pricing_id
JOIN products p ON p.id = pvp.product_id
JOIN vendors v ON v.id = pvp.vendor_id
WHERE t.price_rank = 1
ORDER BY p.name, t.min_quantity;
