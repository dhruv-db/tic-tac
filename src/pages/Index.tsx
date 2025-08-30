import { Analytics } from "@/components/Analytics";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BexioConnector } from "@/components/BexioConnector";
import { ContactList } from "@/components/ContactList";
import { ProjectList } from "@/components/ProjectList";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut, Users, FolderOpen, BarChart3, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const {
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
    isConnected,
    connect,
    connectWithOAuth,
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
  } = useBexioApi();

  const [activeTab, setActiveTab] = useState("analytics");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStoredCredentials();
  }, [loadStoredCredentials]);

  useEffect(() => {
    console.log('🎧 Setting up OAuth message listeners... isConnected:', isConnected);
    
    // Pickup OAuth payload if this window was opened via redirect (popup flows)
    try {
      const wname = (window as Window).name;
      if (wname && typeof wname === 'string' && wname.startsWith('BEXIO_OAUTH:')) {
        console.log('📦 Found OAuth payload in window.name on app load');
        const raw = decodeURIComponent(wname.slice('BEXIO_OAUTH:'.length));
        const data = JSON.parse(raw);
        localStorage.setItem('bexio_oauth_success', JSON.stringify(data));
        localStorage.setItem('bexio_oauth_ready', 'true');
        try { (window as any).name = ''; } catch (_) {}
        // Immediately connect without waiting for polling
        const { accessToken, refreshToken, companyId, userEmail } = data.credentials || {};
        if (accessToken) {
          console.log('🚀 Connecting immediately using window.name payload');
          connectWithOAuth(accessToken, refreshToken, companyId, userEmail);
        }
      }
    } catch (e) {
      console.warn('Failed to read window.name OAuth payload:', e);
    }
    
    // Check if we just returned from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth_success') === 'true') {
      console.log('🔄 Returned from OAuth, checking for credentials...');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const onMessage = (event: MessageEvent) => {
      try {
        console.log('📨 Message received in main app:', event.data, 'from origin:', event.origin);
        // Accept messages from any origin for OAuth (since popup comes from Supabase domain)
        const data = typeof (event as any).data === 'string' ? JSON.parse((event as any).data) : (event as any).data;
        if (data?.type === 'BEXIO_OAUTH_SUCCESS' && !isConnected) {
          console.log('🎉 BEXIO_OAUTH_SUCCESS detected! Processing...');
          const { accessToken, refreshToken, companyId, userEmail } = data.credentials || {};
          console.log('📋 Extracted credentials:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, companyId, userEmail });
          console.log('🚀 Calling connectWithOAuth...');
          connectWithOAuth(accessToken, refreshToken, companyId, userEmail);
          
          // Send ACK back to popup to confirm receipt
          try {
            const popup = Array.from(window.frames).find(frame => {
              try {
                return frame !== window;
              } catch (e) {
                return false;
              }
            });
            if (event.source && typeof event.source.postMessage === 'function') {
              (event.source as Window).postMessage({ type: 'BEXIO_OAUTH_ACK' }, event.origin === 'null' ? '*' : event.origin);
              console.log('✅ Sent ACK back to popup');
            }
          } catch (ackErr) {
            console.warn('⚠️ Failed to send ACK:', ackErr);
          }
        } else {
          console.log('ℹ️ Message ignored:', { 
            type: data?.type, 
            isOAuthSuccess: data?.type === 'BEXIO_OAUTH_SUCCESS',
            isConnected: isConnected,
            shouldProcess: data?.type === 'BEXIO_OAUTH_SUCCESS' && !isConnected
          });
        }
      } catch (e) {
        console.error('❌ Failed to handle OAuth message at app level:', e);
      }
    };

    // Primary method: Check localStorage for OAuth success
    const checkLocalStorage = () => {
      try {
        // Check for ready flag first (faster)
        const ready = localStorage.getItem('bexio_oauth_ready');
        if (ready && !isConnected) {
          const stored = localStorage.getItem('bexio_oauth_success');
          if (stored) {
            console.log('🎉 Found OAuth success in localStorage!');
            const data = JSON.parse(stored);
            console.log('📋 Parsed OAuth data:', data);
            const { accessToken, refreshToken, companyId, userEmail } = data.credentials || {};
            console.log('🚀 Calling connectWithOAuth from localStorage...');
            connectWithOAuth(accessToken, refreshToken, companyId, userEmail);
            
            // Clean up
            localStorage.removeItem('bexio_oauth_success');
            localStorage.removeItem('bexio_oauth_ready');
            console.log('🧹 Cleaned up localStorage');
            return true;
          }
        }
        return false;
      } catch (e) {
        console.error('❌ Failed to check localStorage for OAuth:', e);
        return false;
      }
    };

    window.addEventListener('message', onMessage);
    console.log('👂 Added message listener (backup method)');
    
    // Primary method: Check localStorage immediately and frequently
    console.log('🔍 Starting localStorage checks...');
    if (checkLocalStorage()) return; // Exit early if found immediately
    
    const interval = setInterval(() => {
      if (checkLocalStorage()) {
        clearInterval(interval);
      }
    }, 250); // Check every 250ms for faster response
    
    setTimeout(() => {
      clearInterval(interval);
      console.log('⏰ Stopped localStorage polling after 15 seconds');
    }, 15000); // Extended timeout

    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(interval);
      console.log('🧹 Cleaned up OAuth listeners');
    };
  }, [isConnected, connectWithOAuth]);

  useEffect(() => {
    // Auto-fetch contacts and projects when switching to Time Tracking or Analytics
    if (activeTab === "timetracking" || activeTab === "analytics") {
      if (contacts.length === 0 && !isLoadingContacts) fetchContacts();
      if (projects.length === 0 && !isLoadingProjects) fetchProjects();
      if (timeEntries.length === 0 && !isLoadingTimeEntries) fetchTimeEntries();
    }
  }, [activeTab, contacts.length, projects.length, timeEntries.length, isLoadingContacts, isLoadingProjects, isLoadingTimeEntries, fetchContacts, fetchProjects, fetchTimeEntries]);

  const handleRefresh = () => {
    if (activeTab === "contacts") {
      fetchContacts();
    } else if (activeTab === "projects") {
      fetchProjects();
    } else if (activeTab === "analytics" || activeTab === "timetracking") {
      fetchTimeEntries();
      fetchContacts();
      fetchProjects();
    }
  };

  const testApiConnection = async () => {
    if (!credentials) return;
    
    setIsTestingConnection(true);
    try {
      // Make a simple API call to test the connection and authorization header
      const response = await fetch('https://opcjifbdwpyttaxqlqbf.supabase.co/functions/v1/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/company_profile',
          apiKey: credentials.authType === 'oauth' ? credentials.accessToken : credentials.apiKey,
          companyId: credentials.companyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      toast({
        title: "✅ API Connection Test Successful",
        description: `Connected to company: ${data.name || 'Unknown'} (ID: ${data.id || 'N/A'})`,
      });
      
      console.log('🎯 API Test Response:', data);
      
    } catch (error) {
      console.error('❌ API Test Error:', error);
      toast({
        title: "❌ API Connection Test Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Bexio API",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const isLoading = isLoadingContacts || isLoadingProjects || isLoadingTimeEntries;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 p-4 rounded-full bg-primary-subtle w-fit">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Databridge Analytics
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Connect to your Bexio account to access business intelligence and time tracking analytics
            </p>
          </div>
          <BexioConnector 
            onConnect={connect} 
            onOAuthConnect={connectWithOAuth}
            isConnected={isConnected} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-subtle">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  <span className="databridge-brand">data</span>
                  <span className="databridge-accent">^</span>
                  <span className="databridge-brand">bridge</span>
                  <span className="text-muted-foreground text-lg ml-2">Analytics</span>
                </h1>
                <p className="text-sm text-muted-foreground">Business Intelligence Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Test Authentication Button */}
        <div className="mb-8 p-4 bg-primary-subtle/20 rounded-lg border border-primary-subtle">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-title flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Test API Connection
              </h3>
              <p className="text-sm text-muted-foreground">Verify your access token is working with a test API call</p>
            </div>
            <Button 
              onClick={testApiConnection}
              disabled={isTestingConnection}
              variant="outline"
              className="border-primary hover:bg-primary hover:text-white transition-colors"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-4 mx-auto">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="timetracking" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <Analytics 
              timeEntries={timeEntries}
              contacts={contacts}
              projects={projects}
              isLoading={isLoadingTimeEntries}
            />
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            {contacts.length === 0 && !isLoadingContacts ? (
              <div className="text-center py-12">
                <Button onClick={fetchContacts} className="gap-2">
                  <Users className="h-4 w-4" />
                  Load Contacts
                </Button>
              </div>
            ) : (
              <ContactList contacts={contacts} isLoading={isLoadingContacts} />
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            {projects.length === 0 && !isLoadingProjects ? (
              <div className="text-center py-12">
                <Button onClick={fetchProjects} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Load Projects
                </Button>
              </div>
            ) : (
              <ProjectList projects={projects} isLoading={isLoadingProjects} />
            )}
          </TabsContent>

          <TabsContent value="timetracking" className="space-y-6">
            <TimeTrackingList 
              timeEntries={timeEntries} 
              isLoading={isLoadingTimeEntries}
              onCreateTimeEntry={createTimeEntry}
              onUpdateTimeEntry={updateTimeEntry}
              onDeleteTimeEntry={deleteTimeEntry}
              onBulkUpdateTimeEntries={bulkUpdateTimeEntries}
              onBulkDeleteTimeEntries={bulkDeleteTimeEntries}
              isCreatingTimeEntry={isCreatingTimeEntry}
              contacts={contacts}
              projects={projects}
              workPackages={workPackages}
              isLoadingWorkPackages={isLoadingWorkPackages}
              onFetchWorkPackages={fetchWorkPackages}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
