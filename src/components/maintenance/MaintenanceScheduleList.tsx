import { useState } from 'react';
import { format } from 'date-fns';
import { Wrench, Calendar, Gauge, AlertTriangle, CheckCircle, Clock, Trash2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAllMaintenanceSchedules, useDeleteMaintenanceSchedule, useMarkMaintenanceComplete } from '@/hooks/useMaintenanceSchedules';
import { getMaintenanceStatus } from '@/types/maintenance';
import { useToast } from '@/hooks/use-toast';
import { AddMaintenanceScheduleDialog } from './AddMaintenanceScheduleDialog';

function MaintenanceStatusBadge({ 
  nextDueDate, 
  nextDueMileage, 
  currentMileage 
}: { 
  nextDueDate: string | null; 
  nextDueMileage: number | null;
  currentMileage: number | null;
}) {
  const status = getMaintenanceStatus(nextDueDate, nextDueMileage, currentMileage);
  
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </Badge>
    );
  }
  
  if (status === 'due-soon') {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Due Soon
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      OK
    </Badge>
  );
}

interface MarkCompleteDialogProps {
  scheduleId: string;
  maintenanceType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MarkCompleteDialog({ scheduleId, maintenanceType, open, onOpenChange }: MarkCompleteDialogProps) {
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0]);
  const [completedMileage, setCompletedMileage] = useState('');
  
  const markComplete = useMarkMaintenanceComplete();
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await markComplete.mutateAsync({
        id: scheduleId,
        completedDate,
        completedMileage: completedMileage ? parseInt(completedMileage) : undefined,
      });
      
      toast({ title: 'Maintenance marked as complete' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to update maintenance', variant: 'destructive' });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark {maintenanceType} Complete</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="completed-date">Completion Date</Label>
            <Input
              id="completed-date"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="completed-mileage">Current Mileage (optional)</Label>
            <Input
              id="completed-mileage"
              type="number"
              value={completedMileage}
              onChange={(e) => setCompletedMileage(e.target.value)}
              placeholder="Enter current odometer reading"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={markComplete.isPending}>
              {markComplete.isPending ? 'Saving...' : 'Mark Complete'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaintenanceScheduleList() {
  const { data: schedules, isLoading, error } = useAllMaintenanceSchedules();
  const deleteSchedule = useDeleteMaintenanceSchedule();
  const { toast } = useToast();
  const [markCompleteId, setMarkCompleteId] = useState<{ id: string; type: string } | null>(null);
  
  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
      toast({ title: 'Maintenance schedule deleted' });
    } catch (error) {
      toast({ title: 'Failed to delete schedule', variant: 'destructive' });
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="py-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">Failed to load maintenance schedules</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!schedules?.length) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground mb-2">No maintenance schedules</h3>
          <p className="text-muted-foreground mb-4">Set up automated reminders for oil changes, brake inspections, and more.</p>
          <AddMaintenanceScheduleDialog />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Maintenance Schedules ({schedules.length})</h2>
        <AddMaintenanceScheduleDialog />
      </div>
      
      <div className="space-y-3">
        {schedules.map((schedule: any) => (
          <Card key={schedule.id} className="bg-card border-border">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{schedule.maintenance_type}</span>
                    <MaintenanceStatusBadge
                      nextDueDate={schedule.next_due_date}
                      nextDueMileage={schedule.next_due_mileage}
                      currentMileage={null}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {schedule.vehicles && (
                      <span>
                        Vehicle: {schedule.vehicles.registration} ({schedule.vehicles.make} {schedule.vehicles.model})
                      </span>
                    )}
                    
                    {schedule.interval_months && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Every {schedule.interval_months} months
                      </span>
                    )}
                    
                    {schedule.interval_miles && (
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        Every {schedule.interval_miles.toLocaleString()} miles
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm mt-2">
                    {schedule.next_due_date && (
                      <span className="text-foreground">
                        Next due: {format(new Date(schedule.next_due_date), 'dd MMM yyyy')}
                      </span>
                    )}
                    {schedule.next_due_mileage && (
                      <span className="text-foreground">
                        At: {schedule.next_due_mileage.toLocaleString()} miles
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setMarkCompleteId({ id: schedule.id, type: schedule.maintenance_type })}
                  >
                    <Check className="h-4 w-4 text-emerald-400" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this maintenance schedule? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(schedule.id)} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {markCompleteId && (
        <MarkCompleteDialog
          scheduleId={markCompleteId.id}
          maintenanceType={markCompleteId.type}
          open={!!markCompleteId}
          onOpenChange={(open) => !open && setMarkCompleteId(null)}
        />
      )}
    </div>
  );
}
