export function formatRoomCode(code) {
    return code.toUpperCase().trim();
}

export function formatPlayerName(name) {
    return name.trim().substring(0, 12);
}

export function getPhaseName(phase) {
    const map = {
        'lobby': 'Лобби',
        'night': '🌙 Ночь',
        'day': '☀️ День',
        'voting': '⚖️ Голосование',
        'ended': '🏁 Конец'
    };
    return map[phase] || phase;
}
