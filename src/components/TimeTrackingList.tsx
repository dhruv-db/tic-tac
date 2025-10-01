import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar, User, DollarSign, PlayCircle, PauseCircle, Edit, Trash2, CalendarDays, Filter, X, MoreVertical, ChevronDown } from "lucide-react";
import { format, isThisMonth, parseISO } from "date-fns";
import { TimesheetCalendar } from "./TimesheetCalendar";
import { EditTimeEntryDialog } from "./EditTimeEntryDialog";
import { TimeEntryDialog } from "./TimeEntryDialog";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { BulkUpdateDialog } from "./BulkUpdateDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { useBexioApi } from "@/hooks/useBexioApi";
import { useIsMobile } from "@/hooks/use-mobile";

export interface TimeEntry {
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
  created_at?: string;
  updated_at?: string;
}

interface Contact {
  id: number;
  nr: string;
  name_1: string;
  name_2?: string;
}

interface Project {
  id: number;
  nr: string;
  name: string;
}

interface TimeTrackingListProps {
  timeEntries: TimeEntry[];
  isLoading: boolean;
    onCreateTimeEntry?: (data: {
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
    }) => Promise<void>;
  onUpdateTimeEntry?: (id: number, data: any) => Promise<void>;
  onDeleteTimeEntry?: (id: number) => Promise<void>;
  onBulkUpdateTimeEntries?: (entries: TimeEntry[], updateData: any) => Promise<void>;
  onBulkDeleteTimeEntries?: (entryIds: number[]) => Promise<void>;
  isCreatingTimeEntry?: boolean;
  contacts: Contact[];
  projects: Project[];
  workPackages: WorkPackage[];
  isLoadingWorkPackages: boolean;
  onFetchWorkPackages: (projectId: number) => Promise<void>;
  onScrollToForm?: () => void;
  timesheetStatuses: { id: number; name: string }[];
  businessActivities: { id: number; name: string }[];
  workPackagesByProject: Record<number, WorkPackage[]>;
  getWorkPackageName: (projectId: number | undefined, packageId: string | undefined) => string;
  // Filter props for desktop
  selectedProject?: number | null;
  selectedMonth?: string;
  sortBy?: 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'project';
  onProjectFilterChange?: (projectId: number | null) => void;
  onMonthFilterChange?: (month: string) => void;
  onSortChange?: (sort: 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'project') => void;
}

interface WorkPackage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  pr_project_id?: number;
}

export const TimeTrackingList = ({
  timeEntries,
  isLoading,
  onCreateTimeEntry,
  onUpdateTimeEntry,
  onDeleteTimeEntry,
  onBulkUpdateTimeEntries,
  onBulkDeleteTimeEntries,
  isCreatingTimeEntry = false,
  contacts,
  projects,
  workPackages,
  isLoadingWorkPackages,
  onFetchWorkPackages,
  onScrollToForm,
  timesheetStatuses,
  businessActivities,
  workPackagesByProject,
  getWorkPackageName: getWpName,
  selectedProject,
  selectedMonth = 'all',
  sortBy = 'date_desc',
  onProjectFilterChange,
  onMonthFilterChange,
  onSortChange
}: TimeTrackingListProps) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // Removed useBexioApi hook - using props instead
  
  // Prefetch work packages for visible projects - handle both project_id and pr_project_id
  useEffect(() => {
    const projectIds = Array.from(new Set(
      (timeEntries || []).map(e => (e as any).pr_project_id || e.project_id).filter((id): id is number => !!id)
    ));
    projectIds.forEach(pid => {
      if (!workPackagesByProject[pid]) {
        onFetchWorkPackages(pid);
      }
    });
  }, [timeEntries, workPackagesByProject, onFetchWorkPackages]);
  useEffect(() => {
    if (!isCreatingTimeEntry && calendarInitialData) {
      // Small delay to allow form submission to complete
      const timer = setTimeout(() => {
        setCalendarInitialData(null);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isCreatingTimeEntry, calendarInitialData]);
  
  const toSeconds = (duration: string | number): number => {
    if (duration == null) return 0; // Handle null/undefined
    if (typeof duration === 'number') return duration; // already in seconds
    if (typeof duration === 'string') {
      // Handle formats like "HH:MM" or "H:MM"
      if (duration.includes(':')) {
        const [h, m] = duration.split(':').map((v) => parseInt(v, 10));
        const hours = isNaN(h) ? 0 : h;
        const minutes = isNaN(m) ? 0 : m;
        return hours * 3600 + minutes * 60;
      }
      // Fallback: numeric string representing seconds
      const parsed = Number(duration);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Helper function to get duration from entry (checking multiple locations)
  const getEntryDuration = (entry: TimeEntry): string | number => {
    return entry.duration || (entry as any).tracking?.duration || '';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, "MMM dd, yyyy");
    } catch {
      return 'Invalid Date';
    }
  };

  // Use the timeEntries directly since filtering is handled by parent component
  const filteredAndSortedTimeEntries = (timeEntries || []).filter(entry => {
    // Check for duration in multiple possible locations
    const duration = entry?.duration || (entry as any)?.tracking?.duration;
    const hasValidDuration = duration != null && duration !== '';

    const isValid = entry && entry.id != null && entry.date && hasValidDuration;
    if (!isValid) {
      console.log('🔍 [DEBUG] Filtering out invalid entry:', {
        hasEntry: !!entry,
        id: entry?.id,
        hasDate: !!entry?.date,
        date: entry?.date,
        hasDuration: hasValidDuration,
        duration: duration,
        durationFromEntry: entry?.duration,
        durationFromTracking: (entry as any)?.tracking?.duration,
        allKeys: entry ? Object.keys(entry) : 'no entry',
        trackingKeys: (entry as any)?.tracking ? Object.keys((entry as any).tracking) : 'no tracking'
      });
    }
    return isValid;
  });

  console.log('🔍 [DEBUG] TimeTrackingList - Original entries:', timeEntries?.length || 0);
  console.log('🔍 [DEBUG] TimeTrackingList - Filtered entries:', filteredAndSortedTimeEntries.length);

  // Get unique month/year options from time entries
  const getMonthYearOptions = () => {
    const monthYears = new Set<string>();
    (timeEntries || []).forEach(entry => {
      if (!entry.date) return; // Skip entries without date
      try {
        const date = new Date(entry.date);
        if (isNaN(date.getTime())) return; // Skip invalid dates
        const monthYear = format(date, "yyyy-MM");
        monthYears.add(monthYear);
      } catch {
        // Skip invalid dates
      }
    });
    return Array.from(monthYears).sort().reverse();
  };

  // Helper function to get status name
  const getStatusName = (statusId?: number): string => {
    if (!statusId) return 'No Status';
    const status = timesheetStatuses.find(s => s.id === statusId);
    return status?.name || `Status ${statusId}`;
  };

  // Helper function to get activity name
  const getActivityName = (activityId?: number): string => {
    if (!activityId) return 'No Activity';
    const activity = businessActivities.find(a => a.id === activityId);
    return activity?.name || `Activity ${activityId}`;
  };

  // Helper function to get work package name via cache - handle both project_id and pr_project_id
  const getWorkPackageName = (entry: TimeEntry): string => {
    if (!entry.pr_package_id || typeof entry.pr_package_id !== 'string') return 'No Work Package';
    // Try pr_project_id first (from Bexio API), then project_id as fallback
    const projectId = (entry as any).pr_project_id || entry.project_id;
    if (!projectId) return `WP ${entry.pr_package_id}`;
    return getWpName(projectId, entry.pr_package_id);
  };

  // Helper function to format last updated
  const formatLastUpdated = (entry: TimeEntry): string => {
    const lastUpdated = entry.updated_at || entry.created_at;
    if (!lastUpdated) return 'Unknown';
    try {
      return format(new Date(lastUpdated), "MMM dd, HH:mm");
    } catch {
      return 'Unknown';
    }
  };

  // Selection handlers
  const handleSelectEntry = (entryId: number, checked: boolean) => {
    setSelectedEntries(prev => 
      checked 
        ? [...prev, entryId]
        : prev.filter(id => id !== entryId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedEntries(checked ? filteredAndSortedTimeEntries.map(entry => entry.id) : []);
  };


  const handleBulkUpdate = async (entries: TimeEntry[], updateData: any) => {
    if (onBulkUpdateTimeEntries) {
      await onBulkUpdateTimeEntries(entries, updateData);
      setSelectedEntries([]);
    }
  };

  const handleBulkDelete = async () => {
    if (onBulkDeleteTimeEntries && window.confirm(`Are you sure you want to delete ${selectedEntries.length} time entries?`)) {
      await onBulkDeleteTimeEntries(selectedEntries);
      setSelectedEntries([]);
    }
  };

  const getSelectedEntries = () => {
    return filteredAndSortedTimeEntries.filter(entry => selectedEntries.includes(entry.id));
  };

  const toggleCardExpansion = (entryId: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const isAllSelected = selectedEntries.length === filteredAndSortedTimeEntries.length && filteredAndSortedTimeEntries.length > 0;
  const isIndeterminate = selectedEntries.length > 0 && selectedEntries.length < filteredAndSortedTimeEntries.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 animate-fade-in ${isMobile ? 'mobile-container px-1 pb-20' : 'px-4'}`}>
      <Tabs value="list" className="space-y-3">
        <TabsContent value="list" className="space-y-3">

          {/* Desktop Filters - Always visible on desktop */}
          {!isMobile && (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>

                {/* Project Filter */}
                <Select value={selectedProject?.toString() || 'all'} onValueChange={(value) => {
                  const parsed = parseInt(value);
                  onProjectFilterChange?.(isNaN(parsed) ? null : parsed);
                }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects
                    .filter(project => project && typeof project.id === 'number' && project.id != null && !isNaN(project.id))
                    .map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {typeof project.name === 'string' ? project.name : 'Unknown Project'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Month Filter */}
                <Select value={selectedMonth} onValueChange={(value) => {
                  onMonthFilterChange?.(value);
                }}>
                  <SelectTrigger className="w-40">
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

                {/* Sort By */}
                <Select value={sortBy} onValueChange={(value: any) => {
                  onSortChange?.(value);
                }}>
                  <SelectTrigger className="w-44">
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

                {/* Clear Filters */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onProjectFilterChange?.(null);
                    onMonthFilterChange?.('all');
                    onSortChange?.('date_desc');
                  }}
                  className="ml-2"
                >
                  Clear All
                </Button>
              </div>
            </Card>
          )}

          {/* Select All Header (only show when there are entries) */}
          {filteredAndSortedTimeEntries.length > 0 && (
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isAllSelected || isIndeterminate}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedEntries.length === 0
                    ? "Select entries"
                    : `${selectedEntries.length} of ${filteredAndSortedTimeEntries.length} selected`
                  }
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {filteredAndSortedTimeEntries.length} entries
              </div>
            </div>
          )}

          {/* Mobile-Optimized Time Entries List */}
          <div className="space-y-2">
            {filteredAndSortedTimeEntries.map((entry) => {
              const isExpanded = expandedCards.has(entry.id);
              const projectName = projects.find(p => p.id === ((entry as any).pr_project_id || entry.project_id))?.name;

              return (
                <Card
                  key={entry.id}
                  className={`corporate-card border transition-all duration-200 ${
                    selectedEntries.includes(entry.id)
                      ? 'border-teal-300 bg-teal-50/50 shadow-md'
                      : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
                  }`}
                >
                  <CardContent className="p-2.5">
                    {/* Ultra-Compact Main Row */}
                    <div className="flex items-center gap-2">
                      {/* Status & Content in one compact row */}
                      <div className={`p-1.5 rounded-full flex-shrink-0 ${
                        entry.allowable_bill ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {entry.allowable_bill ? (
                          <PlayCircle className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <PauseCircle className="h-3.5 w-3.5 text-gray-500" />
                        )}
                      </div>

                      {/* Main Content Block */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900 truncate leading-tight">
                                {entry.text || 'Time Entry'}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs px-1.5 py-0 flex-shrink-0 ${
                                  entry.allowable_bill
                                    ? 'border-green-200 text-green-700 bg-green-50'
                                    : 'border-gray-200 text-gray-600 bg-gray-50'
                                }`}
                              >
                                {entry.allowable_bill ? 'Bill' : 'Int'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(entry.date)}
                              </span>
                              {projectName && (
                                <span className="flex items-center gap-1 truncate max-w-[80px]">
                                  <User className="h-3 w-3" />
                                  {projectName}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Duration & Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-base font-bold text-teal-600">
                                {formatDuration(toSeconds(getEntryDuration(entry)))}
                              </div>
                            </div>
                            {isMobile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCardExpansion(entry.id)}
                                className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                              >
                                <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: Show all details by default, Mobile: Show expanded details */}
                    {(!isMobile || isExpanded) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 pt-4 border-t border-gray-100"
                      >
                        <div className="space-y-3">
                          {/* Additional Details */}
                          <div className={`grid gap-3 text-sm ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            <div>
                              <span className="text-gray-500">Status:</span>
                              <div className="font-medium">{getStatusName(entry.status_id)}</div>
                            </div>
                            {entry.client_service_id && (
                              <div>
                                <span className="text-gray-500">Activity:</span>
                                <div className="font-medium">{getActivityName(entry.client_service_id)}</div>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Last Updated:</span>
                              <div className="font-medium">{formatLastUpdated(entry)}</div>
                            </div>
                          </div>

                          {entry.pr_package_id && (
                            <div>
                              <span className="text-gray-500">Work Package:</span>
                              <div className="font-medium">{getWorkPackageName(entry)}</div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingEntry(entry)}
                              className="flex-1"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (onDeleteTimeEntry && window.confirm('Are you sure you want to delete this time entry?')) {
                                  await onDeleteTimeEntry(entry.id);
                                }
                              }}
                              className="flex-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>


      {/* Edit Dialog - Use EditTimeEntryDialog */}
      {editingEntry && (
        <EditTimeEntryDialog
          entry={editingEntry}
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSubmit={async (id, data) => {
            if (onUpdateTimeEntry) {
              await onUpdateTimeEntry(id, data);
              setEditingEntry(null);
            }
          }}
          contacts={contacts}
          projects={projects}
          workPackages={workPackages}
          isLoadingWorkPackages={isLoadingWorkPackages}
          onFetchWorkPackages={onFetchWorkPackages}
          isSubmitting={isCreatingTimeEntry}
          timesheetStatuses={timesheetStatuses}
          businessActivities={businessActivities}
          workPackagesByProject={workPackagesByProject}
          getWorkPackageName={getWpName}
        />
      )}

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedEntries.length}
        onBulkUpdate={() => setShowBulkUpdate(true)}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setSelectedEntries([])}
        isLoading={isCreatingTimeEntry}
      />

      {/* Bulk Update Dialog */}
      <BulkUpdateDialog
        isOpen={showBulkUpdate}
        onClose={() => setShowBulkUpdate(false)}
        selectedEntries={getSelectedEntries()}
        onSubmit={handleBulkUpdate}
        isSubmitting={isCreatingTimeEntry}
        contacts={contacts}
        projects={projects}
        timesheetStatuses={timesheetStatuses}
        businessActivities={businessActivities}
      />

      {filteredAndSortedTimeEntries.length === 0 && !isLoading && timeEntries.length > 0 && (
        <Card className="corporate-card text-center py-12">
          <CardContent>
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No entries match your filters</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your project or date filters to see more results.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                // Filters are handled by parent component
              }}
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}

      {timeEntries.length === 0 && !isLoading && (
        <Card className="corporate-card text-center py-12">
          <CardContent>
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No time entries found</h3>
            <p className="text-muted-foreground">
              No time tracking data was retrieved from your Bexio account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};