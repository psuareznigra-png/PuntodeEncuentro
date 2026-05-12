const CACHE_NAME = 'punto-activo-v1';
const ASSETS = [
    'index.html',
    'index.css',
    'app.js',
    'db.js',
    'Img/Punto Activo.jpeg'
];

// Instalar Service Worker y cachear activos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activar y limpiar caches antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// Estrategia: Network First con fallback a Cache (para asegurar datos frescos)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
