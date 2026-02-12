import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Webhook, Truck, Check, Users, Wrench, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { UserManagement } from '@/components/admin/UserManagement';
import { DriverList } from '@/components/drivers/DriverList';
import { MaintenanceScheduleList } from '@/components/maintenance/MaintenanceScheduleList';
import { MileageImportSettings } from '@/components/fleet/MileageImportSettings';

const Settings = () => {
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const webhookUrl = `https://kxtckyujdwmjtazonlbn.supabase.co/functions/v1/process-fuel-email`;

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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50 safe-area-top">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="drivers" className="space-y-6">
          <TabsList className="bg-muted/50 w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="drivers" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Drivers</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Maintenance</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-2">
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Drivers Tab */}
          <TabsContent value="drivers">
            <DriverList />
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <MaintenanceScheduleList />
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6 max-w-2xl">
            <Card className="border-border/50 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-amber-500" />
                  Fuel Invoice Import (n8n)
                </CardTitle>
                <CardDescription>
                  Automatically import fuel invoices from email using n8n
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    <strong>Simple Webhook:</strong> Use this URL with your API key as a parameter. No headers needed!
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Your Webhook URL (copy this)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${webhookUrl}?api_key=YOUR_API_KEY`}
                      readOnly
                      className="bg-muted/50 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${webhookUrl}?api_key=YOUR_API_KEY`, 'Webhook URL')}
                    >
                      {copiedField === 'Webhook URL' ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Replace <code className="bg-muted px-1 rounded">YOUR_API_KEY</code> with your <code className="bg-muted px-1 rounded">FUEL_IMPORT_API_KEY</code> secret value
                  </p>
                </div>

                <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                  <h4 className="font-medium text-sm">n8n Workflow Setup (Simple)</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Add <strong>Gmail Trigger</strong> node (enable Download Attachments)</li>
                    <li>Add <strong>HTTP Request</strong> node:
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Method: <code className="bg-muted px-1 rounded">POST</code></li>
                        <li>URL: Paste your webhook URL above (with api_key)</li>
                        <li>Body: <code className="bg-muted px-1 rounded">Form-Data/Multipart</code></li>
                        <li>Add parameter: <code className="bg-muted px-1 rounded">file</code> → set to binary attachment</li>
                      </ul>
                    </li>
                    <li>Connect nodes and activate!</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label>Alternative: JSON Body</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    If using JSON body instead of form-data:
                  </p>
                  <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "file_base64": "{{ $binary.attachment_0.data }}",
  "fileName": "{{ $binary.attachment_0.fileName }}"
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Mileage Import Settings */}
            <MileageImportSettings userId="no-auth" />
          </TabsContent>

          {/* Admin Tab */}
          {isAdmin && (
            <TabsContent value="admin" className="max-w-2xl">
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;