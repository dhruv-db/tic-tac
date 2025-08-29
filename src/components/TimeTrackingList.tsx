import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Calendar, User, DollarSign, PlayCircle, PauseCircle, Edit, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { TimeEntryForm } from "./TimeEntryForm";
import { TimesheetCalendar } from "./TimesheetCalendar";
import { EditTimeEntryDialog } from "./EditTimeEntryDialog";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { BulkUpdateDialog } from "./BulkUpdateDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";

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
    startTime: string;
    endTime: string;
    text: string;
    allowable_bill: boolean;
    contact_id?: number;
    project_id?: number;
  }) => Promise<void>;
  onUpdateTimeEntry?: (id: number, data: any) => Promise<void>;
  onDeleteTimeEntry?: (id: number) => Promise<void>;
  onBulkUpdateTimeEntries?: (entries: TimeEntry[], updateData: any) => Promise<void>;
  onBulkDeleteTimeEntries?: (entryIds: number[]) => Promise<void>;
  isCreatingTimeEntry?: boolean;
  contacts: Contact[];
  projects: Project[];
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
  projects 
}: TimeTrackingListProps) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [calendarInitialData, setCalendarInitialData] = useState<any>(null);
  const { toast } = useToast();
  
  // Clear calendar initial data when form is submitted
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
    if (typeof duration === 'number') return duration;
    if (typeof duration === 'string') {
      const parsed = parseFloat(duration);
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

  const totalDuration = timeEntries.reduce((acc, entry) => acc + toSeconds(entry.duration), 0);
  const billableEntries = timeEntries.filter(entry => entry.allowable_bill);
  const totalBillableDuration = billableEntries.reduce((acc, entry) => acc + toSeconds(entry.duration), 0);

  // Selection handlers
  const handleSelectEntry = (entryId: number, checked: boolean) => {
    setSelectedEntries(prev => 
      checked 
        ? [...prev, entryId]
        : prev.filter(id => id !== entryId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedEntries(checked ? timeEntries.map(entry => entry.id) : []);
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
    return timeEntries.filter(entry => selectedEntries.includes(entry.id));
  };

  const isAllSelected = selectedEntries.length === timeEntries.length && timeEntries.length > 0;
  const isIndeterminate = selectedEntries.length > 0 && selectedEntries.length < timeEntries.length;

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Time Tracking</h2>
          <Badge variant="secondary" className="ml-2">
            {timeEntries.length} entries
          </Badge>
        </div>
        
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'list' | 'calendar')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="gap-2">
              <Clock className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {onCreateTimeEntry && (
        <TimeEntryForm 
          onSubmit={onCreateTimeEntry} 
          isSubmitting={isCreatingTimeEntry}
          contacts={contacts}
          projects={projects}
          initialData={calendarInitialData}
        />
      )}

      <Tabs value={activeView} className="space-y-6">
        <TabsContent value="calendar" className="space-y-6">
          <TimesheetCalendar
            timeEntries={timeEntries}
            isLoading={isLoading}
            onEditEntry={setEditingEntry}
            onCreateEntry={(date) => {
              // Set initial data and switch to list view
              setCalendarInitialData({
                dateRange: { from: date, to: date },
                startTime: "09:00",
                endTime: "17:00",
                text: "",
                allowable_bill: true,
              });
              setActiveView('list'); // Switch to list view to show the form
            }}
            onDeleteEntry={async (id) => {
              if (onDeleteTimeEntry && window.confirm('Are you sure you want to delete this time entry?')) {
                await onDeleteTimeEntry(id);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="list" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="corporate-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary-subtle">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="text-2xl font-bold">{formatDuration(totalDuration)}</p>
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
                    <p className="text-2xl font-bold text-success">{formatDuration(totalBillableDuration)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="corporate-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-info/10">
                    <User className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billable Rate</p>
                    <p className="text-2xl font-bold text-info">
                      {totalDuration > 0 ? Math.round((totalBillableDuration / totalDuration) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Select All Header (only show when there are entries) */}
          {timeEntries.length > 0 && (
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isAllSelected || isIndeterminate}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedEntries.length === 0 
                    ? "Select entries" 
                    : `${selectedEntries.length} of ${timeEntries.length} selected`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Time Entries List */}
          <div className="grid gap-4">
            {timeEntries.map((entry) => (
              <Card 
                key={entry.id} 
                className="corporate-card hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.01] cursor-pointer group"
              >
                 <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <Checkbox
                         checked={selectedEntries.includes(entry.id)}
                         onCheckedChange={(checked) => handleSelectEntry(entry.id, checked as boolean)}
                       />
                       <div className="flex-1 space-y-2">
                         <div className="flex items-center gap-3">
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
                         </div>

                         {entry.text && (
                           <p className="text-sm text-muted-foreground group-hover:text-foreground transition-[var(--transition-smooth)]">
                             {entry.text}
                           </p>
                         )}

                         <div className="flex items-center gap-4 text-xs text-muted-foreground">
                           {entry.contact_id && (
                             <span>Contact: {entry.contact_id}</span>
                           )}
                           {entry.project_id && (
                             <span>Project: {entry.project_id}</span>
                           )}
                           {entry.user_id && (
                             <span>User: {entry.user_id}</span>
                           )}
                         </div>
                       </div>
                     </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
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


      {/* Edit Dialog */}
      <EditTimeEntryDialog
        entry={editingEntry}
        contacts={contacts}
        projects={projects}
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        onSubmit={onUpdateTimeEntry || (async () => {})}
        isSubmitting={isCreatingTimeEntry}
      />

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
      />

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