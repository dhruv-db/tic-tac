import { Capacitor } from '@capacitor/core';

// Register Capacitor plugins
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';

// Initialize plugins (this ensures they're properly registered)
export const initializeCapacitorPlugins = () => {
  // Plugins are automatically registered when imported
  console.log('Capacitor plugins initialized');
};

// Export plugins for use in components
export {
  App,
  Browser,
  Camera,
  Geolocation,
  Haptics,
  PushNotifications
};