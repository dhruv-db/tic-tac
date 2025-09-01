import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";

interface TimeEntryFormData {
  dateRange: DateRange | undefined;
  startTime: string;
  endTime: string;
  duration: string;
  useDuration: boolean;
  text: string;
  allowable_bill: boolean;
  contact_id?: number;
  project_id?: number;
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

interface WorkPackage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  pr_project_id?: number;
}

interface TimeEntryFormProps {
  onSubmit: (data: TimeEntryFormData) => Promise<void>;
  isSubmitting: boolean;
  contacts: Contact[];
  projects: Project[];
  workPackages: WorkPackage[];
  isLoadingWorkPackages: boolean;
  onFetchWorkPackages: (projectId: number) => Promise<void>;
  initialData?: Partial<TimeEntryFormData>;
  hideFormWrapper?: boolean;
}

import { useBexioApi } from "@/hooks/useBexioApi";

export const TimeEntryForm = ({ 
  onSubmit, 
  isSubmitting, 
  contacts, 
  projects, 
  workPackages,
  isLoadingWorkPackages,
  onFetchWorkPackages,
  initialData,
  hideFormWrapper = false
}: TimeEntryFormProps) => {
  const { 
    timesheetStatuses, 
    isLoadingStatuses, 
    fetchTimesheetStatuses,
    businessActivities,
    isLoadingActivities,
    fetchBusinessActivities
  } = useBexioApi();
  
  const getContactName = (contact: Contact) => {
    const names = [contact.name_1, contact.name_2].filter(Boolean);
    return names.length > 0 ? names.join(' ') : 'Unnamed Contact';
  };
  const [formData, setFormData] = useState<TimeEntryFormData>({
    dateRange: initialData?.dateRange || undefined,
    startTime: initialData?.startTime || "09:00",
    endTime: initialData?.endTime || "17:00",
    duration: initialData?.duration || "08:00",
    useDuration: initialData?.useDuration || false,
    text: initialData?.text || "",
    allowable_bill: initialData?.allowable_bill ?? true,
    contact_id: initialData?.contact_id,
    project_id: initialData?.project_id,
    client_service_id: initialData?.client_service_id,
    status_id: initialData?.status_id,
    pr_package_id: initialData?.pr_package_id,
    pr_milestone_id: initialData?.pr_milestone_id,
  });
  const [isOpen, setIsOpen] = useState(!!initialData?.dateRange);
  const { toast } = useToast();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const lastProjectIdRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const currentProjectId = formData.project_id;
    if (currentProjectId && lastProjectIdRef.current !== currentProjectId) {
      lastProjectIdRef.current = currentProjectId;
      onFetchWorkPackages(currentProjectId);
    }
    if (!currentProjectId && lastProjectIdRef.current !== undefined) {
      lastProjectIdRef.current = undefined;
    }
  }, [formData.project_id, onFetchWorkPackages]);

  useEffect(() => {
    let isMounted = true;
    if (fetchTimesheetStatuses && fetchBusinessActivities) {
      if (isMounted) {
        fetchTimesheetStatuses();
        fetchBusinessActivities();
      }
    }
    return () => { isMounted = false; };
  }, []); // Only fetch once on mount

  // Watch for initial data changes (from calendar clicks)
  useEffect(() => {
    if (initialData?.dateRange && !formData.dateRange) {
      setFormData(prev => ({
        ...prev,
        dateRange: initialData.dateRange,
        startTime: initialData.startTime || prev.startTime,
        endTime: initialData.endTime || prev.endTime,
        duration: initialData.duration || prev.duration,
        useDuration: initialData.useDuration || prev.useDuration,
        text: initialData.text || prev.text,
        allowable_bill: initialData.allowable_bill ?? prev.allowable_bill,
        contact_id: initialData.contact_id || prev.contact_id,
        project_id: initialData.project_id || prev.project_id,
        client_service_id: initialData.client_service_id || prev.client_service_id,
        status_id: initialData.status_id || prev.status_id,
        pr_package_id: initialData.pr_package_id || prev.pr_package_id,
        pr_milestone_id: initialData.pr_milestone_id || prev.pr_milestone_id,
      }));
      setIsOpen(true); // Auto-open form when calendar date is selected
      
      // Focus description field after a brief delay
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  }, [initialData?.dateRange]); // Only watch for dateRange changes

  const parseDuration = (durationStr: string): number => {
    const [hours, minutes] = durationStr.split(':').map(Number);
    return (hours * 60 + minutes) * 60; // Convert to seconds
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const calculateDuration = (start: string, end: string): number => {
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    let duration = endTotalMinutes - startTotalMinutes;
    if (duration < 0) {
      duration += 24 * 60; // Handle overnight work
    }
    
    return duration * 60; // Convert to seconds
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.dateRange?.from) {
      toast({
        title: "Validation Error",
        description: "Please select at least one date.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.text.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a description for this time entry.",
        variant: "destructive",
      });
      return;
    }

    if (formData.useDuration) {
      // Validate duration input
      const duration = parseDuration(formData.duration);
      if (duration <= 0) {
        toast({
          title: "Validation Error",
          description: "Duration must be greater than 0.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Validate start/end time
      const duration = calculateDuration(formData.startTime, formData.endTime);
      if (duration <= 0) {
        toast({
          title: "Validation Error",
          description: "End time must be after start time.",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      // Sanitize optional fields to avoid Bexio 422s
      const sanitized = {
        ...formData,
        status_id: [1,2,3,4].includes(formData.status_id ?? -1) ? formData.status_id : undefined,
        pr_package_id: (workPackages.length > 0 && formData.pr_package_id) ? formData.pr_package_id : undefined,
      };

      await onSubmit(sanitized);
      
      // Reset form
      setFormData({
        dateRange: undefined,
        startTime: "09:00",
        endTime: "17:00",
        duration: "08:00",
        useDuration: false,
        text: "",
        allowable_bill: true,
        contact_id: undefined,
        project_id: undefined,
        client_service_id: undefined,
        status_id: undefined,
        pr_package_id: undefined,
        pr_milestone_id: undefined,
      });
      setIsOpen(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  if (!isOpen && !hideFormWrapper) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="mb-6"
        size="lg"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Time Entry
      </Button>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Range Picker */}
          <div className="space-y-2">
            <Label htmlFor="dateRange">Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.dateRange?.from ? (
                    formData.dateRange.to ? (
                      <>
                        {format(formData.dateRange.from, "LLL dd, y")} -{" "}
                        {format(formData.dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(formData.dateRange.from, "LLL dd, y")
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
                  defaultMonth={formData.dateRange?.from}
                  selected={formData.dateRange}
                  onSelect={(dateRange) => setFormData(prev => ({ ...prev, dateRange }))}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Input Mode Toggle */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="useDuration"
                checked={formData.useDuration}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, useDuration: checked }))}
              />
              <Label htmlFor="useDuration">Enter duration directly</Label>
            </div>

            {formData.useDuration ? (
              /* Duration Input */
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (HH:MM)</Label>
                <Input
                  id="duration"
                  type="text"
                  placeholder="08:00"
                  pattern="[0-9]{1,2}:[0-9]{2}"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Enter duration in hours:minutes format (e.g., 8:30)</p>
              </div>
            ) : (
              /* Time Range */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Duration Display */}
            <div className="text-sm text-muted-foreground">
              Daily duration: {formData.useDuration 
                ? `${Math.floor(parseDuration(formData.duration) / 3600)}h ${Math.floor((parseDuration(formData.duration) % 3600) / 60)}m`
                : `${Math.floor(calculateDuration(formData.startTime, formData.endTime) / 3600)}h ${Math.floor((calculateDuration(formData.startTime, formData.endTime) % 3600) / 60)}m`
              }
              {formData.dateRange?.from && formData.dateRange?.to && (
                <span className="ml-4">
                  Total days: {differenceInDays(formData.dateRange.to, formData.dateRange.from) + 1}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="text">Description</Label>
            <Textarea
              ref={descriptionRef}
              id="text"
              placeholder="Describe what you worked on..."
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Selection */}
            <div className="space-y-2">
              <Label htmlFor="contact_id">Contact (Optional)</Label>
              <Select
                value={formData.contact_id?.toString() || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  contact_id: value === "none" ? undefined : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {getContactName(contact)} (#{contact.nr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project_id">Project (Optional)</Label>
              <Select
                value={formData.project_id?.toString() || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  project_id: value === "none" ? undefined : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name} (#{project.nr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Activity Selection */}
          <div className="space-y-2">
            <Label htmlFor="client_service_id">Activity (Optional)</Label>
            <Select
              value={formData.client_service_id?.toString() || "none"}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                client_service_id: value === "none" ? undefined : parseInt(value) 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="none">No activity</SelectItem>
                {isLoadingActivities ? (
                  <SelectItem value="loading" disabled>Loading activities...</SelectItem>
                ) : businessActivities.length > 0 ? (
                  businessActivities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id.toString()}>
                      {activity.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="5">Default Activity</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Status and Work Package */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Selection */}
            <div className="space-y-2">
              <Label htmlFor="status_id">Status (Optional)</Label>
              <Select
                value={formData.status_id?.toString() || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  status_id: value === "none" ? undefined : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="none">No status</SelectItem>
                  {isLoadingStatuses ? (
                    <SelectItem value="loading" disabled>Loading statuses...</SelectItem>
                  ) : timesheetStatuses.length > 0 ? (
                    timesheetStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="1">Draft</SelectItem>
                      <SelectItem value="2">In Progress</SelectItem>
                      <SelectItem value="3">Completed</SelectItem>
                      <SelectItem value="4">Approved</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Work Package Selection */}
            <div className="space-y-2">
              <Label htmlFor="pr_package_id">Work Package (Optional)</Label>
              {!formData.project_id && (
                <p className="text-xs text-muted-foreground">Select a project to choose a work package.</p>
              )}
              <Select
                disabled={!formData.project_id}
                value={formData.pr_package_id || "none"}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  pr_package_id: value === "none" ? undefined : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select work package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No work package</SelectItem>
                  {isLoadingWorkPackages ? (
                    <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  ) : workPackages.length > 0 ? (
                    workPackages.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: wp.color }}
                          />
                          {wp.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>No work packages available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billable Switch */}
          <div className="flex items-center space-x-2">
            <Switch
              id="billable"
              checked={formData.allowable_bill}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowable_bill: checked }))}
            />
            <Label htmlFor="billable">Billable time</Label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Entry
                </>
              )}
            </Button>
            {!hideFormWrapper && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
  );

  if (hideFormWrapper) {
    return formContent;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add New Time Entry
        </CardTitle>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
};