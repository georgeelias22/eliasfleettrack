import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateDriver } from '@/hooks/useDrivers';
import { Driver } from '@/types/driver';
import { useToast } from '@/hooks/use-toast';

interface EditDriverDialogProps {
  driver: Driver;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDriverDialog({ driver, open, onOpenChange }: EditDriverDialogProps) {
  const [name, setName] = useState(driver.name);
  const [email, setEmail] = useState(driver.email || '');
  const [phone, setPhone] = useState(driver.phone || '');
  const [licenseNumber, setLicenseNumber] = useState(driver.license_number || '');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(driver.license_expiry_date || '');
  const [lastCheckCodeDate, setLastCheckCodeDate] = useState(driver.last_check_code_date || '');
  const [notes, setNotes] = useState(driver.notes || '');
  
  const updateDriver = useUpdateDriver();
  const { toast } = useToast();
  
  useEffect(() => {
    setName(driver.name);
    setEmail(driver.email || '');
    setPhone(driver.phone || '');
    setLicenseNumber(driver.license_number || '');
    setLicenseExpiryDate(driver.license_expiry_date || '');
    setLastCheckCodeDate(driver.last_check_code_date || '');
    setNotes(driver.notes || '');
  }, [driver]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: 'Please enter a driver name', variant: 'destructive' });
      return;
    }
    
    try {
      await updateDriver.mutateAsync({
        id: driver.id,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        license_number: licenseNumber.trim() || null,
        license_expiry_date: licenseExpiryDate || null,
        last_check_code_date: lastCheckCodeDate || null,
        notes: notes.trim() || null,
      });
      
      toast({ title: 'Driver updated successfully' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to update driver', variant: 'destructive' });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Driver</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07123 456789"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-licenseNumber">License Number</Label>
              <Input
                id="edit-licenseNumber"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="SMITH901234AB1CD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-licenseExpiry">License Expiry</Label>
              <Input
                id="edit-licenseExpiry"
                type="date"
                value={licenseExpiryDate}
                onChange={(e) => setLicenseExpiryDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-lastCheckCode">Last Check Code Date</Label>
            <Input
              id="edit-lastCheckCode"
              type="date"
              value={lastCheckCodeDate}
              onChange={(e) => setLastCheckCodeDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Next check code reminder will be set for 6 months after this date
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateDriver.isPending}>
              {updateDriver.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
