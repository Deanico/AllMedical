-- Which campaign a lead came from: 'ai' = AI qualifier keeps texting them, 'call' = you need to call.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS handling TEXT NOT NULL DEFAULT 'call'
  CHECK (handling IN ('ai', 'call'));

-- Optional: mark existing leads from the AI sheet, e.g.
-- UPDATE public.leads SET handling = 'ai' WHERE notes LIKE 'Source: Google Sheets (YOUR_AI_TAB_NAME)%';
