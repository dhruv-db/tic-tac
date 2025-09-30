// OAuth status polling endpoint for mobile apps
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for OAuth status polling'
    });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId parameter',
        message: 'sessionId is required in the URL path'
      });
    }

    console.log(`OAuth status check for session: ${sessionId}`);

    // In a production environment, you would:
    // 1. Check if the session exists in a database or cache
    // 2. Return the current OAuth status (pending, completed, failed)
    // 3. Return any relevant data (tokens, errors, etc.)

    // For now, return a basic response structure that the mobile app expects
    // The mobile app is polling this endpoint to check OAuth completion status

    res.status(200).json({
      sessionId,
      status: 'pending', // pending, completed, failed
      timestamp: new Date().toISOString(),
      // Add other fields that the mobile app might expect:
      // completed: false,
      // error: null,
      // credentials: null,
      // redirectUrl: null
    });

  } catch (error) {
    console.error('OAuth status check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check OAuth status',
      sessionId: req.query.sessionId || 'unknown'
    });
  }
}