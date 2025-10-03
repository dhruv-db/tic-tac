import { CapacitorConfig } from '@capacitor/cli';

// Get server URL from environment variables
const getServerUrl = (): string | undefined => {
  // For production mobile builds, don't set server URL to use local bundled assets
  // Only set server URL for development when CAPACITOR_SERVER_URL is explicitly set
  if (process.env.CAPACITOR_SERVER_URL) {
    return process.env.CAPACITOR_SERVER_URL;
  }

  // For production builds, return undefined to use local assets
  return undefined;
};

const serverUrl = getServerUrl();

const config: CapacitorConfig = {
  appId: 'app.bexiosyncbuddy.app',
  appName: 'bexio-sync-buddy',
  webDir: 'dist',
  ...(serverUrl && {
    server: {
      url: serverUrl,
      cleartext: serverUrl.startsWith('http:') // Allow cleartext for development
    }
  }),
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
    scheme: 'bexio-sync-buddy',
    loggingBehavior: 'none'
  }
};

export default config;