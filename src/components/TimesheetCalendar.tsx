import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Clock, Edit, Trash2, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./TimeTrackingList";
import { useIsMobile } from "@/hooks/use-mobile";

interface TimesheetCalendarProps {
  timeEntries: TimeEntry[];
  onEditEntry?: (entry: TimeEntry) => void;
  onDeleteEntry?: (entryId: number) => void;
  onCreateEntry?: (date: Date) => void;
  isLoading: boolean;
}

export const TimesheetCalendar = ({ timeEntries, onEditEntry, onDeleteEntry, onCreateEntry, isLoading }: TimesheetCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const isMobile = useIsMobile();

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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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
        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className={`${isMobile ? 'h-16' : 'h-24'} bg-muted rounded`}></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="corporate-card animate-fade-in">
      <CardHeader className={`${isMobile ? 'pb-3' : 'pb-6'}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
            <span className={`${isMobile ? 'text-base' : 'text-lg'}`}>Calendar</span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={previousMonth} className={isMobile ? 'h-8 w-8 p-0' : ''}>
              <ChevronLeft className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
            <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-semibold min-w-[100px] text-center`}>
              {format(currentDate, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size={isMobile ? "sm" : "sm"} onClick={nextMonth} className={isMobile ? 'h-8 w-8 p-0' : ''}>
              <ChevronRight className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`${isMobile ? 'p-3' : 'p-6'}`}>
        {/* Calendar Header */}
        <div className={`grid grid-cols-7 gap-1 ${isMobile ? 'mb-2' : 'mb-4'}`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className={`flex items-center justify-center ${isMobile ? 'h-8 p-1' : 'h-10 p-2'} text-center ${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-muted-foreground bg-muted/30 rounded-md border border-border/20`}>
              <span className="leading-none">{isMobile ? day.slice(0, 2) : day}</span>
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
                  `${isMobile ? 'min-h-[80px] p-2' : 'min-h-[120px] p-3'} border rounded-lg transition-[var(--transition-smooth)]`,
                  isCurrentMonth ? "border-border bg-card" : "border-transparent bg-transparent",
                  isTodayDate && "ring-2 ring-primary/50 bg-primary/5",
                  dayEntries.length > 0 && "hover:shadow-[var(--shadow-subtle)]"
                )}
              >
                {isCurrentMonth && (
                  <>
                    <div className={cn(
                      `${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2 flex items-center justify-between`,
                      isTodayDate && "text-primary"
                    )}>
                      <span className="leading-none">{format(day, 'd')}</span>
                      {onCreateEntry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`${isMobile ? 'h-5 w-5 p-0' : 'h-6 w-6 p-0'} opacity-60 hover:opacity-100 rounded-full`}
                          onClick={() => onCreateEntry(day)}
                          title="Add time entry"
                        >
                          <Plus className={`${isMobile ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                        </Button>
                      )}
                    </div>

                    {dayEntries.length > 0 && (
                      <div className="space-y-0.5">
                        <div className={`flex items-center gap-1 ${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground`}>
                          <Clock className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                          <span>
                            {totalHours}:{remainingMinutes.toString().padStart(2, '0')}
                          </span>
                        </div>

                        <div className={`space-y-0.5 ${isMobile ? 'max-h-12' : 'max-h-16'} overflow-y-auto`}>
                          {dayEntries.slice(0, isMobile ? 2 : 3).map((entry) => (
                            <div
                              key={entry.id}
                              className="group relative p-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant={entry.allowable_bill ? "default" : "secondary"}
                                  className={`${isMobile ? 'text-xs h-3 px-1' : 'text-xs h-4 px-1'}`}
                                >
                                  {formatDuration(entry.duration)}
                                </Badge>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`${isMobile ? 'h-3 w-3 p-0' : 'h-4 w-4 p-0'}`}
                                    onClick={() => onEditEntry?.(entry)}
                                  >
                                    <Edit className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`${isMobile ? 'h-3 w-3 p-0' : 'h-4 w-4 p-0'} text-destructive hover:text-destructive`}
                                    onClick={() => onDeleteEntry?.(entry.id)}
                                  >
                                    <Trash2 className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                                  </Button>
                                </div>
                              </div>
                              {entry.text && (
                                <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground truncate mt-0.5`}>
                                  {entry.text}
                                </div>
                              )}
                            </div>
                          ))}

                          {dayEntries.length > (isMobile ? 2 : 3) && (
                            <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground text-center`}>
                              +{dayEntries.length - (isMobile ? 2 : 3)} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className={`flex items-center gap-3 ${isMobile ? 'mt-3 pt-2' : 'mt-6 pt-4'} border-t`}>
          <div className="flex items-center gap-1.5">
            <Badge variant="default" className={`${isMobile ? 'h-3 px-1.5 text-xs' : 'h-4 px-2'}`}>Sample</Badge>
            <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Billable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={`${isMobile ? 'h-3 px-1.5 text-xs' : 'h-4 px-2'}`}>Sample</Badge>
            <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Non-billable</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};