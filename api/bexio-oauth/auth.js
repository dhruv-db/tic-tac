// OAuth initiation endpoint for Bexio
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { redirectUri, state } = req.body;

    console.log('🔗 [DEBUG] Auth API received:', {
      redirectUri,
      stateLength: state?.length,
      statePreview: state?.substring(0, 50) + '...'
    });

    if (!redirectUri || !state) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'redirectUri and state are required'
      });
    }

    // Bexio OAuth configuration
    const clientId = process.env.BEXIO_CLIENT_ID;
    const baseAuthUrl = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth';
    console.log('🔗 Using Bexio auth URL:', baseAuthUrl);

    if (!clientId) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'BEXIO_CLIENT_ID not configured'
      });
    }

    // Extract codeVerifier from packed state
    let codeVerifier;
    let packedStateData;
    try {
      const decodedState = atob(state);
      packedStateData = JSON.parse(decodedState);
      codeVerifier = packedStateData.cv;
      console.log('🔍 [DEBUG] Extracted codeVerifier from packed state:', {
        hasCodeVerifier: !!codeVerifier,
        codeVerifierLength: codeVerifier?.length,
        codeVerifierPreview: codeVerifier?.substring(0, 20) + '...'
      });
    } catch (error) {
      console.error('❌ [DEBUG] Failed to extract codeVerifier from state:', error);
      return res.status(400).json({
        error: 'Invalid state parameter',
        message: 'Could not parse state parameter'
      });
    }

    if (!codeVerifier) {
      return res.status(400).json({
        error: 'Missing code verifier',
        message: 'codeVerifier not found in state'
      });
    }

    // Generate code challenge from the extracted verifier
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Use the packed state as-is for the OAuth state parameter
    const encodedState = state;

    // Construct Bexio authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email offline_access contact_show project_show monitoring_show',
      state: encodedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authorizationUrl = `${baseAuthUrl}?${params.toString()}`;

    // Create OAuth session for status tracking
    const sessionId = packedStateData.s; // Use session ID from packed state
    const sessionData = {
      status: 'pending',
      codeVerifier,
      state: packedStateData,
      createdAt: Date.now(),
      platform: req.body.platform || 'web',
      redirectUri // persist exact redirect used during authorization
    };

    // Store session data (in production, use Redis or database)
    // For now, we'll use the same in-memory storage as the status endpoint
    const { oauthSessions } = await import('./status/[sessionId].js');
    oauthSessions.set(sessionId, sessionData);

    console.log(`🆕 [API] OAuth session created: ${sessionId} for platform: ${sessionData.platform} at ${new Date().toISOString()}`);
    console.log(`🆕 [API] Total active sessions after creation: ${oauthSessions.size}`);

    res.status(200).json({
      authorizationUrl,
      codeVerifier,
      state: encodedState,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to initiate OAuth flow'
    });
  }
}

// Generate a cryptographically secure random code verifier
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  // Convert to base64url format
  return base64URLEncode(array);
}

// Generate code challenge from code verifier
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);

  let digest;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    digest = await crypto.subtle.digest('SHA-256', data);
  } else {
    // Fallback for environments without crypto.subtle
    // This is not secure, but provides basic functionality
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash; // Convert to 32-bit integer
    }
    digest = new ArrayBuffer(8);
    const view = new DataView(digest);
    view.setInt32(0, hash, true);
  }

  return base64URLEncode(new Uint8Array(digest));
}

// Base64URL encode function
function base64URLEncode(array) {
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(array)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}