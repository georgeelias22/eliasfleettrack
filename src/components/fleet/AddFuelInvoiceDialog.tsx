import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useVehicles } from '@/hooks/useVehicles';
import { useCreateFuelRecord, useAllFuelRecords, checkFuelRecordDuplicate } from '@/hooks/useFuelRecords';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { checkMultipleFilesForDuplicates, formatDuplicateMessage } from '@/hooks/useDuplicateCheck';
import { UploadedFuelInvoicesDialog } from '@/components/fleet/UploadedFuelInvoicesDialog';
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
import { Receipt, Plus, Trash2, Loader2, Fuel, Upload, Sparkles, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FuelLineItem {
  id: string;
  vehicleId: string;
  registration: string;
  litres: string;
  costPerLitre: string;
  mileage: string;
  invoiceDate: string;
  station: string;
  isSelected: boolean;
}

interface ExtractedFuelData {
  invoiceDate?: string;
  invoiceTotal?: number;
  lineItems?: {
    transactionDate?: string;
    registration?: string;
    litres?: number;
    costPerLitre?: number;
    totalCost?: number;
    mileage?: number;
    station?: string;
  }[];
}

interface AddFuelInvoiceDialogProps {
  trigger?: React.ReactNode;
}

export function AddFuelInvoiceDialog({ trigger }: AddFuelInvoiceDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [lineItems, setLineItems] = useState<FuelLineItem[]>([
    { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: new Date().toISOString().split('T')[0], station: '', isSelected: true }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  const { data: vehicles = [] } = useVehicles();
  const { data: existingFuelRecords = [] } = useAllFuelRecords();
  const createFuelRecord = useCreateFuelRecord();
  const { toast } = useToast();
  const { user } = useAuth();

  // Compute which line items are duplicates (both against DB and within the batch)
  const duplicateInfo = useMemo(() => {
    const info: Record<string, { isDuplicate: boolean; existingRecord?: any; batchDuplicate?: boolean }> = {};
    const seenItems: { vehicleId: string; date: string; litres: number; id: string }[] = [];
    
    lineItems.forEach(item => {
      if (item.vehicleId && item.invoiceDate && item.litres) {
        const litresNum = parseFloat(item.litres) || 0;
        
        // Check against existing database records
        const existingMatch = checkFuelRecordDuplicate(
          existingFuelRecords,
          item.vehicleId,
          item.invoiceDate,
          litresNum
        );
        
        // Check for duplicates within the current batch
        const batchMatch = seenItems.find(seen => 
          seen.vehicleId === item.vehicleId &&
          seen.date === item.invoiceDate &&
          Math.abs(seen.litres - litresNum) < 0.5
        );
        
        info[item.id] = {
          isDuplicate: !!existingMatch || !!batchMatch,
          existingRecord: existingMatch,
          batchDuplicate: !!batchMatch,
        };
        
        // Add to seen items for batch duplicate detection
        seenItems.push({
          vehicleId: item.vehicleId,
          date: item.invoiceDate,
          litres: litresNum,
          id: item.id,
        });
      } else {
        info[item.id] = { isDuplicate: false };
      }
    });
    
    return info;
  }, [lineItems, existingFuelRecords]);

  const duplicateCount = useMemo(() => 
    Object.values(duplicateInfo).filter(d => d.isDuplicate).length,
  [duplicateInfo]);

  const selectedCount = useMemo(() => 
    lineItems.filter(item => item.isSelected).length,
  [lineItems]);

  const toggleItemSelection = (id: string) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, isSelected: !item.isSelected } : item
    ));
  };

  const selectAllNonDuplicates = () => {
    setLineItems(prev => prev.map(item => ({
      ...item,
      isSelected: !duplicateInfo[item.id]?.isDuplicate
    })));
  };

  const selectAll = () => {
    setLineItems(prev => prev.map(item => ({ ...item, isSelected: true })));
  };

  const deselectAll = () => {
    setLineItems(prev => prev.map(item => ({ ...item, isSelected: false })));
  };

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
    setScanProgress({ current: 0, total: files.length });
    
    try {
      const vehicleRegistrations = vehicles.map(v => v.registration);

      // Ensure we have a signed-in user token for the backend function (otherwise it sends the anon key)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in before scanning invoices.',
          variant: 'destructive',
        });
        return;
      }

      const allLineItems: FuelLineItem[] = [];
      let lastDate = '';
      let lastStation = '';
      let successCount = 0;
      let totalItems = 0;

      // Process files sequentially in small batches to avoid UI freeze
      const BATCH_SIZE = 2;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (f) => {
            const fileContent = await readFileAsText(f);
            const { data, error } = await supabase.functions.invoke('scan-fuel-invoice', {
              body: {
                fileContent,
                fileName: f.name,
                vehicleRegistrations,
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            
            return data?.data as ExtractedFuelData;
          })
        );
        
        // Process results from this batch
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            const extractedData = result.value;
            successCount++;
            
            if (extractedData.invoiceDate) lastDate = extractedData.invoiceDate;
            
            if (extractedData.lineItems && extractedData.lineItems.length > 0) {
              extractedData.lineItems.forEach(item => {
                const fillDate = item.transactionDate || extractedData.invoiceDate || '';
                if (item.station) lastStation = item.station;
                const vehicleId = matchVehicleByRegistration(item.registration || '');
                const litresNum = item.litres || 0;
                
                // Check for duplicate within allLineItems being built
                const isDuplicateInBatch = allLineItems.some(existing => 
                  existing.vehicleId === vehicleId &&
                  existing.invoiceDate === fillDate &&
                  Math.abs(parseFloat(existing.litres) - litresNum) < 0.5
                );
                
                // Check for duplicate in existing database records
                const isDuplicateInDb = vehicleId && checkFuelRecordDuplicate(
                  existingFuelRecords,
                  vehicleId,
                  fillDate,
                  litresNum
                );
                
                if (!isDuplicateInBatch) {
                  allLineItems.push({
                    id: crypto.randomUUID(),
                    vehicleId,
                    registration: item.registration || '',
                    litres: item.litres?.toString() || '',
                    costPerLitre: item.costPerLitre?.toString() || '',
                    mileage: item.mileage?.toString() || '',
                    invoiceDate: fillDate,
                    station: item.station || '',
                    isSelected: !isDuplicateInDb, // Auto-deselect if already in DB
                  });
                  totalItems++;
                } else {
                  console.log(`Skipping duplicate line item: ${item.registration} on ${fillDate} - ${litresNum}L`);
                }
              });
            }
          }
        });
        
        // Update progress after each batch
        setScanProgress({ current: Math.min(i + BATCH_SIZE, files.length), total: files.length });
        
        // Small delay to allow UI to breathe
        if (i + BATCH_SIZE < files.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      if (allLineItems.length > 0) {
        setLineItems(allLineItems);
        
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
      setScanProgress({ current: 0, total: 0 });
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: new Date().toISOString().split('T')[0], station: '', isSelected: true }
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
    
    // Only submit selected items that have valid data
    const validItems = lineItems.filter(item => 
      item.isSelected && item.vehicleId && item.invoiceDate && item.litres && item.costPerLitre
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
          fill_date: item.invoiceDate,
          litres: parseFloat(item.litres),
          cost_per_litre: parseFloat(item.costPerLitre),
          total_cost: parseFloat(calculateLineTotal(item)),
          mileage: item.mileage ? parseInt(item.mileage) : null,
          station: item.station || null,
          notes: item.invoiceDate ? `Invoice ${item.invoiceDate}` : null,
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
    setLineItems([
      { id: crypto.randomUUID(), vehicleId: '', registration: '', litres: '', costPerLitre: '', mileage: '', invoiceDate: new Date().toISOString().split('T')[0], station: '', isSelected: true }
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
                  Scanning {scanProgress.current}/{scanProgress.total} Invoice{files.length > 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Scan & Extract Data ({files.length} file{files.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>

            <UploadedFuelInvoicesDialog />
          </TabsContent>
          
          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Label>Line Items</Label>
                    {duplicateCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {selectedCount} selected
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {duplicateCount > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllNonDuplicates}
                        className="gap-1 text-xs"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Select non-duplicates
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLineItem}
                      className="gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto overscroll-contain touch-pan-y border rounded-lg">
                  <Table>
                    <TableHeader className="bg-secondary/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-8 p-2">
                          <Checkbox
                            checked={lineItems.length > 0 && selectedCount === lineItems.length}
                            onCheckedChange={(checked) => checked ? selectAll() : deselectAll()}
                          />
                        </TableHead>
                        <TableHead className="p-2">Vehicle</TableHead>
                        <TableHead className="p-2">Date</TableHead>
                        <TableHead className="p-2">Station</TableHead>
                        <TableHead className="p-2 text-right">Litres</TableHead>
                        <TableHead className="p-2 text-right">£/L</TableHead>
                        <TableHead className="p-2 text-right">Total</TableHead>
                        <TableHead className="w-8 p-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => {
                        const itemDuplicateInfo = duplicateInfo[item.id];
                        const isDuplicate = itemDuplicateInfo?.isDuplicate;
                        const vehicle = vehicles.find(v => v.id === item.vehicleId);
                        const displayReg = vehicle?.registration || item.registration || '—';
                        
                        return (
                          <TableRow 
                            key={item.id} 
                            className={cn(
                              isDuplicate 
                                ? "bg-destructive/10" 
                                : item.isSelected 
                                  ? "bg-primary/5"
                                  : ""
                            )}
                          >
                            <TableCell className="p-2">
                              <Checkbox
                                checked={item.isSelected}
                                onCheckedChange={() => toggleItemSelection(item.id)}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <select
                                value={item.vehicleId}
                                onChange={(e) => updateLineItem(item.id, 'vehicleId', e.target.value)}
                                className="text-xs bg-transparent border-0 p-0 focus:ring-0 cursor-pointer max-w-[100px] truncate"
                              >
                                <option value="">{item.registration || 'Select'}</option>
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.registration}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="date"
                                value={item.invoiceDate}
                                onChange={(e) => updateLineItem(item.id, 'invoiceDate', e.target.value)}
                                className="text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 w-[110px]"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="text"
                                value={item.station}
                                onChange={(e) => updateLineItem(item.id, 'station', e.target.value)}
                                placeholder="Station"
                                className="text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0 w-[80px]"
                              />
                            </TableCell>
                            <TableCell className="p-2 text-right font-mono text-xs">
                              {parseFloat(item.litres || '0').toFixed(2)}
                            </TableCell>
                            <TableCell className="p-2 text-right font-mono text-xs">
                              £{parseFloat(item.costPerLitre || '0').toFixed(3)}
                            </TableCell>
                            <TableCell className="p-2 text-right font-medium text-xs whitespace-nowrap">
                              £{calculateLineTotal(item)}
                              {isDuplicate && (
                                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0" title={itemDuplicateInfo?.batchDuplicate ? 'Duplicate within this batch' : 'Already exists in database'}>
                                  {itemDuplicateInfo?.batchDuplicate ? 'BATCH' : 'DB'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              {lineItems.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => removeLineItem(item.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">
                      {selectedCount} of {lineItems.filter(i => i.vehicleId && i.litres && i.costPerLitre).length} items selected
                    </span>
                    {duplicateCount > 0 && (
                      <p className="text-xs text-destructive">
                        {lineItems.filter(i => i.isSelected && duplicateInfo[i.id]?.isDuplicate).length} duplicates will be added
                      </p>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    £{lineItems.filter(i => i.isSelected && i.litres && i.costPerLitre).reduce((sum, item) => sum + parseFloat(calculateLineTotal(item)), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary"
                disabled={submitting || selectedCount === 0}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Fuel className="w-4 h-4 mr-2" />
                )}
                Add {selectedCount} Fuel Record{selectedCount !== 1 ? 's' : ''}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
