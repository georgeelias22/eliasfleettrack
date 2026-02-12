import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react';
import { useExportReports } from '@/hooks/useExportReports';
import { useVehicles } from '@/hooks/useVehicles';
import { useAllFuelRecords } from '@/hooks/useFuelRecords';
import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function ExportReportsDropdown() {
  const [exporting, setExporting] = useState(false);
  const { data: vehicles = [] } = useVehicles();
  const { data: fuelRecords = [] } = useAllFuelRecords();
  const { data: analytics } = useFleetAnalytics();
  const { toast } = useToast();
  const {
    exportFuelRecordsCSV,
    exportServiceRecordsCSV,
    exportFleetSummaryCSV,
    exportFleetSummaryPDF,
  } = useExportReports();

  const fetchServiceRecords = async () => {
    const { data, error } = await supabase
      .from('service_records')
      .select('*')
      .order('service_date', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const handleJsonExport = async () => {
    setExporting(true);
    try {
      // Fetch all data in parallel
      const [vehiclesRes, fuelRes, driversRes, mileageRes, serviceRes] = await Promise.all([
        supabase.from('vehicles').select('*').order('registration'),
        supabase.from('fuel_records').select('*').order('fill_date', { ascending: false }),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('mileage_records').select('*').order('record_date', { ascending: false }),
        supabase.from('service_records').select('*').order('service_date', { ascending: false }),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (fuelRes.error) throw fuelRes.error;
      if (driversRes.error) throw driversRes.error;
      if (mileageRes.error) throw mileageRes.error;
      if (serviceRes.error) throw serviceRes.error;

      // Build registration lookup
      const regMap = new Map<string, string>();
      for (const v of vehiclesRes.data || []) {
        regMap.set(v.id, v.registration);
      }

      const exportData = {
        vehicles: (vehiclesRes.data || []).map(v => ({
          registration: v.registration,
          make: v.make,
          model: v.model,
          year: v.year,
          vin: v.vin,
          mot_due_date: v.mot_due_date,
          fuel_type: v.fuel_type,
          annual_tax: v.annual_tax ? Number(v.annual_tax) : null,
          tax_paid_monthly: v.tax_paid_monthly,
          monthly_finance: v.monthly_finance ? Number(v.monthly_finance) : null,
          is_active: v.is_active,
        })),
        fuel_records: (fuelRes.data || []).map(r => ({
          vehicle_registration: regMap.get(r.vehicle_id) || r.vehicle_id,
          fill_date: r.fill_date,
          litres: Number(r.litres),
          cost_per_litre: Number(r.cost_per_litre),
          total_cost: Number(r.total_cost),
          mileage: r.mileage,
          station: r.station,
          notes: r.notes,
        })),
        drivers: (driversRes.data || []).map(d => ({
          name: d.name,
          email: d.email,
          phone: d.phone,
          license_number: d.license_number,
          license_expiry_date: d.license_expiry_date,
          last_check_code_date: d.last_check_code_date,
          next_check_code_due: d.next_check_code_due,
          notes: d.notes,
        })),
        mileage_records: (mileageRes.data || []).map(r => ({
          vehicle_registration: regMap.get(r.vehicle_id) || r.vehicle_id,
          record_date: r.record_date,
          daily_mileage: r.daily_mileage,
          odometer_reading: r.odometer_reading,
          source: r.source,
        })),
        maintenance_logs: (serviceRes.data || []).map(r => ({
          vehicle_registration: regMap.get(r.vehicle_id) || r.vehicle_id,
          service_date: r.service_date,
          service_type: r.service_type,
          description: r.description,
          cost: Number(r.cost),
          mileage: r.mileage,
          provider: r.provider,
          notes: r.notes,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: 'All fleet data exported to JSON.' });
    } catch (error) {
      console.error('JSON export error:', error);
      toast({ title: 'Export failed', description: 'Failed to export data.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async (type: 'fuel-csv' | 'service-csv' | 'summary-csv' | 'summary-pdf') => {
    setExporting(true);
    try {
      const serviceRecords = await fetchServiceRecords();

      switch (type) {
        case 'fuel-csv':
          exportFuelRecordsCSV(fuelRecords, vehicles);
          toast({ title: 'Export complete', description: 'Fuel records exported to CSV.' });
          break;
        case 'service-csv':
          exportServiceRecordsCSV(serviceRecords, vehicles);
          toast({ title: 'Export complete', description: 'Service records exported to CSV.' });
          break;
        case 'summary-csv':
          exportFleetSummaryCSV({
            vehicles,
            fuelRecords,
            serviceRecords,
            analytics: {
              totalCost: analytics?.totalCost || 0,
              totalFuelCost: analytics?.totalFuelCost || 0,
              totalServiceCost: analytics?.totalServiceCost || 0,
              totalFinanceCost: analytics?.totalFinanceCost || 0,
              totalTaxCost: analytics?.totalTaxCost || 0,
              totalLitres: analytics?.totalLitres || 0,
              avgCostPerLitre: analytics?.avgCostPerLitre || 0,
            },
          });
          toast({ title: 'Export complete', description: 'Fleet summary exported to CSV.' });
          break;
        case 'summary-pdf':
          exportFleetSummaryPDF({
            vehicles,
            fuelRecords,
            serviceRecords,
            analytics: {
              totalCost: analytics?.totalCost || 0,
              totalFuelCost: analytics?.totalFuelCost || 0,
              totalServiceCost: analytics?.totalServiceCost || 0,
              totalFinanceCost: analytics?.totalFinanceCost || 0,
              totalTaxCost: analytics?.totalTaxCost || 0,
              totalLitres: analytics?.totalLitres || 0,
              avgCostPerLitre: analytics?.avgCostPerLitre || 0,
            },
          });
          toast({ title: 'Export complete', description: 'Fleet summary exported to PDF.' });
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Reports</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleJsonExport} className="gap-2 cursor-pointer">
          <FileJson className="w-4 h-4 text-primary" />
          Export All Data (JSON)
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        
        <DropdownMenuItem onClick={() => handleExport('summary-pdf')} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-500" />
          Fleet Summary (PDF)
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('summary-csv')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          Fleet Summary (CSV)
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleExport('fuel-csv')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-amber-500" />
          Fuel Records (CSV)
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('service-csv')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-sky-500" />
          Service Records (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
