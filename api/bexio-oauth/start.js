import { BEXIO_CONFIG } from '../_utils.js';

export default async function handler(req, res) {
  console.log('🚀 ===== OAUTH START ENDPOINT START =====');
  console.log('🚀 Method:', req.method);
  console.log('🚀 User-Agent:', req.headers['user-agent']);
  console.log('🚀 Timestamp:', new Date().toISOString());

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { platform } = req.body;
    console.log('📱 Platform from request:', platform);
    console.log('📦 Full request body:', req.body);

    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    console.log('📝 Created OAuth session:', sessionId);

    // Store session data using file-based storage for serverless compatibility
    const fs = require('fs');
    const path = require('path');

    const sessionData = {
      status: 'pending',
      platform: platform || 'web',
      createdAt: new Date().toISOString(),
      data: null
    };

    // Use /tmp directory for serverless file storage
    const sessionDir = '/tmp/oauth-sessions';
    const sessionFile = path.join(sessionDir, `${sessionId}.json`);

    try {
      // Ensure directory exists
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
        console.log('📁 Created OAuth sessions directory:', sessionDir);
      }

      // Write session data to file
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData));
      console.log('✅ OAuth session stored to file:', {
        sessionId,
        file: sessionFile,
        status: sessionData.status,
        platform: sessionData.platform
      });
    } catch (fileError) {
      console.error('❌ Failed to write session file:', fileError);
      throw new Error('Failed to store OAuth session');
    }
    console.log('🚀 ===== OAUTH START ENDPOINT END (SUCCESS) =====');

    res.json({
      sessionId,
      message: 'OAuth session started successfully'
    });

  } catch (error) {
    console.error('❌ ===== OAUTH START ENDPOINT END (ERROR) =====');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    res.status(500).json({
      error: 'Failed to start OAuth session',
      details: error.message
    });
  }
}