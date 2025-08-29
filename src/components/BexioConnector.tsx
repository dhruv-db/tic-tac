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
      
      // Generate PKCE parameters that meet RFC 7636 requirements
      const generatePKCE = () => {
        const length = 64; // 43-128 allowed; 64 is a safe default
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const random = new Uint8Array(length);
        crypto.getRandomValues(random);
        let codeVerifier = '';
        for (let i = 0; i < length; i++) {
          codeVerifier += charset[random[i] % charset.length];
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
          const hashBytes = new Uint8Array(hashBuffer);
          let base64 = btoa(String.fromCharCode(...hashBytes));
          const codeChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          return { codeVerifier, codeChallenge };
        });
      };
      const { codeVerifier, codeChallenge } = await generatePKCE();
      
      console.log('🚀 Starting OAuth flow with PKCE:', { state, hasCodeChallenge: !!codeChallenge });
      
      // Pack state with code_verifier and return URL for callback
      const packedState = btoa(JSON.stringify({ 
        s: state, 
        cv: codeVerifier, 
        ru: `${window.location.origin}/` 
      }));
      
      // Build OAuth URL directly (no API call needed)
      const clientId = 'ea67faa2-5710-4241-9ebd-9267e5fd5acf'; // This is public, safe to expose
      const redirectUri = 'https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/callback';
      const scope = 'openid profile email offline_access';
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        state: packedState,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth?${params.toString()}`;
      console.log('✅ Generated Bexio OAuth URL directly:', authUrl);
      
      // Open popup immediately to avoid blockers
      const popup = window.open(authUrl, 'bexio-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      
      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
      }
      
      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        try {
          console.log('📨 Received message in main window:', event.data, 'from origin:', event.origin);
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.type === 'BEXIO_OAUTH_SUCCESS') {
            console.log('🎉 OAuth success detected!');
            const { accessToken, refreshToken, companyId, userEmail } = data.credentials || {};
            console.log('📋 Credentials received:', { 
              hasAccessToken: !!accessToken, 
              hasRefreshToken: !!refreshToken, 
              companyId, 
              userEmail 
            });
            
            // Call the OAuth connect function
            console.log('🔗 Calling onOAuthConnect...');
            onOAuthConnect(accessToken, refreshToken, companyId, userEmail);
            
            // Send ACK back so popup can close reliably
            try {
              (event.source as Window | null)?.postMessage({ type: 'BEXIO_OAUTH_ACK' }, event.origin || '*');
              console.log('✅ Sent ACK to popup');
            } catch (ackErr) {
              console.warn('⚠️ Failed to send OAuth ACK to popup:', ackErr);
            }
            popup?.close();
            window.removeEventListener('message', handleMessage);
            setIsOAuthLoading(false);
            console.log('🏁 OAuth flow completed');
          }
        } catch (e) {
          console.error('❌ Error handling OAuth message:', e);
        }
      };

      window.addEventListener('message', handleMessage);
      console.log('👂 Added message listener');
      
      // Fallback: poll popup.name (cross-origin-safe) for payload
      const checkName = setInterval(() => {
        try {
          const name = (popup as Window).name;
          if (name && typeof name === 'string' && name.startsWith('BEXIO_OAUTH:')) {
            console.log('📦 Found payload in popup.name');
            const raw = decodeURIComponent(name.slice('BEXIO_OAUTH:'.length));
            const data = JSON.parse(raw);
            if (data?.type === 'BEXIO_OAUTH_SUCCESS' && data.credentials) {
              const { accessToken, refreshToken, companyId, userEmail } = data.credentials;
              onOAuthConnect(accessToken, refreshToken, companyId, userEmail);
              try { (popup as Window).postMessage({ type: 'BEXIO_OAUTH_ACK' }, '*'); } catch (_) {}
              try { popup.close(); } catch (_) {}
              window.removeEventListener('message', handleMessage);
              clearInterval(checkName);
              clearInterval(checkClosed);
              setIsOAuthLoading(false);
              console.log('✅ OAuth completed via popup.name');
            }
          }
        } catch (_) { /* ignore cross-origin errors */ }
      }, 300);
      
      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          console.log('🔒 Popup was closed manually');
          clearInterval(checkClosed);
          clearInterval(checkName);
          window.removeEventListener('message', handleMessage);
          setIsOAuthLoading(false);
        }
      }, 1000);

    } catch (error) {
      console.error('❌ OAuth error:', error);
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