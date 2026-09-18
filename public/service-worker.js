const CACHE_NAME = 'al3bara-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Add files individually to handle duplicates gracefully
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch((error) => {
              console.log('Failed to cache:', url, error);
              // Continue even if one file fails
              return Promise.resolve();
            });
          })
        );
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Fetch event - NETWORK-FIRST للتنقل (index.html) — عشان التحديثات توصل فوراً
// والباقي cache-first (الأصول الثابتة)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // طلبات التنقل (HTML) — شبكة الأول + fallback للكاش
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              // Check if already cached to avoid duplicate error
              cache.match(event.request).then((cachedResponse) => {
                if (!cachedResponse) {
                  cache.put(event.request, responseToCache);
                }
              });
            })
            .catch((error) => {
              console.log('Cache put failed:', error);
            });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches + تفعيل فوري
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// SKIP_WAITING message — التفعيل الفوري للتحديثات
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
