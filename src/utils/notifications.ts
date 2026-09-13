/**
 * Phone/PWA notifications (web Notifications API).
 *
 * Works out of the box on Android Chrome (installed PWA or normal tab) and on
 * iOS when the app is added to the home screen (iOS >= 16.4). When the app is
 * open these fire immediately; the service worker keeps them working while the
 * app is in the background. True server push (app fully closed) can later be
 * layered with FCM + a VAPID key on top of the same permission flow — the
 * permission state and this module are already the entry point for that.
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Fires a system/phone notification. Returns false when not permitted. */
export function showLocalNotification(
  title: string,
  options?: { body?: string; tag?: string; data?: Record<string, unknown> },
): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const notification = new Notification(title, {
      body: options?.body,
      tag: options?.tag,
      icon: '/icon-192x192.png',
      badge: '/favicon.png',
      dir: 'rtl',
      lang: 'ar',
      data: options?.data,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
