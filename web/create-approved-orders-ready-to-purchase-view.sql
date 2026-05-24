-- View: approved_orders_ready_to_purchase_view
-- Purpose: approved pending orders that have not been placed yet
-- Includes TestStripz fulfillment strategy fields (pack size, cart quantity, notes)

DROP VIEW IF EXISTS approved_orders_ready_to_purchase_view CASCADE;

CREATE VIEW approved_orders_ready_to_purchase_view AS
WITH normalized AS (
  SELECT
    po.id AS pending_order_id,
    po.lead_id,
    CASE
      WHEN (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details ->> 'product_id')::uuid
      WHEN (po.order_details -> 'items' -> 0 ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details -> 'items' -> 0 ->> 'product_id')::uuid
      ELSE NULL
    END AS product_id,
    COALESCE(
      CASE WHEN (po.order_details ->> 'quantity') ~ '^[0-9]+$' THEN (po.order_details ->> 'quantity')::int END,
      CASE WHEN (po.order_details -> 'items' -> 0 ->> 'quantity') ~ '^[0-9]+$' THEN (po.order_details -> 'items' -> 0 ->> 'quantity')::int END,
      1
    ) AS quantity,
    po.ship_date,
    po.approval_code,
    po.approval_status,
    po.order_placed_at,
    po.recommended_vendor_id,
    po.recommended_vendor_name,
    po.recommended_unit_price,
    po.notes,
    po.created_at,
    po.order_details
  FROM pending_orders po
)
SELECT
  n.pending_order_id,
  n.lead_id,
  COALESCE(
    NULLIF(to_jsonb(l) ->> 'full_name', ''),
    NULLIF(to_jsonb(l) ->> 'name', ''),
    NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(l) ->> 'first_name', to_jsonb(l) ->> 'last_name')), '')
  ) AS patient_full_name,
  COALESCE(
    NULLIF(n.order_details ->> 'shipping_address', ''),
    NULLIF(n.order_details ->> 'address_line1', ''),
    l.address_line1
  ) AS shipping_address,
  COALESCE(
    NULLIF(n.order_details ->> 'shipping_city', ''),
    NULLIF(n.order_details ->> 'city', ''),
    l.city
  ) AS shipping_city,
  COALESCE(
    NULLIF(n.order_details ->> 'shipping_state', ''),
    NULLIF(n.order_details ->> 'state', ''),
    l.state
  ) AS shipping_state,
  COALESCE(
    NULLIF(n.order_details ->> 'shipping_zip', ''),
    NULLIF(n.order_details ->> 'zip_code', ''),
    l.zip_code
  ) AS shipping_zip,
  n.product_id,
  COALESCE(p.name, NULLIF(n.order_details ->> 'product_name', '')) AS product_name,
  n.quantity,
  n.ship_date,
  n.approval_code,
  n.recommended_vendor_id,
  COALESCE(v.name, n.recommended_vendor_name) AS recommended_vendor_name,
  n.recommended_unit_price,
  v.website_url,
  pvp.product_url,
  p.sku AS vendor_sku,
  pvp.fulfillment_pack_size,
  pvp.cart_quantity_for_90_days,
  pvp.fulfillment_notes,
  n.notes,
  n.created_at
FROM normalized n
LEFT JOIN leads l ON l.id = n.lead_id
LEFT JOIN products p ON p.id = n.product_id
LEFT JOIN vendors v ON
  (v.id = n.recommended_vendor_id)
  OR (n.recommended_vendor_id IS NULL AND v.name = n.recommended_vendor_name)
LEFT JOIN product_vendor_pricing pvp
  ON pvp.product_id = n.product_id
 AND (
   (pvp.vendor_id = n.recommended_vendor_id AND n.recommended_vendor_id IS NOT NULL)
   OR (n.recommended_vendor_id IS NULL AND pvp.vendor_id = v.id)
 )
WHERE n.approval_status = 'approved'
  AND n.order_placed_at IS NULL;

SELECT * FROM approved_orders_ready_to_purchase_view LIMIT 5;
