import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import SecureStorage, { getConfig } from '@/lib/secureStorage';
import { filterValidObjects, isValidProject, isValidContact, isValidTimeEntry } from '@/lib/dataValidation';
import { oauthService } from '@/lib/oauthService';
import { authErrorHandler, AuthErrorType, RecoveryAction } from '@/lib/authErrorHandler';

// Helper function to get the correct server URL using centralized config
const getServerUrl = () => getConfig.serverUrl();


// Secure storage utility functions for production-ready credential persistence

interface Contact {
  id: number;
  nr: string;
  name_1: string;
  name_2?: string;
  salutation_id?: number;
  salutation_form?: string;
  title_id?: number;
  birthday?: string;
  address?: string;
  street_name?: string;
  house_number?: string;
  address_addition?: string;
  postcode?: string;
  city?: string;
  country_id?: number;
  mail?: string;
  mail_second?: string;
  phone_fixed?: string;
  phone_fixed_second?: string;
  phone_mobile?: string;
  fax?: string;
  url?: string;
  skype_name?: string;
  remarks?: string;
  language_id?: number;
  is_lead?: boolean;
  contact_group_ids?: string;
  contact_branch_ids?: string;
  user_id?: number;
  owner_id?: number;
  contact_type_id: number;
  updated_at?: string;
}

interface Project {
  id: number;
  nr: string;
  name: string;
  start_date: string;
  end_date?: string;
  comment?: string;
  pr_state_id: number;
  pr_project_type_id: number;
  contact_id?: number;
  contact_sub_id?: number;
  pr_invoice_type_id?: number;
  pr_invoice_type_amount?: number;
  pr_budget_type_id?: number;
  pr_budget_type_amount?: number;
}

interface TimeEntry {
  id: number;
  date: string;
  duration: string | number;
  text?: string;
  allowable_bill: boolean;
  contact_id?: number;
  project_id?: number;
  user_id?: number;
  client_service_id?: number;
  status_id?: number;
  pr_package_id?: string;
  pr_milestone_id?: number;
}

interface WorkPackage {
  id: string;
  name: string;
  spent_time_in_hours?: number;
  estimated_time_in_hours?: number;
  comment?: string;
  pr_milestone_id?: number;
}

interface BexioUser {
  id: number;
  salutation_type?: string;
  firstname: string;
  lastname: string;
  email: string;
  is_superadmin: boolean;
  is_accountant: boolean;
}

export interface BexioCredentials {
  apiKey?: string;
  companyId: string;
  accessToken?: string;
  refreshToken?: string;
  userEmail?: string;
  authType: 'api' | 'oauth';
  expiresAt?: number;
}

interface TimeEntryData {
  dateRange: DateRange | undefined;
  startTime?: string;
  endTime?: string;
  duration?: string;
  useDuration?: boolean;
  text: string;
  allowable_bill: boolean;
  excludeWeekends?: boolean;
  contact_id?: number;
  project_id?: number;
  client_service_id?: number;
  status_id?: number;
  pr_package_id?: string;
  pr_milestone_id?: number;
  user_id?: number;
}

interface AuthContextType {
  // Authentication state
  credentials: BexioCredentials | null;
  isConnected: boolean;
  isLoading: boolean;
  isLoadingCredentials: boolean;

  // Data state
  contacts: Contact[];
  projects: Project[];
  timeEntries: TimeEntry[];
  workPackages: WorkPackage[];
  users: BexioUser[];
  hasInitiallyLoaded: {
    contacts: boolean;
    projects: boolean;
    timeEntries: boolean;
    users: boolean;
  };

  // Additional data
  timesheetStatuses: { id: number; name: string }[];
  businessActivities: { id: number; name: string }[];
  languages: { id: number; name: string; iso_639_1: string }[];
  currentLanguage: string;
  workPackagesByProject: Record<number, WorkPackage[]>;

  // Loading states
  isLoadingContacts: boolean;
  isLoadingProjects: boolean;
  isLoadingTimeEntries: boolean;
  isLoadingWorkPackages: boolean;
  isLoadingUsers: boolean;
  isCreatingTimeEntry: boolean;

  // User info
  currentBexioUserId: number | null;
  isCurrentUserAdmin: boolean;

  // Actions
  connect: (apiKey: string, companyId: string) => Promise<void>;
  connectWithOAuth: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => Promise<void>;
  disconnect: () => void;
  loadStoredCredentials: () => Promise<boolean>;

  // Data fetching
  fetchContacts: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchTimeEntries: (dateRange?: { from: Date; to: Date }, options?: { quiet?: boolean }) => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchCurrentUser: () => Promise<BexioUser | null>;
  fetchLanguages: () => Promise<void>;
  fetchTimesheetStatuses: (options?: { quiet?: boolean }) => Promise<void>;
  fetchBusinessActivities: (options?: { quiet?: boolean }) => Promise<void>;

  // Time entry management
  createTimeEntry: (timeEntryData: TimeEntryData) => Promise<void>;
  updateTimeEntry: (id: number, timeEntryData: TimeEntryData) => Promise<void>;
  deleteTimeEntry: (id: number) => Promise<void>;
  bulkUpdateTimeEntries: (entries: any[], updateData: any) => Promise<void>;
  bulkDeleteTimeEntries: (entryIds: number[]) => Promise<void>;

  // Language management
  setCurrentLanguage: (language: string) => void;
  getWorkPackageName: (projectId: number | undefined, packageId: string | undefined) => string;

}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global state for authentication - ensures single source of truth
let globalCredentials: BexioCredentials | null = null;
let globalIsLoading = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<BexioCredentials | null>(null);

  const [isLoading, setIsLoading] = useState(globalIsLoading);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);

  // Update global loading state when local state changes
  useEffect(() => {
    globalIsLoading = isLoading;
  }, [isLoading]);

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [workPackagesByProject, setWorkPackagesByProject] = useState<Record<number, WorkPackage[]>>({});
  const [users, setUsers] = useState<BexioUser[]>([]);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState({
    contacts: false,
    projects: false,
    timeEntries: false,
    users: false
  });

  // Additional state for missing features
  const [timesheetStatuses, setTimesheetStatuses] = useState<{ id: number; name: string }[]>([]);
  const [businessActivities, setBusinessActivities] = useState<{ id: number; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ id: number; name: string; iso_639_1: string }[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    return localStorage.getItem('bexioLanguage') || 'en';
  });

  // Loading states
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
  const [isLoadingWorkPackages, setIsLoadingWorkPackages] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingTimeEntry, setIsCreatingTimeEntry] = useState(false);

  // User info
  const [currentBexioUserId, setCurrentBexioUserId] = useState<number | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);


  const { toast } = useToast();
  const credentialsRef = useRef<BexioCredentials | null>(credentials);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Sync ref with state
  useEffect(() => {
    credentialsRef.current = credentials;
    globalCredentials = credentials;
  }, [credentials]);


  // Helper function to decode JWT token
  const decodeJwt = (token?: string) => {
    try {
      if (!token) return null;
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Load stored credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const storedCreds = await SecureStorage.getStoredCredentials();
        if (storedCreds) {
          // Check if companyId needs to be extracted from token
          let updatedCreds = storedCreds;
          if (storedCreds.authType === 'oauth' && storedCreds.companyId === 'unknown' && storedCreds.accessToken) {
            const decoded = decodeJwt(storedCreds.accessToken);
            const extractedCompanyId = decoded?.company_id || decoded?.companyId;
            if (extractedCompanyId && extractedCompanyId !== 'unknown') {
              console.log('🔍 Extracted company ID from stored token:', extractedCompanyId);
              updatedCreds = {
                ...storedCreds,
                companyId: extractedCompanyId
              };
              // Update stored credentials with the extracted companyId
              await SecureStorage.storeCredentials(updatedCreds);
              console.log('💾 Updated stored credentials with extracted companyId');
            }
          }

          globalCredentials = updatedCreds;
          setCredentials(updatedCreds);
          console.log('🔐 Loaded stored credentials securely');
        }
      } catch (error) {
        console.error('❌ Error loading stored credentials:', error);
      } finally {
        setIsLoadingCredentials(false);
      }
    };

    loadCredentials();
  }, []);



  // Enhanced token validation with proactive refresh
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!credentials) {
      console.log('🔍 No credentials available');
      return null;
    }

    if (credentials.authType === 'api') {
      console.log('🔑 Using API key authentication');
      return credentials.apiKey || null;
    }

    // Check if token exists
    if (!credentials.accessToken) {
      console.log('❌ No access token available');
      return null;
    }

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const tokenExpiry = credentials.expiresAt || 0;

    console.log('🔍 Token validation:', {
      expiresAt: new Date(tokenExpiry).toISOString(),
      timeUntilExpiry: Math.floor((tokenExpiry - now) / 1000),
      needsRefresh: tokenExpiry <= now + fiveMinutes
    });

    // Check if token is still valid (with 5 minute buffer)
    if (tokenExpiry > now + fiveMinutes) {
      console.log('✅ Token is still valid');
      return credentials.accessToken;
    }

    // Token needs refresh
    console.log('🔄 Token needs refresh');

    // Use existing refresh promise if one is in progress
    if (refreshPromiseRef.current) {
      console.log('⏳ Refresh already in progress, waiting...');
      return refreshPromiseRef.current;
    }

    // Create new refresh promise
    console.log('🚀 Starting token refresh...');
    refreshPromiseRef.current = performTokenRefresh();
    const result = await refreshPromiseRef.current;
    refreshPromiseRef.current = null;

    if (result) {
      console.log('✅ Token refresh completed successfully');
    } else {
      console.log('❌ Token refresh failed');
    }

    return result;
  }, [credentials]);

  // Enhanced token refresh logic with centralized error handling
  const performTokenRefresh = useCallback(async (retryCount = 0): Promise<string | null> => {
    const maxRetries = 2;

    if (!credentials?.refreshToken) {
      console.log('🔄 No refresh token available');
      await handleAuthFailure('Session Expired', 'Your session has expired. Please log in again to continue.');
      return null;
    }

    try {
      console.log(`🔄 Attempting token refresh (attempt ${retryCount + 1}/${maxRetries + 1})...`);
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/bexio-oauth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: credentials.refreshToken }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (response.ok) {
        const { accessToken, refreshToken, expiresIn } = await response.json();

        // Validate response
        if (!accessToken) {
          throw new Error('Invalid refresh response: missing access token');
        }

        const expiresAt = Date.now() + (expiresIn * 1000);

        const updatedCreds: BexioCredentials = {
          ...credentials,
          accessToken,
          refreshToken: refreshToken || credentials.refreshToken,
          expiresAt
        };

        await SecureStorage.storeCredentials(updatedCreds);
        setCredentials(updatedCreds);
        console.log('✅ Token refresh successful');
        return accessToken;
      } else {
        // Create structured error for error handler
        const error = new Error(`Token refresh failed: ${response.status}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');

        // Handle error with centralized error handler
        const authError = authErrorHandler.classifyError(error, {
          operation: 'token_refresh',
          retryCount,
          refreshToken: credentials.refreshToken.substring(0, 10) + '...'
        });

        await authErrorHandler.handleError(error, {
          operation: 'token_refresh',
          retryCount,
          refreshToken: credentials.refreshToken.substring(0, 10) + '...'
        });

        // Execute recovery based on error type
        switch (authError.type) {
          case AuthErrorType.RATE_LIMITED:
          case AuthErrorType.NETWORK_ERROR:
          case AuthErrorType.SERVER_ERROR:
            if (retryCount < maxRetries && authError.retryable) {
              const retryDelay = 1000 * Math.pow(2, retryCount);
              console.log(`⏳ Retrying token refresh in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              return performTokenRefresh(retryCount + 1);
            }
            break;

          case AuthErrorType.INVALID_CREDENTIALS:
          case AuthErrorType.TOKEN_EXPIRED:
            await handleAuthFailure('Authentication Required', 'Your session is no longer valid. Please log in again.');
            return null;

          default:
            // Show user-friendly error message
            toast({
              title: "Authentication Error",
              description: authError.userMessage,
              variant: "destructive",
            });
            return null;
        }

        return null;
      }
    } catch (error) {
      // Handle network and other errors with centralized error handler
      const recoveryAction = await authErrorHandler.handleError(error, {
        operation: 'token_refresh',
        retryCount,
        refreshToken: credentials.refreshToken?.substring(0, 10) + '...'
      });

      // Execute recovery
      if (recoveryAction === RecoveryAction.RETRY && retryCount < maxRetries) {
        const retryDelay = 1000 * Math.pow(2, retryCount);
        console.log(`⏰ Network error, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return performTokenRefresh(retryCount + 1);
      }

      // Show user-friendly error message
      const authError = authErrorHandler.classifyError(error);
      toast({
        title: "Connection Error",
        description: authError.userMessage,
        variant: "destructive",
      });

      return null;
    }
  }, [credentials, toast]);

  // Helper function to handle authentication failures
  const handleAuthFailure = useCallback(async (title: string, description: string) => {
    await SecureStorage.removeStoredCredentials();
    setCredentials(null);
    toast({
      title,
      description,
      variant: "destructive",
    });
  }, [toast]);

  const connect = useCallback(async (apiKey: string, companyId: string) => {
    try {
      const creds: BexioCredentials = {
        apiKey,
        companyId,
        authType: 'api'
      };
      await SecureStorage.storeCredentials(creds);
      setCredentials(creds);

      toast({
        title: "Connected successfully",
        description: "You can now fetch data from Bexio.",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const connectWithOAuth = useCallback(async (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => {
    console.log('🔗 [DEBUG] ===== CONNECT WITH OAUTH START =====');
    console.log('🔗 [DEBUG] Platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());
    console.log('🔗 [DEBUG] connectWithOAuth called with:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      companyId,
      userEmail,
      accessTokenLength: accessToken?.length,
      refreshTokenLength: refreshToken?.length
    });

    // Check if we already have valid credentials to prevent duplicate processing
    if (credentials && credentials.accessToken === accessToken) {
      console.log('🔄 Same access token already set, skipping duplicate processing');
      console.log('🔗 ===== CONNECT WITH OAUTH END (SKIPPED) =====');
      return;
    }

    try {
      const expiresAt = Date.now() + (3600 * 1000); // 1 hour from now
      const creds: BexioCredentials = {
        accessToken,
        refreshToken,
        companyId: companyId || 'unknown',
        userEmail: userEmail || 'OAuth User',
        authType: 'oauth',
        expiresAt
      };

      console.log('💾 Storing credentials using cross-platform storage...');
      await SecureStorage.storeCredentials(creds);
      console.log('✅ Credentials stored using cross-platform storage');

      console.log('🎯 Setting credentials state...');
      setCredentials(creds);
      console.log('✅ Credentials state set!');

      console.log('🔗 Connection status check - isConnected should now be:', !!creds);
      console.log('🔗 Current credentials state after setting:', creds);

      console.log('🔗 ===== CONNECT WITH OAUTH END (SUCCESS) =====');
    } catch (error) {
      console.error('❌ OAuth connection error:', error);
      console.error('❌ OAuth connection error details:', {
        message: error.message,
        stack: error.stack
      });
      console.log('🔗 ===== CONNECT WITH OAUTH END (ERROR) =====');
      toast({
        title: "OAuth connection failed",
        description: "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [credentials, toast]);

  // Listen for OAuth completion events from the unified service
  useEffect(() => {
    const handleOAuthCompleted = async (event: CustomEvent) => {
      console.log('🎉 OAuth completed event received:', event.detail);
      const { credentials } = event.detail;

      try {
        await connectWithOAuth(
          credentials.accessToken,
          credentials.refreshToken,
          credentials.companyId,
          credentials.userEmail
        );
      } catch (error) {
        console.error('❌ Failed to process OAuth completion:', error);
        toast({
          title: 'Authentication Failed',
          description: 'Failed to complete authentication. Please try again.',
          variant: 'destructive',
        });
      }
    };

    const handleOAuthError = (event: CustomEvent) => {
      console.error('❌ OAuth error event received:', event.detail);
      const { error } = event.detail;

      toast({
        title: 'Authentication Failed',
        description: error || 'An unexpected error occurred during authentication.',
        variant: 'destructive',
      });
    };

    window.addEventListener('oauthCompleted', handleOAuthCompleted as EventListener);
    window.addEventListener('oauthError', handleOAuthError as EventListener);

    return () => {
      window.removeEventListener('oauthCompleted', handleOAuthCompleted as EventListener);
      window.removeEventListener('oauthError', handleOAuthError as EventListener);
    };
  }, [connectWithOAuth, toast]);

  const disconnect = useCallback(async () => {
    await SecureStorage.removeStoredCredentials();
    setCredentials(null);
    setContacts([]);
    setProjects([]);
    setTimeEntries([]);
    setWorkPackages([]);
    setUsers([]);
    setCurrentBexioUserId(null);
    setIsCurrentUserAdmin(false);
    setHasInitiallyLoaded({
      contacts: false,
      projects: false,
      timeEntries: false,
      users: false
    });

    toast({
      title: "Disconnected",
      description: "You have been disconnected from Bexio.",
    });
  }, [toast]);

  const loadStoredCredentials = useCallback(async () => {
    try {
      const creds = await SecureStorage.getStoredCredentials();
      if (creds) {
        setCredentials(creds);
        return true;
      }
    } catch (error) {
      console.error('Error loading stored credentials:', error);
    }
    return false;
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!credentials || isLoadingContacts) return;

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsLoadingContacts(true);
    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/3.0/contacts?limit=200',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      const validContacts = filterValidObjects(data, ['id'], isValidContact) as Contact[];
      setContacts(validContacts);
      setHasInitiallyLoaded(prev => ({ ...prev, contacts: true }));

      toast({
        title: "Contacts loaded",
        description: `Fetched ${validContacts.length} contacts.`,
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      if (credentials) {
        toast({
          title: "Failed to fetch contacts",
          description: error instanceof Error ? error.message : "An error occurred while fetching contacts.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingContacts(false);
    }
  }, [credentials, ensureValidToken, toast, isLoadingContacts]);

  const fetchProjects = useCallback(async () => {
    if (!credentials || isLoadingProjects) return;

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsLoadingProjects(true);
    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/3.0/projects',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      const validProjects = filterValidObjects(data, ['id'], isValidProject) as Project[];
      setProjects(validProjects);
      setHasInitiallyLoaded(prev => ({ ...prev, projects: true }));

      toast({
        title: "Projects loaded successfully",
        description: `Successfully fetched ${validProjects.length} projects.`,
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Failed to fetch projects",
        description: error instanceof Error ? error.message : "An error occurred while fetching projects.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProjects(false);
    }
  }, [credentials, ensureValidToken, toast, isLoadingProjects]);

  const fetchTimeEntries = useCallback(async (dateRange?: { from: Date; to: Date }, options?: { quiet?: boolean }) => {
    if (!credentials || isLoadingTimeEntries) return;

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsLoadingTimeEntries(true);
    try {
      let endpoint = '/2.0/timesheet';
      const params: string[] = [];

      if (dateRange) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        params.push(`date_from=${fromDate}&date_to=${toDate}`);
      }

      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: endpoint,
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Bexio API error: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      console.log('🔍 [DEBUG] OAuthContext fetchTimeEntries - raw data:', data);
      const timeEntriesData = Array.isArray(data) ? data : [];
      console.log('🔍 [DEBUG] OAuthContext fetchTimeEntries - processed entries count:', timeEntriesData.length);

      // Check for malformed duration data
      const malformedEntries = timeEntriesData.filter(entry => {
        if (entry.duration === undefined || entry.duration === null) {
          console.error('❌ [ERROR] OAuthContext - Time entry with undefined/null duration:', entry);
          return true;
        }
        if (typeof entry.duration === 'string' && !entry.duration.includes(':')) {
          console.warn('⚠️ [WARN] OAuthContext - Time entry with malformed duration string (no colon):', entry.duration, entry);
          return true;
        }
        return false;
      });

      if (malformedEntries.length > 0) {
        console.error('❌ [ERROR] OAuthContext - Found malformed time entries:', malformedEntries);
      }

      // Filter out undefined and invalid entries
      const validTimeEntries = filterValidObjects(timeEntriesData, ['id', 'date', 'allowable_bill'], isValidTimeEntry) as TimeEntry[];
      setTimeEntries(validTimeEntries);
      setHasInitiallyLoaded(prev => ({ ...prev, timeEntries: true }));

      const quiet = options?.quiet !== false;
      if (!quiet) {
        toast({
          title: "Time entries loaded",
          description: `Fetched ${Array.isArray(data) ? data.length : 0} time entries.`,
        });
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
      toast({
        title: "Failed to fetch time entries",
        description: error instanceof Error ? error.message : "An error occurred while fetching time entries.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTimeEntries(false);
    }
  }, [credentials, ensureValidToken, toast, isLoadingTimeEntries]);

  const fetchUsers = useCallback(async () => {
    console.log('👥 [DEBUG] fetchUsers called');
    console.log('👥 [DEBUG] credentials present:', !!credentials);
    console.log('👥 [DEBUG] isLoadingUsers:', isLoadingUsers);

    if (!credentials || isLoadingUsers) {
      console.log('👥 [DEBUG] Skipping fetchUsers - no credentials or already loading');
      return;
    }

    const authToken = await ensureValidToken();
    console.log('👥 [DEBUG] authToken present:', !!authToken);

    if (!authToken) {
      console.log('👥 [DEBUG] No auth token available');
      return;
    }

    setIsLoadingUsers(true);
    console.log('👥 [DEBUG] Starting user fetch...');

    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/3.0/users',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('👥 [DEBUG] Users API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('👥 [DEBUG] Users API error:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      console.log('👥 [DEBUG] Raw users data:', data);

      const fetchedUsers = Array.isArray(data) ? data.map((u: any) => ({
        id: u.id,
        salutation_type: u.salutation_type,
        firstname: u.firstname || 'Unknown',
        lastname: u.lastname || 'User',
        email: u.email || '',
        is_superadmin: u.is_superadmin || false,
        is_accountant: u.is_accountant || false,
      })) : [];

      console.log('👥 [DEBUG] Processed users:', fetchedUsers.map(u => `${u.firstname} ${u.lastname} (${u.email})`));

      setUsers(fetchedUsers);
      setHasInitiallyLoaded(prev => ({ ...prev, users: true }));

      console.log('👥 [DEBUG] Users state updated, calling fetchCurrentUser...');

      // Try to identify current user
      if (!currentBexioUserId) {
        console.log('👥 [DEBUG] No current user ID, fetching current user...');
        await fetchCurrentUser();
      }

      toast({
        title: "Users loaded",
        description: `Fetched ${fetchedUsers.length} users.`,
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      toast({
        title: "Failed to load users",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
      console.log('👥 [DEBUG] fetchUsers completed');
    }
  }, [credentials, ensureValidToken, toast, isLoadingUsers, currentBexioUserId]);

  const fetchCurrentUser = useCallback(async () => {
    if (!credentials) return null;

    const authToken = await ensureValidToken();
    if (!authToken) return null;

    try {
      const meResponse = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/3.0/users/me',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (meResponse.ok) {
        const responseWrapper = await meResponse.json();
        const userData = responseWrapper.data;
        const currentUser: BexioUser = {
          id: userData.id,
          salutation_type: userData.salutation_type,
          firstname: userData.firstname || 'Unknown',
          lastname: userData.lastname || 'User',
          email: userData.email || '',
          is_superadmin: userData.is_superadmin || false,
          is_accountant: userData.is_accountant || false,
        };

        setCurrentBexioUserId(currentUser.id);
        setIsCurrentUserAdmin(currentUser.is_superadmin || currentUser.is_accountant);

        return currentUser;
      }
    } catch (error) {
      console.warn('Failed to fetch current user via /me endpoint:', error);
    }

    return null;
  }, [credentials, ensureValidToken]);

  // Helper function to get work package name from cache
  const getWorkPackageName = useCallback((projectId: number | undefined, packageId: string | undefined): string => {
    if (!packageId) return 'No Work Package';
    if (!projectId) return `WP ${packageId}`;
    const list = workPackagesByProject[projectId] || [];
    const found = list.find(wp => wp.id === packageId || wp.id === String(packageId));
    return found?.name || `WP ${packageId}`;
  }, [workPackagesByProject]);

  // Enhanced setCurrentLanguage with persistence
  const setCurrentLanguageWithPersistence = useCallback((language: string) => {
    setCurrentLanguage(language);
    localStorage.setItem('bexioLanguage', language);
  }, []);

  // Load stored language preference on mount
  useEffect(() => {
    const storedLanguage = localStorage.getItem('bexioLanguage');
    if (storedLanguage && languages.length > 0) {
      const langExists = languages.find(lang => lang.iso_639_1 === storedLanguage);
      if (langExists) {
        setCurrentLanguage(storedLanguage);
      }
    }
  }, [languages]);

  const fetchLanguages = useCallback(async () => {
    // Skip API call since languages endpoint doesn't exist in Bexio API
    // Use hardcoded language list directly
    console.log('🌍 Setting up language list (no API call needed)');

    try {
      const fallbackLanguages = [
        { id: 1, name: 'English', iso_639_1: 'en' },
        { id: 2, name: 'Deutsch', iso_639_1: 'de' },
        { id: 3, name: 'Français', iso_639_1: 'fr' },
        { id: 4, name: 'Italiano', iso_639_1: 'it' },
      ];
      setLanguages(fallbackLanguages);
      if (!currentLanguage) {
        setCurrentLanguage('en');
      }
      console.log('✅ Languages initialized');
    } catch (error) {
      console.error('❌ Error setting up languages:', error);
    }
  }, [currentLanguage]);

  const fetchTimesheetStatuses = useCallback(async (options?: { quiet?: boolean }) => {
    if (!credentials) {
      console.error('No credentials available');
      if (!options?.quiet) {
        toast({ title: "Error", description: "API key not configured. Please connect to Bexio first.", variant: "destructive" });
      }
      return;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    console.log('🔍 Fetching timesheet statuses from Bexio');

    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/2.0/timesheet_status',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('📊 Timesheet statuses response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error fetching timesheet statuses:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      console.log('✅ Received timesheet statuses:', data);

      const statuses = Array.isArray(data) ? data.map((status: any) => ({
        id: status.id,
        name: status.name || `Status ${status.id}`,
      })) : [];

      setTimesheetStatuses(statuses);
      if (!options?.quiet) {
        toast({ title: "Timesheet statuses loaded", description: `Successfully fetched ${statuses.length} timesheet statuses.` });
      }
    } catch (error) {
      console.error('❌ Error fetching timesheet statuses:', error);
      setTimesheetStatuses([]);
      if (!options?.quiet) {
        toast({ title: "Failed to load timesheet statuses", description: "Please try again later.", variant: "destructive" });
      }
    }
  }, [credentials, ensureValidToken, toast]);

  const fetchBusinessActivities = useCallback(async (options?: { quiet?: boolean }) => {
    if (!credentials) {
      console.error('No credentials available');
      if (!options?.quiet) {
        toast({
          title: "Error",
          description: "API key not configured. Please connect to Bexio first.",
          variant: "destructive",
        });
      }
      return;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    console.log('🔍 Fetching business activities from Bexio');

    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/2.0/client_service',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('📊 Business activities response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error fetching business activities:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseWrapper = await response.json();
      const data = responseWrapper.data;
      console.log('✅ Received business activities:', data);

      const activities = Array.isArray(data) ? data.map((a: any) => ({
        id: a.id,
        name: a.name || `Activity ${a.id}`,
      })) : [];

      setBusinessActivities(activities);
      if (!options?.quiet) {
        toast({
          title: "Activities loaded",
          description: `Fetched ${activities.length} activities.`,
        });
      }
    } catch (error) {
      console.error('❌ Error fetching business activities:', error);
      setBusinessActivities([]);
      if (!options?.quiet) {
        toast({
          title: "Failed to load activities",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    }
  }, [credentials, ensureValidToken, toast]);

  // Time entry management functions
  const createTimeEntry = useCallback(async (timeEntryData: TimeEntryData) => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    if (!timeEntryData.dateRange?.from) {
      toast({
        title: "Validation Error",
        description: "Please select a date range.",
        variant: "destructive",
      });
      return;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsCreatingTimeEntry(true);
    try {
      // Calculate duration
      let durationString: string;

      if (timeEntryData.useDuration && timeEntryData.duration) {
        console.log('🔍 [DEBUG] OAuthContext - Parsing duration string:', timeEntryData.duration);
        const durationParts = timeEntryData.duration.split(':').map(Number);
        console.log('🔍 [DEBUG] OAuthContext - Duration parts:', durationParts);
        const [hours, minutes] = durationParts;
        console.log('🔍 [DEBUG] OAuthContext - Hours:', hours, 'Minutes:', minutes, 'Minutes type:', typeof minutes);
        if (minutes === undefined) {
          console.error('❌ [ERROR] OAuthContext - Minutes is undefined! Duration string malformed:', timeEntryData.duration);
          throw new Error(`Invalid duration format: ${timeEntryData.duration}. Expected HH:MM format.`);
        }
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      } else {
        const [startHours, startMinutes] = (timeEntryData.startTime || "09:00").split(':').map(Number);
        const [endHours, endMinutes] = (timeEntryData.endTime || "17:00").split(':').map(Number);

        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;

        let durationMinutes = endTotalMinutes - startTotalMinutes;
        if (durationMinutes < 0) {
          durationMinutes += 24 * 60;
        }

        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      }

      // Generate dates for the range
      const startDate = timeEntryData.dateRange.from;
      const endDate = timeEntryData.dateRange.to || startDate;

      const dates: Date[] = [];
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (!timeEntryData.excludeWeekends || !isWeekend) {
          dates.push(new Date(currentDate));
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Create time entries for each date
      const results: any[] = [];
      const failures: { date: string; error: string }[] = [];
      const batchSize = 5;
      const delayBetweenBatches = 1000;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      toast({
        title: "Creating time entries...",
        description: `Processing ${dates.length} entries in batches of ${batchSize}`,
      });

      const createWithRetry = async (date: Date) => {
        if (!timeEntryData.user_id && !currentBexioUserId) {
          console.log("🔍 No user ID found, attempting to fetch current user...");
          await fetchCurrentUser();
          if (!currentBexioUserId) {
            throw new Error("Couldn't identify your Bexio user. Please reconnect.");
          }
        }

        const bexioData = {
          user_id: timeEntryData.user_id || currentBexioUserId,
          client_service_id: timeEntryData.client_service_id ?? (businessActivities[0]?.id),
          text: timeEntryData.text || "",
          allowable_bill: timeEntryData.allowable_bill,
          tracking: {
            type: "duration",
            date: format(date, 'yyyy-MM-dd'),
            duration: durationString,
          },
          ...(timeEntryData.contact_id !== undefined && { contact_id: timeEntryData.contact_id }),
          ...(timeEntryData.project_id !== undefined && { pr_project_id: timeEntryData.project_id }),
          ...(timeEntryData.status_id !== undefined && { status_id: timeEntryData.status_id }),
          ...(timeEntryData.pr_package_id !== undefined && { pr_package_id: timeEntryData.pr_package_id }),
          ...(timeEntryData.pr_milestone_id !== undefined && { pr_milestone_id: timeEntryData.pr_milestone_id }),
        };

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch('/api/bexio-proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                endpoint: '/2.0/timesheet',
                method: 'POST',
                accessToken: authToken,
                companyId: credentials.companyId,
                data: bexioData,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({} as any));
              throw new Error(`${errorData.error || 'HTTP error'} (${response.status})`);
            }

            return await response.json();
          } catch (err) {
            if (attempt === maxRetries) throw err;
            const backoff = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
            await sleep(backoff);
          }
        }
      };

      for (let i = 0; i < dates.length; i += batchSize) {
        const batch = dates.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(dates.length / batchSize);

        console.log(`Processing batch ${batchNum}/${totalBatches}`);

        if (totalBatches > 1) {
          toast({
            title: "Creating time entries...",
            description: `Processing batch ${batchNum} of ${totalBatches} (${results.length}/${dates.length} completed)`,
          });
        }

        const settled = await Promise.allSettled(batch.map((d) => createWithRetry(d)));
        settled.forEach((res, idx) => {
          const d = batch[idx];
          const dateStr = d.toISOString().split('T')[0];
          if (res.status === 'fulfilled') {
            results.push(res.value);
          } else {
            failures.push({ date: dateStr, error: res.reason instanceof Error ? res.reason.message : 'Unknown error' });
          }
        });

        if (i + batchSize < dates.length) {
          await sleep(delayBetweenBatches);
        }
      }

      if (failures.length > 0) {
        toast({
          title: "Partial failure",
          description: `${results.length} entries created, ${failures.length} failed. First error: ${failures[0].date} - ${failures[0].error}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Time entries created",
          description: `Successfully created ${results.length} time entries for the selected date range.`,
        });
      }

      // Refresh time entries
      await fetchTimeEntries();

    } catch (error) {
      console.error('Error creating time entry:', error);
      toast({
        title: "Failed to create time entry",
        description: error instanceof Error ? error.message : "An error occurred while creating the time entry.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, ensureValidToken, toast, fetchTimeEntries, businessActivities, currentBexioUserId, fetchCurrentUser]);

  const updateTimeEntry = useCallback(async (id: number, timeEntryData: TimeEntryData) => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    if (!timeEntryData.dateRange?.from) {
      toast({
        title: "Validation Error",
        description: "Please select a date.",
        variant: "destructive",
      });
      return;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsCreatingTimeEntry(true);
    try {
      let durationString: string;

      if (timeEntryData.useDuration && timeEntryData.duration) {
        console.log('🔍 [DEBUG] OAuthContext update - Parsing duration string:', timeEntryData.duration);
        const durationParts = timeEntryData.duration.split(':').map(Number);
        console.log('🔍 [DEBUG] OAuthContext update - Duration parts:', durationParts);
        const [hours, minutes] = durationParts;
        console.log('🔍 [DEBUG] OAuthContext update - Hours:', hours, 'Minutes:', minutes, 'Minutes type:', typeof minutes);
        if (minutes === undefined) {
          console.error('❌ [ERROR] OAuthContext update - Minutes is undefined! Duration string malformed:', timeEntryData.duration);
          throw new Error(`Invalid duration format: ${timeEntryData.duration}. Expected HH:MM format.`);
        }
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      } else {
        const [startHours, startMinutes] = (timeEntryData.startTime || "09:00").split(':').map(Number);
        const [endHours, endMinutes] = (timeEntryData.endTime || "17:00").split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        let durationMinutes = endTotalMinutes - startTotalMinutes;
        if (durationMinutes < 0) durationMinutes += 24 * 60;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      }

      const bexioData = {
        ...(timeEntryData.user_id !== undefined && { user_id: timeEntryData.user_id }),
        ...(timeEntryData.client_service_id !== undefined && { client_service_id: timeEntryData.client_service_id }),
        text: timeEntryData.text || "",
        allowable_bill: timeEntryData.allowable_bill,
        tracking: {
          type: "duration",
          date: format(timeEntryData.dateRange.from, 'yyyy-MM-dd'),
          duration: durationString,
        },
        ...(timeEntryData.contact_id !== undefined && { contact_id: timeEntryData.contact_id }),
        ...(timeEntryData.project_id !== undefined && { pr_project_id: timeEntryData.project_id }),
        ...(timeEntryData.status_id !== undefined && { status_id: timeEntryData.status_id }),
        ...(timeEntryData.pr_package_id !== undefined && { pr_package_id: timeEntryData.pr_package_id }),
        ...(timeEntryData.pr_milestone_id !== undefined && { pr_milestone_id: timeEntryData.pr_milestone_id }),
      } as Record<string, any>;

      console.log('Updating time entry with data:', { id, data: bexioData });

      const putResponse = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/2.0/timesheet/${id}`,
          method: 'POST',
          accessToken: authToken,
          companyId: credentials.companyId,
          data: bexioData,
        }),
      });

      if (putResponse.ok) {
        const result = await putResponse.json();
        console.log('✅ Time entry updated successfully:', result);
        toast({ title: "Time entry updated", description: "The time entry has been successfully updated." });
        await fetchTimeEntries();
        return;
      }

      const putError = await putResponse.json().catch(() => ({}));
      console.error('❌ PUT update failed:', { status: putResponse.status, error: putError });

      const errorMessage = putError.error || putError.message || `HTTP ${putResponse.status}`;
      throw new Error(`Failed to update time entry: ${errorMessage}`);
    } catch (error) {
      console.error('Error updating time entry:', error);
      toast({
        title: "Failed to update time entry",
        description: error instanceof Error ? error.message : "An error occurred while updating the time entry.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, ensureValidToken, toast, fetchTimeEntries]);

  const deleteTimeEntry = useCallback(async (id: number) => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    try {
      const response = await fetch('/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/2.0/timesheet/${id}`,
          method: 'DELETE',
          accessToken: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          console.log(`Time entry ${id} already deleted or doesn't exist`);
          return;
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Time entry deleted",
        description: "The time entry has been successfully deleted.",
      });
      await fetchTimeEntries();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      toast({
        title: "Failed to delete time entry",
        description: error instanceof Error ? error.message : "An error occurred while deleting the time entry.",
        variant: "destructive",
      });
      throw error;
    }
  }, [credentials, ensureValidToken, toast, fetchTimeEntries]);

  const bulkUpdateTimeEntries = useCallback(async (entries: any[], updateData: any) => {
    if (!credentials) return;
    setIsCreatingTimeEntry(true);

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    try {
      const authToken = await ensureValidToken();
      if (!authToken) return;

      console.log(`🔄 Starting bulk update of ${entries.length} entries`);

      for (const entry of entries) {
        try {
          const mergedData = {
            user_id: entry.user_id,
            client_service_id: updateData.client_service_id !== undefined ? updateData.client_service_id : entry.client_service_id,
            text: updateData.text !== undefined ? updateData.text : entry.text,
            allowable_bill: updateData.allowable_bill !== undefined ? updateData.allowable_bill : entry.allowable_bill,
            tracking: {
              type: "duration",
              date: entry.date,
              duration: entry.duration,
            },
            contact_id: updateData.contact_id !== undefined ? updateData.contact_id : entry.contact_id,
            pr_project_id: updateData.project_id !== undefined ? updateData.project_id : entry.pr_project_id,
            status_id: updateData.status_id !== undefined ? updateData.status_id : entry.status_id,
            pr_package_id: updateData.pr_package_id !== undefined ? updateData.pr_package_id : entry.pr_package_id,
          };

          console.log(`📝 Updating entry ${entry.id} with:`, mergedData);

          const putResponse = await fetch('/api/bexio-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: `/2.0/timesheet/${entry.id}`,
              method: 'POST',
              accessToken: authToken,
              companyId: credentials.companyId,
              data: mergedData,
            }),
          });

          if (putResponse.ok) {
            const result = await putResponse.json();
            console.log(`✅ Successfully updated entry ${entry.id}:`, result);
            successCount++;
            continue;
          }

          const putError = await putResponse.json().catch(() => ({}));
          console.error(`❌ Failed to update entry ${entry.id}:`, { status: putResponse.status, error: putError });

          const errorMsg = putError.error || putError.message || `HTTP ${putResponse.status}`;
          errors.push(`Entry ${entry.id}: ${errorMsg}`);
          failureCount++;
        } catch (error) {
          console.error(`💥 Error updating entry ${entry.id}:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Entry ${entry.id}: ${errorMsg}`);
          failureCount++;
        }
      }

      if (failureCount === 0) {
        toast({
          title: `Successfully updated ${successCount} entries`,
          description: "All time entries have been updated successfully."
        });
      } else {
        const description = errors.length > 0 ? `First error: ${errors[0]}` : undefined;
        toast({
          title: `Updated ${successCount} entries, ${failureCount} failed`,
          description,
          variant: failureCount === entries.length ? "destructive" : "default"
        });
      }

      await fetchTimeEntries();
    } catch (error) {
      console.error('💥 Bulk update failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Bulk update failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, fetchTimeEntries, ensureValidToken]);

  const bulkDeleteTimeEntries = useCallback(async (entryIds: number[]) => {
    if (!credentials) return;
    setIsCreatingTimeEntry(true);

    toast({
      title: "Deleting time entries...",
      description: `Starting deletion of ${entryIds.length} entries`,
    });

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const [index, id] of entryIds.entries()) {
        try {
          await deleteTimeEntry(id);
          successCount++;

          if ((index + 1) % 5 === 0 || index === entryIds.length - 1) {
            toast({
              title: "Deleting time entries...",
              description: `Deleted ${successCount} of ${entryIds.length} entries`,
            });
          }
        } catch (error) {
          console.error(`Failed to delete entry ${id}:`, error);
          failureCount++;
        }
      }

      if (failureCount === 0) {
        toast({ title: `Successfully deleted ${successCount} entries` });
      } else {
        toast({
          title: `Deleted ${successCount} entries, ${failureCount} failed`,
          description: "Some entries may have already been deleted.",
          variant: failureCount === entryIds.length ? "destructive" : "default"
        });
      }

      await fetchTimeEntries();
    } catch (error) {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, deleteTimeEntry, fetchTimeEntries]);

  const contextValue: AuthContextType = {
    // Authentication state
    credentials,
    isConnected: !!credentials,
    isLoading,
    isLoadingCredentials,

    // Data state
    contacts,
    projects,
    timeEntries,
    workPackages,
    users,
    hasInitiallyLoaded,

    // Additional data
    timesheetStatuses,
    businessActivities,
    languages,
    currentLanguage,
    workPackagesByProject,

    // Loading states
    isLoadingContacts,
    isLoadingProjects,
    isLoadingTimeEntries,
    isLoadingWorkPackages,
    isLoadingUsers,
    isCreatingTimeEntry,

    // User info
    currentBexioUserId,
    isCurrentUserAdmin,

    // Actions
    connect,
    connectWithOAuth,
    disconnect,
    loadStoredCredentials,

    // Data fetching
    fetchContacts,
    fetchProjects,
    fetchTimeEntries,
    fetchUsers,
    fetchCurrentUser,
    fetchLanguages,
    fetchTimesheetStatuses,
    fetchBusinessActivities,

    // Time entry management
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,

    // Language management
    setCurrentLanguage: setCurrentLanguageWithPersistence,
    getWorkPackageName,

  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Legacy alias for backward compatibility
export const OAuthProvider = AuthProvider;
export const useOAuth = useAuth;

// Export utility function
export { getServerUrl };