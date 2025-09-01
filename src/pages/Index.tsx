
import { Analytics } from "@/components/Analytics";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { SimpleTimeGrid } from "@/components/SimpleTimeGrid";
import { TimesheetCalendar } from "@/components/TimesheetCalendar";
import { TimeEntryDialog } from "@/components/TimeEntryDialog";
import { EditTimeEntryDialog } from "@/components/EditTimeEntryDialog";
import { LoginPage } from "@/components/LoginPage";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut, BarChart3, CheckCircle2, Grid, List, CalendarDays, Edit3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    fetchLanguages,
    languages,
    currentLanguage,
    setCurrentLanguage,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,
    loadStoredCredentials,
    disconnect,
  } = useBexioApi();

  const [activeTab, setActiveTab] = useState("timetracking");
  const [timeTrackingView, setTimeTrackingView] = useState<'list' | 'grid' | 'calendar'>('list');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem('adminLogoUrl') || 'https://cdn.prod.website-files.com/644a6e413354d12887abce48/678e77dc82ed84dfe2ede9f8_db%20icon%20(1).png');
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState<string>(logoUrl);
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
        // Default to current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        fetchTimeEntries({ from: startOfMonth, to: endOfMonth }, { quiet: true });
      }
      if (languages.length === 0) {
        fetchLanguages();
      }
    }
  }, [activeTab, hasInitiallyLoaded, isLoadingContacts, isLoadingProjects, isLoadingTimeEntries, fetchContacts, fetchProjects, fetchTimeEntries]);

  const handleRefresh = () => {
    if (activeTab === "analytics" || activeTab === "timetracking") {
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
              <img src={logoUrl} alt="App logo" className="h-8 w-8 rounded-md" />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Connection status indicator */}
              <div className="group relative">
                <div className="p-2 rounded-full bg-success/10 border border-success/20 hover:bg-success/20 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                  <div className="text-sm">
                    <p className="font-medium text-title mb-1">Connected to Bexio</p>
                    <p className="text-muted-foreground">
                      {credentials?.authType === 'oauth' ? 'OAuth Connection' : 'API Key Connection'}
                    </p>
                    <p className="text-muted-foreground">
                      Company ID: {credentials?.companyId}
                    </p>
                  </div>
                </div>
              </div>
              
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

      <main className="container mx-auto px-4 py-8">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="timetracking" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Time Tracking
              </TabsTrigger>
            </TabsList>
            
            {/* View Toggle - only show when on timetracking tab */}
            {activeTab === "timetracking" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={timeTrackingView === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('list')}
                    className="gap-2"
                  >
                    <List className="h-4 w-4" />
                    List View
                  </Button>
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
                    variant={timeTrackingView === 'calendar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('calendar')}
                    className="gap-2"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Calendar
                  </Button>
                </div>
                
                {/* Language Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Language:</label>
                  <Select value={currentLanguage} onValueChange={setCurrentLanguage}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      {languages.map((lang) => (
                        <SelectItem key={lang.id} value={lang.iso_639_1}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Add Time Entry button */}
                <TimeEntryDialog
                  onSubmit={createTimeEntry}
                  isSubmitting={isCreatingTimeEntry}
                  contacts={contacts}
                  projects={projects}
                  workPackages={workPackages}
                  isLoadingWorkPackages={isLoadingWorkPackages}
                  onFetchWorkPackages={fetchWorkPackages}
                  initialData={calendarInitialData}
                  buttonText="Add Time Entry"
                  buttonSize="sm"
                />
              </div>
            )}
          </div>

          <TabsContent value="timetracking" className="space-y-6">
            {timeTrackingView === 'list' ? (
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
            ) : timeTrackingView === 'grid' ? (
              <SimpleTimeGrid
                timeEntries={timeEntries}
                projects={projects}
                onCreateTimeEntry={createTimeEntry}
                onUpdateTimeEntry={updateTimeEntry}
                onDeleteTimeEntry={deleteTimeEntry}
                onDateRangeChange={(range) => fetchTimeEntries(range, { quiet: true })}
                isLoading={isLoadingTimeEntries}
                workPackages={workPackages}
                isLoadingWorkPackages={isLoadingWorkPackages}
                onFetchWorkPackages={fetchWorkPackages}
              />
            ) : (
              <TimesheetCalendar
                timeEntries={timeEntries}
                isLoading={isLoadingTimeEntries}
                onEditEntry={setEditingEntry}
                onCreateEntry={(date) => {
                  setCalendarInitialData({
                    dateRange: { from: date, to: date },
                    startTime: "09:00",
                    endTime: "17:00",
                    text: "",
                    allowable_bill: true,
                  });
                }}
                onDeleteEntry={async (id) => {
                  if (window.confirm('Are you sure you want to delete this time entry?')) {
                    await deleteTimeEntry(id);
                  }
                }}
              />
            )}

            {/* Edit Dialog */}
            {editingEntry && (
              <EditTimeEntryDialog
                entry={editingEntry}
                isOpen={!!editingEntry}
                onClose={() => setEditingEntry(null)}
                onSubmit={async (id, data) => {
                  await updateTimeEntry(id, data);
                  setEditingEntry(null);
                }}
                contacts={contacts}
                projects={projects}
                workPackages={workPackages}
                isLoadingWorkPackages={isLoadingWorkPackages}
                onFetchWorkPackages={fetchWorkPackages}
                isSubmitting={false}
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
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
