// OAuth callback endpoint for handling Bexio redirects
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for OAuth callback'
    });
  }

  try {
    const { code, state, error: oauthError, error_description } = req.query;

    console.log('🔄 OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!oauthError,
      errorDescription: error_description
    });

    // Handle OAuth errors
    if (oauthError) {
      console.error('❌ OAuth error in callback:', oauthError, error_description);

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>Authentication Failed</h1>
          <p>Error: ${oauthError}</p>
          <p>Description: ${error_description || 'Unknown error'}</p>
          <script>
            // Notify parent window of error
            if (window.opener) {
              window.opener.postMessage({
                type: 'BEXIO_OAUTH_ERROR',
                error: '${oauthError}',
                description: '${error_description || 'Unknown error'}'
              }, '*');
              window.close();
            } else {
              // Mobile app - try to redirect back
              window.location.href = 'bexiosyncbuddy://oauth/callback?error=${encodeURIComponent(oauthError)}&description=${encodeURIComponent(error_description || 'Unknown error')}';
            }
          </script>
        </body>
        </html>
      `);
    }

    // Handle successful authorization
    if (code && state) {
      console.log('✅ OAuth callback successful, exchanging code for tokens...');

      try {
        // Get OAuth credentials from environment
        const clientId = process.env.BEXIO_CLIENT_ID;
        const clientSecret = process.env.BEXIO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new Error('OAuth credentials not configured');
        }

        // Retrieve codeVerifier from session
        const { oauthSessions } = await import('./status/[sessionId].js');
        const session = oauthSessions.get(state);
        const retrievedCodeVerifier = session?.codeVerifier || 'fallback_verifier';

        console.log('🔍 [DEBUG] Session data for state:', state, {
          sessionExists: !!session,
          hasCodeVerifier: !!session?.codeVerifier,
          codeVerifierLength: session?.codeVerifier?.length,
          retrievedCodeVerifier: retrievedCodeVerifier
        });

        // Exchange code for tokens using our exchange endpoint
        const exchangeResponse = await fetch(`${process.env.VITE_SERVER_URL || 'https://tic-tac-puce-chi.vercel.app'}/api/bexio-oauth/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            codeVerifier: retrievedCodeVerifier,
            redirectUri: process.env.BEXIO_SERVER_CALLBACK_URI || `${process.env.VITE_SERVER_URL || 'https://tic-tac-puce-chi.vercel.app'}/api/bexio-oauth/callback`
          })
        });

        if (!exchangeResponse.ok) {
          const errorText = await exchangeResponse.text();
          throw new Error(`Token exchange failed: ${exchangeResponse.status} - ${errorText}`);
        }

        const tokenData = await exchangeResponse.json();
        console.log('✅ Token exchange successful');

        // Update OAuth session status to completed
        try {
          const { oauthSessions } = await import('./status/[sessionId].js');
          const sessionUpdate = {
            sessionId: state,
            status: 'completed',
            tokens: {
              access_token: tokenData.accessToken,
              refresh_token: tokenData.refreshToken,
              company_id: tokenData.companyId,
              user_email: tokenData.userEmail
            },
            userEmail: tokenData.userEmail,
            companyId: tokenData.companyId,
            completed: true
          };

          // Update session in storage
          const existingSession = oauthSessions.get(state);
          if (existingSession) {
            oauthSessions.set(state, { ...existingSession, ...sessionUpdate });
            console.log(`✅ OAuth session ${state} marked as completed`);
          }
        } catch (sessionError) {
          console.error('❌ Failed to update OAuth session status:', sessionError);
          // Continue with response even if session update fails
        }

        // Return success HTML that communicates back to the mobile app
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <h1>Authentication Successful!</h1>
            <p>You can close this window and return to the app.</p>
            <script>
              // Notify parent window of success
              if (window.opener) {
                window.opener.postMessage({
                  type: 'BEXIO_OAUTH_SUCCESS',
                  credentials: ${JSON.stringify(tokenData)}
                }, '*');
                setTimeout(() => window.close(), 2000);
              } else {
                // Mobile app - try to redirect back with success
                window.location.href = 'bexiosyncbuddy://oauth/callback?success=true&access_token=${encodeURIComponent(tokenData.accessToken)}&refresh_token=${encodeURIComponent(tokenData.refreshToken || '')}';
              }
            </script>
          </body>
          </html>
        `);

      } catch (exchangeError) {
        console.error('❌ Token exchange failed:', exchangeError);

        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Failed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <h1>Authentication Failed</h1>
            <p>Failed to exchange authorization code for tokens.</p>
            <p>Error: ${exchangeError.message}</p>
            <script>
              // Notify parent window of error
              if (window.opener) {
                window.opener.postMessage({
                  type: 'BEXIO_OAUTH_ERROR',
                  error: 'token_exchange_failed',
                  description: '${exchangeError.message}'
                }, '*');
                window.close();
              } else {
                // Mobile app - try to redirect back
                window.location.href = 'bexiosyncbuddy://oauth/callback?error=token_exchange_failed&description=${encodeURIComponent(exchangeError.message)}';
              }
            </script>
          </body>
          </html>
        `);
      }
    }

    // Handle missing parameters
    console.error('❌ OAuth callback missing required parameters');
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>Authentication Error</h1>
        <p>Missing authorization code or state parameter.</p>
        <script>
          // Notify parent window of error
          if (window.opener) {
            window.opener.postMessage({
              type: 'BEXIO_OAUTH_ERROR',
              error: 'missing_parameters',
              description: 'Missing authorization code or state parameter'
            }, '*');
            window.close();
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process OAuth callback'
    });
  }
}