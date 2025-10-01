import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { BexioCredentials } from '@/context/OAuthContext';

// Logging utility that respects environment settings
export const logger = {
  info: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true') {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    // Always show errors, but in a cleaner format for production
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true') {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      console.error(message);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
};

// Configuration utility for environment variables
export const getConfig = {
  // Server URLs
  serverUrl: (): string => {
    // Check environment variables in order of priority
    if (typeof import.meta !== 'undefined' && import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL;
    }

    // For mobile apps, check mobile-specific URL
    if (Capacitor.isNativePlatform() && typeof import.meta !== 'undefined' && import.meta.env.VITE_MOBILE_SERVER_URL) {
      return import.meta.env.VITE_MOBILE_SERVER_URL;
    }

    // Check production URL
    if (typeof import.meta !== 'undefined' && import.meta.env.VITE_PRODUCTION_URL) {
      return import.meta.env.VITE_PRODUCTION_URL;
    }

    // For production builds (deployed apps), use the current domain
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      return `https://${window.location.hostname}`;
    }

    // For mobile native platforms, ensure we use production URL
    if (Capacitor.isNativePlatform()) {
      return import.meta.env.VITE_PRODUCTION_URL || 'https://tic-tac-puce-chi.vercel.app';
    }

    // Fallback for development
    if (typeof import.meta !== 'undefined' && import.meta.env.DEV) {
      return 'http://localhost:3001';
    }

    return 'http://localhost:3001';
  },

  // Bexio OAuth Configuration
  bexioClientId: (): string => {
    return typeof import.meta !== 'undefined' && import.meta.env.VITE_BEXIO_CLIENT_ID
      ? import.meta.env.VITE_BEXIO_CLIENT_ID
      : 'your_bexio_client_id_here';
  },

  bexioClientSecret: (): string => {
    return typeof import.meta !== 'undefined' && import.meta.env.VITE_BEXIO_CLIENT_SECRET
      ? import.meta.env.VITE_BEXIO_CLIENT_SECRET
      : 'your_bexio_client_secret_here';
  },

  // Logging
  logLevel: (): string => {
    return typeof import.meta !== 'undefined' && import.meta.env.VITE_LOG_LEVEL
      ? import.meta.env.VITE_LOG_LEVEL
      : 'info';
  },

  // Environment
  isProduction: (): boolean => {
    return typeof import.meta !== 'undefined' && import.meta.env.PROD;
  },

  isDevelopment: (): boolean => {
    return typeof import.meta !== 'undefined' && import.meta.env.DEV;
  }
};

// Encryption utilities for production-ready token storage
class SecureStorage {
  private static readonly STORAGE_KEY = 'bexio_secure_credentials';
  private static readonly ENCRYPTION_KEY = 'bexio_encryption_key_v1';

  /**
   * Generate a secure encryption key for the current device
   * In production, this should be derived from device-specific data
   */
  private static async getEncryptionKey(): Promise<string> {
    // For production, use a more secure key derivation
    // This could include device ID, user ID, or biometric data
    const baseKey = this.ENCRYPTION_KEY;

    if (Capacitor.isNativePlatform()) {
      // On native platforms, use a consistent key for the same device
      // Use platform name only, not timestamp to ensure consistency across app restarts
      const deviceId = Capacitor.getPlatform();
      return this.hashString(baseKey + deviceId);
    } else {
      // For web, use a consistent key (less secure but functional)
      return this.hashString(baseKey + 'web_fallback');
    }
  }

  /**
   * Simple hash function for key derivation
   * In production, use a proper key derivation function like PBKDF2
   */
  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Encrypt data using AES-GCM when available, fallback to simple obfuscation
   */
  private static async encrypt(data: string): Promise<string> {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const key = await this.getEncryptionKey();
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(key),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          derivedKey,
          dataBuffer
        );

        // Combine salt, iv, and encrypted data
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return 'encrypted:' + btoa(String.fromCharCode(...combined));
      } else {
        // Fallback for environments without crypto.subtle
        return 'obfuscated:' + btoa(data.split('').reverse().join(''));
      }
    } catch (error) {
      console.warn('Encryption failed, using fallback:', error);
      return 'fallback:' + btoa(data);
    }
  }

  /**
   * Decrypt data using AES-GCM when available
   */
  private static async decrypt(encryptedData: string): Promise<string> {
    try {
      if (encryptedData.startsWith('encrypted:')) {
        const encoded = encryptedData.substring('encrypted:'.length);
        const combined = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)));

        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);

        const key = await this.getEncryptionKey();
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(key),
          'PBKDF2',
          false,
          ['deriveBits', 'deriveKey']
        );

        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          derivedKey,
          encrypted
        );

        return new TextDecoder().decode(decrypted);
      } else if (encryptedData.startsWith('obfuscated:')) {
        const encoded = encryptedData.substring('obfuscated:'.length);
        return atob(encoded).split('').reverse().join('');
      } else if (encryptedData.startsWith('fallback:')) {
        const encoded = encryptedData.substring('fallback:'.length);
        return atob(encoded);
      } else {
        // Legacy unencrypted data
        return encryptedData;
      }
    } catch (error) {
      console.warn('Decryption failed:', error);
      throw new Error('Failed to decrypt stored data');
    }
  }

  /**
   * Store credentials securely with encryption
   */
  static async storeCredentials(credentials: BexioCredentials): Promise<void> {
    try {
      console.log('🔐 [DEBUG] Storing credentials securely...');
      console.log('🔐 [DEBUG] Platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());
      console.log('🔐 [DEBUG] Credentials to store:', {
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        companyId: credentials.companyId,
        userEmail: credentials.userEmail,
        authType: credentials.authType,
        hasExpiresAt: !!credentials.expiresAt
      });

      const credentialsString = JSON.stringify({
        ...credentials,
        storedAt: Date.now(),
        version: '1.0'
      });

      console.log('🔐 [DEBUG] Credentials string length:', credentialsString.length);

      const encryptedData = await this.encrypt(credentialsString);
      console.log('🔐 [DEBUG] Encrypted data length:', encryptedData.length);
      console.log('🔐 [DEBUG] Encrypted data prefix:', encryptedData.substring(0, 20) + '...');

      if (Capacitor.isNativePlatform()) {
        console.log('🔐 [DEBUG] Using Capacitor Preferences for storage');
        try {
          await Preferences.set({
            key: this.STORAGE_KEY,
            value: encryptedData,
          });
          console.log('🔐 [DEBUG] Successfully stored in Capacitor Preferences');
        } catch (capError) {
          console.error('❌ [DEBUG] Capacitor Preferences storage failed:', capError);
          throw capError;
        }
      } else {
        console.log('🔐 [DEBUG] Using localStorage for storage');
        try {
          localStorage.setItem(this.STORAGE_KEY, encryptedData);
          console.log('🔐 [DEBUG] Successfully stored in localStorage');
        } catch (lsError) {
          console.error('❌ [DEBUG] localStorage storage failed:', lsError);
          throw lsError;
        }
      }

      console.log('🔐 [DEBUG] Credentials stored securely');
    } catch (error) {
      console.error('❌ [DEBUG] Failed to store credentials securely:', error);
      console.error('❌ [DEBUG] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw new Error('Failed to store credentials securely');
    }
  }

  /**
   * Retrieve and decrypt credentials
   */
  static async getStoredCredentials(): Promise<BexioCredentials | null> {
    try {
      console.log('🔓 [DEBUG] Retrieving stored credentials...');
      console.log('🔓 [DEBUG] Platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());

      let encryptedData: string | null = null;

      if (Capacitor.isNativePlatform()) {
        console.log('🔓 [DEBUG] Using Capacitor Preferences for retrieval');
        try {
          const { value } = await Preferences.get({ key: this.STORAGE_KEY });
          encryptedData = value;
          console.log('🔓 [DEBUG] Capacitor Preferences get result:', !!value);
        } catch (capError) {
          console.error('❌ [DEBUG] Capacitor Preferences get failed:', capError);
          return null;
        }
      } else {
        console.log('🔓 [DEBUG] Using localStorage for retrieval');
        try {
          encryptedData = localStorage.getItem(this.STORAGE_KEY);
          console.log('🔓 [DEBUG] localStorage get result:', !!encryptedData);
        } catch (lsError) {
          console.error('❌ [DEBUG] localStorage get failed:', lsError);
          return null;
        }
      }

      console.log('🔓 [DEBUG] Encrypted data exists:', !!encryptedData);
      if (encryptedData) {
        console.log('🔓 [DEBUG] Encrypted data length:', encryptedData.length);
        console.log('🔓 [DEBUG] Encrypted data prefix:', encryptedData.substring(0, 20) + '...');
      }

      if (!encryptedData) {
        console.log('🔓 [DEBUG] No encrypted data found, returning null');
        return null;
      }

      console.log('🔓 [DEBUG] Decrypting data...');
      const decryptedString = await this.decrypt(encryptedData);
      console.log('🔓 [DEBUG] Decrypted string length:', decryptedString.length);

      const parsed = JSON.parse(decryptedString);
      console.log('🔓 [DEBUG] Parsed credentials:', {
        hasAccessToken: !!parsed.accessToken,
        hasRefreshToken: !!parsed.refreshToken,
        companyId: parsed.companyId,
        userEmail: parsed.userEmail,
        authType: parsed.authType,
        hasExpiresAt: !!parsed.expiresAt,
        storedAt: parsed.storedAt,
        version: parsed.version
      });

      // Validate the stored data structure
      if (!parsed || typeof parsed !== 'object') {
        console.warn('🔓 [DEBUG] Invalid stored credentials format');
        return null;
      }

      // Remove metadata before returning
      const { storedAt, version, ...credentials } = parsed;
      console.log('🔓 [DEBUG] Returning credentials:', {
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
        companyId: credentials.companyId,
        authType: credentials.authType
      });
      return credentials as BexioCredentials;

    } catch (error) {
      console.error('❌ [DEBUG] Failed to retrieve credentials:', error);
      console.error('❌ [DEBUG] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      // Clear corrupted data
      await this.removeStoredCredentials();
      return null;
    }
  }

  /**
   * Remove stored credentials securely
   */
  static async removeStoredCredentials(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key: this.STORAGE_KEY });
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
      console.log('🗑️ Credentials removed securely');
    } catch (error) {
      console.error('❌ Failed to remove credentials:', error);
    }
  }

  /**
   * Validate stored credentials integrity
   */
  static async validateStoredCredentials(): Promise<boolean> {
    try {
      const credentials = await this.getStoredCredentials();
      return credentials !== null && this.isValidCredentials(credentials);
    } catch {
      return false;
    }
  }

  /**
   * Check if credentials object is valid
   */
  private static isValidCredentials(credentials: any): boolean {
    return (
      credentials &&
      typeof credentials === 'object' &&
      typeof credentials.companyId === 'string' &&
      typeof credentials.authType === 'string' &&
      (credentials.authType === 'api' || credentials.authType === 'oauth')
    );
  }

  /**
   * Test credential storage and retrieval (for debugging)
   */
  static async testCredentialStorage(): Promise<boolean> {
    try {
      console.log('🧪 [DEBUG] Testing credential storage...');

      // Create test credentials
      const testCredentials: BexioCredentials = {
        companyId: 'test-company',
        authType: 'oauth',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        userEmail: 'test@example.com',
        expiresAt: Date.now() + 3600000
      };

      console.log('🧪 [DEBUG] Storing test credentials...');
      await this.storeCredentials(testCredentials);

      console.log('🧪 [DEBUG] Retrieving test credentials...');
      const retrieved = await this.getStoredCredentials();

      if (retrieved && retrieved.companyId === testCredentials.companyId) {
        console.log('🧪 [DEBUG] Test successful! Cleaning up...');
        await this.removeStoredCredentials();
        return true;
      } else {
        console.log('🧪 [DEBUG] Test failed - credentials mismatch');
        return false;
      }
    } catch (error) {
      console.error('🧪 [DEBUG] Test failed with error:', error);
      return false;
    }
  }
}

export default SecureStorage;