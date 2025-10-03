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

    console.log('🔄 Mobile OAuth callback received:', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!oauthError,
      errorDescription: error_description
    });

    // Handle OAuth errors
    if (oauthError) {
      console.error('❌ OAuth error in mobile callback:', oauthError, error_description);

      const redirectUrl = `bexio-sync://oauth-complete?error=${encodeURIComponent(oauthError)}&description=${encodeURIComponent(error_description || 'Unknown error')}`;
      return res.redirect(redirectUrl);
    }

    // Handle successful authorization
    if (code && state) {
      console.log('✅ Mobile OAuth callback successful, exchanging code for tokens...');

      try {
        // Get OAuth credentials from environment
        const clientId = process.env.BEXIO_CLIENT_ID;
        const clientSecret = process.env.BEXIO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new Error('OAuth credentials not configured');
        }

        // Retrieve code verifier from session
        const { oauthSessions } = await import('./status/[sessionId].js');
        const session = oauthSessions.get(state);
        if (!session || !session.codeVerifier) {
          throw new Error('OAuth session not found or missing code verifier');
        }

        const codeVerifier = session.codeVerifier;
        console.log('🔑 Retrieved code verifier from session');

        // Exchange code for tokens directly with Bexio
        const tokenUrl = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token';
        console.log('🔗 Using Bexio token URL:', tokenUrl);
        const tokenRequestBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/bexio-oauth/mobile-callback`,
          code_verifier: codeVerifier
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
          // Continue with redirect even if session update fails
        }

        // Redirect to custom scheme with sessionId
        const redirectUrl = `bexio-sync://oauth-complete?sessionId=${encodeURIComponent(state)}`;
        return res.redirect(redirectUrl);

      } catch (exchangeError) {
        console.error('❌ Token exchange failed:', exchangeError);

        const redirectUrl = `bexio-sync://oauth-complete?error=token_exchange_failed&description=${encodeURIComponent(exchangeError.message)}`;
        return res.redirect(redirectUrl);
      }
    }

    // Handle missing parameters
    console.error('❌ Mobile OAuth callback missing required parameters');
    const redirectUrl = `bexio-sync://oauth-complete?error=missing_parameters&description=${encodeURIComponent('Missing authorization code or state parameter')}`;
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Mobile OAuth callback error:', error);
    const redirectUrl = `bexio-sync://oauth-complete?error=internal_error&description=${encodeURIComponent('Failed to process OAuth callback')}`;
    return res.redirect(redirectUrl);
  }
}