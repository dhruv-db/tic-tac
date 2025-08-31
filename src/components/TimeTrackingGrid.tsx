
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, MoreHorizontal, Target, TrendingUp, Users, Save, Edit3, Trash2, Timer } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, isSameDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./TimeTrackingList";
import { useToast } from "@/hooks/use-toast";

interface TimeTrackingGridProps {
  timeEntries: TimeEntry[];
  contacts: any[];
  projects: any[];
  onCreateTimeEntry?: (data: any) => Promise<void>;
  onUpdateTimeEntry?: (id: number, data: any) => Promise<void>;
  isLoading: boolean;
}

export const TimeTrackingGrid = ({ 
  timeEntries, 
  contacts, 
  projects, 
  onCreateTimeEntry,
  onUpdateTimeEntry,
  isLoading 
}: TimeTrackingGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedProjectForDialog, setSelectedProjectForDialog] = useState<any>(null);
  const { toast } = useToast();

  // Calculate date ranges
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const dateRange = viewType === 'week' 
    ? eachDayOfInterval({ start: weekStart, end: weekEnd })
    : eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Navigation functions
  const navigatePrevious = () => {
    if (viewType === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewType === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  // Get entries for a specific date
  const getEntriesForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timeEntries.filter(entry => entry.date === dateString);
  };

  // Calculate total hours for date range
  const getTotalHours = () => {
    return timeEntries.reduce((total, entry) => {
      const duration = typeof entry.duration === 'string' 
        ? parseFloat(entry.duration.replace(':', '.')) 
        : entry.duration / 3600;
      return total + duration;
    }, 0);
  };

  const formatDuration = (seconds: number | string) => {
    if (typeof seconds === 'string') return seconds;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Handle time input changes
  const handleTimeInputChange = (projectId: number, date: Date, value: string) => {
    const key = `${projectId}-${format(date, 'yyyy-MM-dd')}`;
    setTimeInputs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Convert time string to seconds
  const timeStringToSeconds = (timeStr: string): number => {
    if (!timeStr || timeStr === '0:00') return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0] || '0');
    const minutes = parseInt(parts[1] || '0');
    return (hours * 3600) + (minutes * 60);
  };

  // Validate time format
  const isValidTimeFormat = (timeStr: string): boolean => {
    if (!timeStr) return true;
    const timeRegex = /^(\d{1,2}):(\d{2})$/;
    const match = timeStr.match(timeRegex);
    if (!match) return false;
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };

  // Save time entry
  const saveTimeEntry = async (projectId: number, date: Date, timeValue: string) => {
    if (!timeValue || timeValue === '0:00') return;
    
    if (!isValidTimeFormat(timeValue)) {
      toast({
        title: "Invalid time format",
        description: "Please use format HH:MM (e.g., 2:30 for 2 hours 30 minutes)",
        variant: "destructive"
      });
      return;
    }

    const duration = timeStringToSeconds(timeValue);
    const project = projects.find(p => p.id === projectId);
    
    try {
      await onCreateTimeEntry?.({
        project_id: projectId,
        date: format(date, 'yyyy-MM-dd'),
        duration: duration,
        text: `Time tracked for ${project?.name || 'project'}`,
        type: 'work'
      });
      
      toast({
        title: "Time entry saved",
        description: `${timeValue} logged for ${project?.name || 'project'}`
      });
      
      // Clear the input
      const key = `${projectId}-${format(date, 'yyyy-MM-dd')}`;
      setTimeInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[key];
        return newInputs;
      });
      
    } catch (error) {
      toast({
        title: "Failed to save time entry",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent, projectId: number, date: Date, value: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTimeEntry(projectId, date, value);
    } else if (e.key === 'Escape') {
      const key = `${projectId}-${format(date, 'yyyy-MM-dd')}`;
      setTimeInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[key];
        return newInputs;
      });
      setEditingCell(null);
    }
  };

  // Open quick time dialog
  const openTimeDialog = (date: Date, project: any) => {
    setSelectedDate(date);
    setSelectedProjectForDialog(project);
    setShowTimeDialog(true);
  };

  // Mock data for demonstration
  const targetHours = 40;
  const totalWorkedHours = getTotalHours();
  const difference = totalWorkedHours - targetHours;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-title">Time Tracking</h1>
          <p className="text-muted-foreground">Manage your work hours and track productivity</p>
        </div>
          <div className="flex items-center gap-2">
            <Button className="gap-2 corporate-button" onClick={() => setShowTimeDialog(true)}>
              <Timer className="h-4 w-4" />
              Quick Track
            </Button>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="corporate-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Target Hours</p>
                <p className="text-2xl font-bold">{targetHours}:00<span className="text-sm font-normal text-muted-foreground ml-1">h</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Clock className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Worked</p>
                <p className="text-2xl font-bold">{totalWorkedHours.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">h</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${difference >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <TrendingUp className={`h-5 w-5 ${difference >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className={`text-2xl font-bold ${difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {difference >= 0 ? '+' : ''}{difference.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Users className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="corporate-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Employee:</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="current">Current User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Customer:</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.name_1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Project:</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm font-medium">View:</label>
              <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'week' | 'month')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Tracking Grid */}
      <Card className="corporate-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Track Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[200px] text-center">
                {viewType === 'week' 
                  ? `${format(weekStart, 'dd.MM')} - ${format(weekEnd, 'dd.MM.yyyy')}`
                  : format(currentDate, 'MMMM yyyy')
                }
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
                <div className="p-4 font-medium">Project / Task</div>
                {dateRange.slice(0, 7).map((date) => (
                  <div key={date.toISOString()} className="p-4 text-center">
                    <div className="font-medium">{format(date, 'EEE')}</div>
                    <div className="text-sm text-muted-foreground">{format(date, 'dd.MM')}</div>
                  </div>
                ))}
              </div>

              {/* Project Rows */}
              {projects.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No projects available. Connect to Bexio to load your projects.</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="border-b">
                    {/* Project Header */}
                    <div className="grid grid-cols-8 bg-card hover:bg-muted/20 transition-colors">
                      <div className="p-4">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-muted-foreground">#{project.nr}</div>
                      </div>
                      {dateRange.slice(0, 7).map((date) => {
                        const entries = getEntriesForDate(date).filter(e => e.project_id === project.id);
                        const totalHours = entries.reduce((sum, entry) => {
                          const duration = typeof entry.duration === 'string' 
                            ? parseFloat(entry.duration.replace(':', '.')) 
                            : entry.duration / 3600;
                          return sum + duration;
                        }, 0);

                        return (
                          <div key={date.toISOString()} className="p-2">
                            {totalHours > 0 ? (
                              <div className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  {totalHours.toFixed(1)}h
                                </Badge>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-primary/10"
                                  onClick={() => {
                                    // Handle add time entry
                                    console.log('Add time entry for', date, project);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Task Rows */}
                    <div className="ml-8 border-l-2 border-muted">
                      <div className="grid grid-cols-8 hover:bg-muted/10 transition-[var(--transition-smooth)]">
                        <div className="p-4 pl-6">
                          <div className="text-sm text-muted-foreground">General Work</div>
                        </div>
                        {dateRange.slice(0, 7).map((date) => {
                          const key = `${project.id}-${format(date, 'yyyy-MM-dd')}`;
                          const inputValue = timeInputs[key] || '';
                          const isEditing = editingCell === key;
                          
                          return (
                            <div key={date.toISOString()} className="p-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Input
                                      type="text"
                                      placeholder="0:00"
                                      value={inputValue}
                                      onChange={(e) => handleTimeInputChange(project.id, date, e.target.value)}
                                      onFocus={(e) => {
                                        e.target.select();
                                        setEditingCell(key);
                                      }}
                                      onBlur={() => {
                                        if (inputValue && inputValue !== '0:00') {
                                          saveTimeEntry(project.id, date, inputValue);
                                        }
                                        setEditingCell(null);
                                      }}
                                      onKeyDown={(e) => handleKeyDown(e, project.id, date, inputValue)}
                                      className={cn(
                                        "h-8 text-center text-sm transition-[var(--transition-smooth)]",
                                        isEditing && "ring-2 ring-primary border-primary",
                                        inputValue && "bg-primary-subtle/30 border-primary/30"
                                      )}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enter time (e.g., 2:30) • Enter to save • Esc to cancel</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Total Row */}
              <div className="grid grid-cols-8 bg-muted/50 font-medium">
                <div className="p-4">Total</div>
                {dateRange.slice(0, 7).map((date) => {
                  const entries = getEntriesForDate(date);
                  const totalHours = entries.reduce((sum, entry) => {
                    const duration = typeof entry.duration === 'string' 
                      ? parseFloat(entry.duration.replace(':', '.')) 
                      : entry.duration / 3600;
                    return sum + duration;
                  }, 0);

                  return (
                    <div key={date.toISOString()} className="p-4 text-center">
                      {totalHours > 0 ? `${totalHours.toFixed(1)}h` : '-'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Time Entry Dialog */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent className="corporate-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Quick Time Entry
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select 
                value={selectedProjectForDialog?.id?.toString() || ''} 
                onValueChange={(value) => {
                  const project = projects.find(p => p.id.toString() === value);
                  setSelectedProjectForDialog(project);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name} (#{project.nr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Time (HH:MM)</label>
              <Input
                type="text"
                placeholder="e.g., 2:30"
                className="text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedProjectForDialog && selectedDate) {
                    const input = e.target as HTMLInputElement;
                    saveTimeEntry(selectedProjectForDialog.id, selectedDate, input.value);
                    setShowTimeDialog(false);
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                placeholder="What did you work on?"
                className="resize-none"
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowTimeDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="corporate-button gap-2"
                onClick={() => {
                  // This would be handled by the onKeyDown above in real usage
                  setShowTimeDialog(false);
                }}
              >
                <Save className="h-4 w-4" />
                Save Time
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
