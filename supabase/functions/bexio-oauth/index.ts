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
      const { state, scope: requestedScope } = await req.json();
      
      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      if (!clientId) {
        console.error('BEXIO_CLIENT_ID not found in environment');
        return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const redirectUri = `https://${url.hostname}/functions/v1/bexio-oauth/callback`;
      // Default to basic OIDC scopes; extend in your Bexio app if needed
      const scope = requestedScope || 'openid offline_access';

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        state,
      });

      const authUrl = `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth?${params.toString()}`;
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

      const redirectUri = `https://${url.hostname}/functions/v1/bexio-oauth/callback`;
      
      try {
        console.log('Exchanging code for access token...');
        const tokenResponse = await fetch('https://auth.bexio.com/realms/bexio/protocol/openid-connect/token', {
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
        
        // Extract ID token
        const idToken = (tokenData as any).id_token || '';

        // Get user info from Bexio API to obtain company ID and email
        let companyId = '';
        let userEmail = '';
        
        try {
          // Try the company profile endpoint first
          const companyResponse = await fetch('https://api.bexio.com/2.0/company_profile', {
            headers: {
              'Authorization': `Bearer ${(tokenData as any).access_token}`,
              'Accept': 'application/json',
            },
          });

          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            console.log('Company profile data:', companyData);
            companyId = companyData.id?.toString() || '';
            userEmail = companyData.email || '';
          } else {
            console.warn(`Failed to get company profile: ${companyResponse.status}`);
            
            // Fallback: try to get user info from JWT token
            try {
              const accessToken = (tokenData as any).access_token;
              const tokenParts = accessToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                console.log('JWT payload:', payload);
                companyId = payload.company_id || '';
                userEmail = payload.email || payload.login_id || '';
              }
            } catch (jwtError) {
              console.warn('Failed to parse JWT token:', jwtError);
            }
          }
        } catch (profileError) {
          console.error('Error fetching profile data:', profileError);
        }

          return new Response(`
            <html>
              <body>
                <h1>Authentication Successful!</h1>
                <p>You can now close this window.</p>
                <script>
                  (function() {
                    var payload = {
                      type: 'BEXIO_OAUTH_SUCCESS',
                      credentials: {
                        accessToken: '${(tokenData as any).access_token}',
                        refreshToken: '${(tokenData as any).refresh_token || ''}',
                        companyId: '${companyId}',
                        userEmail: '${userEmail}',
                        idToken: '${idToken}',
                        expiresIn: ${(tokenData as any).expires_in || 3600}
                      }
                    };

                    // Store in localStorage as backup communication method
                    try {
                      localStorage.setItem('bexio_oauth_success', JSON.stringify(payload));
                      console.log('✅ Stored OAuth success in localStorage');
                    } catch (e) { 
                      console.warn('❌ localStorage failed:', e); 
                    }

                    var attempts = 0;
                    var maxAttempts = 25; // ~5 seconds at 200ms intervals

                    function send() {
                      try {
                        if (window.opener && !window.opener.closed) {
                          console.log('📨 Popup sending OAuth success to opener (attempt ' + (attempts + 1) + '):', payload);
                          // Try multiple target origins to ensure cross-origin communication works
                          try {
                            window.opener.postMessage(payload, '*');
                            console.log('✅ Sent with wildcard origin');
                          } catch (e1) {
                            console.warn('⚠️ Wildcard failed:', e1.message);
                            try {
                              // Try specific Lovable origin
                              window.opener.postMessage(payload, 'https://' + window.location.hostname.replace('opcjifbdwpyttaxqlqbf.supabase.co', '4bf4f80d-52ee-4c37-86a7-92c7a81427b7.sandbox.lovable.dev'));
                              console.log('✅ Sent with specific origin');
                            } catch (e2) {
                              console.warn('⚠️ Specific origin failed:', e2.message);
                            }
                          }
                        } else {
                          console.log('⚠️ No opener window available');
                        }
                      } catch (e) { 
                        console.warn('❌ postMessage failed:', e.message); 
                      }
                      
                      attempts++;
                      if (attempts >= maxAttempts) {
                        clearInterval(timer);
                        console.log('⏰ Stopping attempts after ' + maxAttempts + ' tries');
                        setTimeout(function(){ 
                          console.log('🔒 Auto-closing popup');
                          window.close(); 
                        }, 500);
                      }
                    }

                    // Send immediately and then keep sending
                    console.log('🚀 Starting OAuth communication from popup');
                    send();
                    var timer = setInterval(send, 200);

                    // If opener acknowledges, close sooner
                    window.addEventListener('message', function(event) {
                      try {
                        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                        if (data && data.type === 'BEXIO_OAUTH_ACK') {
                          console.log('✅ Received ACK from main app');
                          clearInterval(timer);
                          setTimeout(function(){ window.close(); }, 200);
                        }
                      } catch (e) { 
                        console.warn('⚠️ ACK handling failed:', e); 
                      }
                    });
                  })();
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
        const tokenResponse = await fetch('https://auth.bexio.com/realms/bexio/protocol/openid-connect/token', {
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