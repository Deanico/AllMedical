-- Add Custom Data Tables for Reports
CREATE TABLE IF NOT EXISTS custom_data_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_table_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES custom_data_tables(id) ON DELETE CASCADE,
  column_name VARCHAR(255) NOT NULL,
  column_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_table_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES custom_data_tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  row_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_tables_created_at ON custom_data_tables(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_table_columns_table_id ON custom_table_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_custom_table_rows_table_id ON custom_table_rows(table_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_custom_data_tables_updated_at BEFORE UPDATE ON custom_data_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_table_rows_updated_at BEFORE UPDATE ON custom_table_rows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
