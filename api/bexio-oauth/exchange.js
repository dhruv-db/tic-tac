// Token exchange endpoint for Bexio OAuth
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, codeVerifier, redirectUri } = req.body;

    console.log('🔍 [DEBUG] Exchange request received:', {
      hasCode: !!code,
      codeLength: code?.length,
      hasCodeVerifier: !!codeVerifier,
      codeVerifierLength: codeVerifier?.length,
      codeVerifierValue: codeVerifier,
      hasRedirectUri: !!redirectUri
    });

    if (!code || !codeVerifier || !redirectUri) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'code, codeVerifier, and redirectUri are required'
      });
    }

    const clientId = process.env.BEXIO_CLIENT_ID;
    const clientSecret = process.env.BEXIO_CLIENT_SECRET;
    const tokenUrl = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token';
    console.log('🔗 Using Bexio token URL:', tokenUrl);

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'BEXIO_CLIENT_ID or BEXIO_CLIENT_SECRET not configured'
      });
    }

    // Prepare token exchange request
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    console.log('Exchanging code for tokens...');

    // Make request to Bexio token endpoint
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenRequestBody.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);

      return res.status(response.status).json({
        error: 'Token exchange failed',
        message: `Bexio responded with status ${response.status}`,
        details: errorText
      });
    }

    const tokenData = await response.json();
    console.log('Token exchange successful');

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

    const decoded = decodeJwt(tokenData.access_token);
    const companyId = decoded?.company_id || decoded?.companyId || null;
    console.log('🔍 Extracted company ID from token:', companyId);

    // Calculate expiration time
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Return token data in the format expected by the frontend
    res.status(200).json({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      companyId,
      expiresAt,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to exchange code for tokens'
    });
  }
}