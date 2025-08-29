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
            <!DOCTYPE html>
            <html>
              <head>
                <title>Bexio Authentication Success</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    text-align: center; 
                    padding: 40px 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .container { 
                    background: rgba(255,255,255,0.95); 
                    color: #333;
                    padding: 40px; 
                    border-radius: 20px; 
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 400px;
                    width: 100%;
                  }
                  .success-icon { font-size: 48px; margin-bottom: 20px; }
                  h1 { margin: 0 0 15px 0; color: #2d3748; }
                  p { margin: 10px 0; color: #4a5568; }
                  .countdown { 
                    font-size: 18px; 
                    font-weight: bold; 
                    color: #38a169; 
                    margin: 20px 0;
                  }
                  .manual-close {
                    background: #e53e3e;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 16px;
                    cursor: pointer;
                    margin-top: 20px;
                  }
                  .manual-close:hover { background: #c53030; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="success-icon">✅</div>
                  <h1>Authentication Successful!</h1>
                  <p>You have been successfully authenticated with Bexio.</p>
                  <p>Logging you into the app...</p>
                  <div class="countdown" id="countdown">This window will close in 3 seconds</div>
                  <button class="manual-close" onclick="closeWindow()" id="manual-btn" style="display:none;">Close Window</button>
                </div>
                
                <script>
                  console.log('🚀 OAuth success page loaded');
                  console.log('🌐 URL:', window.location.href);
                  
                  try {
                    // OAuth payload
                    var payload = {
                      type: 'BEXIO_OAUTH_SUCCESS',
                      credentials: {
                        accessToken: '${(tokenData as any).access_token}',
                        refreshToken: '${(tokenData as any).refresh_token || ''}',
                        companyId: '${companyId}',
                        userEmail: '${userEmail}',
                        idToken: '${idToken}',
                        expiresIn: ${(tokenData as any).expires_in || 3600}
                      },
                      timestamp: Date.now()
                    };

                    console.log('📋 Storing OAuth payload in localStorage...');
                    
                    // Store in localStorage
                    localStorage.setItem('bexio_oauth_success', JSON.stringify(payload));
                    localStorage.setItem('bexio_oauth_ready', 'true');
                    
                    console.log('✅ OAuth data stored successfully');

                    // Countdown and auto-close
                    var countdown = 3;
                    var countdownEl = document.getElementById('countdown');
                    var manualBtn = document.getElementById('manual-btn');
                    
                    function updateCountdown() {
                      if (countdownEl) {
                        countdownEl.textContent = 'This window will close in ' + countdown + ' seconds';
                      }
                      console.log('⏰ Auto-close in ' + countdown + ' seconds');
                      countdown--;
                    }
                    
                    function closeWindow() {
                      console.log('🔒 Attempting to close window...');
                      try {
                        window.close();
                      } catch (e) {
                        console.error('❌ Cannot close window automatically:', e);
                        if (countdownEl) countdownEl.textContent = 'Please close this window manually';
                        if (manualBtn) manualBtn.style.display = 'block';
                      }
                    }
                    
                    // Start countdown
                    updateCountdown();
                    var timer = setInterval(function() {
                      if (countdown < 0) {
                        clearInterval(timer);
                        closeWindow();
                      } else {
                        updateCountdown();
                      }
                    }, 1000);
                    
                    // Show manual close button after 5 seconds if still open
                    setTimeout(function() {
                      if (manualBtn) manualBtn.style.display = 'block';
                    }, 5000);

                  } catch (error) {
                    console.error('❌ Error in OAuth success script:', error);
                    document.body.innerHTML = '<div class="container"><h1>❌ Error</h1><p>' + error.message + '</p><button class="manual-close" onclick="window.close()">Close Window</button></div>';
                  }
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