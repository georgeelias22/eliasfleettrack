-- Fix overly permissive fuel-invoices storage policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can upload fuel invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their fuel invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their fuel invoices" ON storage.objects;

-- Create secure folder-based policies matching fleet-documents pattern
CREATE POLICY "Users can upload fuel invoices" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fuel-invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their fuel invoices" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fuel-invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their fuel invoices" ON storage.objects
FOR DELETE USING (
  bucket_id = 'fuel-invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);