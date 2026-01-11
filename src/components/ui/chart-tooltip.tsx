import { TooltipProps } from 'recharts';

interface CustomTooltipProps extends TooltipProps<number, string> {
  formatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[150px]">
      <p className="font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatter ? formatter(entry.value as number) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
