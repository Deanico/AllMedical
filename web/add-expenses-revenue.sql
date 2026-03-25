-- Add Expenses & Revenue Tracking for Profit & Loss
-- This enables comprehensive financial tracking with expense categories

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  category VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue Tracking Table (complements existing insurance payment data)
CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  source VARCHAR(100) NOT NULL, -- 'insurance', 'direct_payment', 'other'
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_date ON revenue_entries(date);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_client_id ON revenue_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_source ON revenue_entries(source);

-- Function to calculate monthly P&L
CREATE OR REPLACE FUNCTION get_monthly_pnl(target_year INTEGER, target_month INTEGER)
RETURNS TABLE(
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  profit_margin NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue AS (
    SELECT COALESCE(SUM(amount), 0) as total
    FROM revenue_entries
    WHERE EXTRACT(YEAR FROM date) = target_year
      AND EXTRACT(MONTH FROM date) = target_month
  ),
  expenses AS (
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE EXTRACT(YEAR FROM date) = target_year
      AND EXTRACT(MONTH FROM date) = target_month
  )
  SELECT 
    r.total as total_revenue,
    e.total as total_expenses,
    (r.total - e.total) as net_profit,
    CASE 
      WHEN r.total > 0 THEN ROUND(((r.total - e.total) / r.total) * 100, 2)
      ELSE 0
    END as profit_margin
  FROM revenue r, expenses e;
END;
$$ LANGUAGE plpgsql;

-- Function to get expenses by category for a date range
CREATE OR REPLACE FUNCTION get_expenses_by_category(start_date DATE, end_date DATE)
RETURNS TABLE(
  category VARCHAR,
  total_amount NUMERIC,
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.category,
    SUM(e.amount) as total_amount,
    COUNT(*)::INTEGER as count
  FROM expenses e
  WHERE e.date BETWEEN start_date AND end_date
  GROUP BY e.category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- View for monthly P&L summary
CREATE OR REPLACE VIEW monthly_pnl_summary AS
SELECT 
  TO_CHAR(date_trunc('month', date), 'YYYY-MM') as month,
  'revenue' as type,
  SUM(amount) as amount
FROM revenue_entries
GROUP BY date_trunc('month', date)
UNION ALL
SELECT 
  TO_CHAR(date_trunc('month', date), 'YYYY-MM') as month,
  'expense' as type,
  SUM(amount) as amount
FROM expenses
GROUP BY date_trunc('month', date)
ORDER BY month DESC, type;

-- View for expense breakdown
CREATE OR REPLACE VIEW expense_breakdown AS
SELECT 
  category,
  SUM(amount) as total_amount,
  COUNT(*) as count,
  AVG(amount) as avg_amount
FROM expenses
GROUP BY category
ORDER BY total_amount DESC;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample expense categories and data
INSERT INTO expenses (description, amount, category, date, notes)
VALUES 
  ('Office Rent', 1500.00, 'Rent', CURRENT_DATE - INTERVAL '1 month', 'Monthly office space'),
  ('Medical Supplies', 2500.00, 'Inventory', CURRENT_DATE - INTERVAL '1 month', 'Dexcom and Omnipod stock'),
  ('Software Subscriptions', 350.00, 'Software', CURRENT_DATE - INTERVAL '1 month', 'Supabase, hosting, tools'),
  ('Marketing', 800.00, 'Marketing', CURRENT_DATE - INTERVAL '1 month', 'Google Ads campaign'),
  ('Utilities', 200.00, 'Utilities', CURRENT_DATE - INTERVAL '1 month', 'Internet and phone'),
  ('Insurance', 450.00, 'Insurance', CURRENT_DATE - INTERVAL '1 month', 'Business liability insurance')
ON CONFLICT DO NOTHING;

-- Sample revenue data (if not already tracked elsewhere)
-- INSERT INTO revenue_entries (description, amount, source, date, notes)
-- VALUES 
--   ('Insurance Payment - Client A', 350.00, 'insurance', CURRENT_DATE - INTERVAL '1 month', 'Monthly Dexcom supply'),
--   ('Direct Payment - Client B', 120.00, 'direct_payment', CURRENT_DATE - INTERVAL '1 month', 'Out of pocket payment')
-- ON CONFLICT DO NOTHING;

-- Grant permissions (adjust role name as needed)
-- GRANT ALL ON expenses, revenue_entries TO your_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Expenses & Revenue tables created successfully!
