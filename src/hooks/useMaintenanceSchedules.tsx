import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaintenanceSchedule } from '@/types/maintenance';
import { useAuth } from './useAuth';

export function useMaintenanceSchedules(vehicleId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['maintenance-schedules', vehicleId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('maintenance_schedules')
        .select('*')
        .order('next_due_date', { ascending: true, nullsFirst: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as MaintenanceSchedule[];
    },
    enabled: !!user,
  });
}

export function useAllMaintenanceSchedules() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['all-maintenance-schedules', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('*, vehicles(registration, make, model)')
        .eq('is_active', true)
        .order('next_due_date', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateMaintenanceSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (schedule: Omit<MaintenanceSchedule, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .insert({ ...schedule, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-maintenance-schedules'] });
    },
  });
}

export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-maintenance-schedules'] });
    },
  });
}

export function useDeleteMaintenanceSchedule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-maintenance-schedules'] });
    },
  });
}

export function useMarkMaintenanceComplete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      completedDate, 
      completedMileage 
    }: { 
      id: string; 
      completedDate: string; 
      completedMileage?: number;
    }) => {
      // First get the schedule to calculate next due
      const { data: schedule, error: fetchError } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Calculate next due date
      let nextDueDate: string | null = null;
      if (schedule.interval_months) {
        const date = new Date(completedDate);
        date.setMonth(date.getMonth() + schedule.interval_months);
        nextDueDate = date.toISOString().split('T')[0];
      }
      
      // Calculate next due mileage
      let nextDueMileage: number | null = null;
      if (schedule.interval_miles && completedMileage) {
        nextDueMileage = completedMileage + schedule.interval_miles;
      }
      
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .update({
          last_completed_date: completedDate,
          last_completed_mileage: completedMileage || null,
          next_due_date: nextDueDate,
          next_due_mileage: nextDueMileage,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['all-maintenance-schedules'] });
    },
  });
}
