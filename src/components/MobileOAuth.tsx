import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/OAuthContext';
import { LogIn, Shield, Zap, CheckCircle2, LogOut } from 'lucide-react';
import { getConfig } from '@/lib/secureStorage';
import { oauthService } from '@/lib/oauthService';
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
  const { toast } = useToast();
  const { isConnected, credentials, disconnect } = useAuth();

  // Debug logging for connection state
  useEffect(() => {
    console.log('🔍 [MobileOAuth] Connection state:', {
      isConnected,
      hasCredentials: !!credentials,
      platform: Capacitor.getPlatform(),
      serverUrl: getConfig.serverUrl()
    });

    if (credentials) {
      console.log('🔍 [MobileOAuth] Credentials:', {
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        companyId: credentials.companyId,
        userEmail: credentials.userEmail,
        authType: credentials.authType
      });
    }
  }, [isConnected, credentials]);

  const isNativePlatform = Capacitor.isNativePlatform();

  const handleOAuthLogin = async () => {
    console.log('🔘 [MobileOAuth] Connect button clicked');
    console.log('🔘 [MobileOAuth] Current state:', {
      isConnected,
      isAuthenticating,
      hasCredentials: !!credentials,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform()
    });

    if (isConnected) {
      console.log('🔄 [MobileOAuth] Already connected, forcing reconnection...');
      // Force reconnection by clearing existing credentials first
      try {
        await disconnect();
        console.log('🔄 [MobileOAuth] Disconnected, starting OAuth in 500ms...');
        setTimeout(async () => {
          console.log('🚀 [MobileOAuth] Starting OAuth after disconnect...');
          setIsAuthenticating(true);
          try {
            await oauthService.initiateOAuth();
          } catch (error) {
            console.error('❌ OAuth initiation failed:', error);
            setIsAuthenticating(false);
          }
        }, 500); // Small delay to ensure cleanup
      } catch (error) {
        console.error('❌ [MobileOAuth] Failed to disconnect:', error);
        console.log('🚀 [MobileOAuth] Starting OAuth despite disconnect error...');
        setIsAuthenticating(true);
        try {
          await oauthService.initiateOAuth();
        } catch (error) {
          console.error('❌ OAuth initiation failed:', error);
          setIsAuthenticating(false);
        }
      }
      return;
    }

    console.log('🚀 [MobileOAuth] Not connected, starting OAuth directly...');
    setIsAuthenticating(true);
    try {
      await oauthService.initiateOAuth();
    } catch (error) {
      console.error('❌ OAuth initiation failed:', error);
      setIsAuthenticating(false);
    }
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
    console.log('🎨 [MobileOAuth] Rendering connected state');

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
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
                  console.log('🔘 [MobileOAuth] Button clicked directly');
                  handleOAuthLogin();
                }}
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
                    {isConnected ? 'Reconnect with Bexio' : 'Connect with Bexio'}
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