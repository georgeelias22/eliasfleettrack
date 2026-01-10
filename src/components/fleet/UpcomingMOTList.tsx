import { Vehicle } from '@/types/fleet';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ChevronRight, Car } from 'lucide-react';

interface UpcomingMOTListProps {
  upcomingMOTs: { vehicle: Vehicle; daysUntil: number }[];
  overdueMOTs: Vehicle[];
}

export function UpcomingMOTList({ upcomingMOTs, overdueMOTs }: UpcomingMOTListProps) {
  const navigate = useNavigate();

  if (overdueMOTs.length === 0 && upcomingMOTs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No upcoming MOT dates to display</p>
        <p className="text-sm mt-1">Add vehicles with MOT dates to see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Overdue MOTs first */}
      {overdueMOTs.map((vehicle) => (
        <div
          key={vehicle.id}
          className="flex items-center justify-between p-3 rounded-lg bg-status-danger/10 border border-status-danger/20 hover:bg-status-danger/15 transition-colors cursor-pointer"
          onClick={() => navigate(`/vehicle/${vehicle.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-danger/20">
              <AlertTriangle className="w-4 h-4 text-status-danger" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{vehicle.registration}</p>
              <p className="text-sm text-muted-foreground">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="font-medium">
              OVERDUE
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      ))}

      {/* Upcoming MOTs */}
      {upcomingMOTs.map(({ vehicle, daysUntil }) => (
        <div
          key={vehicle.id}
          className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
            daysUntil <= 30
              ? 'bg-status-warning/10 border-status-warning/20 hover:bg-status-warning/15'
              : 'bg-muted/30 border-border/50 hover:bg-muted/50'
          }`}
          onClick={() => navigate(`/vehicle/${vehicle.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              daysUntil <= 30 ? 'bg-status-warning/20' : 'bg-muted'
            }`}>
              <Clock className={`w-4 h-4 ${
                daysUntil <= 30 ? 'text-status-warning' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{vehicle.registration}</p>
              <p className="text-sm text-muted-foreground">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-sm font-medium ${
                daysUntil <= 30 ? 'text-status-warning' : 'text-muted-foreground'
              }`}>
                {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
              </p>
              <p className="text-xs text-muted-foreground">
                {vehicle.mot_due_date ? new Date(vehicle.mot_due_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : ''}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}
