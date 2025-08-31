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
}

export const SimpleTimeGrid = ({ 
  timeEntries, 
  projects, 
  onCreateTimeEntry,
  onDeleteTimeEntry,
  onDateRangeChange,
  isLoading 
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

  // Get entries for specific project and date
  const getProjectDayEntries = (projectId: number, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return timeEntries.filter(entry => {
      const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
      return entry.project_id === projectId && entryDate === dateStr;
    });
  };

  // Get total hours for project on specific date
  const getProjectDayHours = (projectId: number, date: Date) => {
    const entries = getProjectDayEntries(projectId, date);
    return entries.reduce((total, entry) => total + durationToHours(entry.duration), 0);
  };

  // Get projects that have entries in current week
  const getActiveProjects = () => {
    const weekDateStrings = weekDays.map(date => format(date, 'yyyy-MM-dd'));
    const activeProjectIds = new Set<number>();
    
    timeEntries.forEach(entry => {
      if (entry.project_id) {
        const entryDate = entry.date?.includes('T') ? entry.date.split('T')[0] : entry.date;
        if (weekDateStrings.includes(entryDate)) {
          activeProjectIds.add(entry.project_id);
        }
      }
    });

    // Show projects with entries, or top 5 projects if none
    const projectsWithEntries = projects.filter(p => activeProjectIds.has(p.id));
    return projectsWithEntries.length > 0 ? projectsWithEntries : projects.slice(0, 5);
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

  // Handle quick time entry
  const handleQuickEntry = async (projectId: number, date: Date, timeStr: string) => {
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

    const duration = (hours * 3600) + (minutes * 60);
    const project = projects.find(p => p.id === projectId);
    
    try {
      await onCreateTimeEntry?.({
        project_id: projectId,
        date: format(date, 'yyyy-MM-dd'),
        duration: duration,
        text: `Time entry for ${project?.name}`,
        allowable_bill: true
      });
      
      // Clear input
      const key = `${projectId}-${format(date, 'yyyy-MM-dd')}`;
      setTimeInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[key];
        return newInputs;
      });
      
      toast({
        title: "Time entry created",
        description: `${timeStr} logged for ${project?.name}`
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
  const handleKeyPress = (e: React.KeyboardEvent, projectId: number, date: Date) => {
    const key = `${projectId}-${format(date, 'yyyy-MM-dd')}`;
    const value = timeInputs[key] || '';
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickEntry(projectId, date, value);
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
        <Button onClick={() => openDetailDialog(new Date())} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Entry
        </Button>
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
                  <p className="text-sm">Click "Add Entry" to start tracking time.</p>
                </div>
              ) : (
                activeProjects.map((project) => (
                  <div key={project.id} className="border-b hover:bg-muted/10 transition-colors group">
                    <div className="grid grid-cols-8">
                      {/* Project Column */}
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
                      
                      {/* Day Columns */}
                      {weekDays.map((date) => {
                        const dayHours = getProjectDayHours(project.id, date);
                        const dayEntries = getProjectDayEntries(project.id, date);
                        const key = `${project.id}-${format(date, 'yyyy-MM-dd')}`;
                        const inputValue = timeInputs[key] || '';

                        return (
                          <div key={date.toISOString()} className="p-2">
                            {dayHours > 0 ? (
                              <div className="text-center group/cell">
                                <Badge variant="default" className="font-semibold cursor-pointer">
                                  {formatHours(dayHours)}
                                </Badge>
                                <div className="flex justify-center gap-1 mt-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDetailDialog(date, project)}
                                    className="h-6 w-6 p-0 hover:bg-primary/10"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  {dayEntries.map(entry => (
                                    <Button
                                      key={entry.id}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onDeleteTimeEntry?.(entry.id)}
                                      className="h-6 w-6 p-0 hover:bg-destructive/10 text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  ))}
                                </div>
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
                  </div>
                ))
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
          await onCreateTimeEntry?.(data);
          setShowBulkDialog(false);
        }}
        isSubmitting={isLoading}
        contacts={[]}
        projects={projects}
        workPackages={[]}
        selectedDate={selectedDate}
        selectedProject={selectedProject}
      />
    </div>
  );
};