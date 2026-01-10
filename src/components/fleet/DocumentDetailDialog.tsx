import { Document } from '@/types/fleet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  Calendar, 
  PoundSterling, 
  Car, 
  Gauge, 
  Building2,
  Wrench,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface DocumentDetailDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetailDialog({ document, open, onOpenChange }: DocumentDetailDialogProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!document) return null;

  const extractedData = document.ai_extracted_data;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('fleet-documents')
        .download(document.file_path);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Download started' });
    } catch (error) {
      console.error('Download error:', error);
      toast({ 
        title: 'Download failed', 
        description: 'Could not download the file.',
        variant: 'destructive' 
      });
    } finally {
      setDownloading(false);
    }
  };

  const DetailRow = ({ icon: Icon, label, value, className = '' }: { 
    icon: React.ElementType; 
    label: string; 
    value: React.ReactNode;
    className?: string;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${className || 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="text-sm font-medium text-foreground mt-0.5">{value || '—'}</div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate">{document.file_name}</p>
              <p className="text-sm font-normal text-muted-foreground">
                Uploaded {format(new Date(document.created_at), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Download Button */}
          <Button 
            onClick={handleDownload} 
            disabled={downloading}
            className="w-full gradient-primary"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download Original
          </Button>

          {/* Processing Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={
              document.processing_status === 'completed' ? 'default' :
              document.processing_status === 'failed' ? 'destructive' : 'secondary'
            }>
              {document.processing_status === 'completed' ? 'AI Scanned' : 
               document.processing_status === 'failed' ? 'Scan Failed' : 
               document.processing_status === 'processing' ? 'Processing...' : 'Pending'}
            </Badge>
          </div>

          {extractedData && (
            <>
              <Separator className="bg-border" />
              
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Extracted Information
                </h4>
                
                <div className="space-y-1 bg-secondary/30 rounded-lg p-3">
                  {extractedData.totalCost !== undefined && extractedData.totalCost !== null && (
                    <DetailRow 
                      icon={PoundSterling} 
                      label="Total Cost" 
                      value={
                        <span className="text-lg font-bold text-primary">
                          £{extractedData.totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </span>
                      }
                      className="text-primary"
                    />
                  )}
                  
                  {extractedData.serviceType && (
                    <DetailRow 
                      icon={Wrench} 
                      label="Service Type" 
                      value={extractedData.serviceType}
                    />
                  )}
                  
                  {extractedData.serviceDate && (
                    <DetailRow 
                      icon={Calendar} 
                      label="Service Date" 
                      value={format(new Date(extractedData.serviceDate), 'dd MMMM yyyy')}
                    />
                  )}
                  
                  {extractedData.provider && (
                    <DetailRow 
                      icon={Building2} 
                      label="Provider" 
                      value={extractedData.provider}
                    />
                  )}
                  
                  {extractedData.registration && (
                    <DetailRow 
                      icon={Car} 
                      label="Registration" 
                      value={
                        <Badge variant="outline" className="font-mono">
                          {extractedData.registration}
                        </Badge>
                      }
                    />
                  )}
                  
                  {extractedData.mileage && (
                    <DetailRow 
                      icon={Gauge} 
                      label="Mileage" 
                      value={`${extractedData.mileage.toLocaleString()} miles`}
                    />
                  )}
                </div>
              </div>

              {extractedData.description && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3">
                    {extractedData.description}
                  </p>
                </div>
              )}

              {extractedData.lineItems && extractedData.lineItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Line Items</h4>
                  <div className="space-y-2">
                    {extractedData.lineItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                      >
                        <span className="text-sm text-foreground">{item.description}</span>
                        <span className="text-sm font-medium text-foreground">
                          £{item.cost.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* File Info */}
          <Separator className="bg-border" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>File size: {document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : 'Unknown'}</p>
            <p>File type: {document.file_type || 'Unknown'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
