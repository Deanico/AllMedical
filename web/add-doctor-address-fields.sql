-- Add address fields to doctors table for physician orders
-- Run this in your Supabase SQL Editor

ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add comments for clarity
COMMENT ON COLUMN doctors.address_line1 IS 'Street address for physician orders';
COMMENT ON COLUMN doctors.city IS 'City for physician orders';
COMMENT ON COLUMN doctors.state IS 'State for physician orders';
COMMENT ON COLUMN doctors.zip_code IS 'ZIP code for physician orders';
COMMENT ON COLUMN doctors.phone IS 'Primary phone number';
