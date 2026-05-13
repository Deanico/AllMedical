-- Migration: additive vendor recommendation fields + operational queue views
-- Purpose:
-- 1) Keep pending_orders as the operational queue
-- 2) Add vendor recommendation fields aligned to vendors table
-- 3) Provide reviewed_orders_view and ready_to_order_view for n8n
-- 4) Handle legacy/dirty rows safely (missing links, missing JSON keys)

BEGIN;

-- ------------------------------------------------------------
-- 1) Add recommended vendor fields (additive only)
-- ------------------------------------------------------------
ALTER TABLE IF EXISTS pending_orders
  ADD COLUMN IF NOT EXISTS recommended_vendor_id UUID,
  ADD COLUMN IF NOT EXISTS recommended_vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS recommended_unit_price NUMERIC(10,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pending_orders'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendors'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'pending_orders'
      AND constraint_name = 'fk_pending_orders_recommended_vendor'
  ) THEN
    ALTER TABLE pending_orders
      ADD CONSTRAINT fk_pending_orders_recommended_vendor
      FOREIGN KEY (recommended_vendor_id)
      REFERENCES vendors(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pending_orders_recommended_vendor_id
  ON pending_orders(recommended_vendor_id);

-- Rebuild queue views to avoid CREATE OR REPLACE conflicts when legacy
-- definitions have different column names/order.
DROP VIEW IF EXISTS ready_to_order_view;
DROP VIEW IF EXISTS reviewed_orders_view;

-- ------------------------------------------------------------
-- 2) Reviewed queue view for workflow handoff
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW reviewed_orders_view AS
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
    po.notes,
    po.tracking_number,
    po.order_placed_at,
    po.shipped_at,
    po.created_at,
    po.updated_at,
    po.order_details
  FROM pending_orders po
  LEFT JOIN client_products cp ON cp.id = po.client_product_id
)
SELECT
  n.pending_order_id,
  n.lead_id,
  n.client_product_id,
  COALESCE(
    NULLIF(to_jsonb(l) ->> 'full_name', ''),
    NULLIF(to_jsonb(l) ->> 'name', ''),
    NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(l) ->> 'first_name', to_jsonb(l) ->> 'last_name')), '')
  ) AS patient_full_name,
  n.product_id,
  COALESCE(p.name, NULLIF(n.order_details ->> 'product_name', '')) AS product_name,
  n.ship_date,
  n.status,
  n.notes,
  n.tracking_number,
  n.order_placed_at,
  n.shipped_at,
  n.created_at,
  n.updated_at
FROM normalized n
LEFT JOIN leads l ON l.id = n.lead_id
LEFT JOIN products p ON p.id = n.product_id
WHERE n.status = 'reviewed';

-- ------------------------------------------------------------
-- 3) Ready-to-order view for vendor execution workflow
-- ------------------------------------------------------------
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
    po.shipped_at
  FROM pending_orders po
  LEFT JOIN client_products cp ON cp.id = po.client_product_id
)
SELECT
  n.pending_order_id,
  n.lead_id,
  n.client_product_id,
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
  n.shipped_at
FROM normalized n
LEFT JOIN leads l ON l.id = n.lead_id
LEFT JOIN products p ON p.id = n.product_id
LEFT JOIN vendors v ON v.id = n.recommended_vendor_id
WHERE n.status = 'ready_to_order';

COMMIT;
