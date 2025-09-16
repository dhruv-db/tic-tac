const crypto = require('crypto');

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

// Bexio OAuth configuration
const BEXIO_CONFIG = {
  clientId: process.env.BEXIO_CLIENT_ID || 'your_client_id_here',
  clientSecret: process.env.BEXIO_CLIENT_SECRET || 'your_client_secret_here',
  // Support both web and mobile redirect URIs
  webRedirectUri: process.env.BEXIO_WEB_REDIRECT_URI || `https://your-app.vercel.app/oauth-complete.html`,
  mobileRedirectUri: process.env.BEXIO_MOBILE_REDIRECT_URI || 'bexiosyncbuddy://oauth/callback',
  authUrl: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth',
  tokenUrl: 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token',
  apiBaseUrl: 'https://api.bexio.com/api2',
  // Server callback URI for OAuth (should match what's registered with Bexio)
  serverCallbackUri: process.env.BEXIO_SERVER_CALLBACK_URI || `https://your-app.vercel.app/api/bexio-oauth/callback`
};

module.exports = { generatePKCE, BEXIO_CONFIG };