-- Migration: expose approval workflow fields on ready_to_order_view
-- Purpose: allow n8n Workflow 3 to filter by approval state without re-sending approval SMS
-- Notes: view behavior/filter remains unchanged (status = 'ready_to_order')

BEGIN;

CREATE OR REPLACE VIEW ready_to_order_view AS
WITH normalized AS (
  SELECT
    po.id AS pending_order_id,
    COALESCE(po.lead_id, cp.lead_id) AS lead_id,
    po.client_product_id,
    CASE
      WHEN cp.product_id IS NOT NULL THEN cp.product_id
      WHEN (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details ->> 'product_id')::uuid
      WHEN (po.order_details -> 'items' -> 0 ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details -> 'items' -> 0 ->> 'product_id')::uuid
      ELSE NULL
    END AS product_id,
    COALESCE(po.ship_date, cp.next_ship_date) AS ship_date,
    po.status,
    po.recommended_vendor_id,
    po.recommended_vendor_name,
    po.recommended_unit_price,
    po.order_details,
    po.notes,
    po.tracking_number,
    po.order_placed_at,
    po.shipped_at,
    po.approval_requested_at,
    po.approval_status,
    po.approved_at,
    po.approved_by
  FROM pending_orders po
  LEFT JOIN client_products cp ON cp.id = po.client_product_id
)
SELECT
  n.pending_order_id,
  n.lead_id,
  n.client_product_id,
  (n.client_product_id IS NOT NULL) AS has_client_product_link,
  CASE
    WHEN n.client_product_id IS NULL THEN 'MISSING_CLIENT_PRODUCT_LINK'
    ELSE 'OK'
  END AS client_product_link_health,
  COALESCE(
    NULLIF(to_jsonb(l) ->> 'full_name', ''),
    NULLIF(to_jsonb(l) ->> 'name', ''),
    NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(l) ->> 'first_name', to_jsonb(l) ->> 'last_name')), '')
  ) AS patient_full_name,
  n.product_id,
  COALESCE(p.name, NULLIF(n.order_details ->> 'product_name', '')) AS product_name,
  n.ship_date,
  n.status,
  n.recommended_vendor_id,
  COALESCE(v.name, n.recommended_vendor_name) AS recommended_vendor_name,
  n.recommended_unit_price,
  n.notes,
  n.tracking_number,
  n.order_placed_at,
  n.shipped_at,
  n.approval_requested_at,
  n.approval_status,
  n.approved_at,
  n.approved_by
FROM normalized n
LEFT JOIN leads l ON l.id = n.lead_id
LEFT JOIN products p ON p.id = n.product_id
LEFT JOIN vendors v ON v.id = n.recommended_vendor_id
WHERE n.status = 'ready_to_order';

COMMIT;
