-- Add Doctors table for tracking client doctors
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  fax TEXT NOT NULL,
  npi_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on client_id for faster lookups
CREATE INDEX idx_doctors_client_id ON doctors(client_id);

-- Enable Row Level Security for doctors
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations on doctors
CREATE POLICY "Allow all operations on doctors" ON doctors
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger for doctors (reuses existing function)
CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
