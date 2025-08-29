import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BexioConnector } from "@/components/BexioConnector";
import { ContactList } from "@/components/ContactList";
import { ProjectList } from "@/components/ProjectList";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut, Users, FolderOpen } from "lucide-react";

const Index = () => {
  const {
    credentials,
    contacts,
    projects,
    timeEntries,
    isLoadingContacts,
    isLoadingProjects,
    isLoadingTimeEntries,
    isCreatingTimeEntry,
    isConnected,
    connect,
    fetchContacts,
    fetchProjects,
    fetchTimeEntries,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    bulkUpdateTimeEntries,
    bulkDeleteTimeEntries,
    loadStoredCredentials,
    disconnect,
  } = useBexioApi();

  const [activeTab, setActiveTab] = useState("contacts");

  useEffect(() => {
    loadStoredCredentials();
  }, [loadStoredCredentials]);

  const handleRefresh = () => {
    if (activeTab === "contacts") {
      fetchContacts();
    } else if (activeTab === "projects") {
      fetchProjects();
    } else {
      fetchTimeEntries();
    }
  };

  const isLoading = isLoadingContacts || isLoadingProjects || isLoadingTimeEntries;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 p-4 rounded-full bg-primary-subtle w-fit">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Databridge Analytics
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Connect to your Bexio account to access business intelligence and time tracking analytics
            </p>
          </div>
          <BexioConnector onConnect={connect} isConnected={isConnected} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-subtle">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  <span className="databridge-brand">data</span>
                  <span className="databridge-accent">^</span>
                  <span className="databridge-brand">bridge</span>
                  <span className="text-muted-foreground text-lg ml-2">Analytics</span>
                </h1>
                <p className="text-sm text-muted-foreground">Business Intelligence Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mx-auto">
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="timetracking" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-6">
            {contacts.length === 0 && !isLoadingContacts ? (
              <div className="text-center py-12">
                <Button onClick={fetchContacts} className="gap-2">
                  <Users className="h-4 w-4" />
                  Load Contacts
                </Button>
              </div>
            ) : (
              <ContactList contacts={contacts} isLoading={isLoadingContacts} />
            )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            {projects.length === 0 && !isLoadingProjects ? (
              <div className="text-center py-12">
                <Button onClick={fetchProjects} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Load Projects
                </Button>
              </div>
            ) : (
              <ProjectList projects={projects} isLoading={isLoadingProjects} />
            )}
          </TabsContent>

          <TabsContent value="timetracking" className="space-y-6">
            {timeEntries.length === 0 && !isLoadingTimeEntries ? (
              <div className="text-center py-12">
                <Button onClick={fetchTimeEntries} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Load Time Entries
                </Button>
              </div>
            ) : (
              <TimeTrackingList 
                timeEntries={timeEntries} 
                isLoading={isLoadingTimeEntries}
                onCreateTimeEntry={createTimeEntry}
                onUpdateTimeEntry={updateTimeEntry}
                onDeleteTimeEntry={deleteTimeEntry}
                onBulkUpdateTimeEntries={bulkUpdateTimeEntries}
                onBulkDeleteTimeEntries={bulkDeleteTimeEntries}
                isCreatingTimeEntry={isCreatingTimeEntry}
                contacts={contacts}
                projects={projects}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
