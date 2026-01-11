import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useVehicles } from '@/hooks/useVehicles';
import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { CO2_FACTORS, CO2_PER_TREE_PER_YEAR, CarbonFootprint } from '@/types/reports';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartTooltip } from '@/components/ui/chart-tooltip';
import { Leaf, TreePine, TrendingDown, AlertTriangle, Save, Car, Fuel } from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface CarbonFootprintDashboardProps {
  onSaveReport?: (config: { dateRange: { start: string; end: string } }) => void;
}

export function CarbonFootprintDashboard({ onSaveReport }: CarbonFootprintDashboardProps) {
  const { data: vehicles } = useVehicles();
  const { data: analytics, isLoading } = useFleetAnalytics();
  const [timePeriod, setTimePeriod] = useState<string>('12m');
  const [customDateRange, setCustomDateRange] = useState({
    start: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

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

  const carbonData = useMemo<CarbonFootprint[]>(() => {
    if (!analytics || !vehicles) return [];

    const activeVehicles = vehicles.filter(v => v.is_active);

    return activeVehicles.map(vehicle => {
      const fuelType = (vehicle as any).fuel_type || 'petrol';
      const co2Factor = CO2_FACTORS[fuelType.toLowerCase()] || CO2_FACTORS.petrol;

      // Filter fuel records by date range
      const vehicleFuelRecords = (analytics.fuelRecords || [])
        .filter(r => r.vehicle_id === vehicle.id)
        .filter(r => r.fill_date >= dateRange.start && r.fill_date <= dateRange.end);

      const litresUsed = vehicleFuelRecords.reduce((sum, r) => sum + Number(r.litres), 0);
      const co2Emissions = litresUsed * co2Factor;

      // Calculate mileage
      const mileages = vehicleFuelRecords
        .filter(r => r.mileage !== null)
        .map(r => r.mileage as number)
        .sort((a, b) => a - b);
      
      const totalMiles = mileages.length >= 2 
        ? mileages[mileages.length - 1] - mileages[0]
        : 0;

      const co2PerMile = totalMiles > 0 ? (co2Emissions / totalMiles) * 1000 : 0; // grams per mile

      // Calculate months for annualized tree count
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      const months = Math.max(1, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1);
      const annualizedCO2 = (co2Emissions / months) * 12;
      const treesNeeded = Math.ceil(annualizedCO2 / CO2_PER_TREE_PER_YEAR);

      return {
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        fuelType,
        litresUsed,
        co2Emissions,
        co2PerMile,
        treesNeeded,
      };
    }).filter(v => v.litresUsed > 0);
  }, [analytics, vehicles, dateRange]);

  const totalEmissions = carbonData.reduce((sum, v) => sum + v.co2Emissions, 0);
  const totalTreesNeeded = carbonData.reduce((sum, v) => sum + v.treesNeeded, 0);
  const avgCO2PerMile = carbonData.length > 0
    ? carbonData.reduce((sum, v) => sum + v.co2PerMile, 0) / carbonData.length
    : 0;

  // Pie chart data for emissions by vehicle
  const pieData = carbonData.map(v => ({
    name: v.registration,
    value: v.co2Emissions,
  }));

  // Bar chart data for emissions by fuel type
  const emissionsByFuelType = Object.entries(
    carbonData.reduce((acc, v) => {
      acc[v.fuelType] = (acc[v.fuelType] || 0) + v.co2Emissions;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  // Environmental rating based on avg CO2 per mile
  const getEnvironmentalRating = () => {
    if (avgCO2PerMile === 0) return { label: 'No Data', color: 'text-muted-foreground', progress: 0 };
    if (avgCO2PerMile < 100) return { label: 'Excellent', color: 'text-green-500', progress: 95 };
    if (avgCO2PerMile < 150) return { label: 'Good', color: 'text-green-400', progress: 75 };
    if (avgCO2PerMile < 200) return { label: 'Average', color: 'text-yellow-500', progress: 50 };
    if (avgCO2PerMile < 250) return { label: 'Poor', color: 'text-orange-500', progress: 25 };
    return { label: 'Very Poor', color: 'text-red-500', progress: 10 };
  };

  const rating = getEnvironmentalRating();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading carbon footprint data...
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
            <Leaf className="h-5 w-5 text-green-500" />
            Carbon Footprint Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
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
              <>
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
              </>
            )}
            {onSaveReport && (
              <Button variant="outline" onClick={() => onSaveReport({ dateRange })}>
                <Save className="h-4 w-4 mr-2" />
                Save Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total CO₂ Emissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalEmissions / 1000).toFixed(2)} t</div>
            <p className="text-xs text-muted-foreground">{totalEmissions.toFixed(0)} kg</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Avg CO₂ per Mile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCO2PerMile.toFixed(0)} g</div>
            <p className="text-xs text-muted-foreground">grams per mile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TreePine className="h-4 w-4 text-green-500" />
              Trees to Offset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTreesNeeded}</div>
            <p className="text-xs text-muted-foreground">trees per year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              Environmental Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${rating.color}`}>{rating.label}</div>
            <Progress value={rating.progress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {carbonData.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No fuel data available for the selected period
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Emissions by Vehicle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${(value / 1000).toFixed(1)}t`}
                        labelLine={{ stroke: 'hsl(var(--chart-text))' }}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(0)} kg CO₂`} />} />
                      <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5" />
                  Emissions by Fuel Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emissionsByFuelType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis dataKey="name" stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`} stroke="hsl(var(--chart-text))" tick={{ fill: 'hsl(var(--chart-text))' }} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(0)} kg CO₂`} />} />
                      <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CO2 Factors Info */}
          <Card>
            <CardHeader>
              <CardTitle>CO₂ Emission Factors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(CO2_FACTORS).map(([fuel, factor]) => (
                  <div key={fuel} className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="font-medium capitalize">{fuel}</div>
                    <div className="text-2xl font-bold text-primary">{factor}</div>
                    <div className="text-xs text-muted-foreground">kg CO₂/litre</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Carbon Footprint Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Vehicle</th>
                      <th className="text-left py-3 px-2">Fuel Type</th>
                      <th className="text-right py-3 px-2">Litres Used</th>
                      <th className="text-right py-3 px-2">CO₂ (kg)</th>
                      <th className="text-right py-3 px-2">CO₂/Mile (g)</th>
                      <th className="text-right py-3 px-2">Trees Needed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {carbonData.map(vehicle => (
                      <tr key={vehicle.vehicleId}>
                        <td className="py-2 px-2">
                          <div className="font-medium">{vehicle.registration}</div>
                          <div className="text-muted-foreground text-xs">{vehicle.make} {vehicle.model}</div>
                        </td>
                        <td className="py-2 px-2 capitalize">{vehicle.fuelType}</td>
                        <td className="py-2 px-2 text-right">{vehicle.litresUsed.toFixed(1)}</td>
                        <td className="py-2 px-2 text-right">{vehicle.co2Emissions.toFixed(0)}</td>
                        <td className="py-2 px-2 text-right">{vehicle.co2PerMile.toFixed(0)}</td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TreePine className="h-4 w-4 text-green-500" />
                            {vehicle.treesNeeded}
                          </div>
                        </td>
                      </tr>
                    ))}
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
