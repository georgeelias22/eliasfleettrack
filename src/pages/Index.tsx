import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVehicles } from '@/hooks/useVehicles';
import { AuthForm } from '@/components/auth/AuthForm';
import { VehicleCard } from '@/components/fleet/VehicleCard';
import { AddVehicleDialog } from '@/components/fleet/AddVehicleDialog';
import { AddFuelInvoiceDialog } from '@/components/fleet/AddFuelInvoiceDialog';
import { ExportReportsDropdown } from '@/components/fleet/ExportReportsDropdown';
import { FleetDashboard } from '@/components/fleet/FleetDashboard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, LogOut, Loader2, LayoutDashboard, Car, Settings } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">FleetTrack Pro</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportReportsDropdown />
            <AddFuelInvoiceDialog />
            <AddVehicleDialog />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">Fleet Overview</h2>
              <p className="text-muted-foreground">Track MOT dates, service history, and costs</p>
            </div>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-2">
                <Car className="w-4 h-4" />
                Vehicles
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-6">
            <FleetDashboard />
          </TabsContent>

          <TabsContent value="vehicles" className="mt-6">
            {vehiclesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-foreground mb-2">No vehicles yet</p>
                <p className="text-muted-foreground mb-6">Add your first vehicle to start tracking</p>
                <AddVehicleDialog />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
