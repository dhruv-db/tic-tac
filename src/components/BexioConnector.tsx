import { useEffect, useState } from "react";
import { Capacitor } from '@capacitor/core';
import { Browser } from '@/capacitor-setup';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Key, CheckCircle2, User, Shield } from "lucide-react";
import { MobileOAuth } from "./MobileOAuth";
interface BexioConnectorProps {
  onConnect: (apiKey: string, companyId: string) => void;
  onOAuthConnect: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void;
  isConnected: boolean;
  className?: string;
}
export const BexioConnector = ({
  onConnect,
  onOAuthConnect,
  isConnected,
  className
}: BexioConnectorProps) => {
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // Listen for OAuth success from popup and finalize connection
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      console.log('📨 [DEBUG] BexioConnector received message:', event.data);
      const data = (event?.data || {}) as any;
      if (data && data.type === 'BEXIO_OAUTH_SUCCESS' && data.credentials) {
        console.log('✅ [DEBUG] BexioConnector processing OAuth success');
        try {
          const {
            accessToken,
            refreshToken,
            companyId,
            userEmail
          } = data.credentials;
          console.log('🔗 [DEBUG] BexioConnector calling onOAuthConnect with:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            companyId,
            userEmail
          });
          onOAuthConnect?.(accessToken, refreshToken, companyId, userEmail);
        } finally {
          setIsOAuthLoading(false);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
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

      // Generate PKCE parameters that meet RFC 7636 requirements
      const generatePKCE = async () => {
        const length = 64; // 43-128 allowed; 64 is a safe default
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const random = new Uint8Array(length);

        // Check if crypto.getRandomValues is available
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(random);
        } else {
          // Fallback: use Math.random for each byte
          for (let i = 0; i < length; i++) {
            random[i] = Math.floor(Math.random() * 256);
          }
        }

        let codeVerifier = '';
        for (let i = 0; i < length; i++) {
          codeVerifier += charset[random[i] % charset.length];
        }

        // Check if Web Crypto API is available
        if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
          try {
            const encoder = new TextEncoder();
            const data = encoder.encode(codeVerifier);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashBytes = new Uint8Array(hashBuffer);
            let base64 = btoa(String.fromCharCode(...hashBytes));
            const codeChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            return {
              codeVerifier,
              codeChallenge
            };
          } catch (error) {
            console.error('PKCE generation failed:', error);
            // Fallback to simple random string if crypto.subtle fails
            const fallbackVerifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            return {
              codeVerifier: fallbackVerifier,
              codeChallenge: fallbackVerifier // Use plain verifier as challenge for fallback
            };
          }
        } else {
          // Fallback: use simple random string if crypto.subtle is not available
          console.warn('Web Crypto API not available, using fallback for PKCE');
          const fallbackVerifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          return {
            codeVerifier: fallbackVerifier,
            codeChallenge: fallbackVerifier // Use plain verifier as challenge for fallback
          };
        }
      };
      const {
        codeVerifier,
        codeChallenge
      } = await generatePKCE();
      console.log('🚀 Starting OAuth flow with redirect');

      // Pack state with code_verifier and return URL for callback
      const productionUrl = import.meta.env.VITE_PRODUCTION_URL || 'https://tic-tac-puce-chi.vercel.app';
      const packedState = btoa(JSON.stringify({
        s: state,
        cv: codeVerifier,
        ru: productionUrl
      }));

      // Detect platform for proper redirect URI handling
      const platform = Capacitor.isNativePlatform() ? 'mobile' : 'web';

      // Use the local server to initiate OAuth with proper scope including contact, projects and monitoring scopes
      const scope = 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show';
      const response = await fetch('http://localhost:3001/api/bexio-oauth/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: packedState,
          scope: scope,
          codeChallenge: codeChallenge,
          codeChallengeMethod: 'S256',
          codeVerifier: codeVerifier,
          returnUrl: productionUrl,
          platform: platform
        })
      });
      if (!response.ok) {
        throw new Error(`OAuth initiation failed: ${response.status}`);
      }
      const {
        authUrl
      } = await response.json();

      // Open in popup to avoid iframe X-Frame-Options issues
      const width = 520,
        height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
      const popup = window.open(authUrl, 'bexio_oauth', features);
      if (!popup) {
        // Fallback to top-level navigation
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
    return <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Successfully connected to Bexio! You can now track your time entries.
        </AlertDescription>
      </Alert>;
  }

  // Use mobile-specific OAuth component when running in Capacitor
  if (Capacitor.isNativePlatform()) {
    return <MobileOAuth />;
  }

  return <Card className={className}>
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
        <div className="w-full">
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 mt-0.5 text-success" />
              <div>
                <p className="font-medium">Secure OAuth Authentication</p>
                <p>Connect securely without sharing your credentials. This is the recommended method.</p>
              </div>
            </div>

            <Button onClick={handleOAuthConnect} disabled={isOAuthLoading} size="lg" className="w-full text-base bg-[#5faf59]">
              {isOAuthLoading ? "Connecting..." : "Connect with Bexio OAuth"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>;
};