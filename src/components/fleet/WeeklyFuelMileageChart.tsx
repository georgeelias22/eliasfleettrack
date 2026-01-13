import { useState, useMemo } from 'react';
import { 
  ComposedChart, 
  Bar, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval, parseISO } from 'date-fns';

interface FuelRecord {
  id: string;
  fill_date: string;
  total_cost: number;
  litres: number;
  vehicle_id: string;
}

interface MileageRecord {
  id: string;
  record_date: string;
  daily_mileage: number;
  vehicle_id: string;
}

interface WeeklyFuelMileageChartProps {
  fuelRecords: FuelRecord[];
  mileageRecords: MileageRecord[];
}

type TimePeriod = '4w' | '8w' | '12w';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '4w', label: 'Last 4 Weeks' },
  { value: '8w', label: 'Last 8 Weeks' },
  { value: '12w', label: 'Last 12 Weeks' },
];

export function WeeklyFuelMileageChart({ fuelRecords, mileageRecords }: WeeklyFuelMileageChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('4w');

  const chartData = useMemo(() => {
    const weeksToShow = parseInt(timePeriod);
    const endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
    const startDate = startOfWeek(subWeeks(endDate, weeksToShow - 1), { weekStartsOn: 1 });

    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekLabel = `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM')}`;
      const shortLabel = format(weekStart, 'dd/MM');

      // Sum fuel costs for this week
      const fuelCost = fuelRecords
        .filter(r => {
          const fillDate = parseISO(r.fill_date);
          return isWithinInterval(fillDate, { start: weekStart, end: weekEnd });
        })
        .reduce((sum, r) => sum + r.total_cost, 0);

      // Sum mileage for this week
      const mileage = mileageRecords
        .filter(r => {
          const recordDate = parseISO(r.record_date);
          return isWithinInterval(recordDate, { start: weekStart, end: weekEnd });
        })
        .reduce((sum, r) => sum + r.daily_mileage, 0);

      return {
        weekLabel,
        shortLabel,
        fuelCost: Math.round(fuelCost * 100) / 100,
        mileage: Math.round(mileage),
      };
    });
  }, [fuelRecords, mileageRecords, timePeriod]);

  const hasData = chartData.some(d => d.fuelCost > 0 || d.mileage > 0);

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
          <p>No data available for this period</p>
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
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
                yAxisId="mileage"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}mi`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.weekLabel || ''}
                formatter={(value: number, name: string) => {
                  if (name === 'fuelCost')
                    return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'Fuel Spend'];
                  if (name === 'mileage')
                    return [`${value.toLocaleString('en-GB')} mi`, 'Mileage'];
                  return [value, name];
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    fuelCost: 'Fuel Spend',
                    mileage: 'Mileage',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar
                yAxisId="cost"
                dataKey="fuelCost"
                fill="url(#fuelBarGradient)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <Line
                yAxisId="mileage"
                type="monotone"
                dataKey="mileage"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(142, 76%, 36%)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
