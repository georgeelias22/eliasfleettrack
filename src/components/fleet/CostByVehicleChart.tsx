import { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ServiceRecord, Document } from '@/types/fleet';
import { FuelRecord } from '@/types/fuel';

interface VehicleData {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  annualTax: number;
  monthlyFinance: number;
}

interface CostByVehicleChartProps {
  vehicles: VehicleData[];
  serviceRecords: ServiceRecord[];
  documents: Document[];
  fuelRecords: FuelRecord[];
}

type TimePeriod = 'all' | '1m' | '3m' | '6m' | '12m';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
];

function getDateFilter(period: TimePeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  const months = parseInt(period);
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
}

export function CostByVehicleChart({ vehicles, serviceRecords, documents, fuelRecords }: CostByVehicleChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  
  const dateFilter = getDateFilter(timePeriod);
  
  // Filter records based on time period
  const filteredServiceRecords = dateFilter 
    ? serviceRecords.filter(r => new Date(r.service_date) >= dateFilter)
    : serviceRecords;
    
  const filteredDocuments = dateFilter
    ? documents.filter(d => new Date(d.created_at) >= dateFilter)
    : documents;
    
  const filteredFuelRecords = dateFilter
    ? fuelRecords.filter(f => new Date(f.fill_date) >= dateFilter)
    : fuelRecords;

  // Calculate months in period for finance/tax proration
  const monthsInPeriod = timePeriod === 'all' ? 12 : parseInt(timePeriod);

  // Calculate costs per vehicle
  const chartData = vehicles.map(vehicle => {
    const vehicleServiceCosts = filteredServiceRecords
      .filter(r => r.vehicle_id === vehicle.vehicleId)
      .reduce((sum, r) => sum + (r.cost || 0), 0);
      
    const vehicleDocCosts = filteredDocuments
      .filter(d => d.vehicle_id === vehicle.vehicleId)
      .reduce((sum, d) => sum + (d.extracted_cost || 0), 0);
      
    const vehicleFuelCosts = filteredFuelRecords
      .filter(f => f.vehicle_id === vehicle.vehicleId)
      .reduce((sum, f) => sum + f.total_cost, 0);
      
    // Prorate tax and finance based on period
    const vehicleTax = (vehicle.annualTax / 12) * monthsInPeriod;
    const vehicleFinance = vehicle.monthlyFinance * monthsInPeriod;
    
    const totalCost = vehicleServiceCosts + vehicleDocCosts + vehicleFuelCosts + vehicleTax + vehicleFinance;
    
    return {
      name: vehicle.registration,
      cost: totalCost,
      fullName: `${vehicle.make} ${vehicle.model}`,
      serviceCost: vehicleServiceCosts + vehicleDocCosts,
      fuelCost: vehicleFuelCosts,
      fixedCost: vehicleTax + vehicleFinance,
    };
  }).sort((a, b) => b.cost - a.cost).slice(0, 6);

  const hasData = chartData.some(d => d.cost > 0);

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(200, 70%, 50%)',
    'hsl(280, 70%, 50%)',
    'hsl(330, 70%, 50%)',
    'hsl(45, 80%, 50%)',
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map(period => (
              <SelectItem key={period.value} value={period.value} className="text-xs">
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <p>No cost data available for this period</p>
        </div>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: any) => [
                  `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
                  props.payload.fullName
                ]}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
