/**
 * @fileoverview Service Worker для оффлайн работы
 * @note Версия кэша устанавливается из app.js автоматически
 */

let CACHE_VERSION = 'v2.1.2';
let CACHE_NAME = 'cards-cache-' + CACHE_VERSION;

const SCOPE_PATH = '/cards/';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// ============================================
// MESSAGE HANDLER
// ============================================
self.addEventListener('message', function(event) {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SET_VERSION') {
        CACHE_VERSION = event.data.version;
        CACHE_NAME = 'cards-cache-' + CACHE_VERSION;
        console.log('[SW] Version set to:', CACHE_VERSION, 'Cache name:', CACHE_NAME);
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting triggered');
        self.skipWaiting();
    }
});

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', function(event) {
    console.log('[SW] Install', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(function() {                console.log('[SW] Assets cached, skipping wait');
                return self.skipWaiting();
            })
            .catch(function(err) {
                console.error('[SW] Install error:', err);
            })
    );
});

// ============================================
// ACTIVATE
// ============================================
self.addEventListener('activate', function(event) {
    console.log('[SW] Activate', CACHE_NAME);
    event.waitUntil(
        caches.keys()
            .then(function(names) {
                return Promise.all(
                    names.filter(function(name) {
                        return name !== CACHE_NAME;
                    }).map(function(name) {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
                );
            })
            .then(function() {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH
// ============================================
self.addEventListener('fetch', function(event) {
    var requestUrl = new URL(event.request.url);
    
    // version.json всегда из сети
    if (requestUrl.pathname.indexOf('version.json') !== -1) {
        console.log('[SW] Fetching version.json from network');
        return;
    }
    
    // Обрабатываем только запросы в рамках scope
    if (requestUrl.origin === self.location.origin && requestUrl.pathname.indexOf(SCOPE_PATH) !== 0) {
        return;
    }
        event.respondWith(
        caches.match(event.request)
            .then(function(cached) {
                if (cached) {
                    console.log('[SW] Cache hit:', event.request.url);
                    return cached;
                }
                console.log('[SW] Cache miss, fetching:', event.request.url);
                return fetch(event.request).then(function(response) {
                    if (!response || response.status !== 200 || event.request.method !== 'GET') {
                        return response;
                    }
                    var responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
            .catch(function(error) {
                console.error('[SW] Fetch error:', error);
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});