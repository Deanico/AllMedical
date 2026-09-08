-- Mark August 2026 orders as delivered for all clients except the listed exclusions.
-- Run in the Supabase SQL Editor after reviewing the preview query.

BEGIN;

-- Preview the rows that will be changed.
SELECT
  po.id,
  l.name AS patient_name,
  po.ship_date,
  po.status,
  po.tracking_number,
  po.delivered_at
FROM public.pending_orders po
JOIN public.leads l ON l.id = po.lead_id
WHERE po.ship_date >= DATE '2026-08-01'
  AND po.ship_date < DATE '2026-09-01'
  AND po.status <> 'cancelled'
  AND NOT (LOWER(l.name) ~ '(^|[[:space:]])(genevieve|fulmer|tammy|carter)([[:space:]]|$)')
ORDER BY po.ship_date, l.name;

-- Apply the delivery status while preserving any existing delivered timestamp.
UPDATE public.pending_orders po
SET
  status = 'delivered',
  delivered_at = COALESCE(po.delivered_at, NOW())
FROM public.leads l
WHERE l.id = po.lead_id
  AND po.ship_date >= DATE '2026-08-01'
  AND po.ship_date < DATE '2026-09-01'
  AND po.status <> 'cancelled'
  AND NOT (LOWER(l.name) ~ '(^|[[:space:]])(genevieve|fulmer|tammy|carter)([[:space:]]|$)');

SELECT
  COUNT(*) AS marked_delivered
FROM public.pending_orders po
JOIN public.leads l ON l.id = po.lead_id
WHERE po.ship_date >= DATE '2026-08-01'
  AND po.ship_date < DATE '2026-09-01'
  AND po.status = 'delivered'
  AND NOT (LOWER(l.name) ~ '(^|[[:space:]])(genevieve|fulmer|tammy|carter)([[:space:]]|$)');

COMMIT;
