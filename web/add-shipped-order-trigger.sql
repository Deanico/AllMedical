-- Trigger: when a pending order is marked ordered, update the linked client_product schedule.
-- Logic: next_ship_date = order_date + frequency_days, defaulting to 80 days.

BEGIN;

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
  FROM client_products cp
  WHERE cp.id = NEW.client_product_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF frequency_days IS NOT NULL AND frequency_days > 0 THEN
    days_to_add := frequency_days::integer;
  ELSE
    days_to_add := 80;
  END IF;

  UPDATE client_products
  SET
    next_ship_date = order_date + days_to_add
  WHERE id = NEW.client_product_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_pending_order_shipped_record_last_ship_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  shipped_date date;
BEGIN
  IF NEW.status IS DISTINCT FROM 'shipped' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'shipped'
     AND OLD.shipped_at IS NOT DISTINCT FROM NEW.shipped_at
     AND OLD.client_product_id IS NOT DISTINCT FROM NEW.client_product_id THEN
    RETURN NEW;
  END IF;

  IF NEW.client_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  shipped_date := COALESCE(NEW.shipped_at::date, CURRENT_DATE);

  UPDATE client_products
  SET last_ship_date = shipped_date
  WHERE id = NEW.client_product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_orders_update_client_product_schedule ON public.pending_orders;
DROP TRIGGER IF EXISTS trg_pending_orders_update_client_product_schedule_on_ordered ON public.pending_orders;
DROP TRIGGER IF EXISTS trg_pending_orders_set_last_ship_date_on_shipped ON public.pending_orders;

CREATE TRIGGER trg_pending_orders_update_client_product_schedule_on_ordered
AFTER INSERT OR UPDATE OF status, order_placed_at ON public.pending_orders
FOR EACH ROW
WHEN (NEW.status = 'ordered' AND NEW.client_product_id IS NOT NULL)
EXECUTE FUNCTION public.handle_pending_order_ordered();

CREATE TRIGGER trg_pending_orders_set_last_ship_date_on_shipped
AFTER INSERT OR UPDATE OF status, shipped_at ON public.pending_orders
FOR EACH ROW
WHEN (NEW.status = 'shipped' AND NEW.client_product_id IS NOT NULL)
EXECUTE FUNCTION public.handle_pending_order_shipped_record_last_ship_date();

COMMIT;