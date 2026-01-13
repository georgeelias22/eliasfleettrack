import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MileageRecord } from '@/hooks/useMileageRecords';
import { Vehicle } from '@/types/fleet';

interface MileageByVehicleChartProps {
  mileageRecords: MileageRecord[];
  vehicles: Vehicle[];
}

const COLORS = [
  'hsl(160, 60%, 45%)',
  'hsl(200, 70%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 60%, 55%)',
  'hsl(340, 70%, 50%)',
  'hsl(120, 50%, 45%)',
];

export function MileageByVehicleChart({ mileageRecords, vehicles }: MileageByVehicleChartProps) {
  // Calculate total mileage per vehicle
  const mileageByVehicle = vehicles.map((vehicle, index) => {
    const vehicleRecords = mileageRecords.filter(r => r.vehicle_id === vehicle.id);
    const totalMileage = vehicleRecords.reduce((sum, r) => sum + r.daily_mileage, 0);
    
    return {
      name: vehicle.registration,
      fullName: `${vehicle.make} ${vehicle.model}`,
      mileage: totalMileage,
      color: COLORS[index % COLORS.length],
    };
  }).filter(v => v.mileage > 0)
    .sort((a, b) => b.mileage - a.mileage);

  if (mileageByVehicle.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        <p>No mileage data available</p>
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mileageByVehicle}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value.toLocaleString()}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, _name: string, props: { payload?: { fullName?: string } }) => [
              `${value.toLocaleString('en-GB')} miles`,
              props.payload?.fullName || 'Miles'
            ]}
          />
          <Bar dataKey="mileage" radius={[0, 4, 4, 0]}>
            {mileageByVehicle.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}