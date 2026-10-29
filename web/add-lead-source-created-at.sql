-- Store the original creation timestamp for leads imported from Google Sheets.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_source_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_source_created_at
  ON public.leads (lead_source_created_at DESC);
