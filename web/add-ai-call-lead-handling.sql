-- Allow leads to be associated with both AI and call campaigns.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_handling_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_handling_check
  CHECK (handling IN ('ai', 'call', 'ai_call'));

WITH duplicate_campaigns AS (
  SELECT
    regexp_replace(lower(trim(name)), '[^a-z0-9]', '', 'g') AS name_key,
    right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) AS phone_key
  FROM public.leads
  WHERE handling IN ('ai', 'call')
  GROUP BY 1, 2
  HAVING count(DISTINCT handling) = 2
     AND length(right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10)) = 10
)
UPDATE public.leads AS lead
SET handling = 'ai_call'
FROM duplicate_campaigns AS duplicate
WHERE lead.handling IN ('ai', 'call')
  AND regexp_replace(lower(trim(lead.name)), '[^a-z0-9]', '', 'g') = duplicate.name_key
  AND right(regexp_replace(coalesce(lead.phone, ''), '[^0-9]', '', 'g'), 10) = duplicate.phone_key;
