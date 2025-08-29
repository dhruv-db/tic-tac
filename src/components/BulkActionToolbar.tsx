import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, X, CheckSquare, Loader2 } from "lucide-react";

interface BulkActionToolbarProps {
  selectedCount: number;
  onBulkUpdate: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export const BulkActionToolbar = ({
  selectedCount,
  onBulkUpdate,
  onBulkDelete,
  onClearSelection,
  isLoading = false
}: BulkActionToolbarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-elegant p-4 flex items-center gap-4 animate-fade-in">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckSquare className="h-4 w-4" />
          )}
          <Badge variant="secondary" className="bg-primary-subtle text-primary">
            {selectedCount} selected
          </Badge>
          {isLoading && (
            <span className="text-sm opacity-90">Processing...</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBulkUpdate}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Edit className="h-4 w-4" />
            )}
            Bulk Update
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={onBulkDelete}
            disabled={isLoading}
            className="gap-2 text-destructive hover:text-destructive"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Bulk Delete
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isLoading}
            className="gap-2 hover:bg-primary-subtle"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};