const CACHE_NAME = 'al3bara-v4';
const urlsToCache = [
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json'
];

// Install event - cache static assets only (never the app shell itself —
// index.html always comes from the network so updates land immediately).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch(() => Promise.resolve());
          })
        );
      })
      .catch(() => undefined)
  );
  self.skipWaiting();
});

// Activate: clean up ALL old caches so updates land immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName)),
    )).then(() => self.clients.claim()),
  );
});

// Fetch: network-first for app shell & JS (fresh builds always win),
// cache-first only for static icons. Offline fallback when the network fails.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    ['/favicon.png', '/icon-192x192.png', '/icon-512x512.png', '/manifest.json'].includes(url.pathname);

  if (isStaticAsset) {
    // Cache-first: hashed filenames change on every build, so old entries
    // never shadow new ones.
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ??
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Network-first for the app shell (/, /index.html, service-worker.js…).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => caches.match('/index.html'))
  );
});
