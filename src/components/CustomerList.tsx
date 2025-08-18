import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Mail, Phone, MapPin, Users } from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type_id: number;
  customer_type?: string;
}

interface CustomerListProps {
  customers: Customer[];
  isLoading: boolean;
}

export const CustomerList = ({ customers, isLoading }: CustomerListProps) => {
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
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Customers</h2>
          <Badge variant="secondary" className="ml-2">
            {customers.length} total
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => (
          <Card 
            key={customer.id} 
            className="hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.02] cursor-pointer group"
          >
            <CardHeader className="pb-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary-subtle text-primary font-semibold">
                    {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate group-hover:text-primary transition-[var(--transition-smooth)]">
                    {customer.name}
                  </CardTitle>
                  <Badge variant="outline" className="mt-1">
                    ID: {customer.id}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 space-y-3">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-info" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-success" />
                  <span>{customer.phone}</span>
                </div>
              )}
              
              {customer.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-warning" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">
                  Type: {customer.contact_type_id}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {customers.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No customers found</h3>
            <p className="text-muted-foreground">
              No customer data was retrieved from your Bexio account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};