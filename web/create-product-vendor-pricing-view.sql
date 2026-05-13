-- Read-only view for product/vendor pricing display
-- Does not modify existing tables

CREATE OR REPLACE VIEW product_vendor_pricing_view AS
SELECT
  pvp.id,
  p.name AS product_name,
  v.name AS vendor_name,
  pvp.price,
  pvp.is_available,
  pvp.product_url,
  pvp.last_updated
FROM product_vendor_pricing pvp
JOIN products p ON pvp.product_id = p.id
JOIN vendors v ON pvp.vendor_id = v.id
ORDER BY product_name, vendor_name;
