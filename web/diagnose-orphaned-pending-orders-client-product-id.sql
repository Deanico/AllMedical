-- Read-only orphan diagnostics for pending_orders.client_product_id
-- Purpose:
-- 1) Find active queue rows with NULL client_product_id
-- 2) Infer product_id from order_details or pending_order_items
-- 3) Match candidate client_products by lead_id + product_id
-- 4) Classify confidence: exact / ambiguous / no_match
--
-- Exact = one and only one candidate where:
--   pending_orders.lead_id = client_products.lead_id
--   inferred product_id = client_products.product_id
--   pending_orders.ship_date = client_products.next_ship_date

WITH orphan_orders AS (
  SELECT
    po.id AS pending_order_id,
    po.lead_id,
    po.ship_date,
    po.status,
    po.client_product_id,
    po.order_details,
    po.created_at,
    CASE
      WHEN (po.order_details ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details ->> 'product_id')::uuid
      WHEN (po.order_details -> 'items' -> 0 ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN (po.order_details -> 'items' -> 0 ->> 'product_id')::uuid
      ELSE NULL
    END AS product_id_from_details,
    NULLIF(po.order_details ->> 'product_name', '') AS product_name_from_details
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
    oo.order_details,
    oo.created_at,
    COALESCE(
      oo.product_id_from_details,
      CASE WHEN pp.poi_distinct_product_count = 1 THEN pp.poi_single_product_id ELSE NULL END
    ) AS inferred_product_id,
    oo.product_name_from_details,
    pp.poi_distinct_product_count,
    l.name AS patient_name
  FROM orphan_orders oo
  LEFT JOIN poi_products pp ON pp.pending_order_id = oo.pending_order_id
  LEFT JOIN leads l ON l.id = oo.lead_id
),
candidate_matches AS (
  SELECT
    oe.pending_order_id,
    oe.lead_id,
    oe.ship_date,
    oe.status,
    oe.client_product_id,
    oe.inferred_product_id,
    oe.product_name_from_details,
    oe.patient_name,
    oe.created_at,
    oe.order_details,
    cp.id AS candidate_client_product_id,
    cp.next_ship_date AS candidate_next_ship_date,
    cp.active AS candidate_active
  FROM orphan_enriched oe
  LEFT JOIN client_products cp
    ON cp.lead_id = oe.lead_id
   AND cp.product_id = oe.inferred_product_id
),
exact_matches AS (
  SELECT
    cm.pending_order_id,
    (ARRAY_AGG(cm.candidate_client_product_id::text ORDER BY cm.candidate_client_product_id::text))[1]::uuid AS exact_candidate_client_product_id
  FROM candidate_matches cm
  WHERE cm.candidate_next_ship_date IS NOT DISTINCT FROM cm.ship_date
    AND cm.candidate_client_product_id IS NOT NULL
  GROUP BY cm.pending_order_id
),
scored AS (
  SELECT
    cm.*,
    COUNT(cm.candidate_client_product_id) OVER (PARTITION BY cm.pending_order_id) AS candidate_count,
    COUNT(cm.candidate_client_product_id) FILTER (
      WHERE cm.candidate_next_ship_date IS NOT DISTINCT FROM cm.ship_date
    ) OVER (PARTITION BY cm.pending_order_id) AS exact_ship_date_count,
    em.exact_candidate_client_product_id
  FROM candidate_matches cm
  LEFT JOIN exact_matches em ON em.pending_order_id = cm.pending_order_id
),
diagnostic_rows AS (
  SELECT DISTINCT
    s.pending_order_id,
    COALESCE(s.patient_name, NULLIF(s.order_details ->> 'patient_name', ''), 'Unknown Patient') AS patient_name,
    s.ship_date AS pending_order_ship_date,
    s.status AS pending_order_status,
    s.inferred_product_id AS pending_order_product_id,
    COALESCE(p.name, s.product_name_from_details, NULLIF(s.order_details ->> 'product_name', ''), 'Unknown Product') AS pending_order_product_name,
    s.client_product_id AS current_client_product_id,
    CASE
      WHEN s.exact_ship_date_count = 1 THEN s.exact_candidate_client_product_id
      ELSE NULL
    END AS matched_client_product_id_candidate,
    CASE
      WHEN s.inferred_product_id IS NULL THEN 'no_match'
      WHEN s.exact_ship_date_count = 1 THEN 'exact'
      WHEN s.exact_ship_date_count > 1 THEN 'ambiguous'
      WHEN s.candidate_count > 0 THEN 'ambiguous'
      ELSE 'no_match'
    END AS match_confidence,
    CASE
      WHEN s.inferred_product_id IS NULL THEN 'Cannot infer product_id from order_details or single-product pending_order_items'
      WHEN s.exact_ship_date_count = 1 THEN 'Unique lead_id + product_id + ship_date(next_ship_date) match'
      WHEN s.exact_ship_date_count > 1 THEN 'Multiple client_products match lead_id + product_id + ship_date'
      WHEN s.candidate_count > 0 THEN 'lead_id + product_id matched, but ship_date does not match client_products.next_ship_date'
      ELSE 'No client_products match on lead_id + inferred product_id'
    END AS reason,
    s.candidate_count,
    s.exact_ship_date_count
  FROM scored s
  LEFT JOIN products p ON p.id = s.inferred_product_id
)
SELECT
  pending_order_id,
  patient_name,
  pending_order_ship_date,
  pending_order_status,
  pending_order_product_id,
  pending_order_product_name,
  current_client_product_id,
  matched_client_product_id_candidate,
  match_confidence,
  reason,
  candidate_count,
  exact_ship_date_count
FROM diagnostic_rows
ORDER BY
  CASE match_confidence
    WHEN 'exact' THEN 1
    WHEN 'ambiguous' THEN 2
    ELSE 3
  END,
  pending_order_ship_date,
  patient_name,
  pending_order_id;

-- Optional summary counts
WITH diag AS (
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
      COALESCE(
        oo.product_id_from_details,
        CASE WHEN pp.poi_distinct_product_count = 1 THEN pp.poi_single_product_id ELSE NULL END
      ) AS inferred_product_id
    FROM orphan_orders oo
    LEFT JOIN poi_products pp ON pp.pending_order_id = oo.pending_order_id
  ),
  scored AS (
    SELECT
      oe.pending_order_id,
      COUNT(cp.id) AS candidate_count,
      COUNT(cp.id) FILTER (WHERE cp.next_ship_date IS NOT DISTINCT FROM oe.ship_date) AS exact_ship_date_count,
      oe.inferred_product_id
    FROM orphan_enriched oe
    LEFT JOIN client_products cp
      ON cp.lead_id = oe.lead_id
     AND cp.product_id = oe.inferred_product_id
    GROUP BY oe.pending_order_id, oe.inferred_product_id
  )
  SELECT
    pending_order_id,
    CASE
      WHEN inferred_product_id IS NULL THEN 'no_match'
      WHEN exact_ship_date_count = 1 THEN 'exact'
      WHEN exact_ship_date_count > 1 THEN 'ambiguous'
      WHEN candidate_count > 0 THEN 'ambiguous'
      ELSE 'no_match'
    END AS match_confidence
  FROM scored
)
SELECT
  COUNT(*) AS total_orphaned_before,
  COUNT(*) FILTER (WHERE match_confidence = 'exact') AS safe_repaired,
  COUNT(*) FILTER (WHERE match_confidence = 'ambiguous') AS ambiguous,
  COUNT(*) FILTER (WHERE match_confidence = 'no_match') AS no_match,
  COUNT(*) FILTER (WHERE match_confidence <> 'exact') AS orphaned_after_if_safe_repair_only
FROM diag;
