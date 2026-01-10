import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface AddVehicleDialogProps {
  trigger?: React.ReactNode;
}

export function AddVehicleDialog({ trigger }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [motDueDate, setMotDueDate] = useState('');
  
  const createVehicle = useCreateVehicle();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createVehicle.mutateAsync({
        registration: registration.toUpperCase(),
        make,
        model,
        year: year ? parseInt(year) : null,
        vin: vin || null,
        mot_due_date: motDueDate || null,
      });
      
      toast({
        title: 'Vehicle added',
        description: `${registration.toUpperCase()} has been added to your fleet.`,
      });
      
      setOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add vehicle. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setRegistration('');
    setMake('');
    setModel('');
    setYear('');
    setVin('');
    setMotDueDate('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border/50">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Add a new vehicle to your fleet. You can set the MOT due date to track expiry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registration">Registration *</Label>
              <Input
                id="registration"
                placeholder="AB12 CDE"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                required
                className="bg-secondary/50 uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mot-date">MOT Due Date</Label>
              <Input
                id="mot-date"
                type="date"
                value={motDueDate}
                onChange={(e) => setMotDueDate(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="make">Make *</Label>
              <Input
                id="make"
                placeholder="Ford"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                placeholder="Transit"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                placeholder="2022"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">VIN</Label>
              <Input
                id="vin"
                placeholder="Optional"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary" disabled={createVehicle.isPending}>
              {createVehicle.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Vehicle'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
