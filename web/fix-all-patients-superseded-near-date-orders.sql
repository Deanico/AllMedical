-- Cleanup patch: cancel stale near-date duplicate active orders across all patients.
--
-- Problem pattern this targets:
-- - Older active row is unshipped and has no tracking number
-- - Newer active row exists within 3 days for the same patient
-- - Older row's product set is a subset of newer row's product set
-- - Newer row is at same or later workflow stage
--
-- This keeps legitimate shipped/tracked history intact and only cancels stale queue artifacts.

BEGIN;

WITH order_products AS (
  SELECT
    po.id,
    po.lead_id,
    po.client_product_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    NULLIF(BTRIM(po.tracking_number), '') AS tracking_number,
    po.order_details,
    po.notes,
    po.created_at,
    po.updated_at,
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
    po.client_product_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    po.tracking_number,
    po.order_details,
    po.notes,
    po.created_at,
    po.updated_at
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
), candidate_pairs AS (
  SELECT
    older.id AS older_order_id,
    newer.id AS newer_order_id,
    older.lead_id,
    older.ship_date AS older_ship_date,
    newer.ship_date AS newer_ship_date,
    older.status AS older_status,
    newer.status AS newer_status,
    older.status_rank AS older_status_rank,
    newer.status_rank AS newer_status_rank,
    older.product_ids AS older_product_ids,
    newer.product_ids AS newer_product_ids,
    older.updated_at AS older_updated_at,
    newer.updated_at AS newer_updated_at
  FROM normalized older
  JOIN normalized newer
    ON newer.lead_id = older.lead_id
   AND newer.id <> older.id
   AND older.ship_date IS NOT NULL
   AND newer.ship_date IS NOT NULL
   AND newer.ship_date > older.ship_date
   AND newer.ship_date <= (older.ship_date + INTERVAL '3 day')
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
), ranked AS (
  SELECT
    cp.*,
    ROW_NUMBER() OVER (
      PARTITION BY cp.older_order_id
      ORDER BY
        (cp.newer_ship_date - cp.older_ship_date) ASC,
        cp.newer_status_rank DESC,
        CARDINALITY(cp.newer_product_ids) DESC,
        cp.newer_updated_at DESC,
        cp.newer_order_id DESC
    ) AS rn
  FROM candidate_pairs cp
), to_cancel AS (
  SELECT
    r.older_order_id AS id,
    r.newer_order_id,
    r.older_ship_date,
    r.newer_ship_date,
    r.older_status,
    r.newer_status
  FROM ranked r
  WHERE r.rn = 1
), preview AS (
  SELECT
    tc.id AS cancel_order_id,
    tc.newer_order_id AS survivor_order_id,
    tc.older_ship_date,
    tc.newer_ship_date,
    tc.older_status,
    tc.newer_status,
    l.name AS patient_name
  FROM to_cancel tc
  LEFT JOIN pending_orders po ON po.id = tc.id
  LEFT JOIN leads l ON l.id = po.lead_id
)
SELECT *
FROM preview
ORDER BY patient_name, older_ship_date, cancel_order_id;

WITH order_products AS (
  SELECT
    po.id,
    po.lead_id,
    po.client_product_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    NULLIF(BTRIM(po.tracking_number), '') AS tracking_number,
    po.order_details,
    po.notes,
    po.created_at,
    po.updated_at,
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
    po.client_product_id,
    po.ship_date,
    po.status,
    po.shipped_at,
    po.tracking_number,
    po.order_details,
    po.notes,
    po.created_at,
    po.updated_at
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
), candidate_pairs AS (
  SELECT
    older.id AS older_order_id,
    newer.id AS newer_order_id,
    older.lead_id,
    older.ship_date AS older_ship_date,
    newer.ship_date AS newer_ship_date,
    older.status AS older_status,
    newer.status AS newer_status,
    older.status_rank AS older_status_rank,
    newer.status_rank AS newer_status_rank,
    older.product_ids AS older_product_ids,
    newer.product_ids AS newer_product_ids,
    older.updated_at AS older_updated_at,
    newer.updated_at AS newer_updated_at
  FROM normalized older
  JOIN normalized newer
    ON newer.lead_id = older.lead_id
   AND newer.id <> older.id
   AND older.ship_date IS NOT NULL
   AND newer.ship_date IS NOT NULL
   AND newer.ship_date > older.ship_date
   AND newer.ship_date <= (older.ship_date + INTERVAL '3 day')
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
), ranked AS (
  SELECT
    cp.*,
    ROW_NUMBER() OVER (
      PARTITION BY cp.older_order_id
      ORDER BY
        (cp.newer_ship_date - cp.older_ship_date) ASC,
        cp.newer_status_rank DESC,
        CARDINALITY(cp.newer_product_ids) DESC,
        cp.newer_updated_at DESC,
        cp.newer_order_id DESC
    ) AS rn
  FROM candidate_pairs cp
), to_cancel AS (
  SELECT
    r.older_order_id AS id,
    r.newer_order_id,
    r.older_ship_date,
    r.newer_ship_date,
    r.older_status,
    r.newer_status
  FROM ranked r
  WHERE r.rn = 1
)
UPDATE pending_orders po
SET
  status = 'cancelled',
  notes = TRIM(BOTH ' ' FROM CONCAT_WS(' | ', NULLIF(po.notes, ''), 'Auto-cancelled as superseded near-date duplicate by cleanup patch.')),
  updated_at = NOW()
FROM to_cancel tc
WHERE po.id = tc.id
  AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered')
  AND po.shipped_at IS NULL
  AND NULLIF(BTRIM(po.tracking_number), '') IS NULL;

COMMIT;
