// Simple Express server to serve API endpoints for development
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes - simplified for development
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Bexio Sync Buddy API',
    version: '1.0.0'
  });
});

// OAuth status endpoint - simplified version
app.get('/api/bexio-oauth/status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;

  // For development, return a mock response that matches what the mobile app expects
  res.json({
    sessionId,
    status: 'pending',
    timestamp: new Date().toISOString(),
    completed: false,
    error: null,
    tokens: null,
    userEmail: null,
    companyId: null
  });
});

// OAuth auth endpoint - simplified version
app.post('/api/bexio-oauth/auth', (req, res) => {
  const { state } = req.body;

  if (!state) {
    return res.status(400).json({
      error: 'Missing state parameter',
      message: 'state is required'
    });
  }

  // Return mock OAuth URL for development
  res.json({
    authorizationUrl: `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth?client_id=test&redirect_uri=test&response_type=code&scope=openid&state=${state}`,
    codeVerifier: 'test_verifier',
    state,
    sessionId: state,
    timestamp: new Date().toISOString()
  });
});

// OAuth callback endpoint - simplified version
app.get('/api/bexio-oauth/callback', (req, res) => {
  res.json({
    status: 'OK',
    message: 'OAuth callback received',
    query: req.query
  });
});

// OAuth exchange endpoint - simplified version
app.post('/api/bexio-oauth/exchange', (req, res) => {
  res.json({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  });
});

// OAuth refresh endpoint - simplified version
app.post('/api/bexio-oauth/refresh', (req, res) => {
  res.json({
    accessToken: 'mock_access_token_refreshed',
    expiresIn: 3600,
    tokenType: 'Bearer'
  });
});

// Bexio proxy endpoint - simplified version
app.post('/api/bexio-proxy', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Mock proxy response',
    data: []
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 OAuth status endpoint: http://localhost:${PORT}/api/bexio-oauth/status/test`);
});