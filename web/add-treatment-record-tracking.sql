-- Add treatment record tracking fields to leads table
-- Separate workflow from physician order status
-- Run this in your Supabase SQL Editor

-- Insurance detail fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS insurance_id TEXT,
ADD COLUMN IF NOT EXISTS insurance_deductible NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS insurance_oop_max NUMERIC(10,2);

COMMENT ON COLUMN leads.insurance_id IS 'Client insurance member/ID number';
COMMENT ON COLUMN leads.insurance_deductible IS 'Insurance plan deductible amount';
COMMENT ON COLUMN leads.insurance_oop_max IS 'Insurance plan out-of-pocket maximum';

-- Treatment record tracking fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS treatment_record_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS treatment_record_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS treatment_record_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS treatment_record_sent_to_insurance_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS treatment_record_file_url TEXT;

COMMENT ON COLUMN leads.treatment_record_generated_at IS 'When the treatment record document was generated';
COMMENT ON COLUMN leads.treatment_record_sent_at IS 'When the treatment record was sent to the doctor office';
COMMENT ON COLUMN leads.treatment_record_received_at IS 'When the signed treatment record was received back';
COMMENT ON COLUMN leads.treatment_record_sent_to_insurance_at IS 'When the treatment record was sent to insurance (optional)';
COMMENT ON COLUMN leads.treatment_record_file_url IS 'URL/path to the signed treatment record file';
