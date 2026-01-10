import { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FuelRecord } from '@/types/fuel';
import { Vehicle } from '@/types/fleet';

interface FuelCostByVehicleChartProps {
  fuelRecords: FuelRecord[];
  vehicles: Vehicle[];
}

type TimePeriod = '3m' | '6m' | '12m';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
];

// Generate a consistent color for each vehicle based on index
const VEHICLE_COLORS = [
  'hsl(217, 91%, 60%)',   // Primary blue
  'hsl(142, 76%, 36%)',   // Green
  'hsl(45, 93%, 47%)',    // Amber
  'hsl(280, 70%, 50%)',   // Purple
  'hsl(330, 70%, 50%)',   // Pink
  'hsl(200, 70%, 50%)',   // Cyan
  'hsl(15, 80%, 55%)',    // Orange
  'hsl(180, 60%, 45%)',   // Teal
];

export function FuelCostByVehicleChart({ fuelRecords, vehicles }: FuelCostByVehicleChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('12m');
  
  const monthsToShow = parseInt(timePeriod);
  
  // Group fuel records by month and vehicle
  const now = new Date();
  const months: { month: string; monthKey: string; [vehicleReg: string]: number | string }[] = [];
  
  // Generate months based on selected period
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = monthDate.toISOString().slice(0, 7);
    const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    
    const monthData: { month: string; monthKey: string; [vehicleReg: string]: number | string } = {
      month: monthLabel,
      monthKey,
    };
    
    // Add fuel costs for each vehicle
    vehicles.forEach(vehicle => {
      const vehicleFuelCost = fuelRecords
        .filter(f => f.vehicle_id === vehicle.id && f.fill_date.startsWith(monthKey))
        .reduce((sum, f) => sum + f.total_cost, 0);
      
      monthData[vehicle.registration] = vehicleFuelCost;
    });
    
    months.push(monthData);
  }

  // Filter to only vehicles that have fuel records in the period
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsToShow, 1);
  const vehiclesWithFuel = vehicles.filter(v => 
    fuelRecords.some(f => f.vehicle_id === v.id && new Date(f.fill_date) >= startDate)
  );

  const hasData = fuelRecords.length > 0 && vehiclesWithFuel.length > 0;

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
        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
          <p>No fuel data available for this period</p>
        </div>
      ) : (
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {vehiclesWithFuel.map((vehicle, index) => (
                  <linearGradient 
                    key={vehicle.id} 
                    id={`gradient-${vehicle.registration.replace(/\s+/g, '-')}`} 
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop 
                      offset="5%" 
                      stopColor={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} 
                      stopOpacity={0.4} 
                    />
                    <stop 
                      offset="95%" 
                      stopColor={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} 
                      stopOpacity={0.05} 
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
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
                formatter={(value: number, name: string) => [
                  `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
                  name
                ]}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
              {vehiclesWithFuel.map((vehicle, index) => (
                <Area
                  key={vehicle.id}
                  type="monotone"
                  dataKey={vehicle.registration}
                  stackId="1"
                  stroke={VEHICLE_COLORS[index % VEHICLE_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#gradient-${vehicle.registration.replace(/\s+/g, '-')})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
