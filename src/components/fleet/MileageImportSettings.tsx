import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function MileageImportSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-mileage`;

  const examplePayload = {
    registration: "AB12 CDE",
    daily_mileage: 45,
    record_date: new Date().toISOString().split('T')[0],
    odometer_reading: 12500,
    user_id: user?.id || "your-user-id"
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Zapier Mileage Import
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Connect your tracker provider to automatically import daily mileage reports via Zapier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              onClick={() => copyToClipboard(webhookUrl)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Your User ID</Label>
          <div className="flex gap-2">
            <Input 
              value={user?.id || ''} 
              readOnly 
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(user?.id || '')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Include this in your Zapier webhook payload
          </p>
        </div>

        <div className="space-y-2">
          <Label>Example Payload (JSON)</Label>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
            {JSON.stringify(examplePayload, null, 2)}
          </pre>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Setup Instructions:</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Create a new Zap in Zapier</li>
            <li>Set your tracker provider as the trigger (e.g., email or webhook)</li>
            <li>Add a "Webhooks by Zapier" action with "POST" method</li>
            <li>Paste the webhook URL above</li>
            <li>Set payload type to JSON and include the required fields</li>
            <li>Map your tracker data to: registration, daily_mileage, and user_id</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
