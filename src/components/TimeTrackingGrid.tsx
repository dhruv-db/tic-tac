
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, MoreHorizontal, Target, TrendingUp, Users } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, isSameDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./TimeTrackingList";

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
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Track Time
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
                      <div className="grid grid-cols-8 hover:bg-muted/10 transition-colors">
                        <div className="p-4 pl-6">
                          <div className="text-sm text-muted-foreground">Support</div>
                        </div>
                        {dateRange.slice(0, 7).map((date) => (
                          <div key={date.toISOString()} className="p-2">
                            <Input
                              type="text"
                              placeholder="0:00"
                              className="h-8 text-center text-sm"
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        ))}
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
    </div>
  );
};
