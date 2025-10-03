import { useEffect, Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@/capacitor-setup';
import Index from "./pages/Index";
import MobileIndex from "./pages/MobileIndex";
import NotFound from "./pages/NotFound";
import { OAuthCallback } from "./components/OAuthCallback";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { AuthProvider, useAuth } from "@/context/OAuthContext";
import { getConfig } from "@/lib/secureStorage";

// Image debugging utility
const debugImageLoading = () => {
  // Monitor for broken images
  document.addEventListener('error', (e) => {
    const target = e.target as HTMLImageElement;
    if (target && target.tagName === 'IMG') {
      console.warn('🚨 Broken image detected:', {
        src: target.src,
        alt: target.alt,
        className: target.className,
        dataset: target.dataset
      });
    }
  }, true);

  // Monitor for images with image.png in src
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (img.src && img.src.includes('image.png')) {
              console.log('🎯 Found image.png reference:', {
                src: img.src,
                alt: img.alt,
                className: img.className,
                parentElement: img.parentElement?.tagName,
                styles: window.getComputedStyle(img)
              });
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('🔍 Image debugging enabled - monitoring for image.png references');
};

// Simple Error Boundary to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('React Error Boundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              The app encountered an error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Error details
                </summary>
                <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient();

// Create a separate component that can use useNavigate
const RouterContent = () => {
  console.log('🚀 RouterContent component rendering');
  const navigate = useNavigate();
  const { connectWithOAuth } = useAuth();
  const { toast } = useToast();
  console.log('✅ RouterContent initialization complete');

  // Handle OAuth messages for web popup flow
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('🔗 Setting up postMessage listener for web OAuth');

      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'BEXIO_OAUTH_SUCCESS') {
          console.log('🔗 Received OAuth success message:', event.data);
          const { credentials } = event.data;
          if (credentials) {
            console.log('🔗 Processing OAuth credentials from message...');
            connectWithOAuth(
              credentials.accessToken,
              credentials.refreshToken,
              credentials.companyId,
              credentials.userEmail
            ).catch(error => {
              console.error('❌ Error processing OAuth credentials:', error);
              toast({
                title: 'Authentication Failed',
                description: 'Failed to process authentication data.',
                variant: 'destructive',
              });
            });
          }
        }
      };

      window.addEventListener('message', handleMessage);
      console.log('🔗 PostMessage listener registered');

      return () => {
        window.removeEventListener('message', handleMessage);
        console.log('🔗 PostMessage listener removed');
      };
    }
  }, [connectWithOAuth, toast]);

  // Handle deep links for OAuth callbacks (mobile apps)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      console.log('🔗 Setting up deep link listener for OAuth callbacks');

      const handleDeepLink = async (event: any) => {
         try {
           console.log('🔗 ===== DEEP LINK RECEIVED =====');
           console.log('🔗 Deep link event:', event);
           console.log('🔗 Deep link URL:', event?.url);
           console.log('🔗 Current location before navigation:', window.location.href);

           if (!event?.url) {
             console.warn('🔗 Deep link event missing URL');
             return;
           }

           const url = new URL(event.url);
           console.log('🔗 Parsed URL:', {
             href: url.href,
             pathname: url.pathname,
             search: url.search,
             hash: url.hash,
             protocol: url.protocol,
             host: url.host
           });

           // Check if this is an OAuth callback (either web or custom scheme)
           if (url.pathname === '/oauth/callback' || url.href.includes('oauth/callback') || (url.protocol === 'App:' && url.pathname === '/oauth-complete')) {
             console.log('🔗 ✅ OAuth callback detected via deep link');

             const params = new URLSearchParams(url.search);
             const code = params.get('code');
             const state = params.get('state');
             const sessionId = params.get('sessionId');
             const error = params.get('error');

             console.log('🔗 OAuth callback params:', {
               code: code ? `${code.substring(0, 20)}...` : 'missing',
               state: state ? `${state.substring(0, 20)}...` : 'missing',
               sessionId: sessionId ? `${sessionId.substring(0, 20)}...` : 'missing',
               error
             });

             if (error) {
               console.error('❌ OAuth error via deep link:', error);
               // Handle error by showing toast
               toast({
                 title: 'Authentication Failed',
                 description: `OAuth error: ${error}`,
                 variant: 'destructive',
               });
               return;
             }

             if (sessionId) {
               console.log('✅ Processing OAuth sessionId from custom scheme redirect...');
               // Handle the custom scheme redirect with sessionId
               // Poll for the OAuth status using the sessionId
               try {
                 const response = await fetch(`${getConfig.serverUrl()}/api/bexio-oauth/status/${sessionId}`, {
                   method: 'GET',
                   headers: {
                     'Content-Type': 'application/json',
                   },
                 });

                 if (response.ok) {
                   const statusData = await response.json();
                   console.log('✅ OAuth status retrieved:', statusData);

                   if (statusData.status === 'completed' && statusData.tokens) {
                     console.log('🎉 OAuth completed via custom scheme redirect');
                     await connectWithOAuth(
                       statusData.tokens.access_token,
                       statusData.tokens.refresh_token,
                       statusData.company_id || statusData.tokens.company_id,
                       statusData.user_email || statusData.tokens.user_email
                     );

                     toast({
                       title: 'Authentication Successful!',
                       description: 'You have been successfully connected to Bexio.',
                     });
                   } else if (statusData.status === 'failed') {
                     console.error('❌ OAuth failed:', statusData.error);
                     toast({
                       title: 'Authentication Failed',
                       description: statusData.error || 'OAuth authentication failed.',
                       variant: 'destructive',
                     });
                   }
                 } else {
                   console.error('❌ Failed to get OAuth status');
                   toast({
                     title: 'Authentication Error',
                     description: 'Failed to retrieve authentication status.',
                     variant: 'destructive',
                   });
                 }
               } catch (statusError) {
                 console.error('❌ Error retrieving OAuth status:', statusError);
                 toast({
                   title: 'Authentication Error',
                   description: 'Failed to complete authentication.',
                   variant: 'destructive',
                 });
               }
             } else if (code) {
               console.log('✅ Processing OAuth code from deep link, navigating to callback route...');
               // Navigate to the OAuth callback route to handle the code
               navigate(`/oauth/callback${url.search}`, { replace: true });
               console.log('🔗 Navigation triggered to:', `/oauth/callback${url.search}`);
             } else {
               console.warn('🔗 No authorization code or sessionId found in deep link');
             }
           } else {
             console.log('🔗 Not an OAuth callback URL, ignoring');
           }
           console.log('🔗 ===== DEEP LINK PROCESSING END =====');
         } catch (error) {
           console.error('❌ Error handling deep link:', error);
           console.error('🔗 Deep link error details:', {
             message: error.message,
             stack: error.stack
           });
           // Don't let deep link errors crash the app
         }
       };

       // Listen for deep link events
       CapacitorApp.addListener('appUrlOpen', handleDeepLink);
       console.log('🔗 Deep link listener registered');

       // Cleanup listener on unmount
       return () => {
         try {
           CapacitorApp.removeAllListeners();
           console.log('🔗 Deep link listeners removed');
         } catch (error) {
           console.warn('Error removing deep link listeners:', error);
         }
       };
     } else {
       console.log('🔗 Not native platform, skipping deep link setup');
     }
   }, [navigate, connectWithOAuth]);

  return (
    <Routes>
      <Route path="/" element={<AppRoutes />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Separate component for the main app routes that doesn't need useNavigate
const AppRoutes = () => {
  console.log('🚀 AppRoutes component rendering');
  const isMobile = useIsMobile();
  console.log('📱 isMobile:', isMobile);
  console.log('✅ AppRoutes initialization complete');

  return isMobile ? <MobileIndex /> : <Index />;
};

const App = () => {
  useEffect(() => {
    console.log('🚀 App component mounted');
    console.log('🌐 Current location:', window.location.href);
    console.log('🔧 Environment check:', {
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port
    });

    // Debug server URL configuration
    console.log('🔗 Server URL config:', {
      serverUrl: getConfig ? getConfig.serverUrl() : 'getConfig not available',
      isProduction: getConfig ? getConfig.isProduction() : 'unknown',
      isDevelopment: getConfig ? getConfig.isDevelopment() : 'unknown'
    });

    debugImageLoading();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <RouterContent />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
