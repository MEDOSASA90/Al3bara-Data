/* Firebase Cloud Messaging service worker.
 * Handles background push notifications when the app is closed.
 * Firebase config (public — safe to expose in client code).
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

/* eslint-disable no-undef */
firebase.initializeApp({
  apiKey: 'AIzaSyDgMxJjb_ENhCgpmn1l02AwhWzDkGAxAa0',
  authDomain: 'al3bara-data-b1abe.firebaseapp.com',
  projectId: 'al3bara-data-b1abe',
  storageBucket: 'al3bara-data-b1abe.appspot.com',
  messagingSenderId: '87091757430',
  appId: '1:87091757430:web:edcede33053c79f239ba57',
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
