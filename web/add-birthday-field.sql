-- Add birthday field to leads table
ALTER TABLE leads
ADD COLUMN birthday DATE;

-- Add comment
COMMENT ON COLUMN leads.birthday IS 'Patient date of birth';
