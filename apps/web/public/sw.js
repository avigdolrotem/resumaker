/**
 * Resumaker Service Worker
 *
 * Strategy:
 * - Static assets (images, fonts): cache-first
 * - Page navigations: stale-while-revalidate
 * - API routes: network-only (no caching of auth/data)
 * - Offline fallback: /offline page
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `resumaker-static-${CACHE_VERSION}`;
const PAGES_CACHE = `resumaker-pages-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline';

const STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isApiRoute(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // API routes: network-only, no caching
  if (isApiRoute(url)) return;

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Page navigations: stale-while-revalidate
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(async () => {
            const offline = await caches.match(OFFLINE_URL);
            return offline ?? Response.error();
          });
        return cached ?? fetchPromise;
      }),
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Resumaker', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Resumaker', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
