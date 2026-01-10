import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, User, Webhook, Truck, Check } from 'lucide-react';
import { useState } from 'react';

const Settings = () => {
  const { user, signOut } = useAuth();
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
                Use this ID for Zapier and other integrations
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

        {/* Zapier Integration */}
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-amber-500" />
              Zapier Integration
            </CardTitle>
            <CardDescription>
              Automatically import fuel invoices from email
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
              <h4 className="font-medium text-sm">Zapier Setup Instructions</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Create a new Zap with trigger: <strong>Email by Zapier</strong> (or Gmail/Outlook)</li>
                <li>Add action: <strong>Webhooks by Zapier → POST</strong></li>
                <li>Set the URL to the webhook URL above</li>
                <li>Set Payload Type to <strong>json</strong></li>
                <li>Add these data fields:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li><code className="bg-muted px-1 rounded">userId</code>: Your User ID (above)</li>
                    <li><code className="bg-muted px-1 rounded">fileContent</code>: Email attachment (base64)</li>
                    <li><code className="bg-muted px-1 rounded">fileName</code>: Attachment filename</li>
                  </ul>
                </li>
                <li>Turn on the Zap!</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label>Example JSON Payload</Label>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "userId": "${user.id}",
  "fileContent": "data:application/pdf;base64,JVBERi0...",
  "fileName": "fuel-invoice-2026-01.pdf"
}`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => copyToClipboard(JSON.stringify({
                  userId: user.id,
                  fileContent: "data:application/pdf;base64,YOUR_BASE64_CONTENT",
                  fileName: "fuel-invoice.pdf"
                }, null, 2), 'Example payload')}
              >
                <Copy className="w-3 h-3" />
                Copy Example
              </Button>
            </div>
          </CardContent>
        </Card>

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
