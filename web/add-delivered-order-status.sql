-- Adds a delivery confirmation timestamp for pending_orders.
-- The existing status column is TEXT, so it already supports the 'delivered' value.

BEGIN;

ALTER TABLE public.pending_orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pending_orders_delivered_at
  ON public.pending_orders (delivered_at DESC)
  WHERE status = 'delivered';

COMMIT;