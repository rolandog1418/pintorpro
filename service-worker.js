const CACHE_NAME = 'pintorpro-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// INSTALACIÓN RÁPIDA
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        CORE_ASSETS.map(url =>
          fetch(url)
            .then(res => res.ok && cache.put(url, res))
            .catch(() => null)
        )
      );
    })
  );
});

// ACTIVACIÓN LIMPIA
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// FETCH OPTIMIZADO
self.addEventListener('fetch', event => {
  const req = event.request;

  // SOLO GET
  if (req.method !== 'GET') return;

  // HTML → CACHE FIRST (instantáneo)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match('/index.html').then(
        cached => cached || fetch(req)
      )
    );
    return;
  }

  // OTROS ARCHIVOS → STALE WHILE REVALIDATE
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(req, res.clone())
            );
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
