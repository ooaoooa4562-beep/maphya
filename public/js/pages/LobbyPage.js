import { socket } from '../core/socket.js';
import { state } from '../core/state.js';
import { showToast } from '../utils/toast.js';
import { $ } from '../utils/dom.js';
import { formatRoomCode, formatPlayerName } from '../utils/formatters.js';

export function initLobbyPage() {
    $('#btn-create-room').addEventListener('click', handleCreateRoom);
    $('#btn-join-room').addEventListener('click', handleJoinRoom);
    
    socket.on('roomUpdate', handleRoomUpdate);
}

function handleCreateRoom() {
    const name = formatPlayerName($('#playerName').value);
    if (!name) return showToast('Введите имя', 'error');
    
    state.myName = name;
    socket.emit('createRoom', { playerName: name }, (res) => {
        if (res.success) {
            state.roomId = res.roomId;
            state.isHost = true;
            switchToWaitingRoom(res.roomId);
        }
    });
}

function handleJoinRoom() {
    const name = formatPlayerName($('#playerName').value);
    const roomId = formatRoomCode($('#roomCode').value);
    
    if (!name || !roomId) return showToast('Введите имя и код', 'error');

    state.myName = name;
    socket.emit('joinRoom', { roomId, playerName: name }, (res) => {
        if (res.success) {
            state.roomId = res.roomId;
            state.isHost = false;
            switchToWaitingRoom(res.roomId);
        } else {
            showToast(res.message, 'error');
        }
    });
}

function switchToWaitingRoom(roomId) {
    $('#lobby-actions').classList.add('hidden');
    $('#waiting-room').classList.remove('hidden');
    $('#display-room-code').innerText = roomId;
    
    if (state.isHost) {
        $('#btn-start-game').classList.remove('hidden');
        $('#host-hint').classList.remove('hidden');
    }
}

function handleRoomUpdate(room) {
    const list = $('#players-list');
    if (!list) return;
    
    list.innerHTML = '';
    room.players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = p.name + (p.id === socket.id ? ' (Вы)' : '');
        list.appendChild(li);
    });

    // Активация кнопки старта
    const startBtn = $('#btn-start-game');
    if (startBtn && !startBtn.classList.contains('hidden')) {
        startBtn.disabled = room.players.length < 4;
    }
}
