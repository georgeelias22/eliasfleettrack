import { useState } from 'react';
import { useCreateFuelRecord } from '@/hooks/useFuelRecords';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Fuel, Plus, Loader2 } from 'lucide-react';

interface AddFuelRecordDialogProps {
  vehicleId?: string;
  trigger?: React.ReactNode;
}

export function AddFuelRecordDialog({ vehicleId, trigger }: AddFuelRecordDialogProps) {
  const [open, setOpen] = useState(false);
  const [fillDate, setFillDate] = useState(new Date().toISOString().split('T')[0]);
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');
  const [mileage, setMileage] = useState('');
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  
  const createFuelRecord = useCreateFuelRecord();
  const { toast } = useToast();

  const totalCost = litres && costPerLitre 
    ? (parseFloat(litres) * parseFloat(costPerLitre)).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!litres || !costPerLitre) {
      toast({
        title: 'Missing information',
        description: 'Please enter litres and cost per litre.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createFuelRecord.mutateAsync({
        vehicle_id: vehicleId,
        fill_date: fillDate,
        litres: parseFloat(litres),
        cost_per_litre: parseFloat(costPerLitre),
        total_cost: parseFloat(totalCost),
        mileage: mileage ? parseInt(mileage) : null,
        station: station || null,
        notes: notes || null,
      });

      toast({ title: 'Fuel record added' });
      setOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add fuel record.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFillDate(new Date().toISOString().split('T')[0]);
    setLitres('');
    setCostPerLitre('');
    setMileage('');
    setStation('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Fuel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" />
            Add Fuel Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fillDate">Date</Label>
              <Input
                id="fillDate"
                type="date"
                value={fillDate}
                onChange={(e) => setFillDate(e.target.value)}
                className="bg-secondary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileage">Mileage</Label>
              <Input
                id="mileage"
                type="number"
                placeholder="e.g. 45000"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="litres">Litres</Label>
              <Input
                id="litres"
                type="number"
                step="0.01"
                placeholder="e.g. 45.5"
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                className="bg-secondary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPerLitre">Cost per Litre (£)</Label>
              <Input
                id="costPerLitre"
                type="number"
                step="0.001"
                placeholder="e.g. 1.459"
                value={costPerLitre}
                onChange={(e) => setCostPerLitre(e.target.value)}
                className="bg-secondary/50"
                required
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Cost</span>
              <span className="text-2xl font-bold text-primary">£{totalCost}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="station">Station / Location</Label>
            <Input
              id="station"
              placeholder="e.g. Shell, BP..."
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary/50"
              rows={2}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full gradient-primary"
            disabled={createFuelRecord.isPending}
          >
            {createFuelRecord.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Fuel className="w-4 h-4 mr-2" />
            )}
            Add Fuel Record
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
