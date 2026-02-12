import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Driver } from '@/types/driver';

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Driver[];
    },
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ['driver', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Driver;
    },
    enabled: !!id,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (driver: Omit<Driver, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      let nextCheckCodeDue = driver.next_check_code_due;
      if (driver.last_check_code_date && !nextCheckCodeDue) {
        const lastDate = new Date(driver.last_check_code_date);
        lastDate.setMonth(lastDate.getMonth() + 6);
        nextCheckCodeDue = lastDate.toISOString().split('T')[0];
      }
      
      const { data, error } = await supabase
        .from('drivers')
        .insert({ 
          ...driver, 
          user_id: '00000000-0000-0000-0000-000000000000',
          next_check_code_due: nextCheckCodeDue 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Driver> & { id: string }) => {
      let nextCheckCodeDue = updates.next_check_code_due;
      if (updates.last_check_code_date) {
        const lastDate = new Date(updates.last_check_code_date);
        lastDate.setMonth(lastDate.getMonth() + 6);
        nextCheckCodeDue = lastDate.toISOString().split('T')[0];
      }
      
      const { data, error } = await supabase
        .from('drivers')
        .update({ 
          ...updates,
          next_check_code_due: nextCheckCodeDue 
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['driver', data.id] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}