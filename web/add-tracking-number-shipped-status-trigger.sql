-- When shipment automation records a tracking number, mark the order shipped.
-- This applies only to orders still in the ordered stage and preserves final states.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_order_shipped_when_tracking_added()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ordered'
     AND NULLIF(BTRIM(NEW.tracking_number), '') IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number) THEN
    NEW.status := 'shipped';
    NEW.shipped_at := COALESCE(NEW.shipped_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_orders_mark_shipped_when_tracking_added ON public.pending_orders;

CREATE TRIGGER trg_pending_orders_mark_shipped_when_tracking_added
BEFORE INSERT OR UPDATE OF tracking_number ON public.pending_orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_order_shipped_when_tracking_added();

COMMIT;