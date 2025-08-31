import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, Shield, Zap, Users, BarChart3, CheckCircle2, Target, Calendar } from "lucide-react";
import { BexioConnector } from "./BexioConnector";
interface LoginPageProps {
  onConnect: (apiKey: string, companyId: string) => Promise<void>;
  onOAuthConnect: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => Promise<void>;
  isConnected: boolean;
}
export const LoginPage = ({
  onConnect,
  onOAuthConnect,
  isConnected
}: LoginPageProps) => {
  const TikTakLogo = ({ className = "" }) => (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <img 
        src="/lovable-uploads/4363b3b2-8f6b-49f6-8c4e-9802678fe2c1.png" 
        alt="tik-tak" 
        className="h-10 w-auto md:h-12" 
      />
      <p className="text-sm opacity-80">Smart & simple time-tracking</p>
    </div>
  );
  const features = [{
    icon: Timer,
    title: "Precise Time Tracking",
    description: "Track billable hours with precision and automated project matching"
  }, {
    icon: Target,
    title: "Project Insights",
    description: "Monitor project progress and profitability in real-time"
  }, {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Optimize your schedule with intelligent time allocation"
  }, {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Detailed reports on productivity and time utilization"
  }];
  return <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white bg-[#164e59]">
          {/* Logo & Brand */}
          <div className="mb-12 text-center">
            <TikTakLogo className="mb-6" />
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
              Transform Your Time Tracking
            </h1>
            <p className="text-xl text-white/90 leading-relaxed">
              Connect seamlessly with Bexio and transform how you track time, manage projects, and analyze productivity across your team.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 gap-6">
            {features.map((feature, index) => <div key={index} className="flex items-start gap-4 p-4 rounded-lg backdrop-blur-sm border border-white/20 bg-[#134651]">
                <div className="p-2 rounded-lg bg-white/20">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1 text-[#5faf59]">{feature.title}</h3>
                  <p className="text-sm text-white/80">{feature.description}</p>
                </div>
              </div>)}
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
            <TikTakLogo className="text-primary" />
          </div>

          {/* Login Card */}
          <Card className="corporate-card border-0 shadow-[var(--shadow-elegant)]">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-title">Welcome to tik-tak</CardTitle>
              <p className="text-muted-foreground">
                Connect your Bexio account to start tracking time and managing projects efficiently
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <BexioConnector onConnect={onConnect} onOAuthConnect={onOAuthConnect} isConnected={isConnected} className="py-0" />
              
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
            <p>© 2024 tik-tak. Built with modern security standards.</p>
          </div>
        </div>
      </div>
    </div>;
};