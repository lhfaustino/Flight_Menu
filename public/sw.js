const CACHE_NAME = 'trip-space-v3';
const urlsToCache = [
  '/offline.html',
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        // It's ok if some urls fail to cache
        console.log('Some URLs failed to cache during installation');
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CLEAR_APP_CACHES') {
    event.waitUntil(clearAppCaches());
  }
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Server-rendered pages, API calls, and Next runtime data must stay fresh
  // after deploys because Server Action IDs change between builds.
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    event.request.headers.get('accept')?.includes('text/x-component') ||
    event.request.headers.has('next-action') ||
    requestUrl.searchParams.has('_rsc') ||
    requestUrl.pathname.startsWith('/api/') ||
    (requestUrl.pathname.startsWith('/_next/') && !requestUrl.pathname.startsWith('/_next/static/'))
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html') || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Cache first strategy for versioned static assets and public files.
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          return caches.match('/offline.html') || new Response('Offline', { status: 503 });
        });
    })
  );
});

function clearAppCaches() {
  return caches.keys().then((cacheNames) =>
    Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('trip-space-') || cacheName.startsWith('workbox-') || cacheName.startsWith('next-pwa-'))
        .map((cacheName) => caches.delete(cacheName))
    )
  );
}
