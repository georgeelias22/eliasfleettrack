import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Document, ServiceRecord } from '@/types/fleet';
import { PoundSterling, TrendingUp, FileText, Wrench } from 'lucide-react';

interface CostSummaryProps {
  documents: Document[];
  serviceRecords: ServiceRecord[];
}

export function CostSummary({ documents, serviceRecords }: CostSummaryProps) {
  // Calculate costs from documents
  const documentCosts = documents.reduce((sum, doc) => {
    return sum + (doc.extracted_cost ?? 0);
  }, 0);

  // Calculate costs from service records
  const serviceCosts = serviceRecords.reduce((sum, record) => {
    return sum + Number(record.cost);
  }, 0);

  const totalCost = documentCosts + serviceCosts;

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

  const sortedTypes = Object.entries(costsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PoundSterling className="w-4 h-4" />
            Total Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            From Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{documentCosts.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {documents.filter(d => d.processing_status === 'completed').length} scanned documents
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 gradient-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Service Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">
            £{serviceCosts.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {serviceRecords.length} records
          </p>
        </CardContent>
      </Card>

      {sortedTypes.length > 0 && (
        <Card className="md:col-span-3 border-border/50 gradient-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Cost Breakdown by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedTypes.map(([type, cost]) => {
                const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{type}</span>
                      <span className="text-muted-foreground">
                        £{cost.toLocaleString('en-GB', { minimumFractionDigits: 2 })} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full gradient-primary rounded-full transition-all duration-500"
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
