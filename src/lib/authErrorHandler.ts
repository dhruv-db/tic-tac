import { Capacitor } from '@capacitor/core';

// Error types for better categorization
export enum AuthErrorType {
  NETWORK_ERROR = 'network_error',
  TOKEN_EXPIRED = 'token_expired',
  INVALID_CREDENTIALS = 'invalid_credentials',
  RATE_LIMITED = 'rate_limited',
  SERVER_ERROR = 'server_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PLATFORM_ERROR = 'platform_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Structured error interface
export interface AuthError {
  type: AuthErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: number;
  platform: string;
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
}

// Recovery actions
export enum RecoveryAction {
  RETRY = 'retry',
  REAUTHENTICATE = 'reauthenticate',
  CHECK_CONNECTION = 'check_connection',
  UPDATE_CONFIG = 'update_config',
  CONTACT_SUPPORT = 'contact_support',
  NONE = 'none'
}

// Error handler class
export class AuthErrorHandler {
  private static instance: AuthErrorHandler;
  private errorHistory: AuthError[] = [];
  private maxHistorySize = 50;

  private constructor() {}

  static getInstance(): AuthErrorHandler {
    if (!AuthErrorHandler.instance) {
      AuthErrorHandler.instance = new AuthErrorHandler();
    }
    return AuthErrorHandler.instance;
  }

  // Classify error based on the original error
  classifyError(error: any, context?: Record<string, any>): AuthError {
    const platform = Capacitor.getPlatform();
    const timestamp = Date.now();

    // Network errors
    if (error.name === 'NetworkError' || error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        message: 'Network connection failed',
        originalError: error,
        context,
        timestamp,
        platform,
        recoverable: true,
        retryable: true,
        userMessage: 'Please check your internet connection and try again.'
      };
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: 'Request timed out',
        originalError: error,
        context,
        timestamp,
        platform,
        recoverable: true,
        retryable: true,
        userMessage: 'The request took too long. Please try again.'
      };
    }

    // HTTP status based errors
    if (error.status) {
      switch (error.status) {
        case 401:
          return {
            type: AuthErrorType.INVALID_CREDENTIALS,
            severity: ErrorSeverity.HIGH,
            message: 'Authentication failed',
            originalError: error,
            context,
            timestamp,
            platform,
            recoverable: true,
            retryable: false,
            userMessage: 'Your session has expired. Please log in again.'
          };

        case 403:
          return {
            type: AuthErrorType.INVALID_CREDENTIALS,
            severity: ErrorSeverity.HIGH,
            message: 'Access forbidden',
            originalError: error,
            context,
            timestamp,
            platform,
            recoverable: false,
            retryable: false,
            userMessage: 'You do not have permission to access this resource.'
          };

        case 429:
          return {
            type: AuthErrorType.RATE_LIMITED,
            severity: ErrorSeverity.MEDIUM,
            message: 'Too many requests',
            originalError: error,
            context,
            timestamp,
            platform,
            recoverable: true,
            retryable: true,
            userMessage: 'Please wait a moment before trying again.'
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: AuthErrorType.SERVER_ERROR,
            severity: ErrorSeverity.HIGH,
            message: 'Server error',
            originalError: error,
            context,
            timestamp,
            platform,
            recoverable: true,
            retryable: true,
            userMessage: 'Server is temporarily unavailable. Please try again later.'
          };

        default:
          return {
            type: AuthErrorType.UNKNOWN_ERROR,
            severity: ErrorSeverity.MEDIUM,
            message: `HTTP ${error.status} error`,
            originalError: error,
            context,
            timestamp,
            platform,
            recoverable: true,
            retryable: false,
            userMessage: 'An unexpected error occurred. Please try again.'
          };
      }
    }

    // Token-related errors
    if (error.message?.includes('token') || error.message?.includes('Token')) {
      return {
        type: AuthErrorType.TOKEN_EXPIRED,
        severity: ErrorSeverity.MEDIUM,
        message: 'Token error',
        originalError: error,
        context,
        timestamp,
        platform,
        recoverable: true,
        retryable: true,
        userMessage: 'Your session needs to be refreshed. Please try again.'
      };
    }

    // Configuration errors
    if (error.message?.includes('configuration') || error.message?.includes('config')) {
      return {
        type: AuthErrorType.CONFIGURATION_ERROR,
        severity: ErrorSeverity.CRITICAL,
        message: 'Configuration error',
        originalError: error,
        context,
        timestamp,
        platform,
        recoverable: false,
        retryable: false,
        userMessage: 'Application is not properly configured. Please contact support.'
      };
    }

    // Platform-specific errors
    if (Capacitor.isNativePlatform() && (error.message?.includes('plugin') || error.message?.includes('native'))) {
      return {
        type: AuthErrorType.PLATFORM_ERROR,
        severity: ErrorSeverity.HIGH,
        message: 'Platform error',
        originalError: error,
        context,
        timestamp,
        platform,
        recoverable: true,
        retryable: false,
        userMessage: 'A platform error occurred. Please restart the app and try again.'
      };
    }

    // Default unknown error
    return {
      type: AuthErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: error.message || 'Unknown error',
      originalError: error,
      context,
      timestamp,
      platform,
      recoverable: false,
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.'
    };
  }

  // Handle error with appropriate recovery actions
  async handleError(error: any, context?: Record<string, any>): Promise<RecoveryAction> {
    const authError = this.classifyError(error, context);

    // Log the error
    this.logError(authError);

    // Add to history
    this.addToHistory(authError);

    // Determine recovery action
    const recoveryAction = this.determineRecoveryAction(authError);

    // Execute recovery if possible
    await this.executeRecoveryAction(recoveryAction, authError);

    return recoveryAction;
  }

  // Determine the best recovery action for an error
  private determineRecoveryAction(error: AuthError): RecoveryAction {
    switch (error.type) {
      case AuthErrorType.NETWORK_ERROR:
        return error.retryable ? RecoveryAction.RETRY : RecoveryAction.CHECK_CONNECTION;

      case AuthErrorType.TOKEN_EXPIRED:
      case AuthErrorType.INVALID_CREDENTIALS:
        return RecoveryAction.REAUTHENTICATE;

      case AuthErrorType.RATE_LIMITED:
        return RecoveryAction.RETRY;

      case AuthErrorType.SERVER_ERROR:
        return error.retryable ? RecoveryAction.RETRY : RecoveryAction.CONTACT_SUPPORT;

      case AuthErrorType.CONFIGURATION_ERROR:
        return RecoveryAction.UPDATE_CONFIG;

      case AuthErrorType.PLATFORM_ERROR:
        return RecoveryAction.RETRY;

      default:
        return error.recoverable ? RecoveryAction.RETRY : RecoveryAction.CONTACT_SUPPORT;
    }
  }

  // Execute recovery action
  private async executeRecoveryAction(action: RecoveryAction, error: AuthError): Promise<void> {
    console.log(`🔧 Executing recovery action: ${action} for error: ${error.message}`);

    switch (action) {
      case RecoveryAction.RETRY:
        // Retry logic is handled by the calling code
        console.log('⏳ Recovery: Retry will be handled by calling code');
        break;

      case RecoveryAction.REAUTHENTICATE:
        console.log('🔐 Recovery: Re-authentication required');
        // This will be handled by clearing credentials and redirecting to login
        break;

      case RecoveryAction.CHECK_CONNECTION:
        console.log('📡 Recovery: User should check network connection');
        break;

      case RecoveryAction.UPDATE_CONFIG:
        console.log('⚙️ Recovery: Configuration needs to be updated');
        break;

      case RecoveryAction.CONTACT_SUPPORT:
        console.log('📞 Recovery: User should contact support');
        break;

      default:
        console.log('❓ Recovery: No specific action needed');
    }
  }

  // Log error with appropriate level
  private logError(error: AuthError): void {
    const logData = {
      type: error.type,
      severity: error.severity,
      message: error.message,
      platform: error.platform,
      timestamp: new Date(error.timestamp).toISOString(),
      context: error.context
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL AUTH ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('❌ HIGH AUTH ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('⚠️ MEDIUM AUTH ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
        console.info('ℹ️ LOW AUTH ERROR:', logData);
        break;
    }
  }

  // Add error to history
  private addToHistory(error: AuthError): void {
    this.errorHistory.unshift(error);

    // Keep only the most recent errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  // Get error history
  getErrorHistory(): AuthError[] {
    return [...this.errorHistory];
  }

  // Get recent errors by type
  getRecentErrorsByType(type: AuthErrorType, limit = 10): AuthError[] {
    return this.errorHistory
      .filter(error => error.type === type)
      .slice(0, limit);
  }

  // Check if we should retry based on error history
  shouldRetry(errorType: AuthErrorType, maxRetries = 3): boolean {
    const recentErrors = this.getRecentErrorsByType(errorType, maxRetries);
    return recentErrors.length < maxRetries;
  }

  // Clear error history
  clearHistory(): void {
    this.errorHistory = [];
  }
}

// Export singleton instance
export const authErrorHandler = AuthErrorHandler.getInstance();

// Utility functions for common error handling patterns
export const handleAuthError = async (error: any, context?: Record<string, any>): Promise<RecoveryAction> => {
  return authErrorHandler.handleError(error, context);
};

export const classifyAuthError = (error: any, context?: Record<string, any>): AuthError => {
  return authErrorHandler.classifyError(error, context);
};