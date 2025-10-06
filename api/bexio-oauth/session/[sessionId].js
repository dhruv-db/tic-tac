// Mobile OAuth session management endpoint
// This endpoint stores session data for mobile OAuth flows

// In-memory storage for sessions (in production, use Redis or database)
const mobileSessions = new Map();

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({
      error: 'Missing session ID',
      message: 'sessionId parameter is required'
    });
  }

  try {
    if (req.method === 'POST') {
      // Create/update session
      const sessionData = req.body;

      if (!sessionData) {
        return res.status(400).json({
          error: 'Missing session data',
          message: 'Request body is required'
        });
      }

      // Add session ID to data
      sessionData.sessionId = sessionId;
      sessionData.updatedAt = Date.now();

      mobileSessions.set(sessionId, sessionData);

      console.log(`✅ [Mobile Session] Created session: ${sessionId} for platform: ${sessionData.platform}`);

      return res.status(200).json({
        status: 'created',
        sessionId,
        message: 'Mobile session created successfully'
      });

    } else if (req.method === 'GET') {
      // Retrieve session
      const session = mobileSessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `No session found for ID: ${sessionId}`
        });
      }

      return res.status(200).json({
        status: 'found',
        session: session
      });

    } else if (req.method === 'DELETE') {
      // Delete session
      const deleted = mobileSessions.delete(sessionId);

      if (deleted) {
        console.log(`🗑️ [Mobile Session] Deleted session: ${sessionId}`);
        return res.status(200).json({
          status: 'deleted',
          message: 'Session deleted successfully'
        });
      } else {
        return res.status(404).json({
          error: 'Session not found',
          message: `No session found for ID: ${sessionId}`
        });
      }

    } else {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Only GET, POST, and DELETE methods are allowed'
      });
    }

  } catch (error) {
    console.error('❌ [Mobile Session] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process session request'
    });
  }
}

// Export the sessions map for use in other endpoints
export { mobileSessions };