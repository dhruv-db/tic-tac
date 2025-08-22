import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, User, DollarSign, PlayCircle, PauseCircle } from "lucide-react";
import { format } from "date-fns";
import { TimeEntryForm } from "./TimeEntryForm";
import { DateRange } from "react-day-picker";

interface TimeEntry {
  id: number;
  date: string;
  duration: number;
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
  isCreatingTimeEntry?: boolean;
  contacts: Contact[];
  projects: Project[];
}

export const TimeTrackingList = ({ 
  timeEntries, 
  isLoading, 
  onCreateTimeEntry, 
  isCreatingTimeEntry = false, 
  contacts, 
  projects 
}: TimeTrackingListProps) => {
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

  const totalDuration = timeEntries.reduce((acc, entry) => acc + entry.duration, 0);
  const billableEntries = timeEntries.filter(entry => entry.allowable_bill);
  const totalBillableDuration = billableEntries.reduce((acc, entry) => acc + entry.duration, 0);

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
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-semibold">Time Tracking</h2>
        <Badge variant="secondary" className="ml-2">
          {timeEntries.length} entries
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[var(--gradient-subtle)] border-primary/20">
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

        <Card className="bg-[var(--gradient-subtle)] border-success/20">
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

        <Card className="bg-[var(--gradient-subtle)] border-info/20">
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

      {/* Add Time Entry Form */}
      {onCreateTimeEntry && (
      <TimeEntryForm 
        onSubmit={onCreateTimeEntry} 
        isSubmitting={isCreatingTimeEntry}
        contacts={contacts}
        projects={projects}
      />
      )}

      {/* Time Entries List */}
      <div className="grid gap-4">
        {timeEntries.map((entry) => (
          <Card 
            key={entry.id} 
            className="hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.01] cursor-pointer group"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
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

                <div className="text-right">
                  <div className="text-2xl font-bold group-hover:text-primary transition-[var(--transition-smooth)]">
                    {formatDuration(entry.duration)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: {entry.id}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {timeEntries.length === 0 && !isLoading && (
        <Card className="text-center py-12">
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