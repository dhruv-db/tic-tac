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
      const { state, scope: requestedScope, codeChallenge, codeChallengeMethod, codeVerifier } = await req.json();
      
      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      if (!clientId) {
        console.error('BEXIO_CLIENT_ID not found in environment');
        return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const redirectUri = `https://${url.hostname}/functions/v1/bexio-oauth/callback`;
      
      // Only allow OIDC scopes (API scopes are configured per app in Bexio)
      const oidcAllowed = ['openid', 'profile', 'email', 'offline_access'];
      const requested = (requestedScope || '')
        .split(/\s+/)
        .filter((s) => oidcAllowed.includes(s));
      const finalScope = (requested.length ? requested : oidcAllowed).join(' ');

      // Pack state with code_verifier for PKCE token exchange later
      let packedState = state;
      try {
        packedState = btoa(JSON.stringify({ s: state, cv: codeVerifier || null }));
      } catch (_) {}

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: finalScope,
        state: packedState,
      });

      // Add PKCE parameters if provided
      if (codeChallenge && codeChallengeMethod) {
        params.set('code_challenge', codeChallenge);
        params.set('code_challenge_method', codeChallengeMethod);
      }

      const authUrl = `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth?${params.toString()}`;
      console.log(`Generated OAuth URL (OIDC scopes): ${authUrl}`);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle OAuth callback
    if (path.endsWith('/callback') && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      let originalState = stateParam || '';
      let codeVerifierFromState: string | null = null;
      try {
        const decoded = JSON.parse(atob(stateParam || ''));
        if (decoded && typeof decoded === 'object') {
          originalState = decoded.s || originalState;
          codeVerifierFromState = decoded.cv || null;
        }
      } catch (_) {}
      const error = url.searchParams.get('error');

      console.log(`OAuth callback - code: ${code ? 'present' : 'missing'}, state: ${originalState ? 'present' : 'missing'}, error: ${error}`);

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
        
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: code,
        });

        // Add PKCE code_verifier if present
        if (codeVerifierFromState) {
          tokenParams.set('code_verifier', codeVerifierFromState);
        }

        const tokenResponse = await fetch('https://auth.bexio.com/realms/bexio/protocol/openid-connect/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams,
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

          // Minimal HTML to postMessage credentials back to opener and close
          const creds = {
            accessToken: (tokenData as any).access_token,
            refreshToken: (tokenData as any).refresh_token || '',
            companyId,
            userEmail,
            idToken,
            expiresIn: (tokenData as any).expires_in || 3600,
          };

          const mainAppUrl = `https://4bf4f80d-52ee-4c37-86a7-92c7a81427b7.sandbox.lovable.dev/?oauth_success=true&t=${Date.now()}`;

          return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Connecting…</title></head><body><script>(function(){try{var payload={type:'BEXIO_OAUTH_SUCCESS',credentials:${JSON.stringify(
            creds
          )},timestamp:Date.now()};if(window.opener){window.opener.postMessage(payload,'*');window.addEventListener('message',function(e){try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;if(d&&d.type==='BEXIO_OAUTH_ACK'){window.close();}}catch(_){}},false);setTimeout(function(){window.close();},3000);}else{localStorage.setItem('bexio_oauth_success',JSON.stringify(payload));localStorage.setItem('bexio_oauth_ready','true');location.href='${mainAppUrl}';}}catch(e){document.write('Authentication completed. You can close this window.');}})();</script></body></html>`, {
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