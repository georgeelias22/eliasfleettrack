import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Car, 
  PoundSterling, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Calendar,
  Fuel,
  Droplets
} from 'lucide-react';
import { CostTrendChart } from './CostTrendChart';
import { UpcomingMOTList } from './UpcomingMOTList';
import { CostByVehicleChart } from './CostByVehicleChart';
import { FuelTrendChart } from './FuelTrendChart';

export function FleetDashboard() {
  const { data: analytics, isLoading, error } = useFleetAnalytics();

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

  const statCards = [
    {
      label: 'Total Vehicles',
      value: analytics.totalVehicles,
      icon: Car,
      className: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'Total Fleet Cost',
      value: `£${analytics.totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: PoundSterling,
      className: 'text-accent',
      bgClass: 'bg-accent/10',
    },
    {
      label: 'Fuel Costs',
      value: `£${analytics.totalFuelCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Fuel,
      className: 'text-amber-500',
      bgClass: 'bg-amber-500/10',
    },
    {
      label: 'Total Litres',
      value: `${analytics.totalLitres.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L`,
      icon: Droplets,
      className: 'text-sky-500',
      bgClass: 'bg-sky-500/10',
    },
    {
      label: 'Avg £/Litre',
      value: `£${analytics.avgCostPerLitre.toFixed(3)}`,
      icon: TrendingUp,
      className: 'text-violet-500',
      bgClass: 'bg-violet-500/10',
    },
    {
      label: 'Finance Costs',
      value: `£${analytics.totalFinanceCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: PoundSterling,
      className: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10',
    },
    {
      label: 'MOT Due Soon',
      value: analytics.motStats.dueSoon + analytics.motStats.overdue,
      icon: analytics.motStats.overdue > 0 ? AlertTriangle : Clock,
      className: analytics.motStats.overdue > 0 ? 'text-status-danger' : 'text-status-warning',
      bgClass: analytics.motStats.overdue > 0 ? 'bg-status-danger/10' : 'bg-status-warning/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50 gradient-card overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className="text-xl font-bold text-foreground mt-2">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgClass}`}>
                  <stat.icon className={`w-4 h-4 ${stat.className}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fuel Trend Chart - Full Width */}
      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Fuel className="w-4 h-4 text-amber-500" />
            Fuel Spending (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FuelTrendChart data={analytics.fuelByMonth} />
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Chart */}
        <Card className="border-border/50 gradient-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="w-4 h-4 text-primary" />
              Total Cost Trends (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostTrendChart data={analytics.costByMonth} />
          </CardContent>
        </Card>

        {/* Cost by Vehicle Chart */}
        <Card className="border-border/50 gradient-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PoundSterling className="w-4 h-4 text-accent" />
              Cost by Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostByVehicleChart data={analytics.costByVehicle} />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming MOTs */}
      <Card className="border-border/50 gradient-card">
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
