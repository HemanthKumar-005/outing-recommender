// Nearby PWA Service Worker
// Strategy:
//   - App shell (HTML, CSS, JS bundles): Cache-first, update in background
//   - API calls (/api/*): Network-first, fall back to cached response if offline
//   - Images: Cache-first with a 50-item LRU cap
//   - Everything else: Network-only

const SHELL_CACHE = 'nearby-shell-v2';
const API_CACHE   = 'nearby-api-v1';
const IMG_CACHE   = 'nearby-img-v1';
const IMG_CACHE_LIMIT = 50;

const SHELL_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// --- Install ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// --- Activate ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![SHELL_CACHE, API_CACHE, IMG_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API: network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Images: cache-first with LRU cap
  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithLimit(request, IMG_CACHE, IMG_CACHE_LIMIT));
    return;
  }

  // Shell: cache-first, revalidate in background (stale-while-revalidate)
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // If it's a navigation request and we're offline, show offline page
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    return new Response(JSON.stringify({ error: 'offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkFetch || caches.match('/offline');
}

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Enforce LRU limit
      const keys = await cache.keys();
      if (keys.length >= limit) await cache.delete(keys[0]);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}
