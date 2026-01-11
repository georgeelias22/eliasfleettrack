import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Check, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MileageImportSettings() {
  const { toast } = useToast();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-mileage-excel`;

  const copyToClipboard = async (text: string, type: 'webhook' | 'apikey') => {
    await navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    }
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          n8n Mileage Import
        </CardTitle>
        <CardDescription>
          Automatically import daily mileage reports from your tracker's email using n8n
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="setup" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="workflow">n8n Workflow</TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={webhookUrl} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                >
                  {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Authentication</Label>
              <p className="text-xs text-muted-foreground">
                This endpoint uses API key authentication. Add this header to your n8n HTTP Request:
              </p>
              <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
x-api-key: YOUR_API_KEY
              </pre>
              <p className="text-xs text-muted-foreground">
                The API key is configured in your backend secrets as <code className="bg-muted px-1 rounded">MILEAGE_IMPORT_API_KEY</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Expected Excel Format</Label>
              <p className="text-xs text-muted-foreground">
                The system expects Excel files with these columns from your tracker:
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li><strong>Device</strong> - Vehicle name (matched to Make + Model)</li>
                <li><strong>Route Length</strong> - Daily mileage (e.g., "415.32 mi")</li>
                <li><strong>Mileage</strong> - Odometer reading (e.g., "121723 mi")</li>
                <li><strong>Last Stop</strong> - Date of the record</li>
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="workflow" className="space-y-4 mt-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">n8n Workflow Setup:</h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  <strong>Email Trigger (IMAP)</strong>
                  <p className="ml-4 mt-1">Connect to your email and filter for emails from your tracker</p>
                </li>
                <li>
                  <strong>Extract Attachment</strong>
                  <p className="ml-4 mt-1">Get the .xlsx file from the email attachment</p>
                </li>
                <li>
                  <strong>HTTP Request Node</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• Method: <code className="bg-muted px-1 rounded">POST</code></li>
                    <li>• URL: Paste the webhook URL above</li>
                    <li>• Headers: Add <code className="bg-muted px-1 rounded">x-api-key</code> with your API key</li>
                    <li>• Body: <code className="bg-muted px-1 rounded">JSON</code></li>
                    <li>• Content: <code className="bg-muted px-1 rounded">{`{ "file_base64": "{{ $binary.data.base64 }}" }`}</code></li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label>Alternative: Form Data Upload</Label>
              <p className="text-xs text-muted-foreground">
                You can also send the file as multipart form data with the field name <code className="bg-muted px-1 rounded">file</code>
              </p>
            </div>

            <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
              <p className="text-xs">
                <strong>Tip:</strong> Make sure your vehicles in the system have the Make and Model that match your tracker's device names (e.g., "Ford Transit Tipper 350")
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
