-- AllMedical Leads and Clients Database Schema
-- Run this in your Supabase SQL Editor

-- Drop existing table if it exists (this will delete any existing data)
DROP TABLE IF EXISTS leads CASCADE;

-- Create leads table
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  insurance TEXT NOT NULL,
  notes TEXT,
  stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'called', 'reached', 'unqualified', 'qualified')),
  qualified_at TIMESTAMP WITH TIME ZONE,
  product_needed TEXT,
  date_shipped DATE,
  shipping_duration TEXT CHECK (shipping_duration IN ('1_month', '3_month')),
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on stage for faster filtering
CREATE INDEX idx_leads_stage ON leads(stage);

-- Create index on created_at for sorting
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since we're using service role or anon key)
-- You can make this more restrictive based on your needs
CREATE POLICY "Allow all operations on leads" ON leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  fax TEXT NOT NULL,
  npi_number TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
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

-- Create updated_at trigger for doctors
CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
