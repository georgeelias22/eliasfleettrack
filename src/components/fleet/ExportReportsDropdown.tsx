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
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
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
