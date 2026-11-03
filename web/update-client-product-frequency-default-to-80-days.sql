-- Use each client product's frequency as its exact shipping interval.
-- Run after the existing shipping automation migrations.

BEGIN;

ALTER TABLE public.client_products
  ALTER COLUMN frequency_days SET DEFAULT 80;

UPDATE public.client_products
SET frequency_days = 80
WHERE frequency_days IS NULL OR frequency_days <= 0;

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

COMMIT;
