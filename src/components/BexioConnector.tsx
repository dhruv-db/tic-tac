import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Key, CheckCircle2, User, Shield } from "lucide-react";

interface BexioConnectorProps {
  onConnect: (apiKey: string, companyId: string) => void;
  onOAuthConnect: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void;
  isConnected: boolean;
}

export const BexioConnector = ({ onConnect, onOAuthConnect, isConnected }: BexioConnectorProps) => {
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const handleConnect = async () => {
    if (!apiKey || !companyId) return;
    
    setIsLoading(true);
    try {
      await onConnect(apiKey, companyId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthConnect = async () => {
    setIsOAuthLoading(true);
    try {
      // Generate a random state for security
      const state = Math.random().toString(36).substring(2, 15);
      
      // Open popup immediately to avoid blockers
      const popup = window.open('', 'bexio-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      
      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
      }
      
      // Get OAuth URL from our edge function
      const response = await fetch('https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initiate OAuth');
      }

      const { authUrl } = await response.json();
      
      // Navigate the already-opened popup to the auth URL
      popup.location.href = authUrl;
      
      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        try {
          console.log('Received OAuth message:', event.data, 'from', (event as any).origin);
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.type === 'BEXIO_OAUTH_SUCCESS') {
            const { accessToken, refreshToken, companyId, userEmail } = data.credentials || {};
            console.log('OAuth success - credentials:', { 
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken, 
              companyId, 
              userEmail 
            });
            onOAuthConnect(accessToken, refreshToken, companyId, userEmail);
            // Send ACK back so popup can close reliably
            try {
              (event.source as Window | null)?.postMessage({ type: 'BEXIO_OAUTH_ACK' }, (event as any).origin || '*');
            } catch (ackErr) {
              console.warn('Failed to send OAuth ACK to popup:', ackErr);
            }
            popup?.close();
            window.removeEventListener('message', handleMessage);
            setIsOAuthLoading(false);
          }
        } catch (e) {
          console.error('Error handling OAuth message:', e);
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsOAuthLoading(false);
        }
      }, 1000);

    } catch (error) {
      console.error('OAuth error:', error);
      alert(`OAuth Login Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setIsOAuthLoading(false);
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
    <Card className="w-full max-w-lg mx-auto shadow-[var(--shadow-elegant)]">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-primary-subtle">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect to Bexio</CardTitle>
        <CardDescription>
          Choose your authentication method to start fetching customer and time tracking data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="oauth" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Login with Bexio
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              API Token
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oauth" className="space-y-4 mt-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="font-medium text-title">Recommended Method</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Login with your Bexio username and password for secure authentication
                </p>
              </div>

              <Button 
                onClick={handleOAuthConnect}
                disabled={isOAuthLoading}
                className="w-full bg-[var(--gradient-primary)] hover:scale-[1.02] transition-[var(--transition-smooth)] shadow-[var(--shadow-elegant)]"
                size="lg"
              >
                {isOAuthLoading ? "Opening Bexio Login..." : "Login with Bexio"}
              </Button>

              <Alert>
                <AlertDescription className="text-sm text-muted-foreground">
                  You'll be redirected to Bexio's secure login page. Your credentials are never stored by our application.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4 mt-6">
            <div className="space-y-4">
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
                {isLoading ? "Connecting..." : "Connect with API Token"}
              </Button>

              <Alert>
                <AlertDescription className="text-sm text-muted-foreground">
                  Your API credentials are stored locally in your browser and never shared with third parties.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};