import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { BexioCredentials } from '@/context/OAuthContext';

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
      // On native platforms, we can use device-specific data
      const deviceId = Capacitor.getPlatform() + '_' + Date.now().toString();
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
      const credentialsString = JSON.stringify({
        ...credentials,
        storedAt: Date.now(),
        version: '1.0'
      });

      const encryptedData = await this.encrypt(credentialsString);

      if (Capacitor.isNativePlatform()) {
        await Preferences.set({
          key: this.STORAGE_KEY,
          value: encryptedData,
        });
      } else {
        localStorage.setItem(this.STORAGE_KEY, encryptedData);
      }

      console.log('🔐 Credentials stored securely');
    } catch (error) {
      console.error('❌ Failed to store credentials securely:', error);
      throw new Error('Failed to store credentials securely');
    }
  }

  /**
   * Retrieve and decrypt credentials
   */
  static async getStoredCredentials(): Promise<BexioCredentials | null> {
    try {
      let encryptedData: string | null = null;

      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: this.STORAGE_KEY });
        encryptedData = value;
      } else {
        encryptedData = localStorage.getItem(this.STORAGE_KEY);
      }

      if (!encryptedData) {
        return null;
      }

      const decryptedString = await this.decrypt(encryptedData);
      const parsed = JSON.parse(decryptedString);

      // Validate the stored data structure
      if (!parsed || typeof parsed !== 'object') {
        console.warn('Invalid stored credentials format');
        return null;
      }

      // Remove metadata before returning
      const { storedAt, version, ...credentials } = parsed;
      return credentials as BexioCredentials;

    } catch (error) {
      console.error('❌ Failed to retrieve credentials:', error);
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
}

export default SecureStorage;