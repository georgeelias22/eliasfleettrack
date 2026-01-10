import { useState, useEffect } from 'react';
import { Vehicle } from '@/types/fleet';
import { useUpdateVehicle } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Receipt, Save, Loader2, Calendar, Banknote } from 'lucide-react';


interface VehicleTaxSettingsProps {
  vehicle: Vehicle;
}

export function VehicleTaxSettings({ vehicle }: VehicleTaxSettingsProps) {
  const [annualTax, setAnnualTax] = useState('');
  const [taxPaidMonthly, setTaxPaidMonthly] = useState(false);
  const [monthlyFinance, setMonthlyFinance] = useState('');
  
  const updateVehicle = useUpdateVehicle();
  const { toast } = useToast();

  useEffect(() => {
    if (vehicle.annual_tax !== undefined && vehicle.annual_tax !== null) {
      setAnnualTax(vehicle.annual_tax.toString());
    }
    if (vehicle.tax_paid_monthly !== undefined && vehicle.tax_paid_monthly !== null) {
      setTaxPaidMonthly(vehicle.tax_paid_monthly);
    }
    if (vehicle.monthly_finance !== undefined && vehicle.monthly_finance !== null) {
      setMonthlyFinance(vehicle.monthly_finance.toString());
    }
  }, [vehicle]);

  const monthlyTaxAmount = annualTax ? (parseFloat(annualTax) / 12).toFixed(2) : '0.00';
  const annualFinance = monthlyFinance ? (parseFloat(monthlyFinance) * 12).toFixed(2) : '0.00';

  const handleSave = async () => {
    try {
      await updateVehicle.mutateAsync({
        id: vehicle.id,
        annual_tax: annualTax ? parseFloat(annualTax) : 0,
        tax_paid_monthly: taxPaidMonthly,
        monthly_finance: monthlyFinance ? parseFloat(monthlyFinance) : 0,
      });
      toast({ title: 'Settings updated' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-border/50 gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Vehicle Tax
          </CardTitle>
          <CardDescription>
            Set the annual road tax and payment schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="annualTax">Annual Tax (£)</Label>
            <Input
              id="annualTax"
              type="number"
              step="0.01"
              placeholder="e.g. 180.00"
              value={annualTax}
              onChange={(e) => setAnnualTax(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div className="space-y-1">
              <Label htmlFor="taxPaidMonthly" className="font-medium">Pay Monthly</Label>
              <p className="text-sm text-muted-foreground">
                {taxPaidMonthly 
                  ? `£${monthlyTaxAmount}/month (12 payments)`
                  : `£${annualTax || '0.00'}/year (single payment)`
                }
              </p>
            </div>
            <Switch
              id="taxPaidMonthly"
              checked={taxPaidMonthly}
              onCheckedChange={setTaxPaidMonthly}
            />
          </div>

          {taxPaidMonthly && annualTax && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Monthly Breakdown</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Monthly payment:</div>
                <div className="text-foreground font-medium">£{monthlyTaxAmount}</div>
                <div className="text-muted-foreground">Annual total:</div>
                <div className="text-foreground font-medium">£{parseFloat(annualTax).toFixed(2)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Vehicle Finance
          </CardTitle>
          <CardDescription>
            Set the monthly finance/lease payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyFinance">Monthly Payment (£)</Label>
            <Input
              id="monthlyFinance"
              type="number"
              step="0.01"
              placeholder="e.g. 350.00"
              value={monthlyFinance}
              onChange={(e) => setMonthlyFinance(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          {monthlyFinance && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Annual Cost</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Monthly payment:</div>
                <div className="text-foreground font-medium">£{parseFloat(monthlyFinance).toFixed(2)}</div>
                <div className="text-muted-foreground">Annual total:</div>
                <div className="text-foreground font-medium">£{annualFinance}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="md:col-span-2">
        <Button 
          onClick={handleSave} 
          disabled={updateVehicle.isPending}
          className="w-full gradient-primary"
        >
          {updateVehicle.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
