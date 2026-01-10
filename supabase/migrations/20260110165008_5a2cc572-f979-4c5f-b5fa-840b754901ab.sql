-- Create mileage_records table for daily tracker imports
CREATE TABLE public.mileage_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  daily_mileage INTEGER NOT NULL,
  odometer_reading INTEGER,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate daily records
CREATE UNIQUE INDEX idx_mileage_records_vehicle_date ON public.mileage_records(vehicle_id, record_date);

-- Enable RLS
ALTER TABLE public.mileage_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies matching other tables
CREATE POLICY "Users can view mileage records for their vehicles"
ON public.mileage_records
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM vehicles
  WHERE vehicles.id = mileage_records.vehicle_id
  AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can create mileage records for their vehicles"
ON public.mileage_records
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM vehicles
  WHERE vehicles.id = mileage_records.vehicle_id
  AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can update mileage records for their vehicles"
ON public.mileage_records
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM vehicles
  WHERE vehicles.id = mileage_records.vehicle_id
  AND vehicles.user_id = auth.uid()
));

CREATE POLICY "Users can delete mileage records for their vehicles"
ON public.mileage_records
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM vehicles
  WHERE vehicles.id = mileage_records.vehicle_id
  AND vehicles.user_id = auth.uid()
));