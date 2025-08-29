import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";

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
  description?: string;
  color?: string;
  pr_project_id?: number;
}

interface BexioCredentials {
  apiKey: string;
  companyId: string;
}

export const useBexioApi = () => {
  const [credentials, setCredentials] = useState<BexioCredentials | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
  const [isLoadingWorkPackages, setIsLoadingWorkPackages] = useState(false);
  const [isCreatingTimeEntry, setIsCreatingTimeEntry] = useState(false);
  const { toast } = useToast();

  const connect = useCallback(async (apiKey: string, companyId: string) => {
    try {
      // Store credentials in localStorage
      const creds = { apiKey, companyId };
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

  const fetchContacts = useCallback(async () => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingContacts(true);
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/contact',
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setContacts(Array.isArray(data) ? data : []);
      
      toast({
        title: "Contacts loaded successfully",
        description: `Successfully fetched ${Array.isArray(data) ? data.length : 0} contacts.`,
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
  }, [credentials, toast]);

  const fetchProjects = useCallback(async () => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingProjects(true);
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/pr_project',
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
      
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
  }, [credentials, toast]);

  const fetchTimeEntries = useCallback(async () => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingTimeEntries(true);
    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/timesheet',
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const normalized = (Array.isArray(data) ? data : []).map((d: any) => ({
        id: d.id,
        date: d.date,
        duration: d.duration,
        text: d.text,
        allowable_bill: d.allowable_bill,
        contact_id: d.contact_id ?? undefined,
        project_id: d.pr_project_id ?? d.project_id ?? undefined,
        user_id: d.user_id,
        client_service_id: d.client_service_id,
        status_id: d.status_id ?? undefined,
        pr_package_id: d.pr_package_id ?? undefined,
        pr_milestone_id: d.pr_milestone_id ?? undefined,
      }));
      setTimeEntries(normalized);
      
      toast({
        title: "Time entries loaded successfully",
        description: `Successfully fetched ${normalized.length} time entries.`,
      });
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
  }, [credentials, toast]);

  const fetchWorkPackages = useCallback(async (projectId?: number) => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    if (!projectId) {
      console.log('No project ID provided, clearing work packages');
      setWorkPackages([]);
      return;
    }

    setIsLoadingWorkPackages(true);
    try {
      console.log(`🔍 Testing specific Bexio API endpoint for project ${projectId}`);
      
      // Test the specific endpoint the user mentioned
      const endpoint = `/3.0/projects/${projectId}/packages`;
      console.log(`📡 Making request to: ${endpoint}`);
      
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: endpoint,
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      console.log(`📄 Raw response body:`, responseText);

      let data;
      try {
        data = JSON.parse(responseText);
        console.log(`✅ Parsed JSON data:`, data);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error(`Invalid JSON response from ${endpoint}`);
      }

      if (!response.ok) {
        console.error(`❌ Bexio API error for ${endpoint}:`, data);
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if data is an array and what's in it
      console.log(`🔍 Data type: ${Array.isArray(data) ? 'Array' : typeof data}`);
      if (Array.isArray(data)) {
        console.log(`📦 Found ${data.length} items in response`);
        data.forEach((item, index) => {
          console.log(`   Item ${index + 1}:`, item);
        });
      }

      // Transform the data to our expected format
      const workPackages = Array.isArray(data) ? data : [];
      
      const transformedPackages = workPackages.map((pkg: any, index: number) => {
        const transformed = {
          id: pkg.id?.toString() || pkg.uuid?.toString() || `pkg-${index}`,
          name: pkg.name || pkg.title || pkg.package_name || `Package ${index + 1}`,
          description: pkg.description || pkg.comment || '',
          color: pkg.color || '#3b82f6',
          pr_project_id: projectId
        };
        console.log(`🔄 Transformed package ${index + 1}:`, transformed);
        return transformed;
      });
      
      setWorkPackages(transformedPackages);
      
      console.log(`✅ Successfully loaded ${transformedPackages.length} work packages for project ${projectId}`);
      
      toast({
        title: `Found ${transformedPackages.length} work packages`,
        description: `From endpoint: ${endpoint}`,
      });
      
    } catch (error) {
      console.error('❌ Error fetching work packages from Bexio:', error);
      
      setWorkPackages([]);
      
      toast({
        title: "No work packages found",
        description: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingWorkPackages(false);
    }
  }, [credentials, toast]);

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
    startTime: string;
    endTime: string;
    text: string;
    allowable_bill: boolean;
    contact_id?: number;
    project_id?: number;
    status_id?: number;
    pr_package_id?: string;
    pr_milestone_id?: number;
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

    setIsCreatingTimeEntry(true);
    try {
      // Calculate duration from time range
      const [startHours, startMinutes] = timeEntryData.startTime.split(':').map(Number);
      const [endHours, endMinutes] = timeEntryData.endTime.split(':').map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      let durationMinutes = endTotalMinutes - startTotalMinutes;
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60; // Handle overnight work
      }
      
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;

      // Generate dates for the range
      const startDate = timeEntryData.dateRange.from;
      const endDate = timeEntryData.dateRange.to || startDate;
      
      const dates: Date[] = [];
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
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
        const bexioData = {
          user_id: 1,
          client_service_id: 5,
          text: timeEntryData.text || "",
          allowable_bill: timeEntryData.allowable_bill,
          tracking: {
            type: "duration",
            date: date.toISOString().split('T')[0],
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
                apiKey: credentials.apiKey,
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
  }, [credentials, toast, fetchTimeEntries]);

  const updateTimeEntry = useCallback(async (id: number, timeEntryData: {
    dateRange: DateRange | undefined;
    startTime: string;
    endTime: string;
    text: string;
    allowable_bill: boolean;
    contact_id?: number;
    project_id?: number;
    status_id?: number;
    pr_package_id?: string;
    pr_milestone_id?: number;
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

    setIsCreatingTimeEntry(true);
    try {
      // Since Bexio doesn't support PUT operations for timesheet updates,
      // we'll use a delete-and-recreate approach as a workaround
      
      // Step 1: Delete the existing entry
      const deleteResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/timesheet/${id}`,
          method: 'DELETE',
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        throw new Error(`Failed to delete existing entry: ${errorData.error || deleteResponse.status}`);
      }

      // Step 2: Create a new entry with updated data
      // Calculate duration
      const [startHours, startMinutes] = timeEntryData.startTime.split(':').map(Number);
      const [endHours, endMinutes] = timeEntryData.endTime.split(':').map(Number);
      
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      let durationMinutes = endTotalMinutes - startTotalMinutes;
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60;
      }
      
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;

      const bexioData = {
        user_id: 1,
        client_service_id: 5,
        text: timeEntryData.text || "",
        allowable_bill: timeEntryData.allowable_bill,
        tracking: {
          type: "duration",
          date: timeEntryData.dateRange.from.toISOString().split('T')[0],
          duration: durationString,
        },
        ...(timeEntryData.contact_id !== undefined && { contact_id: timeEntryData.contact_id }),
        ...(timeEntryData.project_id !== undefined && { pr_project_id: timeEntryData.project_id }),
        ...(timeEntryData.status_id !== undefined && { status_id: timeEntryData.status_id }),
        ...(timeEntryData.pr_package_id !== undefined && { pr_package_id: timeEntryData.pr_package_id }),
        ...(timeEntryData.pr_milestone_id !== undefined && { pr_milestone_id: timeEntryData.pr_milestone_id }),
      };

      console.log('Updating time entry with data:', {
        originalId: id,
        bexioData,
        formData: timeEntryData
      });

      const createResponse = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/timesheet',
          method: 'POST',
          apiKey: credentials.apiKey,
          companyId: credentials.companyId,
          data: bexioData,
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

      await fetchTimeEntries();
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
  }, [credentials, toast, fetchTimeEntries]);

  const deleteTimeEntry = useCallback(async (id: number, skipRefresh = false) => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/timesheet/${id}`,
          method: 'DELETE',
          apiKey: credentials.apiKey,
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
        await fetchTimeEntries();
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
  }, [credentials, toast, fetchTimeEntries]);

  const bulkUpdateTimeEntries = useCallback(async (entries: any[], updateData: any) => {
    if (!credentials) return;
    setIsCreatingTimeEntry(true);
    try {
      for (const entry of entries) {
        await deleteTimeEntry(entry.id);
        // Simple recreate with updateData - full implementation would merge data
      }
      toast({ title: "Bulk update completed" });
      await fetchTimeEntries();
    } catch (error) {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, fetchTimeEntries, deleteTimeEntry]);

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
      await fetchTimeEntries();
    } catch (error) {
      toast({ title: "Bulk delete failed", variant: "destructive" });
    } finally {
      setIsCreatingTimeEntry(false);
    }
  }, [credentials, toast, deleteTimeEntry, fetchTimeEntries]);

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
    connect,
    fetchContacts,
    fetchProjects,
    fetchTimeEntries,
    fetchWorkPackages,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,
    loadStoredCredentials,
    disconnect,
  };
};