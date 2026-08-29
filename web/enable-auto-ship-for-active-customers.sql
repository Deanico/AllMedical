-- Enable the 80-day patient auto-ship cycle for all active customers.
-- Active customers are qualified, non-paused patients, matching the app's
-- existing active-client definition.

BEGIN;

UPDATE public.leads
SET auto_ship_enabled = true
WHERE stage = 'qualified'
  AND COALESCE(is_paused, false) = false;

COMMIT;

-- Verification
SELECT
  COUNT(*) AS active_customers_with_auto_ship
FROM public.leads
WHERE stage = 'qualified'
  AND COALESCE(is_paused, false) = false
  AND auto_ship_enabled = true;
