import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const useHapticFeedback = () => {
  const isNative = Capacitor.isNativePlatform();

  const lightImpact = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const mediumImpact = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const heavyImpact = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const success = async () => {
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const warning = async () => {
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Warning });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const error = async () => {
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Error });
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    success,
    warning,
    error,
    isNative
  };
};