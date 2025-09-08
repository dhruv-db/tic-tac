import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Calendar, User, DollarSign, PlayCircle, PauseCircle, Edit, Trash2, CalendarDays, Filter, X, ArrowUpDown } from "lucide-react";
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
  getWorkPackageName: getWpName
}: TimeTrackingListProps) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [monthYearFilter, setMonthYearFilter] = useState<string>(() => {
    // Default to current month
    const now = new Date();
    return format(now, "yyyy-MM");
  });
  const [sortBy, setSortBy] = useState<'date' | 'updated' | 'duration'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  // Filter and sort time entries
  const filteredAndSortedTimeEntries = (timeEntries || [])
    .filter(entry => {
      // Project filter
      if (projectFilter && projectFilter !== "all") {
        if (projectFilter === "none" && ((entry as any).pr_project_id || entry.project_id)) return false;
        if (projectFilter !== "none") {
          const entryProjectId = (entry as any).pr_project_id || entry.project_id;
          if (entryProjectId?.toString() !== projectFilter) return false;
        }
      }
      
      // Month/Year filter
      if (monthYearFilter && monthYearFilter !== "all") {
        try {
          const entryDate = new Date(entry.date);
          const entryMonthYear = format(entryDate, "yyyy-MM");
          if (entryMonthYear !== monthYearFilter) return false;
        } catch {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'updated':
          const aUpdated = a.updated_at || a.created_at || a.date;
          const bUpdated = b.updated_at || b.created_at || b.date;
          comparison = new Date(aUpdated).getTime() - new Date(bUpdated).getTime();
          break;
        case 'duration':
          comparison = toSeconds(a.duration) - toSeconds(b.duration);
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get unique month/year options from time entries
  const getMonthYearOptions = () => {
    const monthYears = new Set<string>();
    (timeEntries || []).forEach(entry => {
      try {
        const date = new Date(entry.date);
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
    if (!entry.pr_package_id) return 'No Work Package';
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

  const handleSortChange = (field: 'date' | 'updated' | 'duration') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
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
    <div className={`space-y-6 animate-fade-in ${isMobile ? 'mobile-container' : ''}`}>


      <Tabs value="list" className="space-y-6">
        <TabsContent value="list" className="space-y-6">
          {/* Filters and Sorting */}
          <Card className="corporate-card">
            <CardContent className={`p-4 ${isMobile ? 'p-3' : ''}`}>
              <div className={`grid gap-4 items-start ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap xl:items-center'}`}>
                <div className="flex items-center gap-2 col-span-full xl:col-span-1">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters & Sort:</span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-muted-foreground">Project:</label>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className={`w-full min-w-[200px] ${isMobile ? 'mobile-button' : ''}`}>
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-popover border border-border shadow-lg">
                      <SelectItem value="all">All projects</SelectItem>
                      <SelectItem value="none">No project assigned</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name} (#{project.nr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-muted-foreground">Month:</label>
                  <Select value={monthYearFilter} onValueChange={setMonthYearFilter}>
                    <SelectTrigger className={`w-full min-w-[140px] ${isMobile ? 'mobile-button' : ''}`}>
                      <SelectValue placeholder="All months" />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-popover border border-border shadow-lg">
                      <SelectItem value="all">All months</SelectItem>
                      {getMonthYearOptions().map((monthYear) => (
                        <SelectItem key={monthYear} value={monthYear}>
                          {format(new Date(monthYear + "-01"), "MMM yyyy")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-muted-foreground">Sort by:</label>
                  <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                    const [field, order] = value.split('-') as [typeof sortBy, typeof sortOrder];
                    setSortBy(field);
                    setSortOrder(order);
                  }}>
                    <SelectTrigger className={`w-full min-w-[160px] ${isMobile ? 'mobile-button' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[1000] bg-popover border border-border shadow-lg">
                      <SelectItem value="updated-desc">Latest Updated</SelectItem>
                      <SelectItem value="updated-asc">Oldest Updated</SelectItem>
                      <SelectItem value="date-desc">Latest Date</SelectItem>
                      <SelectItem value="date-asc">Oldest Date</SelectItem>
                      <SelectItem value="duration-desc">Duration High</SelectItem>
                      <SelectItem value="duration-asc">Duration Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(projectFilter || monthYearFilter !== format(new Date(), "yyyy-MM")) && (
                  <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <div className="h-5"></div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProjectFilter("");
                        setMonthYearFilter(format(new Date(), "yyyy-MM"));
                      }}
                      className="gap-1 justify-start"
                    >
                      <X className="h-3 w-3" />
                      Reset to Current Month
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                Showing {filteredAndSortedTimeEntries.length} entries • Sorted by {sortBy === 'updated' ? 'Last Updated' : sortBy === 'date' ? 'Date' : 'Duration'} ({sortOrder === 'desc' ? 'newest' : 'oldest'} first)
              </div>
            </div>
          )}

          {/* Time Entries List */}
          <div className="grid gap-4">
            {filteredAndSortedTimeEntries.map((entry) => (
              <Card 
                key={entry.id} 
                className="corporate-card hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.01] cursor-pointer group"
              >
                 <CardContent className="p-6">
                   <div className="flex items-start justify-between">
                     <div className="flex items-start gap-3 flex-1">
                       <Checkbox
                         checked={selectedEntries.includes(entry.id)}
                         onCheckedChange={(checked) => handleSelectEntry(entry.id, checked as boolean)}
                       />
                       
                       <div className="flex-1 space-y-3">
                         {/* Header Row */}
                         <div className="flex items-center gap-3 flex-wrap">
                           <div className={`p-1.5 rounded-full ${entry.allowable_bill ? 'bg-success/10' : 'bg-muted'}`}>
                             {entry.allowable_bill ? (
                               <PlayCircle className="h-4 w-4 text-success" />
                             ) : (
                               <PauseCircle className="h-4 w-4 text-muted-foreground" />
                             )}
                           </div>
                           
                           <div className="flex items-center gap-2">
                             <Calendar className="h-4 w-4 text-muted-foreground" />
                             <span className="font-medium">{formatDate(entry.date)}</span>
                           </div>

                           <Badge 
                             variant={entry.allowable_bill ? "default" : "secondary"}
                             className={entry.allowable_bill ? "bg-success text-success-foreground" : ""}
                           >
                             {entry.allowable_bill ? "Billable" : "Non-billable"}
                           </Badge>

                           <Badge variant="outline" className="text-xs">
                             {getStatusName(entry.status_id)}
                           </Badge>
                         </div>

                          {/* Description */}
                          {entry.text && (
                            <div className="bg-muted/50 p-3 rounded-md">
                              <p className="text-sm group-hover:text-foreground transition-[var(--transition-smooth)]">
                                {entry.text}
                              </p>
                            </div>
                          )}

                           {/* Essential Details */}
                           <div className="flex items-center gap-4 flex-wrap text-sm">
                             {/* Project Name */}
                             {((entry as any).pr_project_id || entry.project_id) && (
                               <div className="flex items-center gap-2">
                                 <User className="h-4 w-4 text-muted-foreground" />
                                 <span className="font-medium">
                                   {projects.find(p => p.id === ((entry as any).pr_project_id || entry.project_id))?.name || 'Unknown Project'}
                                 </span>
                               </div>
                             )}
                             
                             {entry.client_service_id && (
                               <div className="flex items-center gap-2">
                                 <Clock className="h-4 w-4 text-muted-foreground" />
                                 <span className="font-medium">
                                   {getActivityName(entry.client_service_id)}
                                 </span>
                               </div>
                             )}
                             
                             {entry.pr_package_id && (
                               <div className="flex items-center gap-2">
                                 <DollarSign className="h-4 w-4 text-muted-foreground" />
                                 <span className="font-medium">
                                   {getWorkPackageName(entry)}
                                 </span>
                               </div>
                             )}
                           </div>
                       </div>
                     </div>

                    {/* Right side - Duration and Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold group-hover:text-primary transition-[var(--transition-smooth)]">
                          {formatDuration(toSeconds(entry.duration))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {entry.id}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingEntry(entry)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (onDeleteTimeEntry && window.confirm('Are you sure you want to delete this time entry?')) {
                              await onDeleteTimeEntry(entry.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                setProjectFilter("");
                setMonthYearFilter("");
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