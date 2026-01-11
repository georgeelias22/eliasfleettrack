import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, User, Webhook, Truck, Check } from 'lucide-react';
import { useState } from 'react';
import { MileageImportSettings } from '@/components/fleet/MileageImportSettings';
import { UserManagement } from '@/components/admin/UserManagement';

const Settings = () => {
  const { user, signOut } = useAuth();
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

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
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

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Account Details */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Account Details
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user.email || ''}
                readOnly
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <div className="flex gap-2">
                <Input
                  id="userId"
                  value={user.id}
                  readOnly
                  className="bg-muted/50 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(user.id, 'User ID')}
                >
                  {copiedField === 'User ID' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this ID for n8n and other integrations
              </p>
            </div>
            <div className="space-y-2">
              <Label>Account Created</Label>
              <Input
                value={new Date(user.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                readOnly
                className="bg-muted/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* n8n Fuel Invoice Integration */}
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
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="webhookUrl"
                  value={webhookUrl}
                  readOnly
                  className="bg-muted/50 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                >
                  {copiedField === 'Webhook URL' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-4 space-y-3">
              <h4 className="font-medium text-sm">n8n Workflow Setup</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Add <strong>IMAP Email Read</strong> or <strong>Email Trigger</strong> node</li>
                <li>Configure to fetch emails with fuel invoice attachments</li>
                <li>Add an <strong>HTTP Request</strong> node with these settings:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li>Method: <code className="bg-muted px-1 rounded">POST</code></li>
                    <li>URL: <code className="bg-muted px-1 rounded text-xs break-all">{webhookUrl}</code></li>
                  </ul>
                </li>
                <li>Add header: <code className="bg-muted px-1 rounded">x-api-key</code> with your API key</li>
                <li>Set Body Content Type to <strong>JSON</strong></li>
                <li>Send JSON body with the fields below</li>
              </ol>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>API Key Required:</strong> Set up the <code className="bg-muted px-1 rounded">FUEL_IMPORT_API_KEY</code> secret in your backend settings. Use this same key in the <code className="bg-muted px-1 rounded">x-api-key</code> header.
              </p>
            </div>

            <div className="space-y-2">
              <Label>JSON Body Structure</Label>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "userId": "${user.id}",
  "file_base64": "{{ $binary.attachment_0.data }}",
  "fileName": "{{ $binary.attachment_0.fileName }}"
}`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Use n8n expressions to reference the email attachment binary data
              </p>
            </div>

            <div className="space-y-2">
              <Label>Alternative: Direct Base64</Label>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "userId": "${user.id}",
  "fileContent": "data:image/jpeg;base64,/9j/4AAQ...",
  "fileName": "fuel-invoice.jpg"
}`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => copyToClipboard(JSON.stringify({
                  userId: user.id,
                  file_base64: "{{ $binary.attachment_0.data }}",
                  fileName: "{{ $binary.attachment_0.fileName }}"
                }, null, 2), 'Example payload')}
              >
                <Copy className="w-3 h-3" />
                Copy Example
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Management - Admin Only */}
        {isAdmin && <UserManagement />}

        {/* Mileage Import */}
        <MileageImportSettings />

        {/* Preferences */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">Toggle between light and dark mode</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="border-destructive/50 bg-card">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Sign out of your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
