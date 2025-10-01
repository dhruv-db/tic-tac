// OAuth initiation endpoint for Bexio
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { redirectUri, state } = req.body;

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

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Encode codeVerifier in state parameter for serverless compatibility
    // Format: sessionId:codeVerifier
    const encodedState = `${state}:${codeVerifier}`;

    // Construct Bexio authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show',
      state: encodedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authorizationUrl = `${baseAuthUrl}?${params.toString()}`;

    // Create OAuth session for status tracking
    const sessionId = state; // Use state as session ID for simplicity
    const sessionData = {
      status: 'pending',
      codeVerifier,
      state,
      createdAt: Date.now(),
      platform: req.body.platform || 'web'
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
      state,
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