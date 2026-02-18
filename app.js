/**
 * @fileoverview Игра "Карточки" - классическая игра на память
 * @version 2.1.0 (PWA + GitHub Pages subdirectory)
 */

(function() {
    'use strict';

    const CONFIG = {
        GRID_SIZE: 4,
        TOTAL_PAIRS: 8,
        FLIP_DELAY: 1000,
        WIN_DELAY: 500,
        CACHE_VERSION: 'v2.1.0',
        SELECTORS: {
            MENU_SCREEN: '#menu-screen',
            GAME_SCREEN: '#game-screen',
            GAME_GRID: '#game-grid',
            WIN_MODAL: '#win-modal'
        },
        CLASSES: {
            SCREEN_ACTIVE: 'screen--active',
            CARD_FLIPPED: 'card--flipped',
            CARD_MATCHED: 'card--matched',
            MODAL_VISIBLE: 'modal--visible'
        }
    };

    const gameState = {
        flippedCards: [],
        matchedPairs: 0,
        isLocked: false
    };

    const elements = {
        menuScreen: null,
        gameScreen: null,
        gameGrid: null,
        winModal: null
    };

    // ============================================
    // SERVICE WORKER REGISTRATION
    // ============================================
    
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Явно указываем scope для работы в поддиректории
                navigator.serviceWorker.register('./sw.js', { scope: './' })                    .then(registration => {
                        console.log('[PWA] SW registered:', registration.scope);
                        checkForUpdates(registration);
                    })
                    .catch(error => {
                        console.error('[PWA] SW registration failed:', error);
                    });
            });
        }
    }

    function checkForUpdates(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    if (confirm('Доступна новая версия игры! Обновить сейчас?')) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        window.location.reload();
                    }
                }
            });
        });
    }

    // ============================================
    // UTILITY FUNCTIONS
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

    // ============================================
    // GAME LOGIC
    // ============================================
    
    function createBoard() {        const deck = shuffleArray(createCardValues(CONFIG.TOTAL_PAIRS));
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

    function flipCard(card) {
        if (gameState.isLocked) return;
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
        elements.winModal.classList.add(CONFIG.CLASSES.MODAL_VISIBLE);
    }

    function hideWinModal() {
        elements.winModal.classList.remove(CONFIG.CLASSES.MODAL_VISIBLE);
        showScreen('menu');
        resetGame();    }

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
            case 'start': startGame(); break;
            case 'exit': exitApp(); break;
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

        if (!elements.menuScreen || !elements.gameScreen || !elements.gameGrid || !elements.winModal) {            console.error('[APP] Required DOM elements not found');
            return;
        }

        elements.menuScreen.addEventListener('click', handleMenuClick);
        elements.winModal.addEventListener('click', hideWinModal);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && elements.winModal.classList.contains(CONFIG.CLASSES.MODAL_VISIBLE)) {
                hideWinModal();
            }
        });

        registerServiceWorker();
        console.log('[APP] Cards game initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();