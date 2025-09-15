import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  BarChart3,
  Plus,
  Settings,
  User,
  RefreshCw,
  LogOut,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  user?: {
    id: number;
    firstname: string;
    lastname: string;
  };
  isAdmin?: boolean;
  isConnected?: boolean;
  onRefresh?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  logoUrl?: string;
  onAddEntry?: () => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  user,
  isAdmin = false,
  isConnected = false,
  onRefresh,
  onDisconnect,
  isLoading = false,
  logoUrl,
  onAddEntry
}) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
    {
      id: 'timetracking',
      label: 'Time',
      icon: Home,
      badge: null
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{
      // Ensure safe area variables are available
      '--safe-area-inset-top': 'env(safe-area-inset-top, 0px)',
      '--safe-area-inset-bottom': 'env(safe-area-inset-bottom, 0px)',
      '--safe-area-inset-left': 'env(safe-area-inset-left, 0px)',
      '--safe-area-inset-right': 'env(safe-area-inset-right, 0px)'
    } as React.CSSProperties}>
      {/* Mobile Header */}
      <motion.header
        className={cn(
          "sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b transition-all duration-300",
          isScrolled && "shadow-sm"
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px), 1rem)',
          paddingRight: 'max(env(safe-area-inset-right, 0px), 1rem)',
          top: 'env(safe-area-inset-top, 0px)'
        }}
      >
        {/* Minimal Header - No Title or Actions */}
        <div className="px-4 py-2">
           {/* Empty header for safe area spacing only */}
         </div>
      </motion.header>

      {/* Main Content */}
      <main
        className="flex-1 overflow-hidden"
        style={{
          paddingBottom: 'calc(4rem + var(--safe-area-inset-bottom))',
          paddingLeft: 'var(--safe-area-inset-left)',
          paddingRight: 'var(--safe-area-inset-right)',
          paddingTop: 'var(--safe-area-inset-top)'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
            style={{
              paddingTop: '1rem'
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <motion.nav
        className="sticky bottom-0 z-50 bg-background/95 backdrop-blur-md border-t"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          paddingBottom: 'var(--safe-area-inset-bottom)',
          paddingLeft: 'var(--safe-area-inset-left)',
          paddingRight: 'var(--safe-area-inset-right)',
          bottom: 'var(--safe-area-inset-bottom)'
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 relative",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon className="h-5 w-5 mb-1" />
                </motion.div>
                <span className="text-xs font-medium">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.nav>

      {/* Floating Action Button for Quick Actions */}
      <motion.div
        className="fixed bottom-20 right-4 z-40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        style={{
          bottom: 'calc(5rem + var(--safe-area-inset-bottom))',
          right: 'calc(1rem + var(--safe-area-inset-right))'
        }}
      >
        <motion.div
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
        >
          <Button
            size="sm"
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-teal-600 hover:bg-teal-700"
            onClick={() => onAddEntry ? onAddEntry() : onTabChange('add')}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default MobileLayout;