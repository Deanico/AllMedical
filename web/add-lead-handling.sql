-- Which campaign(s) a lead came from: 'ai', 'call', or 'ai_call' for both.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS handling TEXT NOT NULL DEFAULT 'call';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_handling_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_handling_check
  CHECK (handling IN ('ai', 'call', 'ai_call'));

-- Optional: mark existing leads from the AI sheet, e.g.
-- UPDATE public.leads SET handling = 'ai' WHERE notes LIKE 'Source: Google Sheets (YOUR_AI_TAB_NAME)%';
