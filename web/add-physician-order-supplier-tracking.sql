-- Track which supplier was used when a physician order is generated.
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS physician_order_supplier text;

-- Optional: enforce known values for consistency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_physician_order_supplier_check'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_physician_order_supplier_check
    CHECK (physician_order_supplier IS NULL OR physician_order_supplier IN ('all_medical', 'solution8'));
  END IF;
END $$;
