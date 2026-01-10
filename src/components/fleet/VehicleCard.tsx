import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Vehicle, getMOTStatus } from '@/types/fleet';
import { MOTStatusBadge } from './MOTStatusBadge';
import { Car, Calendar, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick: () => void;
  serviceCount?: number;
  totalCost?: number;
}

export function VehicleCard({ vehicle, onClick, serviceCount = 0, totalCost = 0 }: VehicleCardProps) {
  const status = getMOTStatus(vehicle.mot_due_date);
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg gradient-card border-border/50',
        status === 'overdue' && 'border-status-danger/50',
        status === 'due-soon' && 'border-status-warning/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{vehicle.registration}</h3>
              <p className="text-sm text-muted-foreground">
                {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
              </p>
            </div>
          </div>
          <MOTStatusBadge motDueDate={vehicle.mot_due_date} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              MOT: {vehicle.mot_due_date 
                ? format(new Date(vehicle.mot_due_date), 'dd MMM yyyy') 
                : 'Not set'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{serviceCount} service{serviceCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {totalCost > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Total costs: <span className="font-semibold text-foreground">£{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
