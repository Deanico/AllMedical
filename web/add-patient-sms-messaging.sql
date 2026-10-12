CREATE TABLE IF NOT EXISTS public.patient_sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  twilio_sid TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patient_sms_messages_patient_created_idx
  ON public.patient_sms_messages (patient_id, created_at);

ALTER TABLE public.patient_sms_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_sms_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_sms_messages TO service_role;

CREATE OR REPLACE FUNCTION public.find_sms_patient_by_phone(phone_number TEXT)
RETURNS TABLE (patient_id UUID)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH incoming AS (
    SELECT regexp_replace(COALESCE(phone_number, ''), '\D', '', 'g') AS digits
  ),
  normalized_incoming AS (
    SELECT CASE
      WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN right(digits, 10)
      ELSE digits
    END AS digits
    FROM incoming
  )
  SELECT leads.id
  FROM public.leads
  CROSS JOIN normalized_incoming
  WHERE normalized_incoming.digits <> ''
    AND CASE
      WHEN length(regexp_replace(COALESCE(leads.phone, ''), '\D', '', 'g')) = 11
        AND left(regexp_replace(COALESCE(leads.phone, ''), '\D', '', 'g'), 1) = '1'
      THEN right(regexp_replace(COALESCE(leads.phone, ''), '\D', '', 'g'), 10)
      ELSE regexp_replace(COALESCE(leads.phone, ''), '\D', '', 'g')
    END = normalized_incoming.digits;
$$;

REVOKE ALL ON FUNCTION public.find_sms_patient_by_phone(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_sms_patient_by_phone(TEXT) TO service_role;
