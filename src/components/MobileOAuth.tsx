import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser, App } from '@/capacitor-setup';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth, getServerUrl } from '@/context/OAuthContext';
import { LogIn, Shield, Zap } from 'lucide-react';
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { connectWithOAuth } = useAuth();
  const isNativePlatform = Capacitor.isNativePlatform();
  const hasProcessedCompletion = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Reset completion flag when starting new session
  useEffect(() => {
    if (sessionId) {
      hasProcessedCompletion.current = false;
    }
  }, [sessionId]);

  // Poll for OAuth session completion
  const pollOAuthStatus = useCallback(async (sessionId: string) => {
    try {
      const serverUrl = getServerUrl();
      console.log(`🔍 Polling OAuth status for session: ${sessionId} at ${serverUrl}`);
      const response = await fetch(`${serverUrl}/api/bexio-oauth/status/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('📋 Session not found or expired');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const sessionData = await response.json();
      console.log(`📊 Session status: ${sessionData.status}`);

      if (sessionData.status === 'completed') {
        console.log('✅ OAuth session completed!');
        console.log('📦 Session data received:', {
          hasData: !!sessionData.data,
          dataKeys: sessionData.data ? Object.keys(sessionData.data) : 'null',
          accessToken: sessionData.data?.accessToken ? 'present' : 'missing',
          refreshToken: sessionData.data?.refreshToken ? 'present' : 'missing',
          companyId: sessionData.data?.companyId,
          userEmail: sessionData.data?.userEmail
        });

        // Check if we've already processed this completion
        if (hasProcessedCompletion.current) {
          console.log('🔄 Completion already processed, skipping...');
          return;
        }

        // Mark as processed to prevent duplicate calls
        hasProcessedCompletion.current = true;

        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        // Connect with the received credentials
        const { data } = sessionData;
        console.log('🔗 About to call connectWithOAuth from polling...');
        await connectWithOAuth(
          data.accessToken,
          data.refreshToken,
          data.companyId,
          data.userEmail
        );
        console.log('✅ connectWithOAuth completed in polling');

        toast({
          title: 'Authentication Successful!',
          description: 'You have been successfully connected to Bexio.',
        });

        setIsAuthenticating(false);
        setSessionId(null);

      } else if (sessionData.status === 'error') {
        console.error('❌ OAuth session failed');

        // Stop polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        toast({
          title: 'Authentication Failed',
          description: 'OAuth authentication failed. Please try again.',
          variant: 'destructive',
        });

        setIsAuthenticating(false);
        setSessionId(null);
      }
      // If status is still 'pending', continue polling

    } catch (error) {
      console.error('❌ Error polling OAuth status:', error);
    }
  }, [pollingInterval, connectWithOAuth, toast]);

  const handleOAuthCallback = async (code: string, state: string | null) => {
    console.log('🔄 ===== FRONTEND OAUTH CALLBACK START =====');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('📱 Is native:', Capacitor.isNativePlatform());
    console.log('🔑 Current credentials before callback:', !!connectWithOAuth);

    try {
      console.log('🔄 Processing OAuth callback with code:', code.substring(0, 20) + '...');
      console.log('📋 State parameter:', state);
      console.log('📏 Code length:', code.length);

      // Show processing feedback
      toast({
        title: 'Processing Authentication',
        description: 'Exchanging authorization code for access token...',
      });

      console.log('🔗 Calling token exchange endpoint...');
      const exchangeUrl = `${getServerUrl()}/api/bexio-oauth/exchange`;
      console.log('🌐 Request URL:', exchangeUrl);
      console.log('📦 Request payload:', { code: code.substring(0, 20) + '...', state });

      // Exchange code for tokens via our server
      const response = await fetch(exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });

      console.log('📡 Token exchange response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', response.status, errorText);
        console.log('🔄 ===== FRONTEND OAUTH CALLBACK END (TOKEN EXCHANGE FAILED) =====');
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Token exchange response received');
      console.log('🔑 Access token present:', !!data.accessToken);
      console.log('🔄 Refresh token present:', !!data.refreshToken);
      console.log('🏢 Company ID present:', !!data.companyId);
      console.log('👤 User email present:', !!data.userEmail);
      console.log('📋 Full response data keys:', Object.keys(data));

      if (!data.accessToken) {
        console.error('❌ No access token in response:', data);
        console.log('🔄 ===== FRONTEND OAUTH CALLBACK END (NO ACCESS TOKEN) =====');
        throw new Error('Invalid response from token exchange - no access token');
      }

      console.log('✅ OAuth completed successfully, calling connectWithOAuth...');

      // Connect to the app
      console.log('🔗 Calling connectWithOAuth with:', {
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
        companyId: data.companyId,
        userEmail: data.userEmail
      });

      await connectWithOAuth(
        data.accessToken,
        data.refreshToken,
        data.companyId,
        data.userEmail
      );

      console.log('🎯 connectWithOAuth completed, app should now be connected');
      console.log('🔄 ===== FRONTEND OAUTH CALLBACK END (SUCCESS) =====');

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

      console.log('🔄 ===== FRONTEND OAUTH CALLBACK END (SUCCESS) =====');

    } catch (error) {
      console.error('❌ OAuth callback processing failed:', error);
      console.error('🔍 Error details:', error.message, error.stack);
      console.log('🔄 ===== FRONTEND OAUTH CALLBACK END (EXCEPTION) =====');
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
    console.log('🚀 Starting new OAuth session-based flow');
    setIsAuthenticating(true);

    try {
      const serverUrl = getServerUrl();
      // Step 1: Start OAuth session
      console.log('📝 Creating OAuth session...');
      const sessionResponse = await fetch(`${serverUrl}/api/bexio-oauth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: Capacitor.getPlatform()
        })
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to start OAuth session: ${sessionResponse.status}`);
      }

      const { sessionId } = await sessionResponse.json();
      console.log(`📱 OAuth session created: ${sessionId}`);
      setSessionId(sessionId);

      // Step 2: Generate PKCE parameters with crypto fallbacks
      const generatePKCE = async () => {
        const length = 64;
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
            return { codeVerifier, codeChallenge };
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

      const { codeVerifier, codeChallenge } = await generatePKCE();

      // Step 3: Get OAuth URL with session ID
      const scope = 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show';
      const requestBody: any = {
        state: Math.random().toString(36).substring(2, 15),
        scope,
        codeChallenge,
        codeChallengeMethod: 'S256',
        codeVerifier,
        sessionId,
        platform: Capacitor.getPlatform()
      };

      // Set returnUrl based on platform
      if (isNativePlatform) {
        // For mobile, returnUrl is not used (uses sessionId), but set it anyway
        requestBody.returnUrl = `${serverUrl}/api/bexio-oauth/callback`;
      } else {
        // For web, set returnUrl to the current origin + callback page
        requestBody.returnUrl = `${window.location.origin}/oauth-complete.html`;
      }

      console.log('🔗 Requesting OAuth URL with session ID...');
      const authResponse = await fetch(`${serverUrl}/api/bexio-oauth/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!authResponse.ok) {
        throw new Error(`OAuth URL request failed: ${authResponse.status}`);
      }

      const { authUrl } = await authResponse.json();
      console.log('✅ OAuth URL received, opening browser...');

      // Step 4: Open browser for OAuth
      if (Capacitor.isNativePlatform()) {
        await Browser.open({
          url: authUrl,
          windowName: '_blank',
          presentationStyle: 'fullscreen'
        });
        console.log('🌐 Browser opened for OAuth flow');
      } else {
        // Web fallback
        const width = 520, height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
        window.open(authUrl, 'bexio_oauth', features);
      }

      // Step 5: Start polling for completion
      console.log('🔄 Starting OAuth status polling...');
      const interval = setInterval(() => {
        pollOAuthStatus(sessionId);
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);

      // Set timeout for polling (5 minutes)
      setTimeout(() => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsAuthenticating(false);
          setSessionId(null);
          toast({
            title: 'Authentication Timeout',
            description: 'OAuth authentication timed out. Please try again.',
            variant: 'destructive',
          });
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('❌ OAuth login failed:', error);
      toast({
        title: 'Authentication Failed',
        description: error instanceof Error ? error.message : 'Failed to start authentication.',
        variant: 'destructive',
      });
      setIsAuthenticating(false);
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

              {/* Status indicator */}
              {isAuthenticating && sessionId && (
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