const CACHE_NAME = 'iranian-highway-v200-remove-warning-banner-entirely';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Network-first strategy to prevent stale code caching
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
