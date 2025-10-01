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
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
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

interface BexioUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  is_superadmin: boolean;
  is_accountant: boolean;
}

interface AnalyticsProps {
  timeEntries: TimeEntry[];
  contacts: Contact[];
  projects: Project[];
  users: BexioUser[];
  isCurrentUserAdmin: boolean;
  currentBexioUserId: number | null;
  isLoading: boolean;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

export const Analytics = ({ timeEntries, contacts, projects, users, isCurrentUserAdmin, currentBexioUserId, isLoading }: AnalyticsProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedContact, setSelectedContact] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [usersChartView, setUsersChartView] = useState<'hours' | 'billability'>('hours');
  const isMobile = useIsMobile();

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

  // Filter time entries - Analytics gets pre-filtered data from parent, no user filtering here
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
      if (selectedProject !== "all") {
        const entryProjectId = (entry as any).pr_project_id || entry.project_id;
        if (entryProjectId?.toString() !== selectedProject) {
          return false;
        }
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

  // Monthly chart data with billability rate
  const monthlyChartData = useMemo(() => {
    const monthlyData: Record<string, { month: string; total: number; billable: number; nonBillable: number; billabilityRate: number }> = {};
    
    filteredEntries.forEach(entry => {
      const monthKey = format(new Date(entry.date), 'yyyy-MM');
      const minutes = parseDurationToMinutes(entry.duration);
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthKey, total: 0, billable: 0, nonBillable: 0, billabilityRate: 0 };
      }
      
      monthlyData[monthKey].total += minutes;
      if (entry.allowable_bill) {
        monthlyData[monthKey].billable += minutes;
      } else {
        monthlyData[monthKey].nonBillable += minutes;
      }
    });
    
    return Object.values(monthlyData)
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .map(item => ({
        ...item,
        month: format(new Date(item.month), 'MMM yyyy'),
        total: Math.round(item.total / 60 * 100) / 100,
        billable: Math.round(item.billable / 60 * 100) / 100,
        nonBillable: Math.round(item.nonBillable / 60 * 100) / 100,
        billabilityRate: item.total > 0 ? Math.round((item.billable / item.total) * 100) : 0
      }));
  }, [filteredEntries]);

  // Project breakdown data
  const projectChartData = useMemo(() => {
    const projectData: Record<string, { name: string; minutes: number; billable: number }> = {};
    
    filteredEntries.forEach(entry => {
      const projectId = (entry as any).pr_project_id || entry.project_id;
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

    const totalMinutes = Object.values(projectData).reduce((sum, item) => sum + item.minutes, 0);
    
    return Object.values(projectData)
      .sort((a, b) => b.minutes - a.minutes)
      .map((item, index) => ({
        ...item,
        hours: Math.round(item.minutes / 60 * 100) / 100,
        billableHours: Math.round(item.billable / 60 * 100) / 100,
        percentage: totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 100) : 0,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }));
  }, [filteredEntries, projects]);

  // User breakdown data
  const userChartData = useMemo(() => {
    const userData: Record<string, { name: string; totalMinutes: number; billableMinutes: number }> = {};
    
    filteredEntries.forEach(entry => {
      const userId = entry.user_id;
      const user = users.find(u => u.id === userId);
      const userName = user ? `${user.firstname} ${user.lastname}` : 'Unknown User';
      const minutes = parseDurationToMinutes(entry.duration);
      
      if (!userData[userName]) {
        userData[userName] = { name: userName, totalMinutes: 0, billableMinutes: 0 };
      }
      
      userData[userName].totalMinutes += minutes;
      if (entry.allowable_bill) {
        userData[userName].billableMinutes += minutes;
      }
    });
    
    if (usersChartView === 'hours') {
      return Object.values(userData)
        .map((item, index) => ({
          name: item.name,
          hours: Math.round(item.totalMinutes / 60 * 100) / 100,
          billableHours: Math.round(item.billableMinutes / 60 * 100) / 100,
          fill: CHART_COLORS[index % CHART_COLORS.length]
        }))
        .sort((a, b) => b.hours - a.hours);
    } else {
      return Object.values(userData)
        .map((item, index) => ({
          name: item.name,
          billableRate: item.totalMinutes > 0 ? Math.round((item.billableMinutes / item.totalMinutes) * 100) : 0,
          fill: CHART_COLORS[index % CHART_COLORS.length]
        }))
        .sort((a, b) => b.billableRate - a.billableRate);
    }
  }, [filteredEntries, users, usersChartView]);

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
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
            {/* Time Range Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {contacts.slice(0, 10).map(contact => (
                    <SelectItem key={contact.id} value={contact.id?.toString() || ''}>
                      {contact.name_1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Filter */}
            <div className={`space-y-1 ${isMobile ? 'col-span-2' : ''}`}>
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border shadow-lg z-50">
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.slice(0, 15).map(project => (
                    <SelectItem key={project.id} value={project.id?.toString() || ''}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range - Full width on mobile */}
            {timeFilter === "custom" && (
              <div className={`space-y-1 ${isMobile ? 'col-span-2' : ''}`}>
                <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(
                      "justify-start text-left font-normal h-8",
                      !dateRange && "text-muted-foreground"
                    )}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "MMM dd")} -{" "}
                            {format(dateRange.to, "MMM dd")}
                          </>
                        ) : (
                          format(dateRange.from, "MMM dd")
                        )
                      ) : (
                        "Pick dates"
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
                      numberOfMonths={isMobile ? 1 : 2}
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
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className="corporate-card">
          <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Total Time</p>
                <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>{formatDuration(kpiData.totalDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-100">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Billable</p>
                <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-green-600`}>{formatDuration(kpiData.billableDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-blue-100">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Billable Rate</p>
                <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-blue-600`}>
                  {Math.round(kpiData.billableRate)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="corporate-card">
          <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-100">
                <Activity className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-orange-600`}>{kpiData.totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Monthly Time Trend with Billability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Time Trend & Billability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    fontSize={isMobile ? 10 : 12}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 60 : 30}
                  />
                  <YAxis yAxisId="left" fontSize={isMobile ? 10 : 12} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} fontSize={isMobile ? 10 : 12} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'billabilityRate') return [`${value}%`, 'Billability'];
                      return [`${value}h`, name === 'billable' ? 'Billable' : 'Non-Billable'];
                    }}
                    labelStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                    contentStyle={{
                      fontSize: isMobile ? '12px' : '14px',
                      padding: isMobile ? '8px' : '12px'
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="billable"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.6}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="nonBillable"
                    stackId="1"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.4}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="billabilityRate"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--warning))', strokeWidth: 2, r: isMobile ? 3 : 4 }}
                  />
                </ComposedChart>
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
            <div className={`${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
              <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={projectChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 30 : 40}
                      outerRadius={isMobile ? 60 : 80}
                      dataKey="hours"
                      label={isMobile ? false : ({ name, hours, percentage }) => `${name}: ${hours}h (${percentage}%)`}
                      labelLine={false}
                    >
                      {projectChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any, props: any) => [
                        `${value}h (${props.payload.percentage}%)`,
                        'Hours'
                      ]}
                      contentStyle={{
                        fontSize: isMobile ? '12px' : '14px',
                        padding: isMobile ? '8px' : '12px'
                      }}
                    />
                  </RechartsPieChart>
               </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Hours/Billability Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className={`${isMobile ? 'text-sm' : 'text-base'}`}>
                  {usersChartView === 'hours' ? 'Hours by User' : 'Billability by User'}
                </span>
              </CardTitle>
              <div className={`flex gap-1 ${isMobile ? 'flex-col' : 'flex-row'}`}>
                <Button
                  variant={usersChartView === 'hours' ? 'default' : 'outline'}
                  size={isMobile ? "sm" : "sm"}
                  onClick={() => setUsersChartView('hours')}
                  className={isMobile ? 'text-xs px-2 py-1 h-7' : ''}
                >
                  Hours
                </Button>
                <Button
                  variant={usersChartView === 'billability' ? 'default' : 'outline'}
                  size={isMobile ? "sm" : "sm"}
                  onClick={() => setUsersChartView('billability')}
                  className={isMobile ? 'text-xs px-2 py-1 h-7' : ''}
                >
                  Billability
                </Button>
              </div>
            </div>
          </CardHeader>
           <CardContent>
             <div className={`${isMobile ? 'h-[250px]' : 'h-[300px]'}`}>
               <ResponsiveContainer width="100%" height="100%">
                  {usersChartView === 'hours' ? (
                    <BarChart data={userChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        fontSize={isMobile ? 10 : 12}
                        angle={isMobile ? -45 : 0}
                        textAnchor={isMobile ? 'end' : 'middle'}
                        height={isMobile ? 60 : 30}
                      />
                      <YAxis fontSize={isMobile ? 10 : 12} />
                      <Tooltip
                        formatter={(value: any) => [`${value}h`, 'Hours']}
                        labelFormatter={(label) => isMobile ? label.split(' ')[0] : `User: ${label}`}
                        contentStyle={{
                          fontSize: isMobile ? '12px' : '14px',
                          padding: isMobile ? '8px' : '12px'
                        }}
                      />
                      <Bar dataKey="hours" fill="hsl(var(--primary))" />
                    </BarChart>
                 ) : (
                   <RechartsPieChart>
                     <Pie
                       data={userChartData}
                       cx="50%"
                       cy="50%"
                       innerRadius={isMobile ? 30 : 40}
                       outerRadius={isMobile ? 60 : 80}
                       dataKey="billableRate"
                       label={isMobile ? false : ({ name, billableRate }) => `${name}: ${billableRate}%`}
                       labelLine={false}
                     >
                       {userChartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} />
                       ))}
                     </Pie>
                     <Tooltip
                       formatter={(value: any) => [`${value}%`, 'Billable Rate']}
                       contentStyle={{
                         fontSize: isMobile ? '12px' : '14px',
                         padding: isMobile ? '8px' : '12px'
                       }}
                     />
                   </RechartsPieChart>
                 )}
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