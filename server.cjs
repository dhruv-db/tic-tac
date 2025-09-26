require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { default: fetch } = require('node-fetch');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const helmet = require('helmet');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced session storage for serverless environments
class SessionStorage {
  constructor() {
    this.sessionDir = process.env.NODE_ENV === 'production'
      ? '/tmp/oauth-sessions'
      : './oauth-sessions';
    this.ensureSessionDirectory();
  }

  ensureSessionDirectory() {
    try {
      const fs = require('fs');
      const path = require('path');

      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
        console.log(`📁 Created session directory: ${this.sessionDir}`);
      }
    } catch (error) {
      console.error('❌ Failed to create session directory:', error);
    }
  }

  async store(sessionId, data) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);

      const sessionData = {
        ...data,
        sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
      console.log(`💾 Stored session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to store session ${sessionId}:`, error);
      throw error;
    }
  }

  async get(sessionId) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);

      const data = await fs.readFile(filePath, 'utf8');
      const session = JSON.parse(data);

      // Check if session is expired (10 minutes)
      const age = Date.now() - new Date(session.createdAt).getTime();
      if (age > 10 * 60 * 1000) {
        console.log(`⏰ Session ${sessionId} expired (${Math.round(age / 1000)}s old)`);
        await this.delete(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Failed to read session ${sessionId}:`, error);
      }
      return null;
    }
  }

  async delete(sessionId) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);

      await fs.unlink(filePath);
      console.log(`🗑️ Deleted session: ${sessionId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Failed to delete session ${sessionId}:`, error);
      }
    }
  }

  async cleanup() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const files = await fs.readdir(this.sessionDir);

      let cleaned = 0;
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.sessionDir, file);
          try {
            const data = await fs.readFile(filePath, 'utf8');
            const session = JSON.parse(data);
            const age = Date.now() - new Date(session.createdAt).getTime();

            if (age > 10 * 60 * 1000) { // 10 minutes
              await fs.unlink(filePath);
              cleaned++;
            }
          } catch (error) {
            // Delete corrupted files
            await fs.unlink(filePath);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  }
}

const sessionStorage = new SessionStorage();

// Structured logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bexio-oauth-proxy' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: process.env.NODE_ENV === 'production' ? '/tmp/error.log' : 'logs/error.log',
      level: 'error'
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: process.env.NODE_ENV === 'production' ? '/tmp/combined.log' : 'logs/combined.log'
    }),
  ],
});

// If we're not in production then log to the `console` with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

// Security middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for OAuth endpoints
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 OAuth requests per windowMs
  message: {
    error: 'Too many OAuth requests from this IP, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation schemas
const oauthStartSchema = Joi.object({
  platform: Joi.string().valid('web', 'mobile', 'ios', 'android').optional()
});

const oauthAuthSchema = Joi.object({
  state: Joi.string().optional(),
  scope: Joi.string().optional(),
  codeChallenge: Joi.string().optional(),
  codeChallengeMethod: Joi.string().valid('S256', 'plain').optional(),
  codeVerifier: Joi.string().optional(),
  returnUrl: Joi.string().uri().optional(),
  sessionId: Joi.string().optional(),
  platform: Joi.string().valid('web', 'mobile', 'ios', 'android').optional()
});

const tokenExchangeSchema = Joi.object({
  code: Joi.string().required(),
  state: Joi.string().optional(),
  codeVerifier: Joi.string().optional()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// Validation middleware
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }
    next();
  };
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.bexio.com", "https://auth.bexio.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://tic-tac-bt2y.vercel.app', 'bexiosyncbuddy://oauth/callback']
    : ['https://tic-tac-bt2y.vercel.app', 'bexiosyncbuddy://oauth/callback', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost:8081'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(requestLogger); // Request logging
app.use(limiter); // Apply general rate limiting

// Serve static files from dist directory (production build)
app.use(express.static('dist'));

// Also serve files from public directory for backwards compatibility
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

// Import BEXIO_CONFIG from utils to ensure consistency
const { BEXIO_CONFIG } = require('./api/_utils');
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;

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
app.post('/api/bexio-oauth/start', oauthLimiter, validateBody(oauthStartSchema), async (req, res) => {
  try {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Initialize session with enhanced storage
    await sessionStorage.store(sessionId, {
      status: 'pending',
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
    const session = await sessionStorage.get(sessionId);

    if (!session) {
      console.log(`❌ Session ${sessionId} not found in status check`);
      return res.status(404).json({
        status: 'error',
        error: 'Session not found or expired'
      });
    }

    console.log(`📊 Returning session status: ${session.status} for ${sessionId}`);

    res.json({
      status: session.status,
      data: session.data || null,
      platform: session.platform,
      createdAt: session.createdAt
    });

  } catch (error) {
    console.error('❌ Failed to check session status:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check session status',
      details: error.message
    });
  }
});

// OAuth initiation endpoint
app.post('/api/bexio-oauth/auth', oauthLimiter, validateBody(oauthAuthSchema), async (req, res) => {
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

// Refresh token endpoint
app.post('/api/bexio-oauth/refresh', oauthLimiter, validateBody(refreshTokenSchema), async (req, res) => {
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
});

// Token exchange endpoint
app.post('/api/bexio-oauth/exchange', oauthLimiter, validateBody(tokenExchangeSchema), async (req, res) => {
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
  console.log('📊 Request headers:', req.headers);
  console.log('📋 User-Agent:', req.get('User-Agent'));

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
      return res.redirect(`${SERVER_BASE_URL}/oauth-complete.html?error=${encodeURIComponent(error)}&t=${timestamp}`);
    }

    if (!code) {
      console.error('❌ No authorization code in callback');
      const timestamp = Date.now();
      return res.redirect(`${SERVER_BASE_URL}/oauth-complete.html?error=no_code&t=${timestamp}`);
    }

    // Extract session data from state
    let sessionId = null;
    let codeVerifier = null;
    let returnUrl = `${SERVER_BASE_URL}/oauth-complete.html`;
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

      // Set session to error if this is a session-based flow
      if (sessionId) {
        console.log(`❌ Setting session ${sessionId} to error due to token exchange failure`);
        await sessionStorage.store(sessionId, {
          status: 'error',
          platform: 'unknown',
          error: 'Token exchange failed',
          errorDetails: errorText
        });
      }

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
    if (sessionId) {
      console.log(`📱 Completing OAuth session: ${sessionId}`);

      // Update session with completed data
      await sessionStorage.store(sessionId, {
        status: 'completed',
        platform: platform || 'mobile',
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
      return res.redirect(`${SERVER_BASE_URL}/oauth-complete.html?session=${sessionId}&status=completed&t=${timestamp}`);
    } else {
      // Handle both web and mobile redirects
      const isMobile = platform === 'mobile' || platform === 'ios' || platform === 'android';
      console.log('📱 Platform detection:', { platform, isMobile, mobileRedirectUri: BEXIO_CONFIG.mobileRedirectUri });

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
        console.log('🔗 Mobile redirect URL:', mobileRedirectUrl);
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
        console.log('🔗 Web redirect URL:', redirectUrl);
        console.log('🔄 ===== OAUTH CALLBACK END (WEB REDIRECT) =====');
        return res.redirect(redirectUrl);
      }
    }

  } catch (error) {
    console.error('❌ OAuth callback processing failed:', error);
    const timestamp = Date.now();
    res.redirect(`${SERVER_BASE_URL}/oauth-complete.html?error=callback_failed&t=${timestamp}`);
  }
});

// Special handling for image.png requests
app.get('/image.png', (req, res) => {
  console.log('🖼️ Image.png requested:', {
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString()
  });
  // Let the static file middleware handle it
  res.sendFile('public/image.png', { root: __dirname });
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
app.post('/api/bexio-oauth/clear-sessions', async (req, res) => {
  try {
    const { clearAll } = req.body;

    if (clearAll) {
      // Clear all OAuth sessions using sessionStorage cleanup
      await sessionStorage.cleanup();

      console.log(`🧹 Cleaned up expired OAuth sessions`);

      res.json({
        success: true,
        message: `Cleaned up expired sessions`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        error: 'Invalid request. Use { "clearAll": true } to clean up expired sessions.'
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

// Health check endpoint with monitoring
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Bexio OAuth Proxy',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: {
      active: sessionStorage ? 'monitoring' : 'disabled'
    }
  };

  logger.info('Health check requested', { health });
  res.json(health);
});

// Metrics endpoint for monitoring
app.get('/api/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  };

  logger.info('Metrics requested', { metrics });
  res.json(metrics);
});

// SPA fallback: serve index.html for all non-API routes
app.use((req, res, next) => {
  // Skip API routes and static files
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }

  // Serve the main index.html for SPA routing
  res.sendFile('index.html', { root: 'dist' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// Start server
app.listen(PORT, 'localhost', () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    serverUrl: SERVER_BASE_URL,
    callbackUri: BEXIO_CONFIG.serverCallbackUri
  });

  console.log(`🚀 Bexio OAuth Proxy Server running on port ${PORT} (localhost only)`);
  console.log(`📊 Health check: ${SERVER_BASE_URL}/api/health`);
  console.log(`📈 Metrics: ${SERVER_BASE_URL}/api/metrics`);
  console.log(`🔐 OAuth endpoints:`);
  console.log(`   POST ${SERVER_BASE_URL}/api/bexio-oauth/auth`);
  console.log(`   GET  ${SERVER_BASE_URL}/api/bexio-oauth/callback`);
  console.log(`   POST ${SERVER_BASE_URL}/api/bexio-oauth/exchange`);
  console.log(`   POST ${SERVER_BASE_URL}/api/bexio-oauth/refresh`);
  console.log(`   POST ${SERVER_BASE_URL}/api/bexio-proxy`);
  console.log(`🌐 Server callback URI: ${BEXIO_CONFIG.serverCallbackUri}`);

  // Start periodic session cleanup (every 5 minutes)
  setInterval(async () => {
    try {
      const cleaned = await sessionStorage.cleanup();
      if (cleaned > 0) {
        logger.info('Session cleanup completed', { sessionsCleaned: cleaned });
      }
    } catch (error) {
      logger.error('Session cleanup failed', { error: error.message });
    }
  }, 5 * 60 * 1000);

  console.log(`🧹 Session cleanup scheduled every 5 minutes`);
});

module.exports = app;