
import { Analytics } from "@/components/Analytics";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ContactList } from "@/components/ContactList";
import { ProjectList } from "@/components/ProjectList";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { TimeTrackingGrid } from "@/components/TimeTrackingGrid";
import { LoginPage } from "@/components/LoginPage";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut, Users, FolderOpen, BarChart3, CheckCircle2, Loader2, Grid, List } from "lucide-react";
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
    hasInitiallyLoaded,
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

  const [activeTab, setActiveTab] = useState("timetracking");
  const [timeTrackingView, setTimeTrackingView] = useState<'grid' | 'list'>('grid');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStoredCredentials();
  }, [loadStoredCredentials]);

  useEffect(() => {
    // Auto-fetch contacts and projects when switching to Time Tracking or Analytics
    // Only fetch if we haven't loaded initially and not currently loading
    if (activeTab === "timetracking" || activeTab === "analytics") {
      if (contacts.length === 0 && !isLoadingContacts && !hasInitiallyLoaded.contacts) {
        fetchContacts();
      }
      if (projects.length === 0 && !isLoadingProjects && !hasInitiallyLoaded.projects) {
        fetchProjects();
      }
      if (timeEntries.length === 0 && !isLoadingTimeEntries && !hasInitiallyLoaded.timeEntries) {
        fetchTimeEntries(undefined, { quiet: true });
      }
    }
  }, [activeTab, hasInitiallyLoaded, isLoadingContacts, isLoadingProjects, isLoadingTimeEntries, fetchContacts, fetchProjects, fetchTimeEntries]);

  const handleRefresh = () => {
    if (activeTab === "contacts") {
      fetchContacts();
    } else if (activeTab === "projects") {
      fetchProjects();
    } else if (activeTab === "analytics" || activeTab === "timetracking") {
      fetchTimeEntries(undefined, { quiet: false });
      fetchContacts();
      fetchProjects();
    }
  };

  const testApiConnection = async () => {
    if (!credentials) return;
    
    setIsTestingConnection(true);
    try {
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
      <LoginPage 
        onConnect={connect}
        onOAuthConnect={connectWithOAuth}
        isConnected={isConnected}
      />
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
            <TabsTrigger value="timetracking" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
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
          </TabsList>

          <TabsContent value="timetracking" className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-semibold">Time Tracking</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant={timeTrackingView === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('grid')}
                    className="gap-2"
                  >
                    <Grid className="h-4 w-4" />
                    Grid View
                  </Button>
                  <Button
                    variant={timeTrackingView === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('list')}
                    className="gap-2"
                  >
                    <List className="h-4 w-4" />
                    List View
                  </Button>
                </div>
              </div>
            </div>

            {timeTrackingView === 'grid' ? (
              <TimeTrackingGrid
                timeEntries={timeEntries}
                contacts={contacts}
                projects={projects}
                workPackages={workPackages}
                onCreateTimeEntry={createTimeEntry}
                onUpdateTimeEntry={updateTimeEntry}
                onDeleteTimeEntry={deleteTimeEntry}
                onDateRangeChange={(range) => fetchTimeEntries(range, { quiet: true })}
                isLoading={isLoadingTimeEntries}
              />
            ) : (
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
            )}
          </TabsContent>

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
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
