import { Document } from '@/types/fleet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  PoundSterling
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DocumentListProps {
  documents: Document[];
  vehicleId: string;
}

export function DocumentList({ documents, vehicleId }: DocumentListProps) {
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();

  const handleDelete = async (doc: Document) => {
    try {
      await deleteDocument.mutateAsync({
        id: doc.id,
        filePath: doc.file_path,
        vehicleId,
      });
      toast({
        title: 'Document deleted',
        description: 'The document has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete document.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-status-valid text-status-valid-foreground">
            <CheckCircle className="w-3 h-3 mr-1" />
            Scanned
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-primary text-primary-foreground">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-status-danger text-status-danger-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No documents uploaded yet</p>
        <p className="text-sm mt-1">Upload service invoices to track costs</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id} className="border-border/50 bg-secondary/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{doc.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(doc.processing_status)}
                    {doc.extracted_cost !== null && (
                      <Badge variant="outline" className="text-foreground">
                        <PoundSterling className="w-3 h-3 mr-1" />
                        {doc.extracted_cost.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  {doc.ai_extracted_data && (
                    <div className="mt-3 p-3 rounded-lg bg-card/50 text-sm space-y-1">
                      {doc.ai_extracted_data.serviceType && (
                        <p><span className="text-muted-foreground">Type:</span> {doc.ai_extracted_data.serviceType}</p>
                      )}
                      {doc.ai_extracted_data.provider && (
                        <p><span className="text-muted-foreground">Provider:</span> {doc.ai_extracted_data.provider}</p>
                      )}
                      {doc.ai_extracted_data.description && (
                        <p className="text-muted-foreground line-clamp-2">{doc.ai_extracted_data.description}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete document?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{doc.file_name}" and any extracted data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(doc)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
