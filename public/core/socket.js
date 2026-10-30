// Инициализация сокета
export const socket = io();

// Логирование для отладки
socket.on('connect', () => console.log('Connected to server:', socket.id));
socket.on('disconnect', () => console.log('Disconnected from server'));
