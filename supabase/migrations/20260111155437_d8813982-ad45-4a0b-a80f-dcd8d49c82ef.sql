-- Create drivers table for license tracking
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  license_number TEXT,
  license_expiry_date DATE,
  last_check_code_date DATE,
  next_check_code_due DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- RLS policies for drivers
CREATE POLICY "Users can view their own drivers"
ON public.drivers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drivers"
ON public.drivers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drivers"
ON public.drivers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drivers"
ON public.drivers FOR DELETE
USING (auth.uid() = user_id);

-- Create maintenance_schedules table
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  interval_miles INTEGER,
  interval_months INTEGER,
  last_completed_date DATE,
  last_completed_mileage INTEGER,
  next_due_date DATE,
  next_due_mileage INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on maintenance_schedules
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for maintenance_schedules
CREATE POLICY "Users can view their own maintenance schedules"
ON public.maintenance_schedules FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own maintenance schedules"
ON public.maintenance_schedules FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance schedules"
ON public.maintenance_schedules FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance schedules"
ON public.maintenance_schedules FOR DELETE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_schedules_updated_at
BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();