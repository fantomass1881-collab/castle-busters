// game.js — structural-collapse prototype (raycast + animated collapse)
// Extended: loads units configuration from units.json and adds Restart button handler (MVP)

document.addEventListener('DOMContentLoaded', () => {
  initGame();
});

const gameState = {
  playerHP: 1000,
  playerMaxHP: 1000,
  enemyHP: 1000,
  enemyMaxHP: 1000,
  round: 1,
  roundTime: 60,
  gameRunning: true,
  playerGrid: null, // {rows,cols,cells}
  enemyGrid: null,
  playerAbilityReady: true,
  abilityName: 'Absorb',
  lineMode: false,
  unitParams: {}, // loaded from units.json
  defaultPlayerUnit: 'wrecker'
};

function addLog(message) {
  const logContainer = document.getElementById('battleLogContainer');
  if (!logContainer) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = message;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
  if (logContainer.children.length > 60) logContainer.removeChild(logContainer.firstChild);
}

function showDamage(castleId, damage, type = 'damage') {
  const castle = document.getElementById(castleId);
  if (!castle) return;
  const damageEl = document.createElement('div');
  damageEl.className = `damage-number ${type === 'heal' ? 'damage-green' : 'damage-red'}`;
  damageEl.textContent = type === 'heal' ? `+${damage}` : `-${damage}`;
  damageEl.style.left = 50 + Math.random() * 60 + 'px';
  damageEl.style.top = 40 + Math.random() * 40 + 'px';
  castle.appendChild(damageEl);
  setTimeout(() => damageEl.remove(), 1200);
}

// Load units configuration (units.json)
function loadUnitsConfig() {
  return fetch('units.json')
    .then(r => {
      if (!r.ok) throw new Error('units.json not found');
      return r.json();
    })
    .then(cfg => {
      if (cfg && Array.isArray(cfg.units)) {
        gameState.unitParams = {};
        for (const u of cfg.units) gameState.unitParams[u.id] = u;
        console.log('Units config loaded:', gameState.unitParams);
      } else console.warn('units.json has unexpected format');
    })
    .catch(err => {
      console.warn('Could not load units.json, using defaults. Error:', err);
    });
}

// Build a lightweight grid model from the DOM castle block structure
function buildGridFromDOM(castleEl) {
  const floors = Array.from(castleEl.querySelectorAll('.castle-floor'));
  const rows = floors.length;
  const cols = Math.max(...floors.map(f => f.querySelectorAll('.castle-block').length));

  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  for (let r = 0; r < rows; r++) {
    const blocks = Array.from(floors[r].querySelectorAll('.castle-block'));
    for (let c = 0; c < cols; c++) {
      const el = blocks[c] || null;
      if (el) {
        cells[r][c] = {
          el,
          type: 'block', // might change to 'support'
          hp: 1,
          r,
          c
        };
      } else {
        cells[r][c] = {
          el: null,
          type: 'empty',
          hp: 0,
          r,
          c
        };
      }
    }
  }

  return { rows, cols, cells };
}

function markSupportsForDemo(grid, pattern = 'middle-column') {
  if (pattern === 'middle-column') {
    const mid = Math.floor(grid.cols / 2);
    for (let r = 0; r < grid.rows; r++) {
      const cell = grid.cells[r][mid];
      if (cell && cell.type === 'block') {
        cell.type = 'support';
        cell.hp = 2; // supports are harder
        if (cell.el) cell.el.classList.add('support');
        if (cell.el) cell.el.title = 'Support - hit to collapse the section';
      }
    }
  }
}

function initGame() {
  // Load units config first, then initialize
  loadUnitsConfig().then(() => {
    const playerCastle = document.getElementById('playerCastle');
    const enemyCastle = document.getElementById('enemyCastle');

    gameState.playerGrid = buildGridFromDOM(playerCastle);
    gameState.enemyGrid = buildGridFromDOM(enemyCastle);

    // Mark supports for demo on both castles
    markSupportsForDemo(gameState.playerGrid);
    markSupportsForDemo(gameState.enemyGrid);

    // Hook up controls
    document.getElementById('attackBtn').addEventListener('click', playerAttack);
    document.getElementById('abilityBtn').addEventListener('click', playerAbility);
    document.getElementById('forwardBtn').addEventListener('click', () => addLog('→ Замок движется вперед!'));
    document.getElementById('backBtn').addEventListener('click', () => addLog('← Замок движется назад!'));
    const lineBtn = document.getElementById('lineBtn');
    if (lineBtn) lineBtn.addEventListener('click', toggleLineMode);

    // Restart button (added in index.html)
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) restartBtn.addEventListener('click', () => {
      // Simple safe restart: reload page to ensure full state reset
      location.reload();
    });

    // Add click-to-target functionality on enemy blocks
    for (let r = 0; r < gameState.enemyGrid.rows; r++) {
      for (let c = 0; c < gameState.enemyGrid.cols; c++) {
        const cell = gameState.enemyGrid.cells[r][c];
        if (cell && cell.el) {
          cell.el.style.cursor = 'pointer';
          cell.el.addEventListener('click', () => {
            if (!gameState.gameRunning) return;
            if (gameState.lineMode) {
              // Plan line from player's bottom center to clicked cell
              const start = { r: gameState.enemyGrid.rows - 1, c: Math.floor(gameState.enemyGrid.cols / 2) };
              const path = bresenhamLine(start.r, start.c, r, c);
              const cost = computeLineCost(gameState.enemyGrid, path);
              previewLine(gameState.enemyGrid, path);
              addLog(`📏 Линия: цель r:${r} c:${c}, стоимость = ${cost} (supports cost more)`);
              // Fire after short delay to let player see preview
              setTimeout(() => {
                fireLine(gameState.enemyGrid, path);
              }, 600);
            } else {
              addLog(`🔎 Вы стреляете в блок [r:${r} c:${c}]`);
              // Use configured default unit damage if available
              const defaultUnit = gameState.unitParams[gameState.defaultPlayerUnit];
              const dmg = defaultUnit && defaultUnit.damage ? defaultUnit.damage : 80;
              hitBlock('enemy', r, c, dmg);
            }
          });
        }
      }
    }

    // Start AI loop
    setInterval(() => {
      if (gameState.gameRunning) aiTurn();
    }, 4000);

    // Round timer
    startRoundTimer();

    addLog('🎮 Игра начинается! (demo: supports highlighted). Нажмите LINE FIRE для режима линий.');
    updateUI();
  });
}

function toggleLineMode() {
  gameState.lineMode = !gameState.lineMode;
  addLog(gameState.lineMode ? '🎯 Режим LINE FIRE включён' : '❌ Режим LINE FIRE выключен');
}

function playerAttack() {
  if (!gameState.gameRunning) return;
  const target = findPriorityTarget(gameState.enemyGrid);
  if (!target) {
    addLog('⚠️ Нечего бить!');
    return;
  }
  // Use configured default unit damage if available
  const defaultUnit = gameState.unitParams[gameState.defaultPlayerUnit];
  const dmg = defaultUnit && defaultUnit.damage ? defaultUnit.damage : 80;
  addLog(`⚔️ Вы атакуете блок r:${target.r} c:${target.c}`);
  hitBlock('enemy', target.r, target.c, dmg);
}

function playerAbility() {
  if (!gameState.gameRunning) return;
  if (!gameState.playerAbilityReady) {
    addLog('⚠️ Способность на перезарядке');
    return;
  }
  addLog(`✨ Активирована способность ${gameState.abilityName} — следующий удар будет поглощён (демо)`);
  gameState.playerAbilityReady = false;
  setTimeout(() => { gameState.playerAbilityReady = true; addLog('✨ Способность готова'); }, 5000);
}

function findPriorityTarget(grid) {
  // First search for supports (highest priority), else any block (bottom-up)
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];
      if (cell && cell.type === 'support') return cell;
    }
  }
  for (let r = grid.rows - 1; r >= 0; r--) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];
      if (cell && cell.type === 'block') return cell;
    }
  }
  return null;
}

function hitBlock(which, r, c, damage) {
  const grid = which === 'player' ? gameState.playerGrid : gameState.enemyGrid;
  const cell = grid.cells[r][c];
  if (!cell || cell.type === 'empty') return;

  // Damage converts into HP reduction for castle
  const castleDamage = Math.max(1, Math.floor(damage / 10));
  if (which === 'enemy') {
    gameState.enemyHP = Math.max(0, gameState.enemyHP - castleDamage);
    showDamage('enemyCastle', castleDamage);
  } else {
    gameState.playerHP = Math.max(0, gameState.playerHP - castleDamage);
    showDamage('playerCastle', castleDamage);
  }

  // Reduce block HP
  cell.hp -= 1;
  addLog(`🧱 Блок [${which}] r:${r} c:${c} получил удар (hp -> ${cell.hp})`);
  if (cell.hp <= 0) {
    destroyBlock(grid, r, c, which);
    // After a block is destroyed, recompute supports and collapse unsupported parts
    // Use a tiny delay to let destruction animation play
    setTimeout(() => collapseUnsupported(grid, which), 80);
  }

  updateUI();
}

function destroyBlock(grid, r, c, which) {
  const cell = grid.cells[r][c];
  if (!cell || cell.type === 'empty') return;
  if (cell.el) cell.el.classList.add('destroyed');
  cell.type = 'empty';
  cell.hp = 0;
  addLog(`💥 Блок разрушен в колонке c:${c} (r:${r})`);
}

// Bresenham line algorithm for grid coordinates (r,c)
function bresenhamLine(r0, c0, r1, c1) {
  const points = [];
  let dr = Math.abs(r1 - r0);
  let dc = Math.abs(c1 - c0);
  let sr = r0 < r1 ? 1 : -1;
  let sc = c0 < c1 ? 1 : -1;
  let err = (dr > dc ? dr : -dc) / 2;
  let e2;
  let r = r0, c = c0;
  while (true) {
    points.push({ r, c });
    if (r === r1 && c === c1) break;
    e2 = err;
    if (e2 > -dr) { err -= dc; r += sr; }
    if (e2 < dc) { err += dr; c += sc; }
  }
  return points;
}

function computeLineCost(grid, path) {
  // supports cost 5, blocks cost 1, empty cost 0
  let cost = 0;
  for (const p of path) {
    if (p.r < 0 || p.r >= grid.rows || p.c < 0 || p.c >= grid.cols) continue;
    const cell = grid.cells[p.r][p.c];
    if (!cell) continue;
    if (cell.type === 'support') cost += 5;
    else if (cell.type === 'block') cost += 1;
  }
  return cost;
}

function previewLine(grid, path, duration = 600) {
  // Add highlight class to path cells
  for (const p of path) {
    if (p.r < 0 || p.r >= grid.rows || p.c < 0 || p.c >= grid.cols) continue;
    const cell = grid.cells[p.r][p.c];
    if (cell && cell.el) cell.el.classList.add('highlight');
  }
  setTimeout(() => {
    for (const p of path) {
      if (p.r < 0 || p.r >= grid.rows || p.c < 0 || p.c >= grid.cols) continue;
      const cell = grid.cells[p.r][p.c];
      if (cell && cell.el) cell.el.classList.remove('highlight');
    }
  }, duration);
}

function fireLine(grid, path) {
  // Damage profile: supports get 2 hits, blocks 1 hit
  const toDestroy = [];
  for (const p of path) {
    if (p.r < 0 || p.r >= grid.rows || p.c < 0 || p.c >= grid.cols) continue;
    const cell = grid.cells[p.r][p.c];
    if (!cell || cell.type === 'empty') continue;
    const damage = cell.type === 'support' ? 2 : 1;
    cell.hp -= damage;
    addLog(`🔥 Линия наносит ${damage} урона блоку r:${p.r} c:${p.c} (hp -> ${cell.hp})`);
    if (cell.hp <= 0) toDestroy.push({ r: p.r, c: p.c });
  }

  if (toDestroy.length > 0) {
    animateDestruction(grid, toDestroy, () => {
      // after animation, recompute supports and collapse
      collapseUnsupported(grid, 'enemy');
    });
  } else {
    // no immediate destroy, still recompute in case hp changed
    setTimeout(() => collapseUnsupported(grid, 'enemy'), 120);
  }
  updateUI();
}

function animateDestruction(grid, coords, callback) {
  // Staggered removal for visual clarity
  coords.sort((a,b)=> a.r - b.r || a.c - b.c);
  let i = 0;
  function step() {
    if (i >= coords.length) {
      if (callback) callback();
      return;
    }
    const p = coords[i];
    const cell = grid.cells[p.r][p.c];
    if (cell && cell.el) {
      cell.el.classList.add('destroyed');
      cell.type = 'empty';
      cell.hp = 0;
    }
    i++;
    setTimeout(step, 90); // stagger interval
  }
  step();
}

function recomputeSupported(grid) {
  const rows = grid.rows;
  const cols = grid.cols;
  const supported = Array.from({ length: rows }, () => Array(cols).fill(false));

  // Bottom row blocks are supported by ground if present
  for (let c = 0; c < cols; c++) {
    const cell = grid.cells[rows - 1][c];
    if (cell && cell.type !== 'empty') supported[rows - 1][c] = true;
  }

  // Propagate support upward: a block is supported if any of the three blocks beneath it is supported
  for (let r = rows - 2; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const cell = grid.cells[r][c];
      if (!cell || cell.type === 'empty') continue;

      let belowSupported = false;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        if (nc < 0 || nc >= cols) continue;
        const belowCell = grid.cells[r + 1][nc];
        if (belowCell && belowCell.type !== 'empty' && supported[r + 1][nc]) {
          belowSupported = true;
          break;
        }
      }

      if (belowSupported) supported[r][c] = true;
    }
  }

  return supported;
}

function collapseUnsupported(grid, which) {
  const supported = recomputeSupported(grid);
  const toRemove = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];
      if (cell && cell.type !== 'empty' && !supported[r][c]) {
        toRemove.push({ r, c });
      }
    }
  }

  if (toRemove.length === 0) return;

  // Animate removal and apply extra damage after sequence
  animateDestruction(grid, toRemove, () => {
    const extraDamage = toRemove.length * 12; // tuning
    if (which === 'enemy') {
      gameState.enemyHP = Math.max(0, gameState.enemyHP - extraDamage);
      showDamage('enemyCastle', extraDamage);
    } else {
      gameState.playerHP = Math.max(0, gameState.playerHP - extraDamage);
      showDamage('playerCastle', extraDamage);
    }
    addLog(`🏚️ Обвал уничтожил ${toRemove.length} блок(ов), доп. урон ${extraDamage}`);
    updateUI();
  });
}

function aiTurn() {
  if (!gameState.gameRunning) return;
  const target = findPriorityTarget(gameState.playerGrid);
  if (!target) return;
  const damage = Math.floor(Math.random() * 60) + 40;
  addLog(`🤖 Враг целится в r:${target.r} c:${target.c} (приоритетная опора/блок)`);
  hitBlock('player', target.r, target.c, damage);
}

function updateUI() {
  const playerPercent = (gameState.playerHP / gameState.playerMaxHP) * 100;
  const enemyPercent = (gameState.enemyHP / gameState.enemyMaxHP) * 100;
  const phb = document.getElementById('playerHealthBar');
  const ehb = document.getElementById('enemyHealthBar');
  const php = document.getElementById('playerHP');
  const ehp = document.getElementById('enemyHP');
  if (phb) phb.style.width = Math.max(0, playerPercent) + '%';
  if (ehb) ehb.style.width = Math.max(0, enemyPercent) + '%';
  if (php) php.textContent = Math.max(0, gameState.playerHP);
  if (ehp) ehp.textContent = Math.max(0, gameState.enemyHP);

  if (gameState.playerHP <= 0 && gameState.gameRunning) {
    addLog('💀 ПОРАЖЕНИЕ! Ваш замок рухнул.');
    gameState.gameRunning = false;
    // Show defeat modal (simple alert for MVP - will replace with nice modal later)
    setTimeout(() => { if (confirm('Вы проиграли. Перезапустить?')) location.reload(); }, 200);
  }
  if (gameState.enemyHP <= 0 && gameState.gameRunning) {
    addLog('🏆 ПОБЕДА! Враг уничтожен.');
    gameState.gameRunning = false;
    setTimeout(() => { if (confirm('Вы победили! Перезапустить?')) location.reload(); }, 200);
  }
}

function startRoundTimer() {
  const timerInterval = setInterval(() => {
    if (!gameState.gameRunning) return;
    gameState.roundTime--;
    const rt = document.getElementById('roundTimer');
    if (rt) rt.textContent = gameState.roundTime;
    if (gameState.roundTime <= 0) {
      gameState.round++;
      gameState.roundTime = 60;
      addLog(`⏱️ Раунд ${gameState.round} начинается!`);
    }
  }, 1000);
}
