import { format } from 'date-fns';
import { Wrench, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { getMaintenanceStatus } from '@/types/maintenance';

export function UpcomingMaintenance() {
  const { data: schedules, isLoading } = useAllMaintenanceSchedules();
  
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  // Filter and sort schedules that are due soon or overdue
  const upcomingMaintenance = schedules
    ?.map((schedule: any) => ({
      ...schedule,
      status: getMaintenanceStatus(schedule.next_due_date, schedule.next_due_mileage, null),
    }))
    .filter((s: any) => s.status === 'overdue' || s.status === 'due-soon' || s.next_due_date)
    .sort((a: any, b: any) => {
      const statusOrder = { overdue: 0, 'due-soon': 1, ok: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.next_due_date && b.next_due_date) {
        return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
      }
      return 0;
    })
    .slice(0, 5);
  
  if (!upcomingMaintenance?.length) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No upcoming maintenance</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Maintenance Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingMaintenance.map((schedule: any) => (
          <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium text-foreground">{schedule.maintenance_type}</p>
              <p className="text-sm text-muted-foreground">
                {schedule.vehicles?.registration} - {schedule.vehicles?.make} {schedule.vehicles?.model}
              </p>
              {schedule.next_due_date && (
                <p className="text-xs text-muted-foreground">
                  Due: {format(new Date(schedule.next_due_date), 'dd MMM yyyy')}
                </p>
              )}
            </div>
            {schedule.status === 'overdue' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
            {schedule.status === 'due-soon' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due Soon
              </Badge>
            )}
            {schedule.status === 'ok' && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Scheduled
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
