-- Migration: normalize pending_orders.order_details for auto-generated rows
-- Goals:
-- 1) Backfill legacy auto_generated JSON ({items:[...]}) into clean flat shape
-- 2) Enforce clean shape for future auto_generated inserts/updates
-- Additive and non-destructive: no deletes, no dropped columns

BEGIN;

-- ------------------------------------------------------------
-- 1) Backfill existing rows with clean JSON payload
-- ------------------------------------------------------------
WITH source_data AS (
  SELECT
    po.id,
    po.lead_id,
    po.client_product_id,
    po.ship_date,
    po.order_details,
    cp.product_id AS cp_product_id,
    l.name AS lead_name,
    p.name AS cp_product_name,
    poi.product_id AS poi_product_id,
    poi.quantity AS poi_quantity
  FROM pending_orders po
  LEFT JOIN client_products cp ON cp.id = po.client_product_id
  LEFT JOIN leads l ON l.id = COALESCE(po.lead_id, cp.lead_id)
  LEFT JOIN products p ON p.id = cp.product_id
  LEFT JOIN LATERAL (
    SELECT poi1.product_id, poi1.quantity
    FROM pending_order_items poi1
    WHERE poi1.pending_order_id = po.id
    ORDER BY poi1.created_at ASC NULLS LAST, poi1.id ASC
    LIMIT 1
  ) poi ON true
  WHERE COALESCE(po.order_details ->> 'auto_generated', 'false') = 'true'
),
normalized AS (
  SELECT
    sd.id,
    COALESCE(
      NULLIF(sd.order_details ->> 'patient_name', ''),
      sd.lead_name,
      'Unknown Patient'
    ) AS patient_name,
    COALESCE(
      NULLIF(sd.order_details ->> 'product_name', ''),
      sd.cp_product_name,
      p2.name,
      'Unknown Product'
    ) AS product_name,
    COALESCE(
      NULLIF(sd.order_details ->> 'product_id', ''),
      NULLIF(sd.order_details -> 'items' -> 0 ->> 'product_id', ''),
      sd.cp_product_id::text,
      sd.poi_product_id::text,
      NULL
    ) AS product_id_text,
    COALESCE(
      CASE WHEN (sd.order_details ->> 'quantity') ~ '^[0-9]+$' THEN (sd.order_details ->> 'quantity')::int ELSE NULL END,
      CASE WHEN (sd.order_details -> 'items' -> 0 ->> 'quantity') ~ '^[0-9]+$' THEN (sd.order_details -> 'items' -> 0 ->> 'quantity')::int ELSE NULL END,
      sd.poi_quantity,
      1
    ) AS quantity_value,
    COALESCE(
      NULLIF(sd.order_details ->> 'ship_date', ''),
      sd.ship_date::text,
      CURRENT_DATE::text
    ) AS ship_date_text
  FROM source_data sd
  LEFT JOIN products p2
    ON p2.id::text = COALESCE(
      NULLIF(sd.order_details ->> 'product_id', ''),
      NULLIF(sd.order_details -> 'items' -> 0 ->> 'product_id', ''),
      sd.poi_product_id::text
    )
)
UPDATE pending_orders po
SET order_details = jsonb_build_object(
  'patient_name', n.patient_name,
  'product_name', n.product_name,
  'product_id', n.product_id_text,
  'quantity', n.quantity_value,
  'ship_date', n.ship_date_text,
  'auto_generated', true
)
FROM normalized n
WHERE po.id = n.id
  AND (
    NOT (po.order_details ? 'patient_name')
    OR NOT (po.order_details ? 'product_name')
    OR NOT (po.order_details ? 'product_id')
    OR NOT (po.order_details ? 'quantity')
    OR NOT (po.order_details ? 'ship_date')
    OR po.order_details ? 'items'
  );

-- ------------------------------------------------------------
-- 2) Trigger to normalize future auto-generated rows
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_auto_generated_pending_order_details()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_name TEXT;
  v_product_name TEXT;
  v_product_id_text TEXT;
  v_quantity_value INTEGER;
  v_ship_date_text TEXT;
BEGIN
  IF COALESCE(NEW.order_details ->> 'auto_generated', 'false') <> 'true' THEN
    RETURN NEW;
  END IF;

  SELECT l.name, p.name, cp.product_id::text
  INTO v_lead_name, v_product_name, v_product_id_text
  FROM client_products cp
  LEFT JOIN leads l ON l.id = cp.lead_id
  LEFT JOIN products p ON p.id = cp.product_id
  WHERE cp.id = NEW.client_product_id;

  v_product_id_text := COALESCE(
    NULLIF(NEW.order_details ->> 'product_id', ''),
    NULLIF(NEW.order_details -> 'items' -> 0 ->> 'product_id', ''),
    v_product_id_text
  );

  v_quantity_value := COALESCE(
    CASE WHEN (NEW.order_details ->> 'quantity') ~ '^[0-9]+$' THEN (NEW.order_details ->> 'quantity')::int ELSE NULL END,
    CASE WHEN (NEW.order_details -> 'items' -> 0 ->> 'quantity') ~ '^[0-9]+$' THEN (NEW.order_details -> 'items' -> 0 ->> 'quantity')::int ELSE NULL END,
    1
  );

  v_ship_date_text := COALESCE(
    NULLIF(NEW.order_details ->> 'ship_date', ''),
    NEW.ship_date::text,
    CURRENT_DATE::text
  );

  NEW.order_details := jsonb_build_object(
    'patient_name', COALESCE(NULLIF(NEW.order_details ->> 'patient_name', ''), v_lead_name, 'Unknown Patient'),
    'product_name', COALESCE(NULLIF(NEW.order_details ->> 'product_name', ''), v_product_name, 'Unknown Product'),
    'product_id', v_product_id_text,
    'quantity', v_quantity_value,
    'ship_date', v_ship_date_text,
    'auto_generated', true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_auto_generated_pending_order_details ON pending_orders;

CREATE TRIGGER trg_normalize_auto_generated_pending_order_details
BEFORE INSERT OR UPDATE OF order_details, client_product_id, ship_date
ON pending_orders
FOR EACH ROW
EXECUTE FUNCTION normalize_auto_generated_pending_order_details();

COMMIT;

-- Quick verification: remaining legacy-shape auto_generated rows should be 0
SELECT COUNT(*) AS remaining_legacy_auto_generated_rows
FROM pending_orders po
WHERE COALESCE(po.order_details ->> 'auto_generated', 'false') = 'true'
  AND (
    po.order_details ? 'items'
    OR NOT (po.order_details ? 'patient_name')
    OR NOT (po.order_details ? 'product_name')
    OR NOT (po.order_details ? 'product_id')
    OR NOT (po.order_details ? 'quantity')
    OR NOT (po.order_details ? 'ship_date')
  );
