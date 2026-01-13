import { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MileageRecord } from '@/hooks/useMileageRecords';
import { format, subDays, parseISO } from 'date-fns';

interface DailyMileageChartProps {
  mileageRecords: MileageRecord[];
}

type TimePeriod = '7d' | '14d' | '30d';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

export function DailyMileageChart({ mileageRecords }: DailyMileageChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('14d');

  const daysToShow = parseInt(timePeriod);
  const cutoffDate = subDays(new Date(), daysToShow);

  // Filter and prepare data
  const filteredRecords = mileageRecords
    .filter(r => parseISO(r.record_date) >= cutoffDate)
    .sort((a, b) => a.record_date.localeCompare(b.record_date));

  // Aggregate by date (sum all vehicles for each day)
  const dailyData: Record<string, { date: string; mileage: number; vehicles: number }> = {};
  
  filteredRecords.forEach(record => {
    if (!dailyData[record.record_date]) {
      dailyData[record.record_date] = {
        date: record.record_date,
        mileage: 0,
        vehicles: 0,
      };
    }
    dailyData[record.record_date].mileage += record.daily_mileage;
    dailyData[record.record_date].vehicles += 1;
  });

  const chartData = Object.values(dailyData).map(d => ({
    ...d,
    displayDate: format(parseISO(d.date), 'EEE d'),
    fullDate: format(parseISO(d.date), 'EEEE, d MMMM yyyy'),
  }));

  const hasData = chartData.length > 0;

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
          <p>No mileage data available for this period</p>
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="displayDate"
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
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDate || ''}
                formatter={(value: number, _name: string, props: { payload?: { vehicles?: number } }) => [
                  `${value.toLocaleString('en-GB')} miles (${props.payload?.vehicles || 0} vehicles)`,
                  'Total Fleet Mileage'
                ]}
              />
              <Bar 
                dataKey="mileage" 
                fill="hsl(160, 60%, 45%)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}