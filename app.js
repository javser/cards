/**
 * @fileoverview Игра "Карточки" - классическая игра на память
 * @version 2.1.0 (PWA + Update System)
 */

(function() {
    'use strict';

    const CONFIG = {
        GRID_SIZE: 4,
        TOTAL_PAIRS: 8,
        FLIP_DELAY: 1000,
        WIN_DELAY: 500,
        VERSION_URL: './version.json',
        STORAGE_KEYS: {
            APP_VERSION: 'cards_app_version',
            DECLINED_VERSION: 'cards_declined_version',
            PENDING_UPDATE: 'cards_pending_update'
        },
        SELECTORS: {
            MENU_SCREEN: '#menu-screen',
            GAME_SCREEN: '#game-screen',
            GAME_GRID: '#game-grid',
            WIN_MODAL: '#win-modal',
            UPDATE_MODAL: '#update-modal',
            APP_VERSION: '#app-version',
            UPDATE_BUTTON: '.btn--update',
            UPDATE_CHANGELOG: '#update-changelog'
        },
        CLASSES: {
            SCREEN_ACTIVE: 'screen--active',
            CARD_FLIPPED: 'card--flipped',
            CARD_MATCHED: 'card--matched',
            MODAL_VISIBLE: 'modal--visible',
            VISIBLE: 'visible'
        }
    };

    const gameState = {
        flippedCards: [],
        matchedPairs: 0,
        isLocked: false,
        currentVersion: '2.1.0',
        availableVersion: null,
        changelog: ''
    };

    const elements = {};

    // ============================================    // VERSION MANAGEMENT
    // ============================================
    
    function getCurrentVersion() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.APP_VERSION) || gameState.currentVersion;
    }

    function getDeclinedVersion() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.DECLINED_VERSION) || null;
    }

    function setDeclinedVersion(version) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.DECLINED_VERSION, version);
    }

    function hasPendingUpdate() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.PENDING_UPDATE) === 'true';
    }

    function setPendingUpdate(pending) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PENDING_UPDATE, pending ? 'true' : 'false');
    }

    function compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    async function checkForUpdates() {
        try {
            // Запрос с bypass кэша
            const timestamp = Date.now();
            const response = await fetch(`${CONFIG.VERSION_URL}?t=${timestamp}`, {
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            const availableVersion = data.version;            const currentVersion = getCurrentVersion();
            const declinedVersion = getDeclinedVersion();
            
            console.log('[VERSION] Current:', currentVersion, 'Available:', availableVersion, 'Declined:', declinedVersion);
            
            // Сохраняем доступную версию
            gameState.availableVersion = availableVersion;
            gameState.changelog = data.changelog || '';
            
            // Проверяем нужно ли показывать обновление
            const isNewer = compareVersions(availableVersion, currentVersion) > 0;
            const isNotDeclined = !declinedVersion || compareVersions(availableVersion, declinedVersion) > 0;
            
            if (isNewer && isNotDeclined) {
                // Есть новая версия которую ещё не предлагали
                setPendingUpdate(true);
                showUpdateModal(data);
            } else if (hasPendingUpdate()) {
                // Пользователь ранее отказался, показываем кнопку
                showUpdateButton();
            }
            
            // Обновляем UI версии
            updateVersionUI(currentVersion);
            
        } catch (error) {
            console.log('[VERSION] Offline mode or error:', error.message);
            // Работаем в оффлайн режиме
            const currentVersion = getCurrentVersion();
            updateVersionUI(currentVersion);
            
            if (hasPendingUpdate()) {
                showUpdateButton();
            }
        }
    }

    function updateVersionUI(version) {
        const versionElement = document.querySelector(CONFIG.SELECTORS.APP_VERSION);
        if (versionElement) {
            versionElement.textContent = `v${version}`;
        }
    }

    function showUpdateButton() {
        const updateButton = document.querySelector(CONFIG.SELECTORS.UPDATE_BUTTON);
        if (updateButton) {
            updateButton.classList.add(CONFIG.CLASSES.VISIBLE);
        }
    }
    function hideUpdateButton() {
        const updateButton = document.querySelector(CONFIG.SELECTORS.UPDATE_BUTTON);
        if (updateButton) {
            updateButton.classList.remove(CONFIG.CLASSES.VISIBLE);
        }
    }

    function showUpdateModal(data) {
        const modal = document.querySelector(CONFIG.SELECTORS.UPDATE_MODAL);
        const changelogEl = document.querySelector(CONFIG.SELECTORS.UPDATE_CHANGELOG);
        
        if (changelogEl && data.changelog) {
            changelogEl.textContent = data.changelog;
        }
        
        if (modal) {
            modal.classList.add(CONFIG.CLASSES.MODAL_VISIBLE);
        }
    }

    function hideUpdateModal() {
        const modal = document.querySelector(CONFIG.SELECTORS.UPDATE_MODAL);
        if (modal) {
            modal.classList.remove(CONFIG.CLASSES.MODAL_VISIBLE);
        }
    }

    function performUpdate() {
        // Сообщаем Service Worker о необходимости обновления
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Очищаем pending update
        setPendingUpdate(false);
        hideUpdateButton();
        hideUpdateModal();
        
        // Перезагружаем страницу
        window.location.reload();
    }

    function declineUpdate() {
        if (gameState.availableVersion) {
            // Запоминаем от какой версии отказались
            setDeclinedVersion(gameState.availableVersion);
        }
        
        // Скрываем модальное окно но оставляем pending для кнопки        hideUpdateModal();
        
        // Показываем кнопку обновления на главном экране
        showUpdateButton();
    }

    // ============================================
    // SERVICE WORKER REGISTRATION
    // ============================================
    
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js', { scope: './' })
                    .then(registration => {
                        console.log('[PWA] SW registered:', registration.scope);
                        
                        // Слушаем обновления SW
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (!newWorker) return;

                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // Новая версия SW готова
                                    console.log('[PWA] New SW version available');
                                }
                            });
                        });
                    })
                    .catch(error => {
                        console.error('[PWA] SW registration failed:', error);
                    });
            });
        }
    }

    // ============================================
    // GAME LOGIC
    // ============================================
    
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    function createCardValues(pairs) {
        const values = Array.from({ length: pairs }, (_, i) => i + 1);
        return [...values, ...values];
    }

    function createBoard() {
        const deck = shuffleArray(createCardValues(CONFIG.TOTAL_PAIRS));
        elements.gameGrid.innerHTML = '';
        
        deck.forEach((value, index) => {
            const card = createCardElement(value, index);
            elements.gameGrid.appendChild(card);
        });
    }

    function createCardElement(value, index) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.value = value;
        card.dataset.index = index;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Карта ${index + 1}`);
        
        card.innerHTML = `
            <div class="card__inner">
                <div class="card__face card__face--back"></div>
                <div class="card__face card__face--front">${value}</div>
            </div>
        `;
        
        card.addEventListener('click', handleCardClick);
        card.addEventListener('keydown', handleCardKeydown);
        
        return card;
    }

    function handleCardClick(event) {
        const card = event.currentTarget;
        flipCard(card);
    }

    function handleCardKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            flipCard(event.currentTarget);
        }
    }

    function flipCard(card) {        if (gameState.isLocked) return;
        if (card.classList.contains(CONFIG.CLASSES.CARD_FLIPPED)) return;

        card.classList.add(CONFIG.CLASSES.CARD_FLIPPED);
        gameState.flippedCards.push(card);

        if (gameState.flippedCards.length === 2) {
            checkForMatch();
        }
    }

    function checkForMatch() {
        gameState.isLocked = true;
        const [card1, card2] = gameState.flippedCards;
        const isMatch = card1.dataset.value === card2.dataset.value;

        if (isMatch) {
            handleMatch(card1, card2);
        } else {
            handleMismatch(card1, card2);
        }
    }

    function handleMatch(card1, card2) {
        card1.classList.add(CONFIG.CLASSES.CARD_MATCHED);
        card2.classList.add(CONFIG.CLASSES.CARD_MATCHED);
        gameState.matchedPairs++;
        gameState.flippedCards = [];
        gameState.isLocked = false;

        if (gameState.matchedPairs === CONFIG.TOTAL_PAIRS) {
            setTimeout(showWinModal, CONFIG.WIN_DELAY);
        }
    }

    function handleMismatch(card1, card2) {
        setTimeout(() => {
            card1.classList.remove(CONFIG.CLASSES.CARD_FLIPPED);
            card2.classList.remove(CONFIG.CLASSES.CARD_FLIPPED);
            gameState.flippedCards = [];
            gameState.isLocked = false;
        }, CONFIG.FLIP_DELAY);
    }

    // ============================================
    // UI FUNCTIONS
    // ============================================
    
    function showWinModal() {
        elements.winModal.classList.add(CONFIG.CLASSES.MODAL_VISIBLE);    }

    function hideWinModal() {
        elements.winModal.classList.remove(CONFIG.CLASSES.MODAL_VISIBLE);
        showScreen('menu');
        resetGame();
    }

    function showScreen(screenName) {
        elements.menuScreen.classList.toggle(CONFIG.CLASSES.SCREEN_ACTIVE, screenName === 'menu');
        elements.gameScreen.classList.toggle(CONFIG.CLASSES.SCREEN_ACTIVE, screenName === 'game');
    }

    function resetGame() {
        gameState.flippedCards = [];
        gameState.matchedPairs = 0;
        gameState.isLocked = false;
    }

    function startGame() {
        resetGame();
        createBoard();
        showScreen('game');
    }

    function exitApp() {
        if (confirm('Вы действительно хотите выйти?')) {
            window.close();
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;color:white;text-align:center;padding:20px">
                    <div><h1>Приложение можно закрыть</h1><p>Нажмите кнопку "Назад" на устройстве</p></div>
                </div>`;
        }
    }

    function handleMenuClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        
        switch (button.dataset.action) {
            case 'start':
                startGame();
                break;
            case 'exit':
                exitApp();
                break;
            case 'update':
                performUpdate();
                break;
            case 'confirm-update':                performUpdate();
                break;
            case 'decline-update':
                declineUpdate();
                break;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        elements.menuScreen = document.querySelector(CONFIG.SELECTORS.MENU_SCREEN);
        elements.gameScreen = document.querySelector(CONFIG.SELECTORS.GAME_SCREEN);
        elements.gameGrid = document.querySelector(CONFIG.SELECTORS.GAME_GRID);
        elements.winModal = document.querySelector(CONFIG.SELECTORS.WIN_MODAL);

        if (!elements.menuScreen || !elements.gameScreen || !elements.gameGrid || !elements.winModal) {
            console.error('[APP] Required DOM elements not found');
            return;
        }

        elements.menuScreen.addEventListener('click', handleMenuClick);
        elements.winModal.addEventListener('click', hideWinModal);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && elements.winModal.classList.contains(CONFIG.CLASSES.MODAL_VISIBLE)) {
                hideWinModal();
            }
        });

        // Регистрация Service Worker
        registerServiceWorker();
        
        // Проверка обновлений
        checkForUpdates();
        
        console.log('[APP] Cards game initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();