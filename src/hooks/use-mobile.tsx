import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkIsMobile = () => {
      // Check for mobile devices using multiple methods
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';

      // Check for iOS devices
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

      // Check for Android devices
      const isAndroid = /android/i.test(userAgent);

      // Check for other mobile devices
      const isMobileDevice = /Mobi|Android/i.test(userAgent);

      // Check screen width
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;

      // Check for touch capability
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Determine if mobile based on multiple factors
      const mobileByDevice = isIOS || isAndroid || (isMobileDevice && hasTouch);
      const mobileByScreen = isSmallScreen;

      // Prioritize device detection over screen size for better mobile experience
      const result = mobileByDevice || (mobileByScreen && hasTouch);

      setIsMobile(result);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      checkIsMobile();
    }

    mql.addEventListener("change", onChange)
    checkIsMobile();

    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
