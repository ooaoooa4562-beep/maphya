import { initLobbyPage } from './pages/LobbyPage.js';
import { initGamePage } from './pages/GamePage.js';
import { showScreen } from './core/router.js';

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем страницы
    initLobbyPage();
    initGamePage();
    
    // Показываем лобби по умолчанию
    showScreen('screen-lobby');
    
    console.log('Mafia App Initialized');
});
