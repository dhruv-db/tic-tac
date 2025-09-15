require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { default: fetch } = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory session storage for OAuth sessions (in production, use Redis/database)
const oauthSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Add logging and cache control for static file requests
app.use('/oauth-complete.html', (req, res, next) => {
  console.log('📄 Serving oauth-complete.html');
  console.log('🔍 Request URL:', req.url);
  console.log('🌐 Full request path:', req.path);
  console.log('📊 Query parameters:', req.query);

  // Prevent caching of OAuth completion page
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  next();
});

// Bexio OAuth configuration
const BEXIO_CONFIG = {
  clientId: process.env.BEXIO_CLIENT_ID || 'your_client_id_here',
  clientSecret: process.env.BEXIO_CLIENT_SECRET || 'your_client_secret_here',
  // Support both web and mobile redirect URIs
  webRedirectUri: process.env.BEXIO_WEB_REDIRECT_URI || 'http://localhost:8081/oauth-complete.html',
  mobileRedirectUri: process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexiosyncbuddy://oauth/callback',
  authUrl: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth',
  tokenUrl: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token',
  apiBaseUrl: 'https://api.bexio.com/api2',
  // Server callback URI for OAuth (should match what's registered with Bexio)
  serverCallbackUri: process.env.BEXIO_SERVER_CALLBACK_URI || `http://localhost:${PORT}/api/bexio-oauth/callback`
};

// Generate PKCE challenge
function generatePKCE() {
  const length = 64;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const random = crypto.randomBytes(length);
  let codeVerifier = '';
  for (let i = 0; i < length; i++) {
    codeVerifier += charset[random[i] % charset.length];
  }

  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}

// Start OAuth session endpoint (for mobile apps)
app.post('/api/bexio-oauth/start', async (req, res) => {
  try {
    const sessionId = Math.random().toString(36).substring(2, 15);

    // Initialize session
    oauthSessions.set(sessionId, {
      status: 'pending',
      createdAt: new Date(),
      platform: req.body.platform || 'unknown'
    });

    console.log(`📱 Started OAuth session: ${sessionId}`);

    res.json({
      sessionId,
      status: 'pending'
    });

  } catch (error) {
    console.error('❌ Failed to start OAuth session:', error);
    res.status(500).json({
      error: 'Failed to start OAuth session',
      details: error.message
    });
  }
});

// Check OAuth session status endpoint
app.get('/api/bexio-oauth/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = oauthSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Clean up old sessions (older than 10 minutes)
    if (Date.now() - session.createdAt.getTime() > 10 * 60 * 1000) {
      oauthSessions.delete(sessionId);
      return res.status(404).json({ error: 'Session expired' });
    }

    res.json({
      sessionId,
      status: session.status,
      data: session.data || null,
      createdAt: session.createdAt
    });

  } catch (error) {
    console.error('❌ Failed to check session status:', error);
    res.status(500).json({
      error: 'Failed to check session status',
      details: error.message
    });
  }
});

// OAuth initiation endpoint
app.post('/api/bexio-oauth/auth', async (req, res) => {
  try {
    const { state, scope: requestedScope, codeChallenge, codeChallengeMethod, codeVerifier, returnUrl, sessionId, platform } = req.body;

    console.log('🔐 OAuth initiation request:', {
      state: state ? 'present' : 'missing',
      scope: requestedScope,
      codeChallengeMethod,
      returnUrl
    });

    // Allow OIDC scopes and API scopes that are configured for the app
    const allowedScopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'company_profile',
      'contact_show',
      'contact_edit',
      'project_show',
      'project_edit',
      'accounting',
      'monitoring_show',
      'monitoring_edit'
    ];

    const requested = (requestedScope || '').split(/\s+/).filter((s) => allowedScopes.includes(s));
    const finalScope = (requested.length ? requested : [
      'openid',
      'profile',
      'email',
      'offline_access'
    ]).join(' ');

    // Determine redirect URI based on platform
    const isMobile = platform === 'mobile' || platform === 'ios' || platform === 'android';
    const redirectUri = isMobile ? BEXIO_CONFIG.mobileRedirectUri : BEXIO_CONFIG.webRedirectUri;

    console.log(`🔗 Using ${isMobile ? 'mobile' : 'web'} redirect URI: ${redirectUri}`);

    // Pack state with code_verifier, return URL, platform, and session ID for redirect
    let packedState = state;
    try {
      packedState = Buffer.from(JSON.stringify({
        s: state,
        cv: codeVerifier || null,
        ru: returnUrl || '',
        sid: sessionId || null,
        platform: platform || 'web'
      })).toString('base64');
    } catch (e) {
      console.warn('Failed to pack state:', e);
    }

    // Use server's callback endpoint as redirect URI
    const serverRedirectUri = BEXIO_CONFIG.serverCallbackUri;

    const params = new URLSearchParams({
      client_id: BEXIO_CONFIG.clientId,
      redirect_uri: serverRedirectUri,
      response_type: 'code',
      scope: finalScope,
      state: packedState
    });

    // Add PKCE parameters if provided
    if (codeChallenge && codeChallengeMethod) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', codeChallengeMethod);
    }

    const authUrl = `${BEXIO_CONFIG.authUrl}?${params.toString()}`;

    console.log('🔗 Generated OAuth URL (OIDC scopes):', authUrl.substring(0, 100) + '...');

    res.json({
      authUrl
    });

  } catch (error) {
    console.error('❌ OAuth initiation failed:', error);
    res.status(500).json({
      error: 'OAuth initiation failed',
      details: error.message
    });
  }
});

// Token exchange endpoint
app.post('/api/bexio-oauth/exchange', async (req, res) => {
  try {
    const { code, state, codeVerifier } = req.body;

    console.log('🔄 Token exchange request:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      codeVerifier: codeVerifier ? 'present' : 'missing'
    });

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

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
      return res.status(tokenResponse.status).json({
        error: 'Token exchange failed',
        details: errorText
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Get user info if we have an access token
    let userInfo = null;
    if (tokenData.access_token) {
      try {
        const userResponse = await fetch(`${BEXIO_CONFIG.apiBaseUrl}/user`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (userResponse.ok) {
          userInfo = await userResponse.json();
          console.log('👤 User info retrieved:', userInfo.email || 'no email');
        }
      } catch (userError) {
        console.warn('⚠️ Failed to get user info:', userError.message);
      }
    }

    // Get company info
    let companyInfo = null;
    if (tokenData.access_token) {
      try {
        const companyResponse = await fetch(`${BEXIO_CONFIG.apiBaseUrl}/company`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (companyResponse.ok) {
          const companies = await companyResponse.json();
          companyInfo = companies[0]; // Use first company
          console.log('🏢 Company info retrieved:', companyInfo?.name || 'no name');
        }
      } catch (companyError) {
        console.warn('⚠️ Failed to get company info:', companyError.message);
      }
    }

    // Return the token data
    const response = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      companyId: companyInfo?.id,
      userEmail: userInfo?.email,
      userId: userInfo?.id,
      companyName: companyInfo?.name
    };

    console.log('📦 Returning OAuth response:', {
      hasAccessToken: !!response.accessToken,
      hasRefreshToken: !!response.refreshToken,
      companyId: response.companyId,
      userEmail: response.userEmail
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Token exchange error:', error);
    res.status(500).json({
      error: 'Token exchange failed',
      details: error.message
    });
  }
});

// OAuth callback endpoint - complete session for mobile/web
app.get('/api/bexio-oauth/callback', async (req, res) => {
  console.log('🔄 ===== OAUTH CALLBACK START =====');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('🌐 Full request URL:', req.url);

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
      return res.redirect(`http://localhost:${PORT}/oauth-complete.html?error=${encodeURIComponent(error)}&t=${timestamp}`);
    }

    if (!code) {
      console.error('❌ No authorization code in callback');
      const timestamp = Date.now();
      return res.redirect(`http://localhost:${PORT}/oauth-complete.html?error=no_code&t=${timestamp}`);
    }

    // Extract session data from state
    let sessionId = null;
    let codeVerifier = null;
    let returnUrl = `http://localhost:${PORT}/oauth-complete.html`;
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

    // Check if this is a session-based OAuth (mobile app)
    if (sessionId && oauthSessions.has(sessionId)) {
      console.log(`📱 Completing OAuth session: ${sessionId}`);

      // Update session with completed data
      oauthSessions.set(sessionId, {
        status: 'completed',
        createdAt: oauthSessions.get(sessionId).createdAt,
        platform: oauthSessions.get(sessionId).platform,
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          companyId,
          userEmail,
          tokenType: tokenData.token_type,
          expiresIn: tokenData.expires_in
        }
      });

      console.log('🔄 ===== OAUTH CALLBACK END (SESSION COMPLETED) =====');

      // Redirect to completion page that will close the browser (with timestamp to prevent caching)
      const timestamp = Date.now();
      return res.redirect(`http://localhost:${PORT}/oauth-complete.html?session=${sessionId}&status=completed&t=${timestamp}`);
    } else {
      // Handle both web and mobile redirects
      const isMobile = platform === 'mobile' || platform === 'ios' || platform === 'android';

      if (isMobile) {
        // Mobile app flow - redirect with tokens to mobile app
        console.log('📱 Mobile OAuth flow - redirecting with tokens');
        const redirectParams = new URLSearchParams({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || '',
          company_id: companyId,
          user_email: userEmail,
          id_token: idToken,
          expires_in: (tokenData.expires_in || 3600).toString()
        });

        const mobileRedirectUrl = `${BEXIO_CONFIG.mobileRedirectUri}?${redirectParams.toString()}`;
        console.log('🔄 ===== OAUTH CALLBACK END (MOBILE REDIRECT) =====');
        return res.redirect(mobileRedirectUrl);
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
        console.log('🔄 ===== OAUTH CALLBACK END (WEB REDIRECT) =====');
        return res.redirect(redirectUrl);
      }
    }

  } catch (error) {
    console.error('❌ OAuth callback processing failed:', error);
    const timestamp = Date.now();
    res.redirect(`http://localhost:${PORT}/oauth-complete.html?error=callback_failed&t=${timestamp}`);
  }
});

// Proxy endpoint for Bexio API calls
app.post('/api/bexio-proxy', async (req, res) => {
  try {
    const { endpoint, apiKey, accessToken, companyId, method = 'GET', data: requestData, acceptLanguage } = req.body;

    if (!endpoint || !(apiKey || accessToken)) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    console.log(`🔄 Proxying request to Bexio API: ${endpoint}`);

    const token = accessToken || apiKey || '';
    console.log(`🔑 Using bearer token: ${token ? token.substring(0, 10) + '...' : 'none'}`);
    console.log(`📡 Request method: ${method}`);

    if ((method === 'POST' || method === 'PUT') && requestData) {
      console.log('📦 Request payload:', JSON.stringify(requestData, null, 2));
    }

    // Build correct Bexio base URL depending on version in the endpoint
    const bexioUrl = endpoint.startsWith('/3.0')
      ? `https://api.bexio.com${endpoint}`
      : endpoint.startsWith('/2.0')
        ? `https://api.bexio.com${endpoint}`
        : `https://api.bexio.com/2.0${endpoint}`;

    const requestOptions = {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Accept-Language': acceptLanguage || 'en',
        'Content-Type': 'application/json',
        'User-Agent': 'Bexio-Sync-Buddy/1.0'
      }
    };

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && requestData) {
      requestOptions.body = JSON.stringify(requestData);
    }

    console.log(`🌐 Making request to: ${bexioUrl}`);

    const response = await fetch(bexioUrl, requestOptions);

    if (!response.ok) {
      console.error(`❌ Bexio API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('📄 Error details:', errorText);
      return res.status(response.status).json({
        error: `Bexio API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${endpoint}, returned ${Array.isArray(data) ? data.length : 'single'} item(s)`);

    res.json(data);

  } catch (error) {
    console.error('❌ Error in bexio-proxy:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Clear sessions endpoint
app.post('/api/bexio-oauth/clear-sessions', (req, res) => {
  try {
    const { clearAll } = req.body;

    if (clearAll) {
      // Clear all OAuth sessions
      const sessionCount = oauthSessions.size;
      oauthSessions.clear();

      console.log(`🧹 Cleared ${sessionCount} OAuth sessions`);

      res.json({
        success: true,
        message: `Cleared ${sessionCount} sessions`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        error: 'Invalid request. Use { "clearAll": true } to clear all sessions.'
      });
    }
  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
    res.status(500).json({
      error: 'Failed to clear sessions',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Bexio OAuth Proxy'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bexio OAuth Proxy Server running on port ${PORT} (accessible from all interfaces)`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 OAuth endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/bexio-oauth/auth`);
  console.log(`   GET  http://localhost:${PORT}/api/bexio-oauth/callback`);
  console.log(`   POST http://localhost:${PORT}/api/bexio-oauth/exchange`);
  console.log(`   POST http://localhost:${PORT}/api/bexio-proxy`);
  console.log(`🌐 Server callback URI: ${BEXIO_CONFIG.serverCallbackUri}`);
});

module.exports = app;