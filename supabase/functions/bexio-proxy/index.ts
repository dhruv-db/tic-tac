import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, apiKey, accessToken, companyId, method = 'GET', data: requestData, acceptLanguage } = await req.json();
    
    if (!endpoint || !(apiKey || accessToken)) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Proxying request to Bexio API: ${endpoint}`);
    const token = (accessToken || apiKey || '');
    console.log(`Using bearer token: ${token ? token.substring(0, 10) + '...' : 'none'}`);
    console.log(`Request method: ${method}`);
    if ((method === 'POST' || method === 'PUT') && requestData) {
      console.log('Request payload:', JSON.stringify(requestData, null, 2));
    }

    // Build correct Bexio base URL depending on version in the endpoint
    const bexioUrl = endpoint.startsWith('/3.0')
      ? `https://api.bexio.com${endpoint}`
      : (endpoint.startsWith('/2.0')
          ? `https://api.bexio.com${endpoint}`
          : `https://api.bexio.com/2.0${endpoint}`);
    const requestOptions: RequestInit = {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Accept-Language': acceptLanguage || 'en',
        'Content-Type': 'application/json',
        'User-Agent': 'Lovable-Bexio-Proxy/1.0',
      },
    };

    if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && requestData) {
      requestOptions.body = JSON.stringify(requestData);
    } else if (method === 'DELETE') {
      // DELETE requests typically don't need a body, but we support it for flexibility
    }
    
    const response = await fetch(bexioUrl, requestOptions);

    if (!response.ok) {
      console.error(`Bexio API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      
      return new Response(JSON.stringify({ 
        error: `Bexio API error: ${response.status}`,
        details: errorText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log(`Successfully fetched ${endpoint}, returned ${Array.isArray(data) ? data.length : 'single'} item(s)`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bexio-proxy function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});