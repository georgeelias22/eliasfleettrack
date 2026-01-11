import { format } from 'date-fns';
import { AlertTriangle, Clock, CheckCircle, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrivers } from '@/hooks/useDrivers';
import { getCheckCodeStatus, getDaysUntilCheckCode } from '@/types/driver';

export function UpcomingCheckCodes() {
  const { data: drivers, isLoading } = useDrivers();
  
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
  
  // Filter and sort drivers with upcoming check codes
  const driversWithReminders = drivers
    ?.filter(d => d.next_check_code_due)
    .map(d => ({
      ...d,
      status: getCheckCodeStatus(d.next_check_code_due),
      days: getDaysUntilCheckCode(d.next_check_code_due),
    }))
    .sort((a, b) => {
      // Overdue first, then due-soon, then by days
      const statusOrder = { overdue: 0, 'due-soon': 1, valid: 2, unknown: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (a.days || 999) - (b.days || 999);
    })
    .slice(0, 5);
  
  if (!driversWithReminders?.length) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <User className="h-5 w-5" />
            Check Code Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No upcoming check code reminders</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <User className="h-5 w-5" />
          Check Code Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {driversWithReminders.map((driver) => (
          <div key={driver.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium text-foreground">{driver.name}</p>
              <p className="text-sm text-muted-foreground">
                Due: {format(new Date(driver.next_check_code_due!), 'dd MMM yyyy')}
              </p>
            </div>
            {driver.status === 'overdue' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
            {driver.status === 'due-soon' && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {driver.days} days
              </Badge>
            )}
            {driver.status === 'valid' && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {driver.days} days
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
