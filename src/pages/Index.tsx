
import { Analytics } from "@/components/Analytics";
import { LanguageFlag } from "@/components/LanguageFlag";
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { SimpleTimeGrid } from "@/components/SimpleTimeGrid";
import { TimesheetCalendar } from "@/components/TimesheetCalendar";
import { TimeEntryDialog } from "@/components/TimeEntryDialog";
import { EditTimeEntryDialog } from "@/components/EditTimeEntryDialog";
import { LoginPage } from "@/components/LoginPage";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut, BarChart3, CheckCircle2, Grid, List, CalendarDays, Edit3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    credentials,
    contacts,
    projects,
    timeEntries,
    workPackages,
    users,
    isLoadingContacts,
    isLoadingProjects,
    isLoadingTimeEntries,
    isLoadingWorkPackages,
    isLoadingUsers,
    isCreatingTimeEntry,
    isConnected,
    hasInitiallyLoaded,
    currentBexioUserId,
    isCurrentUserAdmin,
    connect,
    connectWithOAuth,
    fetchContacts,
    fetchProjects,
    fetchTimeEntries,
    fetchWorkPackages,
    fetchUsers,
    fetchLanguages,
    fetchTimesheetStatuses,
    fetchBusinessActivities,
    languages,
    currentLanguage,
    setCurrentLanguage,
    setCurrentBexioUserId,
    setIsCurrentUserAdmin,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,
    loadStoredCredentials,
    disconnect,
    timesheetStatuses,
    businessActivities,
    workPackagesByProject,
    getWorkPackageName,
  } = useBexioApi();

  const [activeTab, setActiveTab] = useState("timetracking");
  const [timeTrackingView, setTimeTrackingView] = useState<'list' | 'grid' | 'calendar'>('list');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem('adminLogoUrl') || (import.meta.env.VITE_DEFAULT_LOGO_URL || 'https://cdn.prod.website-files.com/644a6e413354d12887abce48/678e77dc82ed84dfe2ede9f8_db%20icon%20(1).png'));
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState<string>(logoUrl);
  const [selectedUserId, setSelectedUserId] = useState<number | "all" | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();


  // Set default user filter to current user when available
  useEffect(() => {
    if (typeof currentBexioUserId === 'number' && selectedUserId === null) {
      setSelectedUserId(currentBexioUserId);
    }
  }, [currentBexioUserId, selectedUserId]);

  useEffect(() => {
    loadStoredCredentials();
  }, []); // Remove loadStoredCredentials from dependency array since it's now async

  // Handle OAuth callback from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const companyId = params.get('company_id');
    const userEmail = params.get('user_email');

    if (accessToken && refreshToken && companyId) {
      console.log('🔗 Detected OAuth tokens in URL, connecting...');
      connectWithOAuth(accessToken, refreshToken, companyId, userEmail || '');

      // Clean up URL by removing the parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [location.search, connectWithOAuth]);

  useEffect(() => {
    // Guard: Only auto-fetch when connected to prevent errors before login
    if (!isConnected) return;

    // Auto-fetch contacts, projects, and users when switching to Time Tracking or Analytics
    // Only fetch if we haven't loaded initially and not currently loading
    if (activeTab === "timetracking" || activeTab === "analytics") {
      if (contacts.length === 0 && !isLoadingContacts && !hasInitiallyLoaded.contacts) {
        fetchContacts();
      }
      if (projects.length === 0 && !isLoadingProjects && !hasInitiallyLoaded.projects) {
        fetchProjects();
      }
      if (users.length === 0 && !isLoadingUsers && !hasInitiallyLoaded.users) {
        fetchUsers();
      }
      if (timeEntries.length === 0 && !isLoadingTimeEntries && !hasInitiallyLoaded.timeEntries) {
        // Default to last 3 months on mobile for faster loading, 6 months on desktop
        const now = new Date();
        const monthsBack = window.innerWidth < 768 ? 3 : 6; // Mobile optimization
        const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        fetchTimeEntries({ from: startDate, to: endOfCurrentMonth }, { quiet: true }, currentBexioUserId || undefined);
      }
      if (languages.length === 0) {
        fetchLanguages();
      }
    }
  }, [activeTab, hasInitiallyLoaded, isLoadingContacts, isLoadingProjects, isLoadingTimeEntries, isLoadingUsers, fetchContacts, fetchProjects, fetchTimeEntries, fetchUsers, languages.length, isConnected]);

  const handleRefresh = () => {
    if (activeTab === "analytics" || activeTab === "timetracking") {
      fetchTimeEntries(undefined, { quiet: false }, currentBexioUserId || undefined);
      fetchContacts();
      fetchProjects();
      fetchUsers();
    }
  };

  const testApiConnection = async () => {
    if (!credentials) return;
    
    setIsTestingConnection(true);
    try {
      const response = await fetch('http://localhost:3001/api/bexio-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/company_profile',
          accessToken: credentials.authType === 'oauth' ? credentials.accessToken : credentials.apiKey,
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

  // Filter time entries based on admin status and selected user
  const visibleTimeEntries = useMemo(() => {
    if (!isCurrentUserAdmin) {
      // Non-admin users only see their own entries
      return (timeEntries || []).filter(entry => entry.user_id === currentBexioUserId);
    }

    // Admin users - fix "All users" filtering
    if (selectedUserId !== null && selectedUserId !== "all" && typeof selectedUserId === 'number') {
      // Specific user selected - show only their entries
      return (timeEntries || []).filter(entry => entry.user_id === selectedUserId);
    } else {
      // "All users" or no selection - show all entries
      return timeEntries || [];
    }
  }, [timeEntries, isCurrentUserAdmin, currentBexioUserId, selectedUserId]);

  const isLoading = isLoadingContacts || isLoadingProjects || isLoadingTimeEntries;

  // Re-fetch translatable resources when language changes
  useEffect(() => {
    if (currentLanguage) {
      fetchTimesheetStatuses?.({ quiet: true });
      fetchBusinessActivities?.({ quiet: true });
      // Also re-fetch work packages to get localized names
      const projectIds = Array.from(new Set(
        timeEntries.map(e => (e as any).pr_project_id || e.project_id).filter((id): id is number => !!id)
      ));
      projectIds.forEach(pid => fetchWorkPackages?.(pid));
    }
  }, [currentLanguage, fetchTimesheetStatuses, fetchBusinessActivities, fetchWorkPackages]); // Removed timeEntries dependency to prevent loop

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
              <div className="text-sm text-muted-foreground">
                {currentBexioUserId && users.length > 0 && (
                  <span>
                    {users.find(u => u.id === currentBexioUserId)?.firstname} {users.find(u => u.id === currentBexioUserId)?.lastname}
                    {isCurrentUserAdmin && <span className="ml-1 text-warning">(Admin)</span>}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
              {/* User Filter for Admins */}
              {isCurrentUserAdmin && users.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">View user:</label>
                  <Select
                    value={selectedUserId?.toString() || "all"}
                    onValueChange={(value) => {
                      if (value === "all") {
                        setSelectedUserId("all");
                      } else {
                        const parsed = parseInt(value);
                        setSelectedUserId(isNaN(parsed) ? "all" : parsed);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-popover border border-border shadow-lg">
                      <SelectItem value="all">All Users</SelectItem>
                      {users
                        .filter(user => user && typeof user.id === 'number' && user.id != null && !isNaN(user.id))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {typeof user.firstname === 'string' ? user.firstname : 'Unknown'} {typeof user.lastname === 'string' ? user.lastname : 'User'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {/* Language Flag */}
                <LanguageFlag
                  languages={languages}
                  currentLanguage={currentLanguage}
                  onLanguageChange={setCurrentLanguage}
                />
                
                {/* Connection status indicator */}
                <div className="group relative">
                  <div className="p-2 rounded-full bg-success/10 border border-success/20 hover:bg-success/20 transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
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
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`container mx-auto py-4 sm:py-8 ${isMobile ? 'mobile-container px-3' : 'px-2 sm:px-4'}`}>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={timeTrackingView === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('list')}
                    className="gap-2"
                  >
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button
                    variant={timeTrackingView === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('grid')}
                    className="gap-2"
                  >
                    <Grid className="h-4 w-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </Button>
                  <Button
                    variant={timeTrackingView === 'calendar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeTrackingView('calendar')}
                    className="gap-2"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">Calendar</span>
                  </Button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                    buttonText="Add Entry"
                    buttonSize="sm"
                    timesheetStatuses={timesheetStatuses}
                    businessActivities={businessActivities}
                    users={users}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    currentBexioUserId={currentBexioUserId}
                  />
                </div>
              </div>
            )}
          </div>

          <TabsContent value="timetracking" className="space-y-6">
            {timeTrackingView === 'list' ? (
              <TimeTrackingList 
                timeEntries={visibleTimeEntries} 
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
                timesheetStatuses={timesheetStatuses}
                businessActivities={businessActivities}
                workPackagesByProject={workPackagesByProject}
                getWorkPackageName={getWorkPackageName}
              />
            ) : timeTrackingView === 'grid' ? (
              <SimpleTimeGrid
                timeEntries={visibleTimeEntries}
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
                timeEntries={visibleTimeEntries}
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
                timesheetStatuses={timesheetStatuses}
                businessActivities={businessActivities}
                workPackagesByProject={workPackagesByProject}
                getWorkPackageName={getWorkPackageName}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Analytics 
              timeEntries={visibleTimeEntries}
              contacts={contacts}
              projects={projects}
              users={users}
              isCurrentUserAdmin={isCurrentUserAdmin}
              currentBexioUserId={typeof selectedUserId === "number" ? selectedUserId : currentBexioUserId}
              isLoading={isLoadingTimeEntries}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
