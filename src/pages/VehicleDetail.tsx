import { useParams, useNavigate } from 'react-router-dom';
import { useVehicle, useUpdateVehicle, useDeleteVehicle } from '@/hooks/useVehicles';
import { useServiceRecords } from '@/hooks/useServiceRecords';
import { useDocuments } from '@/hooks/useDocuments';
import { useFuelRecords } from '@/hooks/useFuelRecords';
import { useMileageRecords } from '@/hooks/useMileageRecords';
import { useAuth } from '@/hooks/useAuth';
import { MOTStatusBadge } from '@/components/fleet/MOTStatusBadge';
import { DocumentUpload } from '@/components/fleet/DocumentUpload';
import { DocumentList } from '@/components/fleet/DocumentList';
import { CostSummary } from '@/components/fleet/CostSummary';
import { VehicleCostCharts } from '@/components/fleet/VehicleCostCharts';
import { FuelEfficiencyCard } from '@/components/fleet/FuelEfficiencyCard';
import { AddFuelRecordDialog } from '@/components/fleet/AddFuelRecordDialog';
import { FuelRecordList } from '@/components/fleet/FuelRecordList';
import { VehicleTaxSettings } from '@/components/fleet/VehicleTaxSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Car, Loader2, Save, Trash2, Fuel, Power, Leaf } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

const FUEL_TYPES = [
  { value: 'petrol', label: 'Petrol', co2: 2.31 },
  { value: 'diesel', label: 'Diesel', co2: 2.68 },
  { value: 'hybrid', label: 'Hybrid', co2: 1.85 },
  { value: 'plug-in hybrid', label: 'Plug-in Hybrid', co2: 1.20 },
  { value: 'electric', label: 'Electric', co2: 0 },
];
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: vehicle, isLoading } = useVehicle(id || '');
  const { data: serviceRecords = [] } = useServiceRecords(id);
  const { data: documents = [] } = useDocuments(id);
  const { data: fuelRecords = [] } = useFuelRecords(id);
  const { data: mileageRecords = [] } = useMileageRecords(id);
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();

  const [motDate, setMotDate] = useState('');
  const [fuelType, setFuelType] = useState('petrol');

  useEffect(() => {
    if (vehicle?.mot_due_date) {
      setMotDate(vehicle.mot_due_date);
    }
    if ((vehicle as any)?.fuel_type) {
      setFuelType((vehicle as any).fuel_type);
    }
  }, [vehicle]);

  if (!user) {
    navigate('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <p className="text-muted-foreground">Vehicle not found</p>
      </div>
    );
  }

  const handleUpdateMOT = async () => {
    try {
      await updateVehicle.mutateAsync({ id: vehicle.id, mot_due_date: motDate || null });
      toast({ title: 'MOT date updated' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleUpdateFuelType = async () => {
    try {
      await updateVehicle.mutateAsync({ id: vehicle.id, fuel_type: fuelType } as any);
      toast({ title: 'Fuel type updated' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      toast({ title: 'Vehicle deleted' });
      navigate('/');
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  // Calculate fuel totals
  const totalFuelCost = fuelRecords.reduce((sum, r) => sum + r.total_cost, 0);

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
                <Car className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{vehicle.registration}</h1>
                  {vehicle.is_active === false && (
                    <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}</p>
              </div>
            </div>
            <MOTStatusBadge motDueDate={vehicle.mot_due_date} size="lg" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="fuel" className="gap-1">
              <Fuel className="w-4 h-4" />
              Fuel
            </TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            <Card className="border-border/50 gradient-card">
              <CardHeader>
                <CardTitle>Upload Service Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentUpload vehicleId={vehicle.id} />
              </CardContent>
            </Card>
            <DocumentList documents={documents} vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="fuel" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Fuel Records</h3>
                <p className="text-sm text-muted-foreground">
                  Track fuel expenses • Total: <span className="text-primary font-medium">£{totalFuelCost.toFixed(2)}</span>
                </p>
              </div>
              <AddFuelRecordDialog vehicleId={vehicle.id} />
            </div>
            
            {/* Fuel Efficiency Card */}
            <FuelEfficiencyCard 
              mileageRecords={mileageRecords}
              fuelRecords={fuelRecords}
            />
            
            <FuelRecordList records={fuelRecords} vehicleId={vehicle.id} />
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <VehicleCostCharts 
              fuelRecords={fuelRecords}
              serviceRecords={serviceRecords}
              documents={documents}
              annualTax={vehicle.annual_tax || 0}
              monthlyFinance={vehicle.monthly_finance || 0}
            />
            <CostSummary documents={documents} serviceRecords={serviceRecords} fuelRecords={fuelRecords} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="border-border/50 gradient-card">
              <CardHeader><CardTitle>MOT Date</CardTitle></CardHeader>
              <CardContent className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>MOT Due Date</Label>
                  <Input type="date" value={motDate} onChange={(e) => setMotDate(e.target.value)} className="bg-secondary/50" />
                </div>
                <Button onClick={handleUpdateMOT} disabled={updateVehicle.isPending} className="self-end gradient-primary">
                  <Save className="w-4 h-4 mr-2" /> Save
                </Button>
              </CardContent>
            </Card>

            {/* Fuel Type */}
            <Card className="border-border/50 gradient-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-green-500" />
                  Fuel Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Vehicle Fuel Type</Label>
                    <Select value={fuelType} onValueChange={setFuelType}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FUEL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {type.co2 > 0 ? `${type.co2} kg CO₂/L` : 'Zero emissions'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for carbon footprint calculations in reports
                    </p>
                  </div>
                  <Button 
                    onClick={handleUpdateFuelType} 
                    disabled={updateVehicle.isPending || fuelType === (vehicle as any).fuel_type} 
                    className="gradient-primary"
                  >
                    <Save className="w-4 h-4 mr-2" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <VehicleTaxSettings vehicle={vehicle} />

            {/* Vehicle Status */}
            <Card className="border-border/50 gradient-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Power className="w-5 h-5" /> Vehicle Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Active Vehicle</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.is_active !== false 
                        ? 'This vehicle is included in fleet calculations and reports' 
                        : 'This vehicle is excluded from fleet calculations but history is preserved'}
                    </p>
                  </div>
                  <Switch
                    checked={vehicle.is_active !== false}
                    onCheckedChange={async (checked) => {
                      try {
                        await updateVehicle.mutateAsync({ id: vehicle.id, is_active: checked });
                        toast({ title: checked ? 'Vehicle activated' : 'Vehicle marked as inactive' });
                      } catch {
                        toast({ title: 'Failed to update status', variant: 'destructive' });
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete Vehicle</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {vehicle.registration}?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all documents and records.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
