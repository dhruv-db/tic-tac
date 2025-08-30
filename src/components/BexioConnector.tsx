import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Key, CheckCircle2, User, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [extraScope, setExtraScope] = useState<'none' | 'all_scopes' | 'contact_show' | 'contacts:read' | 'timesheet_show' | 'timesheets:read' | 'project_show' | 'projects:read' | 'user_show' | 'users:read' | 'article_show' | 'articles:read' | 'invoice_show' | 'invoices:read' | 'order_show' | 'orders:read' | 'kb_invoice_show' | 'kb_invoices:read'>('none');
  // Listen for OAuth success from popup and finalize connection
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = (event?.data || {}) as any;
      if (data && data.type === 'BEXIO_OAUTH_SUCCESS' && data.credentials) {
        try {
          const { accessToken, refreshToken, companyId, userEmail } = data.credentials;
          onOAuthConnect?.(accessToken, refreshToken, companyId, userEmail);
        } finally {
          setIsOAuthLoading(false);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onOAuthConnect]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bexio_oauth_success' && e.newValue) {
        try {
          const creds = JSON.parse(e.newValue);
          onOAuthConnect?.(creds.accessToken, creds.refreshToken, creds.companyId, creds.userEmail);
        } finally {
          try { localStorage.removeItem('bexio_oauth_success'); } catch {}
          setIsOAuthLoading(false);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [onOAuthConnect]);

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
      
      // Generate PKCE parameters (RFC 7636)
      const generatePKCE = () => {
        const length = 64;
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

      // Pack state with code_verifier and return URL for callback
      const packedState = btoa(JSON.stringify({ 
        s: state, 
        cv: codeVerifier, 
        ru: window.location.origin 
      }));

      // Determine requested scopes per user selection (OIDC base + optional API scope)
      const baseScope = 'openid profile email offline_access';
      let requestedScope = baseScope;
      
      if (extraScope === 'all_scopes') {
        // Request specific Bexio API scopes
        requestedScope = `${baseScope} project_edit contact_edit company_profile`;
      } else if (extraScope !== 'none') {
        requestedScope = `${baseScope} ${extraScope}`;
      }

      // Request auth URL from Edge Function using server-configured client and scopes
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('bexio-oauth/auth', {
        body: {
          state: state,
          scope: requestedScope,
          codeChallenge,
          codeChallengeMethod: 'S256',
          codeVerifier,
          returnUrl: window.location.origin,
        }
      });

      if (error || !data?.authUrl) {
        throw new Error(error?.message || 'Failed to start OAuth');
      }

      const authUrl = data.authUrl as string;

      // Open in popup to avoid iframe issues
      const width = 520, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
      const popup = window.open(authUrl, 'bexio_oauth', features);
      if (!popup) {
        if (window.top) {
          window.top.location.href = authUrl;
        } else {
          window.location.href = authUrl;
        }
      }

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
    <div className="space-y-6">
      <Tabs defaultValue="oauth" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/20 border-white/30 backdrop-blur-sm">
          <TabsTrigger value="oauth" className="flex items-center gap-2 text-white font-medium data-[state=active]:bg-white data-[state=active]:text-primary">
            <User className="h-4 w-4" />
            OAuth
          </TabsTrigger>
          <TabsTrigger value="api-key" className="flex items-center gap-2 text-white font-medium data-[state=active]:bg-white data-[state=active]:text-primary">
            <Key className="h-4 w-4" />
            API Key
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="oauth" className="space-y-4 mt-6">
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-white/80">
              <Shield className="h-4 w-4 mt-0.5 text-accent" />
              <div>
                <p className="font-medium text-white">Secure OAuth Authentication</p>
                <p>Connect securely without sharing your credentials.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white font-medium">Extra API scope (optional)</Label>
              <Select value={extraScope} onValueChange={(v) => setExtraScope(v as any)}>
                <SelectTrigger className="w-full bg-white/20 border-white/30 text-white backdrop-blur-sm">
                  <SelectValue placeholder="None (OIDC only)" className="text-white" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200">
                  <SelectItem value="none">None (OIDC only)</SelectItem>
                  <SelectItem value="all_scopes">🎯 All Available Scopes (Recommended)</SelectItem>
                  <SelectItem value="contact_show">Contacts: contact_show</SelectItem>
                  <SelectItem value="contacts:read">Contacts: contacts:read</SelectItem>
                  <SelectItem value="timesheet_show">Timesheets: timesheet_show</SelectItem>
                  <SelectItem value="timesheets:read">Timesheets: timesheets:read</SelectItem>
                  <SelectItem value="project_show">Projects: project_show</SelectItem>
                  <SelectItem value="projects:read">Projects: projects:read</SelectItem>
                  <SelectItem value="user_show">Users: user_show</SelectItem>
                  <SelectItem value="users:read">Users: users:read</SelectItem>
                  <SelectItem value="article_show">Articles: article_show</SelectItem>
                  <SelectItem value="articles:read">Articles: articles:read</SelectItem>
                  <SelectItem value="invoice_show">Invoices: invoice_show</SelectItem>
                  <SelectItem value="invoices:read">Invoices: invoices:read</SelectItem>
                  <SelectItem value="order_show">Orders: order_show</SelectItem>
                  <SelectItem value="orders:read">Orders: orders:read</SelectItem>
                  <SelectItem value="kb_invoice_show">KB Invoices: kb_invoice_show</SelectItem>
                  <SelectItem value="kb_invoices:read">KB Invoices: kb_invoices:read</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-white/80">If "invalid scope", pick the other style and re-auth.</p>
            </div>
            
            <Button 
              onClick={handleOAuthConnect} 
              disabled={isOAuthLoading}
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3"
              size="lg"
            >
              <div className="bg-white/20 px-2 py-1 rounded font-mono text-sm">
                bx
              </div>
              {isOAuthLoading ? "CONNECTING..." : "REGISTRIEREN MIT BEXIO"}
            </Button>
            <p className="text-xs text-white/80 text-center">
              (OHNE KREDITKARTE)
            </p>
          </div>
        </TabsContent>
        
        <TabsContent value="api-key" className="space-y-4 mt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-white font-medium">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your Bexio API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/70 backdrop-blur-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company-id" className="text-white font-medium">Company ID</Label>
              <Input
                id="company-id"
                placeholder="Enter your Company ID"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/70 backdrop-blur-sm"
              />
            </div>
            
            <Button 
              onClick={handleConnect} 
              disabled={!apiKey || !companyId || isLoading}
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 text-lg rounded-lg"
            >
              {isLoading ? "CONNECTING..." : "CONNECT"}
            </Button>
            
            <div className="text-xs text-white/80 space-y-1">
              <p>• Find your API key in Bexio Settings → Integrations → API</p>
              <p>• Company ID is shown in your Bexio URL or account settings</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};