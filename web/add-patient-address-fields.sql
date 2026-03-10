-- Add patient address fields to leads table for physician orders
-- Run this in your Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Add comments for clarity
COMMENT ON COLUMN leads.address_line1 IS 'Patient street address for physician orders';
COMMENT ON COLUMN leads.city IS 'Patient city for physician orders';
COMMENT ON COLUMN leads.state IS 'Patient state for physician orders';
COMMENT ON COLUMN leads.zip_code IS 'Patient ZIP code for physician orders';
