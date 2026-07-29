// Adarsh Hospital — Service Worker
// Cache-First strategy for static assets, Network-First for HTML pages

const CACHE_NAME = 'adarsh-hospital-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.min.css',
  '/main.min.js',
  '/config.js',
  '/manifest.webmanifest',
  '/assets/logo1.webp',
  '/assets/favicon-192x192.png',
  '/assets/favicon-512x512.png',
  '/assets/apple-touch-icon.png',
  '/assets/emergency-care.webp',
  '/assets/diagnostics.webp',
  '/assets/womens-health.webp',
  '/assets/specialist-care.webp',
];

// Install: pre-cache static assets
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] Pre-caching static assets');
      // Use addAll but don't fail install if a resource is unavailable
      return cache.addAll(STATIC_ASSETS).catch(function (err) {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-First for static assets, Network-First for HTML
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Skip non-GET requests and cross-origin requests (e.g. Supabase CDN, Google Fonts)
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network-First for HTML navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          // Cache a fresh copy
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(function () {
          // Offline fallback: serve cached version
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Cache-First for all other static assets (CSS, JS, images, fonts)
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // Only cache successful responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      });
    })
  );
});
