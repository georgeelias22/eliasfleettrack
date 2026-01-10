import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceRecord } from '@/types/fleet';

export function useServiceRecords(vehicleId?: string) {
  return useQuery({
    queryKey: ['service-records', vehicleId],
    queryFn: async () => {
      let query = supabase
        .from('service_records')
        .select('*')
        .order('service_date', { ascending: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ServiceRecord[];
    },
    enabled: !!vehicleId,
  });
}

export function useCreateServiceRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: Omit<ServiceRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('service_records')
        .insert(record)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-records', data.vehicle_id] });
    },
  });
}

export function useDeleteServiceRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vehicleId }: { id: string; vehicleId: string }) => {
      const { error } = await supabase
        .from('service_records')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { vehicleId };
    },
    onSuccess: ({ vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: ['service-records', vehicleId] });
    },
  });
}
