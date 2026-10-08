/* Local Finder service worker — offline app shell + asset cache.
 * Bump CACHE_NAME whenever the shell list changes. */
const CACHE_NAME = 'localfinder-v1';

const SHELL = [
  '/',
  '/saved',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {}), // offline first install: fail soft, cache fills on fetch
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // API calls are never cached — always hit the network.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation requests: network first, fall back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/')),
    );
    return;
  }

  // Static assets (_next build output, icons, manifest): cache first,
  // refreshing the cache in the background.
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.ok && (url.pathname.startsWith('/_next/') || /\.(png|svg|ico|json)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          }
          return res;
        });
      }),
    );
  }
});
