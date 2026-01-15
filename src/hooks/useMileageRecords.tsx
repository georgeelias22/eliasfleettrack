import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MileageRecord {
  id: string;
  vehicle_id: string;
  record_date: string;
  daily_mileage: number;
  odometer_reading: number | null;
  source: string | null;
  created_at: string;
}

export interface MileageByVehicle {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  totalMileage: number;
  avgDailyMileage: number;
  recordCount: number;
  latestOdometer: number | null;
}

export interface MileageByMonth {
  month: string;
  monthKey: string;
  totalMileage: number;
  avgDailyMileage: number;
  recordCount: number;
}

export function useMileageRecords(vehicleId?: string) {
  return useQuery({
    queryKey: ['mileage-records', vehicleId],
    queryFn: async () => {
      let query = supabase
        .from('mileage_records')
        .select('*')
        .order('record_date', { ascending: false });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MileageRecord[];
    },
  });
}

export function useAllMileageRecords() {
  return useQuery({
    queryKey: ['mileage-records', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mileage_records')
        .select('*')
        .order('record_date', { ascending: false });

      if (error) throw error;
      return data as MileageRecord[];
    },
  });
}

export function useMileageAnalytics() {
  return useQuery({
    queryKey: ['mileage-analytics'],
    queryFn: async () => {
      // Fetch mileage records
      const { data: mileageRecords, error: mileageError } = await supabase
        .from('mileage_records')
        .select('*')
        .order('record_date', { ascending: false });

      if (mileageError) throw mileageError;

      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration, make, model, is_active')
        .order('registration');

      if (vehiclesError) throw vehiclesError;

      // Fetch fuel records for MPG calculation
      const { data: fuelRecords, error: fuelError } = await supabase
        .from('fuel_records')
        .select('vehicle_id, litres, total_cost, mileage, fill_date')
        .order('fill_date', { ascending: false });

      if (fuelError) throw fuelError;

      const typedMileage = mileageRecords as MileageRecord[];
      const activeVehicles = vehicles?.filter(v => v.is_active !== false) || [];

      // Calculate mileage by vehicle
      const mileageByVehicle: MileageByVehicle[] = activeVehicles.map(vehicle => {
        const vehicleMileage = typedMileage.filter(m => m.vehicle_id === vehicle.id);
        const totalMileage = vehicleMileage.reduce((sum, m) => sum + m.daily_mileage, 0);
        const avgDailyMileage = vehicleMileage.length > 0 ? totalMileage / vehicleMileage.length : 0;
        const latestOdometer = vehicleMileage.length > 0 ? vehicleMileage[0].odometer_reading : null;

        return {
          vehicleId: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          totalMileage,
          avgDailyMileage: Math.round(avgDailyMileage * 10) / 10,
          recordCount: vehicleMileage.length,
          latestOdometer,
        };
      }).sort((a, b) => b.totalMileage - a.totalMileage);

      // Calculate mileage by month (last 12 months)
      const now = new Date();
      const mileageByMonth: MileageByMonth[] = [];

      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = String(monthDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

        const monthRecords = typedMileage.filter(m => m.record_date.startsWith(monthKey));
        const totalMileage = monthRecords.reduce((sum, m) => sum + m.daily_mileage, 0);
        const avgDailyMileage = monthRecords.length > 0 ? totalMileage / monthRecords.length : 0;

        mileageByMonth.push({
          month: monthLabel,
          monthKey,
          totalMileage,
          avgDailyMileage: Math.round(avgDailyMileage * 10) / 10,
          recordCount: monthRecords.length,
        });
      }

      // Calculate MPG by vehicle (using fuel records)
      const mpgByVehicle = activeVehicles.map(vehicle => {
        const vehicleFuel = fuelRecords?.filter(f => f.vehicle_id === vehicle.id) || [];
        const mileages = vehicleFuel
          .filter(f => f.mileage !== null)
          .map(f => f.mileage as number)
          .sort((a, b) => a - b);

        const totalMiles = mileages.length >= 2 
          ? mileages[mileages.length - 1] - mileages[0]
          : 0;

        const totalLitres = vehicleFuel.reduce((sum, f) => sum + f.litres, 0);
        const totalFuelCost = vehicleFuel.reduce((sum, f) => sum + f.total_cost, 0);

        // MPG (UK gallons = 4.546 litres)
        const mpg = totalLitres > 0 && totalMiles > 0
          ? totalMiles / (totalLitres / 4.546)
          : 0;

        // Cost per mile
        const costPerMile = totalMiles > 0 ? totalFuelCost / totalMiles : 0;

        return {
          vehicleId: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          totalMiles,
          totalLitres: Math.round(totalLitres * 10) / 10,
          mpg: Math.round(mpg * 10) / 10,
          costPerMile: Math.round(costPerMile * 100) / 100,
        };
      }).filter(v => v.mpg > 0).sort((a, b) => b.mpg - a.mpg);

      // Total stats
      const totalMileage = typedMileage.reduce((sum, m) => sum + m.daily_mileage, 0);
      const avgDailyMileage = typedMileage.length > 0 ? totalMileage / typedMileage.length : 0;

      return {
        totalMileage,
        avgDailyMileage: Math.round(avgDailyMileage * 10) / 10,
        recordCount: typedMileage.length,
        mileageByVehicle,
        mileageByMonth,
        mpgByVehicle,
        mileageRecords: typedMileage,
      };
    },
  });
}
