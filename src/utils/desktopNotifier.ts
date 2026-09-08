import { soundAlertManager } from './soundAlert';

export interface DesktopNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  playSound?: boolean;
  soundType?: 'warning' | 'cash' | 'success' | 'bell';
  tag?: string;
}

/**
 * Checks if Desktop Notifications are supported in the current browser.
 */
export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets the current notification permission state.
 */
export function getDesktopNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests desktop notification permissions from the user.
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!isDesktopNotificationSupported()) {
    console.warn('Desktop Notifications are not supported in this browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Sends a desktop notification if permission is granted and plays an audio chime.
 */
export function sendDesktopNotification({
  title,
  body = '',
  icon = '/vite.svg',
  playSound = true,
  soundType = 'warning',
  tag = 'ifc-academy-notif',
}: DesktopNotificationOptions): boolean {
  // Play accompanying alert sound if requested
  if (playSound) {
    try {
      if (soundType === 'cash') {
        soundAlertManager.playCashRegisterTone();
      } else if (soundType === 'success') {
        soundAlertManager.playSuccessTone();
      } else if (soundType === 'warning') {
        soundAlertManager.playWarningBellChime();
      } else {
        soundAlertManager.playWarningBellChime();
      }
    } catch (e) {
      console.warn('Could not play notification sound:', e);
    }
  }

  if (!isDesktopNotificationSupported()) return false;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon,
        tag,
        badge: icon,
        dir: 'rtl',
        lang: 'ar',
      });

      // Auto close after 6 seconds
      setTimeout(() => {
        try {
          notif.close();
        } catch {
          // ignore
        }
      }, 6000);

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return true;
    } catch (err) {
      console.warn('Could not show Desktop Notification:', err);
      return false;
    }
  }

  return false;
}
