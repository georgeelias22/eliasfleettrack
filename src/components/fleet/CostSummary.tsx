import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Document, ServiceRecord } from '@/types/fleet';
import { FuelRecord } from '@/types/fuel';
import { PoundSterling, TrendingUp, FileText, Wrench, Fuel, Receipt } from 'lucide-react';

interface CostSummaryProps {
  documents: Document[];
  serviceRecords: ServiceRecord[];
  fuelRecords?: FuelRecord[];
  annualTax?: number | null;
  taxPaidMonthly?: boolean | null;
}

export function CostSummary({ documents, serviceRecords, fuelRecords = [], annualTax, taxPaidMonthly }: CostSummaryProps) {
  // Calculate costs from documents
  const documentCosts = documents.reduce((sum, doc) => {
    return sum + (doc.extracted_cost ?? 0);
  }, 0);

  // Calculate costs from service records
  const serviceCosts = serviceRecords.reduce((sum, record) => {
    return sum + Number(record.cost);
  }, 0);

  // Calculate fuel costs
  const fuelCosts = fuelRecords.reduce((sum, record) => {
    return sum + record.total_cost;
  }, 0);

  // Calculate tax costs (for the year)
  const taxCost = annualTax ?? 0;

  const totalCost = documentCosts + serviceCosts + fuelCosts + taxCost;

  // Group by service type
  const costsByType: Record<string, number> = {};
  
  documents.forEach(doc => {
    if (doc.ai_extracted_data?.serviceType && doc.extracted_cost) {
      const type = doc.ai_extracted_data.serviceType;
      costsByType[type] = (costsByType[type] || 0) + doc.extracted_cost;
    }
  });
  
  serviceRecords.forEach(record => {
    const type = record.service_type;
    costsByType[type] = (costsByType[type] || 0) + Number(record.cost);
  });

  // Add fuel as a category
  if (fuelCosts > 0) {
    costsByType['Fuel'] = fuelCosts;
  }

  // Add tax as a category
  if (taxCost > 0) {
    costsByType['Road Tax'] = taxCost;
  }

  const sortedTypes = Object.entries(costsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PoundSterling className="w-4 h-4" />
            Total Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            £{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Fuel className="w-4 h-4 text-amber-500" />
            Fuel Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{fuelCosts.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {fuelRecords.length} fill-ups
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Service & Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{(documentCosts + serviceCosts).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {documents.filter(d => d.processing_status === 'completed').length + serviceRecords.length} records
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Road Tax
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{taxCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {taxPaidMonthly ? `£${(taxCost / 12).toFixed(2)}/month` : 'Annual payment'}
          </p>
        </CardContent>
      </Card>

      {sortedTypes.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-4 border-border/50 gradient-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Cost Breakdown by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {sortedTypes.map(([type, cost]) => {
                const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                const isFuel = type === 'Fuel';
                const isTax = type === 'Road Tax';
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground flex items-center gap-2">
                        {isFuel && <Fuel className="w-3 h-3 text-amber-500" />}
                        {isTax && <Receipt className="w-3 h-3" />}
                        {!isFuel && !isTax && <Wrench className="w-3 h-3 text-muted-foreground" />}
                        {type}
                      </span>
                      <span className="text-muted-foreground">
                        £{cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isFuel ? 'bg-amber-500' : isTax ? 'bg-blue-500' : 'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
