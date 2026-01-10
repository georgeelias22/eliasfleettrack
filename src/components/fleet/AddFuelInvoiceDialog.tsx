import { useState } from 'react';
import { useVehicles } from '@/hooks/useVehicles';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, Plus, Trash2, Loader2, Fuel } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FuelLineItem {
  id: string;
  vehicleId: string;
  litres: string;
  costPerLitre: string;
  mileage: string;
}

export function AddFuelInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [station, setStation] = useState('');
  const [lineItems, setLineItems] = useState<FuelLineItem[]>([
    { id: crypto.randomUUID(), vehicleId: '', litres: '', costPerLitre: '', mileage: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  
  const { data: vehicles = [] } = useVehicles();
  const createFuelRecord = useCreateFuelRecord();
  const { toast } = useToast();

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), vehicleId: '', litres: '', costPerLitre: '', mileage: '' }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof FuelLineItem, value: string) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateLineTotal = (item: FuelLineItem) => {
    if (item.litres && item.costPerLitre) {
      return (parseFloat(item.litres) * parseFloat(item.costPerLitre)).toFixed(2);
    }
    return '0.00';
  };

  const calculateInvoiceTotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + parseFloat(calculateLineTotal(item));
    }, 0).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validItems = lineItems.filter(item => 
      item.vehicleId && item.litres && item.costPerLitre
    );

    if (validItems.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please add at least one valid line item with vehicle, litres, and cost.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    
    try {
      // Create all fuel records in parallel
      await Promise.all(validItems.map(item => 
        createFuelRecord.mutateAsync({
          vehicle_id: item.vehicleId,
          fill_date: invoiceDate,
          litres: parseFloat(item.litres),
          cost_per_litre: parseFloat(item.costPerLitre),
          total_cost: parseFloat(calculateLineTotal(item)),
          mileage: item.mileage ? parseInt(item.mileage) : null,
          station: station || null,
          notes: `Invoice ${invoiceDate}`,
        })
      ));

      toast({ 
        title: 'Fuel invoice added',
        description: `${validItems.length} fuel record${validItems.length > 1 ? 's' : ''} created.`,
      });
      setOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add fuel records.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setStation('');
    setLineItems([
      { id: crypto.randomUUID(), vehicleId: '', litres: '', costPerLitre: '', mileage: '' }
    ]);
  };

  const getVehicleLabel = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.registration} - ${vehicle.make} ${vehicle.model}` : '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Receipt className="w-4 h-4" />
          Add Fuel Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Add Fuel Invoice
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="bg-secondary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station">Station / Supplier</Label>
              <Input
                id="station"
                placeholder="e.g. Shell, BP, Texaco..."
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Vehicle
              </Button>
            </div>
            
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3 pr-4">
                {lineItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Line {index + 1}
                      </span>
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeLineItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Vehicle</Label>
                      <Select
                        value={item.vehicleId}
                        onValueChange={(value) => updateLineItem(item.id, 'vehicleId', value)}
                      >
                        <SelectTrigger className="bg-secondary/50">
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.registration} - {vehicle.make} {vehicle.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Litres</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="45.5"
                          value={item.litres}
                          onChange={(e) => updateLineItem(item.id, 'litres', e.target.value)}
                          className="bg-secondary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>£/Litre</Label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="1.459"
                          value={item.costPerLitre}
                          onChange={(e) => updateLineItem(item.id, 'costPerLitre', e.target.value)}
                          className="bg-secondary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mileage</Label>
                        <Input
                          type="number"
                          placeholder="45000"
                          value={item.mileage}
                          onChange={(e) => updateLineItem(item.id, 'mileage', e.target.value)}
                          className="bg-secondary/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-sm text-muted-foreground">Line Total</span>
                      <span className="font-semibold text-primary">
                        £{calculateLineTotal(item)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">Invoice Total</span>
                <p className="text-xs text-muted-foreground">
                  {lineItems.filter(i => i.vehicleId && i.litres && i.costPerLitre).length} vehicle(s)
                </p>
              </div>
              <span className="text-2xl font-bold text-primary">£{calculateInvoiceTotal()}</span>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full gradient-primary"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Fuel className="w-4 h-4 mr-2" />
            )}
            Add Fuel Invoice
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
