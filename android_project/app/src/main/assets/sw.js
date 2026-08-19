const CACHE_NAME = 'iranian-highway-v18-standard-smooth';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './audio.js',
    './three.min.js',
    './peer.min.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Always Fetch Fresh from Server (Network First)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).then((response) => {
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
            }
            return response;
        }).catch(() => {
            return caches.match(e.request);
        })
    );
});
