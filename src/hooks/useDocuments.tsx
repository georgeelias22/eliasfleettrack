import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Document, DocumentExtractedData } from '@/types/fleet';

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
  
  return useMutation({
    mutationFn: async ({ 
      vehicleId, 
      file 
    }: { 
      vehicleId: string; 
      file: File;
    }) => {
      const filePath = `uploads/${vehicleId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('fleet-documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
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
      await supabase
        .from('documents')
        .update({ processing_status: 'processing' })
        .eq('id', documentId);
      
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
      
      if (data?.error) {
        await supabase
          .from('documents')
          .update({ processing_status: 'failed' })
          .eq('id', documentId);
        throw new Error(data.error);
      }
      
      const extractedData = data.data as DocumentExtractedData;
      
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
  
  return useMutation({
    mutationFn: async ({ id, filePath, vehicleId }: { id: string; filePath: string; vehicleId: string }) => {
      await supabase.storage
        .from('fleet-documents')
        .remove([filePath]);
      
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