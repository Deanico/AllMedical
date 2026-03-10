-- Add shipping_duration column to leads table
-- Run this in your Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS shipping_duration TEXT 
CHECK (shipping_duration IN ('1_month', '3_month'));

-- Add comment for clarity
COMMENT ON COLUMN leads.shipping_duration IS 'Duration of product shipment: 1_month or 3_month';
