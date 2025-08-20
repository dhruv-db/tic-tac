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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface TimeEntryFormData {
  date: Date;
  duration: number;
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
    date: new Date(),
    duration: 0,
    text: "",
    allowable_bill: true,
  });
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hours === 0 && minutes === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a duration greater than 0.",
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

    const totalSeconds = (hours * 3600) + (minutes * 60);
    
    try {
      await onSubmit({
        ...formData,
        duration: totalSeconds,
      });
      
      // Reset form
      setFormData({
        date: new Date(),
        duration: 0,
        text: "",
        allowable_bill: true,
      });
      setHours(0);
      setMinutes(0);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    placeholder="Hours"
                    value={hours || ""}
                    onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="Minutes"
                    value={minutes || ""}
                    onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {hours}h {minutes}m
              </p>
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