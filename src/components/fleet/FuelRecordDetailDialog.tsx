import { useState } from 'react';
import { FuelRecord } from '@/types/fuel';
import { Vehicle } from '@/types/fleet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Fuel, 
  Calendar, 
  MapPin, 
  Gauge, 
  Car, 
  Download, 
  FileText,
  PoundSterling,
  Droplets,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface FuelRecordDetailDialogProps {
  record: FuelRecord | null;
  vehicle: Vehicle | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FuelRecordDetailDialog({ 
  record, 
  vehicle, 
  open, 
  onOpenChange 
}: FuelRecordDetailDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  if (!record) return null;

  const handleDownloadInvoice = async () => {
    if (!record.invoice_file_path) return;
    
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('fuel-invoices')
        .download(record.invoice_file_path);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.invoice_file_path.split('/').pop() || 'invoice';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Invoice downloaded' });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download the invoice.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-amber-500" />
            Fuel Record Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground">
                £{record.total_cost.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(record.fill_date), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>
            {vehicle && (
              <Badge variant="outline" className="text-sm flex items-center gap-1 px-3 py-1">
                <Car className="w-4 h-4" />
                {vehicle.registration}
              </Badge>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Droplets className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Litres</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {record.litres.toFixed(2)}L
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <PoundSterling className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Price/Litre</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                £{record.cost_per_litre.toFixed(3)}
              </p>
            </div>

            {record.mileage && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gauge className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wide">Mileage</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {record.mileage.toLocaleString()} mi
                </p>
              </div>
            )}

            {record.station && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wide">Station</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {record.station}
                </p>
              </div>
            )}
          </div>

          {/* Vehicle Info */}
          {vehicle && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Car className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wide">Vehicle</span>
                </div>
                <p className="text-foreground font-medium">
                  {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
                </p>
              </div>
            </>
          )}

          {/* Notes */}
          {record.notes && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="text-foreground">{record.notes}</p>
              </div>
            </>
          )}

          {/* Invoice Download */}
          <Separator className="bg-border" />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Invoice</span>
            </div>
            
            {record.invoice_file_path ? (
              <Button
                onClick={handleDownloadInvoice}
                variant="outline"
                className="w-full gap-2"
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Original Invoice
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No invoice file attached to this record
              </p>
            )}
          </div>

          {/* Created Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Calendar className="w-3 h-3" />
            <span>Added {format(new Date(record.created_at), 'dd MMM yyyy HH:mm')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
