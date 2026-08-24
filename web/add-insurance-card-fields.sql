-- Adds structured insurance card details and image references to patients.
-- Run this in the Supabase SQL editor before using the insurance card section.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS insurance_group_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_cardholder_name TEXT,
  ADD COLUMN IF NOT EXISTS insurance_cardholder_relationship TEXT,
  ADD COLUMN IF NOT EXISTS insurance_card_front_url TEXT,
  ADD COLUMN IF NOT EXISTS insurance_card_back_url TEXT;

-- Insurance cards contain protected health information. Keep the bucket private
-- in production and replace the policies below with authenticated, role-based
-- policies if the app's auth/RLS model supports them.
INSERT INTO storage.buckets (id, name, public)
VALUES ('insurance-cards', 'insurance-cards', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload insurance cards" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view insurance cards" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update insurance cards" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete insurance cards" ON storage.objects;

CREATE POLICY "Anyone can upload insurance cards"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'insurance-cards');

CREATE POLICY "Anyone can view insurance cards"
ON storage.objects FOR SELECT
USING (bucket_id = 'insurance-cards');

CREATE POLICY "Anyone can update insurance cards"
ON storage.objects FOR UPDATE
USING (bucket_id = 'insurance-cards');

CREATE POLICY "Anyone can delete insurance cards"
ON storage.objects FOR DELETE
USING (bucket_id = 'insurance-cards');