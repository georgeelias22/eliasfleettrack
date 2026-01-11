-- Add fuel_type column to vehicles for carbon calculations
ALTER TABLE public.vehicles 
ADD COLUMN fuel_type text DEFAULT 'petrol';

-- Create saved_reports table for custom report builder
CREATE TABLE public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'comparison', 'carbon', 'costs', 'fuel', 'custom'
  config JSONB NOT NULL DEFAULT '{}', -- stores filters, date ranges, selected vehicles, metrics
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_reports
CREATE POLICY "Users can view their own reports" 
ON public.saved_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" 
ON public.saved_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
ON public.saved_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
ON public.saved_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_reports_updated_at
BEFORE UPDATE ON public.saved_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();