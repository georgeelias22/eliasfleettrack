import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useVehicles } from '@/hooks/useVehicles';
import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { calculateVehicleMetrics } from '@/hooks/useVehicleComparison';
import { VehicleComparison } from '@/types/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { Car, DollarSign, Fuel, Gauge, Wrench, Leaf, Save } from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface VehicleComparisonDashboardProps {
  onSaveReport?: (config: { vehicleIds: string[]; dateRange: { start: string; end: string } }) => void;
}

export function VehicleComparisonDashboard({ onSaveReport }: VehicleComparisonDashboardProps) {
  const { data: vehicles } = useVehicles();
  const { data: analytics, isLoading } = useFleetAnalytics();
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [timePeriod, setTimePeriod] = useState<string>('12m');
  const [customDateRange, setCustomDateRange] = useState({
    start: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  const activeVehicles = vehicles?.filter(v => v.is_active) || [];

  const dateRange = useMemo(() => {
    if (timePeriod === 'custom') {
      return customDateRange;
    }
    const end = new Date();
    let start: Date;
    switch (timePeriod) {
      case '1m': start = subMonths(end, 1); break;
      case '3m': start = subMonths(end, 3); break;
      case '6m': start = subMonths(end, 6); break;
      case '12m': default: start = subMonths(end, 12); break;
    }
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }, [timePeriod, customDateRange]);

  const comparisons = useMemo(() => {
    if (!analytics || !vehicles) return [];

    const vehiclesToCompare = selectedVehicleIds.length > 0
      ? vehicles.filter(v => selectedVehicleIds.includes(v.id))
      : activeVehicles.slice(0, 4);

    return vehiclesToCompare.map(vehicle => {
      return calculateVehicleMetrics(
        {
          vehicleId: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          fuelType: (vehicle as any).fuel_type || 'petrol',
          annualTax: vehicle.annual_tax || 0,
          monthlyFinance: vehicle.monthly_finance || 0,
        },
        analytics.fuelRecords || [],
        analytics.serviceRecords || [],
        analytics.documents || [],
        dateRange
      );
    });
  }, [analytics, vehicles, selectedVehicleIds, activeVehicles, dateRange]);

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(prev => 
      prev.includes(vehicleId)
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const costChartData = comparisons.map(c => ({
    name: c.registration,
    'Fuel': c.fuelCost,
    'Service': c.serviceCost,
    'Fixed': c.fixedCost,
  }));

  const efficiencyChartData = comparisons.map(c => ({
    name: c.registration,
    'MPG': c.mpg,
    'Cost/Mile (p)': c.costPerMile * 100,
  }));

  // Normalize data for radar chart (0-100 scale)
  const maxValues = {
    mpg: Math.max(...comparisons.map(c => c.mpg), 1),
    costEfficiency: Math.max(...comparisons.map(c => 1 / (c.costPerMile || 1)), 1),
    reliability: Math.max(...comparisons.map(c => c.avgDaysBetweenService || 365), 1),
    greenScore: 100,
  };

  const radarData = [
    { metric: 'Fuel Efficiency', ...Object.fromEntries(comparisons.map(c => [c.registration, (c.mpg / maxValues.mpg) * 100])) },
    { metric: 'Cost Efficiency', ...Object.fromEntries(comparisons.map(c => [c.registration, ((1 / (c.costPerMile || 1)) / maxValues.costEfficiency) * 100])) },
    { metric: 'Reliability', ...Object.fromEntries(comparisons.map(c => [c.registration, ((c.avgDaysBetweenService || 365) / maxValues.reliability) * 100])) },
    { metric: 'Green Score', ...Object.fromEntries(comparisons.map(c => [c.registration, Math.max(0, 100 - (c.co2Emissions / 100))])) },
  ];

  const colors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading comparison data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Comparison Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-2 block">Select Vehicles (max 5)</Label>
              <div className="flex flex-wrap gap-2">
                {activeVehicles.map(vehicle => (
                  <label
                    key={vehicle.id}
                    className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedVehicleIds.includes(vehicle.id)}
                      onCheckedChange={() => toggleVehicle(vehicle.id)}
                      disabled={!selectedVehicleIds.includes(vehicle.id) && selectedVehicleIds.length >= 5}
                    />
                    <span className="text-sm font-medium">{vehicle.registration}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Time Period</Label>
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 Month</SelectItem>
                  <SelectItem value="3m">3 Months</SelectItem>
                  <SelectItem value="6m">6 Months</SelectItem>
                  <SelectItem value="12m">12 Months</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {timePeriod === 'custom' && (
              <div className="flex gap-2 items-end">
                <div>
                  <Label className="mb-2 block">From</Label>
                  <Input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">To</Label>
                  <Input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            )}
            {onSaveReport && (
              <Button
                variant="outline"
                onClick={() => onSaveReport({ vehicleIds: selectedVehicleIds, dateRange })}
                className="self-end"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {comparisons.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Select vehicles above to compare
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {comparisons.map((comp, idx) => (
              <Card key={comp.vehicleId} style={{ borderColor: colors[idx] }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx] }} />
                    {comp.registration}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{comp.make} {comp.model}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="font-medium">£{comp.totalCost.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost/Mile</span>
                    <span className="font-medium">{(comp.costPerMile * 100).toFixed(1)}p</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MPG</span>
                    <span className="font-medium">{comp.mpg.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CO₂</span>
                    <span className="font-medium">{(comp.co2Emissions / 1000).toFixed(2)}t</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cost Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cost Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                    <XAxis type="number" tickFormatter={(v) => `£${v}`} stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                    <YAxis type="category" dataKey="name" width={80} stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `£${v.toFixed(2)}`} />} />
                    <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                    <Bar dataKey="Fuel" stackId="a" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="Service" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="Fixed" stackId="a" fill="hsl(var(--chart-3))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Efficiency Comparison */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Efficiency Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={efficiencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis dataKey="name" stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                      <YAxis stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                      <Bar dataKey="MPG" fill="hsl(var(--chart-1))" />
                      <Bar dataKey="Cost/Mile (p)" fill="hsl(var(--chart-4))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Overall Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--chart-grid))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--chart-text))', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--chart-text))' }} stroke="hsl(var(--chart-grid))" />
                      {comparisons.map((comp, idx) => (
                        <Radar
                          key={comp.vehicleId}
                          name={comp.registration}
                          dataKey={comp.registration}
                          stroke={colors[idx]}
                          fill={colors[idx]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Metric</th>
                      {comparisons.map((c, idx) => (
                        <th key={c.vehicleId} className="text-right py-3 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx] }} />
                            {c.registration}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Total Cost</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right font-medium">
                          £{c.totalCost.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Fuel Cost</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">£{c.fuelCost.toFixed(2)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Service Cost</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">£{c.serviceCost.toFixed(2)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Fixed Costs</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">£{c.fixedCost.toFixed(2)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Total Miles</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{c.totalMiles.toLocaleString()}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Cost per Mile</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{(c.costPerMile * 100).toFixed(1)}p</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">MPG</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{c.mpg.toFixed(1)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Litres Used</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{c.litresUsed.toFixed(1)}L</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Service Count</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{c.serviceCount}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">Avg Days Between Service</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">
                          {c.avgDaysBetweenService > 0 ? c.avgDaysBetweenService : 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-muted-foreground">CO₂ Emissions</td>
                      {comparisons.map(c => (
                        <td key={c.vehicleId} className="py-2 px-2 text-right">{c.co2Emissions.toFixed(0)} kg</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
