-- Add first_name and last_name fields to doctors table
-- This allows us to use structured name data from NPPES directly
-- Run this in your Supabase SQL Editor

ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Add helpful comments
COMMENT ON COLUMN doctors.first_name IS 'Doctor first name from NPPES data';
COMMENT ON COLUMN doctors.last_name IS 'Doctor last name from NPPES data';

-- Optionally backfill existing records if needed
-- UPDATE doctors 
-- SET first_name = split_part(full_name, ' ', 1),
--     last_name = split_part(full_name, ' ', -1)
-- WHERE first_name IS NULL AND last_name IS NULL;
