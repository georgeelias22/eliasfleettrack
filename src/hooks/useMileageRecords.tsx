import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MileageRecord {
  id: string;
  vehicle_id: string;
  record_date: string;
  daily_mileage: number;
  odometer_reading: number | null;
  source: string;
  created_at: string;
}

export function useMileageRecords(vehicleId?: string) {
  return useQuery({
    queryKey: ['mileage-records', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      
      const { data, error } = await supabase
        .from('mileage_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('record_date', { ascending: false });
      
      if (error) throw error;
      return data as MileageRecord[];
    },
    enabled: !!vehicleId,
  });
}

export function useAllMileageRecords() {
  return useQuery({
    queryKey: ['all-mileage-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mileage_records')
        .select('*')
        .order('record_date', { ascending: false });
      
      if (error) throw error;
      return data as MileageRecord[];
    },
  });
}

export function useCreateMileageRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<MileageRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('mileage_records')
        .insert(record)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mileage-records', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['all-mileage-records'] });
    },
  });
}

export function useDeleteMileageRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mileage_records')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage-records'] });
      queryClient.invalidateQueries({ queryKey: ['all-mileage-records'] });
    },
  });
}

// Calculate 30-day rolling MPG
export function calculateRolling30DayMPG(
  mileageRecords: MileageRecord[],
  fuelRecords: { fill_date: string; litres: number }[]
): number | null {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get mileage in the last 30 days
  const recentMileage = mileageRecords
    .filter(r => new Date(r.record_date) >= thirtyDaysAgo)
    .reduce((sum, r) => sum + r.daily_mileage, 0);
  
  // Get fuel used in the last 30 days
  const recentFuel = fuelRecords
    .filter(r => new Date(r.fill_date) >= thirtyDaysAgo)
    .reduce((sum, r) => sum + Number(r.litres), 0);
  
  if (recentMileage === 0 || recentFuel === 0) return null;
  
  // Convert litres to gallons (1 gallon = 4.54609 litres)
  const gallons = recentFuel / 4.54609;
  
  return Math.round((recentMileage / gallons) * 10) / 10;
}
