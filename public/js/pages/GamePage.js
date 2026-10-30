import { socket } from '../core/socket.js';
import { state } from '../core/state.js';
import { createPlayerCard } from '../components/PlayerCard.js';
import { updatePhaseBadge } from '../components/PhaseBadge.js';
import { updateRoleBadge } from '../components/RoleBadge.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { ROLES } from '../config/constants.js';

export function initGamePage() {
    // Слушатели событий сервера
    socket.on('gameStarted', () => {
        document.getElementById('screen-lobby').classList.remove('active');
        document.getElementById('screen-game').classList.add('active');
        showToast('Игра началась!');
    });

    socket.on('yourRole', (role) => {
        state.myRole = role;
        updateRoleBadge(role);
        showToast(`Ваша роль: ${role}`);
    });

    socket.on('roomUpdate', renderGameBoard);
    socket.on('phaseChanged', ({ phase, dayCount }) => {
        state.selectedTarget = null;
        updatePhaseBadge(phase, dayCount);
        updateActionPanel();
    });

    socket.on('nightEnded', ({ killedPlayerName }) => {
        if (killedPlayerName) showToast(`☠️ Ночью убит: ${killedPlayerName}`, 'error');
        else showToast('Этой ночью никто не погиб.', 'info');
    });

    socket.on('votingEnded', ({ ejectedPlayerName, isTie }) => {
        if (isTie) showToast('Голоса разделились. Никто не изгнан.');
        else if (ejectedPlayerName) showToast(`⚖️ Изгнан: ${ejectedPlayerName}`, 'warn');
    });

    socket.on('commissarResult', ({ targetName, isMafia }) => {
        showToast(`Проверка: ${targetName} — ${isMafia ? 'МАФИЯ!' : 'Мирный'}`, isMafia ? 'error' : 'success');
    });

    socket.on('gameEnded', ({ message }) => {
        showToast(`🏆 ${message}`, 'success');
        setTimeout(() => {
            alert(message);
            location.reload();
        }, 1500);
    });

    // Клик по кнопкам действий
    document.getElementById('action-buttons').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const action = e.target.dataset.action;
            if (action === 'night') sendNightAction();
            if (action === 'vote') sendVote();
        }
    });
}

function renderGameBoard(room) {
    if (room.status === 'lobby') return;
    state.currentRoom = room;

    const grid = document.getElementById('players-grid');
    grid.innerHTML = '';

    room.players.forEach(player => {
        const isMe = player.id === socket.id;
        const isSelected = state.selectedTarget === player.id;
        
        const card = createPlayerCard(player, isMe, isSelected, (target) => {
            state.selectedTarget = target.id;
            renderGameBoard(room); // Перерисовка для подсветки
            updateActionPanel();
        });
        
        grid.appendChild(card);
    });

    updatePhaseBadge(room.status, room.dayCount);
    updateActionPanel();
}

function updateActionPanel() {
    const hint = document.getElementById('action-hint');
    const btnContainer = document.getElementById('action-buttons');
    btnContainer.innerHTML = '';

    const room = state.currentRoom;
    if (!room) return;

    // ФАЗА НОЧИ
    if (room.status === 'night') {
        if (state.myRole === ROLES.MAFIA || state.myRole === ROLES.DON) {
            hint.innerText = 'Выберите, кого убить:';
            createActionButton('Убить', 'primary', 'night');
        } else if (state.myRole === ROLES.COMMISSAR) {
            hint.innerText = 'Выберите, кого проверить:';
            createActionButton('Проверить', 'secondary', 'night');
        } else if (state.myRole === ROLES.DOCTOR) {
            hint.innerText = 'Выберите, кого вылечить:';
            createActionButton('Вылечить', 'success', 'night');
        } else {
            hint.innerText = 'Вы спите. Ожидайте утра...';
        }
    }

    // ФАЗА ДНЯ (Голосование)
    if (room.status === 'day') {
        hint.innerText = 'Выберите, кого изгнать:';
        createActionButton('Голосовать', 'primary', 'vote');
    }
}

function createActionButton(text, type, action) {
    const btn = document.createElement('button');
    btn.className = `btn ${type}`;
    btn.innerText = text;
    btn.dataset.action = action;
    document.getElementById('action-buttons').appendChild(btn);
}

function sendNightAction() {
    if (!state.selectedTarget) return showToast('Выберите игрока', 'warn');
    socket.emit('nightAction', { roomId: state.roomId, targetId: state.selectedTarget });
    showToast('Действие выполнено');
    document.getElementById('action-hint').innerText = 'Ожидание других игроков...';
    document.getElementById('action-buttons').innerHTML = '';
}

function sendVote() {
    if (!state.selectedTarget) return showToast('Выберите игрока', 'warn');
    socket.emit('vote', { roomId: state.roomId, targetId: state.selectedTarget });
    showToast('Ваш голос учтен');
    document.getElementById('action-hint').innerText = 'Ожидание других голосов...';
    document.getElementById('action-buttons').innerHTML = '';
}
