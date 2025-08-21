import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
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
}

interface TimeEntryFormProps {
  onSubmit: (data: TimeEntryFormData) => Promise<void>;
  isSubmitting: boolean;
}

export const TimeEntryForm = ({ onSubmit, isSubmitting }: TimeEntryFormProps) => {
  const [formData, setFormData] = useState<TimeEntryFormData>({
    dateRange: undefined,
    startTime: "09:00",
    endTime: "17:00",
    text: "",
    allowable_bill: true,
  });
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

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
              id="text"
              placeholder="Describe what you worked on..."
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact ID */}
            <div className="space-y-2">
              <Label htmlFor="contact_id">Contact ID (Optional)</Label>
              <Input
                id="contact_id"
                type="number"
                placeholder="Enter contact ID"
                value={formData.contact_id || ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  contact_id: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
              />
            </div>

            {/* Project ID */}
            <div className="space-y-2">
              <Label htmlFor="project_id">Project ID (Optional)</Label>
              <Input
                id="project_id"
                type="number"
                placeholder="Enter project ID"
                value={formData.project_id || ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  project_id: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
              />
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
              {isSubmitting ? "Adding..." : "Add Time Entry"}
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