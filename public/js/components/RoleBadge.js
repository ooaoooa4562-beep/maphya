import { ROLE_DESCRIPTIONS } from '../config/rolesInfo.js';

export function updateRoleBadge(role) {
    const roleDisplay = document.getElementById('role-display');
    const info = ROLE_DESCRIPTIONS[role];
    
    if (info) {
        roleDisplay.innerText = `Роль: ${info.title}`;
        roleDisplay.style.borderColor = info.color;
        roleDisplay.style.color = info.color;
    } else {
        roleDisplay.innerText = `Роль: ${role}`;
    }
}
