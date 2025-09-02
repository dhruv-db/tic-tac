import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";

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

interface TimeEntry {
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

interface EditTimeEntryDialogProps {
  entry: TimeEntry | null;
  contacts: Contact[];
  projects: Project[];
  workPackages: WorkPackage[];
  isLoadingWorkPackages: boolean;
  onFetchWorkPackages: (projectId: number) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, data: TimeEntryFormData) => Promise<void>;
  isSubmitting: boolean;
  timesheetStatuses: { id: number; name: string }[];
  businessActivities: { id: number; name: string }[];
  workPackagesByProject: Record<number, WorkPackage[]>;
  getWorkPackageName: (projectId: number | undefined, packageId: string | undefined) => string;
}



export const EditTimeEntryDialog = ({
  entry,
  contacts,
  projects,
  workPackages,
  isLoadingWorkPackages,
  onFetchWorkPackages,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  timesheetStatuses,
  businessActivities,
  workPackagesByProject,
  getWorkPackageName: getWpName
}: EditTimeEntryDialogProps) => {
  // Removed useBexioApi hook - using props instead
  
  const [formData, setFormData] = useState<TimeEntryFormData>({
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
  const { toast } = useToast();

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
  }, [formData.project_id]); // Removed onFetchWorkPackages from dependencies to prevent loop

  const getContactName = (contact: Contact) => {
    const names = [contact.name_1, contact.name_2].filter(Boolean);
    return names.length > 0 ? names.join(' ') : 'Unnamed Contact';
  };

  const parseDurationToTimes = (duration: string | number) => {
    let durationString: string;
    
    if (typeof duration === 'number') {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      durationString = `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else {
      durationString = duration;
    }

    const [hours, minutes] = durationString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Assume work starts at 9:00 AM and calculate end time
    const startTotalMinutes = 9 * 60; // 9:00 AM
    const endTotalMinutes = startTotalMinutes + totalMinutes;
    
    const startHours = Math.floor(startTotalMinutes / 60);
    const startMins = startTotalMinutes % 60;
    const endHours = Math.floor(endTotalMinutes / 60);
    const endMins = endTotalMinutes % 60;
    
    return {
      startTime: `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`,
      endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
    };
  };

  useEffect(() => {
    if (entry && isOpen) {
      const { startTime, endTime } = parseDurationToTimes(entry.duration);
      const entryDate = new Date(entry.date);
      
      // Convert duration properly - handle both string and number formats
      let durationString = "08:00";
      if (typeof entry.duration === 'number') {
        const hours = Math.floor(entry.duration / 3600);
        const minutes = Math.floor((entry.duration % 3600) / 60);
        durationString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (typeof entry.duration === 'string') {
        durationString = entry.duration;
      }
      
      setFormData({
        dateRange: {
          from: entryDate,
          to: entryDate
        },
        startTime,
        endTime,
        duration: durationString,
        useDuration: false,
        text: entry.text || "",
        allowable_bill: entry.allowable_bill,
        contact_id: entry.contact_id,
        project_id: entry.project_id,
        client_service_id: entry.client_service_id,
        status_id: entry.status_id,
        pr_package_id: entry.pr_package_id,
        pr_milestone_id: entry.pr_milestone_id,
      });
    }
  }, [entry?.id, isOpen]); // Only depend on entry.id to avoid loops

  // Removed effects that fetched statuses and activities - now using props

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

  const parseDuration = (durationStr: string): number => {
    const [hours, minutes] = durationStr.split(':').map(Number);
    return (hours * 60 + minutes) * 60; // Convert to seconds
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entry) return;

    if (!formData.dateRange?.from) {
      toast({
        title: "Validation Error",
        description: "Please select a date.",
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

      await onSubmit(entry.id, sanitized);
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Time Entry
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit an existing time entry. All fields are required unless marked optional.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="dateRange">Date</Label>
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
                    format(formData.dateRange.from, "LLL dd, y")
                  ) : (
                    <span>Pick date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="single"
                  selected={formData.dateRange?.from}
                  onSelect={(date) => setFormData(prev => ({ 
                    ...prev, 
                    dateRange: date ? { from: date, to: date } : undefined 
                  }))}
                  className="pointer-events-auto"
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
              Duration: {formData.useDuration 
                ? `${Math.floor(parseDuration(formData.duration) / 3600)}h ${Math.floor((parseDuration(formData.duration) % 3600) / 60)}m`
                : `${Math.floor(calculateDuration(formData.startTime, formData.endTime) / 3600)}h ${Math.floor((calculateDuration(formData.startTime, formData.endTime) % 3600) / 60)}m`
              }
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="text">Description</Label>
            <Textarea
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
                {businessActivities.length > 0 ? (
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
                  {timesheetStatuses.length > 0 ? (
                    timesheetStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="1">Draft</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Work Package Selection */}
            <div className="space-y-2">
              <Label htmlFor="pr_package_id">Work Package (Optional)</Label>
              <Select
                disabled={!formData.project_id || isLoadingWorkPackages}
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
            <Button type="submit" disabled={isSubmitting} className="corporate-button">
              {isSubmitting ? "Updating..." : "Update Entry"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};