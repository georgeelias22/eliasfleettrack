import { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Bar
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FuelTrendChartProps {
  data: { 
    month: string;
    monthKey: string;
    fuelCost: number; 
    litres: number; 
    avgCostPerLitre: number;
    fillCount: number;
  }[];
}

type TimePeriod = '3m' | '6m' | '12m';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
];

export function FuelTrendChart({ data }: FuelTrendChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('12m');

  const monthsToShow = parseInt(timePeriod);
  const filteredData = data.slice(-monthsToShow);

  const hasData = filteredData.some((d) => d.fuelCost > 0);

  const monthLabelByKey: Record<string, string> = Object.fromEntries(
    filteredData.map((d) => [d.monthKey, d.month])
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value} className="text-xs">
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <div className="h-[220px] flex items-center justify-center text-muted-foreground">
          <p>No fuel data available for this period</p>
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelCostGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="monthKey"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => monthLabelByKey[String(value)] ?? String(value)}
              />
              <YAxis
                yAxisId="cost"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <YAxis
                yAxisId="litres"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}L`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                labelFormatter={(label) => monthLabelByKey[String(label)] ?? String(label)}
                formatter={(value: number, name: string) => {
                  if (name === 'fuelCost')
                    return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'Fuel Cost'];
                  if (name === 'litres')
                    return [`${value.toLocaleString('en-GB', { minimumFractionDigits: 1 })}L`, 'Litres'];
                  if (name === 'avgCostPerLitre') return [`£${value.toFixed(3)}/L`, 'Avg Price'];
                  return [value, name];
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    fuelCost: 'Fuel Cost',
                    litres: 'Litres',
                    avgCostPerLitre: 'Avg £/L',
                  };
                  return labels[value] || value;
                }}
              />
              <Area
                yAxisId="cost"
                type="monotone"
                dataKey="fuelCost"
                stroke="hsl(45, 93%, 47%)"
                strokeWidth={2}
                fill="url(#fuelCostGradient)"
              />
              <Bar
                yAxisId="litres"
                dataKey="litres"
                fill="hsl(200, 70%, 50%)"
                opacity={0.6}
                radius={[4, 4, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
