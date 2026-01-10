-- Add tax fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN annual_tax numeric DEFAULT 0,
ADD COLUMN tax_paid_monthly boolean DEFAULT false;

-- Create fuel_records table
CREATE TABLE public.fuel_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  fill_date DATE NOT NULL,
  litres NUMERIC NOT NULL,
  cost_per_litre NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  mileage INTEGER,
  station TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for fuel_records
CREATE POLICY "Users can view fuel records for their vehicles"
ON public.fuel_records FOR SELECT
USING (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = fuel_records.vehicle_id AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can create fuel records for their vehicles"
ON public.fuel_records FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = fuel_records.vehicle_id AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can update fuel records for their vehicles"
ON public.fuel_records FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = fuel_records.vehicle_id AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can delete fuel records for their vehicles"
ON public.fuel_records FOR DELETE
USING (EXISTS (
  SELECT 1 FROM vehicles WHERE vehicles.id = fuel_records.vehicle_id AND vehicles.user_id = auth.uid()
));