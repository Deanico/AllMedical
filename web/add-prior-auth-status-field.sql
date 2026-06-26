-- Add prior auth status tracking for qualified clients
-- Run this in your Supabase SQL Editor

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS prior_auth_status TEXT
CHECK (prior_auth_status IN ('requested', 'approved', 'denied'));

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS prior_auth_start_date DATE,
ADD COLUMN IF NOT EXISTS prior_auth_end_date DATE;

ALTER TABLE leads
DROP CONSTRAINT IF EXISTS chk_leads_prior_auth_date_range;

ALTER TABLE leads
ADD CONSTRAINT chk_leads_prior_auth_date_range
CHECK (
	prior_auth_start_date IS NULL
	OR prior_auth_end_date IS NULL
	OR prior_auth_start_date <= prior_auth_end_date
);

CREATE INDEX IF NOT EXISTS idx_leads_prior_auth_status ON leads(prior_auth_status);

COMMENT ON COLUMN leads.prior_auth_status IS 'Prior authorization status for qualified clients: requested, approved, or denied';
COMMENT ON COLUMN leads.prior_auth_start_date IS 'Prior authorization coverage start date';
COMMENT ON COLUMN leads.prior_auth_end_date IS 'Prior authorization coverage end date';
