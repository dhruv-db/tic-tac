// Mobile OAuth callback endpoint for handling Bexio redirects
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

    console.log('🔄 ===== MOBILE OAUTH CALLBACK RECEIVED =====');
    console.log('🔄 Timestamp:', new Date().toISOString());
    console.log('🔄 Full URL:', req.url);
    console.log('🔄 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔄 Query parameters:', JSON.stringify(req.query, null, 2));
    console.log('🔄 User-Agent:', req.headers['user-agent']);
    console.log('🔄 Referer:', req.headers.referer);
    console.log('🔄 Mobile OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!oauthError,
      errorDescription: error_description,
      codeLength: code ? code.length : 0,
      stateLength: state ? state.length : 0
    });

    // Handle OAuth errors
    if (oauthError) {
      console.error('❌ OAuth error in mobile callback:', oauthError, error_description);

      const redirectUrl = `${process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync-buddy://oauth-complete/'}?error=${encodeURIComponent(oauthError)}&description=${encodeURIComponent(error_description || 'Unknown error')}`;
      return res.redirect(redirectUrl);
    }

    // Handle successful authorization
    if (code && state) {
      console.log('✅ Mobile OAuth callback successful, exchanging code for tokens...');

      try {
        // Parse the state parameter to extract the original session ID
        // State format: sessionId:codeVerifier (encoded in auth.js)
        const stateParts = state.split(':');
        const sessionId = stateParts[0]; // Original session ID
        const encodedCodeVerifier = stateParts[1]; // Code verifier from state (for validation)

        console.log('🔍 Parsed state parameter:', { sessionId, hasCodeVerifier: !!encodedCodeVerifier });

        // Get OAuth credentials from environment
        const clientId = process.env.BEXIO_CLIENT_ID;
        const clientSecret = process.env.BEXIO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new Error('OAuth credentials not configured');
        }

        // Retrieve session data using the original session ID
        const { oauthSessions } = await import('./status/[sessionId].js');
        const session = oauthSessions.get(sessionId);
        if (!session || !session.codeVerifier) {
          throw new Error('OAuth session not found or invalid');
        }

        // Validate that the code verifier from state matches the stored one (extra security)
        if (encodedCodeVerifier && encodedCodeVerifier !== session.codeVerifier) {
          console.warn('⚠️ Code verifier mismatch between state parameter and stored session');
        }

        console.log('✅ Retrieved OAuth session for token exchange');

        // Exchange code for tokens directly with Bexio
        const tokenUrl = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token';
        console.log('🔗 Using Bexio token URL:', tokenUrl);
        const tokenRequestBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: process.env.BEXIO_SERVER_CALLBACK_URI || 'https://tic-tac-puce-chi.vercel.app/api/bexio-oauth/mobile-callback',
          code_verifier: session.codeVerifier
        });

        const exchangeResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: tokenRequestBody.toString()
        });

        if (!exchangeResponse.ok) {
          const errorText = await exchangeResponse.text();
          throw new Error(`Token exchange failed: ${exchangeResponse.status} - ${errorText}`);
        }

        const tokenResponse = await exchangeResponse.json();
        console.log('✅ Token exchange successful');

        // Decode JWT to extract company ID
        const decodeJwt = (token) => {
          try {
            if (!token) return null;
            const payload = token.split('.')[1];
            const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(json);
          } catch {
            return null;
          }
        };

        const decoded = decodeJwt(tokenResponse.access_token);
        const companyId = decoded?.company_id || decoded?.companyId || null;
        console.log('🔍 Extracted company ID from token:', companyId);

        // Calculate expiration time
        const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

        // Fetch user info to get user_email
        let userEmail = null;
        try {
          const userResponse = await fetch('https://api.bexio.com/3.0/users/me', {
            headers: {
              'Authorization': `Bearer ${tokenResponse.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            userEmail = userData.email;
            console.log('✅ User info fetched successfully');
          } else {
            console.warn('⚠️ Failed to fetch user info, continuing without user_email');
          }
        } catch (userError) {
          console.warn('⚠️ Error fetching user info:', userError);
        }

        const tokenData = {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          companyId,
          expiresAt,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          userEmail
        };

        // Update OAuth session status to completed
        try {
          const { oauthSessions } = await import('./status/[sessionId].js');
          const sessionUpdate = {
            sessionId: sessionId,
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
          const existingSession = oauthSessions.get(sessionId);
          if (existingSession) {
            oauthSessions.set(sessionId, { ...existingSession, ...sessionUpdate });
            console.log(`✅ OAuth session ${sessionId} marked as completed`);
          }
        } catch (sessionError) {
          console.error('❌ Failed to update OAuth session status:', sessionError);
          // Continue with redirect even if session update fails
        }

        // Return HTML page that automatically redirects to custom scheme
        const redirectUrl = `${process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync-buddy://oauth-complete/'}?sessionId=${encodeURIComponent(sessionId)}`;
        console.log('🔄 Returning HTML redirect page to:', redirectUrl);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .container {
            max-width: 400px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Authentication Successful!</h1>
        <p>Redirecting you back to the app...</p>
        <div class="spinner"></div>
        <p style="font-size: 14px; opacity: 0.8; margin-top: 20px;">
            If you're not redirected automatically, please wait a moment.
        </p>
    </div>

    <script>
        // Try multiple redirect methods for maximum compatibility
        function redirectToApp() {
            const url = '${redirectUrl.replace(/'/g, "\\'")}';
            console.log('Attempting redirect to:', url);

            // Method 1: Direct location change
            try {
                window.location.href = url;
            } catch (e) {
                console.warn('Direct redirect failed:', e);
            }

            // Method 2: Try opening as popup then redirect
            setTimeout(() => {
                try {
                    const popup = window.open(url, '_blank');
                    if (popup) {
                        popup.close();
                        window.location.href = url;
                    }
                } catch (e) {
                    console.warn('Popup redirect failed:', e);
                }
            }, 500);

            // Method 3: Fallback - show manual redirect button
            setTimeout(() => {
                if (!document.hidden) {
                    showManualRedirect(url);
                }
            }, 2000);
        }

        function showManualRedirect(url) {
            const container = document.querySelector('.container');
            if (!document.getElementById('manual-redirect')) {
                const button = document.createElement('button');
                button.id = 'manual-redirect';
                button.innerHTML = 'Continue to App';
                button.style.cssText = \`
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.2s;
                \`;
                button.onmouseover = () => button.style.background = '#f0f0f0';
                button.onmouseout = () => button.style.background = 'white';
                button.onclick = () => window.location.href = url;
                container.appendChild(button);
            }
        }

        // Start redirect process
        redirectToApp();

        // Fallback: try again after a delay
        setTimeout(redirectToApp, 1000);
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

      } catch (exchangeError) {
        console.error('❌ Token exchange failed:', exchangeError);

        const redirectUrl = `${process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync-buddy://oauth-complete/'}?error=token_exchange_failed&description=${encodeURIComponent(exchangeError.message)}`;
        return res.redirect(redirectUrl);
      }
    }

    // Handle missing parameters
    console.error('❌ Mobile OAuth callback missing required parameters');
    const redirectUrl = `${process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync-buddy://oauth-complete/'}?error=missing_parameters&description=${encodeURIComponent('Missing authorization code or state parameter')}`;
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Mobile OAuth callback error:', error);
    const redirectUrl = `${process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexio-sync-buddy://oauth-complete/'}?error=internal_error&description=${encodeURIComponent('Failed to process OAuth callback')}`;
    return res.redirect(redirectUrl);
  }
}