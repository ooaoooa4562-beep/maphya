import { ROLES } from './constants.js';

export const ROLE_DESCRIPTIONS = {
    [ROLES.MAFIA]: {
        title: 'Мафия',
        color: '#d32f2f',
        desc: 'Ночью вы выбираете жертву. Днем притворяетесь мирным.',
        team: 'Мафия'
    },
    [ROLES.DON]: {
        title: 'Дон Мафии',
        color: '#b71c1c',
        desc: 'Глава мафии. Ваш голос решающий при выборе жертвы.',
        team: 'Мафия'
    },
    [ROLES.COMMISSAR]: {
        title: 'Комиссар',
        color: '#1976d2',
        desc: 'Ночью проверяете одного игрока. Узнаете, мафия он или нет.',
        team: 'Город'
    },
    [ROLES.DOCTOR]: {
        title: 'Доктор',
        color: '#388e3c',
        desc: 'Ночью лечите одного игрока. Если его убьют — он выживет.',
        team: 'Город'
    },
    [ROLES.CIVILIAN]: {
        title: 'Мирный житель',
        color: '#757575',
        desc: 'У вас нет ночных способностей. Ваше оружие — логика и голосование.',
        team: 'Город'
    }
};
