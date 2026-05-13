-- Create a view for shipments due in the next 7 days
-- Used by automation tools (e.g., n8n) to find active auto-ship records

DROP VIEW IF EXISTS shipment_due_view;

CREATE VIEW shipment_due_view AS
SELECT
  cp.id,
  cp.id AS client_product_id,
  cp.lead_id,
  cp.product_id,
  COALESCE(
    NULLIF(to_jsonb(l) ->> 'full_name', ''),
    NULLIF(to_jsonb(l) ->> 'name', ''),
    NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(l) ->> 'first_name', to_jsonb(l) ->> 'last_name')), '')
  ) AS patient_full_name,
  p.name AS product_name,
  cp.next_ship_date,
  cp.next_ship_date AS ship_date,
  cp.active,
  cp.auto_ship_enabled
FROM client_products cp
JOIN leads l ON l.id = cp.lead_id
JOIN products p ON p.id = cp.product_id
WHERE cp.active = true
  AND cp.auto_ship_enabled = true
  AND cp.next_ship_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY cp.next_ship_date ASC, patient_full_name ASC;
