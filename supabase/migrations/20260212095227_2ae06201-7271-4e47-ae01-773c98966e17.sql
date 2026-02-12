
-- Drop all existing restrictive RLS policies and replace with public access

-- vehicles
DROP POLICY IF EXISTS "Users can view their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can create their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can update their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can delete their own vehicles" ON public.vehicles;

CREATE POLICY "Public read vehicles" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Public insert vehicles" ON public.vehicles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update vehicles" ON public.vehicles FOR UPDATE USING (true);
CREATE POLICY "Public delete vehicles" ON public.vehicles FOR DELETE USING (true);

-- fuel_records
DROP POLICY IF EXISTS "Users can view fuel records for their vehicles" ON public.fuel_records;
DROP POLICY IF EXISTS "Users can create fuel records for their vehicles" ON public.fuel_records;
DROP POLICY IF EXISTS "Users can update fuel records for their vehicles" ON public.fuel_records;
DROP POLICY IF EXISTS "Users can delete fuel records for their vehicles" ON public.fuel_records;

CREATE POLICY "Public read fuel_records" ON public.fuel_records FOR SELECT USING (true);
CREATE POLICY "Public insert fuel_records" ON public.fuel_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update fuel_records" ON public.fuel_records FOR UPDATE USING (true);
CREATE POLICY "Public delete fuel_records" ON public.fuel_records FOR DELETE USING (true);

-- drivers
DROP POLICY IF EXISTS "Users can view their own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can create their own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can update their own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can delete their own drivers" ON public.drivers;

CREATE POLICY "Public read drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Public insert drivers" ON public.drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update drivers" ON public.drivers FOR UPDATE USING (true);
CREATE POLICY "Public delete drivers" ON public.drivers FOR DELETE USING (true);

-- mileage_records
DROP POLICY IF EXISTS "Users can view mileage records for their vehicles" ON public.mileage_records;
DROP POLICY IF EXISTS "Users can create mileage records for their vehicles" ON public.mileage_records;
DROP POLICY IF EXISTS "Users can update mileage records for their vehicles" ON public.mileage_records;
DROP POLICY IF EXISTS "Users can delete mileage records for their vehicles" ON public.mileage_records;

CREATE POLICY "Public read mileage_records" ON public.mileage_records FOR SELECT USING (true);
CREATE POLICY "Public insert mileage_records" ON public.mileage_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update mileage_records" ON public.mileage_records FOR UPDATE USING (true);
CREATE POLICY "Public delete mileage_records" ON public.mileage_records FOR DELETE USING (true);

-- service_records
DROP POLICY IF EXISTS "Users can view service records for their vehicles" ON public.service_records;
DROP POLICY IF EXISTS "Users can create service records for their vehicles" ON public.service_records;
DROP POLICY IF EXISTS "Users can update service records for their vehicles" ON public.service_records;
DROP POLICY IF EXISTS "Users can delete service records for their vehicles" ON public.service_records;

CREATE POLICY "Public read service_records" ON public.service_records FOR SELECT USING (true);
CREATE POLICY "Public insert service_records" ON public.service_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update service_records" ON public.service_records FOR UPDATE USING (true);
CREATE POLICY "Public delete service_records" ON public.service_records FOR DELETE USING (true);

-- documents
DROP POLICY IF EXISTS "Users can view documents for their vehicles" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents for their vehicles" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents for their vehicles" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents for their vehicles" ON public.documents;

CREATE POLICY "Public read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Public insert documents" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update documents" ON public.documents FOR UPDATE USING (true);
CREATE POLICY "Public delete documents" ON public.documents FOR DELETE USING (true);

-- maintenance_schedules
DROP POLICY IF EXISTS "Users can view their own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can create their own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can update their own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete their own maintenance schedules" ON public.maintenance_schedules;

CREATE POLICY "Public read maintenance_schedules" ON public.maintenance_schedules FOR SELECT USING (true);
CREATE POLICY "Public insert maintenance_schedules" ON public.maintenance_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update maintenance_schedules" ON public.maintenance_schedules FOR UPDATE USING (true);
CREATE POLICY "Public delete maintenance_schedules" ON public.maintenance_schedules FOR DELETE USING (true);

-- saved_reports
DROP POLICY IF EXISTS "Users can view their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can create their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON public.saved_reports;

CREATE POLICY "Public read saved_reports" ON public.saved_reports FOR SELECT USING (true);
CREATE POLICY "Public insert saved_reports" ON public.saved_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update saved_reports" ON public.saved_reports FOR UPDATE USING (true);
CREATE POLICY "Public delete saved_reports" ON public.saved_reports FOR DELETE USING (true);
