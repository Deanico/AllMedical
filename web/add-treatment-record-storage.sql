-- Create storage bucket for signed treatment records
INSERT INTO storage.buckets (id, name, public)
VALUES ('treatment-records', 'treatment-records', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for treatment-records bucket
CREATE POLICY "Allow authenticated uploads to treatment-records" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'treatment-records');

CREATE POLICY "Allow public downloads from treatment-records" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'treatment-records');

CREATE POLICY "Allow authenticated deletes from treatment-records" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'treatment-records');
