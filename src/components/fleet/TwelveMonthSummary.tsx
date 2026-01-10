import { Card, CardContent } from '@/components/ui/card';
import { Fuel, Wrench, PoundSterling, Car, TrendingUp, Calendar } from 'lucide-react';

interface TwelveMonthSummaryProps {
  totalCost: number;
  fuelCost: number;
  serviceCost: number;
  financeCost: number;
  taxCost: number;
  vehicleCount: number;
}

export function TwelveMonthSummary({ 
  totalCost, 
  fuelCost, 
  serviceCost, 
  financeCost, 
  taxCost,
  vehicleCount 
}: TwelveMonthSummaryProps) {
  const formatCurrency = (value: number) => 
    `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = [
    { label: 'Total Fleet Cost', value: formatCurrency(totalCost), icon: TrendingUp, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Fuel', value: formatCurrency(fuelCost), icon: Fuel, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Service & Repairs', value: formatCurrency(serviceCost), icon: Wrench, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
    { label: 'Finance', value: formatCurrency(financeCost), icon: PoundSterling, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Road Tax', value: formatCurrency(taxCost), icon: Calendar, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
    { label: 'Vehicles', value: vehicleCount.toString(), icon: Car, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
  ];

  return (
    <Card className="border-border/50 bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-border/50">
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
