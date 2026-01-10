import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Document, DocumentExtractedData } from '@/types/fleet';
import { useAuth } from './useAuth';

export function useDocuments(vehicleId?: string) {
  return useQuery({
    queryKey: ['documents', vehicleId],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!vehicleId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      vehicleId, 
      file 
    }: { 
      vehicleId: string; 
      file: File;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Upload file to storage
      const filePath = `${user.id}/${vehicleId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('fleet-documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Create document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          vehicle_id: vehicleId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          processing_status: 'pending',
        })
        .select()
        .single();
      
      if (docError) throw docError;
      
      return doc as Document;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', data.vehicle_id] });
    },
  });
}

export function useScanDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ documentId, fileContent, fileName }: { 
      documentId: string; 
      fileContent: string;
      fileName: string;
    }) => {
      // Update status to processing
      await supabase
        .from('documents')
        .update({ processing_status: 'processing' })
        .eq('id', documentId);
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('scan-document', {
        body: { fileContent, fileName },
      });
      
      if (error) {
        await supabase
          .from('documents')
          .update({ processing_status: 'failed' })
          .eq('id', documentId);
        throw error;
      }
      
      const extractedData = data.data as DocumentExtractedData;
      
      // Update document with extracted data
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          ai_extracted_data: extractedData ? JSON.parse(JSON.stringify(extractedData)) : null,
          extracted_cost: extractedData?.totalCost ?? null,
          processing_status: 'completed',
        })
        .eq('id', documentId);
      
      if (updateError) throw updateError;
      
      return { documentId, extractedData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, filePath, vehicleId }: { id: string; filePath: string; vehicleId: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Delete from storage
      await supabase.storage
        .from('fleet-documents')
        .remove([filePath]);
      
      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { vehicleId };
    },
    onSuccess: ({ vehicleId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', vehicleId] });
    },
  });
}
