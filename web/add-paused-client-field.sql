-- Add paused client support
-- Run this in your Supabase SQL Editor

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;

UPDATE leads
SET is_paused = false
WHERE is_paused IS NULL;

ALTER TABLE leads
ALTER COLUMN is_paused SET DEFAULT false,
ALTER COLUMN is_paused SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_is_paused ON leads(is_paused);
