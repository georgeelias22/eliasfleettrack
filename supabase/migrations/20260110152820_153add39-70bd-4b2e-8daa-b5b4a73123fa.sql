-- Add invoice file path column to fuel_records
ALTER TABLE public.fuel_records ADD COLUMN invoice_file_path text;

-- Create storage bucket for fuel invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-invoices', 'fuel-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own fuel invoices
CREATE POLICY "Users can upload fuel invoices"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'fuel-invoices' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to view their own fuel invoices (via vehicle ownership)
CREATE POLICY "Users can view their fuel invoices"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'fuel-invoices' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own fuel invoices
CREATE POLICY "Users can delete their fuel invoices"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'fuel-invoices' 
  AND auth.uid() IS NOT NULL
);