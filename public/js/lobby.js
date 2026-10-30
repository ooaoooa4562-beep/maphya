document.getElementById('btn-create-room').addEventListener('click', () => {
    const name = document.getElementById('playerName').value;
    if (!name) return alert('Введите имя');
    
    socket.emit('createRoom', { playerName: name }, (res) => {
        if (res.success) {
            document.getElementById('lobby-actions').classList.add('hidden');
            document.getElementById('waiting-room').classList.remove('hidden');
            document.getElementById('display-room-code').innerText = res.roomId;
            document.getElementById('btn-start-game').classList.remove('hidden'); // Ты хост
        }
    });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
    const name = document.getElementById('playerName').value;
    const roomId = document.getElementById('roomCode').value.toUpperCase();
    if (!name || !roomId) return alert('Введите имя и код');

    socket.emit('joinRoom', { roomId, playerName: name }, (res) => {
        if (res.success) {
            document.getElementById('lobby-actions').classList.add('hidden');
            document.getElementById('waiting-room').classList.remove('hidden');
            document.getElementById('display-room-code').innerText = res.roomId;
        } else {
            alert(res.message);
        }
    });
});

// Обновление списка игроков
socket.on('roomUpdate', (room) => {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    room.players.forEach(p => {
        const li = document.createElement('li');
        li.innerText = p.name + (p.alive ? '' : ' (Мертв)');
        list.appendChild(li);
    });
});
