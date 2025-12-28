const CACHE_NAME = 'pintorpro-v3-fast'; // Cambié la versión para forzar actualización

// Archivos vitales que deben estar sí o sí
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  // Si tienes iconos locales agrégalos aquí, ej: '/icon-192.png'
];

// 1. INSTALACIÓN: Descarga lo vital
self.addEventListener('install', event => {
  self.skipWaiting(); // Forza al SW a activarse de inmediato
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// 2. ACTIVACIÓN: Limpia cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim(); // Toma control de la página inmediatamente
});

// 3. FETCH: Estrategia CACHE FIRST (Velocidad Máxima)
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean GET (ej. envíos de formularios, aunque aquí usamos LocalStorage)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // A. ESTRATEGIA PARA HTML (Siempre intenta devolver la app, incluso offline)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match('/index.html').then(cached => {
        // Si hay caché úsalo, si no, ve a internet, si falla, devuelve el index caché como fallback
        return cached || fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // B. ESTRATEGIA PARA TODO LO DEMÁS (JS, CSS, IMÁGENES, FUENTES)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // 1. Si está en caché, DEVUELVE INMEDIATAMENTE. No vayas a internet.
        return cachedResponse;
      }

      // 2. Si no está en caché, búscalo en internet y guárdalo para la próxima
      return fetch(event.request).then(networkResponse => {
        // Solo guardamos en caché si la respuesta es válida
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          // Nota: Las librerías externas (CDN) tienen type 'cors', 
          // si quieres cachearlas quita la restricción networkResponse.type !== 'basic'
          // Para este caso, permitiremos cachear todo lo que responda 200 OK:
          if(networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        }
        
        // Guardar copia en caché
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Si falla internet y no estaba en caché (Offline total para recursos nuevos)
        // Podrías retornar una imagen placeholder aquí si quisieras
      });
    })
  );
});
  
