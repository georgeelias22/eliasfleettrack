import { Card, CardContent } from '@/components/ui/card';
import { Fuel, Wrench, PoundSterling, Car, TrendingUp, Calendar, Droplets, AlertTriangle, Clock, Gauge, Route } from 'lucide-react';

interface TwelveMonthSummaryProps {
  totalCost: number;
  fuelCost: number;
  serviceCost: number;
  financeCost: number;
  taxCost: number;
  vehicleCount: number;
  totalLitres: number;
  avgCostPerLitre: number;
  motDueSoon: number;
  motOverdue: number;
  totalMileage: number;
  avgDailyMileage: number;
}

export function TwelveMonthSummary({ 
  totalCost, 
  fuelCost, 
  serviceCost, 
  financeCost, 
  taxCost,
  vehicleCount,
  totalLitres,
  avgCostPerLitre,
  motDueSoon,
  motOverdue,
  totalMileage,
  avgDailyMileage,
}: TwelveMonthSummaryProps) {
  const formatCurrency = (value: number) => 
    `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasMotIssues = motOverdue > 0;
  const motTotal = motDueSoon + motOverdue;
  const avgCostPerVehicle = vehicleCount > 0 ? totalCost / vehicleCount : 0;

  const items = [
    { label: 'Total Fleet Cost', value: formatCurrency(totalCost), icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Avg Cost/Vehicle', value: formatCurrency(avgCostPerVehicle), icon: Car, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
    { label: 'Total Miles', value: totalMileage.toLocaleString('en-GB'), icon: Route, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Avg Mi/Day', value: avgDailyMileage.toLocaleString('en-GB', { maximumFractionDigits: 1 }), icon: Gauge, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
    { label: 'Fuel', value: formatCurrency(fuelCost), icon: Fuel, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Service & Repairs', value: formatCurrency(serviceCost), icon: Wrench, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
    { label: 'Finance', value: formatCurrency(financeCost), icon: PoundSterling, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Road Tax', value: formatCurrency(taxCost), icon: Calendar, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
    { label: 'Total Litres', value: `${totalLitres.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L`, icon: Droplets, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { label: 'Avg £/Litre', value: `£${avgCostPerLitre.toFixed(3)}`, icon: TrendingUp, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: 'Vehicles', value: vehicleCount.toString(), icon: Car, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
    { label: 'MOT Due Soon', value: motTotal.toString(), icon: hasMotIssues ? AlertTriangle : Clock, color: hasMotIssues ? 'text-status-danger' : 'text-status-warning', bgColor: hasMotIssues ? 'bg-status-danger/10' : 'bg-status-warning/10' },
  ];

  return (
    <Card className="border-border/50 bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-12 divide-x divide-y lg:divide-y-0 divide-border/50">
          {items.map((item) => (
            <div key={item.label} className="p-4 flex flex-col items-center text-center gap-2">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-foreground mt-1">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
