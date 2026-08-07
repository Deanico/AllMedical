-- Verification report: remaining near-date duplicate candidates after cleanup.
-- If this returns rows, those are candidates that still need manual review.

WITH order_products AS (
  SELECT
    po.id,
    po.lead_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    NULLIF(BTRIM(po.tracking_number), '') AS tracking_number,
    po.order_details,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT poi.product_id), NULL) AS poi_product_ids,
    CASE
      WHEN (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details ->> 'product_id')::uuid
      WHEN (po.order_details -> 'items' -> 0 ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details -> 'items' -> 0 ->> 'product_id')::uuid
      ELSE NULL
    END AS details_product_id
  FROM pending_orders po
  LEFT JOIN pending_order_items poi ON poi.pending_order_id = po.id
  GROUP BY
    po.id,
    po.lead_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    po.tracking_number,
    po.order_details
), normalized AS (
  SELECT
    op.*,
    CASE
      WHEN CARDINALITY(op.poi_product_ids) > 0 THEN op.poi_product_ids
      WHEN op.details_product_id IS NOT NULL THEN ARRAY[op.details_product_id]
      ELSE ARRAY[]::uuid[]
    END AS product_ids,
    CASE op.status
      WHEN 'pending' THEN 1
      WHEN 'reviewed' THEN 2
      WHEN 'ready_to_order' THEN 3
      WHEN 'ordered' THEN 4
      ELSE 0
    END AS status_rank
  FROM order_products op
)
SELECT
  older.id AS older_order_id,
  newer.id AS newer_order_id,
  l.name AS patient_name,
  older.ship_date AS older_ship_date,
  newer.ship_date AS newer_ship_date,
  older.status AS older_status,
  newer.status AS newer_status
FROM normalized older
JOIN normalized newer
  ON newer.lead_id = older.lead_id
 AND newer.id <> older.id
 AND older.ship_date IS NOT NULL
 AND newer.ship_date IS NOT NULL
 AND newer.ship_date > older.ship_date
 AND newer.ship_date <= (older.ship_date + INTERVAL '3 day')
LEFT JOIN leads l ON l.id = older.lead_id
WHERE older.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered')
  AND newer.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered')
  AND older.shipped_at IS NULL
  AND newer.shipped_at IS NULL
  AND older.tracking_number IS NULL
  AND newer.tracking_number IS NULL
  AND CARDINALITY(older.product_ids) > 0
  AND CARDINALITY(newer.product_ids) > 0
  AND older.product_ids <@ newer.product_ids
  AND newer.status_rank >= older.status_rank
ORDER BY patient_name, older_ship_date, newer_ship_date, older_order_id;
