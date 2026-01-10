import { supabase } from '@/integrations/supabase/client';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFile?: {
    fileName: string;
    tableName: string;
    createdAt: string;
  };
}

export async function checkForDuplicateFile(
  file: File,
  userId: string
): Promise<DuplicateCheckResult> {
  // Check for duplicates based on file name and size combination
  const normalizedFileName = file.name.toLowerCase().trim();
  const fileSize = file.size;

  // Check in documents table
  const { data: existingDocs } = await supabase
    .from('documents')
    .select('file_name, file_size, created_at, vehicle_id')
    .ilike('file_name', normalizedFileName);

  if (existingDocs && existingDocs.length > 0) {
    // Check if any match by size as well (same name + same size = likely duplicate)
    const duplicate = existingDocs.find(doc => doc.file_size === fileSize);
    if (duplicate) {
      return {
        isDuplicate: true,
        existingFile: {
          fileName: duplicate.file_name,
          tableName: 'documents',
          createdAt: duplicate.created_at,
        },
      };
    }
  }

  // Check in fuel_records for invoice_file_path
  // We need to check the storage bucket for fuel invoices
  const { data: fuelInvoices } = await supabase
    .from('fuel_records')
    .select('invoice_file_path, created_at')
    .not('invoice_file_path', 'is', null);

  if (fuelInvoices && fuelInvoices.length > 0) {
    // Check if any fuel invoice file path contains the same file name
    const duplicate = fuelInvoices.find(record => {
      if (!record.invoice_file_path) return false;
      const storedFileName = record.invoice_file_path.split('/').pop()?.toLowerCase() || '';
      // The stored file has a timestamp prefix, so we check if it ends with the original filename
      return storedFileName.includes(normalizedFileName.replace(/\s+/g, '-'));
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        existingFile: {
          fileName: duplicate.invoice_file_path?.split('/').pop() || 'Unknown',
          tableName: 'fuel_records',
          createdAt: duplicate.created_at,
        },
      };
    }
  }

  return { isDuplicate: false };
}

export async function checkMultipleFilesForDuplicates(
  files: File[],
  userId: string
): Promise<{ file: File; result: DuplicateCheckResult }[]> {
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      result: await checkForDuplicateFile(file, userId),
    }))
  );
  return results;
}

export function formatDuplicateMessage(
  duplicates: { file: File; result: DuplicateCheckResult }[]
): string {
  const actualDuplicates = duplicates.filter(d => d.result.isDuplicate);
  if (actualDuplicates.length === 0) return '';

  const fileNames = actualDuplicates.map(d => d.file.name).join(', ');
  const source = actualDuplicates[0].result.existingFile?.tableName === 'fuel_records' 
    ? 'fuel records' 
    : 'service documents';

  return `${actualDuplicates.length === 1 ? 'This file appears' : 'These files appear'} to already exist in ${source}: ${fileNames}`;
}
