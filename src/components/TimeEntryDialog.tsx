import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TimeEntryForm } from "./TimeEntryForm";
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

interface BexioUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  is_superadmin: boolean;
  is_accountant: boolean;
}

interface TimeEntryDialogProps {
  onSubmit: (data: {
    dateRange: DateRange | undefined;
    startTime?: string;
    endTime?: string;
    duration?: string;
    useDuration?: boolean;
    text: string;
    allowable_bill: boolean;
    contact_id?: number;
    project_id?: number;
    client_service_id?: number;
    status_id?: number;
    pr_package_id?: string;
    pr_milestone_id?: number;
    user_id?: number;
  }) => Promise<void>;
  isSubmitting: boolean;
  contacts: Contact[];
  projects: Project[];
  workPackages: WorkPackage[];
  isLoadingWorkPackages: boolean;
  onFetchWorkPackages: (projectId: number) => Promise<void>;
  initialData?: any;
  buttonText?: string;
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  timesheetStatuses: { id: number; name: string }[];
  businessActivities: { id: number; name: string }[];
  users?: BexioUser[];
  isCurrentUserAdmin?: boolean;
  currentBexioUserId?: number | null;
}

export const TimeEntryDialog = ({
  onSubmit,
  isSubmitting,
  contacts,
  projects,
  workPackages,
  isLoadingWorkPackages,
  onFetchWorkPackages,
  initialData,
  buttonText = "Add Time Entry",
  buttonSize = "lg",
  buttonVariant = "default",
  timesheetStatuses,
  businessActivities
}: TimeEntryDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    setIsOpen(false);
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="gap-2 bg-primary hover:bg-primary/90"
        size={buttonSize}
        variant={buttonVariant}
      >
        <Plus className="h-4 w-4" />
        {buttonText}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new time entry by selecting date, duration or start/end time, and details.
            </DialogDescription>
          </DialogHeader>
          
          <TimeEntryForm 
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            contacts={contacts}
            projects={projects}
            workPackages={workPackages}
            isLoadingWorkPackages={isLoadingWorkPackages}
            onFetchWorkPackages={onFetchWorkPackages}
            initialData={initialData}
            hideFormWrapper={true}
            timesheetStatuses={timesheetStatuses}
            businessActivities={businessActivities}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};