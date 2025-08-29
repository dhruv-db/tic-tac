import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  DollarSign, 
  User, 
  TrendingUp, 
  Calendar as CalendarIcon,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Timer,
  Users
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Area,
  AreaChart
} from 'recharts';

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

interface AnalyticsProps {
  timeEntries: TimeEntry[];
  contacts: Contact[];
  projects: Project[];
  isLoading: boolean;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export const Analytics = ({ timeEntries, contacts, projects, isLoading }: AnalyticsProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedContact, setSelectedContact] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  // Helper function to parse duration
  const parseDurationToMinutes = (duration: string | number): number => {
    if (typeof duration === 'number') return duration;
    if (typeof duration === 'string') {
      const parts = duration.split(':');
      if (parts.length === 2) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        return hours * 60 + minutes;
      }
    }
    return 0;
  };

  // Apply time filter
  useEffect(() => {
    const now = new Date();
    switch (timeFilter) {
      case "week":
        setDateRange({ from: startOfWeek(now), to: endOfWeek(now) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "all":
      default:
        setDateRange(undefined);
        break;
    }
  }, [timeFilter]);

  // Filter time entries
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      // Date filter
      if (dateRange?.from && dateRange?.to) {
        const entryDate = new Date(entry.date);
        if (!isWithinInterval(entryDate, { start: dateRange.from, end: dateRange.to })) {
          return false;
        }
      }
      
      // Contact filter
      if (selectedContact !== "all" && entry.contact_id?.toString() !== selectedContact) {
        return false;
      }
      
      // Project filter
      if (selectedProject !== "all" && entry.project_id?.toString() !== selectedProject) {
        return false;
      }
      
      return true;
    });
  }, [timeEntries, dateRange, selectedContact, selectedProject]);

  // Calculate KPIs
  const kpiData = useMemo(() => {
    const totalMinutes = filteredEntries.reduce((sum, entry) => 
      sum + parseDurationToMinutes(entry.duration), 0
    );
    
    const billableMinutes = filteredEntries
      .filter(entry => entry.allowable_bill)
      .reduce((sum, entry) => sum + parseDurationToMinutes(entry.duration), 0);

    const billableRate = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;
    const totalEntries = filteredEntries.length;
    const billableEntries = filteredEntries.filter(entry => entry.allowable_bill).length;

    return {
      totalDuration: totalMinutes,
      billableDuration: billableMinutes,
      billableRate,
      totalEntries,
      billableEntries,
      avgDailyTime: totalMinutes / Math.max(1, new Set(filteredEntries.map(e => e.date)).size)
    };
  }, [filteredEntries]);

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Daily chart data
  const dailyChartData = useMemo(() => {
    const dailyData: Record<string, { date: string; total: number; billable: number; nonBillable: number }> = {};
    
    filteredEntries.forEach(entry => {
      const date = entry.date;
      const minutes = parseDurationToMinutes(entry.duration);
      
      if (!dailyData[date]) {
        dailyData[date] = { date, total: 0, billable: 0, nonBillable: 0 };
      }
      
      dailyData[date].total += minutes;
      if (entry.allowable_bill) {
        dailyData[date].billable += minutes;
      } else {
        dailyData[date].nonBillable += minutes;
      }
    });
    
    return Object.values(dailyData)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        date: format(new Date(item.date), 'MMM dd'),
        total: Math.round(item.total / 60 * 100) / 100,
        billable: Math.round(item.billable / 60 * 100) / 100,
        nonBillable: Math.round(item.nonBillable / 60 * 100) / 100
      }));
  }, [filteredEntries]);

  // Project breakdown data
  const projectChartData = useMemo(() => {
    const projectData: Record<string, { name: string; minutes: number; billable: number }> = {};
    
    filteredEntries.forEach(entry => {
      const projectId = entry.project_id;
      const project = projects.find(p => p.id === projectId);
      const projectName = project ? project.name : 'No Project';
      const minutes = parseDurationToMinutes(entry.duration);
      
      if (!projectData[projectName]) {
        projectData[projectName] = { name: projectName, minutes: 0, billable: 0 };
      }
      
      projectData[projectName].minutes += minutes;
      if (entry.allowable_bill) {
        projectData[projectName].billable += minutes;
      }
    });
    
    return Object.values(projectData)
      .sort((a, b) => b.minutes - a.minutes)
      .map((item, index) => ({
        ...item,
        hours: Math.round(item.minutes / 60 * 100) / 100,
        billableHours: Math.round(item.billable / 60 * 100) / 100,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }));
  }, [filteredEntries, projects]);

  // Contact breakdown data
  const contactChartData = useMemo(() => {
    const contactData: Record<string, number> = {};
    
    filteredEntries.forEach(entry => {
      const contactId = entry.contact_id;
      const contact = contacts.find(c => c.id === contactId);
      const contactName = contact ? `${contact.name_1} ${contact.name_2 || ''}`.trim() : 'No Contact';
      const minutes = parseDurationToMinutes(entry.duration);
      
      contactData[contactName] = (contactData[contactName] || 0) + minutes;
    });
    
    return Object.entries(contactData)
      .map(([name, minutes], index) => ({
        name,
        hours: Math.round(minutes / 60 * 100) / 100,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10); // Top 10 contacts
  }, [filteredEntries, contacts]);

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Time Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Period</label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact</label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {`${contact.name_1} ${contact.name_2 || ''}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {timeFilter === "custom" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn(
                      "justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="corporate-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary-subtle">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time</p>
                <p className="text-2xl font-bold">{formatDuration(kpiData.totalDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billable Time</p>
                <p className="text-2xl font-bold text-success">{formatDuration(kpiData.billableDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-info/10">
                <Target className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billable Rate</p>
                <p className="text-2xl font-bold text-info">
                  {Math.round(kpiData.billableRate)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/10">
                <Activity className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold text-warning">{kpiData.totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Time Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Daily Time Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${value}h`, 
                      name === 'billable' ? 'Billable' : name === 'nonBillable' ? 'Non-Billable' : 'Total'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="billable"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="nonBillable"
                    stackId="1"
                    stroke="hsl(var(--muted))"
                    fill="hsl(var(--muted))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Project Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Time by Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value: any) => [`${value}h`, 'Hours']} />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Contact Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Time by Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Tooltip formatter={(value: any) => [`${value}h`, 'Hours']} />
                  <RechartsPieChart dataKey="hours" data={contactChartData} cx="50%" cy="50%" outerRadius={80}>
                    {contactChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </RechartsPieChart>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Summary Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Average Daily Time</span>
              <Badge variant="secondary">{formatDuration(Math.round(kpiData.avgDailyTime))}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Billable Entries</span>
              <Badge variant="secondary">{kpiData.billableEntries} / {kpiData.totalEntries}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Projects</span>
              <Badge variant="secondary">{new Set(filteredEntries.filter(e => e.project_id).map(e => e.project_id)).size}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Contacts</span>
              <Badge variant="secondary">{new Set(filteredEntries.filter(e => e.contact_id).map(e => e.contact_id)).size}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};