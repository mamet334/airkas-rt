const CACHE_NAME = 'airkasrt-static-cache-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.json'
];

// Install: pre-cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: intercept requests for offline caching
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip requests to external domains (e.g. Supabase DB backend)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Intercept navigation requests to return index.html when offline (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Network-First strategy for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache valid same-origin assets
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable
        return caches.match(event.request);
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'AirKas RT', body: 'Ada notifikasi baru dari AirKas RT.' };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (err) {
    console.warn('Push event payload invalid:', err);
  }

  const options = {
    body: payload.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'airkas-rt-reminder',
    data: payload.data || {}
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification was closed', event.notification.tag);
});
