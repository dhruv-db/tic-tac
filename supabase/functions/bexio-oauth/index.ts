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
      const { state, scope: requestedScope, codeChallenge, codeChallengeMethod, codeVerifier, returnUrl } = await req.json();
      
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

      // Pack state with code_verifier and return URL for redirect
      let packedState = state;
      try {
        packedState = btoa(JSON.stringify({ s: state, cv: codeVerifier || null, ru: returnUrl || '' }));
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
      let returnUrlFromState: string = '';
      try {
        const decoded = JSON.parse(atob(stateParam || ''));
        if (decoded && typeof decoded === 'object') {
          originalState = decoded.s || originalState;
          codeVerifierFromState = decoded.cv || null;
          returnUrlFromState = decoded.ru || '';
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
        
        // Extract user info from tokens only (no blocking API calls)
        let companyId = '';
        let userEmail = '';
        
        // Extract email from ID token (most reliable)
        const idToken = (tokenData as any).id_token || '';
        if (idToken) {
          try {
            const idTokenParts = idToken.split('.');
            if (idTokenParts.length === 3) {
              const idPayload = JSON.parse(atob(idTokenParts[1]));
              userEmail = idPayload.email || '';
            }
          } catch (idTokenError) {
            console.warn('Failed to parse ID token:', idTokenError);
          }
        }
        
        // Extract company ID from access token
        try {
          const accessToken = (tokenData as any).access_token;
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            companyId = payload.company_id || payload.user_id?.toString() || '';
            // Use access token email as fallback
            if (!userEmail) {
              userEmail = payload.email || payload.login_id || '';
            }
          }
        } catch (jwtError) {
          console.warn('Failed to parse access token:', jwtError);
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

          const payload = {
            type: 'BEXIO_OAUTH_SUCCESS',
            credentials: creds,
            timestamp: Date.now()
          };

          // Prefer redirecting to app-hosted completion page to avoid HTML rendering issues
          try {
            const payloadJson = JSON.stringify(payload);
            const encoded = encodeURIComponent(btoa(payloadJson));
            const baseUrl = (returnUrlFromState && typeof returnUrlFromState === 'string') ? returnUrlFromState : '';
            if (baseUrl) {
              const normalized = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
              const redirectUrl = `${normalized}oauth-complete.html#p=${encoded}`;
              return new Response(null, {
                status: 302,
                headers: {
                  ...corsHeaders,
                  Location: redirectUrl,
                  'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
              });
            }
          } catch (e) {
            console.warn('Failed to build redirect URL, falling back to inline HTML:', e);
          }

          // Fallback: inline HTML that posts message and attempts to close
          const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authentication Successful</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .success { color: #222; font-size: 22px; margin-bottom: 14px; }
    .loading { color: #555; }
  </style>
</head>
<body>
  <div class="success">Authentication Successful</div>
  <div class="loading">Connecting to your application...</div>
  
  <script>
    (function() {
      try {
        var payload = ${JSON.stringify(payload)};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
          setTimeout(function(){ window.close(); }, 800);
        } else {
          setTimeout(function(){ window.close(); }, 1500);
        }
      } catch(e) {
        document.body.innerHTML = '<div class="success">Authentication completed</div><p>Please close this window manually.</p>';
      }
    })();
  </script>
</body>
</html>`;

          const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
          return new Response(blob, {
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Content-Disposition': 'inline'
            },
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