// Bexio API proxy endpoint
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      status: 'OK',
      message: 'CORS preflight successful'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, method = 'GET', body, accessToken, apiKey } = req.body;

    if (!endpoint || !accessToken) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'endpoint and accessToken are required'
      });
    }

    // Construct the full Bexio API URL
    const baseUrl = process.env.BEXIO_API_BASE_URL || 'https://api.bexio.com';
    const apiUrl = endpoint.startsWith('http')
      ? endpoint
      : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    console.log(`Proxying ${method} request to: ${apiUrl}`);

    // Prepare headers for Bexio API
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Remove Content-Type for GET requests or if no body
    if (method === 'GET' || !body) {
      delete headers['Content-Type'];
    }

    // Make request to Bexio API
    const response = await fetch(apiUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    // Handle response
    const responseText = await response.text();
    let responseData = {};

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.warn('Failed to parse response as JSON:', parseError);
      responseData = { rawResponse: responseText };
    }

    console.log(`Bexio API response status: ${response.status}`);

    // Return response with same status code as Bexio API
    res.status(response.status).json({
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bexio proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to proxy request to Bexio API',
      details: error.message
    });
  }
}