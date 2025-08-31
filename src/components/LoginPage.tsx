import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, User, BarChart3, Play } from "lucide-react";
import { BexioConnector } from "./BexioConnector";

interface LoginPageProps {
  onConnect: (apiKey: string, companyId: string) => Promise<void>;
  onOAuthConnect: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => Promise<void>;
  isConnected: boolean;
}

// Manual entry component for fallback
const ManualEntry = ({ onConnect, onBack }: { onConnect: (apiKey: string, companyId: string) => Promise<void>; onBack: () => void }) => {
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !companyId.trim()) return;

    setIsConnecting(true);
    try {
      await onConnect(apiKey.trim(), companyId.trim());
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        ← Back to OAuth
      </Button>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter your Bexio API key"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Company ID</label>
          <input
            type="text"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter your company ID"
            required
          />
        </div>
        <Button type="submit" disabled={isConnecting} className="w-full">
          {isConnecting ? "Connecting..." : "Connect"}
        </Button>
      </form>
    </div>
  );
};

export const LoginPage = ({
  onConnect,
  onOAuthConnect,
  isConnected
}: LoginPageProps) => {
  const [showManualEntry, setShowManualEntry] = useState(false);

  if (isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Dark teal gradient with branding */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-teal-800 via-teal-700 to-teal-900 p-8 lg:p-12 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                  <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">tik✓tak</h1>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="text-white/80 hover:text-white text-sm">SIGN IN</button>
            <div className="flex items-center gap-1 text-sm">
              <span>EN</span>
              <svg width="12" height="8" fill="currentColor" viewBox="0 0 12 8">
                <path d="M6 8L0 2h12L6 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-8 flex-1">
          <div>
            <p className="text-lg text-white/90 mb-8">Smart & simple time-tracking</p>
            
            <div className="space-y-4">
              <div className="bg-green-500 hover:bg-green-600 text-white px-8 py-6 text-lg font-medium rounded-lg shadow-lg cursor-pointer text-center"
                   onClick={() => setShowManualEntry(true)}>
                REGISTER WITH BEXIO LOGIN
                <br />
                <span className="text-sm font-normal">(WITHOUT CREDIT CARD)</span>
              </div>
            </div>
          </div>

          {/* Demo video area */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 max-w-md">
            <div className="bg-white rounded-lg p-4 relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-teal-700 rounded flex items-center justify-center text-white text-xs font-bold">
                  tik✓tak
                </div>
                <span className="text-sm text-gray-600">Smart & simple time-tracking</span>
              </div>
              <div className="bg-gray-100 rounded p-4 mb-4">
                <div className="text-xs text-gray-600 mb-2">Time tracking for employees</div>
                <div className="text-xs text-gray-600">monitoring, project management</div>
                <div className="text-xs text-gray-600">and productivity analysis</div>
              </div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center cursor-pointer">
                  <Play className="w-5 h-5 text-white ml-1" fill="currentColor" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-white/60 space-y-1">
          <p>© 2021 by tik-tak. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white/80">Terms & conditions</a>
            <span>and</span>
            <a href="#" className="hover:text-white/80">Privacy policy</a>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-2 h-2 bg-green-400 rounded-full"></div>
        <div className="absolute top-40 right-40 w-3 h-3 bg-teal-400 rounded-full"></div>
        <div className="absolute bottom-40 right-20 w-2 h-2 bg-blue-400 rounded-full"></div>
        <div className="absolute bottom-20 right-60 w-4 h-4 bg-green-300 rounded-full"></div>
      </div>

      {/* Right side - White background with features */}
      <div className="hidden lg:block w-1/2 bg-gray-50 p-12 relative overflow-hidden">
        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-8 h-full">
          {/* Worktime */}
          <div className="space-y-4 pt-16">
            <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Worktime</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Track your daily worktime in less than a minute. Use text recognition or start-and-stop tracking.
            </p>
          </div>

          {/* Projects Work */}
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Projects Work</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Track your times on projects. Manage billable and non-billable hours, and much more.
            </p>
          </div>

          {/* Absences & Vacations */}
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Absences & Vacations</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Track your absences like vacations, sickness, military and many more easily and fast.
            </p>
          </div>

          {/* Analyse & Reporting */}
          <div className="space-y-4 pb-16">
            <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">Analyse & Reporting</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              See how your team spends time, money and resources. Manage your projects efficiently.
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-32 left-20 w-3 h-3 bg-teal-600 rounded-full"></div>
        <div className="absolute top-20 right-32 w-2 h-2 bg-blue-500 rounded-full"></div>
        <div className="absolute bottom-60 left-40 w-2 h-2 bg-green-400 rounded-full"></div>
        <div className="absolute bottom-32 right-20 w-3 h-3 bg-teal-500 rounded-full"></div>
        <div className="absolute top-60 right-20 w-4 h-4 bg-green-300 rounded-full"></div>
      </div>

      {/* Mobile/Tablet overlay for auth */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <BexioConnector onConnect={onConnect} onOAuthConnect={onOAuthConnect} isConnected={isConnected} />
              <Button 
                variant="ghost" 
                className="w-full mt-4"
                onClick={() => setShowManualEntry(false)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile floating auth card */}
      <div className="lg:hidden fixed bottom-8 left-4 right-4 z-40">
        <Card className="shadow-lg">
          <CardContent className="p-4">
            {!showManualEntry ? (
              <div className="space-y-4">
                <BexioConnector onConnect={onConnect} onOAuthConnect={onOAuthConnect} isConnected={isConnected} />
              </div>
            ) : (
              <ManualEntry onConnect={onConnect} onBack={() => setShowManualEntry(false)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};