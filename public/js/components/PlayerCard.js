import { createElement } from '../utils/dom.js';

export function createPlayerCard(player, isCurrentPlayer, isSelected, onClick) {
    const card = createElement('div', 'player-card');
    
    if (!player.alive) card.classList.add('dead');
    if (isCurrentPlayer) card.classList.add('you');
    if (isSelected) card.classList.add('selected');

    const nameEl = createElement('div', 'player-name', player.name);
    const statusEl = createElement('div', 'player-role', player.alive ? 'Жив' : 'Мертв');
    
    card.appendChild(nameEl);
    card.appendChild(statusEl);

    // Если игрок жив и это не мы сами, и игра не закончена — добавляем клик
    if (player.alive && !isCurrentPlayer) {
        card.onclick = () => onClick(player);
    }

    return card;
}
