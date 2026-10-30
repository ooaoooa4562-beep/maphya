const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище всех активных комнат
const rooms = {};

// Доступные роли (можно расширять)
// Для баланса: на 10 игроков - 3 мафии, 1 дон, 1 комиссар, 1 доктор, 4 мирных
const ROLE_POOL = ['Мафия', 'Мафия', 'Дон', 'Комиссар', 'Доктор', 'Мирный житель', 'Мирный житель', 'Мирный житель', 'Мирный житель', 'Мирный житель'];

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // 1. СОЗДАНИЕ КОМНАТЫ
    socket.on('createRoom', ({ playerName }, callback) => {
        // Генерируем уникальный 4-значный код
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        } while (rooms[roomId]);

        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            status: 'lobby', // lobby | night | day | voting | ended
            players: [{ 
                id: socket.id, 
                name: playerName, 
                role: null, 
                alive: true,
                votedFor: null,
                nightTarget: null
            }],
            nightActions: {}, // Кто что сделал ночью
            votes: {},        // Кто за кого голосует днем
            dayCount: 0       // Номер дня
        };

        socket.join(roomId);
        console.log(`[ROOM] Создана комната ${roomId} игроком ${playerName}`);
        
        callback({ success: true, roomId, isHost: true });
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
    });

    // 2. ПОДКЛЮЧЕНИЕ К КОМНАТЕ
    socket.on('joinRoom', ({ roomId, playerName }, callback) => {
        const room = rooms[roomId];
        
        if (!room) return callback({ success: false, message: 'Комната не найдена' });
        if (room.status !== 'lobby') return callback({ success: false, message: 'Игра уже началась' });
        if (room.players.length >= 10) return callback({ success: false, message: 'Комната переполнена (макс. 10)' });
        if (room.players.some(p => p.name === playerName)) return callback({ success: false, message: 'Это имя уже занято' });

        room.players.push({ 
            id: socket.id, 
            name: playerName, 
            role: null, 
            alive: true,
            votedFor: null,
            nightTarget: null
        });

        socket.join(roomId);
        console.log(`[ROOM] Игрок ${playerName} вошел в комнату ${roomId}`);
        
        callback({ success: true, roomId, isHost: false });
        io.to(roomId).emit('roomUpdate', room);
    });

    // 3. СТАРТ ИГРЫ (Только Хост)
    socket.on('startGame', ({ roomId }) => {
        const room = rooms[roomId];
        
        if (!room) return;
        if (room.hostId !== socket.id) return; // Только хост может начать
        if (room.players.length < 4) return; // Минимум 4 игрока

        // Перемешиваем роли и раздаем
        let currentRoles = [...ROLE_POOL];
        // Отрезаем нужное количество ролей под число игроков
        currentRoles = currentRoles.slice(0, room.players.length);
        // Перемешиваем
        currentRoles.sort(() => Math.random() - 0.5);

        room.players.forEach((player, index) => {
            player.role = currentRoles[index];
            player.alive = true;
            player.nightTarget = null;
            player.votedFor = null;
        });

        room.status = 'night';
        room.dayCount = 1;
        room.nightActions = {};
        room.votes = {};

        console.log(`[GAME] Игра в комнате ${roomId} началась. Роли розданы.`);
        
        io.to(roomId).emit('gameStarted');
        
        // Отправляем каждому игроку ТОЛЬКО его роль
        room.players.forEach(p => {
            io.to(p.id).emit('yourRole', p.role);
        });

        io.to(roomId).emit('roomUpdate', room);
    });

    // 4. НОЧНЫЕ ДЕЙСТВИЯ (Мафия, Комиссар, Доктор)
    socket.on('nightAction', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'night') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.alive) return;

        player.nightTarget = targetId;

        // Проверяем, все ли активные роли сделали ход
        // (Мафия, Дон, Комиссар, Доктор). Мирные жители ночью "спят".
        const activeRoles = ['Мафия', 'Дон', 'Комиссар', 'Доктор'];
        const aliveActivePlayers = room.players.filter(p => p.alive && activeRoles.includes(p.role));
        const madeActions = aliveActivePlayers.filter(p => p.nightTarget !== null);

        if (madeActions.length === aliveActivePlayers.length) {
            processNight(roomId);
        }
    });

    // 5. ДНЕВНОЕ ГОЛОСОВАНИЕ
    socket.on('vote', ({ roomId, targetId }) => {
        const room = rooms[roomId];
        if (!room || room.status !== 'day') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.alive) return;

        player.votedFor = targetId;
        room.votes[socket.id] = targetId;

        const alivePlayers = room.players.filter(p => p.alive);
        const votesCount = Object.keys(room.votes).length;

        // Если проголосовали все живые
        if (votesCount >= alivePlayers.length) {
            processVoting(roomId);
        } else {
            // Обновляем инфу о том, кто проголосовал
            io.to(roomId).emit('voteUpdate', { 
                votedCount: votesCount, 
                totalAlive: alivePlayers.length 
            });
        }
    });

    // 6. ОТКЛЮЧЕНИЕ ИГРОКА
    socket.on('disconnect', () => {
        console.log(`[-] Игрок отключился: ${socket.id}`);
        
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);

                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`[ROOM] Комната ${roomId} удалена (пуста)`);
                } else {
                    // Если вышел хост, назначаем нового
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                    }
                    console.log(`[ROOM] ${playerName} покинул комнату ${roomId}`);
                    io.to(roomId).emit('roomUpdate', room);
                    
                    // Если игра уже идет, проверяем, не закончилась ли она из-за выхода
                    if (room.status !== 'lobby' && room.status !== 'ended') {
                        checkWinCondition(roomId);
                        // Если вышла активная роль, возможно, нужно запустить ночь/день заново
                    }
                }
            }
        }
    });
});

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ СЕРВЕРА ---

// Обработка конца ночи
function processNight(roomId) {
    const room = rooms[roomId];
    
    // Ищем, кого убила мафия
    let mafiaTargetId = null;
    const mafiaPlayers = room.players.filter(p => p.alive && (p.role === 'Мафия' || p.role === 'Дон'));
    
    if (mafiaPlayers.length > 0) {
        // Берем цель первой мафии (в будущем можно сделать голосование мафии)
        mafiaTargetId = mafiaPlayers[0].nightTarget;
        // Если у мафии несколько человек, они должны выбрать одного. 
        // Пока берем выбор случайной мафии, которая сделала ход.
        const actingMafia = mafiaPlayers.find(p => p.nightTarget !== null);
        if (actingMafia) mafiaTargetId = actingMafia.nightTarget;
    }

    // Ищем, кого лечил доктор
    let doctorTargetId = null;
    const doctor = room.players.find(p => p.alive && p.role === 'Доктор');
    if (doctor && doctor.nightTarget) {
        doctorTargetId = doctor.nightTarget;
    }

    // Ищем, кого проверял комиссар
    const commissar = room.players.find(p => p.alive && p.role === 'Комиссар');
    if (commissar && commissar.nightTarget) {
        const checkedPlayer = room.players.find(p => p.id === commissar.nightTarget);
        if (checkedPlayer) {
            // Отправляем результат проверки комиссару
            io.to(commissar.id).emit('commissarResult', { 
                targetName: checkedPlayer.name, 
                isMafia: checkedPlayer.role === 'Мафия' || checkedPlayer.role === 'Дон' 
            });
        }
    }

    // Убийство
    let killedPlayerName = null;
    if (mafiaTargetId && mafiaTargetId !== doctorTargetId) {
        const victim = room.players.find(p => p.id === mafiaTargetId);
        if (victim && victim.alive) {
            victim.alive = false;
            killedPlayerName = victim.name;
        }
    }

    // Сбрасываем ночные цели
    room.players.forEach(p => p.nightTarget = null);
    room.nightActions = {};

    room.status = 'day';
    
    console.log(`[GAME] Ночь в комнате ${roomId} закончилась. Убит: ${killedPlayerName || 'никто'}`);

    // Отправляем результаты
    io.to(roomId).emit('nightEnded', { killedPlayerName });
    io.to(roomId).emit('roomUpdate', room);
    
    if (!checkWinCondition(roomId)) {
        // Если игра не кончилась, начинаем день
        io.to(roomId).emit('phaseChanged', { phase: 'day', dayCount: room.dayCount });
    }
}

// Обработка дневного голосования
function processVoting(roomId) {
    const room = rooms[roomId];
    const voteCounts = {};

    // Считаем голоса
    for (const voterId in room.votes) {
        const targetId = room.votes[voterId];
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    // Ищем того, кого выгнали
    let maxVotes = 0;
    let ejectedId = null;
    let isTie = false;

    for (const targetId in voteCounts) {
        if (voteCounts[targetId] > maxVotes) {
            maxVotes = voteCounts[targetId];
            ejectedId = targetId;
            isTie = false;
        } else if (voteCounts[targetId] === maxVotes) {
            isTie = true; // Ничья
        }
    }

    let ejectedPlayerName = null;
    if (ejectedId && !isTie) {
        const victim = room.players.find(p => p.id === ejectedId);
        if (victim && victim.alive) {
            victim.alive = false;
            ejectedPlayerName = victim.name;
        }
    }

    // Сбрасываем голоса
    room.votes = {};
    room.players.forEach(p => p.votedFor = null);
    
    room.dayCount++;
    room.status = 'night';

    console.log(`[GAME] Голосование в комнате ${roomId} окончено. Изгнан: ${ejectedPlayerName || 'никто (ничья)'}`);

    io.to(roomId).emit('votingEnded', { ejectedPlayerName, isTie });
    io.to(roomId).emit('roomUpdate', room);

    if (!checkWinCondition(roomId)) {
        // Если игра не кончилась, начинаем новую ночь
        io.to(roomId).emit('phaseChanged', { phase: 'night', dayCount: room.dayCount });
    }
}

// Проверка условий победы
function checkWinCondition(roomId) {
    const room = rooms[roomId];
    const alivePlayers = room.players.filter(p => p.alive);
    
    const mafiaAlive = alivePlayers.filter(p => p.role === 'Мафия' || p.role === 'Дон').length;
    const townAlive = alivePlayers.length - mafiaAlive;

    if (mafiaAlive === 0) {
        room.status = 'ended';
        console.log(`[GAME] Игра в комнате ${roomId} окончена. Победа города!`);
        io.to(roomId).emit('gameEnded', { winner: 'city', message: 'Победил город!' });
        return true;
    } else if (mafiaAlive >= townAlive) {
        room.status = 'ended';
        console.log(`[GAME] Игра в комнате ${roomId} окончена. Победа мафии!`);
        io.to(roomId).emit('gameEnded', { winner: 'mafia', message: 'Победила Мафия!' });
        return true;
    }
    
    return false;
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`  Сервер Мафии запущен на порту ${PORT}`);
    console.log(`  Открой в браузере: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
