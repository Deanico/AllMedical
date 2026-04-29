-- Migration: link pending_orders to client_products and prevent duplicate scheduled orders
-- Requirements covered:
-- 1) add client_products.auto_ship_enabled
-- 2) add pending_orders.client_product_id FK -> client_products.id
-- 3) add pending_orders.ship_date if missing
-- 4) add unique duplicate-prevention index
-- 5) backfill pending_orders.client_product_id when lead_id + product_id are available
-- 6) no columns are removed or renamed

BEGIN;

-- 1) client_products.auto_ship_enabled BOOLEAN DEFAULT true
ALTER TABLE IF EXISTS client_products
  ADD COLUMN IF NOT EXISTS auto_ship_enabled BOOLEAN DEFAULT true;

-- Backfill nulls and enforce default for future rows
UPDATE client_products
SET auto_ship_enabled = true
WHERE auto_ship_enabled IS NULL;

ALTER TABLE IF EXISTS client_products
  ALTER COLUMN auto_ship_enabled SET DEFAULT true;

-- 2) pending_orders.client_product_id UUID referencing client_products.id
ALTER TABLE IF EXISTS pending_orders
  ADD COLUMN IF NOT EXISTS client_product_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pending_orders'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_orders' AND column_name = 'client_product_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_products'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'pending_orders'
      AND constraint_name = 'fk_pending_orders_client_product'
  ) THEN
    ALTER TABLE pending_orders
      ADD CONSTRAINT fk_pending_orders_client_product
      FOREIGN KEY (client_product_id)
      REFERENCES client_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) pending_orders.ship_date DATE if missing
ALTER TABLE IF EXISTS pending_orders
  ADD COLUMN IF NOT EXISTS ship_date DATE;

-- 5) Backfill pending_orders.client_product_id by lead_id + product_id when possible
DO $$
DECLARE
  pending_has_lead_id BOOLEAN;
  pending_has_product_id BOOLEAN;
  pending_has_client_product_id BOOLEAN;
  client_has_lead_id BOOLEAN;
  client_has_product_id BOOLEAN;
  poi_table_exists BOOLEAN;
  poi_has_pending_order_id BOOLEAN;
  poi_has_product_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_orders' AND column_name = 'lead_id'
  ) INTO pending_has_lead_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_orders' AND column_name = 'product_id'
  ) INTO pending_has_product_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_orders' AND column_name = 'client_product_id'
  ) INTO pending_has_client_product_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_products' AND column_name = 'lead_id'
  ) INTO client_has_lead_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_products' AND column_name = 'product_id'
  ) INTO client_has_product_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pending_order_items'
  ) INTO poi_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_order_items' AND column_name = 'pending_order_id'
  ) INTO poi_has_pending_order_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_order_items' AND column_name = 'product_id'
  ) INTO poi_has_product_id;

  IF pending_has_lead_id
     AND pending_has_product_id
     AND pending_has_client_product_id
     AND client_has_lead_id
     AND client_has_product_id THEN

    WITH ranked_matches AS (
      SELECT
        po.id AS pending_order_id,
        cp.id AS matched_client_product_id,
        ROW_NUMBER() OVER (
          PARTITION BY po.id
          ORDER BY cp.active DESC, cp.updated_at DESC NULLS LAST, cp.created_at DESC NULLS LAST
        ) AS rn
      FROM pending_orders po
      JOIN client_products cp
        ON cp.lead_id = po.lead_id
       AND cp.product_id = po.product_id
      WHERE po.client_product_id IS NULL
    )
    UPDATE pending_orders po
    SET client_product_id = rm.matched_client_product_id
    FROM ranked_matches rm
    WHERE po.id = rm.pending_order_id
      AND rm.rn = 1;
  ELSIF pending_has_lead_id
     AND pending_has_client_product_id
     AND client_has_lead_id
     AND client_has_product_id
     AND poi_table_exists
     AND poi_has_pending_order_id
     AND poi_has_product_id THEN

    WITH ranked_matches AS (
      SELECT
        po.id AS pending_order_id,
        cp.id AS matched_client_product_id,
        ROW_NUMBER() OVER (
          PARTITION BY po.id
          ORDER BY cp.active DESC, cp.updated_at DESC NULLS LAST, cp.created_at DESC NULLS LAST
        ) AS rn
      FROM pending_orders po
      JOIN pending_order_items poi
        ON poi.pending_order_id = po.id
      JOIN client_products cp
        ON cp.lead_id = po.lead_id
       AND cp.product_id = poi.product_id
      WHERE po.client_product_id IS NULL
    )
    UPDATE pending_orders po
    SET client_product_id = rm.matched_client_product_id
    FROM ranked_matches rm
    WHERE po.id = rm.pending_order_id
      AND rm.rn = 1;
  END IF;
END $$;

-- 4) Prevent duplicates for active queue states by client_product_id + ship_date
-- Using a partial unique index avoids conflicts with shipped/cancelled history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_orders_client_product_ship_date_active
ON pending_orders(client_product_id, ship_date)
WHERE client_product_id IS NOT NULL
  AND ship_date IS NOT NULL
  AND status IN ('pending', 'reviewed', 'ordered');

COMMIT;
