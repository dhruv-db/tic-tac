import { BEXIO_CONFIG } from '../_utils.js';

export default async function handler(req, res) {
  console.log('🔄 ===== OAUTH CALLBACK START =====');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🌐 Full request URL:', req.url);
  console.log('📊 Request headers:', req.headers);
  console.log('📋 User-Agent:', req.headers['user-agent']);

  try {
    const code = req.query.code;
    const stateParam = req.query.state;
    const error = req.query.error;

    console.log('🔄 OAuth callback received:', {
      code: code ? 'present' : 'missing',
      state: stateParam ? 'present' : 'missing',
      error
    });

    if (error) {
      console.error('❌ OAuth callback error:', error);
      const timestamp = Date.now();
      return res.redirect(`/oauth-complete.html?error=${encodeURIComponent(error)}&t=${timestamp}`);
    }

    if (!code) {
      console.error('❌ No authorization code in callback');
      const timestamp = Date.now();
      return res.redirect(`/oauth-complete.html?error=no_code&t=${timestamp}`);
    }

    // Extract session data from state
    let sessionId = null;
    let codeVerifier = null;
    let returnUrl = `/oauth-complete.html`;
    let platform = 'web';

    console.log('🔑 Decoding state parameter...');
    try {
      const decoded = JSON.parse(Buffer.from(stateParam || '', 'base64').toString());
      console.log('📦 Decoded state object:', decoded);
      if (decoded && typeof decoded === 'object') {
        sessionId = decoded.sid || null;
        codeVerifier = decoded.cv || null;
        returnUrl = decoded.ru || returnUrl;
        platform = decoded.platform || 'web';
        console.log('✅ Successfully extracted from state');
      }
    } catch (e) {
      console.warn('❌ Failed to decode state:', e.message);
    }

    console.log('🔑 Extracted from state:', {
      sessionId,
      codeVerifier: codeVerifier ? 'present' : 'missing',
      returnUrl
    });

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: BEXIO_CONFIG.clientId,
      client_secret: BEXIO_CONFIG.clientSecret,
      redirect_uri: BEXIO_CONFIG.serverCallbackUri,
      code: code
    });

    // Add PKCE code_verifier if present
    if (codeVerifier) {
      tokenParams.set('code_verifier', codeVerifier);
    }

    console.log('📡 Exchanging code for tokens...');
    const tokenResponse = await fetch(BEXIO_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      const timestamp = Date.now();
      return res.redirect(`${returnUrl}?error=token_exchange_failed&t=${timestamp}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Extract user info from tokens
    let companyId = '';
    let userEmail = '';

    // Extract email from ID token
    const idToken = tokenData.id_token || '';
    if (idToken) {
      try {
        const idTokenParts = idToken.split('.');
        if (idTokenParts.length === 3) {
          const idPayload = JSON.parse(Buffer.from(idTokenParts[1], 'base64').toString());
          userEmail = idPayload.email || '';
        }
      } catch (idTokenError) {
        console.warn('⚠️ Failed to parse ID token:', idTokenError);
      }
    }

    // Extract company ID from access token
    try {
      const accessToken = tokenData.access_token;
      const tokenParts = accessToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        companyId = payload.company_id || payload.user_id?.toString() || '';
        if (!userEmail) {
          userEmail = payload.email || payload.login_id || '';
        }
      }
    } catch (jwtError) {
      console.warn('⚠️ Failed to parse access token:', jwtError);
    }

    // Handle both web and mobile redirects
    const isMobile = platform === 'mobile' || platform === 'ios' || platform === 'android';
    console.log('📱 Platform detection:', { platform, isMobile, mobileRedirectUri: BEXIO_CONFIG.mobileRedirectUri });

    // Prepare token data for response
    const tokenDataResponse = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      tokenType: tokenData.token_type || 'Bearer',
      expiresIn: tokenData.expires_in || 3600,
      companyId: companyId,
      userEmail: userEmail,
      idToken: idToken
    };

    if (isMobile) {
      // Mobile app flow - store tokens in session for polling
      if (sessionId) {
        console.log('📱 Mobile OAuth flow - storing tokens in session:', sessionId);

        // Store session data (in a real app, you'd use Redis/database)
        if (!global.oauthSessions) {
          global.oauthSessions = new Map();
        }

        global.oauthSessions.set(sessionId, {
          status: 'completed',
          platform: platform || 'mobile',
          createdAt: new Date().toISOString(),
          data: tokenDataResponse
        });

        console.log('✅ OAuth tokens stored in session for mobile app');
        console.log('🔄 ===== OAUTH CALLBACK END (MOBILE SESSION STORED) =====');

        // Redirect to completion page for mobile app to handle polling
        const timestamp = Date.now();
        return res.redirect(`/oauth-complete.html?mobile=true&sessionId=${sessionId}&t=${timestamp}`);
      } else {
        // Fallback: redirect with tokens to mobile app
        console.log('📱 Mobile OAuth flow - redirecting with tokens (no session)');
        const redirectParams = new URLSearchParams({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          company_id: companyId,
          user_email: userEmail,
          id_token: idToken,
          expires_in: (tokenData.expires_in || 3600).toString()
        });

        const mobileRedirectUrl = `${BEXIO_CONFIG.mobileRedirectUri}?${redirectParams.toString()}`;
        console.log('🔗 Mobile redirect URL:', mobileRedirectUrl);
        console.log('🔄 ===== OAUTH CALLBACK END (MOBILE REDIRECT) =====');
        return res.redirect(mobileRedirectUrl);
      }
    } else {
      // Web flow - redirect with tokens to web app
      console.log('🌐 Web OAuth flow - redirecting with tokens');
      const redirectParams = new URLSearchParams({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '',
        company_id: companyId,
        user_email: userEmail,
        id_token: idToken,
        expires_in: (tokenData.expires_in || 3600).toString()
      });

      const redirectUrl = `${returnUrl}?${redirectParams.toString()}`;
      console.log('🔗 Web redirect URL:', redirectUrl);
      console.log('🔄 ===== OAUTH CALLBACK END (WEB REDIRECT) =====');
      return res.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('❌ OAuth callback processing failed:', error);
    const timestamp = Date.now();
    res.redirect(`/oauth-complete.html?error=callback_failed&t=${timestamp}`);
  }
}