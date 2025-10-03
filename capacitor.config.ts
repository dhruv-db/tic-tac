import { CapacitorConfig } from '@capacitor/cli';

// Get server URL from environment variables
const getServerUrl = (): string => {
  // For iOS builds, we need to ensure we're using the production URL
  // Since environment variables might not be available during Capacitor config,
  // we'll use a simple approach

  // Check for explicit environment variable first
  if (process.env.VITE_MOBILE_SERVER_URL) {
    return process.env.VITE_MOBILE_SERVER_URL;
  }

  if (process.env.VITE_SERVER_URL) {
    return process.env.VITE_SERVER_URL;
  }

  // For iOS production builds, default to Vercel URL
  // This ensures the app connects to the correct backend
  return process.env.VITE_PRODUCTION_URL || 'https://tic-tac-puce-chi.vercel.app';
};

const config: CapacitorConfig = {
  appId: 'app.bexiosyncbuddy.app',
  appName: 'bexio-sync-buddy',
  webDir: 'dist',
  server: {
    url: getServerUrl(),
    cleartext: getServerUrl().startsWith('http:') // Allow cleartext for development
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true
    },
    CapacitorHttp: {
      enabled: true
    }
  },
  ios: {
    scheme: 'bexio-sync',
    loggingBehavior: 'none'
  }
};

export default config;