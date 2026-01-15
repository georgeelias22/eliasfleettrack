import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Webhook, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MileageImportSettingsProps {
  userId: string;
}

export function MileageImportSettings({ userId }: MileageImportSettingsProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const jsonWebhookUrl = `https://kxtckyujdwmjtazonlbn.supabase.co/functions/v1/import-mileage`;
  const excelWebhookUrl = `https://kxtckyujdwmjtazonlbn.supabase.co/functions/v1/import-mileage-excel`;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied!',
        description: `${field} copied to clipboard.`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please select and copy manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-blue-500" />
          Daily Mileage Import (n8n)
        </CardTitle>
        <CardDescription>
          Automatically import daily mileage data from your tracking system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="json" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json" className="gap-2">
              <Webhook className="w-4 h-4" />
              JSON Format
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Excel Format
            </TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="space-y-4 mt-4">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>JSON Webhook:</strong> Send mileage records as JSON array. Best for GPS/telematics integrations.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={`${jsonWebhookUrl}?api_key=YOUR_API_KEY&user_id=${userId}`}
                  readOnly
                  className="bg-muted/50 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(`${jsonWebhookUrl}?api_key=YOUR_API_KEY&user_id=${userId}`, 'JSON Webhook URL')}
                >
                  {copiedField === 'JSON Webhook URL' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Replace <code className="bg-muted px-1 rounded">YOUR_API_KEY</code> with your <code className="bg-muted px-1 rounded">MILEAGE_IMPORT_API_KEY</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Expected JSON Body</Label>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "records": [
    {
      "registration": "AB12 CDE",
      "date": "2025-01-15",
      "daily_mileage": 145,
      "odometer_reading": 52340
    }
  ]
}`}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="excel" className="space-y-4 mt-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                <strong>Excel Webhook:</strong> Send pre-parsed Excel data. Column headers should match vehicle registrations.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={`${excelWebhookUrl}?api_key=YOUR_API_KEY&user_id=${userId}`}
                  readOnly
                  className="bg-muted/50 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(`${excelWebhookUrl}?api_key=YOUR_API_KEY&user_id=${userId}`, 'Excel Webhook URL')}
                >
                  {copiedField === 'Excel Webhook URL' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expected JSON Body (from n8n Spreadsheet node)</Label>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "date_column": "Date",
  "rows": [
    {
      "Date": "2025-01-15",
      "AB12CDE": 145,
      "XY34FGH": 87
    }
  ]
}`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Column headers should match your vehicle registrations (spaces are ignored)
              </p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4 space-y-3">
              <h4 className="font-medium text-sm">n8n Workflow for Daily Tracker</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Add <strong>Schedule Trigger</strong> (e.g., daily at 6am)</li>
                <li>Add <strong>Google Sheets</strong> or <strong>Microsoft Excel</strong> node to read your tracker</li>
                <li>Add <strong>HTTP Request</strong> node:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li>Method: <code className="bg-muted px-1 rounded">POST</code></li>
                    <li>URL: Paste webhook URL above</li>
                    <li>Body: JSON with <code className="bg-muted px-1 rounded">date_column</code> and <code className="bg-muted px-1 rounded">rows</code></li>
                  </ul>
                </li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
