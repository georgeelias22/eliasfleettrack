import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Fuel, Wrench, TrendingUp, PoundSterling } from 'lucide-react';
import { FuelRecord } from '@/types/fuel';
import { ServiceRecord, Document } from '@/types/fleet';

interface VehicleCostChartsProps {
  fuelRecords: FuelRecord[];
  serviceRecords: ServiceRecord[];
  documents: Document[];
  annualTax?: number;
  monthlyFinance?: number;
}

export function VehicleCostCharts({ 
  fuelRecords, 
  serviceRecords, 
  documents,
  annualTax = 0,
  monthlyFinance = 0
}: VehicleCostChartsProps) {
  
  // Calculate monthly costs for the last 12 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { 
      month: string; 
      monthKey: string; 
      fuel: number; 
      service: number; 
      tax: number;
      finance: number;
      total: number;
    }[] = [];

    const monthlyTax = annualTax / 12;

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

      // Fuel costs for this month
      const fuelCost = fuelRecords
        .filter(r => r.fill_date.startsWith(monthKey))
        .reduce((sum, r) => sum + r.total_cost, 0);

      // Service costs for this month
      const serviceCost = serviceRecords
        .filter(r => r.service_date.startsWith(monthKey))
        .reduce((sum, r) => sum + (r.cost || 0), 0);

      // Document extracted costs for this month (use extracted serviceDate if available)
      const docCost = documents
        .filter(d => {
          const extractedData = d.ai_extracted_data as { serviceDate?: string } | null;
          const effectiveDate = extractedData?.serviceDate || d.created_at;
          return effectiveDate.startsWith(monthKey);
        })
        .reduce((sum, d) => sum + (d.extracted_cost || 0), 0);

      const totalService = serviceCost + docCost;
      const total = fuelCost + totalService + monthlyTax + monthlyFinance;

      months.push({
        month: monthLabel,
        monthKey,
        fuel: Math.round(fuelCost * 100) / 100,
        service: Math.round(totalService * 100) / 100,
        tax: Math.round(monthlyTax * 100) / 100,
        finance: Math.round(monthlyFinance * 100) / 100,
        total: Math.round(total * 100) / 100,
      });
    }

    return months;
  }, [fuelRecords, serviceRecords, documents, annualTax, monthlyFinance]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalFuel = fuelRecords.reduce((sum, r) => sum + r.total_cost, 0);
    const totalService = serviceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalDocs = documents.reduce((sum, d) => sum + (d.extracted_cost || 0), 0);
    const totalTax = annualTax;
    const totalFinance = monthlyFinance * 12;
    
    return {
      fuel: totalFuel,
      service: totalService + totalDocs,
      tax: totalTax,
      finance: totalFinance,
      total: totalFuel + totalService + totalDocs + totalTax + totalFinance,
    };
  }, [fuelRecords, serviceRecords, documents, annualTax, monthlyFinance]);

  const formatCurrency = (value: number) => 
    `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Summary cards data
  const summaryItems = [
    { label: 'Total Cost', value: formatCurrency(totals.total), icon: PoundSterling, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Fuel', value: formatCurrency(totals.fuel), icon: Fuel, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Service & Repairs', value: formatCurrency(totals.service), icon: Wrench, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {summaryItems.map((item) => (
          <Card key={item.label} className="border-border/50 bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Cost Breakdown Chart */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="w-4 h-4 text-primary" />
            Monthly Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                    const labels: Record<string, string> = {
                      fuel: 'Fuel',
                      service: 'Service & Repairs',
                      tax: 'Road Tax',
                      finance: 'Finance',
                    };
                    return [`£${value.toFixed(2)}`, labels[name] || name];
                  }}
                />
                <Legend />
                <Bar dataKey="fuel" name="Fuel" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="service" name="Service" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="tax" name="Tax" stackId="a" fill="hsl(var(--chart-4))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="finance" name="Finance" stackId="a" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fuel Spending Trend */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Fuel className="w-4 h-4 text-amber-500" />
            Fuel Spending Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                  formatter={(value: number) => [`£${value.toFixed(2)}`, 'Fuel Cost']}
                />
                <Area 
                  type="monotone" 
                  dataKey="fuel" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  fill="url(#fuelGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Service & Repairs Trend */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wrench className="w-4 h-4 text-sky-500" />
            Service & Repairs Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="serviceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                  formatter={(value: number) => [`£${value.toFixed(2)}`, 'Service & Repairs']}
                />
                <Area 
                  type="monotone" 
                  dataKey="service" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  fill="url(#serviceGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
