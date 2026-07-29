// Adarsh Hospital — Service Worker
// Cache-First for static assets · Network-First for HTML · Offline fallback

const CACHE_VERSION = 'v4';
const CACHE_NAME = 'adarsh-hospital-' + CACHE_VERSION;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/style.min.css',
  '/main.min.js',
  '/config.js',
  '/manifest.webmanifest',
  '/assets/fonts/poppins-400.woff2',
  '/assets/fonts/poppins-600.woff2',
  '/assets/fonts/poppins-700.woff2',
  '/assets/favicon-192x192.png',
  '/assets/favicon-512x512.png',
  '/assets/apple-touch-icon.png',
];

// ── Install: pre-cache critical assets ───────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] Pre-caching assets (cache: ' + CACHE_NAME + ')');
      return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old cache versions ────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name.startsWith('adarsh-hospital-') && name !== CACHE_NAME;
          })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (Supabase CDN, unpkg Lucide, etc.)
  if (url.origin !== self.location.origin) return;

  // ── Network-First for HTML navigation ──────────────────────────────────────
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          // Cache a fresh copy on success
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          // Offline: serve cached page, or offline.html as final fallback
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // ── Cache-First for fonts ───────────────────────────────────────────────────
  // Fonts never change — serve straight from cache, fetch once and store
  if (url.pathname.startsWith('/assets/fonts/')) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        });
      })
    );
    return;
  }

  // ── Cache-First for all other same-origin assets (CSS, JS, images) ─────────
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // Only cache successful, non-opaque responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function () {
        // For image requests, return nothing gracefully
        return new Response('', { status: 404 });
      });
    })
  );
});
