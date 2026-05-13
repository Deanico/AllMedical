-- Migration: safe repair for orphaned pending_orders.client_product_id
-- Rules:
-- 1) Only update active queue rows (pending/reviewed/ready_to_order/ordered)
-- 2) Only update when exactly one safe match exists on:
--    pending_orders.lead_id = client_products.lead_id
--    inferred product_id match
--    pending_orders.ship_date = client_products.next_ship_date
-- 3) Never auto-update ambiguous/no_match rows
-- 4) Output verification counts
--
-- IMPORTANT: Run diagnostics first:
--   web/diagnose-orphaned-pending-orders-client-product-id.sql

BEGIN;

WITH orphan_orders AS (
  SELECT
    po.id AS pending_order_id,
    po.lead_id,
    po.ship_date,
    po.status,
    po.client_product_id,
    po.order_details,
    CASE
      WHEN (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details ->> 'product_id')::uuid
      WHEN (po.order_details -> 'items' -> 0 ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details -> 'items' -> 0 ->> 'product_id')::uuid
      ELSE NULL
    END AS product_id_from_details
  FROM pending_orders po
  WHERE po.client_product_id IS NULL
    AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered')
),
poi_products AS (
  SELECT
    poi.pending_order_id,
    COUNT(DISTINCT poi.product_id) FILTER (WHERE poi.product_id IS NOT NULL) AS poi_distinct_product_count,
    (ARRAY_AGG(poi.product_id ORDER BY poi.product_id) FILTER (WHERE poi.product_id IS NOT NULL))[1] AS poi_single_product_id
  FROM pending_order_items poi
  GROUP BY poi.pending_order_id
),
orphan_enriched AS (
  SELECT
    oo.pending_order_id,
    oo.lead_id,
    oo.ship_date,
    oo.status,
    oo.client_product_id,
    COALESCE(
      oo.product_id_from_details,
      CASE WHEN pp.poi_distinct_product_count = 1 THEN pp.poi_single_product_id ELSE NULL END
    ) AS inferred_product_id
  FROM orphan_orders oo
  LEFT JOIN poi_products pp ON pp.pending_order_id = oo.pending_order_id
),
candidate_matches AS (
  SELECT
    oe.pending_order_id,
    cp.id AS candidate_client_product_id,
    cp.next_ship_date
  FROM orphan_enriched oe
  LEFT JOIN client_products cp
    ON cp.lead_id = oe.lead_id
   AND cp.product_id = oe.inferred_product_id
),
scored AS (
  SELECT
    oe.pending_order_id,
    oe.inferred_product_id,
    COUNT(cm.candidate_client_product_id) AS candidate_count,
    COUNT(cm.candidate_client_product_id) FILTER (
      WHERE cm.next_ship_date IS NOT DISTINCT FROM oe.ship_date
    ) AS exact_ship_date_count,
    (ARRAY_AGG(cm.candidate_client_product_id ORDER BY cm.candidate_client_product_id) FILTER (
      WHERE cm.next_ship_date IS NOT DISTINCT FROM oe.ship_date
    ))[1] AS exact_candidate_client_product_id
  FROM orphan_enriched oe
  LEFT JOIN candidate_matches cm ON cm.pending_order_id = oe.pending_order_id
  GROUP BY oe.pending_order_id, oe.inferred_product_id
),
classified AS (
  SELECT
    s.pending_order_id,
    s.exact_candidate_client_product_id AS matched_client_product_id,
    CASE
      WHEN s.inferred_product_id IS NULL THEN 'no_match'
      WHEN s.exact_ship_date_count = 1 THEN 'exact'
      WHEN s.exact_ship_date_count > 1 THEN 'ambiguous'
      WHEN s.candidate_count > 0 THEN 'ambiguous'
      ELSE 'no_match'
    END AS match_confidence
  FROM scored s
),
updated_rows AS (
  UPDATE pending_orders po
  SET client_product_id = c.matched_client_product_id
  FROM classified c
  WHERE po.id = c.pending_order_id
    AND c.match_confidence = 'exact'
    AND c.matched_client_product_id IS NOT NULL
  RETURNING po.id
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM pending_orders po WHERE po.client_product_id IS NULL AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered'))
      + (SELECT COUNT(*) FROM updated_rows) AS total_orphaned_before,
    (SELECT COUNT(*) FROM updated_rows) AS safe_repaired,
    (SELECT COUNT(*) FROM classified WHERE match_confidence = 'ambiguous') AS ambiguous,
    (SELECT COUNT(*) FROM classified WHERE match_confidence = 'no_match') AS no_match,
    (SELECT COUNT(*) FROM pending_orders po WHERE po.client_product_id IS NULL AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered'))
      AS orphaned_after
)
SELECT * FROM counts;

COMMIT;
