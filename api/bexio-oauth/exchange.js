const { BEXIO_CONFIG } = require('../_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}