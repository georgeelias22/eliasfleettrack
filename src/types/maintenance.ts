export interface MaintenanceSchedule {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  maintenance_type: string;
  interval_miles: number | null;
  interval_months: number | null;
  last_completed_date: string | null;
  last_completed_mileage: number | null;
  next_due_date: string | null;
  next_due_mileage: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MaintenanceStatus = 'ok' | 'due-soon' | 'overdue';

export function getMaintenanceStatus(
  nextDueDate: string | null,
  nextDueMileage: number | null,
  currentMileage: number | null
): MaintenanceStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check date-based status
  if (nextDueDate) {
    const dueDate = new Date(nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 14) return 'due-soon';
  }
  
  // Check mileage-based status
  if (nextDueMileage && currentMileage) {
    const milesRemaining = nextDueMileage - currentMileage;
    
    if (milesRemaining < 0) return 'overdue';
    if (milesRemaining <= 500) return 'due-soon';
  }
  
  return 'ok';
}

export const COMMON_MAINTENANCE_TYPES = [
  { value: 'oil-change', label: 'Oil Change', defaultMiles: 10000, defaultMonths: 12 },
  { value: 'brake-inspection', label: 'Brake Inspection', defaultMiles: 20000, defaultMonths: 24 },
  { value: 'tire-rotation', label: 'Tire Rotation', defaultMiles: 5000, defaultMonths: 6 },
  { value: 'air-filter', label: 'Air Filter', defaultMiles: 15000, defaultMonths: 12 },
  { value: 'spark-plugs', label: 'Spark Plugs', defaultMiles: 30000, defaultMonths: 36 },
  { value: 'coolant-flush', label: 'Coolant Flush', defaultMiles: 30000, defaultMonths: 36 },
  { value: 'transmission-service', label: 'Transmission Service', defaultMiles: 60000, defaultMonths: 48 },
  { value: 'timing-belt', label: 'Timing Belt', defaultMiles: 60000, defaultMonths: 60 },
  { value: 'battery-check', label: 'Battery Check', defaultMiles: null, defaultMonths: 12 },
  { value: 'custom', label: 'Custom', defaultMiles: null, defaultMonths: null },
];
