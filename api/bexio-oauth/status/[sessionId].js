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

    // Get session data from file storage
    const fs = require('fs');
    const path = require('path');
    const sessionDir = '/tmp/oauth-sessions';
    const sessionFile = path.join(sessionDir, `${sessionId}.json`);

    let session = null;
    try {
      if (fs.existsSync(sessionFile)) {
        const sessionContent = fs.readFileSync(sessionFile, 'utf8');
        session = JSON.parse(sessionContent);
        console.log('📄 Session data loaded from file:', {
          sessionId,
          file: sessionFile,
          status: session.status,
          platform: session.platform
        });
      } else {
        console.log('❌ Session file not found:', sessionFile);
        // Try to list available session files for debugging
        try {
          const sessionDir = '/tmp/oauth-sessions';
          if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            console.log('📊 Available session files:', files);
          }
        } catch (listError) {
          console.warn('⚠️ Could not list session files:', listError.message);
        }
      }
    } catch (fileError) {
      console.error('❌ Error reading session file:', fileError);
    }

    if (!session) {
      console.log('❌ Session not found:', sessionId);
      console.log('📊 Available sessions:', Array.from(global.oauthSessions.keys()));
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
    console.log('🔍 ===== OAUTH STATUS ENDPOINT END (SUCCESS) =====');

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