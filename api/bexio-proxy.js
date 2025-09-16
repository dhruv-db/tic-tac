module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, apiKey, accessToken, companyId, method = 'GET', data: requestData, acceptLanguage } = req.body;

    if (!endpoint || !(apiKey || accessToken)) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    console.log(`🔄 Proxying request to Bexio API: ${endpoint}`);

    const token = accessToken || apiKey || '';
    console.log(`🔑 Using bearer token: ${token ? token.substring(0, 10) + '...' : 'none'}`);
    console.log(`📡 Request method: ${method}`);

    if ((method === 'POST' || method === 'PUT') && requestData) {
      console.log('📦 Request payload:', JSON.stringify(requestData, null, 2));
    }

    // Build correct Bexio base URL depending on version in the endpoint
    const bexioUrl = endpoint.startsWith('/3.0')
      ? `https://api.bexio.com${endpoint}`
      : endpoint.startsWith('/2.0')
        ? `https://api.bexio.com${endpoint}`
        : `https://api.bexio.com/2.0${endpoint}`;

    const requestOptions = {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Accept-Language': acceptLanguage || 'en',
        'Content-Type': 'application/json',
        'User-Agent': 'Bexio-Sync-Buddy/1.0'
      }
    };

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && requestData) {
      requestOptions.body = JSON.stringify(requestData);
    }

    console.log(`🌐 Making request to: ${bexioUrl}`);

    const response = await fetch(bexioUrl, requestOptions);

    if (!response.ok) {
      console.error(`❌ Bexio API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('📄 Error details:', errorText);
      return res.status(response.status).json({
        error: `Bexio API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${endpoint}, returned ${Array.isArray(data) ? data.length : 'single'} item(s)`);

    res.json(data);

  } catch (error) {
    console.error('❌ Error in bexio-proxy:', error);
    res.status(500).json({
      error: error.message
    });
  }
}