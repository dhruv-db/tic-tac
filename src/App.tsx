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
import { AuthProvider, useAuth } from "@/context/OAuthContext";

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
  console.log('✅ RouterContent initialization complete');

  // Handle deep links for OAuth callbacks (mobile apps)
   useEffect(() => {
     if (Capacitor.isNativePlatform()) {
       console.log('🔗 Setting up deep link listener for OAuth callbacks');

       const handleDeepLink = (event: any) => {
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

           // Check if this is an OAuth callback
           if (url.pathname === '/oauth/callback' || url.href.includes('oauth/callback')) {
             console.log('🔗 ✅ OAuth callback detected via deep link');

             const params = new URLSearchParams(url.search);
             const code = params.get('code');
             const state = params.get('state');
             const error = params.get('error');

             console.log('🔗 OAuth callback params:', {
               code: code ? `${code.substring(0, 20)}...` : 'missing',
               state: state ? `${state.substring(0, 20)}...` : 'missing',
               error
             });

             if (error) {
               console.error('❌ OAuth error via deep link:', error);
               return;
             }

             if (code) {
               console.log('✅ Processing OAuth code from deep link, navigating to callback route...');
               // Navigate to the OAuth callback route to handle the code
               navigate(`/oauth/callback${url.search}`, { replace: true });
               console.log('🔗 Navigation triggered to:', `/oauth/callback${url.search}`);
             } else {
               console.warn('🔗 No authorization code found in deep link');
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

const App = () => (
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

export default App;
