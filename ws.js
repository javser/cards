/**
 * @fileoverview Service Worker для оффлайн работы
 * @note Версия кэша устанавливается из app.js автоматически
 */

let CACHE_VERSION = 'v2.1.0'; // Значение по умолчанию (будет перезаписано)
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
// MESSAGE HANDLER (получение версии из app.js)
// ============================================
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SET_VERSION') {
        CACHE_VERSION = event.data.version;
        CACHE_NAME = 'cards-cache-' + CACHE_VERSION;
        console.log('[SW] Version set from app.js:', CACHE_VERSION);
    }
    
    if (event.data?.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting');
        self.skipWaiting();
    }
});

// ============================================
// INSTALL
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Install', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] Install error:', err))
    );
});

// ============================================
// ACTIVATE
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate', CACHE_NAME);
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// ============================================
// FETCH
// ============================================
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // version.json всегда из сети
    if (requestUrl.pathname.includes('version.json')) {
        return;
    }
    
    // Обрабатываем только запросы в рамках scope
    if (!requestUrl.pathname.startsWith(SCOPE_PATH) && requestUrl.origin === self.location.origin) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (event.request.method === 'GET' && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});