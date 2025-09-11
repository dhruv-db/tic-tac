import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobilePullToRefreshProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  children: React.ReactNode;
  className?: string;
}

const MobilePullToRefresh: React.FC<MobilePullToRefreshProps> = ({
  onRefresh,
  isRefreshing,
  children,
  className
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;
  const MIN_PULL_START = 10; // Minimum distance to start pull gesture

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDragging = false;
    let hasStartedPull = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull-to-refresh if at the very top and it's a downward gesture
      if (container.scrollTop <= 5) {
        startY.current = e.touches[0].clientY;
        isDragging = true;
        hasStartedPull = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      // If user has scrolled down, cancel the pull gesture
      if (container.scrollTop > 10) {
        isDragging = false;
        hasStartedPull = false;
        setPullDistance(0);
        setIsPulling(false);
        setCanRefresh(false);
        return;
      }

      currentY.current = e.touches[0].clientY;
      const deltaY = currentY.current - startY.current;

      // Only start pull gesture if moved down significantly
      if (deltaY > MIN_PULL_START && !hasStartedPull) {
        hasStartedPull = true;
      }

      if (hasStartedPull && deltaY > 0) {
        e.preventDefault();
        const distance = Math.min(deltaY * 0.5, MAX_PULL);
        setPullDistance(distance);
        setIsPulling(true);
        setCanRefresh(distance >= PULL_THRESHOLD);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;

      isDragging = false;

      // Only refresh if we actually pulled down enough and it's not already refreshing
      if (canRefresh && hasStartedPull && !isRefreshing) {
        onRefresh();
      }

      setPullDistance(0);
      setIsPulling(false);
      setCanRefresh(false);
      hasStartedPull = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canRefresh, isRefreshing, onRefresh]);

  const refreshProgress = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);

  return (
    <div className={cn("relative overflow-hidden h-full", className)} ref={containerRef}>
      {/* Pull Indicator */}
      <AnimatePresence>
        {isPulling && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-4 bg-background/95 backdrop-blur-sm border-b"
          >
            <motion.div
              animate={{ rotate: canRefresh ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={cn(
                  "h-5 w-5 transition-colors",
                  canRefresh ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className={cn(
                "text-sm font-medium transition-colors",
                canRefresh ? "text-primary" : "text-muted-foreground"
              )}>
                {canRefresh ? "Release to refresh" : "Pull to refresh"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refreshing Indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-4 bg-background/95 backdrop-blur-sm"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="flex items-center"
            >
              <RefreshCw className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        animate={{
          y: isRefreshing ? 60 : isPulling ? pullDistance : 0
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default MobilePullToRefresh;