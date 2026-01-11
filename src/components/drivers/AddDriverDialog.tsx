import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateDriver } from '@/hooks/useDrivers';
import { useToast } from '@/hooks/use-toast';

export function AddDriverDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [lastCheckCodeDate, setLastCheckCodeDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const createDriver = useCreateDriver();
  const { toast } = useToast();
  
  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setLicenseNumber('');
    setLicenseExpiryDate('');
    setLastCheckCodeDate('');
    setNotes('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: 'Please enter a driver name', variant: 'destructive' });
      return;
    }
    
    try {
      await createDriver.mutateAsync({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        license_number: licenseNumber.trim() || null,
        license_expiry_date: licenseExpiryDate || null,
        last_check_code_date: lastCheckCodeDate || null,
        next_check_code_due: null,
        notes: notes.trim() || null,
      });
      
      toast({ title: 'Driver added successfully' });
      resetForm();
      setOpen(false);
    } catch (error) {
      toast({ title: 'Failed to add driver', variant: 'destructive' });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Driver
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Driver</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07123 456789"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input
                id="licenseNumber"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="SMITH901234AB1CD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseExpiry">License Expiry</Label>
              <Input
                id="licenseExpiry"
                type="date"
                value={licenseExpiryDate}
                onChange={(e) => setLicenseExpiryDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastCheckCode">Last Check Code Date</Label>
            <Input
              id="lastCheckCode"
              type="date"
              value={lastCheckCodeDate}
              onChange={(e) => setLastCheckCodeDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Next check code reminder will be set for 6 months after this date
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDriver.isPending}>
              {createDriver.isPending ? 'Adding...' : 'Add Driver'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
