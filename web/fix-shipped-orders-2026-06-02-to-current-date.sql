-- One-time repair follow-up for shipped orders after the original 2026-05-22 to 2026-06-01 repair.
-- Recomputes next_ship_date using:
--   floor((quantity * products.days_per_unit) - 2)
-- with fallbacks to frequency_days, then 90-day default.
--
-- Target window (inclusive): 2026-06-02 to CURRENT_DATE
--
-- Safety rules:
-- 1) Only the most recent shipped order in-range per client_product is considered.
-- 2) client_products is only updated when last_ship_date matches that shipped date.
-- 3) Open pending orders are only moved when their ship_date equals the old next_ship_date.
--
-- Run this after fix-shipped-orders-2026-05-22-to-2026-06-01.sql
-- to extend repair coverage through today.

BEGIN;

-- Preview rows that will be recalculated before applying updates.
WITH params AS (
  SELECT DATE '2026-06-02' AS start_date, CURRENT_DATE AS end_date
), shipped_in_range AS (
  SELECT
    po.id AS pending_order_id,
    po.client_product_id,
    po.shipped_at,
    (po.shipped_at AT TIME ZONE 'UTC')::date AS shipped_date,
    ROW_NUMBER() OVER (
      PARTITION BY po.client_product_id
      ORDER BY po.shipped_at DESC, po.id DESC
    ) AS rn
  FROM pending_orders po
  CROSS JOIN params p
  WHERE po.status = 'shipped'
    AND po.client_product_id IS NOT NULL
    AND (po.shipped_at AT TIME ZONE 'UTC')::date BETWEEN p.start_date AND p.end_date
), latest_shipped AS (
  SELECT *
  FROM shipped_in_range
  WHERE rn = 1
), shipment_basis AS (
  SELECT
    ls.pending_order_id,
    ls.client_product_id,
    ls.shipped_date,
    cp.last_ship_date,
    cp.next_ship_date AS old_next_ship_date,
    cp.quantity AS cp_quantity,
    cp.frequency_days,
    p.days_per_unit,
    poi.shipped_quantity,
    COALESCE(poi.shipped_quantity, cp.quantity) AS effective_quantity
  FROM latest_shipped ls
  JOIN client_products cp ON cp.id = ls.client_product_id
  LEFT JOIN products p ON p.id = cp.product_id
  LEFT JOIN (
    SELECT
      poi.pending_order_id,
      SUM(poi.quantity)::numeric AS shipped_quantity
    FROM pending_order_items poi
    GROUP BY poi.pending_order_id
  ) poi ON poi.pending_order_id = ls.pending_order_id
), computed AS (
  SELECT
    sb.*,
    CASE
      WHEN sb.effective_quantity IS NOT NULL
           AND sb.effective_quantity > 0
           AND sb.days_per_unit IS NOT NULL
           AND sb.days_per_unit > 0
        THEN (sb.effective_quantity * sb.days_per_unit)
      WHEN sb.frequency_days IS NOT NULL
           AND sb.frequency_days > 0
        THEN sb.frequency_days::numeric
      ELSE 90::numeric
    END AS supply_days,
    GREATEST(
      1,
      FLOOR(
        CASE
          WHEN sb.effective_quantity IS NOT NULL
               AND sb.effective_quantity > 0
               AND sb.days_per_unit IS NOT NULL
               AND sb.days_per_unit > 0
            THEN (sb.effective_quantity * sb.days_per_unit) - 2
          WHEN sb.frequency_days IS NOT NULL
               AND sb.frequency_days > 0
            THEN sb.frequency_days::numeric - 2
          ELSE 88::numeric
        END
      )::int
    ) AS days_to_add
  FROM shipment_basis sb
), target_rows AS (
  SELECT
    c.*,
    (c.shipped_date + c.days_to_add)::date AS corrected_next_ship_date
  FROM computed c
)
SELECT
  pending_order_id,
  client_product_id,
  shipped_date,
  last_ship_date,
  old_next_ship_date,
  corrected_next_ship_date,
  effective_quantity,
  days_per_unit,
  frequency_days,
  supply_days,
  days_to_add
FROM target_rows
ORDER BY shipped_date, client_product_id;

-- Apply repair.
WITH params AS (
  SELECT DATE '2026-06-02' AS start_date, CURRENT_DATE AS end_date
), shipped_in_range AS (
  SELECT
    po.id AS pending_order_id,
    po.client_product_id,
    po.shipped_at,
    (po.shipped_at AT TIME ZONE 'UTC')::date AS shipped_date,
    ROW_NUMBER() OVER (
      PARTITION BY po.client_product_id
      ORDER BY po.shipped_at DESC, po.id DESC
    ) AS rn
  FROM pending_orders po
  CROSS JOIN params p
  WHERE po.status = 'shipped'
    AND po.client_product_id IS NOT NULL
    AND (po.shipped_at AT TIME ZONE 'UTC')::date BETWEEN p.start_date AND p.end_date
), latest_shipped AS (
  SELECT *
  FROM shipped_in_range
  WHERE rn = 1
), shipment_basis AS (
  SELECT
    ls.pending_order_id,
    ls.client_product_id,
    ls.shipped_date,
    cp.last_ship_date,
    cp.next_ship_date AS old_next_ship_date,
    cp.quantity AS cp_quantity,
    cp.frequency_days,
    p.days_per_unit,
    poi.shipped_quantity,
    COALESCE(poi.shipped_quantity, cp.quantity) AS effective_quantity
  FROM latest_shipped ls
  JOIN client_products cp ON cp.id = ls.client_product_id
  LEFT JOIN products p ON p.id = cp.product_id
  LEFT JOIN (
    SELECT
      poi.pending_order_id,
      SUM(poi.quantity)::numeric AS shipped_quantity
    FROM pending_order_items poi
    GROUP BY poi.pending_order_id
  ) poi ON poi.pending_order_id = ls.pending_order_id
), computed AS (
  SELECT
    sb.*,
    GREATEST(
      1,
      FLOOR(
        CASE
          WHEN sb.effective_quantity IS NOT NULL
               AND sb.effective_quantity > 0
               AND sb.days_per_unit IS NOT NULL
               AND sb.days_per_unit > 0
            THEN (sb.effective_quantity * sb.days_per_unit) - 2
          WHEN sb.frequency_days IS NOT NULL
               AND sb.frequency_days > 0
            THEN sb.frequency_days::numeric - 2
          ELSE 88::numeric
        END
      )::int
    ) AS days_to_add
  FROM shipment_basis sb
), target_rows AS (
  SELECT
    c.pending_order_id,
    c.client_product_id,
    c.shipped_date,
    c.last_ship_date,
    c.old_next_ship_date,
    (c.shipped_date + c.days_to_add)::date AS corrected_next_ship_date
  FROM computed c
), updated_client_products AS (
  UPDATE client_products cp
  SET
    next_ship_date = tr.corrected_next_ship_date
  FROM target_rows tr
  WHERE cp.id = tr.client_product_id
    AND cp.last_ship_date = tr.shipped_date
    AND cp.next_ship_date IS DISTINCT FROM tr.corrected_next_ship_date
  RETURNING
    cp.id AS client_product_id,
    tr.pending_order_id,
    tr.shipped_date,
    tr.old_next_ship_date,
    tr.corrected_next_ship_date
), updated_open_orders AS (
  UPDATE pending_orders po
  SET ship_date = ucp.corrected_next_ship_date
  FROM updated_client_products ucp
  WHERE po.client_product_id = ucp.client_product_id
    AND po.status IN ('pending', 'reviewed', 'ordered')
    AND po.ship_date = ucp.old_next_ship_date
  RETURNING po.id
)
SELECT
  (SELECT COUNT(*) FROM updated_client_products) AS updated_client_products_count,
  (SELECT COUNT(*) FROM updated_open_orders) AS updated_open_orders_count;

COMMIT;
