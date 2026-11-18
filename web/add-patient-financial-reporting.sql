-- Run in the Supabase SQL Editor before deploying the patient financial reports.
BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.expenses'::regclass
      AND conname = 'expenses_expense_type_check'
  ) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check
      CHECK (expense_type IN ('regular', 'extra'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_lead_id ON public.expenses(lead_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expenses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
DROP POLICY IF EXISTS "Patient financials admin access" ON public.expenses;
CREATE POLICY "Patient financials admin access" ON public.expenses
  FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
DROP POLICY IF EXISTS "Patient financials admin restriction" ON public.expenses;
CREATE POLICY "Patient financials admin restriction" ON public.expenses
  AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

ALTER TABLE public.client_claims
  ADD COLUMN IF NOT EXISTS paid_date date;

COMMIT;
