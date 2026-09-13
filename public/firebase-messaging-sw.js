/* Firebase Cloud Messaging service worker.
 * Handles background push notifications when the app is closed.
 * The VAPID key is public (safe to expose) and injected at build time.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

/* eslint-disable no-undef */
firebase.initializeApp({
  apiKey: self.FIREBASE_CONFIG?.apiKey,
  authDomain: self.FIREBASE_CONFIG?.authDomain,
  projectId: self.FIREBASE_CONFIG?.projectId,
  storageBucket: self.FIREBASE_CONFIG?.storageBucket,
  messagingSenderId: self.FIREBASE_CONFIG?.messagingSenderId,
  appId: self.FIREBASE_CONFIG?.appId,
});

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification ?? {};
    const data = payload.data ?? {};
    self.registration.showNotification(notification.title ?? 'العبارة', {
      body: notification.body ?? '',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag ?? 'al3bara',
      data: { ...data },
    });
  });
} catch (error) {
  // messaging not supported — ignore
}

/* Click focus: open (or focus) the app when a push is tapped. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
