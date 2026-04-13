-- Backfill physician order insurance phases for existing leads
-- Run this ONCE in your Supabase SQL Editor

-- Phase 4 backfill:
-- If signed physician order was already received, assume it was ready to send to insurance
-- and set physician_order_sent_to_insurance_at to the same timestamp (only when empty).
UPDATE leads
SET physician_order_sent_to_insurance_at = physician_order_received_at
WHERE physician_order_received_at IS NOT NULL
  AND physician_order_sent_to_insurance_at IS NULL;

-- Phase 5 is intentionally NOT auto-filled to avoid false positives.
-- If you want to backfill phase 5 for specific clients, run targeted updates like:
-- UPDATE leads
-- SET physician_order_insurance_received_at = NOW()
-- WHERE id = 'REPLACE_WITH_LEAD_UUID';

-- Verify results
SELECT
  name,
  physician_order_generated_at,
  physician_order_sent_at,
  physician_order_received_at,
  physician_order_sent_to_insurance_at,
  physician_order_insurance_received_at
FROM leads
ORDER BY
  physician_order_sent_to_insurance_at DESC NULLS LAST,
  name;
