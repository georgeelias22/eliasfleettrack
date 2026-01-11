import { useMemo } from 'react';
import { useVehicles } from './useVehicles';
import { VehicleComparison, CO2_FACTORS } from '@/types/reports';

export function useVehicleComparison(vehicleIds?: string[], dateRange?: { start: string; end: string }) {
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles();
  
  const comparisons = useMemo(() => {
    if (!vehicles) return [];
    
    const selectedVehicles = vehicleIds?.length 
      ? vehicles.filter(v => vehicleIds.includes(v.id))
      : vehicles.filter(v => v.is_active);

    return selectedVehicles.map(vehicle => {
      // These will be populated by the component that uses this hook
      return {
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        fuelType: (vehicle as any).fuel_type || 'petrol',
        annualTax: vehicle.annual_tax || 0,
        monthlyFinance: vehicle.monthly_finance || 0,
      };
    });
  }, [vehicles, vehicleIds]);

  return {
    vehicles: comparisons,
    isLoading: vehiclesLoading,
  };
}

export function calculateVehicleMetrics(
  vehicle: {
    vehicleId: string;
    registration: string;
    make: string;
    model: string;
    fuelType: string;
    annualTax: number;
    monthlyFinance: number;
  },
  fuelRecords: Array<{ vehicle_id: string; litres: number; total_cost: number; mileage: number | null; fill_date: string }>,
  serviceRecords: Array<{ vehicle_id: string; cost: number; service_date: string }>,
  documents: Array<{ vehicle_id: string; extracted_cost: number | null; created_at: string }>,
  dateRange?: { start: string; end: string }
): VehicleComparison {
  // Filter records by date range if provided
  const filterByDate = <T extends { fill_date?: string; service_date?: string; created_at?: string }>(
    records: T[],
    dateField: 'fill_date' | 'service_date' | 'created_at'
  ): T[] => {
    if (!dateRange) return records;
    return records.filter(r => {
      const date = r[dateField];
      if (!date) return false;
      return date >= dateRange.start && date <= dateRange.end;
    });
  };

  const vehicleFuelRecords = filterByDate(
    fuelRecords.filter(r => r.vehicle_id === vehicle.vehicleId),
    'fill_date'
  );
  
  const vehicleServiceRecords = filterByDate(
    serviceRecords.filter(r => r.vehicle_id === vehicle.vehicleId),
    'service_date'
  );
  
  const vehicleDocuments = filterByDate(
    documents.filter(d => d.vehicle_id === vehicle.vehicleId),
    'created_at'
  );

  // Calculate totals
  const fuelCost = vehicleFuelRecords.reduce((sum, r) => sum + Number(r.total_cost), 0);
  const litresUsed = vehicleFuelRecords.reduce((sum, r) => sum + Number(r.litres), 0);
  const serviceCost = vehicleServiceRecords.reduce((sum, r) => sum + Number(r.cost), 0);
  const documentCost = vehicleDocuments.reduce((sum, d) => sum + (Number(d.extracted_cost) || 0), 0);

  // Calculate months in range for prorated fixed costs
  let months = 12;
  if (dateRange) {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
  }

  const fixedCost = (vehicle.annualTax / 12 * months) + (vehicle.monthlyFinance * months);
  const totalCost = fuelCost + serviceCost + documentCost + fixedCost;

  // Calculate mileage from fuel records
  const mileages = vehicleFuelRecords
    .filter(r => r.mileage !== null)
    .map(r => r.mileage as number)
    .sort((a, b) => a - b);
  
  const totalMiles = mileages.length >= 2 
    ? mileages[mileages.length - 1] - mileages[0]
    : 0;

  // Calculate MPG (UK gallons = 4.546 litres)
  const mpg = litresUsed > 0 && totalMiles > 0
    ? totalMiles / (litresUsed / 4.546)
    : 0;

  // Calculate cost per mile
  const costPerMile = totalMiles > 0 ? totalCost / totalMiles : 0;

  // Calculate maintenance frequency
  const serviceCount = vehicleServiceRecords.length;
  let avgDaysBetweenService = 0;
  if (serviceCount >= 2) {
    const sortedDates = vehicleServiceRecords
      .map(r => new Date(r.service_date).getTime())
      .sort((a, b) => a - b);
    const totalDays = (sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
    avgDaysBetweenService = Math.round(totalDays / (serviceCount - 1));
  }

  // Calculate CO2 emissions
  const co2Factor = CO2_FACTORS[vehicle.fuelType.toLowerCase()] || CO2_FACTORS.petrol;
  const co2Emissions = litresUsed * co2Factor;

  return {
    vehicleId: vehicle.vehicleId,
    registration: vehicle.registration,
    make: vehicle.make,
    model: vehicle.model,
    fuelType: vehicle.fuelType,
    totalCost,
    fuelCost,
    serviceCost: serviceCost + documentCost,
    fixedCost,
    totalMiles,
    costPerMile,
    mpg,
    litresUsed,
    serviceCount,
    avgDaysBetweenService,
    co2Emissions,
  };
}
