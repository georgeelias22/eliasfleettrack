export interface FuelRecord {
  id: string;
  vehicle_id: string;
  fill_date: string;
  litres: number;
  cost_per_litre: number;
  total_cost: number;
  mileage: number | null;
  station: string | null;
  notes: string | null;
  invoice_file_path: string | null;
  created_at: string;
}
