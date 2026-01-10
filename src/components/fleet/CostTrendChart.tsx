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

interface CostTrendChartProps {
  data: { month: string; cost: number; fuelCost: number; financeCost: number }[];
}

type TimePeriod = '3m' | '6m' | '12m';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
];

export function CostTrendChart({ data }: CostTrendChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('12m');
  
  const monthsToShow = parseInt(timePeriod);
  const filteredData = data.slice(-monthsToShow);
  
  const hasData = filteredData.some(d => d.cost > 0);

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
        <div className="h-[170px] flex items-center justify-center text-muted-foreground">
          <p>No cost data available for this period</p>
        </div>
      ) : (
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="financeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
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
                formatter={(value: number, name: string) => {
                  const label = name === 'cost' ? 'Total' : name === 'fuelCost' ? 'Fuel' : 'Finance';
                  return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, label];
                }}
              />
              <Legend 
                formatter={(value) => {
                  const labels: Record<string, string> = { cost: 'Total', fuelCost: 'Fuel', financeCost: 'Finance' };
                  return labels[value] || value;
                }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#costGradient)"
              />
              <Area
                type="monotone"
                dataKey="fuelCost"
                stroke="hsl(45, 93%, 47%)"
                strokeWidth={2}
                fill="url(#fuelGradient)"
              />
              <Area
                type="monotone"
                dataKey="financeCost"
                stroke="hsl(160, 84%, 39%)"
                strokeWidth={2}
                fill="url(#financeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
