// Castle Busters — неоновая артиллерийская дуэль замков на гусеницах.
// Один файл: данные, сохранение, меню/постройка/отряд, бой (физика, обрушение, ИИ), отрисовка.
'use strict';

/* =====================================================================
   1. КОНСТАНТЫ И ДАННЫЕ
   ===================================================================== */
const W = 2400, H = 1000;          // размеры мира
const COLS = 6, ROWS = 8, S = 44;  // сетка замка
const CHASSIS = 46;
const GROUND = 820;
const CASTLE_X = { me: 520, foe: 1880 };
const GRAV = 900;
const MAX_SPEED = 1350;
const TURN_TIME = 30;
const MAX_ROUNDS = 24;
const SQUAD_MAX = 4;

const BLOCK = {
  1: { name: 'Камень', hp: 60,  fill: '#2a2448', top: '#3b3463', edge: '#33f0ff', foeEdge: '#ff3d8b' },
  2: { name: 'Сталь',  hp: 110, fill: '#38425f', top: '#5d6b8f', edge: '#9fd8ff', foeEdge: '#ffa0c8' },
  3: { name: 'Неон',   hp: 170, fill: '#4a1590', top: '#7d2bd1', edge: '#ff7dd8', foeEdge: '#ffd166' },
};
const COST = {
  build: { wood: 100, gold: 0 },
  2: { wood: 250, gold: 100 },
  3: { wood: 400, gold: 250 },
};

const DEFAULT_UNITS = {
  wrecker:  { id:'wrecker', name:'Громила', role:'Штурмовик', tier:'S', description:'Тяжёлое ядро.', hp:100, blockDmg:95, unitDmg:70, radius:34, cooldown:0, proj:'ball', color:'#ffb347' },
  bomber:   { id:'bomber', name:'Бомбер', role:'Осадные снаряды', tier:'S', description:'Бомба с большим радиусом.', hp:80, blockDmg:70, unitDmg:55, radius:82, cooldown:2, proj:'bomb', color:'#ff4d6d' },
  napalmer: { id:'napalmer', name:'Напалмер', role:'Зонный контроль', tier:'A', description:'Огонь на 3 хода.', hp:85, blockDmg:25, unitDmg:25, radius:40, fireRadius:78, fireDmg:16, fireTurns:3, cooldown:2, proj:'fire', color:'#ff7a00' },
  scout:    { id:'scout', name:'Разведчица', role:'Скорострел', tier:'A', description:'Очередь из 3 дротиков.', hp:70, shots:3, blockDmg:30, unitDmg:30, radius:22, speed:1.08, cooldown:1, proj:'dart', color:'#39ff8e' },
  fairy:    { id:'fairy', name:'Фея', role:'Поддержка', tier:'A', description:'Лечит отряд и чинит замок.', hp:70, heal:40, repair:30, cooldown:3, proj:'heal', color:'#c38bff' },
  crow:     { id:'crow', name:'Ворон', role:'Пробой', tier:'B', description:'Прошивает 3 блока.', hp:75, blockDmg:55, unitDmg:60, radius:20, pierce:3, grav:0.12, speed:0.9, cooldown:2, proj:'crow', color:'#8ab4ff' },
};
let UNITS = JSON.parse(JSON.stringify(DEFAULT_UNITS));
const UNIT_ORDER = ['wrecker', 'bomber', 'napalmer', 'scout', 'fairy', 'crow'];

// Замки задаются «лицом вправо» (фронт — последний столбец). Для врага зеркалим.
const LAYOUT_DEFAULT = [
  [1,0,0,0,0,1],
  [1,0,0,0,0,1],
  [1,1,1,1,1,1],
  [1,0,0,0,0,2],
  [1,1,1,1,1,1],
  [1,0,0,0,0,2],
  [1,0,0,0,0,2],
  [1,1,1,1,1,1],
];
const FOE_LAYOUTS = [
  LAYOUT_DEFAULT,
  [
    [0,0,1,0,0,0],
    [0,1,1,0,0,1],
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1],
  ],
  [
    [0,0,0,0,0,0],
    [1,0,0,1,0,1],
    [1,1,1,1,1,1],
    [1,0,0,1,0,1],
    [1,0,0,1,0,1],
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1],
  ],
  [
    [1,0,0,0,0,0],
    [1,1,0,0,0,1],
    [1,0,0,0,1,1],
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1],
    [1,1,1,1,1,1],
  ],
];
const FOE_NAMES = ['AbriSupremacy', 'Swiftspeed', 'NeonWitch', 'КиберЛис', 'HaloBreaker', 'Mira_X', 'ТёмныйРыцарь', 'GasMaskQueen', 'Volt', 'Ночная_Сова'];
const ARENAS = [
  { cups: 0,    name: 'Арена 1 · Неоновые холмы' },
  { cups: 300,  name: 'Арена 2 · Фиолетовый лес' },
  { cups: 700,  name: 'Арена 3 · Город-призрак' },
  { cups: 1200, name: 'Арена 4 · Ореол' },
];

/* =====================================================================
   2. УТИЛИТЫ
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const deep = (o) => JSON.parse(JSON.stringify(o));

function groundY(x) {
  // ровные площадки под замками, холм в центре, лёгкие волны
  let y = GROUND - 175 * Math.exp(-Math.pow((x - 1200) / 230, 2)) - 18 * Math.sin(x / 95) * Math.exp(-Math.pow((x - 1200) / 500, 2));
  for (const cx of [CASTLE_X.me, CASTLE_X.foe]) {
    const d = Math.abs(x - cx);
    if (d < 230) { const t = clamp((d - 170) / 60, 0, 1); y = lerp(GROUND, y, t * t); }
  }
  if (x < 160) y = lerp(GROUND - 60, y, x / 160);
  if (x > W - 160) y = lerp(GROUND - 60, y, (W - x) / 160);
  return y;
}

let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2000);
}

/* =====================================================================
   3. СОХРАНЕНИЕ
   ===================================================================== */
const SAVE_KEY = 'cb_save_v2';
function defaultSave() {
  return { gold: 500, wood: 800, cups: 0, layout: deep(LAYOUT_DEFAULT), squad: ['wrecker', 'bomber', 'scout', 'fairy'],
    levels: { wrecker: 1, bomber: 1, napalmer: 1, scout: 1, fairy: 1, crow: 1 }, sound: true, wins: 0, games: 0, seenHelp: false };
}
let save = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = Object.assign(defaultSave(), JSON.parse(raw));
  } catch (e) { /* хранилище недоступно — играем без сохранения */ }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

function playerName() {
  try {
    const u = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user;
    if (u && u.first_name) return u.first_name;
  } catch (e) {}
  return 'Вы';
}

/* =====================================================================
   4. ЗВУК (WebAudio, синтез)
   ===================================================================== */
const Sfx = {
  ctx: null,
  init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  tone(f1, f2, dur, type = 'sine', vol = 0.15) {
    if (!save.sound || !this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  },
  noise(dur, vol = 0.3, freq = 900) {
    if (!save.sound || !this.ctx) return;
    const c = this.ctx, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
  },
  shoot() { this.tone(520, 160, 0.18, 'square', 0.06); this.noise(0.12, 0.12, 2400); },
  boom(big) { this.noise(big ? 0.7 : 0.4, big ? 0.45 : 0.3, big ? 700 : 1100); this.tone(140, 40, 0.4, 'sine', 0.25); },
  crumble() { this.noise(0.35, 0.15, 500); },
  heal() { this.tone(440, 880, 0.35, 'sine', 0.1); setTimeout(() => this.tone(660, 1320, 0.3, 'sine', 0.08), 120); },
  tick() { this.tone(900, 900, 0.05, 'square', 0.03); },
};

/* =====================================================================
   5. ОТРИСОВКА ЮНИТОВ (общая для боя и карточек)
   ===================================================================== */
function drawUnitFigure(ctx, kind, side, x, y, scale = 1, opts = {}) {
  const u = UNITS[kind];
  const face = side === 'me' ? 1 : -1;
  const eye = side === 'me' ? '#4dff9a' : '#ff3d8b';
  const t = opts.t || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * face, scale);
  const bob = Math.sin(t * 3 + (opts.seed || 0)) * 1.2;
  ctx.translate(0, bob);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // тело / плащ
  ctx.fillStyle = '#1a1230';
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-12, -18, 0, -20); ctx.quadraticCurveTo(12, -18, 11, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = u.color; ctx.lineWidth = 2; ctx.stroke();
  // голова
  ctx.fillStyle = '#e9d9f5';
  ctx.beginPath(); ctx.arc(0, -27, 9.5, 0, Math.PI * 2); ctx.fill();
  // волосы (пастельные, как у героини)
  ctx.fillStyle = kind === 'fairy' ? '#d9b8ff' : kind === 'crow' ? '#2b2b45' : '#9d93b8';
  ctx.beginPath(); ctx.arc(0, -29, 10.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.fillRect(-10.5, -30, 3.5, 11);
  // респиратор
  ctx.fillStyle = '#3a3550';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-1, -25, 9, 7, 3) : ctx.rect(-1, -25, 9, 7); ctx.fill();
  ctx.fillStyle = '#6d6788';
  ctx.beginPath(); ctx.arc(8.5, -21.5, 2.6, 0, Math.PI * 2); ctx.fill();
  // светящийся глаз-крест
  ctx.strokeStyle = eye; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(1, -32); ctx.lineTo(5, -28); ctx.moveTo(5, -32); ctx.lineTo(1, -28); ctx.stroke();
  // аксессуар класса
  ctx.lineWidth = 2;
  switch (kind) {
    case 'wrecker':
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(4, -14, 14, 6);
      ctx.fillStyle = u.color; ctx.beginPath(); ctx.arc(18, -11, 5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bomber':
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(12, -10, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = u.color; ctx.beginPath(); ctx.moveTo(14, -16); ctx.quadraticCurveTo(18, -22, 21, -19); ctx.stroke();
      break;
    case 'napalmer':
      ctx.fillStyle = '#444'; ctx.fillRect(3, -13, 16, 4);
      ctx.fillStyle = u.color; ctx.beginPath(); ctx.moveTo(19, -15); ctx.quadraticCurveTo(26, -11, 19, -7); ctx.fill();
      break;
    case 'scout':
      ctx.strokeStyle = u.color; ctx.beginPath(); ctx.arc(6, -12, 9, -1.2, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(18, -12); ctx.stroke();
      break;
    case 'fairy':
      ctx.fillStyle = 'rgba(195,139,255,.45)';
      ctx.beginPath(); ctx.ellipse(-10, -18, 7, 12, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-13, -9, 5, 8, -1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = u.color; ctx.beginPath(); ctx.moveTo(9, -6); ctx.lineTo(13, -20); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(13, -21, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'crow':
      ctx.fillStyle = '#1b1b30';
      ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(20, -17); ctx.lineTo(14, -9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = u.color; ctx.stroke();
      break;
  }
  // нимб у выбранного
  if (opts.halo) {
    ctx.strokeStyle = '#ff8a5c'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ff8a5c'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(0, -44 + Math.sin(t * 4) * 1.5, 10, 3.2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function unitPortrait(canvas, kind, side = 'me') {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 52, h = canvas.clientHeight || 58;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const sc = Math.min(w / 34, h / 52);
  drawUnitFigure(c, kind, side, w / 2 - 2 * sc, h - 6 * sc, sc);
}

/* =====================================================================
   6. МЕНЮ, ЗАМОК, ОТРЯД
   ===================================================================== */
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id === 'menu') renderMenu();
  if (id === 'build') renderBuild();
  if (id === 'squad') renderSquad();
}
function arenaFor(cups) { let a = ARENAS[0]; for (const x of ARENAS) if (cups >= x.cups) a = x; return a; }
function renderRes() {
  $('mGold').textContent = save.gold; $('mWood').textContent = save.wood; $('mCups').textContent = save.cups;
  document.querySelectorAll('.vGold').forEach((e) => (e.textContent = save.gold));
  document.querySelectorAll('.vWood').forEach((e) => (e.textContent = save.wood));
}
function renderMenu() { renderRes(); $('mArena').textContent = arenaFor(save.cups).name; }

function unitSlots(layout) {
  // пустая клетка, под которой блок (или низ замка — шасси)
  const slots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (layout[r][c]) continue;
    const below = r === ROWS - 1 ? 1 : layout[r + 1][c];
    if (!below) continue;
    let covered = false; for (let k = r - 1; k >= 0; k--) if (layout[k][c]) { covered = true; break; }
    slots.push({ r, c, covered });
  }
  // приоритет: укрытые, затем подальше от фронта, разбросать по этажам
  slots.sort((a, b) => (b.covered - a.covered) || (b.r - a.r) || (a.c - b.c));
  const byRow = {}; for (const s of slots) (byRow[s.r] = byRow[s.r] || []).push(s);
  const rows = Object.keys(byRow).sort((a, b) => b - a);
  const coveredRows = rows.filter((r) => byRow[r][0].covered), openRows = rows.filter((r) => !byRow[r][0].covered);
  const out = [];
  const interleave = (rs) => { let added = true; while (added) { added = false; for (const r of rs) { const s = byRow[r].shift(); if (s) { out.push(s); added = true; } } } };
  interleave(coveredRows); interleave(openRows);
  return out;
}

let buildMode = 'build';
function renderBuild() {
  renderRes();
  const g = $('buildGrid'); g.innerHTML = '';
  const slots = unitSlots(save.layout);
  const slotSet = new Set(slots.map((s) => s.r + ':' + s.c));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = save.layout[r][c];
    const d = document.createElement('button');
    d.className = 'bc t' + t + (slotSet.has(r + ':' + c) ? ' slot' : '');
    d.setAttribute('aria-label', t ? BLOCK[t].name : 'Пусто');
    d.onclick = () => buildClick(r, c);
    g.appendChild(d);
  }
  const need = Math.min(SQUAD_MAX, save.squad.length);
  $('buildInfo').textContent = `Мест для юнитов: ${slots.length}. ` + (slots.length < need ? `Нужно минимум ${need} — освободите клетки над блоками.` : 'Отряд помещается.');
}
function buildClick(r, c) {
  const t = save.layout[r][c];
  if (buildMode === 'build') {
    if (t) return toast('Здесь уже есть блок — переключитесь в «Улучшать»');
    if (save.wood < COST.build.wood) return toast('Не хватает дерева');
    save.wood -= COST.build.wood; save.layout[r][c] = 1;
  } else if (buildMode === 'upgrade') {
    if (!t) return toast('Сначала постройте блок');
    if (t >= 3) return toast('Максимальный уровень');
    const cost = COST[t + 1];
    if (save.wood < cost.wood || save.gold < cost.gold) return toast(`Нужно ${cost.wood} дерева и ${cost.gold} золота`);
    save.wood -= cost.wood; save.gold -= cost.gold; save.layout[r][c] = t + 1;
  } else {
    if (!t) return;
    let blocks = 0; save.layout.forEach((row) => row.forEach((v) => (blocks += v ? 1 : 0)));
    if (blocks <= 6) return toast('Замок не может быть меньше 6 блоков');
    save.layout[r][c] = 0; save.wood += 50;
  }
  Sfx.init(); Sfx.tick();
  writeSave(); renderBuild();
}

function unitStat(kind, lvl) {
  const u = UNITS[kind], m = 1 + 0.15 * (lvl - 1);
  return { hp: Math.round(u.hp * m), blockDmg: Math.round((u.blockDmg || 0) * m), unitDmg: Math.round((u.unitDmg || 0) * m),
    heal: Math.round((u.heal || 0) * m), repair: Math.round((u.repair || 0) * m), fireDmg: Math.round((u.fireDmg || 0) * m) };
}
const upCost = (lvl) => 120 * lvl;
function renderSquad() {
  renderRes();
  $('squadCount').textContent = save.squad.length;
  const list = $('squadList'); list.innerHTML = '';
  for (const id of UNIT_ORDER) {
    const u = UNITS[id], lvl = save.levels[id] || 1, st = unitStat(id, lvl), sel = save.squad.includes(id);
    const el = document.createElement('div');
    el.className = 'uc' + (sel ? ' sel' : '');
    const dmg = id === 'fairy' ? `Лечение <b>${st.heal}</b>` : `Урон <b>${st.unitDmg}</b>`;
    el.innerHTML = `<canvas></canvas><div class="meta"><span class="tier">${u.tier}</span><h4>${u.name}</h4><span class="role">${u.role} · ур. ${lvl}</span>
      <p>${u.description}</p><div class="stats"><span>HP <b>${st.hp}</b></span><span>${dmg}</span><span>Перезар. <b>${u.cooldown}</b></span></div>
      <div class="acts"><button class="btn ${sel ? 'btn-ghost' : 'btn-primary'}" data-a="sel">${sel ? 'Убрать' : 'В отряд'}</button>
      <button class="btn btn-ghost" data-a="up">Улучшить · ${upCost(lvl)}</button></div></div>`;
    list.appendChild(el);
    unitPortrait(el.querySelector('canvas'), id);
    el.querySelector('[data-a=sel]').onclick = () => {
      if (sel) { if (save.squad.length <= 1) return toast('В отряде должен быть хотя бы один юнит'); save.squad = save.squad.filter((x) => x !== id); }
      else { if (save.squad.length >= SQUAD_MAX) return toast('Максимум 4 юнита — сначала уберите кого-то'); save.squad.push(id); }
      writeSave(); renderSquad();
    };
    el.querySelector('[data-a=up]').onclick = () => {
      if (lvl >= 10) return toast('Максимальный уровень');
      if (save.gold < upCost(lvl)) return toast('Не хватает золота');
      save.gold -= upCost(lvl); save.levels[id] = lvl + 1; writeSave(); Sfx.init(); Sfx.heal(); renderSquad();
    };
  }
}

/* =====================================================================
   7. БОЙ — СОСТОЯНИЕ
   ===================================================================== */
const cv = $('cv'), ctx = cv.getContext('2d');
let cw = 0, ch = 0, dpr = 1;
let B = null; // состояние боя

function makeCastle(side, layout) {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      const t = side === 'me' ? layout[r][c] : layout[r][COLS - 1 - c];
      grid[r].push(t ? { t, hp: BLOCK[t].hp, max: BLOCK[t].hp, flash: 0 } : null);
    }
  }
  const x0 = CASTLE_X[side] - (COLS * S) / 2;
  const yb = GROUND - CHASSIS;
  let total = 0; grid.forEach((row) => row.forEach((b) => (total += b ? b.max : 0)));
  return { side, grid, x0, yb, total, integrity: 1, wheel: 0 };
}
const cellX = (cs, c) => cs.x0 + c * S;
const cellY = (cs, r) => cs.yb - (ROWS - r) * S;
function cellAt(cs, x, y) {
  const c = Math.floor((x - cs.x0) / S), r = ROWS - 1 - Math.floor((cs.yb - y) / S);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS || y > cs.yb) return null;
  return { r, c };
}

function makeUnits(side, kinds, layout, levels) {
  const slots = unitSlots(layout);
  const out = [];
  kinds.slice(0, slots.length).forEach((k, i) => {
    let { r, c } = slots[i];
    if (side === 'foe') c = COLS - 1 - c;
    const st = unitStat(k, levels[k] || 1);
    out.push({ kind: k, side, lvl: levels[k] || 1, hp: st.hp, max: st.hp, r, c, x: 0, y: 0, vy: 0, falling: false, fallFrom: 0,
      alive: true, cd: 0, seed: Math.random() * 6, hit: 0 });
  });
  return out;
}

function startBattle() {
  Sfx.init();
  const cups = save.cups;
  const tierBoost = clamp(cups / 1500, 0, 0.8);
  const foeLayout = deep(pick(FOE_LAYOUTS)).map((row) => row.map((v) => {
    if (!v) return 0; const roll = Math.random();
    return roll < tierBoost * 0.35 ? 3 : roll < tierBoost ? 2 : v;
  }));
  const foeKinds = [...UNIT_ORDER].sort(() => Math.random() - 0.5).slice(0, 4);
  const foeLvl = Math.max(1, Math.min(10, Math.round(1 + cups / 250 + rand(-0.5, 0.5))));
  const foeLevels = {}; UNIT_ORDER.forEach((k) => (foeLevels[k] = foeLvl));

  B = {
    castles: { me: makeCastle('me', save.layout), foe: makeCastle('foe', foeLayout) },
    units: [...makeUnits('me', save.squad, save.layout, save.levels), ...makeUnits('foe', foeKinds, foeLayout, foeLevels)],
    proj: [], parts: [], debris: [], texts: [], fires: [],
    turn: 'me', round: 1, phase: 'intro', phaseT: 0, timer: TURN_TIME, settleT: 0,
    sel: null, aim: null, cam: { x: CASTLE_X.me, z: 0.6, tx: CASTLE_X.me }, shake: 0, overview: false,
    foeName: pick(FOE_NAMES), foeCups: Math.max(0, cups + Math.round(rand(-60, 60))), aiDiff: clamp(0.35 + cups / 2000, 0.35, 0.9),
    queue: [], over: false, t: 0, lastTick: 0, dmgDealt: 0,
  };
  for (const u of B.units) placeUnit(u);
  settleStructure(B.castles.me, true); settleStructure(B.castles.foe, true);
  for (const side of ['me', 'foe']) { const cs = B.castles[side]; cs.total = 0; cs.grid.forEach((row) => row.forEach((b) => (cs.total += b ? b.max : 0))); }
  recalcIntegrity();
  $('unitBar').innerHTML = ''; lastBarKey = '';
  $('hMeName').textContent = `${playerName()} · ${save.cups}`;
  $('hFoeName').textContent = `${B.foeName} · ${B.foeCups}`;
  show('battle');
  resize();
  B.cam.x = B.cam.tx = CASTLE_X.me;
  buildUnitBar();
  $('dragHint').classList.toggle('off', save.games > 2);
  beginTurn('me');
}

function placeUnit(u) {
  const cs = B.castles[u.side];
  u.x = cellX(cs, u.c) + S / 2;
  u.y = cellY(cs, u.r) + S; // ноги на полу клетки
}

/* =====================================================================
   8. СТРУКТУРА: ОПОРЫ И ОБРУШЕНИЕ
   ===================================================================== */
function settleStructure(cs, silent) {
  const g = cs.grid, sup = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const q = [];
  for (let c = 0; c < COLS; c++) if (g[ROWS - 1][c]) { sup[ROWS - 1][c] = true; q.push([ROWS - 1, c]); }
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || sup[nr][nc] || !g[nr][nc]) continue;
      sup[nr][nc] = true; q.push([nr, nc]);
    }
  }
  let fell = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (g[r][c] && !sup[r][c]) {
      const b = g[r][c]; g[r][c] = null; fell++;
      if (!silent) B.debris.push({ x: cellX(cs, c) + S / 2, y: cellY(cs, r) + S / 2, vx: rand(-40, 40) + (cs.side === 'me' ? -20 : 20), vy: rand(-30, 10),
        rot: 0, vr: rand(-3, 3), t: b.t, side: cs.side, hitSet: new Set(), life: 4 });
    }
  }
  if (fell && !silent) { Sfx.crumble(); B.shake = Math.max(B.shake, 6); }
  return fell;
}
function recalcIntegrity() {
  for (const side of ['me', 'foe']) {
    const cs = B.castles[side]; let cur = 0;
    cs.grid.forEach((row) => row.forEach((b) => (cur += b ? b.hp : 0)));
    cs.integrity = cs.total ? cur / cs.total : 0;
  }
  const mp = Math.round(B.castles.me.integrity * 100), fp = Math.round(B.castles.foe.integrity * 100);
  $('hMeBar').style.width = mp + '%'; $('hMePct').textContent = mp + '%';
  $('hFoeBar').style.width = fp + '%'; $('hFoePct').textContent = fp + '%';
}

function damageBlock(cs, r, c, dmg) {
  const b = cs.grid[r][c]; if (!b) return false;
  b.hp -= dmg; b.flash = 0.25;
  if (cs.side === 'foe') B.dmgDealt += Math.min(dmg, b.hp + dmg);
  if (b.hp <= 0) {
    cs.grid[r][c] = null;
    const x = cellX(cs, c) + S / 2, y = cellY(cs, r) + S / 2;
    const col = cs.side === 'me' ? BLOCK[b.t].edge : BLOCK[b.t].foeEdge;
    for (let i = 0; i < 10; i++) spawnPart(x + rand(-15, 15), y + rand(-15, 15), rand(-260, 260), rand(-380, 40), rand(0.6, 1.2), i % 2 ? BLOCK[b.t].top : col, rand(4, 9), 'chunk');
    return true;
  }
  return false;
}
function damageUnit(u, dmg, color = '#ff3d8b') {
  if (!u.alive || dmg <= 0) return;
  u.hp -= dmg; u.hit = 0.3;
  B.texts.push({ x: u.x + rand(-6, 6), y: u.y - 50, text: '-' + Math.round(dmg), color, life: 1.1 });
  if (u.hp <= 0) {
    u.alive = false; u.hp = 0;
    for (let i = 0; i < 18; i++) spawnPart(u.x, u.y - 20, rand(-200, 200), rand(-300, 0), rand(0.5, 1.1), UNITS[u.kind].color, rand(2, 5), 'spark');
    B.texts.push({ x: u.x, y: u.y - 70, text: UNITS[u.kind].name + ' пал', color: '#fff', life: 1.6 });
  }
  buildUnitBar();
}

/* =====================================================================
   9. ЧАСТИЦЫ
   ===================================================================== */
function spawnPart(x, y, vx, vy, life, color, size, type = 'spark') {
  if (B.parts.length > 700) B.parts.shift();
  B.parts.push({ x, y, vx, vy, life, max: life, color, size, type, rot: rand(0, 6), vr: rand(-8, 8) });
}
function explosionFx(x, y, radius, color) {
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(80, 420) * (radius / 50);
    spawnPart(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 80, rand(0.35, 0.9), i % 3 ? color : '#fff3c4', rand(3, 7), 'spark');
  }
  for (let i = 0; i < 8; i++) spawnPart(x + rand(-10, 10), y + rand(-10, 10), rand(-50, 50), rand(-90, -20), rand(0.8, 1.5), 'rgba(80,60,110,.6)', rand(14, 26), 'smoke');
  B.parts.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, color, size: radius, type: 'ring' });
}

/* =====================================================================
   10. СНАРЯДЫ И ПОПАДАНИЯ
   ===================================================================== */
function launch(unit, angle, power) {
  const u = UNITS[unit.kind], st = unitStat(unit.kind, unit.lvl);
  const sp = MAX_SPEED * power * (u.speed || 1);
  const shots = u.shots || 1;
  const sx = unit.x, sy = unit.y - 26;
  for (let i = 0; i < shots; i++) {
    const a = angle + (shots > 1 ? (i - 1) * 0.035 : 0);
    const s = sp * (shots > 1 ? 1 - i * 0.03 : 1);
    B.queue.push({ delay: i * 0.22, p: { x: sx, y: sy, vx: Math.cos(a) * s, vy: -Math.sin(a) * s, kind: unit.kind, side: unit.side, st,
      grav: u.grav ?? 1, pierce: u.pierce || 0, pierced: new Set(), trail: [], age: 0 } });
  }
  unit.cd = u.cooldown;
  buildUnitBar();
}

function stepProjectile(p, dt) {
  // субшаги, чтобы не пролетать сквозь блоки
  const steps = Math.ceil((Math.hypot(p.vx, p.vy) * dt) / 7);
  const h = dt / steps;
  const foeSide = p.side === 'me' ? 'foe' : 'me';
  const cs = B.castles[foeSide];
  for (let i = 0; i < steps; i++) {
    p.vy += GRAV * p.grav * h; p.x += p.vx * h; p.y += p.vy * h;
    if (p.x < -300 || p.x > W + 300 || p.y > H + 200) return 'gone';
    if (p.y >= groundY(p.x)) { impact(p, p.x, groundY(p.x)); return 'hit'; }
    // юниты противника
    for (const u of B.units) {
      if (!u.alive || u.side !== foeSide) continue;
      if (Math.hypot(p.x - u.x, p.y - (u.y - 18)) < 18) { impact(p, p.x, p.y, u); return 'hit'; }
    }
    // блоки противника
    const cell = cellAt(cs, p.x, p.y);
    if (cell && cs.grid[cell.r][cell.c]) {
      const key = cell.r * 10 + cell.c;
      if (p.pierce > 0) {
        if (!p.pierced.has(key)) {
          p.pierced.add(key);
          damageBlock(cs, cell.r, cell.c, p.st.blockDmg);
          explosionFx(p.x, p.y, 18, UNITS[p.kind].color); B.shake = Math.max(B.shake, 3);
          if (p.pierced.size >= p.pierce) { impact(p, p.x, p.y); return 'hit'; }
        }
      } else { impact(p, p.x, p.y); return 'hit'; }
    }
    // шасси противника
    if (Math.abs(p.x - CASTLE_X[foeSide]) < (COLS * S) / 2 + 10 && p.y > cs.yb && p.y < GROUND) { impact(p, p.x, p.y); return 'hit'; }
  }
  return 'fly';
}

function impact(p, x, y, directUnit) {
  const u = UNITS[p.kind], st = p.st;
  const radius = u.radius || 30;
  const foeSide = p.side === 'me' ? 'foe' : 'me';
  explosionFx(x, y, radius, u.color);
  Sfx.boom(radius > 60);
  B.shake = Math.max(B.shake, radius > 60 ? 14 : 8);
  // блоки в радиусе (обе стороны? только противник — свой замок не страдает)
  const cs = B.castles[foeSide];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!cs.grid[r][c]) continue;
    const bx = clamp(x, cellX(cs, c), cellX(cs, c) + S), by = clamp(y, cellY(cs, r), cellY(cs, r) + S);
    const d = Math.hypot(x - bx, y - by);
    if (d <= radius) damageBlock(cs, r, c, st.blockDmg * (1 - 0.5 * (d / radius)));
  }
  for (const un of B.units) {
    if (!un.alive || un.side !== foeSide) continue;
    const d = Math.hypot(x - un.x, y - (un.y - 18));
    if (un === directUnit) damageUnit(un, st.unitDmg * 1.25, '#ffd166');
    else if (d <= radius + 16) damageUnit(un, st.unitDmg * (1 - 0.6 * (d / (radius + 16))));
  }
  if (p.kind === 'napalmer') B.fires.push({ x, y, r: u.fireRadius || 70, turns: u.fireTurns || 3, dmg: st.fireDmg, side: foeSide });
  settleStructure(cs);
  recalcIntegrity();
  B.settleT = 0;
}

function tickFires(side) {
  // огонь горит в начале хода стороны, на чьей территории он
  for (const f of B.fires) {
    if (f.side !== side || f.turns <= 0) continue;
    const cs = B.castles[f.side];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!cs.grid[r][c]) continue;
      const d = Math.hypot(f.x - (cellX(cs, c) + S / 2), f.y - (cellY(cs, r) + S / 2));
      if (d < f.r) damageBlock(cs, r, c, f.dmg);
    }
    for (const u of B.units) if (u.alive && u.side === f.side && Math.hypot(f.x - u.x, f.y - u.y) < f.r + 10) damageUnit(u, f.dmg, '#ff7a00');
    f.turns--;
    settleStructure(cs);
  }
  B.fires = B.fires.filter((f) => f.turns > 0);
  recalcIntegrity();
}

function useFairy(unit) {
  const st = unitStat(unit.kind, unit.lvl);
  for (const u of B.units) {
    if (!u.alive || u.side !== unit.side) continue;
    const before = u.hp; u.hp = Math.min(u.max, u.hp + st.heal);
    if (u.hp > before) B.texts.push({ x: u.x, y: u.y - 50, text: '+' + Math.round(u.hp - before), color: '#4dff9a', life: 1.2 });
    for (let i = 0; i < 8; i++) spawnPart(u.x + rand(-12, 12), u.y - rand(0, 40), rand(-20, 20), rand(-90, -30), rand(0.6, 1.2), '#c38bff', rand(2, 4), 'spark');
  }
  const cs = B.castles[unit.side];
  cs.grid.forEach((row) => row.forEach((b) => { if (b) b.hp = Math.min(b.max, b.hp + st.repair); }));
  recalcIntegrity();
  Sfx.heal();
  unit.cd = UNITS[unit.kind].cooldown;
  buildUnitBar();
  B.phase = 'settle'; B.settleT = 0;
}

/* =====================================================================
   11. ХОДЫ
   ===================================================================== */
function aliveUnits(side) { return B.units.filter((u) => u.alive && u.side === side); }
function readyUnits(side) { return aliveUnits(side).filter((u) => u.cd <= 0); }

function beginTurn(side) {
  if (!B || B.over) return;
  B.turn = side; B.timer = TURN_TIME; B.aim = null;
  // перезарядка
  for (const u of B.units) if (u.side === side && u.cd > 0) u.cd--;
  tickFires(side);
  if (checkEnd()) return;
  const ready = readyUnits(side);
  B.sel = ready[0] || aliveUnits(side)[0] || null;
  if (side === 'me' && B.sel && B.sel.cd > 0) B.sel = null;
  B.phase = side === 'me' ? 'aim' : 'ai';
  B.phaseT = 0;
  B.cam.tx = CASTLE_X[side];
  B.overview = false; $('btnOverview').classList.remove('on');
  const bn = $('turnBanner');
  bn.textContent = side === 'me' ? 'ВАШ ХОД' : 'ХОД ВРАГА';
  bn.classList.toggle('foe', side !== 'me');
  bn.classList.add('on'); setTimeout(() => bn.classList.remove('on'), 900);
  $('hRound').textContent = `Раунд ${B.round}/${MAX_ROUNDS}`;
  if (side === 'me' && ready.length === 0) { toast('Все юниты на перезарядке — ход пропущен'); B.phase = 'settle'; B.settleT = 0; }
  buildUnitBar();
}

function endTurn() {
  if (checkEnd()) return;
  if (B.turn === 'me') beginTurn('foe');
  else {
    B.round++;
    if (B.round > MAX_ROUNDS) return finish(B.castles.me.integrity >= B.castles.foe.integrity ? 'win' : 'lose', 'Раунды закончились');
    beginTurn('me');
  }
}

function checkEnd() {
  if (B.over) return true;
  const meDead = aliveUnits('me').length === 0 || B.castles.me.integrity <= 0.001;
  const foeDead = aliveUnits('foe').length === 0 || B.castles.foe.integrity <= 0.001;
  if (foeDead && !meDead) { finish('win', aliveUnits('foe').length === 0 ? 'Все юниты врага повержены' : 'Вражеский замок разрушен'); return true; }
  if (meDead) { finish(foeDead ? 'win' : 'lose', aliveUnits('me').length === 0 ? 'Ваш отряд пал' : 'Ваш замок разрушен'); return true; }
  return false;
}

function finish(result, reason) {
  B.over = true; B.phase = 'over';
  const win = result === 'win';
  const cupsD = win ? 30 + Math.round(rand(0, 6)) : -Math.min(save.cups, 15);
  const gold = win ? 150 + Math.round(B.dmgDealt / 10) : 40 + Math.round(B.dmgDealt / 25);
  const wood = win ? 220 : 90;
  save.cups += cupsD; save.gold += gold; save.wood += wood; save.games++; if (win) save.wins++;
  writeSave();
  setTimeout(() => {
    $('rTitle').textContent = win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    $('rTitle').classList.toggle('lose', !win);
    $('rSub').textContent = reason;
    $('rRewards').innerHTML = `<div class="res"><span class="ico ico-cup"></span><b>${cupsD >= 0 ? '+' : ''}${cupsD}</b></div>
      <div class="res"><span class="ico ico-gold"></span><b>+${gold}</b></div><div class="res"><span class="ico ico-wood"></span><b>+${wood}</b></div>`;
    $('resultModal').classList.add('on');
  }, 1100);
  try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred(win ? 'success' : 'error'); } catch (e) {}
}

/* =====================================================================
   12. ИИ
   ===================================================================== */
function simulate(sx, sy, vx, vy, grav, side, pierceIgnore) {
  const foeSide = side === 'me' ? 'foe' : 'me', cs = B.castles[foeSide];
  let x = sx, y = sy; const h = 1 / 120;
  for (let i = 0; i < 900; i++) {
    vy += GRAV * grav * h; x += vx * h; y += vy * h;
    if (x < -300 || x > W + 300 || y > H + 200) return null;
    if (y >= groundY(x)) return { x, y };
    for (const u of B.units) if (u.alive && u.side === foeSide && Math.hypot(x - u.x, y - (u.y - 18)) < 18) return { x, y, unit: u };
    if (!pierceIgnore) { const cell = cellAt(cs, x, y); if (cell && cs.grid[cell.r][cell.c]) return { x, y }; }
    if (Math.abs(x - CASTLE_X[foeSide]) < (COLS * S) / 2 && y > cs.yb && y < GROUND) return { x, y };
  }
  return null;
}

function aiTurn() {
  const mine = aliveUnits('foe'), ready = readyUnits('foe');
  if (!ready.length) { B.phase = 'settle'; B.settleT = 0; return; }
  // лечение, если отряд сильно ранен
  const fairy = ready.find((u) => u.kind === 'fairy');
  const hurt = mine.reduce((s, u) => s + (u.max - u.hp), 0);
  if (fairy && (hurt > 70 || B.castles.foe.integrity < 0.6)) { B.sel = fairy; return useFairy(fairy); }
  const shooters = ready.filter((u) => u.kind !== 'fairy');
  if (!shooters.length) { B.phase = 'settle'; B.settleT = 0; return; }
  const pref = ['bomber', 'crow', 'napalmer', 'wrecker', 'scout'];
  shooters.sort((a, b) => pref.indexOf(a.kind) - pref.indexOf(b.kind));
  const unit = Math.random() < 0.7 ? shooters[0] : pick(shooters);
  B.sel = unit;
  const u = UNITS[unit.kind];
  // цель: самый слабый юнит игрока или опорный блок
  const targets = aliveUnits('me').sort((a, b) => a.hp - b.hp);
  let tx, ty;
  if (targets.length && Math.random() < 0.75) { tx = targets[0].x; ty = targets[0].y - 18; }
  else {
    const cs = B.castles.me; const opts = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (cs.grid[r][c]) opts.push({ r, c });
    const o = opts.sort((a, b) => b.r - a.r || b.c - a.c)[Math.floor(Math.random() * Math.min(5, opts.length))] || { r: ROWS - 1, c: COLS - 1 };
    tx = cellX(cs, o.c) + S / 2; ty = cellY(cs, o.r) + S / 2;
  }
  let best = null;
  const sx = unit.x, sy = unit.y - 26;
  for (let ad = 8; ad <= 80; ad += 2) {
    for (let pw = 0.3; pw <= 1.0001; pw += 0.025) {
      const a = Math.PI - (ad * Math.PI) / 180; // стреляем влево
      const sp = MAX_SPEED * pw * (u.speed || 1);
      const hit = simulate(sx, sy, Math.cos(a) * sp, -Math.sin(a) * sp, u.grav ?? 1, 'foe', !!u.pierce);
      if (!hit) continue;
      const d = Math.hypot(hit.x - tx, hit.y - ty) - (hit.unit ? 30 : 0);
      if (!best || d < best.d) best = { d, a, pw };
    }
  }
  if (!best) best = { a: Math.PI - 0.8, pw: 0.85 };
  const err = (1 - B.aiDiff);
  const angle = best.a + rand(-1, 1) * err * 0.09;
  const power = clamp(best.pw + rand(-1, 1) * err * 0.06, 0.2, 1);
  B.aiShot = { unit, angle, power, t: 0 };
  B.phase = 'aiaim';
}

/* =====================================================================
   13. ВВОД
   ===================================================================== */
function screenToWorld(sx, sy) {
  const z = B.cam.z;
  return { x: (sx - cw / 2) / z + B.cam.x, y: (sy - B.camY) / z };
}
let drag = null;
cv.addEventListener('pointerdown', (e) => {
  Sfx.init();
  if (!B || B.phase !== 'aim' || B.turn !== 'me' || !B.sel) return;
  if (UNITS[B.sel.kind].proj === 'heal') return toast('Фея не стреляет — нажмите «Исцелить»');
  if (B.overview) { B.overview = false; $('btnOverview').classList.remove('on'); }
  drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId };
  cv.setPointerCapture(e.pointerId);
  updateAim();
});
cv.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; drag.x = e.clientX; drag.y = e.clientY; updateAim(); });
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const aim = B.aim; drag = null; B.aim = null; $('aimRead').classList.remove('on');
  if (aim && aim.power >= 0.08 && B.phase === 'aim' && B.sel && B.sel.alive && B.sel.cd <= 0) {
    $('dragHint').classList.add('off');
    fire(B.sel, aim.angle, aim.power);
  }
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

function updateAim() {
  const dx = drag.x0 - drag.x, dy = drag.y0 - drag.y;
  const len = Math.hypot(dx, dy);
  const full = Math.min(cw, ch) * 0.38;
  const power = clamp(len / full, 0, 1);
  const angle = Math.atan2(-dy, dx);
  B.aim = { angle, power };
  let deg = Math.round((angle * 180) / Math.PI);
  $('aPow').textContent = Math.round(power * 100) + '%';
  $('aAng').textContent = deg + '°';
  $('aimRead').classList.toggle('on', len > 6);
}

function fire(unit, angle, power) {
  launch(unit, angle, power);
  Sfx.shoot();
  B.phase = 'flight'; B.settleT = 0;
  try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch (e) {}
}

function buildUnitBar() {
  if (!B) return;
  const bar = $('unitBar');
  const mine = B.units.filter((u) => u.side === 'me');
  if (bar.children.length !== mine.length) {
    bar.innerHTML = '';
    mine.forEach((u, i) => {
      const el = document.createElement('button');
      el.className = 'ucard'; el.innerHTML = `<div class="hp"><i></i></div><canvas></canvas><span class="nm">${UNITS[u.kind].name}</span>`;
      el.onclick = () => {
        if (B.turn !== 'me' || B.phase !== 'aim') return;
        if (!u.alive) return;
        if (u.cd > 0) return toast(`${UNITS[u.kind].name} перезаряжается: ${u.cd} ход.`);
        B.sel = u; Sfx.tick(); buildUnitBar();
      };
      bar.appendChild(el);
      requestAnimationFrame(() => unitPortrait(el.querySelector('canvas'), u.kind));
    });
  }
  mine.forEach((u, i) => {
    const el = bar.children[i];
    el.classList.toggle('sel', B.sel === u && B.turn === 'me');
    el.classList.toggle('dead', !u.alive);
    el.classList.toggle('cd', u.alive && u.cd > 0);
    el.classList.toggle('locked', B.turn !== 'me');
    el.dataset.cd = u.cd;
    el.querySelector('.hp i').style.width = (100 * u.hp) / u.max + '%';
  });
  const isHeal = B.turn === 'me' && B.phase === 'aim' && B.sel && UNITS[B.sel.kind].proj === 'heal';
  $('btnAction').classList.toggle('on', !!isHeal);
}

/* =====================================================================
   14. ОБНОВЛЕНИЕ
   ===================================================================== */
function update(dt) {
  if (!B) return;
  B.t += dt;
  const busy = B.proj.length || B.queue.length || B.debris.length || B.units.some((u) => u.falling);

  // очередь выстрелов (очередь разведчицы)
  for (const q of B.queue) q.delay -= dt;
  while (B.queue.length && B.queue[0].delay <= 0) { B.proj.push(B.queue.shift().p); if (B.proj.length > 1) Sfx.shoot(); }

  // снаряды
  for (const p of B.proj) {
    p.age += dt;
    p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 18) p.trail.shift();
    p.state = stepProjectile(p, dt);
  }
  B.proj = B.proj.filter((p) => p.state === 'fly');

  // обломки
  for (const d of B.debris) {
    d.vy += GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
    const cs = B.castles[d.side];
    for (const u of B.units) if (u.alive && u.side === d.side && !d.hitSet.has(u) && Math.abs(u.x - d.x) < 22 && Math.abs(u.y - 18 - d.y) < 26) { d.hitSet.add(u); damageUnit(u, 18, '#ffa0c8'); }
    const cell = cellAt(cs, d.x, d.y + S / 2);
    const landed = d.y + S / 2 >= (Math.abs(d.x - CASTLE_X[d.side]) < (COLS * S) / 2 ? cs.yb : groundY(d.x)) || (cell && cs.grid[cell.r][cell.c] && d.vy > 0);
    if (landed || d.life <= 0) {
      d.dead = true;
      for (let i = 0; i < 7; i++) spawnPart(d.x + rand(-14, 14), d.y + rand(-10, 10), rand(-160, 160), rand(-200, -20), rand(0.4, 0.9), BLOCK[d.t].top, rand(3, 7), 'chunk');
      B.shake = Math.max(B.shake, 3);
    }
  }
  if (B.debris.some((d) => d.dead)) { B.debris = B.debris.filter((d) => !d.dead); }

  // юниты: падение без опоры
  for (const u of B.units) {
    if (!u.alive) continue;
    const cs = B.castles[u.side];
    if (!u.falling) {
      const below = u.r === ROWS - 1 ? true : !!cs.grid[u.r + 1][u.c];
      if (!below) { u.falling = true; u.vy = 0; u.fallFrom = u.r; }
    }
    if (u.falling) {
      u.vy += GRAV * dt; u.y += u.vy * dt;
      // найти пол под собой
      let floorR = ROWS - 1;
      for (let r = u.r + 1; r < ROWS; r++) { if (cs.grid[r][u.c]) { floorR = r - 1; break; } floorR = r; }
      const floorY = cellY(cs, floorR) + S;
      if (u.y >= floorY) {
        u.y = floorY; u.r = floorR; u.falling = false;
        const fell = floorR - u.fallFrom;
        if (fell >= 2) damageUnit(u, 12 * (fell - 1), '#ffd166');
      }
    }
    if (u.hit > 0) u.hit -= dt;
  }

  // частицы
  for (const p of B.parts) {
    p.life -= dt;
    if (p.type === 'smoke') { p.x += p.vx * dt; p.y += p.vy * dt; p.size += 12 * dt; }
    else if (p.type !== 'ring') { p.vy += GRAV * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const gy = groundY(p.x); if (p.y > gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; } }
  }
  B.parts = B.parts.filter((p) => p.life > 0);
  for (const t of B.texts) { t.life -= dt; t.y -= 40 * dt; }
  B.texts = B.texts.filter((t) => t.life > 0);
  for (const side of ['me', 'foe']) B.castles[side].grid.forEach((row) => row.forEach((b) => { if (b && b.flash > 0) b.flash -= dt; }));
  B.shake *= Math.pow(0.02, dt);

  // фазы
  B.phaseT += dt;
  if (B.phase === 'aim' || B.phase === 'ai' || B.phase === 'aiaim') {
    const prev = Math.ceil(B.timer);
    B.timer -= dt;
    if (B.turn === 'me' && Math.ceil(B.timer) !== prev && B.timer < 5 && B.timer > 0) Sfx.tick();
    if (B.timer <= 0 && B.phase === 'aim') { toast('Время вышло'); drag = null; B.aim = null; $('aimRead').classList.remove('on'); B.phase = 'settle'; B.settleT = 0; }
  }
  if (B.phase === 'ai' && B.phaseT > 1.1) aiTurn();
  if (B.phase === 'aiaim') {
    B.aiShot.t += dt;
    const k = clamp(B.aiShot.t / 0.9, 0, 1);
    B.aim = { angle: B.aiShot.angle, power: B.aiShot.power * k };
    if (B.aiShot.t > 1.15) { B.aim = null; fire(B.aiShot.unit, B.aiShot.angle, B.aiShot.power); }
  }
  if (B.phase === 'flight' && !busy) { B.phase = 'settle'; B.settleT = 0; }
  if (B.phase === 'settle') {
    if (busy) B.settleT = 0; else B.settleT += dt;
    if (B.settleT > 0.7) { B.phase = 'next'; endTurn(); }
  }

  // камера
  let target = B.cam.tx;
  if (B.proj.length) target = B.proj[0].x;
  else if (B.phase === 'settle' || B.phase === 'flight') target = B.lastImpactX ?? target;
  if (B.proj.length) B.lastImpactX = B.proj[0].x;
  if (B.phase === 'aim' || B.phase === 'ai' || B.phase === 'aiaim') { target = B.cam.tx; B.lastImpactX = null; }
  const z0 = baseZoom();
  let zt = z0, xt = target;
  if (B.overview) { zt = Math.min(cw / (W - 200), (ch - 140) / 760); xt = W / 2; }
  B.cam.z = lerp(B.cam.z, zt, 1 - Math.pow(0.002, dt));
  const half = cw / 2 / B.cam.z;
  xt = clamp(xt, Math.min(W / 2, half - 60), Math.max(W / 2, W - half + 60));
  B.cam.x = lerp(B.cam.x, xt, 1 - Math.pow(B.proj.length ? 0.0005 : 0.01, dt));

  // HUD
  const tm = $('hTimer');
  const shown = B.phase === 'aim' || B.phase === 'ai' || B.phase === 'aiaim' ? Math.max(0, Math.ceil(B.timer)) : '—';
  if (tm.textContent != shown) tm.textContent = shown;
  tm.classList.toggle('low', typeof shown === 'number' && shown <= 5);
  buildUnitBarLight();
}
let lastBarKey = '';
function buildUnitBarLight() {
  const key = B.turn + B.phase + (B.sel ? B.units.indexOf(B.sel) : -1);
  if (key !== lastBarKey) { lastBarKey = key; buildUnitBar(); }
}
function baseZoom() {
  const portrait = ch > cw * 1.2;
  return portrait ? Math.min((ch - 190) / 560, cw / 560, 1.2) : Math.min((ch - 150) / 640, cw / 820, 1.4);
}

/* =====================================================================
   15. ОТРИСОВКА
   ===================================================================== */
let bgCanvas = null, stars = [], skyline = [], trees = [];
function genScenery() {
  stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6 }));
  skyline = [];
  for (let x = -600; x < W + 1200; x += rand(40, 90)) skyline.push({ x, w: rand(36, 80), h: rand(80, 300), win: Math.random() < 0.7, hue: Math.random() < 0.5 ? '#33f0ff' : '#ff3d8b' });
  trees = [];
  for (let x = 60; x < W - 40; x += rand(40, 110)) {
    if (Math.abs(x - CASTLE_X.me) < 240 || Math.abs(x - CASTLE_X.foe) < 240) continue;
    trees.push({ x, h: rand(50, 110), w: rand(26, 44) });
  }
}
function renderBg() {
  bgCanvas = document.createElement('canvas'); bgCanvas.width = cw * dpr; bgCanvas.height = ch * dpr;
  const c = bgCanvas.getContext('2d'); c.scale(dpr, dpr);
  const g = c.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#0a0620'); g.addColorStop(0.45, '#2a0f4a'); g.addColorStop(0.8, '#5a1858'); g.addColorStop(1, '#2a0d2e');
  c.fillStyle = g; c.fillRect(0, 0, cw, ch);
  // ореол-луна (как нимб героини)
  const mx = cw * 0.72, my = ch * 0.24, mr = Math.min(cw, ch) * 0.13;
  const gl = c.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
  gl.addColorStop(0, 'rgba(255,138,92,.35)'); gl.addColorStop(1, 'rgba(255,138,92,0)');
  c.fillStyle = gl; c.fillRect(0, 0, cw, ch);
  c.strokeStyle = '#ff8a5c'; c.lineWidth = Math.max(3, mr * 0.09); c.shadowColor = '#ff6fa0'; c.shadowBlur = 30;
  c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.stroke();
  c.shadowBlur = 0;
}

function render() {
  if (!B) return;
  const z = B.cam.z;
  // привязка по вертикали: земля у нижней панели
  const bottomPad = ch < 520 ? 80 : 104;
  const portrait = ch > cw * 1.2;
  // в портрете поднимаем землю выше, чтобы под замком осталась «земля», а над ним — место для дуги
  B.camY = ch - bottomPad - (GROUND + (portrait ? 60 + (ch - 600) * 0.25 / z : 60)) * z;
  const shx = (Math.random() - 0.5) * B.shake, shy = (Math.random() - 0.5) * B.shake;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, cw, ch);
  // звёзды
  for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(B.t * 1.2 + s.tw)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x * cw, s.y * ch * 0.8, s.r, s.r); }
  ctx.globalAlpha = 1;

  const wx = (x) => (x - B.cam.x) * z + cw / 2 + shx;
  const wy = (y) => y * z + B.camY + shy;

  // силуэты неонового города (параллакс)
  const par = 0.35;
  ctx.save();
  for (const b of skyline) {
    const x = (b.x - B.cam.x * par - W * 0.5 * (1 - par)) * z * 0.8 + cw / 2;
    const yb = wy(GROUND - 40);
    const h = b.h * z * 0.8, w = b.w * z * 0.8;
    if (x + w < 0 || x > cw) continue;
    ctx.fillStyle = '#1a0b2e'; ctx.fillRect(x, yb - h, w, h);
    if (b.win) { ctx.fillStyle = b.hue; ctx.globalAlpha = 0.35; for (let yy = yb - h + 8 * z; yy < yb - 10 * z; yy += 16 * z) ctx.fillRect(x + w * 0.25, yy, w * 0.5, 2.5 * z); ctx.globalAlpha = 1; }
  }
  ctx.restore();

  ctx.save();
  ctx.translate(shx, shy);
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - B.cam.x * z + shx), dpr * (B.camY + shy));
  // Ниже — рисуем в мировых координатах
  drawTerrain();
  for (const f of B.fires) drawFire(f);
  drawCastle(B.castles.me); drawCastle(B.castles.foe);
  for (const u of B.units) drawUnit(u);
  for (const d of B.debris) drawDebris(d);
  drawAim();
  for (const p of B.proj) drawProj(p);
  drawParts();
  for (const t of B.texts) {
    ctx.globalAlpha = clamp(t.life * 1.5, 0, 1);
    ctx.font = `800 ${Math.round(20 / Math.max(0.6, z))}px Rubik, sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // указатель на замок соперника, если он за кадром
  const other = B.turn === 'me' ? 'foe' : 'me';
  const ox = wx(CASTLE_X[other]);
  if ((ox < -40 || ox > cw + 40) && !B.proj.length) {
    const right = ox > cw;
    const ax = right ? cw - 18 : 18, ay = ch * 0.55;
    ctx.save(); ctx.translate(ax, ay); if (!right) ctx.scale(-1, 1);
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(B.t * 4);
    ctx.fillStyle = other === 'foe' ? '#ff3d8b' : '#33f0ff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = '700 11px Rubik, sans-serif'; ctx.textAlign = right ? 'right' : 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(other === 'foe' ? 'враг' : 'вы', right ? cw - 30 : 30, ay + 4);
  }
}

function drawTerrain() {
  const x0 = B.cam.x - cw / B.cam.z, x1 = B.cam.x + cw / B.cam.z;
  // деревья позади
  for (const t of trees) {
    if (t.x < x0 - 100 || t.x > x1 + 100) continue;
    const gy = groundY(t.x) + 6;
    ctx.fillStyle = '#12081f';
    ctx.beginPath(); ctx.moveTo(t.x - t.w / 2, gy); ctx.lineTo(t.x, gy - t.h); ctx.lineTo(t.x + t.w / 2, gy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(77,255,154,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x0 - 50, H + 600);
  for (let x = Math.floor((x0 - 50) / 16) * 16; x <= x1 + 50; x += 16) ctx.lineTo(x, groundY(x));
  ctx.lineTo(x1 + 50, H + 600); ctx.closePath();
  const g = ctx.createLinearGradient(0, GROUND - 200, 0, H + 200);
  g.addColorStop(0, '#1f0d3a'); g.addColorStop(1, '#0a0516');
  ctx.fillStyle = g; ctx.fill();
  // неоновая кромка
  ctx.beginPath();
  for (let x = Math.floor((x0 - 50) / 16) * 16; x <= x1 + 50; x += 16) { const y = groundY(x); x === Math.floor((x0 - 50) / 16) * 16 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.strokeStyle = '#4dff9a'; ctx.lineWidth = 4; ctx.shadowColor = '#4dff9a'; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(77,255,154,.25)'; ctx.lineWidth = 12; ctx.stroke();
}

function drawCastle(cs) {
  const me = cs.side === 'me';
  const team = me ? '#33f0ff' : '#ff3d8b';
  const left = cs.x0 - 12, right = cs.x0 + COLS * S + 12;
  // шасси с гусеницами
  ctx.fillStyle = '#17132b';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left, cs.yb, right - left, CHASSIS, 18) : ctx.rect(left, cs.yb, right - left, CHASSIS); ctx.fill();
  ctx.strokeStyle = team; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#2b2546'; ctx.fillRect(left + 6, cs.yb, right - left - 12, 10);
  cs.wheel += 0.02;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x = left + 24 + (i * (right - left - 48)) / (n - 1), y = cs.yb + CHASSIS - 18;
    ctx.fillStyle = '#0c0a18'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = team; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(me ? cs.wheel : -cs.wheel);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.restore();
  }
  // блоки
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const b = cs.grid[r][c]; if (!b) continue;
    const x = cellX(cs, c), y = cellY(cs, r), info = BLOCK[b.t];
    const edge = me ? info.edge : info.foeEdge;
    ctx.fillStyle = info.fill; ctx.fillRect(x + 1, y + 1, S - 2, S - 2);
    ctx.fillStyle = info.top; ctx.fillRect(x + 1, y + 1, S - 2, 9);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 1, y + S - 7, S - 2, 6);
    // кладка
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1, y + S / 2); ctx.lineTo(x + S - 1, y + S / 2); ctx.moveTo(x + S / 2, y + 10); ctx.lineTo(x + S / 2, y + S / 2); ctx.stroke();
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, S - 4, S - 4);
    if (b.t === 3) { ctx.fillStyle = 'rgba(255,125,216,.22)'; ctx.beginPath(); ctx.moveTo(x + S / 2, y + 10); ctx.lineTo(x + S - 12, y + S / 2); ctx.lineTo(x + S / 2, y + S - 10); ctx.lineTo(x + 12, y + S / 2); ctx.closePath(); ctx.fill(); }
    // трещины
    const dmg = 1 - b.hp / b.max;
    if (dmg > 0.25) {
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x + 18, y + 22); ctx.lineTo(x + 14, y + 32);
      if (dmg > 0.55) { ctx.moveTo(x + S - 8, y + 8); ctx.lineTo(x + S - 18, y + 20); ctx.lineTo(x + S - 10, y + 30); ctx.lineTo(x + S - 22, y + S - 6); }
      ctx.stroke();
    }
    if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash * 2.4})`; ctx.fillRect(x, y, S, S); }
    // крыша-конус на верхнем блоке высокой башни
    const topOpen = r === 0 || !cs.grid[r - 1][c];
    if (topOpen) {
      const tall = r <= 1;
      if (tall) {
        ctx.fillStyle = me ? '#1679a8' : '#b0175a';
        ctx.beginPath(); ctx.moveTo(x - 4, y + 2); ctx.lineTo(x + S / 2, y - 40); ctx.lineTo(x + S + 4, y + 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = team; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = team; ctx.beginPath(); ctx.moveTo(x + S / 2, y - 40); ctx.lineTo(x + S / 2, y - 54); ctx.stroke();
        ctx.fillStyle = team; ctx.beginPath(); ctx.moveTo(x + S / 2, y - 54); ctx.lineTo(x + S / 2 + (me ? 14 : -14), y - 49); ctx.lineTo(x + S / 2, y - 44); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = info.top;
        for (let k = 0; k < 3; k++) ctx.fillRect(x + 3 + k * 14, y - 8, 9, 8);
      }
    }
  }
}

function drawUnit(u) {
  const sel = B.sel === u && (B.phase === 'aim' || B.phase === 'aiaim' || B.phase === 'ai');
  if (!u.alive) {
    // надгробие
    ctx.fillStyle = '#3a3550'; ctx.beginPath(); ctx.moveTo(u.x - 9, u.y); ctx.lineTo(u.x - 9, u.y - 16); ctx.arc(u.x, u.y - 16, 9, Math.PI, 0); ctx.lineTo(u.x + 9, u.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6d6788'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(u.x, u.y - 20); ctx.lineTo(u.x, u.y - 8); ctx.moveTo(u.x - 4, u.y - 16); ctx.lineTo(u.x + 4, u.y - 16); ctx.stroke();
    return;
  }
  if (u.hit > 0) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(B.t * 60); }
  drawUnitFigure(ctx, u.kind, u.side, u.x, u.y, 1, { t: B.t, halo: sel, seed: u.seed });
  if (u.hit > 0) ctx.restore();
  // полоска HP
  const w = 30, pct = u.hp / u.max;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(u.x - w / 2, u.y - 62, w, 5);
  ctx.fillStyle = pct > 0.5 ? '#4dff9a' : pct > 0.25 ? '#ffd166' : '#ff3d8b'; ctx.fillRect(u.x - w / 2, u.y - 62, w * pct, 5);
  if (u.cd > 0 && u.side === B.turn) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '700 11px Rubik'; ctx.textAlign = 'center'; ctx.fillText('⟳' + u.cd, u.x, u.y - 66); }
}

function drawDebris(d) {
  const info = BLOCK[d.t];
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
  ctx.fillStyle = info.fill; ctx.fillRect(-S / 2, -S / 2, S, S);
  ctx.strokeStyle = d.side === 'me' ? info.edge : info.foeEdge; ctx.lineWidth = 2; ctx.strokeRect(-S / 2 + 2, -S / 2 + 2, S - 4, S - 4);
  ctx.restore();
}

function drawAim() {
  if (!B.aim || !B.sel || B.aim.power < 0.02) return;
  const u = B.sel, U = UNITS[u.kind];
  const sp = MAX_SPEED * B.aim.power * (U.speed || 1);
  let x = u.x, y = u.y - 26, vx = Math.cos(B.aim.angle) * sp, vy = -Math.sin(B.aim.angle) * sp;
  const g = GRAV * (U.grav ?? 1);
  const dots = 20, dtt = 0.045;
  for (let i = 1; i <= dots; i++) {
    const t = i * dtt;
    const px = x + vx * t, py = y + vy * t + 0.5 * g * t * t;
    if (py > groundY(px)) break;
    ctx.globalAlpha = 1 - i / (dots + 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px, py, i % 5 === 0 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // стрелка-рогатка
  ctx.strokeStyle = 'rgba(255,138,92,.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(u.x, u.y - 26, 22 + 30 * B.aim.power, -B.aim.angle - 0.25, -B.aim.angle + 0.25); ctx.stroke();
}

function drawProj(p) {
  const U = UNITS[p.kind];
  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i]; ctx.globalAlpha = (i / p.trail.length) * 0.5;
    ctx.fillStyle = U.color; ctx.beginPath(); ctx.arc(t.x, t.y, 2 + (i / p.trail.length) * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = U.color; ctx.shadowBlur = 18;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
  switch (U.proj) {
    case 'ball': ctx.fillStyle = '#2b2b3a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = U.color; ctx.lineWidth = 3; ctx.stroke(); break;
    case 'bomb': ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = U.color; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = Math.sin(B.t * 40) > 0 ? '#fff' : U.color; ctx.beginPath(); ctx.arc(-12, -8, 4, 0, Math.PI * 2); ctx.fill(); break;
    case 'fire': ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = U.color; ctx.beginPath(); ctx.arc(-6, 0, 12, 0, Math.PI * 2); ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1; break;
    case 'dart': ctx.fillStyle = U.color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, -4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill(); break;
    case 'crow': ctx.fillStyle = '#1b1b30'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -12 * Math.abs(Math.sin(B.t * 18))); ctx.lineTo(-4, 0); ctx.lineTo(-8, 12 * Math.abs(Math.sin(B.t * 18))); ctx.closePath(); ctx.fill(); ctx.strokeStyle = U.color; ctx.lineWidth = 2; ctx.stroke(); break;
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawFire(f) {
  for (let i = 0; i < 2; i++) spawnPart(f.x + rand(-f.r * 0.7, f.r * 0.7), f.y + rand(-f.r * 0.4, f.r * 0.3), rand(-15, 15), rand(-120, -50), rand(0.3, 0.6), Math.random() < 0.5 ? '#ff7a00' : '#ffd166', rand(4, 8), 'flame');
  const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r);
  g.addColorStop(0, 'rgba(255,122,0,.35)'); g.addColorStop(1, 'rgba(255,122,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
}

function drawParts() {
  for (const p of B.parts) {
    const k = p.life / p.max;
    if (p.type === 'ring') {
      ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = 6 * k + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - k * 0.8), 0, Math.PI * 2); ctx.stroke();
    } else if (p.type === 'smoke') {
      ctx.globalAlpha = k * 0.5; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'chunk') {
      ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
    } else {
      ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.type === 'flame' ? k : 1), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* =====================================================================
   16. ЦИКЛ, РАЗМЕРЫ, ЗАПУСК
   ===================================================================== */
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = window.innerWidth; ch = window.innerHeight;
  cv.width = cw * dpr; cv.height = ch * dpr;
  renderBg();
  if (B) B.cam.z = baseZoom();
}
window.addEventListener('resize', resize);

let lastT = 0, acc = 0;
const STEP = 1 / 60;
function loop(ts) {
  const dt = Math.min(0.1, (ts - lastT) / 1000 || 0); lastT = ts;
  if (B && $('battle').classList.contains('active')) {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
  }
  requestAnimationFrame(loop);
}

function wireUi() {
  $('btnPlay').onclick = () => { if (!save.seenHelp) { save.seenHelp = true; writeSave(); $('helpModal').classList.add('on'); $('helpModal').dataset.then = 'play'; return; } startBattle(); };
  $('btnBuild').onclick = () => show('build');
  $('btnSquad').onclick = () => show('squad');
  $('btnHelp').onclick = () => { $('helpModal').classList.add('on'); $('helpModal').dataset.then = ''; };
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => show(b.dataset.go)));
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => {
    const m = b.closest('.modal'); m.classList.remove('on');
    if (m.id === 'helpModal' && m.dataset.then === 'play') { m.dataset.then = ''; startBattle(); }
  }));
  $('buildMode').querySelectorAll('button').forEach((b) => (b.onclick = () => {
    buildMode = b.dataset.mode; $('buildMode').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('btnResetCastle').onclick = () => { save.layout = deep(LAYOUT_DEFAULT); writeSave(); renderBuild(); toast('Стандартный замок восстановлен'); };
  $('btnAction').onclick = () => { if (B && B.turn === 'me' && B.phase === 'aim' && B.sel && UNITS[B.sel.kind].proj === 'heal') useFairy(B.sel); };
  $('btnOverview').onclick = () => { if (!B) return; B.overview = !B.overview; $('btnOverview').classList.toggle('on', B.overview); };
  const syncSound = () => { $('btnSound').classList.toggle('on', save.sound); $('btnSound').textContent = save.sound ? 'Звук' : 'Без звука'; };
  $('btnSound').onclick = () => { save.sound = !save.sound; writeSave(); syncSound(); };
  syncSound();
  $('btnQuit').onclick = () => { if (B && !B.over) $('confirmModal').classList.add('on'); };
  $('btnQuitYes').onclick = () => { $('confirmModal').classList.remove('on'); if (B && !B.over) finish('lose', 'Вы покинули бой'); };
  $('btnAgain').onclick = () => { $('resultModal').classList.remove('on'); startBattle(); };
  $('btnToMenu').onclick = () => { $('resultModal').classList.remove('on'); B = null; show('menu'); };
}

async function loadUnits() {
  try {
    const r = await fetch('units.json', { cache: 'no-cache' });
    if (!r.ok) throw 0;
    const cfg = await r.json();
    for (const u of cfg.units || []) UNITS[u.id] = Object.assign({}, DEFAULT_UNITS[u.id] || {}, u);
  } catch (e) { /* используем встроенные параметры */ }
}

(async function init() {
  loadSave();
  await loadUnits();
  genScenery();
  resize();
  wireUi();
  show('menu');
  requestAnimationFrame(loop);
  window.__cb = { get B() { return B; }, save: () => save, startBattle };
})();
