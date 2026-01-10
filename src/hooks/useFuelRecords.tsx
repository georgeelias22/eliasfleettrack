import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FuelRecord } from '@/types/fuel';

export function useFuelRecords(vehicleId?: string) {
  return useQuery({
    queryKey: ['fuel-records', vehicleId],
    queryFn: async () => {
      let query = supabase
        .from('fuel_records')
        .select('*')
        .order('fill_date', { ascending: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FuelRecord[];
    },
    enabled: !!vehicleId,
  });
}

export function useAllFuelRecords() {
  return useQuery({
    queryKey: ['fuel-records-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .order('fill_date', { ascending: false });
      
      if (error) throw error;
      return data as FuelRecord[];
    },
  });
}

export function useCreateFuelRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Omit<FuelRecord, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('fuel_records')
        .insert(record)
        .select()
        .single();
      
      if (error) throw error;
      return data as FuelRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['fuel-records-all'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-analytics'] });
    },
  });
}

export function useDeleteFuelRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vehicleId }: { id: string; vehicleId: string }) => {
      const { error } = await supabase
        .from('fuel_records')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { vehicleId };
    },
    onSuccess: ({ vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: ['fuel-records', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['fuel-records-all'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-analytics'] });
    },
  });
}
