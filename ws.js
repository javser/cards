/**
 * @fileoverview Service Worker для оффлайн работы и кэширования
 * @version 2.0.0
 */

const CACHE_NAME = 'cards-cache-v2.0.0';
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
// INSTALL EVENT - Кэширование файлов
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Установка Service Worker');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Кэширование файлов');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] Файлы закэшированы');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Ошибка кэширования:', error);
            })
    );
});

// ============================================
// ACTIVATE EVENT - Очистка старого кэша
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Активация Service Worker');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Удаление старого кэша:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker активирован');
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH EVENT - Отдача из кэша
// ============================================
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем из кэша или загружаем из сети
                return response || fetch(event.request);
            })
            .catch((error) => {
                console.error('[SW] Ошибка fetch:', error);
                // Фолбэк для навигации
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});

// ============================================
// SKIP_WAITING MESSAGE - Принудительное обновление
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Получено сообщение SKIP_WAITING');
        self.skipWaiting();
    }
});