import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface OAuthCallbackProps {
  onOAuthConnect: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void;
}

export function OAuthCallback({ onOAuthConnect }: OAuthCallbackProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        console.error('OAuth error:', error);
        setError(`Authentication failed: ${error}`);
        setStatus('error');
        return;
      }

      if (!code) {
        console.error('No authorization code received');
        setError('No authorization code received');
        setStatus('error');
        return;
      }

      try {
        console.log('Exchanging authorization code for tokens...');
        
        // Exchange code for tokens via our edge function
        const { data, error: exchangeError } = await supabase.functions.invoke('bexio-oauth/exchange', {
          body: { code, state }
        });

        if (exchangeError) {
          throw new Error(exchangeError.message);
        }

        if (!data || !data.accessToken) {
          throw new Error('Invalid response from token exchange');
        }

        console.log('✅ OAuth completed successfully');
        setStatus('success');
        
        // Call the OAuth success handler
        onOAuthConnect(
          data.accessToken,
          data.refreshToken,
          data.companyId,
          data.userEmail
        );

        // Close popup if this is running in a popup
        if (window.opener && !window.opener.closed) {
          const payload = {
            type: 'BEXIO_OAUTH_SUCCESS',
            credentials: {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              companyId: data.companyId,
              userEmail: data.userEmail
            }
          };
          window.opener.postMessage(payload, '*');
          window.close();
        } else {
          // Navigate back to main app after a brief delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
        }

      } catch (err) {
        console.error('Token exchange failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setStatus('error');
      }
    };

    handleCallback();
  }, [location.search, onOAuthConnect, navigate]);

  const getStatusContent = () => {
    switch (status) {
      case 'processing':
        return {
          title: 'Processing Authentication...',
          message: 'Please wait while we complete your authentication.',
          className: 'text-blue-600'
        };
      case 'success':
        return {
          title: 'Authentication Successful!',
          message: 'You have been successfully authenticated with Bexio.',
          className: 'text-green-600'
        };
      case 'error':
        return {
          title: 'Authentication Failed',
          message: error || 'An unexpected error occurred.',
          className: 'text-red-600'
        };
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