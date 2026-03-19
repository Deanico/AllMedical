-- Complete fix for physician orders storage bucket
-- This will properly configure the policies

-- 1. Remove all existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to physician-orders" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view physician-orders" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update physician-orders" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete physician-orders" ON storage.objects;

-- 2. Create permissive policies that work with your authentication
CREATE POLICY "Anyone can upload to physician-orders"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'physician-orders');

CREATE POLICY "Anyone can view physician-orders"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'physician-orders');

CREATE POLICY "Anyone can update physician-orders"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'physician-orders');

CREATE POLICY "Anyone can delete physician-orders"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'physician-orders');

-- 3. Verify the setup
SELECT * FROM storage.buckets WHERE id = 'physician-orders';

SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%physician%';
