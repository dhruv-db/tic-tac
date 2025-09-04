import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { TimeEntry } from "./TimeTrackingList";

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

interface BulkUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntries: TimeEntry[];
  onSubmit: (entries: TimeEntry[], updateData: BulkUpdateData) => Promise<void>;
  isSubmitting: boolean;
  contacts: Contact[];
  projects: Project[];
}

interface BulkUpdateData {
  text?: string;
  allowable_bill?: boolean;
  contact_id?: number;
  project_id?: number;
}

export const BulkUpdateDialog = ({
  isOpen,
  onClose,
  selectedEntries,
  onSubmit,
  isSubmitting,
  contacts,
  projects
}: BulkUpdateDialogProps) => {
  const [formData, setFormData] = useState<BulkUpdateData>({});
  const [updateFields, setUpdateFields] = useState<{[key: string]: boolean}>({});

  const getContactName = (contact: Contact) => {
    const name2 = contact.name_2 ? ` ${contact.name_2}` : '';
    return `${contact.name_1}${name2}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only pass data for fields that are selected for update
    const updateData: BulkUpdateData = {};
    if (updateFields.text && formData.text !== undefined) updateData.text = formData.text;
    if (updateFields.allowable_bill && formData.allowable_bill !== undefined) updateData.allowable_bill = formData.allowable_bill;
    if (updateFields.contact_id && formData.contact_id !== undefined) updateData.contact_id = formData.contact_id;
    if (updateFields.project_id && formData.project_id !== undefined) updateData.project_id = formData.project_id;
    
    await onSubmit(selectedEntries, updateData);
    
    // Reset form
    setFormData({});
    setUpdateFields({});
    onClose();
  };

  const handleFieldToggle = (field: string, checked: boolean) => {
    setUpdateFields(prev => ({ ...prev, [field]: checked }));
    if (!checked) {
      // Clear the field data when unchecked
      setFormData(prev => {
        const newData = { ...prev };
        delete newData[field as keyof BulkUpdateData];
        return newData;
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Bulk Update Time Entries
          </DialogTitle>
          <DialogDescription>
            Update {selectedEntries.length} selected time entries. Only checked fields will be updated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Description */}
          <div className="flex items-center gap-4">
            <Switch
              checked={updateFields.text || false}
              onCheckedChange={(checked) => handleFieldToggle('text', checked)}
            />
            <div className="flex-1 space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter time entry description..."
                value={formData.text || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                disabled={!updateFields.text}
                className={!updateFields.text ? "opacity-50" : ""}
              />
            </div>
          </div>

          {/* Contact and Project */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-4">
              <Switch
                checked={updateFields.contact_id || false}
                onCheckedChange={(checked) => handleFieldToggle('contact_id', checked)}
              />
              <div className="flex-1 space-y-2">
                <Label>Contact</Label>
                <Select
                  value={formData.contact_id?.toString() || "none"}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    contact_id: value === "none" ? undefined : parseInt(value) 
                  }))}
                  disabled={!updateFields.contact_id}
                >
                  <SelectTrigger className={!updateFields.contact_id ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {getContactName(contact)} (#{contact.nr})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Switch
                checked={updateFields.project_id || false}
                onCheckedChange={(checked) => handleFieldToggle('project_id', checked)}
              />
              <div className="flex-1 space-y-2">
                <Label>Project</Label>
                <Select
                  value={formData.project_id?.toString() || "none"}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    project_id: value === "none" ? undefined : parseInt(value) 
                  }))}
                  disabled={!updateFields.project_id}
                >
                  <SelectTrigger className={!updateFields.project_id ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
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
          </div>

          {/* Billable Switch */}
          <div className="flex items-center gap-4">
            <Switch
              checked={updateFields.allowable_bill || false}
              onCheckedChange={(checked) => handleFieldToggle('allowable_bill', checked)}
            />
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.allowable_bill || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowable_bill: checked }))}
                disabled={!updateFields.allowable_bill}
              />
              <Label className={!updateFields.allowable_bill ? "opacity-50" : ""}>
                Billable time entry
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || Object.keys(updateFields).filter(key => updateFields[key]).length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                `Update ${selectedEntries.length} Entries`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};