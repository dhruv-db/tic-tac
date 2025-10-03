// OAuth status polling endpoint for mobile apps
// Production-ready session storage with cleanup and monitoring
const oauthSessions = new Map();

// Session cleanup configuration
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSIONS = 1000; // Prevent memory leaks

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of oauthSessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      oauthSessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired OAuth sessions`);
  }

  // Emergency cleanup if too many sessions
  if (oauthSessions.size > MAX_SESSIONS) {
    console.warn(`🚨 Emergency cleanup: ${oauthSessions.size} sessions exceed limit of ${MAX_SESSIONS}`);
    const sessionsToDelete = Array.from(oauthSessions.entries())
      .sort(([,a], [,b]) => a.createdAt - b.createdAt)
      .slice(0, oauthSessions.size - MAX_SESSIONS + 100); // Keep some buffer

    sessionsToDelete.forEach(([sessionId]) => {
      oauthSessions.delete(sessionId);
    });

    console.log(`🧹 Emergency cleanup removed ${sessionsToDelete.length} oldest sessions`);
  }
}, CLEANUP_INTERVAL);

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  if (req.method === 'GET') {
    return handleGetStatus(req, res);
  }

  if (req.method === 'POST') {
    return handleUpdateStatus(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDeleteSession(req, res);
  }

  return res.status(405).json({
    error: 'Method not allowed',
    message: 'Only GET, POST, DELETE requests are allowed for OAuth status polling'
  });
}

function handleGetStatus(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        message: 'sessionId is required in the URL path'
      });
    }

    // Validate sessionId format
    if (typeof sessionId !== 'string' || sessionId.length < 10 || sessionId.length > 100) {
      return res.status(400).json({
        error: 'Invalid sessionId format',
        message: 'sessionId must be a string between 10 and 100 characters'
      });
    }

    console.log(`🔄 [API] OAuth status check for session: ${sessionId} at ${new Date().toISOString()}`);
    console.log(`🔄 [API] Total active sessions: ${oauthSessions.size}`);

    const session = oauthSessions.get(sessionId);

    if (!session) {
      console.log(`❌ [API] Session ${sessionId} not found`);
      return res.status(404).json({
        error: 'Session not found',
        message: 'OAuth session not found or expired',
        sessionId,
        status: 'not_found'
      });
    }

    // Update last accessed time and increment access count
    const now = Date.now();
    session.lastAccessed = now;
    session.accessCount = (session.accessCount || 0) + 1;

    // Check if session has expired
    if (now - session.createdAt > SESSION_TIMEOUT) {
      oauthSessions.delete(sessionId);
      console.log(`⏰ [API] Session ${sessionId} expired and removed`);
      return res.status(404).json({
        error: 'Session expired',
        message: 'OAuth session has expired',
        sessionId,
        status: 'expired'
      });
    }

    // Rate limiting: prevent excessive polling
    if (session.accessCount > 200) {
      console.warn(`🚨 Session ${sessionId} exceeded polling limit (${session.accessCount} requests)`);
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Session polling limit exceeded',
        sessionId,
        status: 'rate_limited'
      });
    }

    const response = {
      sessionId,
      status: session.status,
      timestamp: new Date().toISOString(),
      completed: session.status === 'completed',
      error: session.error || null,
      tokens: session.status === 'completed' ? session.tokens : null, // Only return tokens when completed
      userEmail: session.status === 'completed' ? session.userEmail : null,
      companyId: session.status === 'completed' ? session.companyId : null,
      // Include metadata for debugging (only in development)
      ...(process.env.NODE_ENV !== 'production' && {
        accessCount: session.accessCount,
        createdAt: new Date(session.createdAt).toISOString(),
        lastAccessed: new Date(session.lastAccessed).toISOString()
      })
    };

    console.log(`✅ OAuth status response for ${sessionId}: status=${response.status}, completed=${response.completed}`);
    res.status(200).json(response);

  } catch (error) {
    console.error('OAuth status check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check OAuth status',
      sessionId: req.query.sessionId || 'unknown'
    });
  }
}

function handleUpdateStatus(req, res) {
  try {
    const { sessionId } = req.query;
    const { status, tokens, userEmail, companyId, error, codeVerifier, redirectUri, created } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        message: 'sessionId is required in the URL path'
      });
    }

    // Validate sessionId format (should be a reasonable length string)
    if (typeof sessionId !== 'string' || sessionId.length < 10 || sessionId.length > 100) {
      return res.status(400).json({
        error: 'Invalid sessionId format',
        message: 'sessionId must be a string between 10 and 100 characters'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'completed', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get existing session or create new one
    const existingSession = oauthSessions.get(sessionId);
    const now = Date.now();

    const sessionData = {
      status: status || 'pending',
      tokens: tokens || existingSession?.tokens,
      userEmail: userEmail || existingSession?.userEmail,
      companyId: companyId || existingSession?.companyId,
      error: error || existingSession?.error,
      codeVerifier: codeVerifier || existingSession?.codeVerifier,
      redirectUri: redirectUri || existingSession?.redirectUri,
      created: created || existingSession?.created || new Date().toISOString(),
      updatedAt: now,
      createdAt: existingSession?.createdAt || (created ? new Date(created).getTime() : now),
      lastAccessed: now,
      accessCount: (existingSession?.accessCount || 0) + 1
    };

    // Security: Limit session updates to prevent abuse
    if (sessionData.accessCount > 100) {
      console.warn(`🚨 Session ${sessionId} has been accessed ${sessionData.accessCount} times, possible abuse`);
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Session has exceeded maximum update limit'
      });
    }

    oauthSessions.set(sessionId, sessionData);
    console.log(`📝 [API] OAuth session ${sessionId} updated to status: ${sessionData.status} at ${new Date().toISOString()}`);
    console.log(`📝 [API] Total active sessions after update: ${oauthSessions.size}`);

    res.status(200).json({
      success: true,
      sessionId,
      status: sessionData.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OAuth status update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update OAuth status'
    });
  }
}

function handleDeleteSession(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        message: 'sessionId is required in the URL path'
      });
    }

    const deleted = oauthSessions.delete(sessionId);
    console.log(`🗑️ [API] OAuth session ${sessionId} deleted: ${deleted} at ${new Date().toISOString()}`);
    console.log(`🗑️ [API] Total active sessions after deletion: ${oauthSessions.size}`);

    res.status(200).json({
      success: true,
      deleted: !!deleted,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OAuth session delete error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete OAuth session'
    });
  }
}

// Export for cleanup (can be called from other modules if needed)
export { oauthSessions };