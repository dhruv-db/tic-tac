import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser, App } from '@/capacitor-setup';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/OAuthContext';
import { LogIn, Shield, Zap, CheckCircle2, LogOut } from 'lucide-react';
import { getConfig } from '@/lib/secureStorage';
import ticTacLogo from '@/assets/Tic-Tac_Dark.png';

const TikTakLogo = ({ className = "" }: { className?: string }) => (
  <div className={`flex flex-col items-center space-y-2 ${className}`}>
    <img
      src={ticTacLogo}
      alt="tik-tak"
      className="h-10 w-auto md:h-12"
    />
  </div>
);

export function MobileOAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { toast } = useToast();
  const { connectWithOAuth, isConnected, credentials, disconnect } = useAuth();

  // Debug logging for iOS connection issues
  useEffect(() => {
    console.log('🔍 [DEBUG] MobileOAuth - Connection state:', {
      isConnected,
      hasCredentials: !!credentials,
      platform: Capacitor.getPlatform(),
      serverUrl: getConfig.serverUrl(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });

    if (credentials) {
      console.log('🔍 [DEBUG] MobileOAuth - Credentials:', {
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        companyId: credentials.companyId,
        userEmail: credentials.userEmail,
        authType: credentials.authType
      });
    }
  }, [isConnected, credentials]);
  const isNativePlatform = Capacitor.isNativePlatform();
  const maxRetries = 3;



  const handleOAuthCallback = async (code: string, state: string | null) => {
    console.log('🔄 ===== DIRECT OAUTH CALLBACK START =====');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('📱 Is native:', Capacitor.isNativePlatform());

    try {
      console.log('🔄 Processing OAuth callback with code:', code.substring(0, 20) + '...');
      console.log('📋 State parameter:', state);

      // Verify state parameter
      const storedState = localStorage.getItem('bexio_oauth_state');
      if (state !== storedState) {
        throw new Error('State parameter mismatch - possible CSRF attack');
      }

      // Get stored PKCE verifier
      const codeVerifier = localStorage.getItem('bexio_oauth_code_verifier');
      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found');
      }

      // Show processing feedback
      toast({
        title: 'Processing Authentication',
        description: 'Exchanging authorization code for access token...',
      });

      // Get OAuth credentials
      const clientId = import.meta.env.VITE_BEXIO_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_BEXIO_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('OAuth credentials not configured');
      }

      const redirectUri = isNativePlatform
        ? import.meta.env.VITE_BEXIO_MOBILE_REDIRECT_URI || 'bexiosyncbuddy://oauth/callback'
        : import.meta.env.VITE_BEXIO_WEB_REDIRECT_URI || `${window.location.origin}/oauth-complete.html`;

      console.log('🔗 Exchanging code for tokens directly with Bexio...');

      // Exchange code for tokens directly with Bexio
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
        code_verifier: codeVerifier,
      });

      const tokenResponse = await fetch('https://auth.bexio.com/realms/bexio/protocol/openid-connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
        throw new Error(`Token exchange failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('📦 Token exchange response received');
      console.log('🔑 Access token present:', !!tokenData.access_token);
      console.log('🔄 Refresh token present:', !!tokenData.refresh_token);

      // Extract user info from ID token
      let companyId = '';
      let userEmail = '';

      const idToken = tokenData.id_token;
      if (idToken) {
        try {
          const idTokenParts = idToken.split('.');
          if (idTokenParts.length === 3) {
            const idPayload = JSON.parse(atob(idTokenParts[1]));
            userEmail = idPayload.email || '';
          }
        } catch (idTokenError) {
          console.warn('Failed to parse ID token:', idTokenError);
        }
      }

      // Extract company ID from access token
      try {
        const accessToken = tokenData.access_token;
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          companyId = payload.company_id || payload.user_id?.toString() || '';
          if (!userEmail) {
            userEmail = payload.email || payload.login_id || '';
          }
        }
      } catch (jwtError) {
        console.warn('Failed to parse access token:', jwtError);
      }

      console.log('✅ OAuth completed successfully, calling connectWithOAuth...');

      // Connect to the app
      await connectWithOAuth(
        tokenData.access_token,
        tokenData.refresh_token || '',
        companyId,
        userEmail
      );

      console.log('🎯 connectWithOAuth completed, app should now be connected');

      // Clean up stored OAuth state
      localStorage.removeItem('bexio_oauth_code_verifier');
      localStorage.removeItem('bexio_oauth_state');

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

      console.log('🔄 ===== DIRECT OAUTH CALLBACK END (SUCCESS) =====');

    } catch (error) {
      console.error('❌ OAuth callback processing failed:', error);
      console.error('🔍 Error details:', error.message, error.stack);

      // Clean up stored OAuth state on error
      localStorage.removeItem('bexio_oauth_code_verifier');
      localStorage.removeItem('bexio_oauth_state');

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

  const performOAuthLogin = async (isRetry = false) => {
    console.log('🚀 ===== MOBILE OAUTH LOGIN START =====');
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('📱 Is native:', Capacitor.isNativePlatform());
    console.log('🌐 Capacitor platform:', Capacitor.getPlatform());
    console.log('🔄 Is retry:', isRetry, 'Retry count:', retryCount);
    console.log('🔗 Server URL:', getConfig.serverUrl());

    // Prevent multiple simultaneous authentication attempts
    if (isAuthenticating && !isRetry) {
      console.log('⚠️ Authentication already in progress, skipping...');
      return;
    }

    console.log('🔄 Setting authentication state...');
    setIsAuthenticating(true);
    setIsRetrying(isRetry);
    setLastError(null);

    // Reset retry count if this is not a retry
    if (!isRetry) {
      setRetryCount(0);
    }

    try {
      // Get Bexio OAuth credentials from environment
      const clientId = import.meta.env.VITE_BEXIO_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_BEXIO_CLIENT_SECRET;

      console.log('🔑 [DEBUG] Environment variables check:', {
        VITE_BEXIO_CLIENT_ID: clientId ? `${clientId.substring(0, 10)}...` : 'NOT FOUND',
        VITE_BEXIO_CLIENT_SECRET: clientSecret ? 'PRESENT' : 'NOT FOUND',
        VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
        VITE_MOBILE_SERVER_URL: import.meta.env.VITE_MOBILE_SERVER_URL,
        VITE_PRODUCTION_URL: import.meta.env.VITE_PRODUCTION_URL
      });

      if (!clientId) {
        console.error('❌ BEXIO_CLIENT_ID not found in environment');
        throw new Error('OAuth not configured - missing client ID');
      }

      console.log('🔑 Using Bexio Client ID for direct OAuth');

      // Step 2: Generate PKCE parameters
      const generatePKCE = async () => {
        const length = 64;
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const random = new Uint8Array(length);

        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(random);
        } else {
          for (let i = 0; i < length; i++) {
            random[i] = Math.floor(Math.random() * 256);
          }
        }

        let codeVerifier = '';
        for (let i = 0; i < length; i++) {
          codeVerifier += charset[random[i] % charset.length];
        }

        if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
          try {
            const encoder = new TextEncoder();
            const data = encoder.encode(codeVerifier);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashBytes = new Uint8Array(hashBuffer);
            let base64 = btoa(String.fromCharCode(...hashBytes));
            const codeChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            return { codeVerifier, codeChallenge };
          } catch (error) {
            console.error('PKCE generation failed:', error);
            const fallbackVerifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            return {
              codeVerifier: fallbackVerifier,
              codeChallenge: fallbackVerifier
            };
          }
        } else {
          console.warn('Web Crypto API not available, using fallback for PKCE');
          const fallbackVerifier = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          return {
            codeVerifier: fallbackVerifier,
            codeChallenge: fallbackVerifier
          };
        }
      };

      const { codeVerifier, codeChallenge } = await generatePKCE();

      // Step 3: Generate direct OAuth URL
      const scope = 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show';
      const state = Math.random().toString(36).substring(2, 15);

      // Store PKCE verifier and state for later use in callback
      localStorage.setItem('bexio_oauth_code_verifier', codeVerifier);
      localStorage.setItem('bexio_oauth_state', state);

      const redirectUri = isNativePlatform
        ? import.meta.env.VITE_BEXIO_MOBILE_REDIRECT_URI || 'bexiosyncbuddy://oauth/callback'
        : import.meta.env.VITE_BEXIO_WEB_REDIRECT_URI || `${window.location.origin}/oauth-complete.html`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth?${params.toString()}`;
      console.log('✅ Direct OAuth URL generated, opening browser...');

      // Step 4: Open browser for OAuth
      if (Capacitor.isNativePlatform()) {
        console.log('📱 [DEBUG] Opening browser for mobile OAuth...');
        console.log('📱 [DEBUG] Browser options:', {
          url: authUrl.substring(0, 100) + '...',
          urlLength: authUrl.length,
          windowName: '_blank',
          presentationStyle: 'fullscreen',
          platform: Capacitor.getPlatform()
        });

        try {
          console.log('📱 [DEBUG] Calling Browser.open...');
          console.log('📱 [DEBUG] Browser.open parameters:', {
            url: authUrl.substring(0, 100) + '...',
            windowName: '_blank',
            presentationStyle: 'fullscreen'
          });
          console.log('📱 [DEBUG] Full OAuth URL:', authUrl);

          const browserOpenStart = Date.now();
          console.log('📱 [DEBUG] About to call Browser.open()...');
          await Browser.open({
            url: authUrl,
            windowName: '_blank',
            presentationStyle: 'fullscreen'
          });
          const browserOpenTime = Date.now() - browserOpenStart;
          console.log(`✅ [DEBUG] Browser opened successfully in ${browserOpenTime}ms for OAuth flow`);
          console.log('📱 [DEBUG] Browser should now be open for OAuth');
        } catch (browserError) {
          console.error('❌ [DEBUG] Failed to open browser:', browserError);
          console.error('❌ [DEBUG] Browser error details:', {
            message: browserError.message,
            stack: browserError.stack,
            name: browserError.name
          });
          console.error('❌ [DEBUG] Browser.open() failed - this might be why OAuth doesn\'t start');

          // Try fallback: open in new window/tab
          console.log('🔄 [DEBUG] Trying fallback - opening in new window...');
          try {
            const newWindow = window.open(authUrl, '_blank', 'noopener,noreferrer');
            if (newWindow) {
              console.log('✅ [DEBUG] Fallback window opened successfully');
            } else {
              console.error('❌ [DEBUG] Fallback window also failed - popup might be blocked');
              // Last resort: redirect in same window
              console.log('🔄 [DEBUG] Last resort - redirecting in same window...');
              window.location.href = authUrl;
            }
          } catch (fallbackError) {
            console.error('❌ [DEBUG] Fallback also failed:', fallbackError);
            window.location.href = authUrl;
          }
        }
      } else {
        // Web fallback
        console.log('🌐 Opening popup for web OAuth...');
        const width = 520, height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
        const popup = window.open(authUrl, 'bexio_oauth', features);
        console.log('✅ Web popup opened:', !!popup);

        if (!popup) {
          console.warn('🌐 Popup blocked or failed to open, trying fallback...');
          // Fallback: redirect in same window
          window.location.href = authUrl;
        }
      }

      // Step 4: Set timeout for OAuth flow (5 minutes)
      const timeoutId = setTimeout(() => {
        console.log('⏰ OAuth timeout reached');
        setIsAuthenticating(false);
        localStorage.removeItem('bexio_oauth_code_verifier');
        localStorage.removeItem('bexio_oauth_state');
        toast({
          title: 'Authentication Timeout',
          description: 'OAuth authentication timed out. Please try again.',
          variant: 'destructive',
        });
      }, 5 * 60 * 1000);

      console.log('✅ OAuth flow initiated successfully');
      console.log('🚀 ===== MOBILE OAUTH LOGIN END =====');

    } catch (error) {
      console.error('❌ ===== MOBILE OAUTH LOGIN FAILED =====');
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Full error object:', error);
      console.log('🚀 ===== MOBILE OAUTH LOGIN END (ERROR) =====');

      const errorMessage = error instanceof Error ? error.message : 'Failed to start authentication.';
      console.error('❌ [DEBUG] Error message to display:', errorMessage);

      setLastError(errorMessage);

      // Clean up OAuth state on error
      localStorage.removeItem('bexio_oauth_code_verifier');
      localStorage.removeItem('bexio_oauth_state');
      setIsRetrying(false);

      // Show retry option for certain errors
      if (retryCount < maxRetries && !errorMessage.includes('rate limit') && !errorMessage.includes('Too many')) {
        console.log('❌ [DEBUG] Showing retry option');
        toast({
          title: 'Authentication Failed',
          description: `${errorMessage} (${retryCount + 1}/${maxRetries} attempts)`,
          variant: 'destructive',
        });
        setRetryCount(prev => prev + 1);
      } else {
        console.log('❌ [DEBUG] Showing final error (no retry)');
        toast({
          title: 'Authentication Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setRetryCount(0);
      }

      setIsAuthenticating(false);
    }
  };

  const handleOAuthLogin = async () => {
    console.log('🔘 [DEBUG] Connect button clicked');
    console.log('🔘 [DEBUG] Current state:', {
      isConnected,
      isAuthenticating,
      hasCredentials: !!credentials,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform()
    });

    if (isConnected) {
      console.log('🔄 [DEBUG] Already connected, forcing reconnection...');
      // Force reconnection by clearing existing credentials first
      try {
        await disconnect();
        console.log('🔄 [DEBUG] Disconnected, starting OAuth in 500ms...');
        setTimeout(() => {
          console.log('🚀 [DEBUG] Starting OAuth after disconnect...');
          performOAuthLogin(false);
        }, 500); // Small delay to ensure cleanup
      } catch (error) {
        console.error('❌ [DEBUG] Failed to disconnect:', error);
        console.log('🚀 [DEBUG] Starting OAuth despite disconnect error...');
        performOAuthLogin(false);
      }
      return;
    }

    console.log('🚀 [DEBUG] Not connected, starting OAuth directly...');
    await performOAuthLogin(false);
  };

  const handleRetry = () => {
    performOAuthLogin(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: 'Disconnected',
        description: 'You have been disconnected from Bexio.',
      });
    } catch (error) {
      toast({
        title: 'Disconnect Failed',
        description: 'Failed to disconnect. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // If already connected, show connection status
  if (isConnected && credentials) {
    console.log('🎨 [DEBUG] MobileOAuth component rendering');
    console.log('🎨 [DEBUG] Render state:', {
      isConnected,
      isAuthenticating,
      hasCredentials: !!credentials,
      retryCount,
      hasError: !!lastError
    });
  
    console.log('🎨 [DEBUG] MobileOAuth component rendering');
    console.log('🎨 [DEBUG] Render state:', {
      isConnected,
      isAuthenticating,
      hasCredentials: !!credentials,
      retryCount,
      hasError: !!lastError,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform()
    });
  
    // Force a render check
    console.log('🎨 [DEBUG] MobileOAuth - About to render UI');
  
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
        onClick={() => console.log('🎨 [DEBUG] MobileOAuth container clicked')}
      >
        <Card className="bg-white border border-green-300 shadow-xl">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mb-4"
            >
              <TikTakLogo />
            </motion.div>

            <CardTitle className="text-2xl font-bold text-green-800 mb-2">
              ✅ Connected to Bexio
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">Account Connected</p>
              <p className="text-xs text-green-600 mt-1">
                {credentials.userEmail} • {credentials.companyId}
              </p>
            </div>

            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="w-full h-10 border-red-300 text-red-700 hover:bg-red-50"
              size="sm"
            >
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Disconnect Account
              </div>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

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
              <TikTakLogo />
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
              className="space-y-3"
            >
              <Button
                onClick={() => {
                  console.log('🔘 [DEBUG] Button clicked directly');
                  handleOAuthLogin();
                }}
                disabled={isAuthenticating}
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium"
                size="lg"
              >
                {isAuthenticating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isRetrying ? 'Retrying...' : 'Connecting...'}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    {isConnected ? 'Reconnect with Bexio' : 'Connect with Bexio'}
                  </div>
                )}
              </Button>

              {/* Retry Button */}
              {lastError && retryCount < maxRetries && !isAuthenticating && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="w-full h-10 border-orange-300 text-orange-700 hover:bg-orange-50"
                  size="sm"
                >
                  <div className="flex items-center gap-2">
                    🔄 Retry ({retryCount}/{maxRetries})
                  </div>
                </Button>
              )}
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

            {/* Error Display */}
            {lastError && !isAuthenticating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <div className="text-red-600 text-sm">⚠️</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Authentication Error</p>
                    <p className="text-xs text-red-700 mt-1">{lastError}</p>
                    {retryCount >= maxRetries && (
                      <p className="text-xs text-red-600 mt-2">
                        Please check your internet connection and try again later.
                      </p>
                    )}
                  </div>
                </div>
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

              {/* Status indicator */}
              {isAuthenticating && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Waiting for authorization...
                  </Badge>
                </div>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
  );
}