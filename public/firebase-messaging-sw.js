/* firebase-messaging-sw.js — اشعارات FCM في الخلفية (والتطبيق مقفول) */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDgMxJjb_ENhCgpmn1l02AwhWzDkGAxAa0",
  authDomain: "al3bara-data-b1abe.firebaseapp.com",
  projectId: "al3bara-data-b1abe",
  storageBucket: "al3bara-data-b1abe.appspot.com",
  messagingSenderId: "87091757430",
  appId: "1:87091757430:web:edcede33053c79f239ba57"
});

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const lots = Number(data.lotsCount || 0);
    const entities = Number(data.entitiesCount || 0);
    const title = data.title || 'كراسة جديدة نزلت 📋';
    const body = data.body ||
      (lots > 0
        ? `كراسة ${data.booklet || 'جديدة'} — ${entities} جهة و ${lots} لوط`
        : 'فتشت على كراسة جديدة — افتح التطبيق');

    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.booklet || 'gcs-brochure',
      data: { url: '/' },
    });
  });
} catch (err) {
  // messaging not supported in this browser
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
