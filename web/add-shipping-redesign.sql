-- Shipping Redesign: Add next_ship_date column to client_products
-- This replaces the frequency-based shipping system with per-product date scheduling

BEGIN;

-- Add next_ship_date column if it doesn't exist
ALTER TABLE client_products
ADD COLUMN IF NOT EXISTS next_ship_date DATE;

-- Set default value for existing records (today's date for initial setup)
UPDATE client_products
SET next_ship_date = CURRENT_DATE
WHERE next_ship_date IS NULL;

-- Make next_ship_date NOT NULL after backfill
ALTER TABLE client_products
ALTER COLUMN next_ship_date SET NOT NULL;

-- Create index on next_ship_date for efficient calendar queries
CREATE INDEX IF NOT EXISTS idx_client_products_next_ship_date 
ON client_products(next_ship_date);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_client_products_lead_next_ship
ON client_products(lead_id, next_ship_date);

COMMIT;
