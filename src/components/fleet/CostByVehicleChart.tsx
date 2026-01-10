import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface CostByVehicleChartProps {
  data: { 
    vehicleId: string; 
    registration: string; 
    make: string; 
    model: string; 
    cost: number;
  }[];
}

export function CostByVehicleChart({ data }: CostByVehicleChartProps) {
  const hasData = data.some(d => d.cost > 0);
  const topVehicles = data.slice(0, 6);

  if (!hasData) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        <p>No cost data available yet</p>
      </div>
    );
  }

  const chartData = topVehicles.map(v => ({
    name: v.registration,
    cost: v.cost,
    fullName: `${v.make} ${v.model}`,
  }));

  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(200, 70%, 50%)',
    'hsl(280, 70%, 50%)',
    'hsl(330, 70%, 50%)',
    'hsl(45, 80%, 50%)',
  ];

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
            vertical={false}
          />
          <XAxis 
            dataKey="name" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            angle={-45}
            textAnchor="end"
            height={60}
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
            formatter={(value: number, name: string, props: any) => [
              `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
              props.payload.fullName
            ]}
          />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
