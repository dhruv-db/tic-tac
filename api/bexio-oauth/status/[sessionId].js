export default async function handler(req, res) {
  console.log('🔍 ===== OAUTH STATUS ENDPOINT START =====');
  console.log('🔍 Method:', req.method);
  console.log('🔍 User-Agent:', req.headers['user-agent']);
  console.log('🔍 Timestamp:', new Date().toISOString());

  const { sessionId } = req.query;
  console.log('🔍 Session ID from query:', sessionId);

  if (!sessionId) {
    console.log('❌ No session ID provided');
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    console.log('🔍 Checking OAuth session status for:', sessionId);

    // Read session data from file storage (same as used by start and callback endpoints)
    const fs = await import('fs');
    const path = await import('path');

    const sessionDir = '/tmp/oauth-sessions';
    const sessionFile = path.join(sessionDir, `${sessionId}.json`);

    console.log('🔍 Looking for session file:', sessionFile);

    let session = null;

    try {
      // Check if session file exists
      if (fs.existsSync(sessionFile)) {
        const sessionData = fs.readFileSync(sessionFile, 'utf8');
        session = JSON.parse(sessionData);
        console.log('✅ Session file found and parsed');

        // Check if session has expired (older than 10 minutes)
        const sessionAge = Date.now() - new Date(session.createdAt).getTime();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        if (sessionAge > maxAge) {
          console.log('⏰ Session expired, cleaning up:', sessionId);
          try {
            fs.unlinkSync(sessionFile);
            console.log('🧹 Cleaned up expired session file:', sessionFile);
          } catch (cleanupError) {
            console.warn('⚠️ Failed to clean up expired session file:', cleanupError.message);
          }
          session = null; // Treat as not found
        }
      } else {
        console.log('❌ Session file not found:', sessionFile);
      }
    } catch (fileError) {
      console.error('❌ Error reading session file:', fileError);
      // Continue with null session - will return 404 below
    }

    if (!session) {
      console.log('❌ Session not found:', sessionId);
      console.log('🔍 ===== OAUTH STATUS ENDPOINT END (SESSION NOT FOUND) =====');
      return res.status(404).json({
        status: 'error',
        error: 'Session not found or expired'
      });
    }

    console.log('📊 Session status:', session.status);
    console.log('📊 Session data present:', !!session.data);
    console.log('📊 Session platform:', session.platform);
    console.log('📊 Session created:', session.createdAt);

    // Log token data presence without exposing sensitive info
    if (session.data) {
      console.log('🔑 Session contains token data:', {
        hasAccessToken: !!session.data.accessToken,
        hasRefreshToken: !!session.data.refreshToken,
        companyId: session.data.companyId,
        userEmail: session.data.userEmail ? 'present' : 'missing'
      });
    }

    console.log('🔍 ===== OAUTH STATUS ENDPOINT END (SUCCESS) =====');

    // Clean up completed sessions to prevent storage buildup
    if (session.status === 'completed') {
      try {
        fs.unlinkSync(sessionFile);
        console.log('🧹 Cleaned up completed session file:', sessionFile);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up session file:', cleanupError.message);
        // Don't fail the request if cleanup fails
      }
    }

    res.json({
      status: session.status,
      data: session.data,
      platform: session.platform,
      createdAt: session.createdAt
    });

  } catch (error) {
    console.error('❌ ===== OAUTH STATUS ENDPOINT END (ERROR) =====');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    res.status(500).json({
      status: 'error',
      error: 'Failed to check session status',
      details: error.message
    });
  }
}