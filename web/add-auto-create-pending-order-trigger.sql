-- Automatically create a pending order when an active client's assigned product
-- is due. A product is considered due when its next ship date is today or within
-- the next seven days.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_pending_order_for_due_client_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_order_id UUID;
  product_name TEXT;
  patient_name TEXT;
  client_is_active BOOLEAN;
BEGIN
  IF NEW.active IS DISTINCT FROM true
     OR NEW.next_ship_date IS NULL
     OR NEW.next_ship_date > CURRENT_DATE + 7 THEN
    RETURN NEW;
  END IF;

  SELECT p.name, l.name, l.stage = 'qualified' AND COALESCE(l.is_paused, false) = false
  INTO product_name, patient_name, client_is_active
  FROM products p
  JOIN leads l ON l.id = NEW.lead_id
  WHERE p.id = NEW.product_id;

  IF product_name IS NULL OR client_is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT po.id
  INTO pending_order_id
  FROM pending_orders po
  WHERE po.client_product_id = NEW.id
    AND po.ship_date = NEW.next_ship_date
    AND po.status IN ('pending', 'reviewed', 'ready_to_order', 'ordered', 'shipped')
  ORDER BY po.created_at DESC
  LIMIT 1;

  IF pending_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO pending_orders (
    lead_id,
    client_product_id,
    ship_date,
    status,
    order_details
  )
  VALUES (
    NEW.lead_id,
    NEW.id,
    NEW.next_ship_date,
    'pending',
    jsonb_build_object(
      'patient_name', patient_name,
      'product_name', product_name,
      'product_id', NEW.product_id,
      'quantity', COALESCE(NEW.quantity, 1),
      'ship_date', NEW.next_ship_date,
      'auto_generated', true
    )
  )
  RETURNING id INTO pending_order_id;

  INSERT INTO pending_order_items (pending_order_id, product_id, quantity)
  VALUES (pending_order_id, NEW.product_id, COALESCE(NEW.quantity, 1));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pending_order_for_due_client_product ON public.client_products;

CREATE TRIGGER trg_create_pending_order_for_due_client_product
AFTER INSERT OR UPDATE OF active, auto_ship_enabled, next_ship_date, quantity, product_id
ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.create_pending_order_for_due_client_product();

-- Re-evaluate currently due assignments so existing rows are backfilled too.
-- The trigger's duplicate guard makes this safe to run more than once.
UPDATE public.client_products cp
SET next_ship_date = cp.next_ship_date
FROM public.leads l
WHERE l.id = cp.lead_id
  AND cp.active = true
  AND l.stage = 'qualified'
  AND COALESCE(l.is_paused, false) = false
  AND cp.next_ship_date <= CURRENT_DATE + 7;

COMMIT;