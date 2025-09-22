import { BEXIO_CONFIG } from '../_utils.js';

export default async function handler(req, res) {
  console.log('🔧 ===== OAUTH AUTH ENDPOINT START =====');
  console.log('🔧 Method:', req.method);
  console.log('🔧 URL:', req.url);
  console.log('🔧 User-Agent:', req.headers['user-agent']);
  console.log('🔧 Content-Type:', req.headers['content-type']);
  console.log('🔧 Timestamp:', new Date().toISOString());
  console.log('🔧 Request body keys:', req.body ? Object.keys(req.body) : 'null');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { state, scope: requestedScope, codeChallenge, codeChallengeMethod, codeVerifier, returnUrl, sessionId, platform } = req.body;

    console.log('🔐 OAuth initiation request:', {
      state: state ? 'present' : 'missing',
      scope: requestedScope,
      codeChallengeMethod,
      returnUrl,
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
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
    console.log('✅ ===== OAUTH AUTH ENDPOINT END (SUCCESS) =====');

    res.json({
      authUrl
    });

  } catch (error) {
    console.error('❌ ===== OAUTH AUTH ENDPOINT END (ERROR) =====');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.log('🔧 ===== OAUTH AUTH ENDPOINT END =====');

    res.status(500).json({
      error: 'OAuth initiation failed',
      details: error.message
    });
  }
}