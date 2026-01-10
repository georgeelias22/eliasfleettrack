import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Vehicle, ServiceRecord, Document, getMOTStatus, getDaysUntilMOT } from '@/types/fleet';
import { FuelRecord } from '@/types/fuel';

export interface FleetAnalytics {
  totalVehicles: number;
  totalCost: number;
  totalFuelCost: number;
  totalTaxCost: number;
  costByVehicle: { vehicleId: string; registration: string; make: string; model: string; cost: number; fuelCost: number }[];
  costByMonth: { month: string; cost: number; fuelCost: number }[];
  upcomingMOTs: { vehicle: Vehicle; daysUntil: number }[];
  overdueMOTs: Vehicle[];
  motStats: { valid: number; dueSoon: number; overdue: number; unknown: number };
}

export function useFleetAnalytics() {
  return useQuery({
    queryKey: ['fleet-analytics'],
    queryFn: async () => {
      // Fetch all vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('registration');
      
      if (vehiclesError) throw vehiclesError;

      // Fetch all service records
      const { data: serviceRecords, error: recordsError } = await supabase
        .from('service_records')
        .select('*')
        .order('service_date', { ascending: false });
      
      if (recordsError) throw recordsError;

      // Fetch all documents with extracted costs
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .not('extracted_cost', 'is', null);
      
      if (docsError) throw docsError;

      // Fetch all fuel records
      const { data: fuelRecords, error: fuelError } = await supabase
        .from('fuel_records')
        .select('*')
        .order('fill_date', { ascending: false });
      
      if (fuelError) throw fuelError;

      const typedVehicles = vehicles as Vehicle[];
      const typedRecords = serviceRecords as ServiceRecord[];
      const typedDocs = documents as Document[];
      const typedFuel = fuelRecords as FuelRecord[];

      // Calculate total costs from service records
      const serviceRecordCosts = typedRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
      
      // Calculate total costs from documents (AI extracted)
      const documentCosts = typedDocs.reduce((sum, doc) => sum + (doc.extracted_cost || 0), 0);
      
      // Calculate total fuel costs
      const totalFuelCost = typedFuel.reduce((sum, record) => sum + record.total_cost, 0);

      // Calculate total tax costs
      const totalTaxCost = typedVehicles.reduce((sum, v) => sum + (v.annual_tax || 0), 0);

      // Total cost
      const totalCost = serviceRecordCosts + documentCosts + totalFuelCost + totalTaxCost;

      // Cost by vehicle (including fuel and tax)
      const costByVehicle = typedVehicles.map(vehicle => {
        const vehicleServiceCosts = typedRecords
          .filter(r => r.vehicle_id === vehicle.id)
          .reduce((sum, r) => sum + (r.cost || 0), 0);
        const vehicleDocCosts = typedDocs
          .filter(d => d.vehicle_id === vehicle.id)
          .reduce((sum, d) => sum + (d.extracted_cost || 0), 0);
        const vehicleFuelCosts = typedFuel
          .filter(f => f.vehicle_id === vehicle.id)
          .reduce((sum, f) => sum + f.total_cost, 0);
        const vehicleTax = vehicle.annual_tax || 0;
        
        return {
          vehicleId: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          cost: vehicleServiceCosts + vehicleDocCosts + vehicleFuelCosts + vehicleTax,
          fuelCost: vehicleFuelCosts,
        };
      }).sort((a, b) => b.cost - a.cost);

      // Cost by month (last 12 months)
      const costByMonth: { month: string; cost: number; fuelCost: number }[] = [];
      const now = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = monthDate.toISOString().slice(0, 7);
        const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        
        const monthServiceCost = typedRecords
          .filter(r => r.service_date.startsWith(monthKey))
          .reduce((sum, r) => sum + (r.cost || 0), 0);
        
        const monthDocCost = typedDocs
          .filter(d => d.created_at.startsWith(monthKey))
          .reduce((sum, d) => sum + (d.extracted_cost || 0), 0);

        const monthFuelCost = typedFuel
          .filter(f => f.fill_date.startsWith(monthKey))
          .reduce((sum, f) => sum + f.total_cost, 0);
        
        costByMonth.push({
          month: monthLabel,
          cost: monthServiceCost + monthDocCost + monthFuelCost,
          fuelCost: monthFuelCost,
        });
      }

      // MOT analysis
      const motStats = { valid: 0, dueSoon: 0, overdue: 0, unknown: 0 };
      const upcomingMOTs: { vehicle: Vehicle; daysUntil: number }[] = [];
      const overdueMOTs: Vehicle[] = [];

      typedVehicles.forEach(vehicle => {
        const status = getMOTStatus(vehicle.mot_due_date);
        const daysUntil = getDaysUntilMOT(vehicle.mot_due_date);

        switch (status) {
          case 'valid':
            motStats.valid++;
            if (daysUntil !== null && daysUntil <= 60) {
              upcomingMOTs.push({ vehicle, daysUntil });
            }
            break;
          case 'due-soon':
            motStats.dueSoon++;
            if (daysUntil !== null) {
              upcomingMOTs.push({ vehicle, daysUntil });
            }
            break;
          case 'overdue':
            motStats.overdue++;
            overdueMOTs.push(vehicle);
            break;
          case 'unknown':
            motStats.unknown++;
            break;
        }
      });

      // Sort upcoming MOTs by days until
      upcomingMOTs.sort((a, b) => a.daysUntil - b.daysUntil);

      return {
        totalVehicles: typedVehicles.length,
        totalCost,
        totalFuelCost,
        totalTaxCost,
        costByVehicle,
        costByMonth,
        upcomingMOTs,
        overdueMOTs,
        motStats,
      } as FleetAnalytics;
    },
  });
}
