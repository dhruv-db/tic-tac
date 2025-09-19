import { BEXIO_CONFIG } from '../_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { platform } = req.body;

    console.log('🚀 Starting OAuth session for platform:', platform);

    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    console.log('📝 Created OAuth session:', sessionId);

    // Store session data (in a real app, you'd use Redis/database)
    // For now, we'll use a simple in-memory store
    if (!global.oauthSessions) {
      global.oauthSessions = new Map();
    }

    global.oauthSessions.set(sessionId, {
      status: 'pending',
      platform: platform || 'web',
      createdAt: new Date().toISOString(),
      data: null
    });

    console.log('✅ OAuth session stored');

    res.json({
      sessionId,
      message: 'OAuth session started successfully'
    });

  } catch (error) {
    console.error('❌ Failed to start OAuth session:', error);
    res.status(500).json({
      error: 'Failed to start OAuth session',
      details: error.message
    });
  }
}