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
      
      // Allow OIDC scopes and API scopes that are configured for the app
      const allowedScopes = [
        'openid', 'profile', 'email', 'offline_access', 'company_profile',
        'contact_show', 'contact_edit', 'project_show', 'project_edit', 'accounting', 'monitoring_show', 'monitoring_edit'
      ];
      const requested = (requestedScope || '')
        .split(/\s+/)
        .filter((s) => allowedScopes.includes(s));
      const finalScope = (requested.length ? requested : ['openid', 'profile', 'email', 'offline_access']).join(' ');

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

    // Handle OAuth callback - redirect to frontend
    if (path.endsWith('/callback') && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      console.log(`OAuth callback - code: ${code ? 'present' : 'missing'}, state: ${stateParam ? 'present' : 'missing'}, error: ${error}`);

      // Extract return URL from state
      let returnUrlFromState = '';
      try {
        const decoded = JSON.parse(atob(stateParam || ''));
        if (decoded && typeof decoded === 'object') {
          returnUrlFromState = decoded.ru || '';
        }
      } catch (_) {}

      // Determine redirect URL
      const frontendUrl = returnUrlFromState || `https://${url.hostname}`;
      const callbackUrl = `${frontendUrl}/oauth/callback`;
      
      // Build redirect URL with parameters
      const redirectParams = new URLSearchParams();
      if (code) redirectParams.set('code', code);
      if (stateParam) redirectParams.set('state', stateParam);
      if (error) redirectParams.set('error', error);
      
      const redirectUrl = `${callbackUrl}?${redirectParams.toString()}`;

      console.log(`Redirecting to frontend: ${redirectUrl}`);

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: redirectUrl,
          'Cache-Control': 'no-store'
        }
      });
    }

    // Handle token exchange (called from frontend)
    if (path.endsWith('/exchange') && req.method === 'POST') {
      const { code, state } = await req.json();
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Authorization code required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract code verifier from state
      let codeVerifierFromState: string | null = null;
      try {
        const decoded = JSON.parse(atob(state || ''));
        if (decoded && typeof decoded === 'object') {
          codeVerifierFromState = decoded.cv || null;
        }
      } catch (_) {}

      const clientId = Deno.env.get('BEXIO_CLIENT_ID');
      const clientSecret = Deno.env.get('BEXIO_CLIENT_SECRET');
      
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        
        // Extract user info from tokens
        let companyId = '';
        let userEmail = '';
        
        // Extract email from ID token
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
            if (!userEmail) {
              userEmail = payload.email || payload.login_id || '';
            }
          }
        } catch (jwtError) {
          console.warn('Failed to parse access token:', jwtError);
        }

        return new Response(JSON.stringify({
          accessToken: (tokenData as any).access_token,
          refreshToken: (tokenData as any).refresh_token || '',
          companyId,
          userEmail,
          idToken,
          expiresIn: (tokenData as any).expires_in || 3600,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Error during token exchange:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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