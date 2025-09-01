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

  // Auto-fetch work packages for active projects - only when projects or timeEntries change, not when fetch function changes
  useEffect(() => {
    const activeProjectIds = getActiveProjects().map(p => p.id);
    activeProjectIds.forEach(projectId => {
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

// Get projects to display in grid (only those with entries in current week)
const getActiveProjects = () => {
  const activeIds = new Set<number>();
  weekDays.forEach((date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    dedupedEntries.forEach((entry: any) => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      const projId = getProjId(entry);
      if (projId && entryDate === dateStr) activeIds.add(projId);
    });
  });
  return projects.filter((p) => activeIds.has(p.id));
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
  const activeProjects = getActiveProjects();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-title">Time Tracking Grid</h1>
          <p className="text-muted-foreground">Weekly time tracking overview</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Target</p>
                <p className="text-2xl font-bold">{targetHours}:00h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Clock className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Worked</p>
                <p className="text-2xl font-bold">{formatHours(weeklyTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${difference >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <TrendingUp className={`h-5 w-5 ${difference >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className={`text-2xl font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {difference >= 0 ? '+' : ''}{formatHours(Math.abs(difference))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Time Grid
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[200px] text-center">
                {format(weekStart, 'dd.MM')} - {format(weekEnd, 'dd.MM.yyyy')}
              </div>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header Row */}
              <div className="grid grid-cols-8 border-b bg-muted/30">
                <div className="p-4 font-medium">Project</div>
                {weekDays.map((date) => (
                  <div key={date.toISOString()} className="p-4 text-center">
                    <div className="font-medium">{format(date, 'EEE')}</div>
                    <div className="text-sm text-muted-foreground">{format(date, 'dd.MM')}</div>
                  </div>
                ))}
              </div>

              {/* Project Rows */}
              {activeProjects.length === 0 ? (
                 <div className="p-8 text-center text-muted-foreground">
                   <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p className="text-lg font-medium mb-2">No time entries for this week</p>
                   <p className="text-sm">Use the form above to start tracking time.</p>
                 </div>
              ) : (
                activeProjects.map((project) => {
                  const activePackages = getActiveWorkPackagesForProject(project.id);
                  
                  return (
                    <div key={project.id} className="border-b hover:bg-muted/10 transition-colors group">
                      {/* Project Header Row - only show if there are NO work packages with entries */}
                      {activePackages.length === 0 && (
                        <div className="grid grid-cols-8">
                          <div className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-primary">{project.name}</div>
                              <div className="text-sm text-muted-foreground">#{project.nr}</div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetailDialog(new Date(), project)}
                                className="h-6 w-6 p-0 hover:bg-primary/10"
                                title="Open details"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              {weekDays.some((d) => getProjectDayHours(project.id, d) > 0) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteProjectEntriesInWeek(project.id)}
                                  className="h-6 w-6 p-0 hover:bg-destructive/10 text-destructive"
                                  title="Delete all project entries this week"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
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
                              <div key={date.toISOString()} className="p-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Input
                                        type="text"
                                        placeholder="0:00"
                                        value={value}
                                        onChange={(e) => setTimeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') { setTimeInputs(prev => { const p = { ...prev }; delete p[key]; return p; }); } }}
                                        onFocus={() => { if (timeInputs[key] == null && existing) setTimeInputs(prev => ({ ...prev, [key]: existing })); }}
                                        onBlur={() => void save()}
                                        className={cn("h-8 text-center text-sm", dayHours > 0 && "bg-primary/10 font-semibold text-primary")}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{dayEntries.length > 1 ? 'Multiple entries - open details to edit' : 'Enter time (H:MM) • Enter to save • Esc to cancel'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            );
                          })}
                        </div>
                      )}

                       {/* Project Header - when there ARE work packages */}
                       {activePackages.length > 0 && (
                         <div className="grid grid-cols-8 bg-muted/20 group">
                           <div className="p-4 flex items-center justify-between">
                             <div>
                               <div className="font-semibold text-primary">{project.name}</div>
                               <div className="text-sm text-muted-foreground">#{project.nr}</div>
                             </div>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => deleteProjectEntriesInWeek(project.id)}
                               className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-destructive/10 text-destructive"
                               title="Delete all project entries this week"
                             >
                               <Trash2 className="h-3 w-3" />
                             </Button>
                           </div>
                           {weekDays.map((date) => {
                             const aggHours = getProjectDayHours(project.id, date);
                             return (
                               <div key={date.toISOString()} className="p-4 text-center">
                                 {aggHours > 0 ? (
                                   <span className="font-semibold text-primary">{formatHours(aggHours)}</span>
                                 ) : (
                                   <span className="text-muted-foreground">0:00</span>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                       )}

                       {/* Work Package Rows - ALWAYS show input boxes */}
                        {activePackages.map((pkg) => {
                          // Find work package name from fetched data
                          const projectWorkPackages = workPackages?.filter(wp => 
                            (wp as any).pr_project_id === project.id || (wp as any).project_id === project.id
                          ) || [];
                          const workPackage = projectWorkPackages.find(wp => wp.id === pkg.id || wp.id === String(pkg.id));
                          const workPackageName = workPackage?.name || `WP ${pkg.id}`;
                         
                         return (
                           <div key={`${project.id}-${pkg.id}`} className="grid grid-cols-8 pl-6 pr-2 py-1 bg-background/50 group">
                            <div className="p-3 flex items-center justify-between">
                                <div className="font-medium text-sm" title={pkg.name}>
                                  {pkg.name}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteWorkPackageEntriesInWeek(project.id, pkg.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 hover:bg-destructive/10 text-destructive"
                                  title={`Delete all ${pkg.name} entries this week`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                             </div>
                            {weekDays.map((date) => {
                              const dayHours = getProjectDayHours(project.id, date, pkg.id);
                              const dayEntries = getProjectDayEntries(project.id, date, pkg.id);
                              const key = `${project.id}-${pkg.id}-${format(date, 'yyyy-MM-dd')}`;
                              const inputValue = timeInputs[key] || '';

                              return (
                                <div key={`${date.toISOString()}-${pkg.id}`} className="p-2">
                                  <div className="relative">
                                    {/* Always show input box */}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
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
                                              "h-8 text-center text-sm",
                                              dayHours > 0 && "bg-primary/10 font-semibold text-primary"
                                            )}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{dayHours > 0 ? "Existing entry - click to edit" : "Enter time (H:MM) • Enter to save • Esc to cancel"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    
                                    {/* Action buttons for existing entries */}
                                    {dayHours > 0 && (
                                      <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => openDetailDialog(date, project, pkg.id)}
                                           className="h-5 w-5 p-0 hover:bg-primary/10"
                                           title="Edit entry"
                                         >
                                           <Edit3 className="h-3 w-3" />
                                         </Button>
                                        {dayEntries.map((entry: any) => (
                                          <Button
                                            key={entry.id}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDeleteTimeEntry?.(entry.id)}
                                            className="h-5 w-5 p-0 hover:bg-destructive/10 text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        ))}
                                      </div>
                                    )}
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

              {/* Total Row */}
              {activeProjects.length > 0 && (
                <div className="grid grid-cols-8 bg-muted/50 font-medium">
                  <div className="p-4">Total</div>
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
                      <div key={date.toISOString()} className="p-4 text-center">
                        {dayTotal > 0 ? (
                          <span className="font-semibold text-primary">
                            {formatHours(dayTotal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0:00</span>
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