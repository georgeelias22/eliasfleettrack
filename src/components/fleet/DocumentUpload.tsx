import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUploadDocument, useScanDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  vehicleId: string;
  onUploadComplete?: () => void;
}

export function DocumentUpload({ vehicleId, onUploadComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  const uploadDocument = useUploadDocument();
  const scanDocument = useScanDocument();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/*': ['.txt', '.csv'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const compressImage = (file: File, maxWidth: number = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Scale down if too large
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
          
          // Compress to JPEG with 0.7 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      // Compress images before sending
      return compressImage(file);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    
    try {
      // Upload all files in parallel
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const doc = await uploadDocument.mutateAsync({ vehicleId, file });
          return { doc, file };
        })
      );
      
      toast({
        title: 'Documents uploaded',
        description: `${uploadResults.length} file${uploadResults.length > 1 ? 's' : ''} uploaded successfully.`,
      });

      // Start AI scanning for all documents in parallel
      setScanning(true);
      
      const scanResults = await Promise.allSettled(
        uploadResults.map(async ({ doc, file }) => {
          const fileContent = await readFileAsText(file);
          return scanDocument.mutateAsync({
            documentId: doc.id,
            fileContent,
            fileName: file.name,
          });
        })
      );
      
      const successCount = scanResults.filter(r => r.status === 'fulfilled').length;
      const failCount = scanResults.filter(r => r.status === 'rejected').length;
      
      if (successCount > 0) {
        toast({
          title: 'Documents scanned',
          description: `AI extracted data from ${successCount} document${successCount > 1 ? 's' : ''}.`,
        });
      }
      
      if (failCount > 0) {
        toast({
          title: 'Some scans failed',
          description: `${failCount} document${failCount > 1 ? 's' : ''} could not be scanned. You can add details manually.`,
          variant: 'destructive',
        });
      }
      
      setFiles([]);
      onUploadComplete?.();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload documents. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
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
          {isDragActive ? 'Drop files here' : 'Drag & drop service documents'}
        </p>
        <p className="text-sm text-muted-foreground">
          PDF, images, or text files up to 10MB
        </p>
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-primary">
          <Sparkles className="w-4 h-4" />
          <span>AI will automatically extract costs</span>
        </div>
      </div>

      {files.length > 0 && (
        <Card className="border-border/50 bg-secondary/30">
          <CardContent className="p-4">
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button 
              onClick={handleUpload} 
              className="w-full mt-4 gradient-primary"
              disabled={uploading || scanning}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : scanning ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                  AI Scanning...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Scan ({files.length} file{files.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
