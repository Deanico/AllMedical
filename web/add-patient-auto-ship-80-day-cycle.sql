-- Adds patient auto-ship support and sets the default shipment cycle to 80 days.
-- Run this migration after the existing shipping automation migrations.

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS auto_ship_enabled BOOLEAN DEFAULT false;

UPDATE public.leads
SET auto_ship_enabled = false
WHERE auto_ship_enabled IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN auto_ship_enabled SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_pending_order_ordered()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_date date;
  frequency_days numeric;
  days_to_add integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ordered' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'ordered'
     AND OLD.order_placed_at IS NOT DISTINCT FROM NEW.order_placed_at
     AND OLD.client_product_id IS NOT DISTINCT FROM NEW.client_product_id THEN
    RETURN NEW;
  END IF;

  IF NEW.client_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  order_date := COALESCE(NEW.order_placed_at::date, CURRENT_DATE);

  SELECT cp.frequency_days
  INTO frequency_days
  FROM public.client_products cp
  WHERE cp.id = NEW.client_product_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF frequency_days IS NOT NULL AND frequency_days > 0 THEN
    days_to_add := frequency_days::integer;
  ELSE
    days_to_add := 80;
  END IF;

  UPDATE public.client_products
  SET next_ship_date = order_date + days_to_add
  WHERE id = NEW.client_product_id;

  RETURN NEW;
END;
$$;

-- Backfill the latest ordered cycle for each linked product ordered in the
-- previous 14 days. The 80-day cycle is measured from order_placed_at.
WITH recent_order AS (
  SELECT DISTINCT ON (po.client_product_id)
    po.client_product_id,
    (
      COALESCE(po.order_placed_at, po.created_at)::date
      + CASE WHEN cp.frequency_days > 0 THEN cp.frequency_days ELSE 80 END
    )::date AS next_ship_date
  FROM public.pending_orders po
  JOIN public.client_products cp ON cp.id = po.client_product_id
  WHERE po.status = 'ordered'
    AND po.client_product_id IS NOT NULL
    AND COALESCE(po.order_placed_at, po.created_at) >= NOW() - INTERVAL '14 days'
  ORDER BY po.client_product_id, COALESCE(po.order_placed_at, po.created_at) DESC, po.id DESC
)
UPDATE public.client_products cp
SET next_ship_date = recent_order.next_ship_date
FROM recent_order
WHERE cp.id = recent_order.client_product_id;

COMMIT;