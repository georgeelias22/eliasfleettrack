import { useState } from 'react';
import { format } from 'date-fns';
import { User, Phone, Mail, FileText, Calendar, AlertTriangle, CheckCircle, Clock, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDrivers, useDeleteDriver } from '@/hooks/useDrivers';
import { Driver, getCheckCodeStatus, getDaysUntilCheckCode } from '@/types/driver';
import { useToast } from '@/hooks/use-toast';
import { AddDriverDialog } from './AddDriverDialog';
import { EditDriverDialog } from './EditDriverDialog';

function CheckCodeStatusBadge({ nextDueDate }: { nextDueDate: string | null }) {
  const status = getCheckCodeStatus(nextDueDate);
  const days = getDaysUntilCheckCode(nextDueDate);
  
  if (status === 'unknown') {
    return <Badge variant="outline" className="text-muted-foreground">No check code date</Badge>;
  }
  
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overdue by {Math.abs(days!)} days
      </Badge>
    );
  }
  
  if (status === 'due-soon') {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Due in {days} days
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Valid ({days} days)
    </Badge>
  );
}

function DriverCard({ driver }: { driver: Driver }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteDriver = useDeleteDriver();
  const { toast } = useToast();
  
  const handleDelete = async () => {
    try {
      await deleteDriver.mutateAsync(driver.id);
      toast({ title: 'Driver deleted successfully' });
    } catch (error) {
      toast({ title: 'Failed to delete driver', variant: 'destructive' });
    }
  };
  
  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-foreground">{driver.name}</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Driver</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {driver.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {driver.email && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                {driver.email}
              </div>
            )}
            {driver.phone && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-3 w-3" />
                {driver.phone}
              </div>
            )}
          </div>
          
          {driver.license_number && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">License: {driver.license_number}</span>
              {driver.license_expiry_date && (
                <span className="text-muted-foreground">
                  (Expires: {format(new Date(driver.license_expiry_date), 'dd MMM yyyy')})
                </span>
              )}
            </div>
          )}
          
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Check Code Status:</span>
              </div>
              <CheckCodeStatusBadge nextDueDate={driver.next_check_code_due} />
            </div>
            {driver.last_check_code_date && (
              <p className="text-xs text-muted-foreground mt-1">
                Last provided: {format(new Date(driver.last_check_code_date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
          
          {driver.notes && (
            <p className="text-sm text-muted-foreground border-t border-border pt-2">{driver.notes}</p>
          )}
        </CardContent>
      </Card>
      
      <EditDriverDialog driver={driver} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

export function DriverList() {
  const { data: drivers, isLoading, error } = useDrivers();
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
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
          <p className="text-destructive">Failed to load drivers</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!drivers?.length) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground mb-2">No drivers yet</h3>
          <p className="text-muted-foreground mb-4">Add your first driver to track license details and check code reminders.</p>
          <AddDriverDialog />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Drivers ({drivers.length})</h2>
        <AddDriverDialog />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>
    </div>
  );
}
