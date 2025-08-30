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
      <div className="min-h-screen overflow-hidden relative">
        {/* Curved Background Split */}
        <div className="absolute inset-0">
          {/* Left curved section */}
          <div 
            className="absolute inset-0 bg-[var(--gradient-hero)]"
            style={{
              clipPath: 'polygon(0% 0%, 65% 0%, 45% 100%, 0% 100%)'
            }}
          />
        </div>

        <div className="relative z-10 grid lg:grid-cols-2 min-h-screen">
          {/* Left Side - Hero */}
          <div className="flex flex-col justify-center px-8 lg:px-16 text-white">
            <div className="max-w-md">
              {/* Logo */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">
                      <span className="text-white">data</span>
                      <span className="text-accent">bridge</span>
                    </h1>
                    <p className="text-white/80 text-sm">Smart & simple time-tracking</p>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-6 leading-tight">
                Wahrscheinlich die beste Zeiterfassungs-App für bexio.
              </h2>

              <BexioConnector 
                onConnect={connect} 
                onOAuthConnect={connectWithOAuth}
                isConnected={isConnected} 
              />
            </div>
          </div>

          {/* Right Side - Features */}
          <div className="flex flex-col justify-center px-8 lg:px-16 bg-white">
            <div className="max-w-lg">
              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-title mb-2">Arbeitszeit</h3>
                  <p className="text-sm text-muted-foreground">Erfassen Sie Ihre tägliche Arbeitszeit in weniger als einer Minute.</p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-primary-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-title mb-2">Projekt Arbeit</h3>
                  <p className="text-sm text-muted-foreground">Erfassen Sie Ihre Zeit für Projekte. Verwalten Sie Projekte einfach.</p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-primary-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-title mb-2">Absenzen & Ferien</h3>
                  <p className="text-sm text-muted-foreground">Erfassen Sie Ihre Abwesenheiten wie Ferien, Krankheit, Militär und mehr.</p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-primary-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-title mb-2">Analyse & Reporting</h3>
                  <p className="text-sm text-muted-foreground">Sehen Sie, wie Ihr Team Zeit, Geld und Ressourcen einsetzt.</p>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-primary-subtle/20 rounded-xl p-6 border border-primary-subtle">
                <h3 className="text-2xl font-bold text-accent mb-2">PREIS</h3>
                <p className="text-sm text-muted-foreground mb-4">Kostenlos testen - ohne Kreditkarte</p>
                
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">CHF</span>
                  <span className="text-4xl font-bold text-title">8.40</span>
                  <span className="text-sm text-muted-foreground">Pro Benutzer (CHF 84.- jährlich abgerechnet)</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Kontaktieren sie uns bei einer grösseren Anzahl Benutzer</span>
                </div>
              </div>
            </div>
          </div>
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
                onClick={() => {
                  // Clear all localStorage items that might persist
                  localStorage.removeItem('bexio_access_token');
                  localStorage.removeItem('bexio_refresh_token');
                  localStorage.removeItem('bexio_company_id');
                  localStorage.removeItem('bexio_user_email');
                  localStorage.removeItem('bexio_oauth_success');
                  localStorage.removeItem('bexio_oauth_ready');
                  
                  disconnect();
                  window.location.reload(); // Force page reload to clear state
                }}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Re-authenticate
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
