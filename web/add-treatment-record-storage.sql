-- Create storage bucket for signed treatment records
INSERT INTO storage.buckets (id, name, public)
VALUES ('treatment-records', 'treatment-records', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for treatment-records bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads from treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update treatment-records" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete treatment-records" ON storage.objects;

CREATE POLICY "Anyone can upload to treatment-records"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'treatment-records');

CREATE POLICY "Anyone can view treatment-records"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'treatment-records');

CREATE POLICY "Anyone can update treatment-records"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'treatment-records');

CREATE POLICY "Anyone can delete treatment-records"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'treatment-records');
