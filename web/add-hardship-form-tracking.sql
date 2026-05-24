-- Add hardship form tracking fields to leads table
-- Separate workflow from physician orders and treatment records

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS hardship_form_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hardship_form_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hardship_form_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hardship_form_file_url TEXT;

COMMENT ON COLUMN leads.hardship_form_generated_at IS 'When the hardship form document was generated';
COMMENT ON COLUMN leads.hardship_form_sent_at IS 'When the hardship form was sent to the patient';
COMMENT ON COLUMN leads.hardship_form_received_at IS 'When the signed/completed hardship form was received back';
COMMENT ON COLUMN leads.hardship_form_file_url IS 'URL/path to the uploaded hardship form file';
