// Castle Busters — game configuration (units, arenas, leagues, castle blueprints)
window.CB = window.CB || {};

CB.WORLD = {
  cell: 18,          // castle block size (world px)
  gravity: 900,      // px/s^2
  vMin: 260,
  vMax: 980,
  groundY: 560,
  leftX: 230,        // castle centers
  rightX: 870,
  maxRounds: 14,
  turnTime: 20,      // seconds for player turn
};

// Unit roster. proj.kind defines flight + visual behaviour.
CB.UNITS = {
  wrecker: {
    name: 'Громила', role: 'Штурмовик', unlock: 1, hp: 110, cd: 1,
    desc: 'Большая бомба с широким взрывом. Отлично выбивает стены.',
    look: { tunic: '#8a5a33', hat: 'helmet', hatColor: '#9aa3ad', weapon: 'bomb', skin: '#f2c49b' },
    proj: { kind: 'bomb', grav: 1, r: 44, block: 3, unit: 32, size: 9 },
    perk6: 'Мега-бомба: +15% радиус и +1 урон по блокам',
  },
  scout: {
    name: 'Разведчик', role: 'Стрелок', unlock: 1, hp: 80, cd: 0,
    desc: 'Быстрый выстрел по почти прямой траектории. Без перезарядки.',
    look: { tunic: '#3f8f4f', hat: 'cap', hatColor: '#2f6b3a', weapon: 'sling', skin: '#f5cfa6' },
    proj: { kind: 'pellet', grav: 0.55, r: 18, block: 2, unit: 30, size: 5, speedMul: 1.12 },
    perk6: 'Пробивной выстрел: проходит сквозь 1 блок',
  },
  knight: {
    name: 'Рыцарь', role: 'Пробивной', unlock: 1, hp: 140, cd: 1,
    desc: 'Метает тяжёлый топор: пробивает 2 блока и взрывается.',
    look: { tunic: '#3a5fbf', hat: 'knight', hatColor: '#c9d1d9', weapon: 'axe', skin: '#f2c49b' },
    proj: { kind: 'axe', grav: 1, r: 24, block: 2, unit: 40, pierce: 2, size: 7 },
    perk6: 'Сокрушитель: пробивает 3 блока',
  },
  archer: {
    name: 'Лучница', role: 'Охотник', unlock: 1, hp: 85, cd: 1,
    desc: 'Залп из 3 стрел. Опасна для открытых юнитов.',
    look: { tunic: '#2e7d6b', hat: 'hood', hatColor: '#1f5c4f', weapon: 'bow', skin: '#f5cfa6' },
    proj: { kind: 'arrow', grav: 0.8, r: 12, block: 1, unit: 28, count: 3, spread: 0.06, size: 6 },
    perk6: 'Град стрел: залп из 5 стрел',
  },
  fairy: {
    name: 'Фея', role: 'Поддержка', unlock: 1, hp: 70, cd: 2, support: 'heal', heal: 30,
    desc: 'Вместо выстрела лечит всех ваших юнитов.',
    look: { tunic: '#e86ab8', hat: 'wings', hatColor: '#bfe9ff', weapon: 'wand', skin: '#ffd9c2' },
    perk6: 'Благословение: +20 к лечению',
  },
  bomber: {
    name: 'Бомбардир', role: 'Разрушитель', unlock: 2, hp: 100, cd: 2,
    desc: 'Кассетная бомба: в верхней точке распадается на 4 заряда. Лучший, чтобы обрушить основание.',
    look: { tunic: '#b23a3a', hat: 'bandana', hatColor: '#7a1f1f', weapon: 'dynamite', skin: '#e8b48a' },
    proj: { kind: 'cluster', grav: 1, r: 26, block: 2, unit: 22, split: 4, size: 8 },
    perk6: 'Ковровая бомбардировка: 6 зарядов',
  },
  catapult: {
    name: 'Катапульта', role: 'Осадная машина', unlock: 3, hp: 150, cd: 2,
    desc: 'Тяжёлый валун летит по крутой дуге и крушит даже камень.',
    look: { tunic: '#7d6a4f', hat: 'helmet', hatColor: '#6b5a40', weapon: 'rock', skin: '#e8b48a' },
    proj: { kind: 'boulder', grav: 1.35, r: 34, block: 5, unit: 36, size: 12, speedMul: 1.08 },
    perk6: 'Гранитный валун: +2 урона по блокам',
  },
  napalmer: {
    name: 'Поджигатель', role: 'Огонь', unlock: 4, hp: 95, cd: 2,
    desc: 'Огненный снаряд поджигает блоки и юнитов на 2 хода.',
    look: { tunic: '#e0702a', hat: 'mask', hatColor: '#3b3b3b', weapon: 'torch', skin: '#f2c49b' },
    proj: { kind: 'fire', grav: 1, r: 30, block: 1, unit: 18, burn: 2, burnR: 52, size: 8 },
    perk6: 'Вечный огонь: горение 3 хода',
  },
  mage: {
    name: 'Маг', role: 'Чародей', unlock: 5, hp: 90, cd: 2,
    desc: 'Магическая сфера летит почти прямо и прожигает блоки насквозь.',
    look: { tunic: '#6a3fbf', hat: 'wizard', hatColor: '#4b2a8f', weapon: 'staff', skin: '#f5cfa6' },
    proj: { kind: 'orb', grav: 0.22, r: 30, block: 2, unit: 34, pierce: 6, pierceDmg: 1, size: 8, speedMul: 0.86 },
    perk6: 'Сверхновая: +20% радиус взрыва',
  },
  engineer: {
    name: 'Инженер', role: 'Оборона', unlock: 6, hp: 100, cd: 3, support: 'repair', repair: 7,
    desc: 'Восстанавливает разрушенные блоки вашего замка.',
    look: { tunic: '#c9962f', hat: 'hardhat', hatColor: '#f2c230', weapon: 'wrench', skin: '#e8b48a' },
    perk6: 'Мастер-строитель: +4 блока за ремонт',
  },
};
CB.UNIT_ORDER = ['wrecker', 'scout', 'knight', 'archer', 'fairy', 'bomber', 'catapult', 'napalmer', 'mage', 'engineer'];
CB.MAX_UNIT_LEVEL = 10;
CB.DECK_MAX = 8;
CB.DECK_MIN = 3;

// Computes effective stats for a unit at a given level
CB.unitStats = function (id, level) {
  const base = CB.UNITS[id];
  const lv = Math.max(1, level || 1);
  const dmgMul = 1 + 0.08 * (lv - 1);
  const s = {
    id, level: lv, name: base.name, hp: Math.round(base.hp * (1 + 0.1 * (lv - 1))),
    cd: base.cd, support: base.support || null,
    heal: base.heal ? Math.round(base.heal * dmgMul) : 0,
    repair: base.repair || 0,
  };
  if (base.proj) {
    const p = Object.assign({}, base.proj);
    p.unit = p.unit * dmgMul;
    p.block = p.block * (1 + 0.05 * (lv - 1));
    if (lv >= 3) p.r *= 1.15;
    if (lv >= 6) {
      if (id === 'wrecker') { p.r *= 1.15; p.block += 1; }
      if (id === 'scout') p.pierce = 1;
      if (id === 'knight') p.pierce = 3;
      if (id === 'archer') p.count = 5;
      if (id === 'bomber') p.split = 6;
      if (id === 'catapult') p.block += 2;
      if (id === 'napalmer') p.burn = 3;
      if (id === 'mage') p.r *= 1.2;
    }
    s.proj = p;
  }
  if (lv >= 6) {
    if (id === 'fairy') s.heal += 20;
    if (id === 'engineer') s.repair += 4;
  }
  return s;
};
CB.upgradeCost = (lv) => 60 + lv * 70;

// Castle upgrades (Forge)
CB.CASTLE_UPGRADES = {
  walls:  { name: 'Каменные стены', desc: '+12% прочности стен за уровень', max: 10, cost: (lv) => 90 + lv * 80 },
  towers: { name: 'Башни и крыши', desc: '+15% прочности башен за уровень', max: 10, cost: (lv) => 80 + lv * 70 },
  armor:  { name: 'Броня отряда', desc: '−4% урона по вашим юнитам за уровень', max: 8, cost: (lv) => 120 + lv * 90 },
};

// Forge reward track: earn points for every upgrade
CB.FORGE_TRACK = [
  { pts: 2, coins: 120 },
  { pts: 4, coins: 180 },
  { pts: 6, unit: 'bomber', coins: 100 },
  { pts: 9, coins: 260 },
  { pts: 12, unit: 'catapult', coins: 120 },
  { pts: 15, coins: 350 },
  { pts: 19, unit: 'napalmer', coins: 150 },
  { pts: 23, coins: 450 },
  { pts: 28, unit: 'mage', coins: 200 },
  { pts: 34, coins: 600 },
  { pts: 40, unit: 'engineer', coins: 250 },
  { pts: 50, coins: 1000 },
];

CB.LEAGUES = [
  { name: 'Бронза', min: 0, color: '#c98a52' },
  { name: 'Серебро', min: 300, color: '#b9c3cc' },
  { name: 'Золото', min: 700, color: '#ffc93c' },
  { name: 'Платина', min: 1200, color: '#6fe0d2' },
  { name: 'Алмаз', min: 1800, color: '#7cb8ff' },
  { name: 'Мастер', min: 2500, color: '#c58bff' },
  { name: 'Легенда', min: 3300, color: '#ff6b6b' },
];
CB.leagueFor = (tr) => { let l = CB.LEAGUES[0]; for (const x of CB.LEAGUES) if (tr >= x.min) l = x; return l; };

// Arenas: unlocked by trophies; each has a palette + hazard
CB.ARENAS = [
  { id: 'falls', name: 'Долина водопадов', min: 0, hazard: null, wind: 0,
    hazardText: 'Спокойная арена для разминки',
    pal: { sky1: '#7fe0e6', sky2: '#c9f4ef', far: '#5cc4c4', farDark: '#3b9ea6', mid: '#2fa3a0', ground: '#6cc04a', groundDark: '#4e9a36', soil: '#3b3a48', tree: '#3f8f4f', water: '#ffffff' } },
  { id: 'hills', name: 'Ветреные холмы', min: 300, hazard: 'wind', wind: 70,
    hazardText: 'Ветер сносит снаряды',
    pal: { sky1: '#9fd3ff', sky2: '#e3f3ff', far: '#8fb8d8', farDark: '#6d95b8', mid: '#7aa86a', ground: '#8ccf55', groundDark: '#67a83a', soil: '#4a3f3a', tree: '#4f8f3a', water: null } },
  { id: 'canyon', name: 'Пустынный каньон', min: 700, hazard: 'rocks', wind: 40,
    hazardText: 'Каменопад: с неба падают валуны',
    pal: { sky1: '#ffc48a', sky2: '#ffe9c7', far: '#e39a63', farDark: '#c47a48', mid: '#d98b52', ground: '#e8b86a', groundDark: '#c9944a', soil: '#6b3f2a', tree: '#8a9a3a', water: null } },
  { id: 'ice', name: 'Ледяной перевал', min: 1200, hazard: 'wind', wind: 130,
    hazardText: 'Сильный ветер и метель',
    pal: { sky1: '#a9c7ef', sky2: '#eaf3ff', far: '#c6dcf2', farDark: '#93b3d6', mid: '#b7d1ea', ground: '#f2f7ff', groundDark: '#c8d8ec', soil: '#4b5670', tree: '#3d6b6b', water: null } },
  { id: 'volcano', name: 'Огненный вулкан', min: 1800, hazard: 'lava', wind: 60,
    hazardText: 'Вулкан извергает лавовые бомбы',
    pal: { sky1: '#4a2a3a', sky2: '#a8504a', far: '#5a2f3a', farDark: '#3d1f2a', mid: '#4a2a2a', ground: '#5a4a4a', groundDark: '#3d3232', soil: '#1f1a1f', tree: '#2f2a2a', water: null } },
];
CB.arenaFor = (tr) => { let a = CB.ARENAS[0]; for (const x of CB.ARENAS) if (tr >= x.min) a = x; return a; };

// Castle blueprints (top row first). Legend:
// # stone  W stone with window  = wooden floor  r room (air)  S unit slot (air)
// R roof (team colour)  M merlon  T tower stone  . empty
CB.BLUEPRINTS = [
  [
    '..R.....R..',
    '.RRR...RRR.',
    '.WrW...WrW.',
    '.TST...TST.',
    '.TTTM.MTTT.',
    '###########',
    'Wrrrr#rrrrW',
    '#rSrr#rrSr#',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rrSr#rSrr#',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rSrr#rrSr#',
    '###########',
  ],
  [
    '.....R.....',
    '....RRR....',
    '...RRRRR...',
    '...WrrrW...',
    '...TSrST...',
    'M.MTTTTTM.M',
    '###########',
    'Wrrrr#rrrrW',
    '#rSrr#rrSr#',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rSrr#rrSr#',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rrSr#rSrr#',
    '###########',
  ],
  [
    '.R.......R.',
    'RRR.....RRR',
    'WrW.....WrW',
    'TST.M.M.TST',
    'TTT#####TTT',
    '#rrrrrrrrr#',
    'WrSrr#rrSrW',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rrSr#rSrr#',
    '#====#====#',
    'Wrrrr#rrrrW',
    '#rSrr#rrSr#',
    '###########',
  ],
];

CB.BOT_NAMES = ['Snapdragon', 'Барон Кирпич', 'Ломатель', 'KingSiege', 'Мастер Осады', 'Rook88', 'Железный Граф',
  'Пушкарь', 'Castellan', 'Тёмный Рыцарь', 'BoomKnight', 'Стенобой', 'Lady Ballista', 'Лорд Таран', 'Фортуна', 'Grimwall'];
