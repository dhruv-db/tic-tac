export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Bexio Sync Buddy API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}