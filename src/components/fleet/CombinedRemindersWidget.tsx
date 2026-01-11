import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, CheckCircle, User, Wrench, Car, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDrivers } from '@/hooks/useDrivers';
import { useAllMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { getCheckCodeStatus, getDaysUntilCheckCode } from '@/types/driver';
import { getMaintenanceStatus } from '@/types/maintenance';
import { Vehicle, getMOTStatus, getDaysUntilMOT } from '@/types/fleet';

interface CombinedRemindersWidgetProps {
  upcomingMOTs: Array<{ vehicle: Vehicle; daysUntil: number }>;
  overdueMOTs: Vehicle[];
}

export function CombinedRemindersWidget({ upcomingMOTs, overdueMOTs }: CombinedRemindersWidgetProps) {
  const navigate = useNavigate();
  const { data: drivers, isLoading: driversLoading } = useDrivers();
  const { data: maintenanceSchedules, isLoading: maintenanceLoading } = useAllMaintenanceSchedules();

  const isLoading = driversLoading || maintenanceLoading;

  // Process driver check codes
  const driverReminders = drivers
    ?.filter(d => d.next_check_code_due)
    .map(d => ({
      id: d.id,
      type: 'driver' as const,
      title: d.name,
      subtitle: 'Check code due',
      dueDate: d.next_check_code_due!,
      status: getCheckCodeStatus(d.next_check_code_due),
      days: getDaysUntilCheckCode(d.next_check_code_due),
    }))
    .filter(d => d.status === 'overdue' || d.status === 'due-soon' || (d.days && d.days <= 60))
    .sort((a, b) => (a.days || 999) - (b.days || 999))
    || [];

  // Process maintenance schedules
  const maintenanceReminders = maintenanceSchedules
    ?.filter((s: any) => s.next_due_date)
    .map((s: any) => {
      const status = getMaintenanceStatus(s.next_due_date, s.next_due_mileage, null);
      const dueDate = new Date(s.next_due_date);
      const today = new Date();
      const days = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: s.id,
        type: 'maintenance' as const,
        title: s.maintenance_type,
        subtitle: s.vehicles ? `${s.vehicles.registration}` : 'All vehicles',
        dueDate: s.next_due_date,
        status,
        days,
      };
    })
    .filter((m: any) => m.status === 'overdue' || m.status === 'due-soon' || m.days <= 30)
    .sort((a: any, b: any) => a.days - b.days)
    || [];

  // Process MOTs
  const motReminders = [
    ...overdueMOTs.map(v => ({
      id: v.id,
      type: 'mot' as const,
      title: v.registration,
      subtitle: `${v.make} ${v.model}`,
      dueDate: v.mot_due_date || '',
      status: 'overdue' as const,
      days: getDaysUntilMOT(v.mot_due_date),
    })),
    ...upcomingMOTs.map(({ vehicle: v, daysUntil }) => ({
      id: v.id,
      type: 'mot' as const,
      title: v.registration,
      subtitle: `${v.make} ${v.model}`,
      dueDate: v.mot_due_date || '',
      status: getMOTStatus(v.mot_due_date) as 'due-soon' | 'valid',
      days: daysUntil,
    })),
  ].sort((a, b) => (a.days || 999) - (b.days || 999));

  // Combine all reminders for the "All" tab
  const allReminders = [...driverReminders, ...maintenanceReminders, ...motReminders]
    .sort((a, b) => {
      const statusOrder = { overdue: 0, 'due-soon': 1, ok: 2, valid: 3 };
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.days || 999) - (b.days || 999);
    })
    .slice(0, 8);

  const overdueCount = allReminders.filter(r => r.status === 'overdue').length;
  const dueSoonCount = allReminders.filter(r => r.status === 'due-soon').length;

  const getStatusBadge = (status: string, days: number | null) => {
    if (status === 'overdue') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }
    if (status === 'due-soon') {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {days !== null ? `${days}d` : 'Soon'}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3" />
        {days !== null ? `${days}d` : 'OK'}
      </Badge>
    );
  };

  const getTypeIcon = (type: 'driver' | 'maintenance' | 'mot') => {
    switch (type) {
      case 'driver':
        return <User className="h-4 w-4 text-sky-400" />;
      case 'maintenance':
        return <Wrench className="h-4 w-4 text-amber-400" />;
      case 'mot':
        return <Car className="h-4 w-4 text-primary" />;
    }
  };

  const ReminderItem = ({ reminder }: { reminder: typeof allReminders[0] }) => (
    <div 
      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
      onClick={() => {
        if (reminder.type === 'driver') navigate('/drivers');
        else if (reminder.type === 'maintenance') navigate('/maintenance');
        else navigate(`/vehicle/${reminder.id}`);
      }}
    >
      <div className="flex items-center gap-3">
        {getTypeIcon(reminder.type)}
        <div>
          <p className="font-medium text-foreground text-sm">{reminder.title}</p>
          <p className="text-xs text-muted-foreground">{reminder.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(reminder.status, reminder.days)}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Bell className="w-4 h-4 text-primary" />
            Reminders
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">{overdueCount} overdue</Badge>
            )}
            {dueSoonCount > 0 && overdueCount === 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{dueSoonCount} due soon</Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full mb-3 bg-muted/50">
            <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
            <TabsTrigger value="mot" className="flex-1 text-xs">MOT ({motReminders.length})</TabsTrigger>
            <TabsTrigger value="maintenance" className="flex-1 text-xs">Service ({maintenanceReminders.length})</TabsTrigger>
            <TabsTrigger value="drivers" className="flex-1 text-xs">Drivers ({driverReminders.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-2 mt-0">
            {allReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming reminders</p>
            ) : (
              allReminders.map(reminder => <ReminderItem key={`${reminder.type}-${reminder.id}`} reminder={reminder} />)
            )}
          </TabsContent>
          
          <TabsContent value="mot" className="space-y-2 mt-0">
            {motReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No MOT reminders</p>
            ) : (
              motReminders.slice(0, 5).map(reminder => <ReminderItem key={reminder.id} reminder={reminder} />)
            )}
          </TabsContent>
          
          <TabsContent value="maintenance" className="space-y-2 mt-0">
            {maintenanceReminders.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No maintenance schedules</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/maintenance')}>
                  Set up schedules
                </Button>
              </div>
            ) : (
              maintenanceReminders.slice(0, 5).map((reminder: any) => <ReminderItem key={reminder.id} reminder={reminder} />)
            )}
          </TabsContent>
          
          <TabsContent value="drivers" className="space-y-2 mt-0">
            {driverReminders.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No driver check codes due</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/drivers')}>
                  Manage drivers
                </Button>
              </div>
            ) : (
              driverReminders.slice(0, 5).map(reminder => <ReminderItem key={reminder.id} reminder={reminder} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
