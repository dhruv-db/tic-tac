import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Clock, Edit, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./TimeTrackingList";

interface TimesheetCalendarProps {
  timeEntries: TimeEntry[];
  onEditEntry?: (entry: TimeEntry) => void;
  onDeleteEntry?: (entryId: number) => void;
  isLoading: boolean;
}

export const TimesheetCalendar = ({ timeEntries, onEditEntry, onDeleteEntry, isLoading }: TimesheetCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const formatDuration = (duration: string | number) => {
    if (typeof duration === 'string') {
      return duration;
    }
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEntriesForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timeEntries.filter(entry => entry.date === dateString);
  };

  const getTotalDurationForDate = (entries: TimeEntry[]) => {
    return entries.reduce((total, entry) => {
      if (typeof entry.duration === 'string') {
        const [hours, minutes] = entry.duration.split(':').map(Number);
        return total + (hours * 60 + minutes);
      }
      return total + (entry.duration / 60);
    }, 0);
  };

  const previousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  if (isLoading) {
    return (
      <Card className="corporate-card animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Timesheet Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="corporate-card animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Timesheet Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Header */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground bg-muted/30 rounded">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEntries = getEntriesForDate(day);
            const totalMinutes = getTotalDurationForDate(dayEntries);
            const totalHours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes % 60;
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] p-2 border rounded-lg transition-[var(--transition-smooth)]",
                  isCurrentMonth ? "border-border bg-card" : "border-border/40 bg-muted/20",
                  isTodayDate && "ring-2 ring-primary/50 bg-primary/5",
                  dayEntries.length > 0 && "hover:shadow-[var(--shadow-subtle)]"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-2",
                  !isCurrentMonth && "text-muted-foreground",
                  isTodayDate && "text-primary font-semibold"
                )}>
                  {format(day, 'd')}
                </div>

                {dayEntries.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {totalHours}:{remainingMinutes.toString().padStart(2, '0')}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-16 overflow-y-auto">
                      {dayEntries.slice(0, 3).map((entry) => (
                        <div
                          key={entry.id}
                          className="group relative p-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={entry.allowable_bill ? "default" : "secondary"}
                              className="text-xs h-4 px-1"
                            >
                              {formatDuration(entry.duration)}
                            </Badge>
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0"
                                onClick={() => onEditEntry?.(entry)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                onClick={() => onDeleteEntry?.(entry.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {entry.text && (
                            <div className="text-xs text-muted-foreground truncate mt-1">
                              {entry.text}
                            </div>
                          )}
                        </div>
                      ))}

                      {dayEntries.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEntries.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="h-4 px-2">Sample</Badge>
            <span className="text-sm text-muted-foreground">Billable</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-4 px-2">Sample</Badge>
            <span className="text-sm text-muted-foreground">Non-billable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};