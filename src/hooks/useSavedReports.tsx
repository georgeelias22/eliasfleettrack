import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedReport, ReportConfig } from '@/types/reports';
import { toast } from 'sonner';

export function useSavedReports() {
  const queryClient = useQueryClient();

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['saved-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as SavedReport[];
    },
  });

  const createReport = useMutation({
    mutationFn: async (report: {
      name: string;
      description?: string;
      report_type: SavedReport['report_type'];
      config: ReportConfig;
    }) => {
      const { data, error } = await supabase
        .from('saved_reports')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          name: report.name,
          description: report.description || null,
          report_type: report.report_type,
          config: report.config as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Report saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save report: ' + error.message);
    },
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavedReport> & { id: string }) => {
      const { data, error } = await supabase
        .from('saved_reports')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Report updated');
    },
    onError: (error) => {
      toast.error('Failed to update report: ' + error.message);
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Report deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete report: ' + error.message);
    },
  });

  return {
    reports: reports || [],
    isLoading,
    error,
    createReport,
    updateReport,
    deleteReport,
  };
}