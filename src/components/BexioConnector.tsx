import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Key, CheckCircle2 } from "lucide-react";

interface BexioConnectorProps {
  onConnect: (apiKey: string, companyId: string) => void;
  isConnected: boolean;
}

export const BexioConnector = ({ onConnect, isConnected }: BexioConnectorProps) => {
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    if (!apiKey || !companyId) return;
    
    setIsLoading(true);
    try {
      await onConnect(apiKey, companyId);
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <Alert className="border-success bg-success/5">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertDescription className="text-success-foreground">
          Successfully connected to Bexio! You can now fetch your data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-[var(--shadow-elegant)]">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-primary-subtle">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect to Bexio</CardTitle>
        <CardDescription>
          Enter your Bexio API credentials to start fetching customer and time tracking data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Key
          </Label>
          <Input
            id="api-key"
            type="password"
            placeholder="Enter your Bexio API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="transition-[var(--transition-smooth)]"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="company-id">Company ID</Label>
          <Input
            id="company-id"
            placeholder="Enter your Company ID"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="transition-[var(--transition-smooth)]"
          />
        </div>

        <Button 
          onClick={handleConnect}
          disabled={!apiKey || !companyId || isLoading}
          className="w-full bg-[var(--gradient-primary)] hover:scale-[1.02] transition-[var(--transition-smooth)] shadow-[var(--shadow-elegant)]"
        >
          {isLoading ? "Connecting..." : "Connect to Bexio"}
        </Button>

        <Alert>
          <AlertDescription className="text-sm text-muted-foreground">
            Your credentials are stored locally in your browser and never shared with third parties.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};