import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { calculateRolling30DayMPG, MileageRecord } from "@/hooks/useMileageRecords";

interface FuelEfficiencyCardProps {
  mileageRecords: MileageRecord[];
  fuelRecords: { fill_date: string; litres: number }[];
  previousPeriodMileage?: MileageRecord[];
  previousPeriodFuel?: { fill_date: string; litres: number }[];
}

export function FuelEfficiencyCard({
  mileageRecords,
  fuelRecords,
  previousPeriodMileage = [],
  previousPeriodFuel = [],
}: FuelEfficiencyCardProps) {
  const currentMPG = calculateRolling30DayMPG(mileageRecords, fuelRecords);
  const previousMPG = calculateRolling30DayMPG(previousPeriodMileage, previousPeriodFuel);

  // Calculate 30-day totals
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const totalMiles = mileageRecords
    .filter(r => new Date(r.record_date) >= thirtyDaysAgo)
    .reduce((sum, r) => sum + r.daily_mileage, 0);

  const totalLitres = fuelRecords
    .filter(r => new Date(r.fill_date) >= thirtyDaysAgo)
    .reduce((sum, r) => sum + Number(r.litres), 0);

  const trend = currentMPG && previousMPG 
    ? currentMPG > previousMPG ? 'up' : currentMPG < previousMPG ? 'down' : 'same'
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">30-Day Fuel Efficiency</CardTitle>
        <Fuel className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">
            {currentMPG ? `${currentMPG} MPG` : 'N/A'}
          </div>
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {trend === 'same' && <Minus className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>{totalMiles.toLocaleString()} miles driven</p>
          <p>{totalLitres.toFixed(1)} litres used</p>
        </div>
      </CardContent>
    </Card>
  );
}
