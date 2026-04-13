-- Add payment status field to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS payment_status TEXT
CHECK (payment_status IN ('paying', 'partially_paying', 'not_paying_yet'));

-- Optional index for filtering/reporting by payment status
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON leads(payment_status);
