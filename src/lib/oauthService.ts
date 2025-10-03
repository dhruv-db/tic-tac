import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { BexioCredentials } from '@/context/OAuthContext';
import { getConfig, logger } from '@/lib/secureStorage';
import { authErrorHandler, AuthErrorType, RecoveryAction } from '@/lib/authErrorHandler';

// OAuth configuration interface
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope: string;
}

// Platform detection and configuration
export class OAuthPlatform {
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  static isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  static isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  static isWeb(): boolean {
    return !this.isNative();
  }

  // Get the redirect URI for the app (where users are redirected after auth)
  static getRedirectUri(): string {
    if (this.isNative()) {
      // For mobile apps, use custom scheme
      return import.meta.env.VITE_BEXIO_MOBILE_REDIRECT_URI ||
              'bexio-sync-buddy://oauth-complete/';
    } else {
      // For web, use the HTML page
      return import.meta.env.VITE_BEXIO_WEB_REDIRECT_URI ||
              `${window.location.origin}/oauth-complete.html`;
    }
  }

  // Get the server callback URI (where Bexio sends the auth code)
  static getServerCallbackUri(): string {
    if (this.isNative()) {
      // For mobile, Bexio redirects to our server first
      return import.meta.env.VITE_BEXIO_SERVER_CALLBACK_URI ||
              `${getConfig.serverUrl()}/api/bexio-oauth/mobile-callback`;
    } else {
      // For web, Bexio can redirect directly to our app
      return import.meta.env.VITE_BEXIO_WEB_REDIRECT_URI ||
              `${window.location.origin}/oauth-complete.html`;
    }
  }

  // Get the complete redirect URI configuration
  static getRedirectConfig(): {
    appRedirectUri: string;
    serverCallbackUri: string;
    platform: string;
    isNative: boolean;
  } {
    return {
      appRedirectUri: this.getRedirectUri(),
      serverCallbackUri: this.getServerCallbackUri(),
      platform: Capacitor.getPlatform(),
      isNative: this.isNative()
    };
  }

  // Validate redirect URIs are properly configured
  static validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.getRedirectConfig();

    if (!config.appRedirectUri) {
      errors.push('App redirect URI is not configured');
    }

    if (!config.serverCallbackUri) {
      errors.push('Server callback URI is not configured');
    }

    // Platform-specific validation
    if (config.isNative) {
      if (!config.appRedirectUri.startsWith('bexio-sync-buddy://')) {
        errors.push('Mobile redirect URI must use custom scheme bexio-sync-buddy://');
      }
      if (!config.serverCallbackUri.includes('/api/bexio-oauth/mobile-callback')) {
        errors.push('Mobile server callback URI must point to mobile-callback endpoint');
      }
    } else {
      if (!config.appRedirectUri.includes('/oauth-complete.html')) {
        errors.push('Web redirect URI must point to oauth-complete.html');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// PKCE utilities
export class PKCE {
  static async generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    return this.base64URLEncode(array);
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const array = new Uint8Array(digest);
      return this.base64URLEncode(array);
    } else {
      // Fallback: return verifier as-is (less secure but functional)
      console.warn('Web Crypto API not available, using plain verifier as challenge');
      return verifier;
    }
  }

  static base64URLEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// Unified OAuth service
export class UnifiedOAuthService {
  private static instance: UnifiedOAuthService;
  private config: OAuthConfig;
  private currentSessionId: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Validate platform configuration first
    const platformValidation = OAuthPlatform.validateConfiguration();
    if (!platformValidation.isValid) {
      console.error('❌ OAuth platform configuration errors:', platformValidation.errors);
      throw new Error(`OAuth platform configuration invalid: ${platformValidation.errors.join(', ')}`);
    }

    console.log('✅ OAuth platform configuration validated:', OAuthPlatform.getRedirectConfig());

    this.config = {
      clientId: import.meta.env.VITE_BEXIO_CLIENT_ID,
      clientSecret: import.meta.env.VITE_BEXIO_CLIENT_SECRET,
      authUrl: import.meta.env.VITE_BEXIO_OAUTH_AUTH_URL ||
                'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth',
      tokenUrl: import.meta.env.VITE_BEXIO_OAUTH_TOKEN_URL ||
                 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token',
      redirectUri: OAuthPlatform.getRedirectUri(),
      scope: 'openid profile email offline_access contact_show contact_edit monitoring_show monitoring_edit project_show'
    };

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('OAuth credentials not configured - missing VITE_BEXIO_CLIENT_ID or VITE_BEXIO_CLIENT_SECRET');
    }

    console.log('✅ OAuth service initialized with config:', {
      hasClientId: !!this.config.clientId,
      hasClientSecret: !!this.config.clientSecret,
      authUrl: this.config.authUrl,
      tokenUrl: this.config.tokenUrl,
      redirectUri: this.config.redirectUri,
      scope: this.config.scope
    });
  }

  static getInstance(): UnifiedOAuthService {
    if (!UnifiedOAuthService.instance) {
      UnifiedOAuthService.instance = new UnifiedOAuthService();
    }
    return UnifiedOAuthService.instance;
  }

  // Main OAuth initiation method
  async initiateOAuth(): Promise<void> {
    const endTimer = logger.startTimer('oauth_initiation', {
      component: 'OAuthService',
      platform: Capacitor.getPlatform(),
      isNative: OAuthPlatform.isNative()
    });

    logger.info('Initiating OAuth flow', {
      component: 'OAuthService',
      platform: Capacitor.getPlatform(),
      isNative: OAuthPlatform.isNative()
    });

    try {
      // Generate PKCE parameters
      const codeVerifier = await PKCE.generateCodeVerifier();
      const codeChallenge = await PKCE.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      // Store PKCE data
      this.storePKCEData(codeVerifier, state);

      // Create OAuth URL
      const authUrl = this.buildAuthUrl(codeChallenge, state);
      logger.debug('Generated OAuth URL', {
        component: 'OAuthService',
        platform: OAuthPlatform.isNative() ? 'mobile' : 'web',
        urlLength: authUrl.length
      });

      if (OAuthPlatform.isNative()) {
        await this.handleMobileOAuth(authUrl, state);
      } else {
        await this.handleWebOAuth(authUrl);
      }

      endTimer();
    } catch (error) {
      logger.error('OAuth initiation failed', {
        component: 'OAuthService',
        error: error.message,
        stack: error.stack
      });
      this.cleanup();
      throw error;
    }
  }

  // Handle mobile OAuth flow
  private async handleMobileOAuth(authUrl: string, state: string): Promise<void> {
    console.log('📱 [OAuthService] Handling mobile OAuth flow');

    // Create server session for mobile
    await this.createServerSession(state);

    // Open browser
    await Browser.open({
      url: authUrl,
      windowName: '_blank',
      presentationStyle: 'fullscreen'
    });

    // Start polling for completion
    this.startPolling(state);
  }

  // Handle web OAuth flow
  private async handleWebOAuth(authUrl: string): Promise<void> {
    console.log('🌐 [OAuthService] Handling web OAuth flow');

    const width = 520, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;

    const popup = window.open(authUrl, 'bexio_oauth', features);
    if (!popup) {
      throw new Error('Popup blocked - please allow popups for this site');
    }

    console.log('✅ Web popup opened successfully');
  }

  // Process OAuth callback (used by both web and mobile)
  async processCallback(code: string, state: string): Promise<BexioCredentials> {
    console.log('🔄 [OAuthService] Processing OAuth callback');

    // Verify state
    const storedState = localStorage.getItem('bexio_oauth_state');
    if (state !== storedState) {
      throw new Error('State parameter mismatch - possible CSRF attack');
    }

    // Get stored PKCE verifier
    const codeVerifier = localStorage.getItem('bexio_oauth_code_verifier');
    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found');
    }

    // Exchange code for tokens
    const tokenData = await this.exchangeCodeForTokens(code, codeVerifier);

    // Extract user info and company ID
    const credentials = await this.extractCredentialsFromToken(tokenData);

    // Dispatch completion event
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('oauthCompleted', {
        detail: { credentials }
      }));
    }

    // Cleanup
    this.cleanup();

    return credentials;
  }

  // Handle OAuth callback from components (convenience method)
  async handleCallback(code: string, state: string | null): Promise<void> {
    console.log('🔄 [OAuthService] Handling OAuth callback from component');

    if (!code) {
      throw new Error('No authorization code received');
    }

    if (!state) {
      throw new Error('No state parameter received');
    }

    await this.processCallback(code, state);
  }

  // Exchange authorization code for tokens
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<any> {
    console.log('🔄 [OAuthService] Exchanging code for tokens');

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: OAuthPlatform.getServerCallbackUri(),
        code: code,
        code_verifier: codeVerifier,
      });

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString(),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', response.status, errorText);

        // Create a structured error for the error handler
        const error = new Error(`Token exchange failed: ${response.status}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;

        await authErrorHandler.handleError(error, {
          operation: 'token_exchange',
          code: code.substring(0, 10) + '...',
          redirectUri: OAuthPlatform.getServerCallbackUri()
        });

        throw error;
      }

      const tokenData = await response.json();
      console.log('✅ Token exchange successful');
      return tokenData;
    } catch (error) {
      // Handle network and other errors
      await authErrorHandler.handleError(error, {
        operation: 'token_exchange',
        code: code.substring(0, 10) + '...',
        redirectUri: OAuthPlatform.getServerCallbackUri()
      });
      throw error;
    }
  }

  // Extract credentials from token response
  private async extractCredentialsFromToken(tokenData: any): Promise<BexioCredentials> {
    console.log('🔍 [OAuthService] Extracting credentials from token');

    let companyId = '';
    let userEmail = '';

    // Decode access token for company ID
    try {
      const tokenParts = tokenData.access_token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        companyId = payload.company_id || payload.companyId || '';
        userEmail = payload.email || payload.login_id || '';
      }
    } catch (error) {
      console.warn('Failed to decode access token:', error);
    }

    // If no email from access token, try to fetch from user info endpoint
    if (!userEmail && tokenData.access_token) {
      try {
        const userResponse = await fetch('https://api.bexio.com/3.0/users/me', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          userEmail = userData.email || '';
          console.log('✅ User info fetched successfully');
        }
      } catch (error) {
        console.warn('Failed to fetch user info:', error);
      }
    }

    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      companyId: companyId || 'unknown',
      userEmail: userEmail || 'OAuth User',
      authType: 'oauth',
      expiresAt
    };
  }

  // Create server session for mobile polling
  private async createServerSession(state: string): Promise<void> {
    console.log('🔄 [OAuthService] Creating server session for mobile');

    const sessionData = {
      codeVerifier: localStorage.getItem('bexio_oauth_code_verifier'),
      state: state,
      redirectUri: OAuthPlatform.getServerCallbackUri(),
      created: new Date().toISOString(),
      status: 'pending'
    };

    const serverUrl = getConfig.serverUrl();
    const response = await fetch(`${serverUrl}/api/bexio-oauth/status/${state}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    console.log('✅ Server session created');
  }

  // Start polling for mobile OAuth completion
  private startPolling(sessionId: string): void {
    console.log('🔄 [OAuthService] Starting OAuth polling for session:', sessionId);

    this.currentSessionId = sessionId;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    this.pollingInterval = setInterval(async () => {
      attempts++;

      try {
        const serverUrl = getConfig.serverUrl();
        const response = await fetch(`${serverUrl}/api/bexio-oauth/status/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const statusData = await response.json();

          if (statusData.status === 'completed' && statusData.tokens) {
            console.log('🎉 OAuth completed via polling');
            this.stopPolling();

            // Process completed OAuth
            const credentials = await this.extractCredentialsFromToken(statusData.tokens);

            // Notify listeners (this will be handled by the calling component)
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('oauthCompleted', {
                detail: { credentials, sessionId }
              }));
            }

            return;
          } else if (statusData.status === 'failed') {
            console.error('❌ OAuth failed via polling:', statusData.error);
            this.stopPolling();
            throw new Error(statusData.error || 'OAuth authentication failed');
          }
        } else if (response.status === 404) {
          // Session not found - continue polling
        } else if (attempts > 5) {
          // Stop polling after persistent errors
          this.stopPolling();
          throw new Error(`Server error: ${response.status}`);
        }

        if (attempts >= maxAttempts) {
          this.stopPolling();
          throw new Error('OAuth timeout - please try again');
        }

      } catch (error) {
        console.error('❌ Polling error:', error);
        this.stopPolling();

        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('oauthError', {
            detail: { error: error.message, sessionId }
          }));
        }
      }
    }, 5000); // Poll every 5 seconds
  }

  // Stop polling
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 OAuth polling stopped');
    }
  }

  // Build OAuth authorization URL
  private buildAuthUrl(codeChallenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: OAuthPlatform.getServerCallbackUri(),
      response_type: 'code',
      scope: this.config.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  // Generate random state parameter
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Store PKCE data in localStorage
  private storePKCEData(codeVerifier: string, state: string): void {
    localStorage.setItem('bexio_oauth_code_verifier', codeVerifier);
    localStorage.setItem('bexio_oauth_state', state);
  }

  // Cleanup OAuth state
  private cleanup(): void {
    localStorage.removeItem('bexio_oauth_code_verifier');
    localStorage.removeItem('bexio_oauth_state');
    this.stopPolling();
    this.currentSessionId = null;
  }

  // Cleanup on service destruction
  destroy(): void {
    this.cleanup();
  }
}

// Export singleton instance
export const oauthService = UnifiedOAuthService.getInstance();