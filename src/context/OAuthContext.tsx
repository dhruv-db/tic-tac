import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

// Helper function to get the correct server URL based on platform
const getServerUrl = () => {
  // For mobile apps, use the host machine's IP address
  if (Capacitor.isNativePlatform()) {
    // Use the same IP as configured in .env
    return import.meta.env.VITE_MOBILE_SERVER_URL || 'http://192.168.29.13:3001';
  }

  // For web, check if we're in production (Vercel)
  if (import.meta.env.PROD || window.location.hostname !== 'localhost') {
    // Use production URL from environment or Vercel domain
    return import.meta.env.VITE_WEB_SERVER_URL || `https://${window.location.hostname}`;
  }

  // For local development
  return import.meta.env.VITE_WEB_SERVER_URL || 'http://localhost:3001';
};

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

interface BexioCredentials {
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
  loadStoredCredentials: () => boolean;

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

  // Legacy OAuth callback support
  onOAuthConnect: ((accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) | null;
  setOAuthConnectHandler: (handler: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global state for authentication - ensures single source of truth
let globalCredentials: BexioCredentials | null = null;
let globalIsLoading = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<BexioCredentials | null>(() => {
    // Initialize from localStorage on first load
    try {
      const stored = localStorage.getItem('bexio_credentials');
      if (stored) {
        const parsed = JSON.parse(stored) as BexioCredentials;
        globalCredentials = parsed;
        return parsed;
      }
    } catch (error) {
      console.error('Error initializing credentials from localStorage:', error);
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(globalIsLoading);

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

  // Legacy OAuth support
  const [onOAuthConnect, setOnOAuthConnect] = useState<((accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) | null>(null);

  const { toast } = useToast();
  const credentialsRef = useRef<BexioCredentials | null>(credentials);

  // Sync ref with state
  useEffect(() => {
    credentialsRef.current = credentials;
    globalCredentials = credentials;
  }, [credentials]);

  // Sync global loading state
  useEffect(() => {
    globalIsLoading = isLoading;
    setIsLoading(globalIsLoading);
  }, [isLoading]);

  const setOAuthConnectHandler = useCallback((handler: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) => {
    setOnOAuthConnect(() => handler);
  }, []);

  // Helper function to refresh OAuth token if needed
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!credentials) return null;

    if (credentials.authType === 'api') {
      return credentials.apiKey || null;
    }

    if (credentials.authType === 'oauth') {
      // Check if token is still valid (with 5 minute buffer)
      if (credentials.expiresAt && credentials.expiresAt > Date.now() + (5 * 60 * 1000)) {
        return credentials.accessToken || null;
      }

      // Token expired or about to expire, refresh it
      if (credentials.refreshToken) {
        try {
          const response = await fetch(`${getServerUrl()}/api/bexio-oauth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: credentials.refreshToken }),
          });

          if (response.ok) {
            const { accessToken, refreshToken, expiresIn } = await response.json();
            const expiresAt = Date.now() + (expiresIn * 1000);

            const updatedCreds: BexioCredentials = {
              ...credentials,
              accessToken,
              refreshToken: refreshToken || credentials.refreshToken,
              expiresAt
            };

            localStorage.setItem('bexio_credentials', JSON.stringify(updatedCreds));
            setCredentials(updatedCreds);
            return accessToken;
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
      }

      // Refresh failed, clear credentials
      localStorage.removeItem('bexio_credentials');
      setCredentials(null);
      toast({
        title: "Session expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      return null;
    }

    return null;
  }, [credentials, toast]);

  const connect = useCallback(async (apiKey: string, companyId: string) => {
    try {
      const creds: BexioCredentials = {
        apiKey,
        companyId,
        authType: 'api'
      };
      localStorage.setItem('bexio_credentials', JSON.stringify(creds));
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
    console.log('🔗 ===== CONNECT WITH OAUTH START =====');
    console.log('🔗 connectWithOAuth called with:', {
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

      console.log('💾 Storing credentials in localStorage...');
      localStorage.setItem('bexio_credentials', JSON.stringify(creds));
      console.log('✅ Credentials stored in localStorage');

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

  const disconnect = useCallback(() => {
    localStorage.removeItem('bexio_credentials');
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

  const loadStoredCredentials = useCallback(() => {
    try {
      const stored = localStorage.getItem('bexio_credentials');
      if (stored) {
        const creds = JSON.parse(stored);
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/contacts?limit=200',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : (Array.isArray((data as any)?.data)
            ? (data as any).data
            : (data && typeof data === 'object' ? [data as any] : []));
      setContacts(items);
      setHasInitiallyLoaded(prev => ({ ...prev, contacts: true }));

      toast({
        title: "Contacts loaded",
        description: `Fetched ${items.length} contacts.`,
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/projects',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
      setHasInitiallyLoaded(prev => ({ ...prev, projects: true }));

      toast({
        title: "Projects loaded successfully",
        description: `Successfully fetched ${Array.isArray(data) ? data.length : 0} projects.`,
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
      let endpoint = '/timesheet';
      const params: string[] = [];

      if (dateRange) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        params.push(`date_from=${fromDate}&date_to=${toDate}`);
      }

      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: endpoint,
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Bexio API error: ${response.status}`);
      }

      const data = await response.json();
      setTimeEntries(Array.isArray(data) ? data : []);
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/users',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('👥 [DEBUG] Users API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('👥 [DEBUG] Users API error:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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
      const meResponse = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/users/me',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (meResponse.ok) {
        const userData = await meResponse.json();
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/timesheet_status',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('📊 Timesheet statuses response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error fetching timesheet statuses:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/client_service',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      console.log('📊 Business activities response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error fetching business activities:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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
        const [hours, minutes] = timeEntryData.duration.split(':').map(Number);
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
            const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: '/timesheet',
                method: 'POST',
                apiKey: authToken,
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
        const [hours, minutes] = timeEntryData.duration.split(':').map(Number);
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

      const putResponse = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/2.0/timesheet/${id}`,
          method: 'POST',
          apiKey: authToken,
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
      const response = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/timesheet/${id}`,
          method: 'DELETE',
          apiKey: authToken,
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

          const putResponse = await fetch(`${getServerUrl()}/api/bexio-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: `/2.0/timesheet/${entry.id}`,
              method: 'POST',
              apiKey: authToken,
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

    // Legacy OAuth callback support
    onOAuthConnect,
    setOAuthConnectHandler,
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