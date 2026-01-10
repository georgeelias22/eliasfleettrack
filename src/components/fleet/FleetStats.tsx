import { Vehicle, getMOTStatus } from '@/types/fleet';
import { Card, CardContent } from '@/components/ui/card';
import { Car, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface FleetStatsProps {
  vehicles: Vehicle[];
}

export function FleetStats({ vehicles }: FleetStatsProps) {
  const stats = vehicles.reduce(
    (acc, vehicle) => {
      const status = getMOTStatus(vehicle.mot_due_date);
      acc[status]++;
      return acc;
    },
    { valid: 0, 'due-soon': 0, overdue: 0, unknown: 0 }
  );

  const statCards = [
    {
      label: 'Total Vehicles',
      value: vehicles.length,
      icon: Car,
      className: 'text-primary',
    },
    {
      label: 'MOT Valid',
      value: stats.valid,
      icon: CheckCircle,
      className: 'text-status-valid',
    },
    {
      label: 'Due Soon',
      value: stats['due-soon'],
      icon: Clock,
      className: 'text-status-warning',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      className: 'text-status-danger',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label} className="border-border/50 gradient-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.className}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
