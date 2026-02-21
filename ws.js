let CACHE_VERSION = 'v2.1.3';
let CACHE_NAME = 'cards-cache-' + CACHE_VERSION;

const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', 
                './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('message', e => {
    if (e.data?.type === 'SET_VERSION') {
        CACHE_VERSION = e.data.version;
        CACHE_NAME = 'cards-cache-' + CACHE_VERSION;
    }
    if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(names => 
        Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.pathname.includes('version.json')) return;
    
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
            if (e.request.method === 'GET' && res.ok) {
                caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
            }
            return res;
        }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : null))
    );
});