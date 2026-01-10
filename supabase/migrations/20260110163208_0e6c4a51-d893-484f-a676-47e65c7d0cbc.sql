-- Add is_active column to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;