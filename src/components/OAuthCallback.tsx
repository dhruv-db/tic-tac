import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth, getServerUrl } from '@/context/OAuthContext';

export function OAuthCallback() {
   const location = useLocation();
   const navigate = useNavigate();
   const { connectWithOAuth } = useAuth();
   const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
   const [error, setError] = useState<string>('');

   useEffect(() => {
     const handleCallback = async () => {
       console.log('🔄 ===== OAUTH CALLBACK COMPONENT START =====');
       console.log('🔄 Current location:', location);
       console.log('🔄 Location search:', location.search);
       console.log('🔄 Location pathname:', location.pathname);
       console.log('🔄 Full URL:', window.location.href);

       const params = new URLSearchParams(location.search);
       const code = params.get('code');
       const state = params.get('state');
       const errParam = params.get('error');

       console.log('🔄 OAuth callback params extracted:', {
         code: code ? `${code.substring(0, 20)}...` : 'null',
         state: state ? `${state.substring(0, 20)}...` : 'null',
         error: errParam
       });

       if (errParam) {
         console.error('❌ OAuth error:', errParam);
         setError(`Authentication failed: ${errParam}`);
         setStatus('error');
         console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (ERROR) =====');
         return;
       }

       if (!code) {
         console.error('❌ No authorization code received');
         setError('No authorization code received');
         setStatus('error');
         console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (NO CODE) =====');
         return;
       }

       // Get stored PKCE verifier
       const codeVerifier = localStorage.getItem('bexio_oauth_code_verifier');
       if (!codeVerifier) {
         console.error('❌ PKCE code verifier not found');
         setError('Authentication session expired. Please try again.');
         setStatus('error');
         console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (NO CODE VERIFIER) =====');
         return;
       }

       // Determine redirect URI based on platform
       const redirectUri = Capacitor.isNativePlatform()
         ? import.meta.env.VITE_BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync://oauth-complete'
         : import.meta.env.VITE_BEXIO_WEB_REDIRECT_URI || `${window.location.origin}/oauth-complete.html`;

       console.log('🔄 Redirect URI for token exchange:', redirectUri);

       try {
         const serverUrl = getServerUrl();
         console.log('🔄 Exchanging authorization code for tokens...');
         console.log('🔄 Token exchange endpoint:', `${serverUrl}/api/bexio-oauth/exchange`);

         // Exchange code for tokens via our local server
         const response = await fetch(`${serverUrl}/api/bexio-oauth/exchange`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ code, codeVerifier, redirectUri, state })
         });

         console.log('🔄 Token exchange response status:', response.status);
         console.log('🔄 Token exchange response headers:', Object.fromEntries(response.headers.entries()));

         if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           console.error('❌ Token exchange failed:', errorData);
           throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
         }

         const data = await response.json();
         console.log('🔄 Token exchange response data:', {
           hasAccessToken: !!data.accessToken,
           hasRefreshToken: !!data.refreshToken,
           companyId: data.companyId,
           userEmail: data.userEmail,
           responseKeys: Object.keys(data)
         });

         if (!data || !data.accessToken) {
           console.error('❌ Invalid response from token exchange - missing access token');
           throw new Error('Invalid response from token exchange');
         }

         console.log('✅ OAuth completed successfully, connecting to app state...');
         setStatus('success');

         // Persist credentials in app state
         console.log('🔗 Calling connectWithOAuth with credentials...');
         await connectWithOAuth(
           data.accessToken,
           data.refreshToken,
           data.companyId,
           data.userEmail
         );
         console.log('✅ connectWithOAuth completed');

         // Clean up stored OAuth state
         localStorage.removeItem('bexio_oauth_code_verifier');
         localStorage.removeItem('bexio_oauth_state');

         // If opened in a popup, notify and close
         if (window.opener && !window.opener.closed) {
           console.log('🔄 Opened in popup, sending message to opener...');
           const payload = {
             type: 'BEXIO_OAUTH_SUCCESS',
             credentials: {
               accessToken: data.accessToken,
               refreshToken: data.refreshToken,
               companyId: data.companyId,
               userEmail: data.userEmail
             }
           } as const;
           try {
             window.opener.postMessage(payload, '*');
             console.log('✅ Message sent to opener');
           } catch (e) {
             console.warn('❌ Failed to send message to opener:', e);
           }
           window.close();
           console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (POPUP CLOSED) =====');
         } else {
           console.log('🔄 Not in popup, navigating to home after delay...');
           // Navigate back after a brief delay
           setTimeout(() => {
             console.log('🔄 Navigating to home page...');
             navigate('/', { replace: true });
             console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (NAVIGATED HOME) =====');
           }, 600);
         }

       } catch (err) {
         console.error('❌ Token exchange failed:', err);
         console.error('❌ Error details:', {
           message: err.message,
           stack: err.stack
         });

         // Clean up stored OAuth state on error
         localStorage.removeItem('bexio_oauth_code_verifier');
         localStorage.removeItem('bexio_oauth_state');

         setError(err instanceof Error ? err.message : 'Unknown error occurred');
         setStatus('error');
         console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (EXCEPTION) =====');
       }
     };

     handleCallback();
   }, [location.search, navigate, connectWithOAuth]);

  const getStatusContent = () => {
    switch (status) {
      case 'processing':
        return {
          title: 'Processing Authentication...',
          message: 'Please wait while we complete your authentication.',
          className: 'text-blue-600'
        } as const;
      case 'success':
        return {
          title: 'Authentication Successful!',
          message: 'You have been successfully authenticated with Bexio.',
          className: 'text-green-600'
        } as const;
      case 'error':
        return {
          title: 'Authentication Failed',
          message: error || 'An unexpected error occurred.',
          className: 'text-red-600'
        } as const;
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6 text-center">
        <div className={`mb-4 ${statusContent.className}`}>
          <div className="text-2xl font-semibold mb-2">
            {statusContent.title}
          </div>
          <div className="text-muted-foreground">
            {statusContent.message}
          </div>
        </div>
        
        {status === 'processing' && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="mt-4">
            <button 
              onClick={() => navigate('/')}
              className="text-primary hover:underline"
            >
              Return to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
