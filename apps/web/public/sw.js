/**
 * Resumaker Service Worker
 *
 * Strategy:
 * - Static assets (images, fonts): cache-first
 * - Page navigations: stale-while-revalidate
 * - API routes: network-only (no caching of auth/data)
 * - Offline fallback: /offline page
 */

// Bump CACHE_VERSION on every SW behavioral change. The activate handler
// deletes any cache that doesn't match the current STATIC_CACHE / PAGES_CACHE
// names, so bumping forces a full cache wipe + reinstall and supersedes any
// stuck SW left over from a previous deploy.
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `resumaker-static-${CACHE_VERSION}`;
const PAGES_CACHE = `resumaker-pages-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline';

const STATIC_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
];

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
  // Non-blocking install: if /offline can't be cached (network blip, 404,
  // anything), we STILL want the SW to install. Otherwise it gets stuck in
  // "installing" forever and the activate handler never runs, leaving any
  // previous SW in control of the page. That's how an old broken SW takes
  // a site hostage.
  event.waitUntil(
    Promise.resolve()
      .then(() =>
        caches
          .open(PAGES_CACHE)
          .then((cache) => cache.add(OFFLINE_URL))
          .catch(() => {
            // Swallow — install must succeed regardless.
          }),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE).map((k) => caches.delete(k)),
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

  // Page navigations: stale-while-revalidate.
  //
  // CRITICAL: never return Response.error() — Safari renders that as its
  // generic "this page couldn't load" page. If both cache and network miss,
  // re-throw so the browser surfaces its OWN error UI (which the user can
  // recover from) instead of a poisoned Response object from us.
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(async (err) => {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
            // Re-throw so the browser handles it natively.
            throw err;
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
