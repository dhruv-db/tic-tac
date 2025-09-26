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
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toast } = useToast();
  const { connectWithOAuth } = useAuth();
  const isNativePlatform = Capacitor.isNativePlatform();
  const hasProcessedCompletion = useRef(false);
  const maxRetries = 3;

  // Enhanced polling for mobile OAuth completion
  useEffect(() => {
    if (isNativePlatform && sessionId) {
      console.log('📱 Starting enhanced mobile OAuth polling for session:', sessionId);

      const enhancedPoll = async () => {
        try {
          const serverUrl = getServerUrl();
          console.log(`🔍 Enhanced polling OAuth status for session: ${sessionId} at ${serverUrl}`);
          const response = await fetch(`${serverUrl}/api/bexio-oauth/status/${sessionId}`);

          if (!response.ok) {
            if (response.status === 404) {
              console.log('📋 Session not found or expired');
              return false;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const sessionData = await response.json();
          console.log(`📊 Enhanced session status: ${sessionData.status}`);

          if (sessionData.status === 'completed') {
            console.log('✅ Enhanced OAuth session completed!');
            console.log('📦 Enhanced session data received:', {
              hasData: !!sessionData.data,
              dataKeys: sessionData.data ? Object.keys(sessionData.data) : 'null',
              accessToken: sessionData.data?.accessToken ? 'present' : 'missing',
              refreshToken: sessionData.data?.refreshToken ? 'present' : 'missing',
              companyId: sessionData.data?.companyId,
              userEmail: sessionData.data?.userEmail
            });

            // Stop polling
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }

            // Connect with the received credentials
            const { data } = sessionData;
            console.log('🔗 About to call connectWithOAuth from enhanced polling...');
            await connectWithOAuth(
              data.accessToken,
              data.refreshToken,
              data.companyId,
              data.userEmail
            );
            console.log('✅ connectWithOAuth completed in enhanced polling');

            toast({
              title: 'Authentication Successful!',
              description: 'You have been successfully connected to Bexio.',
            });

            setIsAuthenticating(false);
            setSessionId(null);
            return true; // Stop polling

          } else if (sessionData.status === 'error') {
            console.error('❌ Enhanced OAuth session failed');

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
            return true; // Stop polling
          }
          // If status is still 'pending', continue polling
          return false;

        } catch (error) {
          console.error('❌ Error in enhanced polling:', error);
          return false;
        }
      };

      // Start enhanced polling immediately and then every 2 seconds
      enhancedPoll(); // Initial poll
      const interval = setInterval(async () => {
        const shouldStop = await enhancedPoll();
        if (shouldStop) {
          clearInterval(interval);
        }
      }, 2000);

      setPollingInterval(interval);

      // Cleanup function
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [isNativePlatform, sessionId, pollingInterval, connectWithOAuth, toast]);

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

  const performOAuthLogin = async (isRetry = false) => {
    console.log('🚀 ===== MOBILE OAUTH LOGIN START =====');
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('📱 Is native:', Capacitor.isNativePlatform());
    console.log('🌐 Capacitor platform:', Capacitor.getPlatform());
    console.log('🔄 Is retry:', isRetry, 'Retry count:', retryCount);

    setIsAuthenticating(true);
    setLastError(null);

    // Reset retry count if this is not a retry
    if (!isRetry) {
      setRetryCount(0);
    }

    try {
      const serverUrl = getServerUrl();
      console.log('🌐 Server URL:', serverUrl);

      // Step 1: Start OAuth session
      console.log('📝 Creating OAuth session...');
      const sessionResponse = await fetch(`${serverUrl}/api/bexio-oauth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: Capacitor.getPlatform()
        })
      });

      console.log('📡 Session creation response status:', sessionResponse.status);
      console.log('📡 Session creation response headers:', Object.fromEntries(sessionResponse.headers.entries()));

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('❌ Session creation failed:', sessionResponse.status, errorText);
        throw new Error(`Failed to start OAuth session: ${sessionResponse.status} - ${errorText}`);
      }

      const sessionData = await sessionResponse.json();
      console.log('📦 Session creation response:', sessionData);
      const { sessionId } = sessionData;
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
        console.log('📱 Opening browser for mobile OAuth...');
        console.log('📱 Browser options:', {
          url: authUrl.substring(0, 50) + '...',
          windowName: '_blank',
          presentationStyle: 'fullscreen'
        });

        try {
          await Browser.open({
            url: authUrl,
            windowName: '_blank',
            presentationStyle: 'fullscreen'
          });
          console.log('✅ Browser opened successfully for OAuth flow');
        } catch (browserError) {
          console.error('❌ Failed to open browser:', browserError);
          throw new Error(`Failed to open browser: ${browserError.message}`);
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
      }

      // Step 5: Start polling for completion
      console.log('🔄 Starting OAuth status polling...');
      console.log('⏱️ Polling interval: 2000ms');
      console.log('⏱️ Timeout: 5 minutes');

      const interval = setInterval(() => {
        console.log('🔍 Polling attempt for session:', sessionId);
        pollOAuthStatus(sessionId);
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);

      // Set timeout for polling (5 minutes)
      const timeoutId = setTimeout(() => {
        console.log('⏰ OAuth polling timeout reached');
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setIsAuthenticating(false);
        setSessionId(null);
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
      console.log('🚀 ===== MOBILE OAUTH LOGIN END (ERROR) =====');

      const errorMessage = error instanceof Error ? error.message : 'Failed to start authentication.';
      setLastError(errorMessage);

      // Show retry option for certain errors
      if (retryCount < maxRetries && !errorMessage.includes('rate limit')) {
        toast({
          title: 'Authentication Failed',
          description: `${errorMessage} (${retryCount + 1}/${maxRetries} attempts)`,
          variant: 'destructive',
        });
        setRetryCount(prev => prev + 1);
      } else {
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

  const handleOAuthLogin = () => {
    performOAuthLogin(false);
  };

  const handleRetry = () => {
    performOAuthLogin(true);
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
              className="space-y-3"
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