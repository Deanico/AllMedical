-- Patch: prevent duplicate active queue rows for the same client_product_id + ship_date
-- 1) Cancel older duplicate active rows so index creation succeeds.
-- 2) Recreate unique guard to include ready_to_order.

BEGIN;

WITH ranked_active AS (
  SELECT
    po.id,
    ROW_NUMBER() OVER (
      PARTITION BY po.client_product_id, po.ship_date
      ORDER BY po.created_at DESC, po.id DESC
    ) AS rn
  FROM pending_orders po
  WHERE po.client_product_id IS NOT NULL
    AND po.ship_date IS NOT NULL
    AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered')
), duplicates_to_cancel AS (
  SELECT id
  FROM ranked_active
  WHERE rn > 1
)
UPDATE pending_orders po
SET
  status = 'cancelled',
  notes = TRIM(BOTH ' ' FROM CONCAT_WS(' | ', NULLIF(po.notes, ''), 'Auto-cancelled duplicate active queue row during guard patch.'))
FROM duplicates_to_cancel d
WHERE po.id = d.id;

DROP INDEX IF EXISTS uq_pending_orders_client_product_ship_date_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_orders_client_product_ship_date_active
ON pending_orders(client_product_id, ship_date)
WHERE client_product_id IS NOT NULL
  AND ship_date IS NOT NULL
  AND status IN ('pending', 'reviewed', 'ready_to_order', 'ordered');

COMMIT;
