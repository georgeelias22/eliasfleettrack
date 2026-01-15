import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface MileageByVehicleData {
  vehicleId: string;
  registration: string;
  make: string;
  model: string;
  totalMileage: number;
  avgDailyMileage: number;
  recordCount: number;
  latestOdometer: number | null;
}

interface MileageByVehicleChartProps {
  data: MileageByVehicleData[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function MileageByVehicleChart({ data }: MileageByVehicleChartProps) {
  const chartData = data.slice(0, 6).map(v => ({
    name: v.registration,
    totalMileage: v.totalMileage,
    avgDaily: v.avgDailyMileage,
    latestOdometer: v.latestOdometer,
  }));

  if (chartData.length === 0 || chartData.every(d => d.totalMileage === 0)) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No mileage data available
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical">
          <XAxis
            type="number"
            stroke="hsl(var(--chart-text))"
            tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
            tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            stroke="hsl(var(--chart-text))"
            tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }}
            axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
            tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
          />
          <Tooltip content={<MileageVehicleTooltip />} />
          <Bar dataKey="totalMileage" name="Total Miles" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MileageVehicleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-2">{data.name}</p>
      <div className="space-y-1">
        <p className="text-muted-foreground">
          Total Miles: <span className="text-foreground font-medium">{data.totalMileage.toLocaleString()}</span>
        </p>
        <p className="text-muted-foreground">
          Avg Daily: <span className="text-foreground font-medium">{data.avgDaily}</span>
        </p>
        {data.latestOdometer && (
          <p className="text-muted-foreground">
            Odometer: <span className="text-foreground font-medium">{data.latestOdometer.toLocaleString()}</span>
          </p>
        )}
      </div>
    </div>
  );
}
