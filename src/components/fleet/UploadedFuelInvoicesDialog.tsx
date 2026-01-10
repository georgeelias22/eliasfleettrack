import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Download } from "lucide-react";

type StorageFile = {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, any>;
};

function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UploadedFuelInvoicesDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...files].sort((a, b) => {
      const da = new Date(a.created_at || a.updated_at || 0).getTime();
      const db = new Date(b.created_at || b.updated_at || 0).getTime();
      return db - da;
    });
  }, [files]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      if (!user) {
        setError("Please sign in to view uploaded invoices.");
        setFiles([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: listError } = await supabase.storage
          .from("fuel-invoices")
          .list(user.id, { limit: 200, offset: 0 });

        if (listError) throw listError;
        setFiles((data || []) as StorageFile[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load invoices");
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, user]);

  const download = async (fileName: string) => {
    if (!user) return;

    const path = `${user.id}/${fileName}`;
    const { data, error: signedError } = await supabase.storage
      .from("fuel-invoices")
      .createSignedUrl(path, 60);

    if (signedError || !data?.signedUrl) {
      setError(signedError?.message || "Could not create download link");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          View uploaded invoices
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uploaded fuel invoices</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader className="bg-secondary/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No uploaded invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((f) => (
                    <TableRow key={f.id || f.name}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(f.created_at || f.updated_at)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatBytes(f.metadata?.size)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => download(f.name)}
                          className="gap-1"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
