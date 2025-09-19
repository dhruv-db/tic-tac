export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    console.log('🔍 Checking OAuth session status for:', sessionId);

    // Get session data (in a real app, you'd use Redis/database)
    if (!global.oauthSessions) {
      global.oauthSessions = new Map();
    }

    const session = global.oauthSessions.get(sessionId);

    if (!session) {
      console.log('❌ Session not found:', sessionId);
      return res.status(404).json({
        status: 'error',
        error: 'Session not found or expired'
      });
    }

    console.log('📊 Session status:', session.status);

    res.json({
      status: session.status,
      data: session.data,
      platform: session.platform,
      createdAt: session.createdAt
    });

  } catch (error) {
    console.error('❌ Failed to check OAuth session status:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check session status',
      details: error.message
    });
  }
}