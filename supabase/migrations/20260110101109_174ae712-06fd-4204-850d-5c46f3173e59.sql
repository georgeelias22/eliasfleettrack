-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  registration TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  vin TEXT,
  mot_due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service records table
CREATE TABLE public.service_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL,
  description TEXT,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  mileage INTEGER,
  provider TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table for uploaded files
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_record_id UUID REFERENCES public.service_records(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  ai_extracted_data JSONB,
  extracted_cost DECIMAL(10,2),
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Users can view their own vehicles" ON public.vehicles
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can create their own vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update their own vehicles" ON public.vehicles
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete their own vehicles" ON public.vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for service records (via vehicle ownership)
CREATE POLICY "Users can view service records for their vehicles" ON public.service_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can create service records for their vehicles" ON public.service_records
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can update service records for their vehicles" ON public.service_records
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can delete service records for their vehicles" ON public.service_records
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );

-- RLS Policies for documents (via vehicle ownership)
CREATE POLICY "Users can view documents for their vehicles" ON public.documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can create documents for their vehicles" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can update documents for their vehicles" ON public.documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can delete documents for their vehicles" ON public.documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.vehicles WHERE id = vehicle_id AND user_id = auth.uid())
  );

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('fleet-documents', 'fleet-documents', false);

-- Storage policies
CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fleet-documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fleet-documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fleet-documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_records_updated_at
  BEFORE UPDATE ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();