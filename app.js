/**
 * @fileoverview Игра "Карточки" - классическая игра на память
 * @version 2.0.0 (PWA)
 */

(function() {
    'use strict';

    // ============================================
    // CONSTANTS
    // ============================================
    const CONFIG = {
        GRID_SIZE: 4,
        TOTAL_PAIRS: 8,
        FLIP_DELAY: 1000,
        WIN_DELAY: 500,
        CACHE_VERSION: 'v2.0.0',
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

    // ============================================
    // GAME STATE
    // ============================================
    const gameState = {
        flippedCards: [],
        matchedPairs: 0,
        isLocked: false
    };

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const elements = {
        menuScreen: null,
        gameScreen: null,
        gameGrid: null,
        winModal: null
    };
    // ============================================
    // SERVICE WORKER REGISTRATION
    // ============================================
    
    /**
     * Регистрирует Service Worker для оффлайн работы
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('SW зарегистрирован:', registration.scope);
                        checkForUpdates(registration);
                    })
                    .catch(error => {
                        console.error('Ошибка регистрации SW:', error);
                    });
            });
        }
    }

    /**
     * Проверяет наличие обновлений Service Worker
     * @param {ServiceWorkerRegistration} registration - Регистрация SW
     */
    function checkForUpdates(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Новая версия доступна
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
    
    /**
     * Перемешивает массив методом Фишера-Йетса
     * @param {Array} array - Массив для перемешивания     * @returns {Array} Перемешанный массив
     */
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Создает массив пар чисел
     * @param {number} pairs - Количество пар
     * @returns {Array} Массив чисел
     */
    function createCardValues(pairs) {
        const values = Array.from({ length: pairs }, (_, i) => i + 1);
        return [...values, ...values];
    }

    // ============================================
    // GAME LOGIC
    // ============================================
    
    /**
     * Инициализирует игровое поле
     */
    function createBoard() {
        const deck = shuffleArray(createCardValues(CONFIG.TOTAL_PAIRS));
        
        elements.gameGrid.innerHTML = '';
        
        deck.forEach((value, index) => {
            const card = createCardElement(value, index);
            elements.gameGrid.appendChild(card);
        });
    }

    /**
     * Создает HTML элемент карты
     * @param {number} value - Значение карты
     * @param {number} index - Индекс карты
     * @returns {HTMLElement} Элемент карты
     */
    function createCardElement(value, index) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.value = value;
        card.dataset.index = index;        card.setAttribute('role', 'button');
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

    /**
     * Обработчик клика по карте
     * @param {Event} event - Событие клика
     */
    function handleCardClick(event) {
        const card = event.currentTarget;
        flipCard(card);
    }

    /**
     * Обработчик клавиатуры для доступности
     * @param {KeyboardEvent} event - Событие клавиатуры
     */
    function handleCardKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const card = event.currentTarget;
            flipCard(card);
        }
    }

    /**
     * Переворачивает карту
     * @param {HTMLElement} card - Элемент карты
     */
    function flipCard(card) {
        if (gameState.isLocked) return;
        if (card.classList.contains(CONFIG.CLASSES.CARD_FLIPPED)) return;

        card.classList.add(CONFIG.CLASSES.CARD_FLIPPED);
        gameState.flippedCards.push(card);

        if (gameState.flippedCards.length === 2) {            checkForMatch();
        }
    }

    /**
     * Проверяет совпадение двух карт
     */
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

    /**
     * Обработка совпадения карт
     * @param {HTMLElement} card1 - Первая карта
     * @param {HTMLElement} card2 - Вторая карта
     */
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

    /**
     * Обработка несовпадения карт
     * @param {HTMLElement} card1 - Первая карта
     * @param {HTMLElement} card2 - Вторая карта
     */
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
    
    /**
     * Показывает модальное окно победы
     */
    function showWinModal() {
        elements.winModal.classList.add(CONFIG.CLASSES.MODAL_VISIBLE);
    }

    /**
     * Скрывает модальное окно и возвращает в меню
     */
    function hideWinModal() {
        elements.winModal.classList.remove(CONFIG.CLASSES.MODAL_VISIBLE);
        showScreen('menu');
        resetGame();
    }

    /**
     * Переключает экраны
     * @param {string} screenName - Название экрана ('menu' | 'game')
     */
    function showScreen(screenName) {
        elements.menuScreen.classList.toggle(
            CONFIG.CLASSES.SCREEN_ACTIVE, 
            screenName === 'menu'
        );
        elements.gameScreen.classList.toggle(
            CONFIG.CLASSES.SCREEN_ACTIVE, 
            screenName === 'game'
        );
    }

    /**
     * Сбрасывает состояние игры
     */
    function resetGame() {
        gameState.flippedCards = [];
        gameState.matchedPairs = 0;
        gameState.isLocked = false;
    }

    /**
     * Запускает игру
     */
    function startGame() {
        resetGame();
        createBoard();        showScreen('game');
    }

    /**
     * Обработчик выхода из приложения
     */
    function exitApp() {
        const confirmed = confirm('Вы действительно хотите выйти?');
        if (confirmed) {
            window.close();
            document.body.innerHTML = `
                <div style="
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    color: white;
                    text-align: center;
                    padding: 20px;
                ">
                    <div>
                        <h1>Приложение можно закрыть</h1>
                        <p>Нажмите кнопку "Назад" на устройстве</p>
                    </div>
                </div>
            `;
        }
    }

    // ============================================
    // EVENT DELEGATION
    // ============================================
    
    /**
     * Обрабатывает клики по меню
     * @param {Event} event - Событие клика
     */
    function handleMenuClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        
        switch (action) {
            case 'start':
                startGame();
                break;
            case 'exit':
                exitApp();
                break;        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Инициализирует приложение
     */
    function init() {
        // Кэшируем DOM элементы
        elements.menuScreen = document.querySelector(CONFIG.SELECTORS.MENU_SCREEN);
        elements.gameScreen = document.querySelector(CONFIG.SELECTORS.GAME_SCREEN);
        elements.gameGrid = document.querySelector(CONFIG.SELECTORS.GAME_GRID);
        elements.winModal = document.querySelector(CONFIG.SELECTORS.WIN_MODAL);

        // Валидация
        if (!elements.menuScreen || !elements.gameScreen || !elements.gameGrid || !elements.winModal) {
            console.error('Не все DOM элементы найдены');
            return;
        }

        // Обработчики событий
        elements.menuScreen.addEventListener('click', handleMenuClick);
        elements.winModal.addEventListener('click', hideWinModal);

        // Обработка клавиши Escape для закрытия модального окна
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && 
                elements.winModal.classList.contains(CONFIG.CLASSES.MODAL_VISIBLE)) {
                hideWinModal();
            }
        });

        // Регистрация Service Worker
        registerServiceWorker();

        console.log('Приложение "Карточки" инициализировано');
    }

    // Запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();