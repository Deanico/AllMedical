-- Derive a patient's Shipments Automated (S.A) status from tracking-proven active products.
-- Run once in the Supabase SQL Editor after add-pending-orders-client-product-link.sql.

BEGIN;

ALTER TABLE public.client_products
  ADD COLUMN IF NOT EXISTS auto_ship_enabled BOOLEAN DEFAULT false;

-- A product is supplier-automated only after an order for that linked product
-- has received a tracking number. This corrects the legacy true-by-default flag.
UPDATE public.client_products
SET auto_ship_enabled = EXISTS (
  SELECT 1
  FROM public.pending_orders po
  WHERE po.client_product_id = client_products.id
    AND NULLIF(BTRIM(po.tracking_number), '') IS NOT NULL
);

ALTER TABLE public.client_products
  ALTER COLUMN auto_ship_enabled SET DEFAULT false;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS auto_ship_enabled BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_lead_shipments_automated(lead_id_to_sync uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.leads l
  SET auto_ship_enabled = EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.lead_id = lead_id_to_sync
      AND cp.active = true
    GROUP BY cp.lead_id
    HAVING BOOL_AND(COALESCE(cp.auto_ship_enabled, false))
  )
  WHERE l.id = lead_id_to_sync;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lead_shipments_automated_from_product()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_lead_shipments_automated(OLD.lead_id);
  ELSE
    PERFORM public.sync_lead_shipments_automated(NEW.lead_id);

    IF TG_OP = 'UPDATE' AND OLD.lead_id IS DISTINCT FROM NEW.lead_id THEN
      PERFORM public.sync_lead_shipments_automated(OLD.lead_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_shipments_automated ON public.client_products;

CREATE TRIGGER trg_sync_lead_shipments_automated
AFTER INSERT OR UPDATE OF lead_id, active, auto_ship_enabled OR DELETE
ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_shipments_automated_from_product();

CREATE OR REPLACE FUNCTION public.enable_product_autoship_when_tracking_added()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_product_id IS NOT NULL
     AND NULLIF(BTRIM(NEW.tracking_number), '') IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number) THEN
    UPDATE public.client_products
    SET auto_ship_enabled = true
    WHERE id = NEW.client_product_id
      AND active = true
      AND COALESCE(auto_ship_enabled, false) = false;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enable_product_autoship_when_tracking_added ON public.pending_orders;

CREATE TRIGGER trg_enable_product_autoship_when_tracking_added
AFTER INSERT OR UPDATE OF tracking_number ON public.pending_orders
FOR EACH ROW
EXECUTE FUNCTION public.enable_product_autoship_when_tracking_added();

-- An ordered product always receives its next shipment date 80 days later.
-- This schedule is independent of whether its supplier shipping is automated.
CREATE OR REPLACE FUNCTION public.handle_pending_order_ordered()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_date date;
BEGIN
  IF NEW.status IS DISTINCT FROM 'ordered' OR NEW.client_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'ordered'
     AND OLD.order_placed_at IS NOT DISTINCT FROM NEW.order_placed_at
     AND OLD.client_product_id IS NOT DISTINCT FROM NEW.client_product_id THEN
    RETURN NEW;
  END IF;

  order_date := COALESCE(NEW.order_placed_at::date, CURRENT_DATE);

  UPDATE public.client_products
  SET next_ship_date = order_date + 80
  WHERE id = NEW.client_product_id;

  RETURN NEW;
END;
$$;

-- Bring all existing customer statuses into agreement with their active products.
UPDATE public.leads l
SET auto_ship_enabled = EXISTS (
  SELECT 1
  FROM public.client_products cp
  WHERE cp.lead_id = l.id
    AND cp.active = true
  GROUP BY cp.lead_id
  HAVING BOOL_AND(COALESCE(cp.auto_ship_enabled, false))
);

COMMIT;

-- Verification: this should return zero rows.
SELECT
  l.id,
  l.name,
  l.auto_ship_enabled AS stored_status,
  EXISTS (
    SELECT 1
    FROM public.client_products cp
    WHERE cp.lead_id = l.id
      AND cp.active = true
    GROUP BY cp.lead_id
    HAVING BOOL_AND(COALESCE(cp.auto_ship_enabled, false))
  ) AS expected_status
FROM public.leads l
WHERE l.auto_ship_enabled IS DISTINCT FROM EXISTS (
  SELECT 1
  FROM public.client_products cp
  WHERE cp.lead_id = l.id
    AND cp.active = true
  GROUP BY cp.lead_id
  HAVING BOOL_AND(COALESCE(cp.auto_ship_enabled, false))
);
