import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { BexioConnector } from "@/components/BexioConnector";
import { CustomerList } from "@/components/CustomerList";
import { TimeTrackingList } from "@/components/TimeTrackingList";
import { useBexioApi } from "@/hooks/useBexioApi";
import { RefreshCw, Database, LogOut } from "lucide-react";

const Index = () => {
  const {
    credentials,
    customers,
    timeEntries,
    isLoadingCustomers,
    isLoadingTimeEntries,
    isConnected,
    connect,
    fetchCustomers,
    fetchTimeEntries,
    loadStoredCredentials,
    disconnect,
  } = useBexioApi();

  const [activeTab, setActiveTab] = useState("customers");

  useEffect(() => {
    loadStoredCredentials();
  }, [loadStoredCredentials]);

  const handleRefresh = () => {
    if (activeTab === "customers") {
      fetchCustomers();
    } else {
      fetchTimeEntries();
    }
  };

  const isLoading = isLoadingCustomers || isLoadingTimeEntries;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 p-4 rounded-full bg-primary-subtle w-fit">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              Bexio Dashboard
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Connect to your Bexio account to access customer data and time tracking information
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
                <h1 className="text-2xl font-bold">Bexio Dashboard</h1>
                <p className="text-sm text-muted-foreground">Connected and ready</p>
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
          <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto">
            <TabsTrigger value="customers" className="gap-2">
              <Database className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="timetracking" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-6">
            {customers.length === 0 && !isLoadingCustomers ? (
              <div className="text-center py-12">
                <Button onClick={fetchCustomers} className="gap-2">
                  <Database className="h-4 w-4" />
                  Load Customers
                </Button>
              </div>
            ) : (
              <CustomerList customers={customers} isLoading={isLoadingCustomers} />
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
              <TimeTrackingList timeEntries={timeEntries} isLoading={isLoadingTimeEntries} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
