import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser, App } from '@/capacitor-setup';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBexioApi } from '@/hooks/useBexioApi';
import { LogIn, Shield, Zap } from 'lucide-react';
import ticTacDarkLogo from '@/assets/tic-tac-dark.svg';
import ticTacLightLogo from '@/assets/tic-tac-light.svg';

const TikTakLogo = ({ className = "", variant = "light" }: { className?: string; variant?: "light" | "dark" }) => (
  <div className={`flex flex-col items-center space-y-2 ${className}`}>
    <img
      src={variant === "dark" ? ticTacDarkLogo : ticTacLightLogo}
      alt="tik-tak"
      className="h-10 w-auto md:h-12"
    />
  </div>
);

export function MobileOAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showManualCodeEntry, setShowManualCodeEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { toast } = useToast();
  const { connectWithOAuth } = useBexioApi();
  const isNativePlatform = Capacitor.isNativePlatform();

  useEffect(() => {
    let listener: any = null;
    let messageListener: any = null;

    // Only setup listener if running in Capacitor
    if (Capacitor.isNativePlatform()) {
      // Listen for app URL open events (for OAuth callback)
      const setupListener = async () => {
        try {
          listener = await App.addListener('appUrlOpen', (event) => {
            console.log('📱 App URL opened:', event.url);
            console.log('🔍 Full event:', event);

            const url = new URL(event.url);
            console.log('🌐 Parsed URL:', {
              protocol: url.protocol,
              hostname: url.hostname,
              pathname: url.pathname,
              search: url.search,
              hash: url.hash
            });

            // Check if this is our OAuth callback
            if (url.protocol === 'bexiosyncbuddy:' && (url.pathname === '/oauth/callback' || url.href.includes('oauth/callback'))) {
              console.log('🔗 OAuth callback detected via URL scheme');
              const code = url.searchParams.get('code');
              const state = url.searchParams.get('state');
              const error = url.searchParams.get('error');

              console.log('📋 Extracted OAuth parameters:', { code: code ? 'present' : 'missing', state: state ? 'present' : 'missing', error });

              if (error) {
                console.error('❌ OAuth error:', error);
                toast({
                  title: 'Authentication Failed',
                  description: `Error: ${error}`,
                  variant: 'destructive',
                });
                setIsAuthenticating(false);
                return;
              }

              if (code) {
                console.log('✅ Authorization code received:', code.substring(0, 20) + '...');
                // Process the OAuth callback
                handleOAuthCallback(code, state);
              } else {
                console.error('❌ No authorization code in callback URL');
                toast({
                  title: 'Authentication Failed',
                  description: 'No authorization code received',
                  variant: 'destructive',
                });
                setIsAuthenticating(false);
              }
            } else {
              console.log('ℹ️ Ignoring non-OAuth URL:', event.url);
            }
          });
          console.log('👂 App URL listener set up successfully');
        } catch (error) {
          console.warn('❌ App listener setup failed:', error);
        }
      };

      setupListener();

      // Also listen for browser finished events to handle OAuth completion
      const setupBrowserListener = async () => {
        try {
          const browserListener = await Browser.addListener('browserFinished', () => {
            console.log('🌐 Browser finished - OAuth flow may have completed');
            // The browser closed, but we should have already processed the callback
            // If we haven't received a callback yet, there might be an issue
          });

          return () => {
            if (browserListener) browserListener.remove();
          };
        } catch (error) {
          console.warn('Browser listener setup failed:', error);
        }
      };

      setupBrowserListener();

      // Listen for postMessage events from oauth-complete.html
      const handleMessage = (event: MessageEvent) => {
        console.log('📨 Received message from:', event.origin);
        console.log('📨 Message data:', event.data);
        console.log('📨 Full event:', event);

        // Check if this is an OAuth callback message
        if (event.data && event.data.type === 'BEXIO_OAUTH_CALLBACK') {
          console.log('🔗 OAuth callback detected via postMessage');
          const { code, state } = event.data;

          console.log('📋 PostMessage OAuth parameters:', { code: code ? 'present' : 'missing', state: state ? 'present' : 'missing' });

          if (code) {
            console.log('✅ Authorization code received via postMessage:', code.substring(0, 20) + '...');
            handleOAuthCallback(code, state);
          } else {
            console.error('❌ No authorization code in postMessage');
            toast({
              title: 'Authentication Failed',
              description: 'No authorization code received',
              variant: 'destructive',
            });
            setIsAuthenticating(false);
          }
        } else if (event.data && event.data.type === 'BEXIO_OAUTH_SUCCESS') {
          console.log('🎉 OAuth success message received via postMessage');
          const { credentials } = event.data;
          if (credentials && credentials.code) {
            console.log('✅ OAuth success with credentials');
            handleOAuthCallback(credentials.code, credentials.state);
          }
        } else {
          console.log('ℹ️ Ignoring non-OAuth message:', event.data?.type || 'unknown type');
        }
      };

      window.addEventListener('message', handleMessage);
      messageListener = handleMessage;
    }

    return () => {
      if (listener) {
        console.log('🧹 Cleaning up app URL listener');
        listener.remove();
      }
      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }
    };
  }, []);

  const handleOAuthCallback = async (code: string, state: string | null) => {
    try {
      console.log('🔄 Processing OAuth callback with code:', code.substring(0, 20) + '...');
      console.log('📋 State parameter:', state);

      // Show processing feedback
      toast({
        title: 'Processing Authentication',
        description: 'Exchanging authorization code for access token...',
      });

      console.log('🔗 Calling token exchange endpoint...');
      // Exchange code for tokens via our edge function
      const response = await fetch('https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });

      console.log('📡 Token exchange response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', response.status, errorText);
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Token exchange response received');
      console.log('🔑 Access token present:', !!data.accessToken);
      console.log('🔄 Refresh token present:', !!data.refreshToken);
      console.log('🏢 Company ID present:', !!data.companyId);
      console.log('👤 User email present:', !!data.userEmail);

      if (!data.accessToken) {
        console.error('❌ No access token in response:', data);
        throw new Error('Invalid response from token exchange - no access token');
      }

      console.log('✅ OAuth completed successfully, calling connectWithOAuth...');

      // Connect to the app
      await connectWithOAuth(
        data.accessToken,
        data.refreshToken,
        data.companyId,
        data.userEmail
      );

      console.log('🎯 connectWithOAuth completed, app should now be connected');

      toast({
        title: 'Authentication Successful!',
        description: 'You have been successfully connected to Bexio.',
      });

      // Close browser after successful authentication
      try {
        if (Capacitor.isNativePlatform()) {
          console.log('🌐 Closing browser...');
          await Browser.close();
        }
      } catch (browserError) {
        console.warn('Failed to close browser:', browserError);
      }

    } catch (error) {
      console.error('❌ OAuth callback processing failed:', error);
      toast({
        title: 'Authentication Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      console.log('🏁 OAuth callback processing finished');
      setIsAuthenticating(false);
    }
  };

  const handleOAuthLogin = async () => {
    setIsAuthenticating(true);
    setShowManualCodeEntry(false);

    // Set up a timeout to show manual entry if automatic doesn't work
    const timeoutId = setTimeout(() => {
      if (isAuthenticating) {
        console.log('⏰ OAuth timeout - showing manual entry option');
        setShowManualCodeEntry(true);
        toast({
          title: 'Having trouble?',
          description: 'Try the manual code entry option below if the automatic redirect doesn\'t work.',
        });
      }
    }, 10000); // 10 seconds timeout

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
          return {
            codeVerifier,
            codeChallenge
          };
        });
      };

      const { codeVerifier, codeChallenge } = await generatePKCE();

      // Use the edge function to initiate OAuth with proper scope including contact, projects and monitoring scopes
      const scope = 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show';

      // Determine return URL based on platform
      const returnUrl = Capacitor.isNativePlatform()
        ? `${window.location.origin}/oauth-complete.html` // HTML page for mobile that handles callback
        : `${window.location.origin}/oauth-complete.html`; // Use HTML page for both platforms for consistency

      const response = await fetch('https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: state,
          scope: scope,
          codeChallenge: codeChallenge,
          codeChallengeMethod: 'S256',
          codeVerifier: codeVerifier,
          returnUrl: returnUrl
        })
      });

      if (!response.ok) {
        throw new Error(`OAuth initiation failed: ${response.status}`);
      }

      const { authUrl } = await response.json();

      // Handle OAuth flow based on platform
      if (Capacitor.isNativePlatform()) {
        console.log('📱 Opening OAuth in Capacitor browser:', authUrl);
        console.log('🔗 Return URL will be:', returnUrl);

        // Use Capacitor Browser plugin for mobile with better configuration
        await Browser.open({
          url: authUrl,
          windowName: '_blank',
          presentationStyle: 'fullscreen' // Changed from popover to fullscreen for better redirect handling
        });

        console.log('🌐 Browser opened successfully for OAuth flow');
      } else {
        // Use popup/window for web browser
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
      }

      // Clear the timeout since we successfully opened the browser
      clearTimeout(timeoutId);

    } catch (error) {
      console.error('Failed to open OAuth browser:', error);
      toast({
        title: 'Authentication Failed',
        description: error instanceof Error ? error.message : 'Failed to open authentication browser.',
        variant: 'destructive',
      });
      setIsAuthenticating(false);
      clearTimeout(timeoutId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
        <Card className="bg-white border border-gray-300 shadow-xl">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mb-4"
            >
              <TikTakLogo variant="dark" />
            </motion.div>

            <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
              Connect to Bexio
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Features */}
            <div className="grid grid-cols-1 gap-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg"
              >
                <Shield className="h-5 w-5 text-teal-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Secure OAuth</p>
                  <p className="text-xs text-gray-600">Industry-standard authentication</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"
              >
                <Zap className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Fast Sync</p>
                  <p className="text-xs text-gray-600">Real-time data synchronization</p>
                </div>
              </motion.div>
            </div>

            {/* Connect Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <Button
                onClick={handleOAuthLogin}
                disabled={isAuthenticating}
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium"
                size="lg"
              >
                {isAuthenticating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Connecting...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    Connect with Bexio
                  </div>
                )}
              </Button>
            </motion.div>

            {/* Status */}
            {isAuthenticating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                  Opening authentication browser...
                </Badge>
              </motion.div>
            )}

            {/* Instructions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              className="text-center space-y-2"
            >
              <p className="text-xs text-gray-500">
                {isNativePlatform
                  ? "You'll be redirected to Bexio in your browser to authorize access to your account"
                  : "A popup window will open to connect with Bexio"
                }
              </p>

              {/* Manual Code Entry Toggle */}
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowManualCodeEntry(!showManualCodeEntry)}
                className="text-xs text-teal-600 hover:text-teal-700 p-0 h-auto"
              >
                {showManualCodeEntry ? 'Hide' : 'Show'} manual code entry
              </Button>
            </motion.div>

            {/* Manual Code Entry */}
            {showManualCodeEntry && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Manual Code Entry</p>
                  <p className="text-xs text-gray-600">
                    If automatic redirect doesn't work, paste the authorization code here
                  </p>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Paste authorization code here"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />

                  <Button
                    onClick={() => {
                      if (manualCode.trim()) {
                        handleOAuthCallback(manualCode.trim(), null);
                        setManualCode('');
                        setShowManualCodeEntry(false);
                      }
                    }}
                    disabled={!manualCode.trim() || isAuthenticating}
                    size="sm"
                    className="w-full bg-teal-600 hover:bg-teal-700"
                  >
                    Submit Code
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
  );
}