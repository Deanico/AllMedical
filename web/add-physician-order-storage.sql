-- Create storage bucket for physician orders
INSERT INTO storage.buckets (id, name, public) 
VALUES ('physician-orders', 'physician-orders', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies to allow authenticated users to upload and view files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'physician-orders');

CREATE POLICY "Allow public downloads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'physician-orders');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'physician-orders');
