-- Financial Sheets Reporting Schema
-- Supports syncing paid claims and operations sheets into clean report views + profit/loss

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sheet_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  claims_rows_read INTEGER DEFAULT 0,
  claims_rows_upserted INTEGER DEFAULT 0,
  claims_rows_skipped INTEGER DEFAULT 0,
  ops_rows_read INTEGER DEFAULT 0,
  ops_rows_upserted INTEGER DEFAULT 0,
  ops_rows_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_sync_jobs_created_at ON sheet_sync_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS sheet_paid_claims_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sheet_id TEXT NOT NULL,
  source_row_number INTEGER,
  source_sheet_name TEXT,
  source_row_hash TEXT NOT NULL UNIQUE,
  claim_id TEXT,
  patient_name TEXT,
  payer TEXT,
  paid_date DATE,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_paid_claims_paid_date ON sheet_paid_claims_raw(paid_date DESC);
CREATE INDEX IF NOT EXISTS idx_sheet_paid_claims_patient_name ON sheet_paid_claims_raw(patient_name);

CREATE TABLE IF NOT EXISTS sheet_ops_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sheet_id TEXT NOT NULL,
  source_row_number INTEGER,
  source_sheet_name TEXT,
  source_row_hash TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('expense', 'shipment')),
  category TEXT,
  description TEXT,
  vendor TEXT,
  entry_date DATE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_ops_entry_date ON sheet_ops_raw(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_sheet_ops_entry_type ON sheet_ops_raw(entry_type);

CREATE TABLE IF NOT EXISTS financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('paid_claim', 'expense', 'shipment')),
  source_row_hash TEXT NOT NULL UNIQUE,
  txn_date DATE,
  category TEXT,
  description TEXT,
  vendor_or_payer TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  signed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  metadata JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_txn_date ON financial_ledger(txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_source_kind ON financial_ledger(source_kind);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sheet_paid_claims_raw_updated_at ON sheet_paid_claims_raw;
CREATE TRIGGER update_sheet_paid_claims_raw_updated_at
  BEFORE UPDATE ON sheet_paid_claims_raw
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sheet_ops_raw_updated_at ON sheet_ops_raw;
CREATE TRIGGER update_sheet_ops_raw_updated_at
  BEFORE UPDATE ON sheet_ops_raw
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_ledger_updated_at ON financial_ledger;
CREATE TRIGGER update_financial_ledger_updated_at
  BEFORE UPDATE ON financial_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Report views
CREATE OR REPLACE VIEW v_reports_claims AS
SELECT
  id,
  paid_date,
  claim_id,
  patient_name,
  payer,
  amount_paid,
  notes,
  synced_at
FROM sheet_paid_claims_raw
ORDER BY paid_date DESC NULLS LAST, synced_at DESC;

CREATE OR REPLACE VIEW v_reports_expenses_shipments AS
SELECT
  id,
  entry_date,
  entry_type,
  category,
  description,
  vendor,
  amount,
  notes,
  synced_at
FROM sheet_ops_raw
ORDER BY entry_date DESC NULLS LAST, synced_at DESC;

CREATE OR REPLACE VIEW v_profit_loss_totals AS
SELECT
  COALESCE(SUM(CASE WHEN source_kind = 'paid_claim' THEN amount ELSE 0 END), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN source_kind = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
  COALESCE(SUM(CASE WHEN source_kind = 'shipment' THEN amount ELSE 0 END), 0) AS total_shipment_cost,
  COALESCE(SUM(signed_amount), 0) AS net_profit,
  CASE
    WHEN COALESCE(SUM(CASE WHEN source_kind = 'paid_claim' THEN amount ELSE 0 END), 0) > 0
      THEN ROUND((COALESCE(SUM(signed_amount), 0) /
        COALESCE(SUM(CASE WHEN source_kind = 'paid_claim' THEN amount ELSE 0 END), 0)) * 100, 2)
    ELSE 0
  END AS profit_margin_percent
FROM financial_ledger;

CREATE OR REPLACE VIEW v_profit_loss_monthly AS
SELECT
  TO_CHAR(date_trunc('month', COALESCE(txn_date, synced_at::date)), 'YYYY-MM') AS month,
  COALESCE(SUM(CASE WHEN source_kind = 'paid_claim' THEN amount ELSE 0 END), 0) AS revenue,
  COALESCE(SUM(CASE WHEN source_kind = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
  COALESCE(SUM(CASE WHEN source_kind = 'shipment' THEN amount ELSE 0 END), 0) AS shipment_cost,
  COALESCE(SUM(signed_amount), 0) AS net_profit
FROM financial_ledger
GROUP BY date_trunc('month', COALESCE(txn_date, synced_at::date))
ORDER BY month DESC;

ALTER TABLE sheet_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_paid_claims_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_ops_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sheet_sync_jobs' AND policyname = 'Allow all operations on sheet_sync_jobs'
  ) THEN
    CREATE POLICY "Allow all operations on sheet_sync_jobs" ON sheet_sync_jobs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sheet_paid_claims_raw' AND policyname = 'Allow all operations on sheet_paid_claims_raw'
  ) THEN
    CREATE POLICY "Allow all operations on sheet_paid_claims_raw" ON sheet_paid_claims_raw
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sheet_ops_raw' AND policyname = 'Allow all operations on sheet_ops_raw'
  ) THEN
    CREATE POLICY "Allow all operations on sheet_ops_raw" ON sheet_ops_raw
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_ledger' AND policyname = 'Allow all operations on financial_ledger'
  ) THEN
    CREATE POLICY "Allow all operations on financial_ledger" ON financial_ledger
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
