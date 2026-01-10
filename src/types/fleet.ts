export interface Vehicle {
  id: string;
  user_id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  mot_due_date: string | null;
  annual_tax: number | null;
  tax_paid_monthly: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  service_type: string;
  description: string | null;
  cost: number;
  mileage: number | null;
  provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  vehicle_id: string;
  service_record_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  ai_extracted_data: DocumentExtractedData | null;
  extracted_cost: number | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface DocumentExtractedData {
  totalCost?: number | null;
  serviceType?: string | null;
  serviceDate?: string | null;
  provider?: string | null;
  registration?: string | null;
  mileage?: number | null;
  description?: string | null;
  lineItems?: { description: string; cost: number }[];
}

export type MOTStatus = 'valid' | 'due-soon' | 'overdue' | 'unknown';

export function getMOTStatus(motDueDate: string | null): MOTStatus {
  if (!motDueDate) return 'unknown';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(motDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due-soon';
  return 'valid';
}

export function getDaysUntilMOT(motDueDate: string | null): number | null {
  if (!motDueDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(motDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
