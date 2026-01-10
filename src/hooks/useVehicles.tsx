import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Vehicle } from '@/types/fleet';
import { useAuth } from './useAuth';

export function useVehicles() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!user,
  });
}

export function useVehicle(id: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      if (!user || !id) return null;
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Vehicle;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (vehicle: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('vehicles')
        .insert({ ...vehicle, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vehicle> & { id: string }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', data.id] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
