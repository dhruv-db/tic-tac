import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Plus,
  Calendar,
  Grid,
  List,
  TrendingUp,
  Clock,
  Users,
  Target,
  Filter,
  ChevronDown,
  BarChart3,
  Shield,
  CheckCircle2,
  LogOut,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MobileLayout from '@/components/MobileLayout';
import MobilePullToRefresh from '@/components/MobilePullToRefresh';
import { TimeEntryDialog } from '@/components/TimeEntryDialog';
import { TimeEntryForm } from '@/components/TimeEntryForm';
import { TimeTrackingList } from '@/components/TimeTrackingList';
import { SimpleTimeGrid } from '@/components/SimpleTimeGrid';
import { TimesheetCalendar } from '@/components/TimesheetCalendar';
import { Analytics } from '@/components/Analytics';
import { LanguageFlag } from '@/components/LanguageFlag';
import { useAuth } from '@/context/OAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { BexioConnector } from '@/components/BexioConnector';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { safeNumberToString, safeGetProjectName, isValidProject } from '@/lib/dataValidation';
import ticTacLogo from '@/assets/Tic-Tac_Dark.png';

const TikTakLogo = ({ className = "" }: { className?: string }) => {
  console.log('🎯 [DEBUG] TikTakLogo component rendered');
  console.log('🎯 [DEBUG] TikTakLogo className:', className);
  console.log('🎯 [DEBUG] TikTakLogo image source:', ticTacLogo);

  return (
    <div className={`flex flex-col items-center space-y-2 p-4 ${className}`}>
      <img
        src={ticTacLogo}
        alt="tik-tak"
        className="h-10 w-auto md:h-12"
        onLoad={() => console.log('🎯 [DEBUG] TikTakLogo image loaded successfully')}
        onError={(e) => console.error('❌ [DEBUG] TikTakLogo image failed to load:', e)}
      />
    </div>
  );
};

const MobileIndex = () => {
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
    fetchUsers,
    fetchLanguages,
    fetchTimesheetStatuses,
    fetchBusinessActivities,
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
    timesheetStatuses,
    businessActivities,
    workPackagesByProject,
    getWorkPackageName,
  } = useAuth();

  const [activeTab, setActiveTab] = useState('timetracking');

  // Debug logging for connection state
  console.log('🔍 [DEBUG] MobileIndex component rendered');
  console.log('🔍 [DEBUG] MobileIndex - isConnected:', isConnected);
  console.log('🔍 [DEBUG] MobileIndex - credentials present:', !!credentials);
  console.log('🔍 [DEBUG] MobileIndex - credentials details:', credentials ? {
    hasAccessToken: !!credentials.accessToken,
    authType: credentials.authType,
    companyId: credentials.companyId
  } : 'null');
  console.log('🔍 [DEBUG] MobileIndex - projects count:', projects.length);
  console.log('🔍 [DEBUG] MobileIndex - contacts count:', contacts.length);
  console.log('🔍 [DEBUG] MobileIndex - timeEntries count:', timeEntries.length);
  console.log('🔍 [DEBUG] MobileIndex - hasInitiallyLoaded:', hasInitiallyLoaded);
  const [timeTrackingView, setTimeTrackingView] = useState<'list' | 'grid' | 'calendar'>('list');
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const [showAddEntryDialog, setShowAddEntryDialog] = useState(false);

  // Filter states
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'project'>('date_desc');
  const { toast } = useToast();
  const { lightImpact, mediumImpact, success: hapticSuccess } = useHapticFeedback();

  // Auto-load data when connected
  useEffect(() => {
    console.log('🔄 [DEBUG] Auto-load data effect triggered');
    console.log('🔄 [DEBUG] isConnected:', isConnected);
    console.log('🔄 [DEBUG] Current data counts - contacts:', contacts.length, 'projects:', projects.length, 'users:', users.length, 'timeEntries:', timeEntries.length);

    if (!isConnected) {
      console.log('🔄 [DEBUG] Not connected, skipping auto-load');
      return;
    }

    if (contacts.length === 0 && !isLoadingContacts) {
      console.log('🔄 [DEBUG] Triggering fetchContacts');
      fetchContacts();
    }
    if (projects.length === 0 && !isLoadingProjects) {
      console.log('🔄 [DEBUG] Triggering fetchProjects');
      fetchProjects();
    }
    if (users.length === 0 && !isLoadingUsers) {
      console.log('🔄 [DEBUG] Triggering fetchUsers');
      console.log('🔄 [DEBUG] currentBexioUserId:', currentBexioUserId);
      console.log('🔄 [DEBUG] isCurrentUserAdmin:', isCurrentUserAdmin);
      fetchUsers();
    }
    if (timeEntries.length === 0 && !isLoadingTimeEntries) {
      console.log('🔄 [DEBUG] Triggering fetchTimeEntries');
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      console.log('🔄 [DEBUG] Time entries date range:', startDate.toISOString(), 'to', endOfCurrentMonth.toISOString());
      fetchTimeEntries({ from: startDate, to: endOfCurrentMonth }, { quiet: true });
    }
  }, [isConnected, contacts.length, projects.length, users.length, timeEntries.length, isLoadingContacts, isLoadingProjects, isLoadingUsers, isLoadingTimeEntries, fetchContacts, fetchProjects, fetchUsers, fetchTimeEntries]);

  useEffect(() => {
    console.log('🔄 ===== LOAD STORED CREDENTIALS EFFECT START =====');
    console.log('🔄 Calling loadStoredCredentials from MobileIndex...');
    loadStoredCredentials().then((result) => {
      console.log('🔄 loadStoredCredentials result:', result);
      console.log('🔄 ===== LOAD STORED CREDENTIALS EFFECT END =====');
    });
  }, []); // Only run once on mount

  // Track authentication state changes
  useEffect(() => {
    console.log('🔐 ===== AUTHENTICATION STATE CHANGE =====');
    console.log('🔐 isConnected:', isConnected);
    console.log('🔐 credentials present:', !!credentials);
    console.log('🔐 credentials details:', credentials ? {
      hasAccessToken: !!credentials.accessToken,
      hasRefreshToken: !!credentials.refreshToken,
      authType: credentials.authType,
      companyId: credentials.companyId,
      userEmail: credentials.userEmail,
      expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt).toISOString() : 'null'
    } : 'null');
    console.log('🔐 Current time:', new Date().toISOString());
    console.log('🔐 Will render:', isConnected ? 'MAIN APP' : 'LOGIN SCREEN');

    // Check for issues
    if (!isConnected) {
      if (!credentials) {
        console.log('❌ Not connected: No credentials found');
      } else if (credentials.authType === 'oauth' && credentials.expiresAt && credentials.expiresAt < Date.now()) {
        console.log('❌ Not connected: OAuth token expired');
      } else {
        console.log('❌ Not connected: Other reason');
      }
    } else {
      console.log('✅ Connected: Should show MAIN APP');
    }

    console.log('🔐 ===== AUTHENTICATION STATE CHANGE END =====');
  }, [isConnected, credentials]);

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

  const handleRefresh = () => {
    fetchTimeEntries(undefined, { quiet: false });
    fetchContacts();
    fetchProjects();
    fetchUsers();
  };

  const handleAddEntry = () => {
    setShowAddEntryDialog(true);
  };

  // Filter time entries based on user permissions and applied filters
  const visibleTimeEntries = useMemo(() => {
    let filtered = timeEntries || [];

    // Filter by user permissions
    if (!isCurrentUserAdmin) {
      filtered = filtered.filter(entry => entry.user_id === currentBexioUserId);
    }

    // Apply project filter
    if (selectedProject !== null) {
      filtered = filtered.filter(entry => entry.project_id === selectedProject);
    }

    // Apply month filter
    if (selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-').map(Number);
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === year && entryDate.getMonth() === month - 1;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'duration_desc':
          const durationB = typeof b.duration === 'string' ? parseFloat(b.duration) : (b.duration || 0);
          const durationA = typeof a.duration === 'string' ? parseFloat(a.duration) : (a.duration || 0);
          return durationB - durationA;
        case 'duration_asc':
          const durationA2 = typeof a.duration === 'string' ? parseFloat(a.duration) : (a.duration || 0);
          const durationB2 = typeof b.duration === 'string' ? parseFloat(b.duration) : (b.duration || 0);
          return durationA2 - durationB2;
        case 'project':
          const projectA = projects.find(p => p.id === a.project_id)?.name || '';
          const projectB = projects.find(p => p.id === b.project_id)?.name || '';
          return projectA.localeCompare(projectB);
        default:
          return 0;
      }
    });

    return filtered;
  }, [timeEntries, isCurrentUserAdmin, currentBexioUserId, selectedProject, selectedMonth, sortBy, projects]);

  const currentUser = users.find(u => u.id === currentBexioUserId);
  console.log('👤 [DEBUG] currentUser lookup:', {
    currentBexioUserId,
    usersCount: users.length,
    users: users.map(u => ({ id: u.id, name: `${u.firstname} ${u.lastname}`, email: u.email })),
    foundUser: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'NOT FOUND'
  });
  const isLoading = isLoadingContacts || isLoadingProjects || isLoadingTimeEntries;

  // Calculate today's stats
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntries = visibleTimeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    const totalHours = todayEntries.reduce((sum, entry) => {
      const duration = typeof entry.duration === 'string' ? parseFloat(entry.duration) : (entry.duration || 0);
      return sum + duration;
    }, 0);
    const totalEntries = todayEntries.length;

    return { totalHours, totalEntries };
  }, [visibleTimeEntries]);

  // Render different content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'timetracking':
        return (
          <div className="p-4 space-y-4">
            {/* Mobile-Optimized Today's Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <Card className="bg-white border border-gray-300 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-teal-600 rounded-md">
                        <Clock className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Today's Progress</p>
                        <p className="text-xs text-gray-600">Time tracking</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-gray-600">Active</span>
                    </div>
                  </div>

                  {/* Compact Hours & Entries Display */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 text-center">
                      <div className="bg-teal-600 text-white px-2 py-1.5 rounded-md">
                        <p className="text-sm font-bold leading-tight">
                          {todayStats.totalHours.toFixed(1)}<span className="text-xs ml-0.5">h</span>
                        </p>
                        <p className="text-[10px] text-teal-100 leading-tight">Hours</p>
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="bg-gray-800 text-white px-2 py-1.5 rounded-md">
                        <p className="text-sm font-bold leading-tight">
                          {todayStats.totalEntries}
                        </p>
                        <p className="text-[10px] text-gray-300 leading-tight">Entries</p>
                      </div>
                    </div>
                  </div>

                  {/* Connection Status & Refresh in Progress Section */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-green-500" : "bg-red-500"
                      )} />
                      <span className="text-xs font-medium text-gray-600">
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="h-7 w-7 p-0 bg-white border-gray-300 hover:bg-gray-50"
                      >
                        <RefreshCw className={cn("h-3 w-3 transition-transform duration-300", isLoading && "animate-spin")} />
                      </Button>
                    </motion.div>
                  </div>

                  {/* Compact Progress Section */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700">Progress</span>
                      <span className="text-xs font-bold text-teal-600">
                        {((todayStats.totalHours / 8) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <motion.div
                          className="h-full bg-teal-600 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((todayStats.totalHours / 8) * 100, 100)}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-600 text-center leading-tight">
                      {todayStats.totalHours >= 8 ? '🎉 Goal achieved!' : `${(8 - todayStats.totalHours).toFixed(1)}h left`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* View Type Selector - Moved outside filter section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative mb-4"
            >
              <div className="flex items-center justify-between">
                {/* View Type Buttons */}
                <div className="flex items-center gap-2">
                  {[
                    { id: 'list', icon: List, label: 'List' },
                    { id: 'grid', icon: Grid, label: 'Grid' },
                    { id: 'calendar', icon: Calendar, label: 'Calendar' }
                  ].map(({ id, icon: Icon, label }) => (
                    <motion.div
                      key={id}
                      whileTap={{ scale: 0.95 }}
                      className="relative"
                    >
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTimeTrackingView(id as any);
                          lightImpact();
                        }}
                        className={cn(
                          "relative h-8 px-3 flex items-center gap-1.5 transition-all duration-200 text-xs",
                          timeTrackingView === id
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Button>
                    </motion.div>
                  ))}
                </div>

                {/* Filter Button */}
                <Sheet>
                  <SheetTrigger asChild>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 bg-white border-gray-300 hover:bg-gray-50 shadow-sm"
                      >
                        <Filter className="h-3.5 w-3.5 text-gray-600" />
                      </Button>
                    </motion.div>
                  </SheetTrigger>

                  <SheetContent side="bottom" className="rounded-t-xl max-h-[80vh] overflow-y-auto">
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-800">Filters & View</h3>
                        <p className="text-sm text-gray-600">Customize your time tracking experience</p>
                      </div>


                      {/* Project Filter */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Project</label>
                        <Select value={safeNumberToString(selectedProject, 'all')} onValueChange={(value) => {
                          setSelectedProject(value === 'all' ? null : parseInt(value));
                          lightImpact();
                        }}>
                          <SelectTrigger className="w-full bg-white border-gray-300">
                            <SelectValue placeholder="All Projects" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {projects
                              .filter(isValidProject)
                              .map((project) => (
                                <SelectItem key={project.id} value={safeNumberToString(project.id)}>
                                  {safeGetProjectName(project)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Month Filter */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Month</label>
                        <Select value={selectedMonth} onValueChange={(value) => {
                          setSelectedMonth(value);
                          lightImpact();
                        }}>
                          <SelectTrigger className="w-full bg-white border-gray-300">
                            <SelectValue placeholder="All Months" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {Array.from({ length: 12 }, (_, i) => {
                              const date = new Date();
                              date.setMonth(date.getMonth() - i);
                              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                              const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                              return (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sort By */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Sort By</label>
                        <Select value={sortBy} onValueChange={(value: any) => {
                          setSortBy(value);
                          lightImpact();
                        }}>
                          <SelectTrigger className="w-full bg-white border-gray-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date_desc">Date (Newest First)</SelectItem>
                            <SelectItem value="date_asc">Date (Oldest First)</SelectItem>
                            <SelectItem value="duration_desc">Duration (Highest First)</SelectItem>
                            <SelectItem value="duration_asc">Duration (Lowest First)</SelectItem>
                            <SelectItem value="project">Project Name</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quick Filters */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Quick Filters</label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 bg-white border-gray-300 hover:bg-gray-50"
                            onClick={() => {
                              const today = new Date();
                              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                              const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                              setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
                              lightImpact();
                            }}
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">This Month</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 bg-white border-gray-300 hover:bg-gray-50"
                            onClick={() => {
                              setSelectedProject(null);
                              setSelectedMonth('all');
                              setSortBy('date_desc');
                              lightImpact();
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">Reset All</span>
                          </Button>
                        </div>
                      </div>

                      {/* Apply Button */}
                      <div className="pt-2">
                        <Button
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => {
                            // Close the sheet
                            const sheet = document.querySelector('[data-state="open"]');
                            if (sheet) {
                              const closeBtn = sheet.querySelector('[aria-label="Close"]') as HTMLElement;
                              closeBtn?.click();
                            }
                            hapticSuccess();
                          }}
                        >
                          Apply Filters
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </motion.div>

            {/* Time Tracking Content */}
            <MobilePullToRefresh
              onRefresh={() => {
                handleRefresh();
                hapticSuccess();
              }}
              isRefreshing={isLoading}
              className="h-[calc(100vh-320px)]"
            >
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
                  onFetchWorkPackages={async (projectId: number) => {
                    // Handle work package fetching
                  }}
                  timesheetStatuses={timesheetStatuses}
                  businessActivities={businessActivities}
                  workPackagesByProject={workPackagesByProject}
                  getWorkPackageName={getWorkPackageName}
                  selectedProject={selectedProject}
                  selectedMonth={selectedMonth}
                  sortBy={sortBy}
                  onProjectFilterChange={setSelectedProject}
                  onMonthFilterChange={setSelectedMonth}
                  onSortChange={setSortBy}
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
                  onFetchWorkPackages={async (projectId: number) => {
                    // Handle work package fetching
                  }}
                />
              ) : (
                <TimesheetCalendar
                  timeEntries={visibleTimeEntries}
                  isLoading={isLoadingTimeEntries}
                  onEditEntry={() => {}}
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
                    if (window.confirm('Delete this entry?')) {
                      await deleteTimeEntry(id);
                    }
                  }}
                />
              )}
            </MobilePullToRefresh>
          </div>
        );

      case 'analytics':
        return (
          <div className="p-4 space-y-6">
            {/* Analytics Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white border border-gray-300 shadow-sm">
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="p-4">
                      <Analytics
                        timeEntries={visibleTimeEntries}
                        contacts={contacts}
                        projects={projects}
                        users={users}
                        isCurrentUserAdmin={isCurrentUserAdmin}
                        currentBexioUserId={currentBexioUserId}
                        isLoading={isLoadingTimeEntries}
                      />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        );

      case 'settings':
        console.log('⚙️ [DEBUG] Rendering settings section:', {
          currentUser: currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'NULL',
          currentBexioUserId,
          isCurrentUserAdmin,
          usersCount: users.length
        });
        return (
          <div className="p-4 space-y-6">
            {/* Mobile-Optimized Profile Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-teal-600 border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      whileTap={{ scale: 0.95 }}
                      className="relative"
                    >
                      <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-lg font-bold text-teal-600">
                          {currentUser ? `${currentUser.firstname[0]}${currentUser.lastname[0]}` : 'U'}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    </motion.div>

                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-white">
                        {currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : 'Settings'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs px-2 py-0.5",
                            isCurrentUserAdmin
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-gray-600/20 text-gray-300 border-gray-500/30"
                          )}
                        >
                          {isCurrentUserAdmin ? '👑 Admin' : '👤 User'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </motion.div>

            {/* Settings Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-300 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-gray-600" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-600/10 rounded-lg">
                        <Users className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="font-medium text-gray-700">Language</span>
                    </div>
                    <LanguageFlag
                      languages={languages}
                      currentLanguage={currentLanguage}
                      onLanguageChange={setCurrentLanguage}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-600/10 rounded-lg">
                        <Clock className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-700">Time Zone</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => {
                      lightImpact();
                      handleRefresh();
                    }}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Refresh Data
                  </Button>

                  <Separator className="my-3" />

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-12 bg-orange-50 border-orange-300 hover:bg-orange-100 text-orange-800"
                    onClick={() => {
                      lightImpact();
                      if (window.confirm('Are you sure you want to clear ALL data? This will remove all cached data, sessions, cookies, and sign you out completely.')) {
                        // Comprehensive data clearing function
                        const clearAllData = async () => {
                          try {
                            // 1. Clear localStorage
                            localStorage.clear();
                            console.log('✅ Cleared localStorage');

                            // 2. Clear sessionStorage
                            sessionStorage.clear();
                            console.log('✅ Cleared sessionStorage');

                            // 3. Clear all cookies
                            const clearCookies = () => {
                              const cookies = document.cookie.split(';');
                              for (let cookie of cookies) {
                                const eqPos = cookie.indexOf('=');
                                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
                                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
                              }
                            };
                            clearCookies();
                            console.log('✅ Cleared cookies');

                            // 4. Clear IndexedDB
                            const clearIndexedDB = async () => {
                              if ('indexedDB' in window) {
                                try {
                                  const databases = await indexedDB.databases?.() || [];
                                  for (const db of databases) {
                                    if (db.name) {
                                      indexedDB.deleteDatabase(db.name);
                                    }
                                  }
                                } catch (error) {
                                  console.warn('⚠️ Could not clear IndexedDB:', error);
                                }
                              }
                            };
                            await clearIndexedDB();
                            console.log('✅ Cleared IndexedDB');

                            // 5. Clear Cache Storage (Service Worker caches)
                            const clearCacheStorage = async () => {
                              if ('caches' in window) {
                                try {
                                  const cacheNames = await caches.keys();
                                  await Promise.all(
                                    cacheNames.map(cacheName => caches.delete(cacheName))
                                  );
                                } catch (error) {
                                  console.warn('⚠️ Could not clear Cache Storage:', error);
                                }
                              }
                            };
                            await clearCacheStorage();
                            console.log('✅ Cleared Cache Storage');

                            // 6. Clear Web SQL Database (legacy)
                            const clearWebSQL = () => {
                              if ('openDatabase' in window) {
                                try {
                                  // This is a best-effort attempt since WebSQL is deprecated
                                  // We can't enumerate all databases, but we can try to clear known ones
                                  console.log('ℹ️ WebSQL detected but cannot be fully cleared from client-side');
                                } catch (error) {
                                  console.warn('⚠️ Could not clear WebSQL:', error);
                                }
                              }
                            };
                            clearWebSQL();
                            console.log('✅ Attempted WebSQL clearing');

                            // 7. Clear server-side sessions (optional)
                            try {
                              await fetch('http://localhost:3001/api/bexio-oauth/clear-sessions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ clearAll: true })
                              });
                              console.log('✅ Cleared server sessions');
                            } catch (error) {
                              console.warn('⚠️ Could not clear server sessions:', error);
                            }

                            // 8. Clear browser history state
                            try {
                              if (window.history.replaceState) {
                                window.history.replaceState(null, '', window.location.pathname);
                              }
                            } catch (error) {
                              console.warn('⚠️ Could not clear browser history:', error);
                            }
                            console.log('✅ Cleared browser history state');

                            // 9. Reset all app state
                            disconnect();
                            console.log('✅ Reset app state');

                          } catch (error) {
                            console.error('❌ Error during data clearing:', error);
                          }
                        };

                        // Execute comprehensive clearing
                        clearAllData().then(() => {
                          toast({
                            title: "All Data Cleared",
                            description: "All local data, sessions, cookies, and cache have been cleared. The page will reload.",
                          });

                          // Reload the page to ensure completely clean state
                          setTimeout(() => {
                            window.location.reload();
                          }, 1500);
                        }).catch((error) => {
                          console.error('❌ Error during comprehensive clearing:', error);
                          toast({
                            title: "Partial Clear Completed",
                            description: "Some data may not have been cleared. The page will reload.",
                            variant: "destructive",
                          });

                          // Still reload even if there were errors
                          setTimeout(() => {
                            window.location.reload();
                          }, 1500);
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </Button>

                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-3 h-12 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      mediumImpact();
                      if (window.confirm('Are you sure you want to sign out?')) {
                        disconnect();
                        toast({
                          title: "Signed Out",
                          description: "You have been successfully signed out.",
                        });
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

          </div>
        );

      case 'add':
        return (
          <div className="p-4 space-y-6">
            {/* Add Entry Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-teal-600 border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg">
                      <Plus className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Create Time Entry</h2>
                      <p className="text-sm text-white/80">Add a new time tracking entry</p>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="bg-white/10 rounded-lg p-3 mt-3">
                    <p className="text-sm text-white/90">
                      💡 <strong>Tip:</strong> Fill in the details below to create a new time entry. You can also use the calendar view to create entries for specific dates.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Time Entry Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-300 shadow-sm">
                <CardContent className="p-4">
                  <TimeEntryDialog
                    onSubmit={createTimeEntry}
                    isSubmitting={isCreatingTimeEntry}
                    contacts={contacts}
                    projects={projects}
                    workPackages={workPackages}
                    isLoadingWorkPackages={isLoadingWorkPackages}
                    onFetchWorkPackages={async (projectId: number) => {
                      // Handle work package fetching
                    }}
                    initialData={calendarInitialData}
                    buttonText="Create Entry"
                    buttonSize="lg"
                    timesheetStatuses={timesheetStatuses}
                    businessActivities={businessActivities}
                    users={users}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    currentBexioUserId={currentBexioUserId}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Entries Preview */}
            {visibleTimeEntries.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card className="bg-white border border-gray-300 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      Recent Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {visibleTimeEntries.slice(0, 3).map((entry, index) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-teal-600/10 rounded-lg flex items-center justify-center">
                              <Clock className="h-4 w-4 text-teal-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {entry.text || 'Time Entry'}
                              </p>
                              <p className="text-xs text-gray-600">
                                {new Date(entry.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-700">
                              {entry.duration}h
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex">
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80"></div>
          <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white bg-[#164e59]">
            {/* Logo & Brand */}
            <div className="mb-12 text-center px-8 py-6">
              <TikTakLogo className="mb-8" />
              <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                Transform Your Time Tracking
              </h1>
              <p className="text-xl text-white/90 leading-relaxed">
                Connect seamlessly with Bexio and transform how you track time, manage projects, and analyze productivity across your team.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 gap-6">
              {[
                { icon: Clock, title: "Precise Time Tracking", description: "Track billable hours with precision and automated project matching" },
                { icon: Target, title: "Project Insights", description: "Monitor project progress and profitability in real-time" },
                { icon: Calendar, title: "Smart Scheduling", description: "Optimize your schedule with intelligent time allocation" },
                { icon: BarChart3, title: "Performance Analytics", description: "Detailed reports on productivity and time utilization" }
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg backdrop-blur-sm border border-white/20 bg-[#134651]">
                  <div className="p-2 rounded-lg bg-white/20">
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-[#5faf59]">{feature.title}</h3>
                    <p className="text-sm text-white/80">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 pt-8 border-t border-white/20">
              <div className="flex items-center gap-6">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  <Shield className="h-3 w-3 mr-1" />
                  SOC 2 Compliant
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  99.9% Uptime
                </Badge>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Login Card */}
            <Card className="corporate-card border-0 shadow-[var(--shadow-elegant)]">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-title">Welcome to tik-tak</CardTitle>

              </CardHeader>
              <CardContent className="space-y-6">
                <BexioConnector
                  onConnect={connect}
                  onOAuthConnect={connectWithOAuth}
                  isConnected={isConnected}
                  className="py-0"
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Secure Connection
                    </span>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="text-center text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <Shield className="h-4 w-4 inline mr-1" />
                  Your connection is secured with OAuth 2.0 encryption
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>© 2024 tik-tak. Built with modern security standards.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={currentUser}
        isAdmin={isCurrentUserAdmin}
        isConnected={isConnected}
        onRefresh={handleRefresh}
        onDisconnect={disconnect}
        isLoading={isLoading}
        onAddEntry={handleAddEntry}
      >
        {renderContent()}
      </MobileLayout>

      {/* Quick Add Entry Modal */}
      {showAddEntryDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Quick Add Entry</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddEntryDialog(false)}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <TimeEntryForm
                onSubmit={async (data) => {
                  await createTimeEntry(data);
                  setShowAddEntryDialog(false);
                }}
                isSubmitting={isCreatingTimeEntry}
                contacts={contacts}
                projects={projects}
                workPackages={workPackages}
                isLoadingWorkPackages={isLoadingWorkPackages}
                onFetchWorkPackages={async (projectId: number) => {
                  // Handle work package fetching
                }}
                initialData={calendarInitialData}
                hideFormWrapper={true}
                timesheetStatuses={timesheetStatuses}
                businessActivities={businessActivities}
                users={users}
                isCurrentUserAdmin={isCurrentUserAdmin}
                currentBexioUserId={currentBexioUserId}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileIndex;