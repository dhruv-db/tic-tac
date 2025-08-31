
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

export const LoginPage = ({ onConnect, onOAuthConnect, isConnected }: LoginPageProps) => {
  const SmarttrackrLogo = () => (
    <svg width="120" height="51" viewBox="0 0 404 173" fill="none" className="h-8 w-auto">
      <path fillRule="evenodd" clipRule="evenodd" d="M192.654 163.534L192.246 165.92C190.445 165.88 189.168 165.502 188.415 164.788C187.661 164.074 187.284 162.963 187.284 161.453V142.36L190.205 141.87V160.994C190.205 161.463 190.246 161.851 190.33 162.157C190.414 162.463 190.55 162.708 190.738 162.891C190.927 163.075 191.178 163.212 191.492 163.304C191.806 163.396 192.193 163.473 192.654 163.534Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M235.561 28.8813C233.571 32.5503 230.732 37.3207 229.109 40.0315C232.964 46.7843 235.168 54.6012 235.168 62.9339C235.168 88.4827 214.455 109.193 188.905 109.193C163.355 109.193 142.642 88.4827 142.642 62.9339C142.642 37.3859 163.355 16.6745 188.905 16.6745C195.908 16.6745 202.547 18.2307 208.497 21.0156C210.198 18.0962 212.636 13.9727 214.29 11.0126C206.531 7.18563 197.798 5.03464 188.563 5.03464C156.405 5.03464 130.335 31.1049 130.335 63.2631C130.335 95.4212 156.405 121.491 188.563 121.491C220.721 121.491 246.791 95.4212 246.791 63.2631C246.791 50.4027 242.621 38.5168 235.561 28.8813Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M230.926 0.55555L189.423 73.7195L167.873 36.7059H152.73L174.712 74.4595H189.003V74.4603H198.148L240.072 0.55555H230.926Z" fill="#5FAF59"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.0495 164.574C11.6573 165.574 9.69469 166.073 7.16158 166.073C6.30326 166.073 5.51297 166.017 4.79072 165.905L1.35219 162.126C1.83369 162.391 2.56641 162.687 3.55034 163.014C4.53427 163.34 5.73802 163.503 7.16158 163.503C10.3437 163.503 11.9347 162.442 11.9347 160.321V157.46C9.8831 157.123 9.33356 156.833 8.71599 156.588L6.75336 155.854C5.95784 155.588 5.20418 155.288 4.4924 154.951L2.63968 153.758C2.11631 153.299 1.70285 152.753 1.39929 152.121C1.09574 151.488 0.943962 150.723 0.943962 149.826C0.943962 147.97 1.59294 146.521 2.89089 145.481C4.18885 144.441 5.97877 143.92 8.26066 143.92C9.57955 143.92 10.7781 144.058 11.8562 144.334L13.2536 147.653C12.814 147.388 12.1598 147.128 11.291 146.873C10.4222 146.618 9.41207 146.491 8.26066 146.491C7.67449 146.491 7.13018 146.552 6.62775 146.674L4.4139 148.158C4.19408 148.536 4.08417 148.979 4.08417 149.489C4.08417 150.06 4.19932 150.54 4.4296 150.927L5.40306 151.952C5.82176 152.248 6.30849 152.518 6.86326 152.763L8.70029 153.498C9.64235 153.865 10.5059 154.232 11.291 154.599L13.3321 155.915C13.9078 156.425 14.3527 157.032 14.6667 157.735C14.9807 158.439 15.1377 159.291 15.1377 160.29C15.1377 162.147 14.4416 163.575 13.0495 164.574Z" fill="currentColor"/>
    </svg>
  );

  const features = [
    {
      icon: Timer,
      title: "Precise Time Tracking",
      description: "Track billable hours with precision and automated project matching"
    },
    {
      icon: Target,
      title: "Project Insights",
      description: "Monitor project progress and profitability in real-time"
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Optimize your schedule with intelligent time allocation"
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Detailed reports on productivity and time utilization"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
          {/* Logo & Brand */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-white">
                <SmarttrackrLogo />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Master Your
              <br />
              <span className="text-accent">Time & Projects</span>
            </h2>
            <p className="text-xl text-white/90 leading-relaxed">
              Connect seamlessly with Bexio and transform how you track time, manage projects, and analyze productivity across your team.
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
              <div className="text-primary">
                <SmarttrackrLogo />
              </div>
            </div>
            <p className="text-muted-foreground">Connect to your Bexio account</p>
          </div>

          {/* Login Card */}
          <Card className="corporate-card border-0 shadow-[var(--shadow-elegant)]">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-title">Welcome to Smarttrackr</CardTitle>
              <p className="text-muted-foreground">
                Connect your Bexio account to start tracking time and managing projects efficiently
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
            <p>© 2024 Smarttrackr. Built with modern security standards.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
