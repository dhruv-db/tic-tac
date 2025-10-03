import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { oauthService } from '@/lib/oauthService';

export function OAuthCallback() {
    const location = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [error, setError] = useState<string>('');

    useEffect(() => {
      const handleCallback = async () => {
        console.log('🔄 ===== OAUTH CALLBACK COMPONENT START =====');
        console.log('🔄 Current location:', location);
        console.log('🔄 Location search:', location.search);
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

        try {
          console.log('✅ OAuth callback received, processing with unified service...');
          setStatus('success');

          // Process the OAuth callback using the unified service
          await oauthService.handleCallback(code, state);

          // If opened in a popup, close it
          if (window.opener && !window.opener.closed) {
            console.log('🔄 Opened in popup, closing...');
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
          console.error('❌ OAuth callback processing failed:', err);
          console.error('❌ Error details:', {
            message: err.message,
            stack: err.stack
          });

          setError(err instanceof Error ? err.message : 'Unknown error occurred');
          setStatus('error');
          console.log('🔄 ===== OAUTH CALLBACK COMPONENT END (EXCEPTION) =====');
        }
      };

      handleCallback();
    }, [location.search, navigate]);

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
