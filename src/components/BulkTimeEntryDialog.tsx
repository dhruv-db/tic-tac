import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, X } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WorkPackage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  pr_project_id?: number;
}

interface BulkTimeEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  contacts: any[];
  projects: any[];
  workPackages: WorkPackage[];
  selectedDate?: Date;
  selectedProject?: any;
}

export const BulkTimeEntryDialog = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  contacts,
  projects,
  workPackages,
  selectedDate,
  selectedProject
}: BulkTimeEntryDialogProps) => {
  const [formData, setFormData] = useState({
    employee: "current-user",
    customer_id: "",
    contact_id: "",
    project_id: selectedProject?.id?.toString() || "",
    activity_id: "",
    status_id: "",
    duration: "1:00",
    date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    billable: true,
    description: "",
    applyTo: {
      MON: false,
      TUE: false,
      WED: false,
      THU: false,
      FRI: false,
      SAT: false,
      SUN: false
    }
  });

  const [bulkMode, setBulkMode] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('week');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);

  const { toast } = useToast();

  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        date: format(selectedDate, "yyyy-MM-dd")
      }));
    }
    if (selectedProject) {
      setFormData(prev => ({
        ...prev,
        project_id: selectedProject.id.toString()
      }));
    }
  }, [selectedDate, selectedProject]);

  // Get days of current week for checkbox labels
  const getWeekDays = () => {
    const date = formData.date ? new Date(formData.date) : new Date();
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({ 
      start: weekStart, 
      end: endOfWeek(weekStart, { weekStartsOn: 1 }) 
    });
  };

  const weekDays = getWeekDays();
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const handleDayToggle = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      applyTo: {
        ...prev.applyTo,
        [day]: checked
      }
    }));
  };

  const parseDuration = (durationStr: string): number => {
    const [hours, minutes] = durationStr.split(':').map(Number);
    return (hours * 60 + minutes) * 60; // Convert to seconds
  };

  const getDateRangeForBulkMode = () => {
    const baseDate = formData.date ? new Date(formData.date) : new Date();
    
    switch (bulkMode) {
      case 'week':
        return {
          from: startOfWeek(baseDate, { weekStartsOn: 1 }),
          to: endOfWeek(baseDate, { weekStartsOn: 1 })
        };
      case 'month':
        const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        return { from: monthStart, to: monthEnd };
      case 'quarter':
        const quarter = Math.floor(baseDate.getMonth() / 3);
        const quarterStart = new Date(baseDate.getFullYear(), quarter * 3, 1);
        const quarterEnd = new Date(baseDate.getFullYear(), (quarter + 1) * 3, 0);
        return { from: quarterStart, to: quarterEnd };
      case 'year':
        const yearStart = new Date(baseDate.getFullYear(), 0, 1);
        const yearEnd = new Date(baseDate.getFullYear(), 11, 31);
        return { from: yearStart, to: yearEnd };
       case 'custom':
         return customDateRange || { from: undefined, to: undefined };
      default:
        return { from: baseDate, to: baseDate };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.duration) {
      toast({
        title: "Validation Error",
        description: "Please enter a duration.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a description.",
        variant: "destructive",
      });
      return;
    }

    // Get selected days for application
    const selectedDays = Object.entries(formData.applyTo)
      .filter(([_, selected]) => selected)
      .map(([day, _]) => day);

    if (selectedDays.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one day to apply the time entry.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dateRange = getDateRangeForBulkMode();
      const duration = parseDuration(formData.duration);

      // Create entries for selected days
      const entries = [];
      if (dateRange?.from && dateRange?.to) {
        const dates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        
        for (const date of dates) {
          const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Convert to our day format
          if (selectedDays.includes(dayName)) {
            entries.push({
              dateRange: { from: date, to: date },
              duration: formatDuration(duration),
              useDuration: true,
              text: formData.description,
              allowable_bill: formData.billable,
              contact_id: formData.contact_id ? parseInt(formData.contact_id) : undefined,
              project_id: formData.project_id ? parseInt(formData.project_id) : undefined,
              client_service_id: formData.activity_id ? parseInt(formData.activity_id) : undefined,
              status_id: formData.status_id ? parseInt(formData.status_id) : undefined
            });
          }
        }
      }

      // Submit all entries
      for (const entry of entries) {
        await onSubmit({
          project_id: formData.project_id ? parseInt(formData.project_id) : undefined,
          date: format(entry.dateRange.from, 'yyyy-MM-dd'),
          duration: parseDuration(formData.duration),
          text: formData.description,
          type: 'work'
        });
      }

      toast({
        title: "Time entries created",
        description: `Created ${entries.length} time entries successfully.`
      });

      onClose();
    } catch (error) {
      toast({
        title: "Failed to create time entries",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>New entry</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Employee */}
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={formData.employee} onValueChange={(value) => setFormData(prev => ({ ...prev, employee: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-user">Current User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customers */}
              <div className="space-y-2">
                <Label>Customers</Label>
                <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All customers</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name_1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact person */}
              <div className="space-y-2">
                <Label>Contact person</Label>
                <Select value={formData.contact_id} onValueChange={(value) => setFormData(prev => ({ ...prev, contact_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No contact</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name_1} (#{contact.nr})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={formData.project_id} onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name} (#{project.nr})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activity */}
              <div className="space-y-2">
                <Label>Activity</Label>
                <Select value={formData.activity_id} onValueChange={(value) => setFormData(prev => ({ ...prev, activity_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No activity</SelectItem>
                    <SelectItem value="5">Default Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status_id} onValueChange={(value) => setFormData(prev => ({ ...prev, status_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No status</SelectItem>
                    <SelectItem value="1">Draft</SelectItem>
                    <SelectItem value="2">Open</SelectItem>
                    <SelectItem value="3">Confirmed</SelectItem>
                    <SelectItem value="4">Partially invoiced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Duration and Date */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      type="text"
                      placeholder="1:00"
                      pattern="[0-9]{1,2}:[0-9]{2}"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Bulk Mode Selection */}
                <div className="space-y-2">
                  <Label>Apply To Mode</Label>
                  <Select value={bulkMode} onValueChange={(value: any) => setBulkMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Range */}
                {bulkMode === 'custom' && (
                  <div className="space-y-2">
                    <Label>Custom Date Range</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange?.from ? (
                            customDateRange.to ? (
                              <>
                                {format(customDateRange.from, "dd.MM.yyyy")} -{" "}
                                {format(customDateRange.to, "dd.MM.yyyy")}
                              </>
                            ) : (
                              format(customDateRange.from, "dd.MM.yyyy")
                            )
                          ) : (
                            <span>Pick date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={customDateRange?.from}
                          selected={customDateRange}
                          onSelect={setCustomDateRange}
                          numberOfMonths={2}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Apply to Days */}
                <div className="space-y-3">
                  <Label>Apply to</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {dayNames.map((day, index) => {
                      const date = weekDays[index];
                      return (
                        <div key={day} className="flex flex-col items-center space-y-2">
                          <Checkbox
                            id={day}
                            checked={formData.applyTo[day as keyof typeof formData.applyTo]}
                            onCheckedChange={(checked) => handleDayToggle(day, checked as boolean)}
                          />
                          <Label htmlFor={day} className="text-xs font-medium">
                            {day}
                          </Label>
                          <div className="text-xs text-muted-foreground">
                            {format(date, "dd.MM")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Billable Toggle */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="billable"
                    checked={formData.billable}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, billable: checked }))}
                  />
                  <Label htmlFor="billable">Billable</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Enter description..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="corporate-button"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  SAVING...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  SAVE
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};