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

    // For serverless compatibility, use a simple approach
    // In a production app, you'd use Redis, database, or Vercel KV
    console.log('🔍 Using simplified session lookup for serverless compatibility');

    // For now, return a mock response to test the flow
    // In production, implement proper persistent storage
    const session = {
      status: 'pending',
      platform: 'mobile',
      createdAt: new Date().toISOString(),
      data: null
    };

    console.log('📄 Mock session data:', {
      sessionId,
      status: session.status,
      platform: session.platform
    });

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