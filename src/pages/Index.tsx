import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useVehicles } from '@/hooks/useVehicles';
import { AuthForm } from '@/components/auth/AuthForm';
import { VehicleCard } from '@/components/fleet/VehicleCard';
import { AddVehicleDialog } from '@/components/fleet/AddVehicleDialog';
import { FleetStats } from '@/components/fleet/FleetStats';
import { Button } from '@/components/ui/button';
import { Truck, LogOut, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">FleetTrack Pro</h1>
          </div>
          <div className="flex items-center gap-3">
            <AddVehicleDialog />
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Fleet Overview</h2>
          <p className="text-muted-foreground">Track MOT dates, service history, and costs</p>
        </div>

        <FleetStats vehicles={vehicles} />

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Your Vehicles</h3>
          
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
        </div>
      </main>
    </div>
  );
};

export default Index;
