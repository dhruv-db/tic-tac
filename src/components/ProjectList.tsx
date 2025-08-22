import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FolderOpen, Calendar, User, MapPin, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: number;
  nr: string;
  name: string;
  start_date: string;
  end_date?: string;
  comment?: string;
  pr_state_id: number;
  pr_project_type_id: number;
  contact_id?: number;
  contact_sub_id?: number;
  pr_invoice_type_id?: number;
  pr_invoice_type_amount?: number;
  pr_budget_type_id?: number;
  pr_budget_type_amount?: number;
}

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
}

export const ProjectList = ({ projects, isLoading }: ProjectListProps) => {
  const getProjectInitials = (project: Project) => {
    return project.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getProjectStatus = (stateId: number) => {
    const statusMap: { [key: number]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } } = {
      1: { label: 'Active', variant: 'default' },
      2: { label: 'Completed', variant: 'secondary' },
      3: { label: 'Cancelled', variant: 'destructive' },
      4: { label: 'On Hold', variant: 'outline' },
    };
    return statusMap[stateId] || { label: 'Unknown', variant: 'outline' };
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Projects</h2>
          <Badge variant="secondary" className="ml-2">
            {projects.length} total
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const status = getProjectStatus(project.pr_state_id);
          return (
            <Card 
              key={project.id} 
              className="hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.02] cursor-pointer group"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary-subtle text-primary font-semibold">
                      {getProjectInitials(project)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate group-hover:text-primary transition-[var(--transition-smooth)]">
                      {project.name}
                    </CardTitle>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        #{project.nr}
                      </Badge>
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Start: {format(new Date(project.start_date), 'MMM dd, yyyy')}</span>
                </div>

                {project.end_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-secondary" />
                    <span>End: {format(new Date(project.end_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}

                {project.contact_id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 text-info" />
                    <span>Contact ID: {project.contact_id}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      Type: {project.pr_project_type_id}
                    </Badge>
                    {project.pr_invoice_type_id && (
                      <Badge variant="outline" className="text-xs">
                        Invoice: {project.pr_invoice_type_id}
                      </Badge>
                    )}
                  </div>
                </div>

                {project.comment && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <p className="line-clamp-2">{project.comment}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground">
              No project data was retrieved from your Bexio account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};