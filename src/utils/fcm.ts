/* FCM setup: permission + token registration for real background push.
 * Called from NotificationBell's enable-push button.
 */

import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
const FCM_TOKENS_COLLECTION = 'fcmTokens';

let messagingInstance: Messaging | null = null;

async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging();
  return messagingInstance;
}

export interface FcmSetupResult {
  ok: boolean;
  error?: string;
  denied?: boolean;
}

/** Ask permission, get the FCM token, store it in Firestore for the current user. */
export async function enableFcmPush(userId: string): Promise<FcmSetupResult> {
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return { ok: false, error: 'الإشعارات غير مدعومة في هذا المتصفح' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, denied: true, error: 'لم يتم السماح بالإشعارات' };

    if (!('serviceWorker' in navigator)) return { ok: false, error: 'Service worker غير مدعوم' };

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'مفتاح VAPID غير مضبوط — ضيفه في إعدادات Vercel (VITE_FCM_VAPID_KEY)' };

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, error: 'تعذر توليد رمز الإشعارات' };

    await setDoc(doc(db, FCM_TOKENS_COLLECTION, userId), { token, updatedAt: serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'خطأ في تفعيل الإشعارات' };
  }
}

/** Read a VAPID key placeholder for UI hints. */
export function fcmConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY);
}
