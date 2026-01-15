import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartTooltip } from '@/components/ui/chart-tooltip';

interface MileageData {
  month: string;
  monthKey: string;
  totalMileage: number;
  avgDailyMileage: number;
  recordCount: number;
}

interface MileageTrendChartProps {
  data: MileageData[];
}

const TIME_PERIODS = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
];

export function MileageTrendChart({ data }: MileageTrendChartProps) {
  const [timePeriod, setTimePeriod] = useState('12m');

  const filteredData = useMemo(() => {
    const months = timePeriod === '3m' ? 3 : timePeriod === '6m' ? 6 : 12;
    return data.slice(-months);
  }, [data, timePeriod]);

  const hasData = filteredData.some(d => d.totalMileage > 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map(period => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No mileage data available for this period
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="mileageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="hsl(var(--chart-text))"
                tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
              />
              <YAxis
                stroke="hsl(var(--chart-text))"
                tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<MileageTooltip />} />
              <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
              <Area
                type="monotone"
                dataKey="totalMileage"
                name="Total Miles"
                stroke="hsl(var(--chart-2))"
                fill="url(#mileageGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MileageTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-muted-foreground">
          Total Miles: <span className="text-foreground font-medium">{data.totalMileage.toLocaleString()}</span>
        </p>
        <p className="text-muted-foreground">
          Avg Daily: <span className="text-foreground font-medium">{data.avgDailyMileage.toLocaleString()}</span>
        </p>
        <p className="text-muted-foreground">
          Records: <span className="text-foreground font-medium">{data.recordCount}</span>
        </p>
      </div>
    </div>
  );
}
