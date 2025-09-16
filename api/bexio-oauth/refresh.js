const { BEXIO_CONFIG } = require('../_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔄 ===== REFRESH TOKEN REQUEST =====');
  console.log('⏰ Timestamp:', new Date().toISOString());

  try {
    const { refreshToken } = req.body;

    console.log('🔄 Refresh token request:', {
      refreshToken: refreshToken ? 'present' : 'missing',
      tokenLength: refreshToken?.length
    });

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Exchange refresh token for new access token
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: BEXIO_CONFIG.clientId,
      client_secret: BEXIO_CONFIG.clientSecret,
      refresh_token: refreshToken
    });

    console.log('📡 Refreshing tokens...');

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
      console.error('❌ Token refresh failed:', tokenResponse.status, errorText);
      return res.status(tokenResponse.status).json({
        error: 'Token refresh failed',
        details: errorText
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token refresh successful');

    // Return the refreshed token data
    const response = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
      expiresIn: tokenData.expires_in || 3600
    };

    console.log('📦 Returning refreshed tokens:', {
      hasAccessToken: !!response.accessToken,
      hasRefreshToken: !!response.refreshToken,
      expiresIn: response.expiresIn
    });

    console.log('🔄 ===== REFRESH TOKEN REQUEST END (SUCCESS) =====');
    res.json(response);

  } catch (error) {
    console.error('❌ Token refresh error:', error);
    console.log('🔄 ===== REFRESH TOKEN REQUEST END (ERROR) =====');
    res.status(500).json({
      error: 'Token refresh failed',
      details: error.message
    });
  }
}