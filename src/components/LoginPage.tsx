
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, Database, Shield, Zap, Users, BarChart3, CheckCircle2 } from "lucide-react";
import { BexioConnector } from "./BexioConnector";

interface LoginPageProps {
  onConnect: (credentials: any) => Promise<void>;
  onOAuthConnect: () => Promise<void>;
  isConnected: boolean;
}

export const LoginPage = ({ onConnect, onOAuthConnect, isConnected }: LoginPageProps) => {
  const features = [
    {
      icon: Clock,
      title: "Smart Time Tracking",
      description: "Intuitive time logging with automatic project detection"
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Real-time insights into productivity and billing"
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Collaborate seamlessly with your team members"
    },
    {
      icon: Shield,
      title: "Secure Integration",
      description: "Bank-level security with OAuth 2.0 authentication"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
          {/* Logo & Brand */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <Database className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  <span>data</span>
                  <span className="text-accent">^</span>
                  <span>bridge</span>
                </h1>
                <p className="text-white/80 text-sm">Analytics Platform</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Transform Your
              <br />
              <span className="text-accent">Business Intelligence</span>
            </h2>
            <p className="text-xl text-white/90 leading-relaxed">
              Connect seamlessly with Bexio and unlock powerful insights into your business operations, time tracking, and team productivity.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="p-2 rounded-lg bg-white/20">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-white/80">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex items-center gap-6">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                <Shield className="h-3 w-3 mr-1" />
                SOC 2 Compliant
              </Badge>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                99.9% Uptime
              </Badge>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">
                <span className="text-primary">data</span>
                <span className="text-accent">^</span>
                <span className="text-primary">bridge</span>
              </h1>
            </div>
            <p className="text-muted-foreground">Connect to your Bexio account</p>
          </div>

          {/* Login Card */}
          <Card className="corporate-card border-0 shadow-[var(--shadow-elegant)]">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-title">Welcome Back</CardTitle>
              <p className="text-muted-foreground">
                Connect your Bexio account to access powerful business analytics
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <BexioConnector 
                onConnect={onConnect}
                onOAuthConnect={onOAuthConnect}
                isConnected={isConnected}
              />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Secure Connection
                  </span>
                </div>
              </div>

              {/* Security Notice */}
              <div className="text-center text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <Shield className="h-4 w-4 inline mr-1" />
                Your connection is secured with OAuth 2.0 encryption
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Databridge Analytics. Built with modern security standards.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
