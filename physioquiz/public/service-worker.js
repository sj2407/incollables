// Les Incollables — Service Worker
// Provides offline shell and caches static assets only

const CACHE_NAME = 'physioquiz-v2';
const STATIC_ASSETS = ['/', '/manifest.json'];

// Only cache static asset extensions — never API responses or HTML pages
const CACHEABLE_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Never intercept API calls or Supabase requests
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase') ||
    event.request.url.includes('/rest/') ||
    event.request.url.includes('/auth/')
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // For navigation requests (HTML pages) — network-first with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // For static assets — cache-first
  if (CACHEABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Everything else — network only (don't cache)
});
