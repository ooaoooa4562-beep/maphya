const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Чтобы фронтенд мог подключаться
});

// Хранилище активных комнат
const rooms = {};

// Список ролей (можно расширять)
const ROLES = ['Мафия', 'Дон', 'Комиссар', 'Доктор', 'Мирный житель'];

io.on('connection', (socket) => {
    console.log('Подключился игрок:', socket.id);

    // 1. Создание комнаты
    socket.on('createRoom', ({ playerName }, callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase(); // Генерим код из 4 букв
        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            status: 'lobby', // lobby, night, day, voting, ended
            players: [{ id: socket.id, name: playerName, role: null, alive: true }],
            nightActions: {},
            votes: {}
        };
        socket.join(roomId);
        callback({ success: true, roomId, isHost: true });
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
    });

    // 2. Подключение к комнате
    socket.on('joinRoom', ({ roomId, playerName }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ success: false, message: 'Комната не найдена' });
        if (room.status !== 'lobby') return callback({ success: false, message: 'Игра уже началась' });
        if (room.players.length >= 10) return callback({ success: false, message: 'Комната переполнена' });

        room.players.push({ id: socket.id, name: playerName, role: null, alive: true });
        socket.join(roomId);
        callback({ success: true, roomId, isHost: false });
        io.to(roomId).emit('roomUpdate', room);
    });

    // 3. Старт игры (только для хоста)
    socket.on('startGame', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || room.hostId !== socket.id) return;

        // Раздаем роли (упрощенно, зависит от кол-ва игроков)
        let availableRoles = [...ROLES];
        // Перемешиваем роли
        availableRoles.sort(() => Math.random() - 0.5); 

        room.players.forEach((player, index) => {
            // Если игроков больше, чем ролей, остальные становятся мирными
            player.role = availableRoles[index] || 'Мирный житель';
            player.alive = true;
        });

        room.status = 'night';
        room.nightActions = {};
        room.votes = {};
        
        io.to(roomId).emit('gameStarted');
        // Каждому игроку отправляем ТОЛЬКО его роль
        room.players.forEach(p => {
            io.to(p.id).emit('yourRole', p.role);
        });
        io.to(roomId).emit('roomUpdate', room);
    });

    // 4. Ночные действия (Мафия, Комиссар, Доктор)
    socket.on('nightAction', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'night') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.alive) return;

        // Записываем действие (кто кого выбрал)
        room.nightActions[socket.id] = { role: player.role, target: targetId };

        // Если все живые сделали свой ход, можно переходить к дню
        // (В реальной игре нужен таймер, но для старта сойдет)
        const alivePlayers = room.players.filter(p => p.alive);
        const actionsCount = Object.keys(room.nightActions).length;
        
        // Если мафия и комиссар сделали ход (примерно)
        if (actionsCount >= Math.min(2, alivePlayers.length)) {
            processNight(roomId);
        }
    });

    // 5. Голосование днем
    socket.on('vote', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'day') return;

        room.votes[socket.id] = targetId;

        const alivePlayers = room.players.filter(p => p.alive);
        const votesCount = Object.keys(room.votes).length;

        if (votesCount >= alivePlayers.length) {
            processVoting(roomId);
        }
    });

    // Отключение
    socket.on('disconnect', () => {
        // Логика удаления из комнаты, если игрок отвалился
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomId];
                } else {
                    if (room.hostId === socket.id) room.hostId = room.players[0].id;
                    io.to(roomId).emit('roomUpdate', room);
                }
            }
        }
    });
});

// Функция обработки ночи
function processNight(roomId) {
    const room = rooms[roomId];
    let killedId = null;

    // Ищем выбор мафии
    const mafiaAction = Object.values(room.nightActions).find(a => a.role === 'Мафия' || a.role === 'Дон');
    const doctorAction = Object.values(room.nightActions).find(a => a.role === 'Доктор');

    if (mafiaAction) {
        let target = mafiaAction.target;
        // Если доктор лечит этого же человека, мафия промахнулась
        if (doctorAction && doctorAction.target === target) {
            killedId = null; // Никто не умер
        } else {
            killedId = target;
        }
    }

    // Убиваем
    if (killedId) {
        const victim = room.players.find(p => p.id === killedId);
        if (victim) victim.alive = false;
    }

    room.status = 'day';
    room.nightActions = {}; // Очищаем ночные действия
    room.votes = {};

    io.to(roomId).emit('nightEnded', { killedId });
    io.to(roomId).emit('roomUpdate', room);
    checkWinCondition(roomId);
}

// Функция обработки голосования
function processVoting(roomId) {
    const room = rooms[roomId];
    const voteCounts = {};

    // Считаем голоса
    for (const voterId in room.votes) {
        const targetId = room.votes[voterId];
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    // Ищем того, кого выгнали (большинство)
    let maxVotes = 0;
    let ejectedId = null;
    for (const targetId in voteCounts) {
        if (voteCounts[targetId] > maxVotes) {
            maxVotes = voteCounts[targetId];
            ejectedId = targetId;
        }
    }

    if (ejectedId) {
        const victim = room.players.find(p => p.id === ejectedId);
        if (victim) victim.alive = false;
    }

    room.status = 'night';
    room.votes = {};
    room.nightActions = {};

    io.to(roomId).emit('votingEnded', { ejectedId });
    io.to(roomId).emit('roomUpdate', room);
    checkWinCondition(roomId);
}

// Проверка на победу
function checkWinCondition(roomId) {
    const room = rooms[roomId];
    const alivePlayers = room.players.filter(p => p.alive);
    const mafiaAlive = alivePlayers.filter(p => p.role === 'Мафия' || p.role === 'Дон').length;
    const townAlive = alivePlayers.length - mafiaAlive;

    if (mafiaAlive === 0) {
        room.status = 'ended';
        io.to(roomId).emit('gameEnded', 'Победил город!');
    } else if (mafiaAlive >= townAlive) {
        room.status = 'ended';
        io.to(roomId).emit('gameEnded', 'Победила Мафия!');
    }
}

server.listen(3000, () => {
    console.log('Сервер Мафии запущен на порту 3000');
});
