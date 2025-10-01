// OAuth status polling endpoint for mobile apps
// Simple in-memory session storage for OAuth status tracking
const oauthSessions = new Map();

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

    console.log(`OAuth status check for session: ${sessionId}`);

    const session = oauthSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'OAuth session not found or expired',
        sessionId,
        status: 'not_found'
      });
    }

    // Check if session has expired (5 minutes timeout)
    const now = Date.now();
    if (now - session.createdAt > 5 * 60 * 1000) {
      oauthSessions.delete(sessionId);
      return res.status(404).json({
        error: 'Session expired',
        message: 'OAuth session has expired',
        sessionId,
        status: 'expired'
      });
    }

    const response = {
      sessionId,
      status: session.status,
      timestamp: new Date().toISOString(),
      completed: session.status === 'completed',
      error: session.error || null,
      tokens: session.tokens || null,
      userEmail: session.userEmail || null,
      companyId: session.companyId || null
    };

    console.log(`OAuth status response for ${sessionId}:`, response);
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
    const { sessionId, status, tokens, userEmail, companyId, error } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        message: 'sessionId is required in request body'
      });
    }

    const sessionData = {
      status: status || 'pending',
      tokens,
      userEmail,
      companyId,
      error,
      updatedAt: Date.now(),
      createdAt: Date.now()
    };

    oauthSessions.set(sessionId, sessionData);
    console.log(`OAuth session ${sessionId} updated:`, sessionData);

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
    console.log(`OAuth session ${sessionId} deleted:`, deleted);

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