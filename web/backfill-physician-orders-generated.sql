-- Backfill physician_order_generated_at for existing clients who already have generated orders
-- Run this ONCE in your Supabase SQL Editor

UPDATE leads 
SET physician_order_generated_at = '2026-03-18 12:00:00+00'
WHERE physician_order_generated_at IS NULL
  AND name NOT IN ('Royle', 'Jamie', 'Kaitlyn', 'John Morgan');

-- Verify the update
SELECT 
  name,
  physician_order_generated_at,
  email
FROM leads
ORDER BY 
  physician_order_generated_at DESC NULLS LAST,
  name;
