export interface VehicleComparison {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  fuelType: string;
  totalCost: number;
  fuelCost: number;
  serviceCost: number;
  fixedCost: number;
  totalMiles: number;
  costPerMile: number;
  mpg: number;
  litresUsed: number;
  serviceCount: number;
  avgDaysBetweenService: number;
  co2Emissions: number; // kg
}

export interface CarbonFootprint {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  fuelType: string;
  litresUsed: number;
  co2Emissions: number; // kg
  co2PerMile: number; // g per mile
  treesNeeded: number; // trees needed to offset annually
}

export interface SavedReport {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  report_type: 'comparison' | 'carbon' | 'costs' | 'fuel' | 'custom';
  config: ReportConfig;
  created_at: string;
  updated_at: string;
}

export interface ReportConfig {
  vehicleIds?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  metrics?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'year';
  includeInactive?: boolean;
}

// CO2 emissions factors (kg CO2 per litre)
export const CO2_FACTORS: Record<string, number> = {
  petrol: 2.31,
  diesel: 2.68,
  hybrid: 1.85,
  'plug-in hybrid': 1.20,
  electric: 0,
};

// Average tree absorbs ~22kg CO2 per year
export const CO2_PER_TREE_PER_YEAR = 22;
