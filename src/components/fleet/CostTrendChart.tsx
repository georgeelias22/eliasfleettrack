import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface CostTrendChartProps {
  data: { month: string; cost: number; fuelCost: number; financeCost: number }[];
}

export function CostTrendChart({ data }: CostTrendChartProps) {
  const hasData = data.some(d => d.cost > 0);

  if (!hasData) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        <p>No cost data available yet</p>
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="financeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
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
            formatter={(value: number, name: string) => {
              const label = name === 'cost' ? 'Total' : name === 'fuelCost' ? 'Fuel' : 'Finance';
              return [`£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, label];
            }}
          />
          <Legend 
            formatter={(value) => {
              const labels: Record<string, string> = { cost: 'Total', fuelCost: 'Fuel', financeCost: 'Finance' };
              return labels[value] || value;
            }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#costGradient)"
          />
          <Area
            type="monotone"
            dataKey="fuelCost"
            stroke="hsl(45, 93%, 47%)"
            strokeWidth={2}
            fill="url(#fuelGradient)"
          />
          <Area
            type="monotone"
            dataKey="financeCost"
            stroke="hsl(160, 84%, 39%)"
            strokeWidth={2}
            fill="url(#financeGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
