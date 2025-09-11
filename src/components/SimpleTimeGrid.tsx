import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, Edit3, Trash2, Target, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./TimeTrackingList";
import { useToast } from "@/hooks/use-toast";
import { BulkTimeEntryDialog } from "./BulkTimeEntryDialog";

interface SimpleTimeGridProps {
  timeEntries: TimeEntry[];
  projects: any[];
  onCreateTimeEntry?: (data: any) => Promise<void>;
  onUpdateTimeEntry?: (id: number, data: any) => Promise<void>;
  onDeleteTimeEntry?: (id: number) => Promise<void>;
  onDateRangeChange?: (dateRange: { from: Date; to: Date }) => void;
  isLoading: boolean;
  workPackages?: any[];
  isLoadingWorkPackages?: boolean;
  onFetchWorkPackages?: (projectId: number) => Promise<void>;
  hideForm?: boolean;
}

export const SimpleTimeGrid = ({ 
  timeEntries, 
  projects, 
  onCreateTimeEntry,
  onUpdateTimeEntry,
  onDeleteTimeEntry,
  onDateRangeChange,
  isLoading,
  workPackages,
  isLoadingWorkPackages,
  onFetchWorkPackages,
  hideForm = false,
}: SimpleTimeGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const { toast } = useToast();

  // Calculate week range
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Build week date set and de-duplicate entries within this week to avoid double counting
  const weekDateSet = useMemo(() => new Set(weekDays.map((d) => format(d, 'yyyy-MM-dd'))), [currentDate]);
  const dedupedEntries = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of timeEntries) {
      const entryDate = e.date?.includes('T') ? e.date.split('T')[0] : e.date;
      if (!weekDateSet.has(entryDate)) continue;
      const proj = (e as any).pr_project_id ?? (e as any).project_id ?? '';
      const pkg = (e as any).pr_package_id ?? '';
      const key = e.id ? `id:${e.id}` : `c:${entryDate}:${proj}:${pkg}:${typeof e.duration === 'string' ? e.duration : e.duration}`;
      if (!map.has(key)) map.set(key, e);
    }
    return Array.from(map.values());
  }, [timeEntries, weekDateSet]);

  // Navigation
  const navigatePrevious = () => setCurrentDate(subWeeks(currentDate, 1));
  const navigateNext = () => setCurrentDate(addWeeks(currentDate, 1));

  // Notify parent of date range changes
  useEffect(() => {
    onDateRangeChange?.({ from: weekStart, to: weekEnd });
  }, [currentDate, onDateRangeChange]);

  // Auto-fetch work packages for all projects - only when projects or timeEntries change, not when fetch function changes
  useEffect(() => {
    const allProjectIds = getAllProjects().map(p => p.id);
    allProjectIds.forEach(projectId => {
      if (onFetchWorkPackages) {
        onFetchWorkPackages(projectId);
      }
    });
  }, [timeEntries, projects]); // Removed onFetchWorkPackages from dependencies to prevent loop

  // Convert duration to hours
  const durationToHours = (duration: string | number): number => {
    if (typeof duration === 'string') {
      if (duration.includes(':')) {
        const [hours, minutes] = duration.split(':').map(Number);
        return (isNaN(hours) ? 0 : hours) + ((isNaN(minutes) ? 0 : minutes) / 60);
      }
      // Numeric string – treat as seconds
      if (/^\d+$/.test(duration)) {
        const secs = parseInt(duration, 10);
        return secs / 3600;
      }
      const num = parseFloat(duration);
      return isNaN(num) ? 0 : num; // assume already hours
    }
    // number: assume seconds from API
    return (duration as number) / 3600;
  };

  // Format hours as H:MM
  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Helper to get project id from different sources - handle pr_project_id priority
  const getProjId = (e: any): number | undefined => (e.pr_project_id ?? e.project_id) as number | undefined;

  const getProjectDayEntries = (projectId: number, date: Date, packageId?: number | string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dedupedEntries.filter((entry: any) => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      const projMatch = getProjId(entry) === projectId;
      const pkgMatch = packageId == null ? true : (entry.pr_package_id === packageId || entry.pr_package_id?.toString() === String(packageId));
      return projMatch && pkgMatch && entryDate === dateStr;
    });
  };

  // Get total hours for project on specific date (optionally for a work package)
  const getProjectDayHours = (projectId: number, date: Date, packageId?: number | string) => {
    const entries = getProjectDayEntries(projectId, date, packageId);
    return entries.reduce((total, entry) => total + durationToHours(entry.duration), 0);
  };

// Get ALL projects to display in grid (show full project list)
const getAllProjects = () => {
  return projects;
};

  // Get ALL work packages that appear for a project - fetch from API cached data
  const getAllWorkPackagesForProject = (projectId: number) => {
    const pkgSet = new Set<string>();
    // Get packages from existing entries
    timeEntries.forEach((entry: any) => {
      const projMatch = getProjId(entry) === projectId;
      if (projMatch && entry.pr_package_id != null) {
        pkgSet.add(String(entry.pr_package_id));
      }
    });
    
    // Get packages from workPackages prop (fetched from API)
    workPackages?.forEach((wp: any) => {
      if ((wp.pr_project_id ?? wp.project_id) === projectId) {
        pkgSet.add(String(wp.id));
      }
    });
    
    // Return actual work package objects with names
    return Array.from(pkgSet).map(id => {
      const wp = workPackages?.find((w: any) => w.id === id || w.id === String(id));
      return {
        id,
        name: wp?.name || `WP ${id}`,
        ...wp
      };
    });
  };

  // Get active work packages (with hours > 0) for display sorting
  const getActiveWorkPackagesForProject = (projectId: number) => {
    const pkgMap = new Map<string, number>(); 
    weekDays.forEach((date) => {
      const dayEntries = dedupedEntries.filter((entry: any) => {
        const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
        const projMatch = getProjId(entry) === projectId;
        return projMatch && entryDate === format(date, 'yyyy-MM-dd') && entry.pr_package_id != null;
      });
      dayEntries.forEach((e: any) => {
        const key = String(e.pr_package_id);
        const hrs = durationToHours(e.duration);
        pkgMap.set(key, (pkgMap.get(key) || 0) + hrs);
      });
    });
    
    // Return work package objects with names instead of just IDs
    return Array.from(pkgMap.entries())
      .filter(([_, hours]) => hours > 0)
      .map(([id]) => {
        const wp = workPackages?.find((w: any) => w.id === id || w.id === String(id));
        return {
          id,
          name: wp?.name || `WP ${id}`,
          hours: pkgMap.get(id) || 0
        };
      });
  };

  // Calculate totals
  const allProjects = getAllProjects();
  const weeklyTotal = weekDays.reduce((total, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = dedupedEntries.filter(entry => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      return entryDate === dateStr;
    });
    return total + dayEntries.reduce((sum, entry) => sum + durationToHours(entry.duration), 0);
  }, 0);

  const targetHours = 40;
  const difference = weeklyTotal - targetHours;

  // Helper: refresh current week data after mutations
  const refreshWeek = () => onDateRangeChange?.({ from: weekStart, to: weekEnd });
  
  // Handle quick time entry (optionally for a work package)
  const handleQuickEntry = async (projectId: number, date: Date, timeStr: string, packageId?: number | string) => {
    if (!timeStr || timeStr === '0:00') return;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      toast({
        title: "Invalid time format",
        description: "Use format H:MM (e.g., 2:30)",
        variant: "destructive"
      });
      return;
    }

    const durationSeconds = (hours * 3600) + (minutes * 60);
    const project = projects.find(p => p.id === projectId);
    
    // Get work package name from workPackages array
    const workPackage = workPackages?.find(wp => wp.id === packageId || wp.id === String(packageId));
    const workPackageName = workPackage?.name || `WP ${packageId}`;

    const formatSecondsToHM = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.round((sec % 3600) / 60);
      return `${h}:${m.toString().padStart(2, '0')}`;
    };
    
    try {
      await onCreateTimeEntry?.({
        dateRange: { from: date, to: date },
        useDuration: true,
        duration: formatSecondsToHM(durationSeconds),
        text: `${project?.name || 'Project'}${packageId ? ` - ${workPackageName}` : ''} - ${format(date, 'dd.MM.yyyy')}`,
        allowable_bill: true,
        project_id: projectId,
        pr_package_id: packageId != null ? String(packageId) : undefined
      });
      
      // Trigger a refresh so totals and grid reflect immediately
      refreshWeek();
      
      toast({
        title: "Time entry created",
        description: `${timeStr} logged for ${project?.name}${packageId ? ` - ${workPackageName}` : ''}`
      });
    } catch (error) {
      toast({
        title: "Failed to create entry",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Handle key navigation
  const handleKeyPress = (e: React.KeyboardEvent, projectId: number, date: Date, packageId?: number | string) => {
    const key = `${projectId}-${packageId ?? 'p'}-${format(date, 'yyyy-MM-dd')}`;
    const value = timeInputs[key] || '';
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickEntry(projectId, date, value, packageId);
    } else if (e.key === 'Escape') {
      setTimeInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[key];
        return newInputs;
      });
    }
  };

  // Open detailed dialog with pre-filled data
  const openDetailDialog = (date: Date, project?: any, packageId?: number | string) => {
    setSelectedDate(date);
    setSelectedProject(project);
    
    // Find existing entry data for pre-filling
    let initialEntryData = null;
    if (project?.id && date) {
      const entries = getProjectDayEntries(project.id, date, packageId);
      if (entries.length === 1) {
        const entry = entries[0];
        const workPackage = workPackages?.find(wp => wp.id === entry.pr_package_id || wp.id === String(entry.pr_package_id));
        
        initialEntryData = {
          duration: formatHours(durationToHours(entry.duration)),
          project_id: project.id,
          pr_package_id: entry.pr_package_id,
          text: entry.text,
          allowable_bill: entry.allowable_bill,
          date: format(date, 'yyyy-MM-dd'),
          projectName: project.name,
          workPackageName: workPackage?.name || `WP ${entry.pr_package_id}`,
          entryId: entry.id
        };
      }
    }
    
    if (project?.id && onFetchWorkPackages) {
      onFetchWorkPackages(project.id);
    }
    
    // Store initial data for the dialog
    setSelectedProject({
      ...project,
      initialEntryData
    });
    setShowBulkDialog(true);
  };

  // Delete all entries for a project in the current week
  const deleteProjectEntriesInWeek = async (projectId: number) => {
    const weekDates = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
    const ids = timeEntries
      .filter((e: any) => (e.pr_project_id ?? e.project_id) === projectId)
      .filter((e: any) => {
        const entryDate = e.date?.includes('T') ? e.date.split('T')[0] : e.date;
        return weekDates.includes(entryDate);
      })
      .map((e: any) => e.id);

    if (ids.length === 0) {
      toast({ title: 'No entries to delete', description: 'This project has no entries this week.' });
      return;
    }

    const confirm = window.confirm(`Delete ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} for this project this week?`);
    if (!confirm) return;

    try {
      await Promise.all(ids.map((id: number) => onDeleteTimeEntry?.(id)));
      refreshWeek();
      toast({ title: 'Deleted', description: `${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} removed.` });
    } catch {
      toast({ title: 'Failed to delete project entries', variant: 'destructive' });
    }
  };

  // Delete all entries for a work package in the current week
  const deleteWorkPackageEntriesInWeek = async (projectId: number, packageId: number | string) => {
    const weekDates = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
    const ids = timeEntries
      .filter((e: any) => (e.pr_project_id ?? e.project_id) === projectId)
      .filter((e: any) => e.pr_package_id === packageId || e.pr_package_id === String(packageId))
      .filter((e: any) => {
        const entryDate = e.date?.includes('T') ? e.date.split('T')[0] : e.date;
        return weekDates.includes(entryDate);
      })
      .map((e: any) => e.id);

    if (ids.length === 0) {
      toast({ title: 'No entries to delete', description: 'This work package has no entries this week.' });
      return;
    }

    const workPackage = workPackages?.find(wp => wp.id === packageId || wp.id === String(packageId));
    const workPackageName = workPackage?.name || `WP ${packageId}`;
    
    const confirm = window.confirm(`Delete ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} for ${workPackageName} this week?`);
    if (!confirm) return;

    try {
      await Promise.all(ids.map((id: number) => onDeleteTimeEntry?.(id)));
      refreshWeek();
      toast({ title: 'Deleted', description: `${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} removed from ${workPackageName}.` });
    } catch {
      toast({ title: 'Failed to delete work package entries', variant: 'destructive' });
    }
  };
  return (
    <div className="space-y-4">
      {/* Mobile-Optimized Header with Navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-300 shadow-sm">
        <Button variant="outline" size="sm" onClick={navigatePrevious} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-800">
            {format(weekStart, 'dd.MM')} - {format(weekEnd, 'dd.MM.yyyy')}
          </p>
          <p className="text-xs text-gray-600">Week Overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={navigateNext} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-300 rounded-lg p-3 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="h-3 w-3 text-teal-600" />
            <span className="text-xs text-gray-600">Target</span>
          </div>
          <p className="text-sm font-bold text-gray-800">{targetHours}:00h</p>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-3 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="h-3 w-3 text-green-600" />
            <span className="text-xs text-gray-600">Worked</span>
          </div>
          <p className="text-sm font-bold text-gray-800">{formatHours(weeklyTotal)}</p>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-3 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className={`h-3 w-3 ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-xs text-gray-600">Diff</span>
          </div>
          <p className={`text-sm font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {difference >= 0 ? '+' : ''}{formatHours(Math.abs(difference))}
          </p>
        </div>
      </div>

      {/* Mobile-Optimized Time Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[900px] w-full">
              {/* Full Week Header Row */}
              <div className="grid grid-cols-8 border-b bg-muted/30 sticky top-0 z-10">
                <div className="p-2 font-medium text-xs text-center">Project</div>
                {weekDays.map((date) => (
                  <div key={date.toISOString()} className="p-2 text-center">
                    <div className="font-medium text-xs">{format(date, 'EEE')}</div>
                    <div className="text-xs text-muted-foreground">{format(date, 'dd')}</div>
                  </div>
                ))}
              </div>

              {/* Project Rows */}
              {allProjects.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">
                   <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p className="text-lg font-medium mb-2">No projects available</p>
                   <p className="text-sm">Projects will appear here once loaded.</p>
                 </div>
               ) : (
                 allProjects.map((project) => {
                  const activePackages = getActiveWorkPackagesForProject(project.id);
                  
                  return (
                    <div key={project.id} className="border-b hover:bg-muted/10 transition-colors group">
                      {/* Full Week Project Header Row - only show if there are NO work packages with entries */}
                      {activePackages.length === 0 && (
                        <div className="grid grid-cols-8">
                          <div className="p-2 flex items-center">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-primary text-sm truncate">{project.name}</div>
                              <div className="text-xs text-muted-foreground">#{project.nr}</div>
                            </div>
                          </div>
                          {weekDays.map((date) => {
                            const dayHours = getProjectDayHours(project.id, date);
                            const dayEntries = getProjectDayEntries(project.id, date);
                            const key = `${project.id}-p-${format(date, 'yyyy-MM-dd')}`;
                            const existing = dayHours > 0 ? formatHours(dayHours) : '';
                            const value = timeInputs[key] ?? existing;

                            const save = async () => {
                              const newVal = (timeInputs[key] ?? '').trim();
                              if (!newVal || newVal === existing) return;
                                if (dayEntries.length === 1) {
                                  const entry = dayEntries[0];
                                  const newText = entry.text && entry.text.trim().length
                                    ? entry.text
                                    : `${project?.name || 'Project'} - ${format(date, 'dd.MM.yyyy')}`;
                                  await onUpdateTimeEntry?.(entry.id, {
                                    dateRange: { from: date, to: date },
                                    useDuration: true,
                                    duration: newVal,
                                    text: newText,
                                    allowable_bill: entry.allowable_bill ?? true,
                                    project_id: project.id,
                                    pr_package_id: entry.pr_package_id ? String(entry.pr_package_id) : undefined,
                                  });
                                  setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; });
                                  refreshWeek();
                                } else if (dayEntries.length === 0) {
                                  await handleQuickEntry(project.id, date, newVal);
                                  setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; });
                                } else {
                                toast({ title: 'Multiple entries', description: 'Open details to edit individual entries.' });
                                openDetailDialog(date, project);
                              }
                            };

                            return (
                              <div key={date.toISOString()} className="p-1">
                                <Input
                                  type="text"
                                  placeholder="0:00"
                                  value={value}
                                  onChange={(e) => setTimeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') { setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; }); } }}
                                  onFocus={() => { if (timeInputs[key] == null && existing) setTimeInputs(prev => ({ ...prev, [key]: existing })); }}
                                  onBlur={() => void save()}
                                  className={cn("h-8 text-center text-xs", dayHours > 0 && "bg-primary/10 font-semibold text-primary")}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                       {/* Full Week Project Header - when there ARE work packages */}
                       {activePackages.length > 0 && (
                         <div className="grid grid-cols-8 bg-muted/20 group">
                           <div className="p-2 flex items-center">
                             <div className="min-w-0 flex-1">
                               <div className="font-medium text-primary text-sm truncate">{project.name}</div>
                               <div className="text-xs text-muted-foreground">#{project.nr}</div>
                             </div>
                           </div>
                           {weekDays.map((date) => {
                             const aggHours = getProjectDayHours(project.id, date);
                             return (
                               <div key={date.toISOString()} className="p-2 text-center">
                                 {aggHours > 0 ? (
                                   <span className="font-semibold text-primary text-sm">{formatHours(aggHours)}</span>
                                 ) : (
                                   <span className="text-muted-foreground text-xs">0:00</span>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       )}

                       {/* Mobile-Optimized Work Package Rows */}
                        {activePackages.map((pkg) => {
                          // Find work package name from fetched data
                          const projectWorkPackages = workPackages?.filter(wp =>
                            (wp as any).pr_project_id === project.id || (wp as any).project_id === project.id
                          ) || [];
                          const workPackage = projectWorkPackages.find(wp => wp.id === pkg.id || wp.id === String(pkg.id));
                          const workPackageName = workPackage?.name || `WP ${pkg.id}`;

                         return (
                           <div key={`${project.id}-${pkg.id}`} className="grid grid-cols-8 pl-4 pr-1 py-1 bg-background/50 group">
                            <div className="p-2 flex items-center">
                                <div className="font-medium text-xs truncate" title={pkg.name}>
                                  {pkg.name}
                                </div>
                             </div>
                            {weekDays.map((date) => {
                              const dayHours = getProjectDayHours(project.id, date, pkg.id);
                              const dayEntries = getProjectDayEntries(project.id, date, pkg.id);
                              const key = `${project.id}-${pkg.id}-${format(date, 'yyyy-MM-dd')}`;
                              const inputValue = timeInputs[key] || '';

                              return (
                                <div key={`${date.toISOString()}-${pkg.id}`} className="p-1">
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      placeholder="0:00"
                                      value={timeInputs[key] ?? (dayHours > 0 ? formatHours(dayHours) : '')}
                                      onChange={(e) => setTimeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const newVal = (timeInputs[key] ?? '').trim();
                                          if (!newVal) return;
                                          if (dayEntries.length === 1) {
                                            const entry = dayEntries[0];
                                            const wp = workPackages?.find(wp => wp.id === entry.pr_package_id || wp.id === String(entry.pr_package_id) || wp.id === String(pkg.id));
                                            const wpName = wp?.name || `WP ${entry.pr_package_id ?? pkg.id}`;
                                            const newText = entry.text && entry.text.trim().length
                                              ? entry.text
                                              : `${project.name} - ${wpName} - ${format(date, 'dd.MM.yyyy')}`;
                                            void onUpdateTimeEntry?.(entry.id, {
                                              dateRange: { from: date, to: date },
                                              useDuration: true,
                                              duration: newVal,
                                              text: newText,
                                              allowable_bill: entry.allowable_bill ?? true,
                                              project_id: project.id,
                                              pr_package_id: entry.pr_package_id ? String(entry.pr_package_id) : String(pkg.id),
                                            }).then(() => { setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; }); refreshWeek(); });
                                          } else if (dayEntries.length === 0) {
                                             void handleQuickEntry(project.id, date, newVal, pkg.id).then(() => {
                                               setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; });
                                             });
                                          } else {
                             toast({ title: 'Multiple entries', description: 'Open details to edit individual entries.' });
                             openDetailDialog(date, project, pkg.id);
                                          }
                                        } else if (e.key === 'Escape') {
                                          setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; });
                                        }
                                      }}
                                      onFocus={() => { if (timeInputs[key] == null && dayHours > 0) setTimeInputs(prev => ({ ...prev, [key]: formatHours(dayHours) })); }}
                                      onBlur={() => {
                                        const newVal = (timeInputs[key] ?? '').trim();
                                        if (!newVal) return;
                                        if (dayEntries.length === 1) {
                                          const entry = dayEntries[0];
                                          const wp = workPackages?.find(wp => wp.id === entry.pr_package_id || wp.id === String(entry.pr_package_id) || wp.id === String(pkg.id));
                                          const wpName = wp?.name || `WP ${entry.pr_package_id ?? pkg.id}`;
                                          const newText = entry.text && entry.text.trim().length
                                            ? entry.text
                                            : `${project.name} - ${wpName} - ${format(date, 'dd.MM.yyyy')}`;
                                          void onUpdateTimeEntry?.(entry.id, {
                                            dateRange: { from: date, to: date },
                                            useDuration: true,
                                            duration: newVal,
                                            text: newText,
                                            allowable_bill: entry.allowable_bill ?? true,
                                            project_id: project.id,
                                            pr_package_id: entry.pr_package_id ? String(entry.pr_package_id) : String(pkg.id),
                                          }).then(() => { setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; }); refreshWeek(); });
                                } else if (dayEntries.length === 0) {
                                  void handleQuickEntry(project.id, date, newVal, pkg.id).then(() => {
                                    setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; });
                                  });
                                }
                                      }}
                                      className={cn(
                                        "h-8 text-center text-xs",
                                        dayHours > 0 && "bg-primary/10 font-semibold text-primary"
                                      )}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}

              {/* Full Week Total Row */}
              {allProjects.length > 0 && (
                <div className="grid grid-cols-8 bg-muted/50 font-medium">
                  <div className="p-2 font-medium text-sm">Total</div>
                  {weekDays.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayEntries = dedupedEntries.filter(entry => {
                      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
                      return entryDate === dateStr;
                    });
                    const seen = new Set<string>();
                    const dayTotal = dayEntries.reduce((sum, entry: any) => {
                      const key = entry.id ? `id:${entry.id}` : `${entry.date}:${getProjId(entry) ?? ''}:${entry.pr_package_id ?? ''}:${entry.duration}`;
                      if (seen.has(key)) return sum;
                      seen.add(key);
                      return sum + durationToHours(entry.duration);
                    }, 0);

                    return (
                      <div key={date.toISOString()} className="p-2 text-center">
                        {dayTotal > 0 ? (
                          <span className="font-semibold text-primary text-sm">
                            {formatHours(dayTotal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">0:00</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Time Entry Dialog */}
      <BulkTimeEntryDialog
        isOpen={showBulkDialog}
        onClose={() => setShowBulkDialog(false)}
        onSubmit={async (data) => {
          try {
            await onCreateTimeEntry?.({
              dateRange: { from: new Date(data.date), to: new Date(data.date) },
              useDuration: true,
              duration: (() => {
                const s = typeof data.duration === 'number' ? data.duration : 0;
                const h = Math.floor(s / 3600);
                const m = Math.round((s % 3600) / 60);
                return `${h}:${m.toString().padStart(2, '0')}`;
              })(),
              text: data.text || 'Bulk entry',
              allowable_bill: true,
              project_id: data.project_id,
              pr_package_id: data.pr_package_id ? String(data.pr_package_id) : undefined
            });
            setShowBulkDialog(false);
          } catch {}
        }}
        isSubmitting={isLoading}
        contacts={[]}
        projects={projects}
        workPackages={workPackages || []}
        selectedDate={selectedDate}
        selectedProject={selectedProject}
        initialData={selectedProject?.initialEntryData}
      />
    </div>
  );
};