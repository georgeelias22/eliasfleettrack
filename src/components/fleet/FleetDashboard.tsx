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
  BarChart3
} from 'lucide-react';
import { CostTrendChart } from './CostTrendChart';
import { UpcomingMOTList } from './UpcomingMOTList';
import { CostByVehicleChart } from './CostByVehicleChart';
import { FuelTrendChart } from './FuelTrendChart';
import { FuelCostByVehicleChart } from './FuelCostByVehicleChart';
import { AllFuelRecordsList } from './AllFuelRecordsList';
import { TwelveMonthSummary } from './TwelveMonthSummary';

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


      {/* Fuel Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Chart */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="w-4 h-4 text-primary" />
              Total Cost Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostTrendChart data={analytics.costByMonth} />
          </CardContent>
        </Card>

        {/* Cost by Vehicle Chart */}
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

      {/* Bottom Row - MOTs and Fuel Records */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming MOTs */}
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="w-4 h-4 text-status-warning" />
              Upcoming MOT Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingMOTList 
              upcomingMOTs={analytics.upcomingMOTs} 
              overdueMOTs={analytics.overdueMOTs} 
            />
          </CardContent>
        </Card>

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <CardContent className="p-6">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
