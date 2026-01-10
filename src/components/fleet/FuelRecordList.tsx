import { FuelRecord } from '@/types/fuel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteFuelRecord } from '@/hooks/useFuelRecords';
import { useToast } from '@/hooks/use-toast';
import { Fuel, Trash2, MapPin, Gauge } from 'lucide-react';
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

interface FuelRecordListProps {
  records: FuelRecord[];
  vehicleId: string;
}

export function FuelRecordList({ records, vehicleId }: FuelRecordListProps) {
  const deleteFuelRecord = useDeleteFuelRecord();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
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

  // Calculate summary stats
  const totalLitres = records.reduce((sum, r) => sum + r.litres, 0);
  const totalCost = records.reduce((sum, r) => sum + r.total_cost, 0);
  const avgCostPerLitre = totalLitres > 0 ? totalCost / totalLitres : 0;

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Fuel className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No fuel records yet</p>
        <p className="text-sm mt-1">Add your first fuel fill-up to start tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-secondary/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-lg font-bold text-primary">£{totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-secondary/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Litres</p>
            <p className="text-lg font-bold text-foreground">{totalLitres.toFixed(1)}L</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-secondary/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg. £/Litre</p>
            <p className="text-lg font-bold text-foreground">£{avgCostPerLitre.toFixed(3)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Records List */}
      <div className="space-y-2">
        {records.map((record) => (
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(record.fill_date), 'dd MMM yyyy')}
                    </p>
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
                        onClick={() => handleDelete(record.id)}
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
        ))}
      </div>
    </div>
  );
}
