import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type_id: number;
  customer_type?: string;
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
      // Use CORS proxy to avoid browser CORS restrictions
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const targetUrl = encodeURIComponent('https://api.bexio.com/2.0/contact');
      
      const response = await fetch(`${proxyUrl}${targetUrl}`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Try alternative approach if proxy fails
        if (response.status === 404 || response.status === 500) {
          throw new Error(`CORS Error: Direct API access blocked by browser. Status: ${response.status}`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
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
      // Use CORS proxy to avoid browser CORS restrictions
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const targetUrl = encodeURIComponent('https://api.bexio.com/2.0/timesheet');
      
      const response = await fetch(`${proxyUrl}${targetUrl}`, {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          throw new Error(`CORS Error: Direct API access blocked by browser. Status: ${response.status}`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
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
    isConnected: !!credentials,
    connect,
    fetchCustomers,
    fetchTimeEntries,
    loadStoredCredentials,
    disconnect,
  };
};