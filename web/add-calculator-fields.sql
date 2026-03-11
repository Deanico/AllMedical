-- Add payment calculator fields to leads table
-- These fields store the saved calculator inputs for each patient

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS calc_deductible NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS calc_oop_max NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS calc_percent_allowable NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS calc_insurance_paid NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS calc_product_cost NUMERIC(10, 2);

-- Add helpful comments
COMMENT ON COLUMN leads.calc_deductible IS 'Annual deductible amount for insurance calculator';
COMMENT ON COLUMN leads.calc_oop_max IS 'Annual out-of-pocket maximum for insurance calculator';
COMMENT ON COLUMN leads.calc_percent_allowable IS 'Percentage of allowable amount covered by insurance';
COMMENT ON COLUMN leads.calc_insurance_paid IS 'Monthly amount paid by insurance';
COMMENT ON COLUMN leads.calc_product_cost IS 'Monthly cost of product';
