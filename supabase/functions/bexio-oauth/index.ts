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

  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`OAuth request path: ${path}`);

  try {
    // Handle OAuth initiation
    if (path.endsWith('/auth') && req.method === 'POST') {
      const { state } = await req.json();
      
      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      if (!clientId) {
        console.error('BEXIO_CLIENT_ID not found in environment');
        return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const redirectUri = `${url.origin}/functions/v1/bexio-oauth/callback`;
      const scope = 'general';
      
      const authUrl = `https://office.bexio.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `response_type=code`;

      console.log(`Generated OAuth URL: ${authUrl}`);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle OAuth callback
    if (path.endsWith('/callback') && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      console.log(`OAuth callback - code: ${code ? 'present' : 'missing'}, state: ${state}, error: ${error}`);

      if (error) {
        console.error(`OAuth error: ${error}`);
        return new Response(`
          <html>
            <body>
              <h1>Authentication Failed</h1>
              <p>Error: ${error}</p>
              <script>window.close();</script>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      if (!code) {
        console.error('No authorization code received');
        return new Response(`
          <html>
            <body>
              <h1>Authentication Failed</h1>
              <p>No authorization code received</p>
              <script>window.close();</script>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      // Exchange code for access token
      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      const clientSecret = Deno.env.get('BEXIO_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        console.error('OAuth credentials not found in environment');
        return new Response(`
          <html>
            <body>
              <h1>Configuration Error</h1>
              <p>OAuth credentials not configured</p>
              <script>window.close();</script>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      const redirectUri = `${url.origin}/functions/v1/bexio-oauth/callback`;
      
      try {
        console.log('Exchanging code for access token...');
        const tokenResponse = await fetch('https://office.bexio.com/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('Successfully obtained access token');

        // Get user info from Bexio to obtain company ID
        const userResponse = await fetch('https://api.bexio.com/2.0/profile', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
          },
        });

        if (!userResponse.ok) {
          console.error(`Failed to get user profile: ${userResponse.status}`);
          throw new Error(`Failed to get user profile: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        console.log(`User authenticated: ${userData.email || 'unknown'}`);

        // Return success page with credentials that the parent window can access
        return new Response(`
          <html>
            <body>
              <h1>Authentication Successful!</h1>
              <p>You can now close this window.</p>
              <script>
                // Pass the credentials to the parent window
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'BEXIO_OAUTH_SUCCESS',
                    credentials: {
                      accessToken: '${tokenData.access_token}',
                      refreshToken: '${tokenData.refresh_token || ''}',
                      companyId: '${userData.company_id || ''}',
                      userEmail: '${userData.email || ''}',
                      expiresIn: ${tokenData.expires_in || 3600}
                    }
                  }, '*');
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });

      } catch (error) {
        console.error('Error during token exchange:', error);
        return new Response(`
          <html>
            <body>
              <h1>Authentication Failed</h1>
              <p>Error during token exchange: ${error.message}</p>
              <script>window.close();</script>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
    }

    // Handle token refresh
    if (path.endsWith('/refresh') && req.method === 'POST') {
      const { refreshToken } = await req.json();
      
      if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'Refresh token required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      const clientSecret = Deno.env.get('BEXIO_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        console.log('Refreshing access token...');
        const tokenResponse = await fetch('https://office.bexio.com/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`Token refresh failed: ${tokenResponse.status} ${errorText}`);
          throw new Error(`Token refresh failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('Successfully refreshed access token');

        return new Response(JSON.stringify({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken,
          expiresIn: tokenData.expires_in || 3600
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Error during token refresh:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bexio-oauth function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});