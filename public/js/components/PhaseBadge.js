import { getPhaseName } from '../utils/formatters.js';
import { createElement } from '../utils/dom.js';

export function updatePhaseBadge(phase, dayCount) {
    const badge = document.getElementById('game-phase');
    const dayDisplay = document.getElementById('game-day-count');
    
    badge.className = `phase-badge ${phase}`;
    badge.innerText = getPhaseName(phase);
    dayDisplay.innerText = `День ${dayCount}`;
}
