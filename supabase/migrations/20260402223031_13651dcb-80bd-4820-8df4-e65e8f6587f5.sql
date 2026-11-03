
-- Allow authenticated users to upload to media bucket (their own folder)
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'carousel'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow public read access to media bucket
CREATE POLICY "Public read access to media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow users to update their own files
CREATE POLICY "Users can update their own media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
