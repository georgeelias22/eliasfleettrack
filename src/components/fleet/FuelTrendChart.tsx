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

interface FuelTrendChartProps {
  data: { 
    month: string; 
    fuelCost: number; 
    litres: number; 
    avgCostPerLitre: number;
    fillCount: number;
  }[];
}

export function FuelTrendChart({ data }: FuelTrendChartProps) {
  const hasData = data.some(d => d.fuelCost > 0);

  if (!hasData) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        <p>No fuel data available yet</p>
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fuelCostGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
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
            formatter={(value: number, name: string) => {
              if (name === 'fuelCost') return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'Fuel Cost'];
              if (name === 'litres') return [`${value.toLocaleString('en-GB', { minimumFractionDigits: 1 })}L`, 'Litres'];
              if (name === 'avgCostPerLitre') return [`£${value.toFixed(3)}/L`, 'Avg Price'];
              return [value, name];
            }}
          />
          <Legend 
            formatter={(value) => {
              const labels: Record<string, string> = { 
                fuelCost: 'Fuel Cost', 
                litres: 'Litres',
                avgCostPerLitre: 'Avg £/L'
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
  );
}
