// game.js — structural-collapse prototype
// Minimal grid-based castle model with 'support' blocks and cascade collapse logic.

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
  abilityName: 'Absorb'
};

function addLog(message) {
  const logContainer = document.getElementById('battleLogContainer');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = message;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
  if (logContainer.children.length > 30) logContainer.removeChild(logContainer.firstChild);
}

function showDamage(castleId, damage, type = 'damage') {
  const castle = document.getElementById(castleId);
  const damageEl = document.createElement('div');
  damageEl.className = `damage-number ${type === 'heal' ? 'damage-green' : 'damage-red'}`;
  damageEl.textContent = type === 'heal' ? `+${damage}` : `-${damage}`;
  damageEl.style.left = 50 + Math.random() * 60 + 'px';
  damageEl.style.top = 40 + Math.random() * 40 + 'px';
  castle.appendChild(damageEl);
  setTimeout(() => damageEl.remove(), 900);
}

// Build a lightweight grid model from the DOM castle block structure
function buildGridFromDOM(castleEl) {
  // floors: .floor-1 (top), .floor-2, .floor-3 (bottom)
  const floors = Array.from(castleEl.querySelectorAll('.castle-floor'));
  // Sort floors by top to bottom order in DOM (they are already in that order)
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
  // Simple patterns; default -> mark middle column as supports
  if (pattern === 'middle-column') {
    const mid = Math.floor(grid.cols / 2);
    for (let r = 0; r < grid.rows; r++) {
      const cell = grid.cells[r][mid];
      if (cell && cell.type === 'block') {
        cell.type = 'support';
        cell.hp = 2; // supports are harder
        cell.el.classList.add('support');
        cell.el.title = 'Support - hit to collapse the section';
      }
    }
  }
}

function initGame() {
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

  // Add click-to-target functionality on enemy blocks (optional)
  for (let r = 0; r < gameState.enemyGrid.rows; r++) {
    for (let c = 0; c < gameState.enemyGrid.cols; c++) {
      const cell = gameState.enemyGrid.cells[r][c];
      if (cell && cell.el) {
        cell.el.style.cursor = 'pointer';
        cell.el.addEventListener('click', () => {
          if (!gameState.gameRunning) return;
          addLog(`🔎 Вы стреляете в блок [r:${r} c:${c}]`);
          hitBlock('enemy', r, c, 80);
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

  addLog('🎮 Игра начинается! (demo: supports highlighted)');
  updateUI();
}

function playerAttack() {
  if (!gameState.gameRunning) return;
  // Prefer to hit a support block if exists
  const target = findPriorityTarget(gameState.enemyGrid);
  if (!target) {
    addLog('⚠️ Нечего бить!');
    return;
  }
  addLog(`⚔️ Вы атакуете блок r:${target.r} c:${target.c}`);
  hitBlock('enemy', target.r, target.c, 80);
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
  // First search for supports (highest priority), else any block
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
  }

  updateUI();
}

function destroyBlock(grid, r, c, which) {
  const cell = grid.cells[r][c];
  if (!cell || cell.type === 'empty') return;
  // Visual
  if (cell.el) cell.el.classList.add('destroyed');
  cell.type = 'empty';
  cell.hp = 0;

  addLog(`💥 Блок разрушен в колонке c:${c} (r:${r}) — проверяем опоры...`);

  // If destroyed block was support, trigger cascade collapse of that column
  if (cell.el && cell.el.classList.contains('support')) {
    addLog('⚠️ Опора сброшена — запускаем цепной обвал столбца');
    cascadeCollapse(grid, c, which);
  }
}

function cascadeCollapse(grid, colIndex, which) {
  // Simple rule: remove all remaining blocks in the same column (simulate that the floor lost support)
  let removed = 0;
  for (let r = 0; r < grid.rows; r++) {
    const cell = grid.cells[r][colIndex];
    if (cell && cell.type !== 'empty') {
      if (cell.el) cell.el.classList.add('destroyed');
      cell.type = 'empty';
      cell.hp = 0;
      removed++;
    }
  }
  // Apply additional castle HP damage proportional to removed blocks
  const extraDamage = removed * 15; // tuning parameter
  if (which === 'enemy') {
    gameState.enemyHP = Math.max(0, gameState.enemyHP - extraDamage);
    showDamage('enemyCastle', extraDamage);
  } else {
    gameState.playerHP = Math.max(0, gameState.playerHP - extraDamage);
    showDamage('playerCastle', extraDamage);
  }
  addLog(`🏚️ Обвал уничтожил ${removed} блок(ов) в колонке ${colIndex}, доп. урон ${extraDamage}`);
  updateUI();
}

function aiTurn() {
  if (!gameState.gameRunning) return;
  // AI prefers to hit player's supports first
  const target = findPriorityTarget(gameState.playerGrid);
  if (!target) return;
  const damage = Math.floor(Math.random() * 60) + 40;
  addLog(`🤖 Враг целится в r:${target.r} c:${target.c} (приоритетная опора/блок)`);
  hitBlock('player', target.r, target.c, damage);
}

function updateUI() {
  const playerPercent = (gameState.playerHP / gameState.playerMaxHP) * 100;
  const enemyPercent = (gameState.enemyHP / gameState.enemyMaxHP) * 100;
  document.getElementById('playerHealthBar').style.width = Math.max(0, playerPercent) + '%';
  document.getElementById('enemyHealthBar').style.width = Math.max(0, enemyPercent) + '%';
  document.getElementById('playerHP').textContent = Math.max(0, gameState.playerHP);
  document.getElementById('enemyHP').textContent = Math.max(0, gameState.enemyHP);

  if (gameState.playerHP <= 0 && gameState.gameRunning) {
    addLog('💀 ПОРАЖЕНИЕ! Ваш замок рухнул.');
    gameState.gameRunning = false;
  }
  if (gameState.enemyHP <= 0 && gameState.gameRunning) {
    addLog('🏆 ПОБЕДА! Враг уничтожен.');
    gameState.gameRunning = false;
  }
}

function startRoundTimer() {
  const timerInterval = setInterval(() => {
    if (!gameState.gameRunning) return;
    gameState.roundTime--;
    document.getElementById('roundTimer').textContent = gameState.roundTime;
    if (gameState.roundTime <= 0) {
      gameState.round++;
      gameState.roundTime = 60;
      addLog(`⏱️ Раунд ${gameState.round} начинается!`);
    }
  }, 1000);
}
