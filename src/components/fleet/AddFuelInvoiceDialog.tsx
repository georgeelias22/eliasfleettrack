import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useVehicles } from '@/hooks/useVehicles';
import { useCreateFuelRecord } from '@/hooks/useFuelRecords';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { checkMultipleFilesForDuplicates, formatDuplicateMessage } from '@/hooks/useDuplicateCheck';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, Plus, Trash2, Loader2, Fuel, Upload, Sparkles, FileText, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface FuelLineItem {
  id: string;
  vehicleId: string;
  registration: string;
  litres: string;
  costPerLitre: string;
  mileage: string;
  invoiceDate: string;
  station: string;
}

interface ExtractedFuelData {
  invoiceDate?: string;
  station?: string;
  invoiceTotal?: number;
  lineItems?: {
    registration?: string;
    litres?: number;
    costPerLitre?: number;
    totalCost?: number;
    mileage?: number;
  }[];
}

interface AddFuelInvoiceDialogProps {
  trigger?: React.ReactNode;
}

export function AddFuelInvoiceDialog({ trigger }: AddFuelInvoiceDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [station, setStation] = useState('');
  const [lineItems, setLineItems] = useState<FuelLineItem[]>([
    { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: '', station: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  const { data: vehicles = [] } = useVehicles();
  const createFuelRecord = useCreateFuelRecord();
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      setFiles(prev => [...prev, ...acceptedFiles]);
      return;
    }

    setCheckingDuplicates(true);
    try {
      const duplicateResults = await checkMultipleFilesForDuplicates(acceptedFiles, user.id);
      const duplicates = duplicateResults.filter(r => r.result.isDuplicate);
      const nonDuplicates = duplicateResults.filter(r => !r.result.isDuplicate);

      if (duplicates.length > 0) {
        const message = formatDuplicateMessage(duplicates);
        toast({
          title: 'Duplicate files detected',
          description: message,
          variant: 'destructive',
        });
      }

      if (nonDuplicates.length > 0) {
        setFiles(prev => [...prev, ...nonDuplicates.map(r => r.file)]);
      }
    } catch (error) {
      // If duplicate check fails, still allow the upload
      setFiles(prev => [...prev, ...acceptedFiles]);
    } finally {
      setCheckingDuplicates(false);
    }
  }, [user, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/*': ['.txt', '.csv'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const compressImage = (imageFile: File, maxWidth: number = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  };

  const readFileAsText = async (fileToRead: File): Promise<string> => {
    if (fileToRead.type.startsWith('image/')) {
      return compressImage(fileToRead);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(fileToRead);
    });
  };

  const matchVehicleByRegistration = (reg: string): string => {
    if (!reg) return '';
    const normalizedReg = reg.replace(/\s+/g, '').toUpperCase();
    const vehicle = vehicles.find(v => 
      v.registration.replace(/\s+/g, '').toUpperCase() === normalizedReg
    );
    return vehicle?.id || '';
  };

  const handleScanInvoices = async () => {
    if (files.length === 0) return;
    
    setScanning(true);
    
    try {
      const vehicleRegistrations = vehicles.map(v => v.registration);
      const allLineItems: FuelLineItem[] = [];
      let lastDate = '';
      let lastStation = '';
      
      // Process all files in parallel
      const results = await Promise.allSettled(
        files.map(async (f) => {
          const fileContent = await readFileAsText(f);
          const { data, error } = await supabase.functions.invoke('scan-fuel-invoice', {
            body: { 
              fileContent, 
              fileName: f.name,
              vehicleRegistrations,
            },
          });
          
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          return data?.data as ExtractedFuelData;
        })
      );
      
      let successCount = 0;
      let totalItems = 0;
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const extractedData = result.value;
          successCount++;
          
          if (extractedData.invoiceDate) lastDate = extractedData.invoiceDate;
          if (extractedData.station) lastStation = extractedData.station;
          
          if (extractedData.lineItems && extractedData.lineItems.length > 0) {
            extractedData.lineItems.forEach(item => {
              allLineItems.push({
                id: crypto.randomUUID(),
                vehicleId: matchVehicleByRegistration(item.registration || ''),
                registration: item.registration || '',
                litres: item.litres?.toString() || '',
                costPerLitre: item.costPerLitre?.toString() || '',
                mileage: item.mileage?.toString() || '',
                invoiceDate: extractedData.invoiceDate || '',
                station: extractedData.station || '',
              });
              totalItems++;
            });
          }
        }
      });
      
      if (allLineItems.length > 0) {
        setLineItems(allLineItems);
        if (lastDate) setInvoiceDate(lastDate);
        if (lastStation) setStation(lastStation);
        
        toast({
          title: 'Invoices scanned',
          description: `Found ${totalItems} fuel line item${totalItems > 1 ? 's' : ''} from ${successCount} invoice${successCount > 1 ? 's' : ''}.`,
        });
        setActiveTab('manual');
      } else {
        toast({
          title: 'No line items found',
          description: 'Could not extract fuel line items. Please enter manually.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan failed',
        description: error instanceof Error ? error.message : 'Could not extract data. Please enter manually.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: '', station: '' }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof FuelLineItem, value: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // If vehicleId is updated, also update registration
      if (field === 'vehicleId') {
        const vehicle = vehicles.find(v => v.id === value);
        updated.registration = vehicle?.registration || '';
      }
      
      return updated;
    }));
  };

  const calculateLineTotal = (item: FuelLineItem) => {
    if (item.litres && item.costPerLitre) {
      return (parseFloat(item.litres) * parseFloat(item.costPerLitre)).toFixed(2);
    }
    return '0.00';
  };

  const calculateInvoiceTotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + parseFloat(calculateLineTotal(item));
    }, 0).toFixed(2);
  };

  const uploadInvoiceFile = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('fuel-invoices')
        .upload(fileName, file);
      
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      
      return fileName;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validItems = lineItems.filter(item => 
      item.vehicleId && item.litres && item.costPerLitre
    );

    if (validItems.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please add at least one valid line item with vehicle, litres, and cost.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    
    try {
      // Upload all invoice files first
      let uploadedFilePath: string | null = null;
      if (files.length > 0) {
        // Upload the first file as the main invoice
        uploadedFilePath = await uploadInvoiceFile(files[0]);
      }

      await Promise.all(validItems.map(item => 
        createFuelRecord.mutateAsync({
          vehicle_id: item.vehicleId,
          fill_date: item.invoiceDate || invoiceDate,
          litres: parseFloat(item.litres),
          cost_per_litre: parseFloat(item.costPerLitre),
          total_cost: parseFloat(calculateLineTotal(item)),
          mileage: item.mileage ? parseInt(item.mileage) : null,
          station: item.station || station || null,
          notes: `Invoice ${item.invoiceDate || invoiceDate}`,
          invoice_file_path: uploadedFilePath,
        })
      ));

      toast({ 
        title: 'Fuel invoice added',
        description: `${validItems.length} fuel record${validItems.length > 1 ? 's' : ''} created.`,
      });
      setOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add fuel records.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setStation('');
    setLineItems([
      { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: '', station: '' }
    ]);
    setFiles([]);
    setActiveTab('upload');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Receipt className="w-4 h-4" />
            Add Fuel Invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Add Fuel Invoice
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'manual')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Upload & Scan
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="w-4 h-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4 mt-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              )}
            >
              <input {...getInputProps()} />
              <Upload className={cn(
                'w-12 h-12 mx-auto mb-4 transition-colors',
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              )} />
              <p className="text-foreground font-medium mb-1">
                {isDragActive ? 'Drop invoices here' : 'Drag & drop fuel invoices'}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, images, or text files up to 10MB (multiple files supported)
              </p>
              <div className="flex items-center justify-center gap-2 mt-3 text-xs text-primary">
                <Sparkles className="w-4 h-4" />
                <span>AI will automatically extract fuel data</span>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      disabled={scanning}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              onClick={handleScanInvoices}
              className="w-full gradient-primary"
              disabled={files.length === 0 || scanning || checkingDuplicates}
            >
              {checkingDuplicates ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking for duplicates...
                </>
              ) : scanning ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                  Scanning {files.length} Invoice{files.length > 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Scan & Extract Data ({files.length} file{files.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="bg-secondary/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="station">Station / Supplier</Label>
                  <Input
                    id="station"
                    placeholder="e.g. Shell, BP, Texaco..."
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Vehicle
                  </Button>
                </div>
                
                <div className="max-h-[250px] overflow-y-auto overscroll-contain touch-pan-y">
                  <div className="space-y-3 pr-2">
                    {lineItems.map((item, index) => (
                      <div 
                        key={item.id} 
                        className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Line {index + 1}
                            {item.registration && !item.vehicleId && (
                              <span className="ml-2 text-amber-500">
                                (Reg: {item.registration} - select vehicle)
                              </span>
                            )}
                          </span>
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeLineItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Vehicle</Label>
                          <Select
                            value={item.vehicleId}
                            onValueChange={(value) => updateLineItem(item.id, 'vehicleId', value)}
                          >
                            <SelectTrigger className="bg-secondary/50">
                              <SelectValue placeholder="Select vehicle" />
                            </SelectTrigger>
                            <SelectContent>
                              {vehicles.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.registration} - {vehicle.make} {vehicle.model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>Litres</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="45.5"
                              value={item.litres}
                              onChange={(e) => updateLineItem(item.id, 'litres', e.target.value)}
                              className="bg-secondary/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>£/Litre</Label>
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="1.459"
                              value={item.costPerLitre}
                              onChange={(e) => updateLineItem(item.id, 'costPerLitre', e.target.value)}
                              className="bg-secondary/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mileage</Label>
                            <Input
                              type="number"
                              placeholder="45000"
                              value={item.mileage}
                              onChange={(e) => updateLineItem(item.id, 'mileage', e.target.value)}
                              className="bg-secondary/50"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-sm text-muted-foreground">Line Total</span>
                          <span className="font-semibold text-primary">
                            £{calculateLineTotal(item)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Invoice Total</span>
                    <p className="text-xs text-muted-foreground">
                      {lineItems.filter(i => i.vehicleId && i.litres && i.costPerLitre).length} vehicle(s)
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary">£{calculateInvoiceTotal()}</span>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Fuel className="w-4 h-4 mr-2" />
                )}
                Add Fuel Invoice
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
