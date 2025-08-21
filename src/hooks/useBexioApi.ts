import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";

interface Customer {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  salutation?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  address?: string;
  postcode?: string;
  city?: string;
  country_id?: number;
  language_id?: number;
  contact_type_id: number;
  customer_type?: string;
  is_lead?: boolean;
  birthday?: string;
  contact_group_ids?: number[];
  user_id?: number;
  owner_id?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

interface TimeEntry {
  id: number;
  date: string;
  duration: number;
  text?: string;
  allowable_bill: boolean;
  contact_id?: number;
  project_id?: number;
  user_id?: number;
  client_service_id?: number;
}

interface BexioCredentials {
  apiKey: string;
  companyId: string;
}

export const useBexioApi = () => {
  const [credentials, setCredentials] = useState<BexioCredentials | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(false);
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

  const fetchCustomers = useCallback(async () => {
    if (!credentials) {
      toast({
        title: "Not connected",
        description: "Please connect to Bexio first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingCustomers(true);
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
      setCustomers(Array.isArray(data) ? data : []);
      
      toast({
        title: "Contacts loaded successfully",
        description: `Successfully fetched ${Array.isArray(data) ? data.length : 0} contacts.`,
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Failed to fetch customers",
        description: error instanceof Error ? error.message : "An error occurred while fetching customers.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCustomers(false);
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
      setTimeEntries(Array.isArray(data) ? data : []);
      
      toast({
        title: "Time entries loaded successfully",
        description: `Successfully fetched ${Array.isArray(data) ? data.length : 0} time entries.`,
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

      // Create time entries for each date
      const promises = dates.map(async (date) => {
        const bexioData = {
          user_id: 1, // Default user ID, might need to be dynamic
          client_service_id: 5, // Default service ID (from existing data)
          text: timeEntryData.text || "",
          allowable_bill: timeEntryData.allowable_bill,
          tracking: {
            type: "duration",
            date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
            duration: durationString, // Format as HH:MM
          },
          ...(timeEntryData.contact_id && { contact_id: timeEntryData.contact_id }),
          ...(timeEntryData.project_id && { pr_project_id: timeEntryData.project_id }),
        };

        const response = await fetch(`https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy`, {
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${response.status} for date ${date.toISOString().split('T')[0]}`);
        }

        return response.json();
      });

      const results = await Promise.all(promises);
      
      toast({
        title: "Time entries created",
        description: `Successfully created ${results.length} time entries for the selected date range.`,
      });

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

  const disconnect = useCallback(() => {
    localStorage.removeItem('bexio_credentials');
    setCredentials(null);
    setCustomers([]);
    setTimeEntries([]);
    toast({
      title: "Disconnected",
      description: "You have been disconnected from Bexio.",
    });
  }, [toast]);

  return {
    credentials,
    customers,
    timeEntries,
    isLoadingCustomers,
    isLoadingTimeEntries,
    isCreatingTimeEntry,
    isConnected: !!credentials,
    connect,
    fetchCustomers,
    fetchTimeEntries,
    createTimeEntry,
    loadStoredCredentials,
    disconnect,
  };
};