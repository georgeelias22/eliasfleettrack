-- Fix maintenance_schedules RLS policies to validate vehicle ownership
-- This prevents users from creating maintenance schedules for vehicles they don't own

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create their own maintenance schedules" ON public.maintenance_schedules;

-- Create new INSERT policy with vehicle ownership validation
CREATE POLICY "Users can create their own maintenance schedules"
ON public.maintenance_schedules FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    vehicle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE vehicles.id = maintenance_schedules.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own maintenance schedules" ON public.maintenance_schedules;

-- Create new UPDATE policy with vehicle ownership validation
CREATE POLICY "Users can update their own maintenance schedules"
ON public.maintenance_schedules FOR UPDATE
USING (
  auth.uid() = user_id
  AND (
    vehicle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE vehicles.id = maintenance_schedules.vehicle_id
      AND vehicles.user_id = auth.uid()
    )
  )
);