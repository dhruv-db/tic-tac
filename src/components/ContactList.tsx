import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Mail, Phone, MapPin, Users, Globe, Smartphone, Calendar, User, Crown } from "lucide-react";

interface Contact {
  id: number;
  nr: string;
  name_1: string;
  name_2?: string;
  salutation_id?: number;
  salutation_form?: string;
  title_id?: number;
  birthday?: string;
  address?: string;
  street_name?: string;
  house_number?: string;
  address_addition?: string;
  postcode?: string;
  city?: string;
  country_id?: number;
  mail?: string;
  mail_second?: string;
  phone_fixed?: string;
  phone_fixed_second?: string;
  phone_mobile?: string;
  fax?: string;
  url?: string;
  skype_name?: string;
  remarks?: string;
  language_id?: number;
  is_lead?: boolean;
  contact_group_ids?: string;
  contact_branch_ids?: string;
  user_id?: number;
  owner_id?: number;
  contact_type_id: number;
  updated_at?: string;
}

interface ContactListProps {
  contacts: Contact[];
  isLoading: boolean;
}

export const ContactList = ({ contacts, isLoading }: ContactListProps) => {
  const getContactName = (contact: Contact) => {
    const names = [contact.name_1, contact.name_2].filter(Boolean);
    return names.length > 0 ? names.join(' ') : 'Unnamed Contact';
  };

  const getContactInitials = (contact: Contact) => {
    const name = getContactName(contact);
    if (name === 'Unnamed Contact') return 'UC';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
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
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold">Contacts</h2>
          <Badge variant="secondary" className="ml-2">
            {contacts.length} total
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <Card 
            key={contact.id} 
            className="hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:scale-[1.02] cursor-pointer group"
          >
            <CardHeader className="pb-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary-subtle text-primary font-semibold">
                    {getContactInitials(contact)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate group-hover:text-primary transition-[var(--transition-smooth)]">
                    {getContactName(contact)}
                  </CardTitle>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      #{contact.nr}
                    </Badge>
                    {contact.is_lead && (
                      <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                        <Crown className="h-3 w-3 mr-1" />
                        Lead
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 space-y-3">
              {contact.mail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-info" />
                  <span className="truncate">{contact.mail}</span>
                </div>
              )}
              
              {contact.phone_fixed && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-success" />
                  <span>{contact.phone_fixed}</span>
                </div>
              )}

              {contact.phone_mobile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Smartphone className="h-4 w-4 text-success" />
                  <span>{contact.phone_mobile}</span>
                </div>
              )}

              {contact.url && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4 text-info" />
                  <a href={contact.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                    {contact.url}
                  </a>
                </div>
              )}
              
              {(contact.address || contact.city || contact.postcode) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-warning" />
                  <span className="truncate">
                    {[contact.address, contact.postcode, contact.city].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {contact.birthday && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>{new Date(contact.birthday).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    Type: {contact.contact_type_id}
                  </Badge>
                  {contact.language_id && (
                    <Badge variant="outline" className="text-xs">
                      Lang: {contact.language_id}
                    </Badge>
                  )}
                  {contact.country_id && (
                    <Badge variant="outline" className="text-xs">
                      Country: {contact.country_id}
                    </Badge>
                  )}
                </div>
              </div>

              {contact.remarks && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  <p className="line-clamp-2">{contact.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {contacts.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No contacts found</h3>
            <p className="text-muted-foreground">
              No contact data was retrieved from your Bexio account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};