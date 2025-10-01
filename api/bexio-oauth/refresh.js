// Token refresh endpoint for Bexio OAuth
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'refreshToken is required'
      });
    }

    const clientId = process.env.BEXIO_CLIENT_ID;
    const clientSecret = process.env.BEXIO_CLIENT_SECRET;
    const tokenUrl = process.env.BEXIO_TOKEN_URL || 'https://idp.bexio.com/token';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'BEXIO_CLIENT_ID or BEXIO_CLIENT_SECRET not configured'
      });
    }

    // Prepare token refresh request
    const refreshRequestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    });

    console.log('Refreshing access token...');

    // Make request to Bexio token endpoint
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: refreshRequestBody.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);

      return res.status(response.status).json({
        error: 'Token refresh failed',
        message: `Bexio responded with status ${response.status}`,
        details: errorText
      });
    }

    const tokenData = await response.json();
    console.log('Token refresh successful');

    // Calculate new expiration time
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Return refreshed token data
    res.status(200).json({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Bexio may or may not return a new refresh token
      expiresAt,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token'
    });
  }
}