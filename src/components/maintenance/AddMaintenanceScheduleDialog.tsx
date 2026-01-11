import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMaintenanceSchedule } from '@/hooks/useMaintenanceSchedules';
import { useVehicles } from '@/hooks/useVehicles';
import { COMMON_MAINTENANCE_TYPES } from '@/types/maintenance';
import { useToast } from '@/hooks/use-toast';

export function AddMaintenanceScheduleDialog() {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [customType, setCustomType] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [lastCompletedDate, setLastCompletedDate] = useState('');
  const [lastCompletedMileage, setLastCompletedMileage] = useState('');
  const [notes, setNotes] = useState('');
  
  const { data: vehicles } = useVehicles();
  const createSchedule = useCreateMaintenanceSchedule();
  const { toast } = useToast();
  
  const resetForm = () => {
    setVehicleId('');
    setMaintenanceType('');
    setCustomType('');
    setIntervalMiles('');
    setIntervalMonths('');
    setLastCompletedDate('');
    setLastCompletedMileage('');
    setNotes('');
  };
  
  const handleMaintenanceTypeChange = (value: string) => {
    setMaintenanceType(value);
    const preset = COMMON_MAINTENANCE_TYPES.find(t => t.value === value);
    if (preset && preset.value !== 'custom') {
      if (preset.defaultMiles) setIntervalMiles(preset.defaultMiles.toString());
      if (preset.defaultMonths) setIntervalMonths(preset.defaultMonths.toString());
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const type = maintenanceType === 'custom' ? customType : 
      COMMON_MAINTENANCE_TYPES.find(t => t.value === maintenanceType)?.label || maintenanceType;
    
    if (!type.trim()) {
      toast({ title: 'Please select or enter a maintenance type', variant: 'destructive' });
      return;
    }
    
    if (!vehicleId) {
      toast({ title: 'Please select a vehicle', variant: 'destructive' });
      return;
    }
    
    // Calculate next due date and mileage
    let nextDueDate: string | null = null;
    let nextDueMileage: number | null = null;
    
    if (lastCompletedDate && intervalMonths) {
      const date = new Date(lastCompletedDate);
      date.setMonth(date.getMonth() + parseInt(intervalMonths));
      nextDueDate = date.toISOString().split('T')[0];
    } else if (intervalMonths) {
      const date = new Date();
      date.setMonth(date.getMonth() + parseInt(intervalMonths));
      nextDueDate = date.toISOString().split('T')[0];
    }
    
    if (lastCompletedMileage && intervalMiles) {
      nextDueMileage = parseInt(lastCompletedMileage) + parseInt(intervalMiles);
    }
    
    try {
      await createSchedule.mutateAsync({
        vehicle_id: vehicleId,
        maintenance_type: type.trim(),
        interval_miles: intervalMiles ? parseInt(intervalMiles) : null,
        interval_months: intervalMonths ? parseInt(intervalMonths) : null,
        last_completed_date: lastCompletedDate || null,
        last_completed_mileage: lastCompletedMileage ? parseInt(lastCompletedMileage) : null,
        next_due_date: nextDueDate,
        next_due_mileage: nextDueMileage,
        is_active: true,
        notes: notes.trim() || null,
      });
      
      toast({ title: 'Maintenance schedule created' });
      resetForm();
      setOpen(false);
    } catch (error) {
      toast({ title: 'Failed to create schedule', variant: 'destructive' });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Wrench className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Maintenance Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles?.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} - {vehicle.make} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maintenance-type">Maintenance Type *</Label>
            <Select value={maintenanceType} onValueChange={handleMaintenanceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select maintenance type" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_MAINTENANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {maintenanceType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-type">Custom Type Name</Label>
              <Input
                id="custom-type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter maintenance type"
              />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interval-miles">Interval (Miles)</Label>
              <Input
                id="interval-miles"
                type="number"
                value={intervalMiles}
                onChange={(e) => setIntervalMiles(e.target.value)}
                placeholder="e.g., 10000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval-months">Interval (Months)</Label>
              <Input
                id="interval-months"
                type="number"
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(e.target.value)}
                placeholder="e.g., 12"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="last-completed-date">Last Completed Date</Label>
              <Input
                id="last-completed-date"
                type="date"
                value={lastCompletedDate}
                onChange={(e) => setLastCompletedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-completed-mileage">Last Completed Mileage</Label>
              <Input
                id="last-completed-mileage"
                type="number"
                value={lastCompletedMileage}
                onChange={(e) => setLastCompletedMileage(e.target.value)}
                placeholder="Odometer reading"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSchedule.isPending}>
              {createSchedule.isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
