-- Add monthly finance column to vehicles
ALTER TABLE public.vehicles
ADD COLUMN monthly_finance numeric DEFAULT 0;