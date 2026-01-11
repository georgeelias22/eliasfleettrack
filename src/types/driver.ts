export interface Driver {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  last_check_code_date: string | null;
  next_check_code_due: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CheckCodeStatus = 'valid' | 'due-soon' | 'overdue' | 'unknown';

export function getCheckCodeStatus(nextDueDate: string | null): CheckCodeStatus {
  if (!nextDueDate) return 'unknown';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due-soon';
  return 'valid';
}

export function getDaysUntilCheckCode(nextDueDate: string | null): number | null {
  if (!nextDueDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
