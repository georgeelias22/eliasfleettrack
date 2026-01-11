import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { useAllFuelRecords } from '@/hooks/useFuelRecords';
import { useVehicles } from '@/hooks/useVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PoundSterling, 
  TrendingUp,
  Calendar,
  Fuel,
  Receipt,
  BarChart3,
  FileText,
  Car
} from 'lucide-react';
import { CostTrendChart } from './CostTrendChart';
import { CostByVehicleChart } from './CostByVehicleChart';
import { FuelTrendChart } from './FuelTrendChart';
import { FuelCostByVehicleChart } from './FuelCostByVehicleChart';
import { AllFuelRecordsList } from './AllFuelRecordsList';
import { TwelveMonthSummary } from './TwelveMonthSummary';
import { AddFuelInvoiceDialog } from './AddFuelInvoiceDialog';
import { AddVehicleDialog } from './AddVehicleDialog';
import { CombinedRemindersWidget } from './CombinedRemindersWidget';

export function FleetDashboard() {
  const { data: analytics, isLoading, error } = useFleetAnalytics();
  const { data: fuelRecords = [] } = useAllFuelRecords();
  const { data: vehicles = [] } = useVehicles();

  if (isLoading) {
    return <FleetDashboardSkeleton />;
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load analytics data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile Quick Actions - Prominent Upload Buttons (Mobile Only) */}
      <div className="md:hidden">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-amber-500/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-foreground">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <AddFuelInvoiceDialog 
                  trigger={
                    <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all active:scale-95">
                      <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-amber-500" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Scan Invoice</span>
                      <span className="text-xs text-muted-foreground text-center">Upload & auto-extract</span>
                    </button>
                  }
                />
                <AddVehicleDialog
                  trigger={
                    <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-primary/10 border-2 border-primary/30 hover:bg-primary/20 hover:border-primary/50 transition-all active:scale-95">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <Car className="w-7 h-7 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Add Vehicle</span>
                      <span className="text-xs text-muted-foreground text-center">Register new vehicle</span>
                    </button>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 12 Month Summary - All Key Stats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          12 Month Summary
        </h3>
        <TwelveMonthSummary 
          totalCost={analytics.totalCost}
          fuelCost={analytics.totalFuelCost}
          serviceCost={analytics.totalServiceCost}
          financeCost={analytics.totalFinanceCost}
          taxCost={analytics.totalTaxCost}
          vehicleCount={analytics.totalVehicles}
          totalLitres={analytics.totalLitres}
          avgCostPerLitre={analytics.avgCostPerLitre}
          motDueSoon={analytics.motStats.dueSoon}
          motOverdue={analytics.motStats.overdue}
        />
      </div>

      {/* Fuel Charts Row - Hidden on Mobile */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuel Trend Chart */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Fuel className="w-4 h-4 text-amber-500" />
              Fuel Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuelTrendChart data={analytics.fuelByMonth} />
          </CardContent>
        </Card>

        {/* Fuel Cost by Vehicle Chart */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="w-4 h-4 text-sky-500" />
              Fuel Cost by Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FuelCostByVehicleChart fuelRecords={fuelRecords} vehicles={vehicles} />
          </CardContent>
        </Card>
      </div>

      {/* Cost Trend Chart - Visible on all devices */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="w-4 h-4 text-primary" />
            Monthly Cost Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CostTrendChart data={analytics.costByMonth} />
        </CardContent>
      </Card>

      {/* Cost by Vehicle Chart - Hidden on Mobile */}
      <div className="hidden md:block">
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PoundSterling className="w-4 h-4 text-primary" />
              Cost by Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostByVehicleChart 
              vehicles={analytics.vehicleData}
              serviceRecords={analytics.serviceRecords}
              documents={analytics.documents}
              fuelRecords={analytics.fuelRecords}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Reminders and Fuel Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Combined Reminders Widget */}
        <CombinedRemindersWidget 
          upcomingMOTs={analytics.upcomingMOTs} 
          overdueMOTs={analytics.overdueMOTs} 
        />

        {/* All Fuel Records */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="w-4 h-4 text-amber-500" />
              Fuel Records ({fuelRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AllFuelRecordsList records={fuelRecords} vehicles={vehicles} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FleetDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Mobile Quick Actions Skeleton */}
      <div className="md:hidden">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
      
      {/* Summary Skeleton */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      
      {/* Charts Skeleton - Hidden on Mobile */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
      
      {/* Bottom Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-[150px] w-full" />
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-6">
            <Skeleton className="h-[150px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
