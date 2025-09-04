import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

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

export const useBexioApi = () => {
  const [credentials, setCredentials] = useState<BexioCredentials | null>(() => {
    try {
      const stored = localStorage.getItem('bexio_credentials');
      return stored ? JSON.parse(stored) as BexioCredentials : null;
    } catch {
      return null;
    }
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [workPackagesByProject, setWorkPackagesByProject] = useState<Record<number, WorkPackage[]>>({});
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
  const [isLoadingWorkPackages, setIsLoadingWorkPackages] = useState(false);
  const [timesheetStatuses, setTimesheetStatuses] = useState<{ id: number; name: string }[]>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [businessActivities, setBusinessActivities] = useState<{ id: number; name: string }[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [languages, setLanguages] = useState<{ id: number; name: string; iso_639_1: string }[]>([]);
  const [users, setUsers] = useState<BexioUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [currentBexioUserId, setCurrentBexioUserId] = useState<number | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  
  // Guards to avoid duplicate or spammy work package fetches
  const workPackageInFlightRef = useRef<Record<number, boolean>>({});
  const workPackageLastFetchedRef = useRef<Record<number, number>>({});
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    return localStorage.getItem('bexioLanguage') || 'en';
  });

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
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [isCreatingTimeEntry, setIsCreatingTimeEntry] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState({
    contacts: false,
    projects: false,
    timeEntries: false,
    users: false
  });
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Debug helpers: decode JWT to inspect scopes and audience
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
  const logTokenClaims = (token?: string) => {
    const claims: any = decodeJwt(token);
    if (!claims) return;
    const scopes = claims.scope || claims.scp || [];
    const aud = claims.aud;
    console.group('[Bexio OAuth] Token claims');
    console.log('scopes:', scopes);
    console.log('aud:', aud);
    console.log('exp:', claims.exp);
    console.groupEnd();
    const required = ['project_show','contact_show','monitoring_show'];
    const hasScope = (s: string) => Array.isArray(scopes) ? scopes.includes(s) : (typeof scopes === 'string' ? scopes.split(' ').includes(s) : false);
    const missing = required.filter((s) => !hasScope(s));
    if (missing.length) {
      toast({
        title: 'Limited permissions',
        description: `Missing scopes: ${missing.join(', ')}. Please reconnect via OAuth to grant them.`,
        variant: 'destructive',
      });
    }
  };

  // Helper: get work package name from cache, handle both project_id and pr_project_id
  const getWorkPackageName = (projectId: number | undefined, packageId: string | undefined): string => {
    if (!packageId) return 'No Work Package';
    if (!projectId) return `WP ${packageId}`;
    const list = workPackagesByProject[projectId] || [];
    const found = list.find(wp => wp.id === packageId || wp.id === String(packageId));
    return found?.name || `WP ${packageId}`;
  };


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
          const response = await fetch('https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-oauth/refresh', {
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
            logTokenClaims(accessToken);
            
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

  const fetchCurrentUser = useCallback(async () => {
    if (!credentials) return null;

    const authToken = await ensureValidToken();
    if (!authToken) return null;

    try {
      // Try /3.0/users/me first (OAuth preferred)
      const meResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/users/me',
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: 'en',
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
        
        console.log(`🔐 Current user identified via /me: ${currentUser.firstname} ${currentUser.lastname} (${currentUser.email})`);
        return currentUser;
      }
    } catch (error) {
      console.warn('Failed to fetch current user via /me endpoint:', error);
    }

    // Fallback: Try to identify via email matching if OAuth user
    if (credentials.authType === 'oauth' && credentials.userEmail) {
      try {
        const usersResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: '/3.0/users',
            apiKey: authToken,
            companyId: credentials.companyId,
            acceptLanguage: 'en',
          }),
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          const currentUser = Array.isArray(usersData) 
            ? usersData.find(u => u.email === credentials.userEmail)
            : null;
            
          if (currentUser) {
            const user: BexioUser = {
              id: currentUser.id,
              salutation_type: currentUser.salutation_type,
              firstname: currentUser.firstname || 'Unknown',
              lastname: currentUser.lastname || 'User',
              email: currentUser.email || '',
              is_superadmin: currentUser.is_superadmin || false,
              is_accountant: currentUser.is_accountant || false,
            };

            setCurrentBexioUserId(user.id);
            setIsCurrentUserAdmin(user.is_superadmin || user.is_accountant);
            
            console.log(`🔐 Current user identified via email match: ${user.firstname} ${user.lastname}`);
            return user;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch users for email matching:', error);
      }
    }

    // Final fallback: check localStorage
    const storedUserId = localStorage.getItem('selectedBexioUserId');
    if (storedUserId) {
      const userId = parseInt(storedUserId);
      const isAdmin = localStorage.getItem('isCurrentUserAdmin') === 'true';
      setCurrentBexioUserId(userId);
      setIsCurrentUserAdmin(isAdmin);
      console.log(`🔐 Using stored user ID: ${userId} (admin: ${isAdmin})`);
      return { id: userId, is_superadmin: isAdmin, is_accountant: false } as BexioUser;
    }

    console.warn('❌ Could not identify current user');
    return null;
  }, [credentials, ensureValidToken]);

  const connect = useCallback(async (apiKey: string, companyId: string) => {
    try {
      // Store credentials in localStorage
      const creds: BexioCredentials = { 
        apiKey, 
        companyId, 
        authType: 'api' 
      };
      localStorage.setItem('bexio_credentials', JSON.stringify(creds));
      setCredentials(creds);
      
      // Auto-identify current user after connection
      setTimeout(async () => {
        await fetchCurrentUser();
      }, 100);
      
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
  }, [toast, fetchCurrentUser]);

  const connectWithOAuth = useCallback(async (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => {
    console.log('🔗 connectWithOAuth called with:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, companyId, userEmail });
    try {
      const expiresAt = Date.now() + (3600 * 1000); // 1 hour from now
      const creds: BexioCredentials = {
        accessToken,
        refreshToken,
        companyId: companyId || 'unknown', // Fallback for missing company ID
        userEmail: userEmail || 'OAuth User', // Fallback for missing email
        authType: 'oauth',
        expiresAt
      };
      
      console.log('💾 Storing credentials in localStorage:', creds);
      localStorage.setItem('bexio_credentials', JSON.stringify(creds));
      console.log('🎯 Setting credentials state...');
      setCredentials(creds);
      console.log('✅ Credentials set! App should now be connected. isConnected will be:', !!creds);
      logTokenClaims(accessToken);
      
      // Auto-identify current user after OAuth connection
      setTimeout(async () => {
        await fetchCurrentUser();
      }, 100);
      
      // No toast notification - seamless authentication
    } catch (error) {
      console.error('❌ OAuth connection error:', error);
      toast({
        title: "OAuth connection failed",
        description: "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast, fetchCurrentUser]);


  const fetchContacts = useCallback(async () => {
    if (!credentials || isLoadingContacts) return;

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsLoadingContacts(true);
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/contacts?limit=200',
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: currentLanguage,
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
      toast({
        title: "Failed to fetch contacts",
        description: error instanceof Error ? error.message : "An error occurred while fetching contacts.",
        variant: "destructive",
      });
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
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({
            endpoint: '/3.0/projects',
            apiKey: authToken,
            companyId: credentials.companyId,
            acceptLanguage: currentLanguage,
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

  const lastFetchRef = useRef<{ key: string; ts: number } | null>(null);
  const lastRangeRef = useRef<{ from: Date; to: Date } | null>(null);

  const fetchTimeEntries = useCallback(async (
    dateRange?: { from: Date; to: Date },
    options?: { quiet?: boolean },
    userId?: number
  ) => {
    if (!credentials || isLoadingTimeEntries) return;

    // Build endpoint with optional date filtering
    let endpoint = '/timesheet';
    const params: string[] = [];
    
    if (dateRange) {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      params.push(`date_from=${fromDate}&date_to=${toDate}`);
    }
    
    // For non-admins, filter by current user ID
    if (userId && !isCurrentUserAdmin) {
      params.push(`user_id=${userId}`);
    }
    
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }
    
    // Remember last requested range for consistent refreshes across views
    lastRangeRef.current = dateRange ?? null;


    // Skip duplicate fetch within 1500ms
    const now = Date.now();
    if (lastFetchRef.current && lastFetchRef.current.key === endpoint && now - lastFetchRef.current.ts < 1500) {
      return;
    }
    lastFetchRef.current = { key: endpoint, ts: now };

    // Clear any pending fetch timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const authToken = await ensureValidToken();
    if (!authToken) return;

    setIsLoadingTimeEntries(true);
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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
        // Handle 429 rate limiting with retry
        if (response.status === 429) {
          console.warn('Rate limited, scheduling retry in 2000ms for', endpoint);
          fetchTimeoutRef.current = setTimeout(() => {
            fetchTimeEntries(dateRange, options);
          }, 2000);
          return;
        }
        throw new Error(errorData.error || `Bexio API error: ${response.status}`);
      }

      const data = await response.json();
      setTimeEntries(Array.isArray(data) ? data : []);
      setHasInitiallyLoaded(prev => ({ ...prev, timeEntries: true }));

      const quiet = options?.quiet !== false; // default quiet
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

  const fetchWorkPackages = useCallback(async (projectId?: number) => {
    if (!credentials) {
      // Silent fail to avoid noisy toasts
      return;
    }

    if (!projectId) {
      setWorkPackages([]);
      return;
    }

    // Guard: avoid concurrent and too-frequent fetches per project
    const now = Date.now();
    if (workPackageInFlightRef.current[projectId]) {
      return;
    }
    if (workPackageLastFetchedRef.current[projectId] && now - workPackageLastFetchedRef.current[projectId] < 120000) {
      // fetched within last 2 minutes, skip
      return;
    }
    workPackageInFlightRef.current[projectId] = true;
    workPackageLastFetchedRef.current[projectId] = now;

    const authToken = await ensureValidToken();
    if (!authToken) {
      workPackageInFlightRef.current[projectId] = false;
      return;
    }

    setIsLoadingWorkPackages(true);
    console.log(`🔍 Fetching work packages for project ID: ${projectId}`);
    
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/3.0/projects/${projectId}/packages`,
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: currentLanguage,
        }),
      });

      console.log(`📊 Response status for project ${projectId}:`, response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ Error fetching packages for project ${projectId}:`, errorData);
        
        // If this specific project doesn't have packages, that's okay - just return empty (no toast)
        if (response.status === 404) {
          setWorkPackages([]);
          setWorkPackagesByProject(prev => ({ ...prev, [projectId]: [] }));
          return;
        }
        
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Received packages for project ${projectId}:`, data);
      
      // Transform the data to our expected format based on the API response structure
      const workPackages = Array.isArray(data) ? data : [];
      
      const transformedPackages = workPackages.map((pkg: any) => ({
        id: pkg.id?.toString(),
        name: pkg.name,
        spent_time_in_hours: pkg.spent_time_in_hours,
        estimated_time_in_hours: pkg.estimated_time_in_hours,
        comment: pkg.comment,
        pr_milestone_id: pkg.pr_milestone_id,
        pr_project_id: pkg.pr_project_id ?? pkg.project_id,
      }));
      
      setWorkPackages(transformedPackages);
      setWorkPackagesByProject(prev => ({ ...prev, [projectId]: transformedPackages }));
      // No success toast to avoid spam
      
    } catch (error) {
      console.error(`❌ Error fetching work packages for project ${projectId}:`, error);
      setWorkPackages([]);
      setWorkPackagesByProject(prev => ({ ...prev, [projectId]: [] }));
      // Keep error toast minimal
      toast({
        title: "Failed to fetch work packages",
        description: error instanceof Error ? error.message : "An error occurred while fetching work packages.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingWorkPackages(false);
      workPackageInFlightRef.current[projectId] = false;
    }
  }, [credentials, ensureValidToken, toast, currentLanguage]);

  // Load credentials from localStorage on mount
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

  const createTimeEntry = useCallback(async (timeEntryData: {
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
    user_id?: number; // Add user_id for admin assignment
  }) => {
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
        // Use direct duration input
        const [hours, minutes] = timeEntryData.duration.split(':').map(Number);
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      } else {
        // Calculate from start/end times
        const [startHours, startMinutes] = (timeEntryData.startTime || "09:00").split(':').map(Number);
        const [endHours, endMinutes] = (timeEntryData.endTime || "17:00").split(':').map(Number);
        
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        let durationMinutes = endTotalMinutes - startTotalMinutes;
        if (durationMinutes < 0) {
          durationMinutes += 24 * 60; // Handle overnight work
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
        // Skip weekends if excludeWeekends is true
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (!timeEntryData.excludeWeekends || !isWeekend) {
          dates.push(new Date(currentDate));
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Create time entries for each date with rate limiting + retries
      const results: any[] = [];
      const failures: { date: string; error: string }[] = [];
      const batchSize = 5;
      const delayBetweenBatches = 1000;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Show initial progress toast
      toast({
        title: "Creating time entries...",
        description: `Processing ${dates.length} entries in batches of ${batchSize}`,
      });

      const createWithRetry = async (date: Date) => {
        // Ensure we have a valid user ID
        if (!timeEntryData.user_id && !currentBexioUserId) {
          console.log("🔍 No user ID found, attempting to fetch current user...");
          await fetchCurrentUser();
          if (!currentBexioUserId) {
            throw new Error("Couldn't identify your Bexio user. Please reconnect.");
          }
        }
        
        const bexioData = {
          user_id: timeEntryData.user_id || currentBexioUserId, // Use specified or current user
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
            const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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

      console.log(`Creating ${dates.length} time entries in batches of ${batchSize}`);

      for (let i = 0; i < dates.length; i += batchSize) {
        const batch = dates.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(dates.length / batchSize);
        
        console.log(`Processing batch ${batchNum}/${totalBatches}`);
        
        // Update progress toast
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

      // Refresh time entries to show the new ones
      await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
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
  }, [credentials, ensureValidToken, toast, fetchTimeEntries, businessActivities, currentBexioUserId]);

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

    setIsLoadingStatuses(true);
    console.log('🔍 Fetching timesheet statuses from Bexio');
    
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/timesheet_status',
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: 'en', // Always fetch in English
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
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [credentials, ensureValidToken, toast, currentLanguage]);

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

    setIsLoadingActivities(true);
    console.log('🔍 Fetching business activities from Bexio');

    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/client_service',
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: 'en', // Always fetch in English
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
    } finally {
      setIsLoadingActivities(false);
    }
  }, [credentials, ensureValidToken, toast, currentLanguage]);

  const fetchLanguages = useCallback(async () => {
    if (!credentials) return;

    // Skip API call since languages endpoint doesn't exist in Bexio API
    // Use hardcoded language list directly
    console.log('🌍 Setting up language list (no API call needed)');
    
    setIsLoadingLanguages(true);
    
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
    } finally {
      setIsLoadingLanguages(false);
    }
  }, [credentials, currentLanguage]);

  const updateTimeEntry = useCallback(async (id: number, timeEntryData: {
    dateRange: DateRange | undefined;
    startTime?: string;
    endTime?: string;
    duration?: string;
    useDuration?: boolean;
    text: string;
    allowable_bill: boolean;
    contact_id?: number;
    project_id?: number;
    client_service_id?: number;
    status_id?: number;
    pr_package_id?: string;
    pr_milestone_id?: number;
    user_id?: number; // Add user_id for admin assignment
  }) => {
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
        if (durationMinutes < 0) durationMinutes += 24 * 60;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      }

      // Ensure we have a valid user ID
      if (!timeEntryData.user_id && !currentBexioUserId) {
        console.log("🔍 No user ID found, attempting to fetch current user...");
        await fetchCurrentUser();
        if (!currentBexioUserId) {
          throw new Error("Couldn't identify your Bexio user. Please reconnect.");
        }
      }
      
      const bexioData = {
        user_id: timeEntryData.user_id || currentBexioUserId, // Use specified or current user
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

      // Try updating via PUT first using 2.0 API
      const putResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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
        toast({ title: "Time entry updated", description: "The time entry has been successfully updated." });
        await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
        return;
      }

      // Check if it's a method not allowed error before fallback
      const putError = await putResponse.json().catch(() => ({}));
      if (putResponse.status !== 405 && putResponse.status !== 501) {
        // It's a real error, not just unsupported method
        throw new Error(`Failed to update entry: ${putError.error || putResponse.status}`);
      }

      // Fallback for APIs that don't allow PUT on timesheets: delete + recreate
      // Delete existing
      const deleteResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/timesheet/${id}`,
          method: 'DELETE',
          apiKey: authToken,
          companyId: credentials.companyId,
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        throw new Error(`Failed to delete existing entry: ${errorData.error || deleteResponse.status}`);
      }

      // Re-create with new data (reuse computed durationString)
      const recreateData = {
        user_id: timeEntryData.user_id || currentBexioUserId, // Use specified or current user
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

      console.log('Updating time entry with data (recreate):', {
        originalId: id,
        data: recreateData,
      });

      const createResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/timesheet',
          method: 'POST',
          apiKey: authToken,
          companyId: credentials.companyId,
          data: recreateData,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${createResponse.status}`);
      }

      toast({
        title: "Time entry updated",
        description: "The time entry has been successfully updated.",
      });

      await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
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

  const deleteTimeEntry = useCallback(async (id: number, skipRefresh = false) => {
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
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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
        // If entry doesn't exist (404), consider it already deleted
        if (response.status === 404) {
          console.log(`Time entry ${id} already deleted or doesn't exist`);
          return; // Success - entry is gone
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (!skipRefresh) {
        toast({
          title: "Time entry deleted",
          description: "The time entry has been successfully deleted.",
        });
        await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
      if (!skipRefresh) {
        toast({
          title: "Failed to delete time entry",
          description: error instanceof Error ? error.message : "An error occurred while deleting the time entry.",
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [credentials, ensureValidToken, toast, fetchTimeEntries]);

  const bulkUpdateTimeEntries = useCallback(async (entries: any[], updateData: any) => {
    if (!credentials) return;
    setIsCreatingTimeEntry(true);
    
    let successCount = 0;
    let failureCount = 0;
    
    try {
      const authToken = await ensureValidToken();
      if (!authToken) return;

      for (const entry of entries) {
        try {
          // Merge existing entry data with updates
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
            pr_project_id: updateData.project_id !== undefined ? updateData.project_id : entry.project_id,
            status_id: updateData.status_id !== undefined ? updateData.status_id : entry.status_id,
          };

          // Try updating via PUT first using 2.0 API
          const putResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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
            successCount++;
            continue;
          }

          const putError = await putResponse.json().catch(() => ({}));
          console.error(`Failed to update entry ${entry.id}:`, putError);
          failureCount++;
        } catch (error) {
          console.error(`Error updating entry ${entry.id}:`, error);
          failureCount++;
        }
      }

      if (failureCount === 0) {
        toast({ title: `Successfully updated ${successCount} entries` });
      } else {
        toast({ 
          title: `Updated ${successCount} entries, ${failureCount} failed`,
          variant: failureCount === entries.length ? "destructive" : "default"
        });
      }
      
      await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
    } catch (error) {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, fetchTimeEntries, deleteTimeEntry, ensureValidToken]);

  const bulkDeleteTimeEntries = useCallback(async (entryIds: number[]) => {
    if (!credentials) return;
    setIsCreatingTimeEntry(true);
    
    // Show initial progress toast
    toast({
      title: "Deleting time entries...",
      description: `Starting deletion of ${entryIds.length} entries`,
    });
    
    try {
      let successCount = 0;
      let failureCount = 0;
      
      // Delete all entries without refreshing after each one
      for (const [index, id] of entryIds.entries()) {
        try {
          await deleteTimeEntry(id, true); // Skip refresh for individual deletes
          successCount++;
          
          // Update progress every 5 deletions or on last item
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
      
      // Refresh only once at the end
      await fetchTimeEntries(lastRangeRef.current || undefined, { quiet: true });
    } catch (error) {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, deleteTimeEntry, fetchTimeEntries]);


  const fetchUsers = useCallback(async (options?: { quiet?: boolean }) => {
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

    setIsLoadingUsers(true);
    console.log('🔍 Fetching users from Bexio');

    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/3.0/users',
          apiKey: authToken,
          companyId: credentials.companyId,
          acceptLanguage: 'en',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const fetchedUsers = Array.isArray(data) ? data.map((u: any) => ({
        id: u.id,
        salutation_type: u.salutation_type,
        firstname: u.firstname || 'Unknown',
        lastname: u.lastname || 'User',
        email: u.email || '',
        is_superadmin: u.is_superadmin || false,
        is_accountant: u.is_accountant || false,
      })) : [];

      setUsers(fetchedUsers);
      setHasInitiallyLoaded(prev => ({ ...prev, users: true }));

      // Try to identify current user via fetchCurrentUser
      if (!currentBexioUserId) {
        await fetchCurrentUser();
      }

      if (!options?.quiet) {
        toast({
          title: "Users loaded",
          description: `Fetched ${fetchedUsers.length} users.`,
        });
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setUsers([]);
      if (!options?.quiet) {
        toast({
          title: "Failed to load users",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingUsers(false);
    }
  }, [credentials, ensureValidToken, toast, currentBexioUserId, fetchCurrentUser]);

  const disconnect = useCallback(() => {
    localStorage.removeItem('bexio_credentials');
    setCredentials(null);
    setContacts([]);
    setProjects([]);
    setTimeEntries([]);
    setWorkPackages([]);
    toast({
      title: "Disconnected",
      description: "You have been disconnected from Bexio.",
    });
  }, [toast]);

  return {
    credentials,
    contacts,
    projects,
    timeEntries,
    workPackages,
    isLoadingContacts,
    isLoadingProjects,
    isLoadingTimeEntries,
    isLoadingWorkPackages,
    isCreatingTimeEntry,
    isConnected: !!credentials,
    hasInitiallyLoaded,
    users,
    isLoadingUsers,
    currentBexioUserId,
    isCurrentUserAdmin,
    fetchUsers,
    fetchCurrentUser,
    connect,
    connectWithOAuth,
    fetchContacts,
    fetchProjects,
    fetchTimeEntries,
    fetchWorkPackages,
    timesheetStatuses,
    businessActivities,
    languages,
    currentLanguage,
    isLoadingStatuses,
    isLoadingActivities,
    isLoadingLanguages,
    fetchTimesheetStatuses,
    fetchBusinessActivities,
    fetchLanguages,
    setCurrentLanguage: setCurrentLanguageWithPersistence,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,
    loadStoredCredentials,
    disconnect,
    workPackagesByProject,
    getWorkPackageName,
    setCurrentBexioUserId,
    setIsCurrentUserAdmin,
  };
};

export type { BexioUser, Contact, Project, TimeEntry, WorkPackage };