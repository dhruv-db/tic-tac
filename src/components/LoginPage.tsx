import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, User, BarChart3, Play, CheckCircle2, Clock, Zap, Shield } from "lucide-react";
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
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/7897546d-e6d9-4ed7-b5e0-0d3c1db11940.png" 
              alt="tik-tak logo" 
              className="h-12 w-auto"
            />
          </div>
          <div className="flex items-center gap-6">
            <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Sign In
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>EN</span>
              <svg width="12" height="8" fill="currentColor" viewBox="0 0 12 8">
                <path d="M6 8L0 2h12L6 8z"/>
              </svg>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-8">
          <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Smart & simple<br />
                  <span style={{ color: '#5faf59' }}>time-tracking</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Professional time tracking that integrates seamlessly with Bexio. 
                  Track projects, manage teams, and boost productivity.
                </p>
              </div>

              <div className="space-y-4">
                <Button 
                  className="text-lg px-8 py-6 rounded-xl shadow-lg"
                  style={{ backgroundColor: '#5faf59' }}
                  onClick={() => setShowManualEntry(true)}
                >
                  Get Started with Bexio
                  <span className="block text-sm font-normal opacity-90">
                    No credit card required
                  </span>
                </Button>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#5faf59' }} />
                    <span>Free 14-day trial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: '#5faf59' }} />
                    <span>Secure & encrypted</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#164e59' }}>10k+</div>
                  <div className="text-sm text-gray-600">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#164e59' }}>99.9%</div>
                  <div className="text-sm text-gray-600">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#164e59' }}>4.9★</div>
                  <div className="text-sm text-gray-600">User Rating</div>
                </div>
              </div>
            </div>

            {/* Right Content - Demo/Preview */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <img 
                      src="/lovable-uploads/7897546d-e6d9-4ed7-b5e0-0d3c1db11940.png" 
                      alt="tik-tak logo" 
                      className="h-8 w-auto"
                    />
                    <span className="text-sm text-gray-600">Dashboard Preview</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5" style={{ color: '#5faf59' }} />
                        <span className="font-medium">Today's Time</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: '#164e59' }}>7h 32m</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5" style={{ color: '#5faf59' }} />
                        <span className="font-medium">Active Projects</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: '#164e59' }}>12</span>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#5faf59' }}>
                      <div className="text-white text-center">
                        <div className="text-2xl font-bold">Ready to start?</div>
                        <div className="text-sm opacity-90">Connect your Bexio account</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full" style={{ backgroundColor: '#5faf59' }}></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 rounded-full" style={{ backgroundColor: '#164e59' }}></div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="px-6 lg:px-8 py-16" style={{ backgroundColor: '#f8fafb' }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Everything you need for efficient time tracking
              </h2>
              <p className="text-lg text-gray-600">
                Powerful features designed for modern businesses
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#164e59' }}>
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Worktime</h3>
                <p className="text-gray-600 text-sm">
                  Track daily worktime in less than a minute with smart automation
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#164e59' }}>
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Projects</h3>
                <p className="text-gray-600 text-sm">
                  Manage billable and non-billable hours across multiple projects
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#164e59' }}>
                  <User className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Absences</h3>
                <p className="text-gray-600 text-sm">
                  Track vacations, sick days, and other absences effortlessly
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#164e59' }}>
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Analytics</h3>
                <p className="text-gray-600 text-sm">
                  Comprehensive reporting and team productivity insights
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 lg:px-8 py-8 border-t border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                © 2024 by tik-tak. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm text-gray-600">
                <a href="#" className="hover:text-gray-900">Terms & Conditions</a>
                <a href="#" className="hover:text-gray-900">Privacy Policy</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Connection Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Connect to Bexio</h3>
                <button 
                  onClick={() => setShowManualEntry(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <BexioConnector onConnect={onConnect} onOAuthConnect={onOAuthConnect} isConnected={isConnected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};