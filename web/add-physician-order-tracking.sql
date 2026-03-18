-- Add physician order tracking fields to leads table
-- Run this in your Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS physician_order_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS physician_order_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS physician_order_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS physician_order_file_url TEXT;

-- Add helpful comments
COMMENT ON COLUMN leads.physician_order_generated_at IS 'When the physician order PDF was generated';
COMMENT ON COLUMN leads.physician_order_sent_at IS 'When the physician order was sent to the doctor';
COMMENT ON COLUMN leads.physician_order_received_at IS 'When the signed physician order was received back';
COMMENT ON COLUMN leads.physician_order_file_url IS 'URL/path to the generated physician order PDF';
