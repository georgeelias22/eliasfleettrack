import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MPGData {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  totalMiles: number;
  totalLitres: number;
  mpg: number;
  costPerMile: number;
}

interface FuelEfficiencyChartProps {
  data: MPGData[];
}

export function FuelEfficiencyChart({ data }: FuelEfficiencyChartProps) {
  const chartData = data.slice(0, 6).map(v => ({
    name: v.registration,
    MPG: v.mpg,
    'Cost/Mile (p)': Math.round(v.costPerMile * 100),
    totalMiles: v.totalMiles,
    totalLitres: v.totalLitres,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No fuel efficiency data available. Add fuel records with mileage readings.
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis
            dataKey="name"
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
          />
          <Tooltip content={<EfficiencyTooltip />} />
          <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
          <Bar dataKey="MPG" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Cost/Mile (p)" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EfficiencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-muted-foreground">
          MPG: <span className="text-foreground font-medium">{data.MPG}</span>
        </p>
        <p className="text-muted-foreground">
          Cost/Mile: <span className="text-foreground font-medium">{data['Cost/Mile (p)']}p</span>
        </p>
        <p className="text-muted-foreground">
          Total Miles: <span className="text-foreground font-medium">{data.totalMiles.toLocaleString()}</span>
        </p>
        <p className="text-muted-foreground">
          Fuel Used: <span className="text-foreground font-medium">{data.totalLitres}L</span>
        </p>
      </div>
    </div>
  );
}
