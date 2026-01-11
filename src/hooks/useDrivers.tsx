import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Driver } from '@/types/driver';
import { useAuth } from './useAuth';

export function useDrivers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['drivers', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Driver[];
    },
    enabled: !!user,
  });
}

export function useDriver(id: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['driver', id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Driver;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (driver: Omit<Driver, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      // Calculate next check code due date (6 months from last check code date)
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
          user_id: user.id,
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
      // Calculate next check code due date if last_check_code_date is updated
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
