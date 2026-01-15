import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MileageData {
  month: string;
  monthKey: string;
  totalMileage: number;
}

interface FuelData {
  month: string;
  monthKey: string;
  fuelCost: number;
}

interface MileageVsFuelChartProps {
  mileageData: MileageData[];
  fuelData: FuelData[];
}

const TIME_PERIODS = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '12m', label: '12 Months' },
];

export function MileageVsFuelChart({ mileageData, fuelData }: MileageVsFuelChartProps) {
  const [timePeriod, setTimePeriod] = useState('12m');

  const chartData = useMemo(() => {
    const months = timePeriod === '3m' ? 3 : timePeriod === '6m' ? 6 : 12;
    const mileageSlice = mileageData.slice(-months);
    const fuelSlice = fuelData.slice(-months);

    return mileageSlice.map((m, i) => ({
      month: m.month,
      mileage: m.totalMileage,
      fuelSpend: fuelSlice[i]?.fuelCost || 0,
    }));
  }, [mileageData, fuelData, timePeriod]);

  const hasData = chartData.some(d => d.mileage > 0 || d.fuelSpend > 0);

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
          No data available for this period
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <XAxis
                dataKey="month"
                stroke="hsl(var(--chart-text))"
                tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--chart-text))"
                tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--chart-text))"
                tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip content={<MileageFuelTooltip />} />
              <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
              <Bar
                yAxisId="left"
                dataKey="mileage"
                name="Miles"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="fuelSpend"
                name="Fuel Spend (£)"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-4))', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MileageFuelTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-muted-foreground">
          Miles: <span className="text-foreground font-medium">{data.mileage.toLocaleString()}</span>
        </p>
        <p className="text-muted-foreground">
          Fuel Spend: <span className="text-foreground font-medium">£{data.fuelSpend.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
