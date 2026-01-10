import { FuelRecord } from '@/types/fuel';
import { Vehicle } from '@/types/fleet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDeleteFuelRecord } from '@/hooks/useFuelRecords';
import { useToast } from '@/hooks/use-toast';
import { Fuel, Trash2, MapPin, Gauge, Car } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AllFuelRecordsListProps {
  records: FuelRecord[];
  vehicles: Vehicle[];
}

export function AllFuelRecordsList({ records, vehicles }: AllFuelRecordsListProps) {
  const deleteFuelRecord = useDeleteFuelRecord();
  const { toast } = useToast();

  const getVehicleInfo = (vehicleId: string) => {
    return vehicles.find(v => v.id === vehicleId);
  };

  const handleDelete = async (id: string, vehicleId: string) => {
    try {
      await deleteFuelRecord.mutateAsync({ id, vehicleId });
      toast({ title: 'Fuel record deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete fuel record.',
        variant: 'destructive',
      });
    }
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Fuel className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No fuel records yet</p>
        <p className="text-sm mt-1">Upload fuel invoices or add records manually</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-2">
        {records.map((record) => {
          const vehicle = getVehicleInfo(record.vehicle_id);
          return (
            <Card key={record.id} className="border-border/50 bg-secondary/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Fuel className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">
                          £{record.total_cost.toFixed(2)}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {record.litres.toFixed(1)}L @ £{record.cost_per_litre.toFixed(3)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.fill_date), 'dd MMM yyyy')}
                        </p>
                        {vehicle && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {vehicle.registration}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {record.station && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {record.station}
                          </span>
                        )}
                        {record.mileage && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {record.mileage.toLocaleString()} mi
                          </span>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete fuel record?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this fuel record from {format(new Date(record.fill_date), 'dd MMM yyyy')}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(record.id, record.vehicle_id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
