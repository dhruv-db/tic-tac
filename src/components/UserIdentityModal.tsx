import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Shield } from "lucide-react";

interface BexioUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  is_superadmin: boolean;
  is_accountant: boolean;
}

interface UserIdentityModalProps {
  isOpen: boolean;
  users: BexioUser[];
  onUserSelect: (userId: number, isAdmin: boolean) => void;
  currentBexioUserId: number | null;
}

export const UserIdentityModal = ({ 
  isOpen, 
  users, 
  onUserSelect, 
  currentBexioUserId 
}: UserIdentityModalProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    if (currentBexioUserId) {
      setSelectedUserId(currentBexioUserId.toString());
    }
  }, [currentBexioUserId]);

  const handleContinue = () => {
    if (!selectedUserId) return;
    
    const userId = parseInt(selectedUserId);
    const user = users.find(u => u.id === userId);
    const isAdmin = user ? (user.is_superadmin || user.is_accountant) : false;
    
    onUserSelect(userId, isAdmin);
  };

  const selectedUser = users.find(u => u.id === parseInt(selectedUserId));

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Who are you?
          </DialogTitle>
          <DialogDescription>
            Please select your identity to continue. This determines what data you can access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your user account</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your account" />
              </SelectTrigger>
              <SelectContent className="z-[1000] bg-popover border border-border shadow-lg">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{user.firstname} {user.lastname}</span>
                      {(user.is_superadmin || user.is_accountant) && (
                        <Shield className="h-3 w-3 text-warning" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm">
                <p className="font-medium">{selectedUser.firstname} {selectedUser.lastname}</p>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    selectedUser.is_superadmin || selectedUser.is_accountant 
                      ? 'bg-warning/10 text-warning' 
                      : 'bg-info/10 text-info'
                  }`}>
                    {selectedUser.is_superadmin || selectedUser.is_accountant ? 'Admin' : 'User'}
                  </span>
                  {(selectedUser.is_superadmin || selectedUser.is_accountant) && (
                    <span className="text-xs text-muted-foreground">Can view all data</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleContinue} 
            disabled={!selectedUserId}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};