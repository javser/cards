(function() {
    'use strict';

    const APP_VERSION = '2.1.0';
    const STORAGE = { VERSION: 'cards_version', DECLINED: 'cards_declined', PENDING: 'cards_pending' };

    let swRegistration = null;
    let availableVersion = null;
    let isPWA = false;

    // --- Проверка PWA ---
    function checkPWA() {
        isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                window.navigator.standalone === true ||
                (navigator.serviceWorker && navigator.serviceWorker.controller !== null);
    }

    // --- Версия ---
    function getStoredVersion() {
        return localStorage.getItem(STORAGE.VERSION) || APP_VERSION;
    }

    function compareVersions(v1, v2) {
        return v1.localeCompare(v2, undefined, { numeric: true });
    }

    function showVersion(version) {
        const el = document.getElementById('app-version');
        if (el) el.textContent = 'v' + version;
    }

    function showUpdateButton() {
        const btn = document.querySelector('.btn--update');
        if (btn) btn.classList.add('visible');
    }

    function hideUpdateButton() {
        const btn = document.querySelector('.btn--update');
        if (btn) btn.classList.remove('visible');
    }

    function showUpdateModal(changelog) {
        const el = document.getElementById('update-changelog');
        if (el && changelog) el.textContent = changelog;
        document.getElementById('update-modal').classList.add('modal--visible');
    }

    function hideUpdateModal() {
        document.getElementById('update-modal').classList.remove('modal--visible');
    }
    // --- Проверка обновлений ---
    async function checkForUpdates() {
        // Всегда показываем версию (и сайт, и PWA)
        const current = getStoredVersion();
        showVersion(current);

        // Обновления только для PWA
        if (!isPWA) {
            return;
        }

        const isOnline = navigator.onLine;

        if (isOnline) {
            try {
                const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-cache' });
                if (!res.ok) throw new Error('Network');
                
                const data = await res.json();
                availableVersion = data.version;
                const declined = localStorage.getItem(STORAGE.DECLINED);

                if (compareVersions(availableVersion, current) > 0 && 
                    (!declined || compareVersions(availableVersion, declined) > 0)) {
                    localStorage.setItem(STORAGE.PENDING, 'true');
                    showUpdateModal(data.changelog);
                } else if (localStorage.getItem(STORAGE.PENDING) === 'true') {
                    showUpdateButton();
                }
            } catch (e) {
                if (localStorage.getItem(STORAGE.PENDING) === 'true') {
                    showUpdateButton();
                }
            }
        } else {
            if (localStorage.getItem(STORAGE.PENDING) === 'true') {
                showUpdateButton();
            }
        }
    }

    // --- Обновление ---
    function performUpdate() {
        if (availableVersion) {
            localStorage.setItem(STORAGE.VERSION, availableVersion);
        }
        localStorage.setItem(STORAGE.PENDING, 'false');
        hideUpdateButton();
        hideUpdateModal();        
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        
        setTimeout(() => location.reload(), 500);
    }

    function declineUpdate() {
        if (availableVersion) {
            localStorage.setItem(STORAGE.DECLINED, availableVersion);
        }
        hideUpdateModal();
        showUpdateButton();
    }

    // --- Service Worker ---
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .then(reg => {
                    swRegistration = reg;
                    if (reg.active) {
                        reg.active.postMessage({ type: 'SET_VERSION', version: APP_VERSION });
                    }
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed') {
                                    newWorker.postMessage({ type: 'SET_VERSION', version: APP_VERSION });
                                }
                            });
                        }
                    });
                });
        }
    }

    // --- Игра ---
    const state = { cards: [], matched: 0, locked: false };
    
    function createBoard() {
        const grid = document.getElementById('game-grid');
        grid.innerHTML = '';
        const values = [...Array(8)].map((_, i) => i + 1);
        const deck = [...values, ...values].sort(() => Math.random() - 0.5);
                deck.forEach((val, idx) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.value = val;
            card.innerHTML = '<div class="card__inner"><div class="card__face card__face--back"></div>' +
                           '<div class="card__face card__face--front">' + val + '</div></div>';
            card.onclick = () => flipCard(card);
            grid.appendChild(card);
        });
    }

    function flipCard(card) {
        if (state.locked || card.classList.contains('card--flipped')) return;
        card.classList.add('card--flipped');
        state.cards.push(card);
        
        if (state.cards.length === 2) {
            state.locked = true;
            const [c1, c2] = state.cards;
            if (c1.dataset.value === c2.dataset.value) {
                c1.classList.add('card--matched');
                c2.classList.add('card--matched');
                state.matched++;
                state.cards = [];
                state.locked = false;
                if (state.matched === 8) {
                    setTimeout(() => document.getElementById('win-modal').classList.add('modal--visible'), 500);
                }
            } else {
                setTimeout(() => {
                    c1.classList.remove('card--flipped');
                    c2.classList.remove('card--flipped');
                    state.cards = [];
                    state.locked = false;
                }, 1000);
            }
        }
    }

    // --- Инициализация ---
    function init() {
        checkPWA();
        registerSW();
        checkForUpdates();

        document.getElementById('menu-screen').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            switch (btn.dataset.action) {                case 'start':
                    state.matched = 0;
                    state.cards = [];
                    state.locked = false;
                    createBoard();
                    document.getElementById('menu-screen').classList.remove('screen--active');
                    document.getElementById('game-screen').classList.add('screen--active');
                    break;
                case 'exit':
                    if (confirm('Выйти?')) {
                        window.close();
                        document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:white;"><h1>Можно закрыть</h1></div>';
                    }
                    break;
            }
        });

        document.getElementById('update-modal').addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            if (btn.dataset.action === 'confirm-update') {
                performUpdate();
            } else if (btn.dataset.action === 'decline-update') {
                declineUpdate();
            }
        });

        document.querySelector('.btn--update').addEventListener('click', e => {
            e.stopPropagation();
            performUpdate();
        });

        document.getElementById('win-modal').addEventListener('click', e => {
            if (e.target.id === 'win-modal') {
                document.getElementById('win-modal').classList.remove('modal--visible');
                document.getElementById('game-screen').classList.remove('screen--active');
                document.getElementById('menu-screen').classList.add('screen--active');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();