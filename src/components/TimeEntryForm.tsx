import { useState, useEffect, useRef } from "react";
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
  text: string;
  allowable_bill: boolean;
  contact_id?: number;
  project_id?: number;
  status_id?: number;
  pr_package_id?: number;
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

interface TimeEntryFormProps {
  onSubmit: (data: TimeEntryFormData) => Promise<void>;
  isSubmitting: boolean;
  contacts: Contact[];
  projects: Project[];
  initialData?: Partial<TimeEntryFormData>;
}

export const TimeEntryForm = ({ onSubmit, isSubmitting, contacts, projects, initialData }: TimeEntryFormProps) => {
  const getContactName = (contact: Contact) => {
    const names = [contact.name_1, contact.name_2].filter(Boolean);
    return names.length > 0 ? names.join(' ') : 'Unnamed Contact';
  };
  const [formData, setFormData] = useState<TimeEntryFormData>({
    dateRange: initialData?.dateRange || undefined,
    startTime: initialData?.startTime || "09:00",
    endTime: initialData?.endTime || "17:00",
    text: initialData?.text || "",
    allowable_bill: initialData?.allowable_bill ?? true,
    contact_id: initialData?.contact_id,
    project_id: initialData?.project_id,
    status_id: initialData?.status_id,
    pr_package_id: initialData?.pr_package_id,
    pr_milestone_id: initialData?.pr_milestone_id,
  });
  const [isOpen, setIsOpen] = useState(!!initialData?.dateRange);
  const { toast } = useToast();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Watch for initial data changes (from calendar clicks)
  useEffect(() => {
    if (initialData?.dateRange) {
      setFormData({
        dateRange: initialData.dateRange,
        startTime: initialData.startTime || "09:00",
        endTime: initialData.endTime || "17:00",
        text: initialData.text || "",
        allowable_bill: initialData.allowable_bill ?? true,
        contact_id: initialData.contact_id,
        project_id: initialData.project_id,
        status_id: initialData.status_id,
        pr_package_id: initialData.pr_package_id,
        pr_milestone_id: initialData.pr_milestone_id,
      });
      setIsOpen(true); // Auto-open form when calendar date is selected
      
      // Focus description field after a brief delay
      setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100);
    }
  }, [initialData]);

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

    const duration = calculateDuration(formData.startTime, formData.endTime);
    if (duration <= 0) {
      toast({
        title: "Validation Error",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await onSubmit(formData);
      
      // Reset form
      setFormData({
        dateRange: undefined,
        startTime: "09:00",
        endTime: "17:00",
        text: "",
        allowable_bill: true,
        contact_id: undefined,
        project_id: undefined,
        status_id: undefined,
        pr_package_id: undefined,
        pr_milestone_id: undefined,
      });
      setIsOpen(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  if (!isOpen) {
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

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add New Time Entry
        </CardTitle>
      </CardHeader>
      <CardContent>
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

          {/* Time Range */}
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

          {/* Duration Display */}
          <div className="text-sm text-muted-foreground">
            Daily duration: {Math.floor(calculateDuration(formData.startTime, formData.endTime) / 3600)}h {Math.floor((calculateDuration(formData.startTime, formData.endTime) % 3600) / 60)}m
            {formData.dateRange?.from && formData.dateRange?.to && (
              <span className="ml-4">
                Total days: {differenceInDays(formData.dateRange.to, formData.dateRange.from) + 1}
              </span>
            )}
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
                value={formData.contact_id?.toString() || ""}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  contact_id: value ? parseInt(value) : undefined 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent className="z-50">
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
                value={formData.project_id?.toString() || ""}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  project_id: value ? parseInt(value) : undefined 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name} (#{project.nr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status and Work Package */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Selection */}
            <div className="space-y-2">
              <Label htmlFor="status_id">Status (Optional)</Label>
              <Select
                value={formData.status_id?.toString() || ""}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  status_id: value ? parseInt(value) : undefined 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Draft</SelectItem>
                  <SelectItem value="2">In Progress</SelectItem>
                  <SelectItem value="3">Completed</SelectItem>
                  <SelectItem value="4">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Work Package Selection */}
            <div className="space-y-2">
              <Label htmlFor="pr_package_id">Work Package (Optional)</Label>
              <Select
                value={formData.pr_package_id?.toString() || ""}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  pr_package_id: value ? parseInt(value) : undefined 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select work package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Development</SelectItem>
                  <SelectItem value="2">Testing</SelectItem>
                  <SelectItem value="3">Documentation</SelectItem>
                  <SelectItem value="4">Meeting</SelectItem>
                  <SelectItem value="5">Analysis</SelectItem>
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};