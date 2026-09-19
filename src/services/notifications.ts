/**
 * Notifications service — FCM web push (اشعار فوري حتى والتطبيق مقفول)
 * - يسجّل توكن الجهاز في Firestore (users/<uid>/fcmTokens)
 * - يسمع رسايل الفورجراوند ويعرض اشعار داخلي
 * VAPID key من Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
 */
import { getApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// VAPID key ثابت (من Firebase Console — Web Push certificates)
const VAPID_KEY = "BE7JIolZ1hZP4a9CVZf7xhJDkr-wXksk4YcoC0fnDmwCltRl-ePAIykUNv7W25MKOJGORR9VYViw3IL6SstFzIQ";

let messagingInstance: Messaging | null = null;

export type NewBrochurePayload = {
  booklet: string;
  entitiesCount: number;
  lotsCount: number;
  auctionDate?: string;
  source?: string;
};

async function ensureMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  messagingInstance = getMessaging(getApp());
  return messagingInstance;
}

/** يسجّل توكن FCM للجهاز الحالي في Firestore */
export async function registerPushToken(uid: string): Promise<string | null> {
  if (!VAPID_KEY) return null;
  const messaging = await ensureMessaging();
  if (!messaging) return null;
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    if (!token) return null;
    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', token),
      { token, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return token;
  } catch (err) {
    console.warn('FCM token registration failed:', err);
    return null;
  }
}

/** يسمع رسايل FCM في الفورجراوند — يرجع دالة إلغاء الاشتراك */
export function onForegroundMessage(
  callback: (payload: NewBrochurePayload) => void,
): () => void {
  let unsub: (() => void) | null = null;
  void (async () => {
    const messaging = await ensureMessaging();
    if (!messaging) return;
    unsub = onMessage(messaging, (msg) => {
      const data = (msg.data ?? {}) as Record<string, unknown>;
      callback({
        booklet: String(data.booklet ?? ''),
        entitiesCount: Number(data.entitiesCount ?? 0),
        lotsCount: Number(data.lotsCount ?? 0),
        auctionDate: data.auctionDate ? String(data.auctionDate) : undefined,
        source: data.source ? String(data.source) : undefined,
      });
    });
  })();
  return () => {
    if (unsub) unsub();
  };
}
