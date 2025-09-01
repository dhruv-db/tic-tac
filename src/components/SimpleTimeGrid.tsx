import { useState, useEffect } from "react";
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

  // Navigation
  const navigatePrevious = () => setCurrentDate(subWeeks(currentDate, 1));
  const navigateNext = () => setCurrentDate(addWeeks(currentDate, 1));

  // Notify parent of date range changes
  useEffect(() => {
    onDateRangeChange?.({ from: weekStart, to: weekEnd });
  }, [currentDate, onDateRangeChange]);

  // Convert duration to hours
  const durationToHours = (duration: string | number): number => {
    if (typeof duration === 'string') {
      if (duration.includes(':')) {
        const [hours, minutes] = duration.split(':').map(Number);
        return hours + (minutes / 60);
      }
      return parseFloat(duration) || 0;
    }
    return duration / 3600;
  };

  // Format hours as H:MM
  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Get entries for specific project/date and optional work package
  const getProjectDayEntries = (projectId: number, date: Date, packageId?: number | string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return timeEntries.filter((entry: any) => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      const projMatch = entry.pr_project_id === projectId || entry.project_id === projectId;
      const pkgMatch = packageId == null ? true : (entry.pr_package_id === packageId || entry.pr_package_id?.toString() === String(packageId));
      return projMatch && pkgMatch && entryDate === dateStr;
    });
  };

  // Get total hours for project on specific date (optionally for a work package)
  const getProjectDayHours = (projectId: number, date: Date, packageId?: number | string) => {
    const entries = getProjectDayEntries(projectId, date, packageId);
    return entries.reduce((total, entry) => total + durationToHours(entry.duration), 0);
  };

  // Get projects to display in grid (show all to allow quick entry everywhere)
  const getActiveProjects = () => {
    return projects;
  };

  // Get ALL work packages that appear for a project (with or without hours)
  const getAllWorkPackagesForProject = (projectId: number) => {
    const pkgSet = new Set<string>();
    // Get packages from existing entries
    timeEntries.forEach((entry: any) => {
      const projMatch = (entry.pr_project_id ?? entry.project_id) === projectId;
      if (projMatch && entry.pr_package_id != null) {
        pkgSet.add(String(entry.pr_package_id));
      }
    });
    // Always include a default work package option for new entries
    if (pkgSet.size === 0) {
      pkgSet.add("1"); // Default work package
    }
    return Array.from(pkgSet).map(id => ({ id }));
  };

  // Get active work packages (with hours > 0) for display sorting
  const getActiveWorkPackagesForProject = (projectId: number) => {
    const pkgMap = new Map<string, number>(); 
    weekDays.forEach((date) => {
      const dayEntries = timeEntries.filter((entry: any) => {
        const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
        const projMatch = (entry.pr_project_id ?? entry.project_id) === projectId;
        return projMatch && entryDate === format(date, 'yyyy-MM-dd') && entry.pr_package_id != null;
      });
      dayEntries.forEach((e: any) => {
        const key = String(e.pr_package_id);
        const hrs = durationToHours(e.duration);
        pkgMap.set(key, (pkgMap.get(key) || 0) + hrs);
      });
    });
    return Array.from(pkgMap.entries())
      .filter(([_, hours]) => hours > 0)
      .map(([id]) => ({ id }));
  };

  // Calculate totals
  const activeProjects = getActiveProjects();
  const weeklyTotal = weekDays.reduce((total, date) => {
    const dayEntries = timeEntries.filter(entry => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      return entryDate === format(date, 'yyyy-MM-dd');
    });
    return total + dayEntries.reduce((sum, entry) => sum + durationToHours(entry.duration), 0);
  }, 0);

  const targetHours = 40;
  const difference = weeklyTotal - targetHours;

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
        text: `Time entry for ${project?.name}${packageId ? ` • WP ${packageId}` : ''}`,
        allowable_bill: true,
        project_id: projectId,
        pr_package_id: packageId != null ? String(packageId) : undefined
      });
      
      // Keep input value until data refresh updates the cell
      // This provides instant visual feedback
      
      toast({
        title: "Time entry created",
        description: `${timeStr} logged for ${project?.name}${packageId ? ` • WP ${packageId}` : ''}`
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

  // Open detailed dialog
  const openDetailDialog = (date: Date, project?: any) => {
    setSelectedDate(date);
    setSelectedProject(project);
    if (project?.id && onFetchWorkPackages) {
      onFetchWorkPackages(project.id);
    }
    setShowBulkDialog(true);
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetailDialog(new Date(), project)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                          {weekDays.map((date) => {
                            const dayHours = getProjectDayHours(project.id, date);
                            const key = `${project.id}-p-${format(date, 'yyyy-MM-dd')}`;
                            const inputValue = timeInputs[key] || '';

                            return (
                              <div key={date.toISOString()} className="p-2">
                                {dayHours > 0 ? (
                                  <div className="text-center">
                                    <Badge variant="default" className="font-semibold">
                                      {formatHours(dayHours)}
                                    </Badge>
                                  </div>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Input
                                          type="text"
                                          placeholder="0:00"
                                          value={inputValue}
                                          onChange={(e) => setTimeInputs(prev => ({
                                            ...prev,
                                            [key]: e.target.value
                                          }))}
                                          onKeyDown={(e) => handleKeyPress(e, project.id, date)}
                                          onBlur={() => {
                                            if (inputValue && inputValue !== '0:00') {
                                              handleQuickEntry(project.id, date, inputValue);
                                            }
                                          }}
                                          className="h-8 text-center text-sm"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Enter time (H:MM) • Enter to save • Esc to cancel</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Project Header - when there ARE work packages */}
                      {activePackages.length > 0 && (
                        <div className="grid grid-cols-8 bg-muted/20">
                          <div className="p-4 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-primary">{project.name}</div>
                              <div className="text-sm text-muted-foreground">#{project.nr}</div>
                            </div>
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
                        return (
                          <div key={`${project.id}-${pkg.id}`} className="grid grid-cols-8 pl-6 pr-2 py-1 bg-background/50">
                            <div className="p-3 flex items-center">
                              <div className="font-medium text-sm">WP {pkg.id}</div>
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
                                            value={dayHours > 0 ? formatHours(dayHours) : inputValue}
                                            onChange={(e) => {
                                              if (dayHours === 0) {
                                                setTimeInputs(prev => ({
                                                  ...prev,
                                                  [key]: e.target.value
                                                }));
                                              }
                                            }}
                                            onKeyDown={(e) => handleKeyPress(e, project.id, date, pkg.id)}
                                            onBlur={() => {
                                              if (dayHours === 0 && inputValue && inputValue !== '0:00') {
                                                handleQuickEntry(project.id, date, inputValue, pkg.id);
                                              }
                                            }}
                                            onFocus={(e) => {
                                              if (dayHours > 0) {
                                                e.target.select();
                                              }
                                            }}
                                            className={cn(
                                              "h-8 text-center text-sm",
                                              dayHours > 0 && "bg-primary/10 font-semibold text-primary"
                                            )}
                                            readOnly={dayHours > 0}
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
                                          onClick={() => openDetailDialog(date, project)}
                                          className="h-5 w-5 p-0 hover:bg-primary/10"
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
                    const dayEntries = timeEntries.filter(entry => {
                      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
                      return entryDate === format(date, 'yyyy-MM-dd');
                    });
                    const dayTotal = dayEntries.reduce((sum, entry) => sum + durationToHours(entry.duration), 0);

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
      />
    </div>
  );
};