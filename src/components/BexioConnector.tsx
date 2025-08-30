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
      
      console.log('🚀 Starting OAuth flow with redirect');
      
      // Pack state with code_verifier and return URL for callback
      const packedState = btoa(JSON.stringify({ 
        s: state, 
        cv: codeVerifier, 
        ru: window.location.origin 
      }));
      
      // Build OAuth URL with comprehensive API scopes for full data access
      const clientId = 'ea67faa2-5710-4241-9ebd-9267e5fd5acf'; // This is public, safe to expose
      const redirectUri = 'https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/callback';
      // Complete scope list: OIDC scopes + API scopes for full functionality
      const scope = 'openid profile email offline_access project_show';
      
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
      console.log('✅ Generated Bexio OAuth URL:', authUrl);
      
      // Redirect to the OAuth URL - this will come back to /oauth/callback
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('❌ OAuth initiation failed:', error);
      setIsOAuthLoading(false);
    }
  };

  if (isConnected) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Successfully connected to Bexio! You can now track your time entries.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Connect to Bexio
        </CardTitle>
        <CardDescription>
          Choose your preferred method to connect to your Bexio account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="oauth" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              OAuth (Recommended)
            </TabsTrigger>
            <TabsTrigger value="api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="oauth" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <p className="font-medium">Secure OAuth Authentication</p>
                  <p>Connect securely without sharing your credentials. This is the recommended method.</p>
                </div>
              </div>
              
              <Button 
                onClick={handleOAuthConnect} 
                disabled={isOAuthLoading}
                className="w-full"
                size="lg"
              >
                {isOAuthLoading ? "Connecting..." : "Connect with Bexio OAuth"}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="api-key" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Bexio API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company-id">Company ID</Label>
                <Input
                  id="company-id"
                  placeholder="Enter your Company ID"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleConnect} 
                disabled={!apiKey || !companyId || isLoading}
                className="w-full"
              >
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Find your API key in Bexio Settings → Integrations → API</p>
                <p>• Company ID is shown in your Bexio URL or account settings</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};