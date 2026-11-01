// Battle engine: castles, destructible blocks, structural collapse, projectiles, turns, AI, camera
window.CB = window.CB || {};
CB.Battle = (function () {
  const W = CB.WORLD;
  const S = W.cell;
  const groundY = CB.Art.makeGround(W);
  const HULL = 46; // hull + treads height under castle
  const MAX_SPAN = 4;
  const DT = 1 / 120;

  const BASE_HP = { '#': 3, W: 2.5, '=': 2, R: 2, T: 3, M: 2 };

  // ---------------- Castle ----------------
  class Castle {
    constructor(team, x, blueprint, facing, upg) {
      this.team = team; this.x = x; this.baseX = x; this.facing = facing; this.S = S;
      this.rows = blueprint.length; this.cols = blueprint[0].length;
      this.grid = []; this.slots = []; this.burning = []; this.units = [];
      this.shake = 0; this.roll = 0; this.needsSupport = false; this.supportDelay = 0;
      const wallMul = 1 + 0.12 * ((upg.walls || 1) - 1);
      const towMul = 1 + 0.15 * ((upg.towers || 1) - 1);
      this.armor = Math.min(0.4, 0.04 * ((upg.armor || 1) - 1));
      let total = 0;
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          // enemy castle is mirrored so its windows face the player
          const ch = blueprint[r][facing === 1 ? c : this.cols - 1 - c];
          const solid = !!CB.Art.SOLID[ch];
          const mul = (ch === 'R' || ch === 'T' || ch === 'M') ? towMul : wallMul;
          const hp = solid ? BASE_HP[ch] * mul : 0;
          total += hp;
          const cell = { k: ch, solid, origSolid: solid, room: ch === 'r' || ch === 'S', hp, maxhp: hp || 1, visibleBg: false };
          row.push(cell);
          if (ch === 'S') this.slots.push({ r, c });
        }
        this.grid.push(row);
      }
      this.totalHp = total;
      // flag on top-most roof cell nearest the centre
      let best = null;
      for (let r = 0; r < this.rows && !best; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c].k === 'R') { if (!best || Math.abs(c - this.cols / 2) < Math.abs(best.c - this.cols / 2)) best = { r, c }; }
      this.flagCell = best;
      this.updateRoomBg();
    }
    bottom() { return W.groundY - HULL; }
    left() { return this.x - this.cols * S / 2; }
    top() { return this.bottom() - this.rows * S; }
    cellAt(wx, wy) {
      const c = Math.floor((wx - this.left()) / S), r = Math.floor((wy - this.top()) / S);
      if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
      return { r, c, cell: this.grid[r][c] };
    }
    cellCenter(r, c) { return { x: this.left() + c * S + S / 2, y: this.top() + r * S + S / 2 }; }
    solidAtLocal(lx, ly) {
      const c = Math.floor(lx / S), r = Math.floor(ly / S);
      if (r < 0 || c < 0 || c >= this.cols) return false;
      if (r >= this.rows) return true; // hull
      return this.grid[r][c].solid;
    }
    hpFrac() {
      let s = 0;
      for (const row of this.grid) for (const cell of row) if (cell.solid) s += Math.max(0, cell.hp);
      return Math.max(0, Math.min(1, s / this.totalHp));
    }
    updateRoomBg() {
      for (let r = this.rows - 1; r >= 0; r--) for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.room) { cell.visibleBg = false; continue; }
        const below = r + 1 < this.rows ? this.grid[r + 1][c] : null;
        cell.visibleBg = !below || below.solid || (below.room && below.visibleBg);
      }
    }
    // 0-1 BFS: vertical stacking keeps distance, sideways/hanging adds 1. Cells beyond MAX_SPAN are unsupported.
    findUnsupported() {
      const R = this.rows, C = this.cols, G = this.grid;
      const dist = Array.from({ length: R }, () => new Array(C).fill(Infinity));
      const dq = [];
      for (let c = 0; c < C; c++) if (G[R - 1][c].solid) { dist[R - 1][c] = 0; dq.push([R - 1, c]); }
      let head = 0;
      const front = [];
      while (head < dq.length || front.length) {
        const [r, c] = front.length ? front.pop() : dq[head++];
        const d = dist[r][c];
        const nb = [[r - 1, c, 0], [r, c - 1, 1], [r, c + 1, 1], [r + 1, c, 1]];
        for (const [nr, nc, w] of nb) {
          if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
          if (!G[nr][nc].solid) continue;
          const nd = d + w;
          if (nd < dist[nr][nc] && nd <= MAX_SPAN) {
            dist[nr][nc] = nd;
            if (w === 0) front.push([nr, nc]); else dq.push([nr, nc]);
          }
        }
      }
      const out = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (G[r][c].solid && dist[r][c] === Infinity) out.push({ r, c });
      return out;
    }
    destroyedCount() {
      let n = 0;
      for (const row of this.grid) for (const cell of row) if (cell.origSolid && !cell.solid) n++;
      return n;
    }
  }

  // ---------------- Unit ----------------
  class Unit {
    constructor(id, level, castle, slot, idx) {
      this.id = id; this.stats = CB.unitStats(id, level); this.castle = castle; this.idx = idx;
      this.maxhp = this.stats.hp; this.hp = this.maxhp; this.alive = true; this.cdLeft = 0;
      this.lx = slot.c * S + S / 2; this.ly = (slot.r + 1) * S; this.vy = 0; this.falling = false; this.fallStart = 0;
      this.burn = 0; this.flash = 0; this.team = castle.team;
    }
    get x() { return this.castle.left() + this.lx; }
    get y() { return this.castle.top() + this.ly; }
    center() { return { x: this.x, y: this.y - 12 }; }
  }

  // ---------------- State ----------------
  let B = null;
  let canvas, ctx, view = { w: 0, h: 0, dpr: 1, top: 96, bottom: 130 };
  let hooks = {};

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  function setup(cv, h) {
    canvas = cv; ctx = canvas.getContext('2d'); hooks = h || {};
    window.addEventListener('resize', resize); resize();
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (B && !B.paused && !window.__manualTime) update(dt);
      if (B) render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function resize() {
    if (!canvas) return;
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = canvas.clientWidth || window.innerWidth; view.h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr); canvas.height = Math.round(view.h * view.dpr);
  }
  function setInsets(top, bottom) { view.top = top; view.bottom = bottom; }

  // Build units for a side and place them into castle slots
  function placeUnits(castle, deck) {
    const slots = castle.slots.slice();
    // fill lower rooms first (realistic: tower slots last), with a bit of shuffle
    slots.sort((a, b) => (b.r - a.r) + (Math.random() - 0.5) * 6);
    castle.units = deck.slice(0, slots.length).map((d, i) => new Unit(d.id, d.level, castle, slots[i], i));
  }

  function start(cfg) {
    const pc = new Castle('blue', W.leftX - 520, CB.BLUEPRINTS[cfg.playerBlueprint || 0], 1, cfg.playerCastle);
    const ec = new Castle('red', W.rightX + 520, CB.BLUEPRINTS[cfg.enemyBlueprint || 0], -1, cfg.enemyCastle);
    placeUnits(pc, cfg.playerDeck); placeUnits(ec, cfg.enemyDeck);
    B = {
      cfg, arena: cfg.arena, t: 0, round: 1, turn: 'player', phase: 'intro', phaseT: 0,
      castles: { player: pc, enemy: ec },
      projectiles: [], particles: [], debris: [], floaters: [],
      wind: 0, timer: W.turnTime, selected: null, aim: null, aiAim: null,
      cam: { x: 550, y: 380, z: 0.5 }, camFocus: null, focusT: 0, shake: 0,
      settleT: 0, onResolved: null, over: false, result: null, lastImpact: null, acc: 0,
      stats: { shots: 0, kills: 0, blocks: 0 }, paused: false,
    };
    const ov = overview(); B.cam.x = ov.x; B.cam.y = ov.y; B.cam.z = ov.z;
    hooks.onHud && hooks.onHud();
  }

  // --------------- Camera ---------------
  function freeArea() { return { w: view.w, h: Math.max(120, view.h - view.top - view.bottom) }; }
  function overview() {
    const pc = B.castles.player, ec = B.castles.enemy;
    const x0 = Math.min(pc.x, W.leftX) - 125, x1 = Math.max(ec.x, W.rightX) + 125;
    const y0 = Math.min(pc.top(), ec.top()) - 150, y1 = W.groundY + 60;
    const fa = freeArea();
    const z = Math.min(fa.w / (x1 - x0), fa.h / (y1 - y0));
    const vis = fa.h / z;
    // anchor to bottom so extra space goes to sky
    return { x: (x0 + x1) / 2, y: y1 - vis / 2, z };
  }
  function w2s(wx, wy) {
    const fa = freeArea();
    return { x: view.w / 2 + (wx - B.cam.x) * B.cam.z, y: view.top + fa.h / 2 + (wy - B.cam.y) * B.cam.z };
  }
  function s2w(sx, sy) {
    const fa = freeArea();
    return { x: B.cam.x + (sx - view.w / 2) / B.cam.z, y: B.cam.y + (sy - view.top - fa.h / 2) / B.cam.z };
  }
  function updateCamera(dt) {
    const ov = overview();
    let tx = ov.x, ty = ov.y, tz = ov.z;
    const fa = freeArea();
    if (B.projectiles.length && B.phase === 'flying') {
      let mx = 0, my = 0; for (const p of B.projectiles) { mx += p.x; my += p.y; } mx /= B.projectiles.length; my /= B.projectiles.length;
      tz = Math.min(ov.z * 1.35, 1.8); tx = mx; ty = my;
    } else if (B.camFocus && B.focusT > 0) {
      tz = Math.min(ov.z * 1.25, 1.7); tx = B.camFocus.x; ty = B.camFocus.y - 40;
    }
    // keep the ground near the bottom of the view and never show too far
    const maxY = W.groundY + 70 - fa.h / 2 / tz;
    ty = Math.min(ty, maxY);
    const halfW = fa.w / 2 / tz;
    tx = Math.max(W.leftX - 260 + halfW, Math.min(W.rightX + 260 - halfW, tx));
    if (halfW * 2 > (W.rightX - W.leftX + 520)) tx = ov.x;
    const k = Math.min(1, dt * 3.2);
    B.cam.x += (tx - B.cam.x) * k; B.cam.y += (ty - B.cam.y) * k; B.cam.z += (tz - B.cam.z) * k;
  }

  // --------------- Input (drag to aim) ---------------
  function canAim() { return B && !B.over && !B.paused && B.phase === 'playerAim' && B.selected && B.selected.alive && !B.selected.stats.support; }
  function onDown(e) {
    if (!canAim()) return;
    B.aim = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    hooks.onAimStart && hooks.onAimStart();
  }
  function onMove(e) {
    if (!B || !B.aim || e.pointerId !== B.aim.id) return;
    B.aim.cx = e.clientX; B.aim.cy = e.clientY;
  }
  function onUp(e) {
    if (!B || !B.aim || e.pointerId !== B.aim.id) return;
    const v = aimVelocity();
    B.aim = null;
    if (v && canAim()) fire('player', B.selected, v.vx, v.vy);
    hooks.onAimEnd && hooks.onAimEnd();
  }
  const MAX_PULL = 150;
  function aimVelocity() {
    if (!B.aim) return null;
    const dx = B.aim.sx - B.aim.cx, dy = B.aim.sy - B.aim.cy;
    const len = Math.hypot(dx, dy);
    const power = Math.min(1, len / MAX_PULL);
    if (power < 0.1) return null;
    const p = B.selected.stats.proj;
    const sp = (W.vMin + power * (W.vMax - W.vMin)) * (p.speedMul || 1);
    return { vx: dx / len * sp, vy: dy / len * sp, power };
  }

  // --------------- Turns ---------------
  function sideUnits(side) { return B.castles[side].units; }
  function available(side) { return sideUnits(side).filter((u) => u.alive && u.cdLeft <= 0); }
  function opp(side) { return side === 'player' ? 'enemy' : 'player'; }

  function banner(text, sub, ms) { hooks.onBanner && hooks.onBanner(text, sub, ms); }

  function beginTurn(side) {
    B.turn = side;
    if (side === 'player') {
      // round start effects
      if (B.round > 1 || B.roundEffectsPending) applyRoundEffects();
    }
    for (const u of sideUnits(side)) if (u.cdLeft > 0) u.cdLeft--;
    B.wind = B.arena.wind ? Math.round(rnd(-B.arena.wind, B.arena.wind)) : 0;
    hooks.onHud && hooks.onHud();
    const hazard = side === 'player' && B.round > 1 ? spawnHazard() : false;
    const go = () => {
      if (checkEnd()) return;
      const av = available(side);
      if (!av.length) {
        banner(side === 'player' ? 'Все юниты перезаряжаются' : 'Соперник пропускает ход', '', 1300);
        B.phase = 'wait'; B.phaseT = 1.4; B.afterWait = () => endTurn();
        return;
      }
      if (side === 'player') {
        B.phase = 'playerAim'; B.timer = W.turnTime;
        if (!B.selected || !B.selected.alive || B.selected.cdLeft > 0) B.selected = av.find((u) => !u.stats.support) || av[0];
        banner('Ваш ход', B.wind ? windText() : 'Раунд ' + B.round, 1100);
      } else {
        B.phase = 'aiThink'; B.phaseT = rnd(0.7, 1.2);
        banner('Ход соперника', B.wind ? windText() : '', 1000);
      }
      hooks.onHud && hooks.onHud();
    };
    if (hazard) { B.phase = 'flying'; B.onResolved = go; banner('Опасность арены', B.arena.hazardText, 1300); }
    else go();
  }
  function windText() { return 'Ветер ' + (B.wind > 0 ? '→ ' : '← ') + Math.abs(B.wind); }

  function applyRoundEffects() {
    for (const side of ['player', 'enemy']) {
      const c = B.castles[side];
      if (c.burning.length) {
        for (const b of c.burning) { if (c.grid[b.r][b.c].solid) damageCell(c, b.r, b.c, 0.8, true); b.turns--; }
        c.burning = c.burning.filter((b) => b.turns > 0 && c.grid[b.r][b.c].solid);
        c.needsSupport = true; c.supportDelay = 0.2;
      }
      for (const u of c.units) if (u.alive && u.burn > 0) { hurtUnit(u, 9, '#ff8a2a'); u.burn--; }
    }
  }

  function spawnHazard() {
    const h = B.arena.hazard;
    if (h === 'rocks' && Math.random() < 0.75) {
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const tgt = Math.random() < 0.5 ? B.castles.player : B.castles.enemy;
        B.projectiles.push(makeProj({ kind: 'rock', grav: 1, r: 26, block: 2.5, unit: 22, size: 10 }, tgt.x + rnd(-70, 70), -200 - i * 120, rnd(-30, 30), 120, 'hazard'));
      }
      return true;
    }
    if (h === 'lava' && Math.random() < 0.8) {
      for (let i = 0; i < 2; i++) {
        const tgt = i === 0 ? B.castles.player : B.castles.enemy;
        const sx = 550, sy = 240;
        const T = 1.6 + Math.random() * 0.3;
        const tx = tgt.x + rnd(-60, 60), ty = tgt.top() + rnd(40, 160);
        const vx = (tx - sx) / T, vy = (ty - sy - 0.5 * W.gravity * T * T) / T;
        B.projectiles.push(makeProj({ kind: 'lava', grav: 1, r: 30, block: 1.6, unit: 18, size: 7, burn: 2, burnR: 40 }, sx, sy, vx, vy, 'hazard'));
      }
      return true;
    }
    return false;
  }

  function endTurn() {
    if (checkEnd()) return;
    if (B.turn === 'player') beginTurn('enemy');
    else {
      if (B.round >= W.maxRounds) { finishByScore(); return; }
      B.round++;
      beginTurn('player');
    }
  }

  function checkEnd() {
    if (B.over) return true;
    const p = B.castles.player, e = B.castles.enemy;
    const pDead = !p.units.some((u) => u.alive) || p.hpFrac() <= 0.25;
    const eDead = !e.units.some((u) => u.alive) || e.hpFrac() <= 0.25;
    if (pDead || eDead) {
      let win = eDead && !pDead;
      if (pDead && eDead) win = e.hpFrac() < p.hpFrac();
      finish(win, eDead ? (e.units.some((u) => u.alive) ? 'Замок соперника рухнул!' : 'Все юниты соперника повержены!') : (p.units.some((u) => u.alive) ? 'Ваш замок рухнул' : 'Все ваши юниты повержены'));
      return true;
    }
    return false;
  }
  function finishByScore() {
    const p = B.castles.player.hpFrac(), e = B.castles.enemy.hpFrac();
    finish(p > e, 'Раунды закончились: ' + Math.round(p * 100) + '% против ' + Math.round(e * 100) + '%');
  }
  function finish(win, reason) {
    B.over = true; B.phase = 'over';
    B.result = { win, reason, playerPct: B.castles.player.hpFrac(), enemyPct: B.castles.enemy.hpFrac(), rounds: B.round, stats: B.stats };
    CB.Audio.play(win ? 'win' : 'lose'); CB.haptic(win ? 'success' : 'error');
    setTimeout(() => hooks.onEnd && hooks.onEnd(B.result), 1300);
  }

  // --------------- Firing ---------------
  function makeProj(spec, x, y, vx, vy, owner) {
    return Object.assign({}, spec, { x, y, vx, vy, owner, age: 0, trailT: 0, pierceLeft: spec.pierce || 0, touched: new Set(), dead: false, splitDone: false });
  }
  function muzzle(u) { const c = u.center(); return { x: c.x + u.castle.facing * 8, y: c.y - 4 }; }

  function fire(side, u, vx, vy) {
    B.aim = null; B.aiAim = null;
    u.cdLeft = u.stats.cd + 1;
    B.stats.shots += side === 'player' ? 1 : 0;
    CB.haptic('medium');
    if (u.stats.support) { doSupport(side, u); return; }
    const p = u.stats.proj; const m = muzzle(u);
    const count = p.count || 1;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * (p.spread || 0);
      const ang = Math.atan2(vy, vx) + off; const sp = Math.hypot(vx, vy) * (1 - Math.abs(off) * 0.6);
      B.projectiles.push(makeProj(p, m.x, m.y, Math.cos(ang) * sp, Math.sin(ang) * sp, side));
    }
    CB.Audio.play('launch');
    for (let i = 0; i < 8; i++) B.particles.push({ type: 'smoke', x: m.x, y: m.y, vx: vx * 0.05 + rnd(-30, 30), vy: vy * 0.05 + rnd(-30, 30), life: 0.6, max: 0.6, size: rnd(5, 9), color: 'rgba(240,240,240,' });
    B.phase = 'flying'; B.onResolved = endTurn;
    hooks.onHud && hooks.onHud();
  }

  function doSupport(side, u) {
    const c = B.castles[side];
    if (u.stats.support === 'heal') {
      CB.Audio.play('heal');
      for (const x of c.units) if (x.alive) {
        const amt = Math.min(u.stats.heal, x.maxhp - x.hp);
        x.hp += amt; x.burn = 0;
        if (amt > 0) floater(x.center().x, x.center().y - 14, '+' + Math.round(amt), '#5ad35a');
        for (let i = 0; i < 6; i++) B.particles.push({ type: 'heal', x: x.center().x + rnd(-8, 8), y: x.center().y + rnd(-8, 8), vx: 0, vy: rnd(-50, -25), life: 1, max: 1, size: 3 });
      }
      banner(u.stats.name + ' лечит отряд', '', 1000);
    } else if (u.stats.support === 'repair') {
      CB.Audio.play('repair');
      const n = repairCastle(c, u.stats.repair);
      banner(u.stats.name + ' чинит замок', n ? '+' + n + ' блоков' : 'Нечего чинить', 1000);
    }
    B.camFocus = { x: c.x, y: c.top() + c.rows * S / 2 }; B.focusT = 1.2;
    B.phase = 'settle'; B.settleT = 1.0; B.onResolved = endTurn;
    hooks.onHud && hooks.onHud();
  }

  function repairCastle(c, n) {
    let done = 0;
    for (let pass = 0; pass < 3 && done < n; pass++) {
      for (let r = c.rows - 1; r >= 0 && done < n; r--) for (let k = 0; k < c.cols && done < n; k++) {
        const cc = c.facing === 1 ? c.cols - 1 - k : k; // repair the side facing the enemy first
        const cell = c.grid[r][cc];
        if (!cell.origSolid || cell.solid) continue;
        const below = r === c.rows - 1 || c.grid[r + 1][cc].solid;
        const side = (cc > 0 && c.grid[r][cc - 1].solid) || (cc < c.cols - 1 && c.grid[r][cc + 1].solid);
        if (!below && !side) continue;
        const occupied = c.units.some((u) => u.alive && Math.floor(u.lx / S) === cc && (Math.floor((u.ly - 4) / S) === r || Math.floor((u.ly - 16) / S) === r));
        if (occupied) continue;
        cell.solid = true; cell.hp = cell.maxhp; done++;
        const p = c.cellCenter(r, cc);
        for (let i = 0; i < 5; i++) B.particles.push({ type: 'spark', x: p.x + rnd(-8, 8), y: p.y + rnd(-8, 8), vx: rnd(-40, 40), vy: rnd(-80, -20), life: 0.6, max: 0.6, size: 2, color: '#ffd34d' });
      }
    }
    c.updateRoomBg();
    return done;
  }

  // --------------- Simulation ---------------
  function stepProj(p, dt) {
    p.vx += B.wind * dt * (p.kind === 'orb' ? 0.3 : 1);
    p.vy += W.gravity * p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
  }

  function targetsFor(owner) {
    if (owner === 'hazard') return [B.castles.player, B.castles.enemy];
    return [B.castles[opp(owner)]];
  }

  function updateProjectiles(dt) {
    const spawned = [];
    for (const p of B.projectiles) {
      if (p.dead) continue;
      stepProj(p, dt);
      // trail
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.025;
        const col = p.kind === 'orb' ? 'rgba(180,140,255,' : (p.kind === 'fire' || p.kind === 'lava') ? 'rgba(255,150,60,' : 'rgba(70,70,85,';
        if (p.kind !== 'arrow' && p.kind !== 'pellet') B.particles.push({ type: 'smoke', x: p.x, y: p.y, vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.9, max: 0.9, size: p.kind === 'boulder' ? 6 : 4, color: col });
      }
      // cluster split at apex
      if (p.kind === 'cluster' && !p.splitDone && p.vy > 0 && p.age > 0.15) {
        p.splitDone = true; p.dead = true;
        const n = p.split || 4;
        for (let i = 0; i < n; i++) {
          const q = makeProj({ kind: 'bomblet', grav: 1, r: p.r, block: p.block, unit: p.unit, size: 5 }, p.x, p.y, p.vx + (i - (n - 1) / 2) * 60, p.vy * 0.5 + rnd(-20, 20), p.owner);
          spawned.push(q);
        }
        CB.Audio.play('hit');
        for (let i = 0; i < 10; i++) B.particles.push({ type: 'spark', x: p.x, y: p.y, vx: rnd(-120, 120), vy: rnd(-120, 60), life: 0.4, max: 0.4, size: 2.5, color: '#ffd34d' });
        continue;
      }
      // collisions
      let hit = false;
      for (const c of targetsFor(p.owner)) {
        const at = c.cellAt(p.x, p.y);
        if (at && at.cell.solid) {
          const key = c.team + at.r + ',' + at.c;
          if (p.touched.has(key)) continue;
          if (p.pierceLeft > 0) {
            p.touched.add(key); p.pierceLeft--;
            damageCell(c, at.r, at.c, p.pierceDmg || p.block);
            p.vx *= 0.9; p.vy *= 0.9;
            dust(p.x, p.y, 4);
            CB.Audio.play('hit');
            continue;
          }
          hit = true; break;
        }
        for (const u of c.units) {
          if (!u.alive) continue;
          const uc = u.center();
          if (Math.hypot(uc.x - p.x, uc.y - p.y) < 9 + p.size * 0.6) { hit = true; break; }
        }
        if (hit) break;
      }
      if (!hit && p.y >= groundY(p.x)) hit = true;
      if (!hit && p.kind === 'orb' && p.age > 3.5) hit = true;
      if (hit) { explode(p); p.dead = true; continue; }
      if (p.x < -700 || p.x > 1800 || p.y > 1400) p.dead = true;
    }
    B.projectiles = B.projectiles.filter((p) => !p.dead).concat(spawned);
  }

  function damageCell(c, r, k, dmg, silent) {
    const cell = c.grid[r][k];
    if (!cell.solid) return;
    cell.hp -= dmg;
    if (cell.hp <= 0) {
      cell.solid = false; cell.hp = 0;
      if (c.team === 'red') B.stats.blocks++;
      const p = c.cellCenter(r, k);
      for (let i = 0; i < 4; i++) B.debris.push({ x: p.x + rnd(-5, 5), y: p.y + rnd(-5, 5), vx: rnd(-160, 160), vy: rnd(-260, -60), a: rnd(0, 6), va: rnd(-10, 10), size: rnd(4, 7), k: cell.k, team: c.team, life: 2.2, small: true });
      c.needsSupport = true; c.supportDelay = 0.12;
    }
    if (!silent) c.shake = Math.max(c.shake, 1.2);
  }

  function hurtUnit(u, dmg, color) {
    if (!u.alive) return;
    const real = dmg * (1 - u.castle.armor);
    u.hp -= real; u.flash = 0.25;
    const c = u.center();
    floater(c.x, c.y - 16, '-' + Math.max(1, Math.round(real)), color || '#ff5a4a');
    if (u.hp <= 0) {
      u.alive = false; u.hp = 0;
      if (u.team === 'red') B.stats.kills++;
      for (let i = 0; i < 12; i++) B.particles.push({ type: 'smoke', x: c.x, y: c.y, vx: rnd(-60, 60), vy: rnd(-90, 10), life: 0.8, max: 0.8, size: rnd(4, 8), color: 'rgba(255,255,255,' });
      floater(c.x, c.y - 30, CB.UNITS[u.id].name + ' выбыл', '#ffffff');
    }
    hooks.onHud && hooks.onHud();
  }

  function floater(x, y, text, color) { B.floaters.push({ x, y, text, color, life: 1.2 }); }
  function dust(x, y, n) { for (let i = 0; i < n; i++) B.particles.push({ type: 'smoke', x, y, vx: rnd(-50, 50), vy: rnd(-50, 20), life: 0.5, max: 0.5, size: rnd(3, 6), color: 'rgba(200,200,205,' }); }

  function explode(p) {
    const r = p.r;
    B.lastImpact = { x: p.x, y: p.y };
    B.camFocus = { x: p.x, y: p.y }; B.focusT = 1.1;
    const big = r >= 34;
    CB.Audio.play('boom', big); CB.haptic(big ? 'heavy' : 'medium');
    B.shake = Math.min(14, B.shake + r * 0.18);
    // visuals
    B.particles.push({ type: 'flash', x: p.x, y: p.y, life: 0.18, max: 0.18, size: r * 1.1 });
    B.particles.push({ type: 'ring', x: p.x, y: p.y, life: 0.35, max: 0.35, size: r });
    const fire = p.kind === 'fire' || p.kind === 'lava';
    for (let i = 0; i < 16; i++) B.particles.push({ type: 'smoke', x: p.x + rnd(-r * 0.4, r * 0.4), y: p.y + rnd(-r * 0.4, r * 0.4), vx: rnd(-70, 70), vy: rnd(-110, 10), life: rnd(0.8, 1.5), max: 1.5, size: rnd(7, 14), color: fire ? 'rgba(90,50,40,' : 'rgba(55,55,68,' });
    for (let i = 0; i < 14; i++) B.particles.push({ type: 'spark', x: p.x, y: p.y, vx: rnd(-260, 260), vy: rnd(-300, 60), life: rnd(0.3, 0.6), max: 0.6, size: rnd(1.5, 3), color: p.kind === 'orb' ? '#d9c2ff' : '#ffd34d' });
    // blocks
    for (const c of [B.castles.player, B.castles.enemy]) {
      const at = c.cellAt(p.x, p.y);
      const r0 = Math.max(0, Math.floor((p.y - r - c.top()) / S)), r1 = Math.min(c.rows - 1, Math.floor((p.y + r - c.top()) / S));
      const c0 = Math.max(0, Math.floor((p.x - r - c.left()) / S)), c1 = Math.min(c.cols - 1, Math.floor((p.x + r - c.left()) / S));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
        const cell = c.grid[rr][cc]; if (!cell.solid) continue;
        const cp = c.cellCenter(rr, cc);
        const d = Math.hypot(cp.x - p.x, cp.y - p.y);
        if (d > r + S * 0.3) continue;
        damageCell(c, rr, cc, p.block * (d < r * 0.5 ? 1 : 0.55));
      }
      if (at || (p.x > c.left() - r && p.x < c.left() + c.cols * S + r)) c.shake = 2;
      for (const u of c.units) {
        if (!u.alive) continue;
        const uc = u.center();
        const d = Math.hypot(uc.x - p.x, uc.y - p.y);
        if (d < r + 9) hurtUnit(u, p.unit * (1 - 0.5 * d / (r + 9)));
      }
      if (p.burn) {
        for (let rr = 0; rr < c.rows; rr++) for (let cc = 0; cc < c.cols; cc++) {
          const cell = c.grid[rr][cc]; if (!cell.solid) continue;
          const cp = c.cellCenter(rr, cc);
          if (Math.hypot(cp.x - p.x, cp.y - p.y) < p.burnR) {
            const ex = c.burning.find((b) => b.r === rr && b.c === cc);
            if (ex) ex.turns = Math.max(ex.turns, p.burn); else c.burning.push({ r: rr, c: cc, turns: p.burn });
          }
        }
        for (const u of c.units) if (u.alive && Math.hypot(u.center().x - p.x, u.center().y - p.y) < p.burnR) u.burn = Math.max(u.burn, p.burn);
      }
    }
  }

  function processSupport(c, dt) {
    if (!c.needsSupport) return;
    c.supportDelay -= dt;
    if (c.supportDelay > 0) return;
    c.needsSupport = false;
    const un = c.findUnsupported();
    if (un.length) {
      for (const { r, c: k } of un) {
        const cell = c.grid[r][k];
        const p = c.cellCenter(r, k);
        B.debris.push({ x: p.x, y: p.y, vx: rnd(-25, 25) + c.facing * -10, vy: rnd(-20, 10), a: 0, va: rnd(-2.5, 2.5), size: S, k: cell.k, team: c.team, life: 3.2, hp: cell.hp / cell.maxhp, castle: c });
        cell.solid = false; cell.hp = 0;
      }
      if (c.team === 'red') B.stats.blocks += un.length;
      CB.Audio.play('crumble'); CB.haptic('heavy');
      c.shake = 4; B.shake = Math.min(14, B.shake + 3 + un.length * 0.2);
      if (un.length >= 6) floater(c.x, c.top() - 10, 'ОБВАЛ!', '#ffd34d');
    }
    c.updateRoomBg();
    hooks.onHud && hooks.onHud();
  }

  function updateUnits(dt) {
    for (const c of [B.castles.player, B.castles.enemy]) {
      for (const u of c.units) {
        if (!u.alive) continue;
        if (u.flash > 0) u.flash -= dt;
        const supported = c.solidAtLocal(u.lx - 3, u.ly + 1) || c.solidAtLocal(u.lx + 3, u.ly + 1);
        if (!supported || u.falling) {
          if (!u.falling) { u.falling = true; u.fallStart = u.ly; u.vy = 0; }
          u.vy += W.gravity * dt; u.ly += u.vy * dt;
          const landed = c.solidAtLocal(u.lx, u.ly + 1) || u.ly >= c.rows * S;
          if (landed) {
            u.ly = Math.min(c.rows * S, Math.floor((u.ly + 1) / S) * S);
            const fell = u.ly - u.fallStart;
            u.falling = false; u.vy = 0;
            if (fell > S * 1.2) { hurtUnit(u, (fell / S) * 9, '#ffb02e'); dust(u.x, u.y, 5); }
          }
        }
      }
    }
  }

  function updateDebris(dt) {
    for (const d of B.debris) {
      d.vy += W.gravity * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
      const gy = groundY(d.x) - d.size * 0.4;
      if (d.y > gy) { d.y = gy; d.vy *= -0.25; d.vx *= 0.6; d.va *= 0.5; if (Math.abs(d.vy) < 40) { d.vy = 0; d.rest = true; } }
      if (!d.small && d.castle && d.vy > 0) {
        const at = d.castle.cellAt(d.x, d.y + d.size / 2);
        if (at && at.cell.solid) {
          if (!d.hitDone && d.vy > 120) { d.hitDone = true; damageCell(d.castle, at.r, at.c, 0.35, true); }
          d.y = d.castle.top() + at.r * S - d.size / 2;
          d.vy *= -0.2; d.vx = d.vx * 0.5 + rnd(-30, 30); d.va *= 0.5;
          if (Math.abs(d.vy) < 40) { d.vy = 0; d.rest = true; }
        } else if (d.rest && d.y < groundY(d.x) - d.size) { d.rest = false; }
        if (!d.hitUnit) for (const u of d.castle.units) if (u.alive && Math.hypot(u.center().x - d.x, u.center().y - d.y) < 14 && d.vy > 60) { d.hitUnit = true; hurtUnit(u, 7); }
      }
      if (d.rest || d.small) d.life -= dt;
    }
    B.debris = B.debris.filter((d) => d.life > 0);
  }

  function updateParticles(dt) {
    for (const p of B.particles) {
      p.life -= dt;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.type === 'spark') p.vy += 500 * dt;
      if (p.type === 'smoke') { p.vx *= 0.97; p.vy -= 10 * dt; }
    }
    B.particles = B.particles.filter((p) => p.life > 0);
    if (B.particles.length > 900) B.particles.splice(0, B.particles.length - 900);
    for (const f of B.floaters) { f.life -= dt; f.y -= 28 * dt; }
    B.floaters = B.floaters.filter((f) => f.life > 0);
  }

  function anyFalling() {
    for (const c of [B.castles.player, B.castles.enemy]) {
      if (c.needsSupport) return true;
      for (const u of c.units) if (u.alive && u.falling) return true;
    }
    return B.debris.some((d) => !d.small && !d.rest && d.life > 1.5);
  }

  // --------------- AI ---------------
  function simulateImpact(sx, sy, vx, vy, proj, target) {
    let x = sx, y = sy, t = 0;
    const g = W.gravity * proj.grav;
    while (t < 5) {
      vx += B.wind * DT * (proj.kind === 'orb' ? 0.3 : 1); vy += g * DT; x += vx * DT; y += vy * DT; t += DT;
      const at = target.cellAt(x, y);
      if (at && at.cell.solid) return { x, y };
      for (const u of target.units) if (u.alive) { const c = u.center(); if (Math.abs(c.x - x) < 10 && Math.abs(c.y - y) < 10) return { x, y }; }
      if (y >= groundY(x)) return { x, y };
      if (x < -500 || x > 1700) return null;
    }
    return null;
  }

  function aiPlan() {
    const me = B.castles.enemy, foe = B.castles.player;
    const av = available('enemy');
    const missing = me.units.reduce((s, u) => s + (u.alive ? u.maxhp - u.hp : 0), 0);
    const fairy = av.find((u) => u.stats.support === 'heal');
    if (fairy && missing > 70 && Math.random() < 0.8) return { unit: fairy };
    const eng = av.find((u) => u.stats.support === 'repair');
    if (eng && me.destroyedCount() >= 6 && Math.random() < 0.65) return { unit: eng };
    const shooters = av.filter((u) => !u.stats.support);
    if (!shooters.length) return { unit: av[0] };
    // choose target
    let target;
    const alive = foe.units.filter((u) => u.alive);
    const roll = Math.random();
    if (roll < 0.4 && alive.length) {
      const u = alive.sort((a, b) => a.hp - b.hp)[0];
      target = u.center();
    } else {
      // supports: low wall cells on the side facing the AI
      const cands = [];
      for (let r = 0; r < foe.rows; r++) for (let c = 0; c < foe.cols; c++) {
        const cell = foe.grid[r][c]; if (!cell.solid) continue;
        const weight = (r / foe.rows) * 2 + (c / foe.cols) * 1.5;
        cands.push({ r, c, w: weight + Math.random() * 1.2 });
      }
      cands.sort((a, b) => b.w - a.w);
      const pick = cands[Math.floor(Math.random() * Math.min(5, cands.length))] || { r: foe.rows - 1, c: foe.cols - 1 };
      target = foe.cellCenter(pick.r, pick.c);
    }
    // pick unit: heavy hitters for structure, archers/scouts for units
    let unit = shooters[Math.floor(Math.random() * shooters.length)];
    const pref = roll < 0.4 ? ['archer', 'scout', 'knight', 'mage'] : ['bomber', 'catapult', 'wrecker', 'knight', 'napalmer', 'mage'];
    for (const id of pref) { const f = shooters.find((u) => u.id === id); if (f && Math.random() < 0.6) { unit = f; break; } }
    const proj = unit.stats.proj; const m = muzzle(unit);
    let best = null;
    const vmax = W.vMax * (proj.speedMul || 1), vmin = W.vMin * (proj.speedMul || 1);
    for (let el = 6; el <= 80; el += 2) {
      const a = el * Math.PI / 180;
      for (let sp = vmin; sp <= vmax; sp += 22) {
        const vx = -Math.cos(a) * sp, vy = -Math.sin(a) * sp;
        const hit = simulateImpact(m.x, m.y, vx, vy, proj, foe);
        if (!hit) continue;
        const d = Math.hypot(hit.x - target.x, hit.y - target.y);
        if (!best || d < best.d) best = { d, el, sp };
      }
    }
    if (!best) best = { el: 45, sp: (vmin + vmax) / 2 };
    const skill = Math.min(1, (B.cfg.aiSkill || 0));
    const errDeg = 5.5 - 4 * skill, errSp = 0.065 - 0.045 * skill;
    const el = (best.el + gauss() * errDeg) * Math.PI / 180;
    const sp = best.sp * (1 + gauss() * errSp);
    return { unit, vx: -Math.cos(el) * sp, vy: -Math.sin(el) * sp };
  }

  // --------------- Update ---------------
  function update(dt) {
    B.t += dt;
    if (B.shake > 0) B.shake = Math.max(0, B.shake - dt * 30);
    if (B.focusT > 0) B.focusT -= dt;
    for (const c of [B.castles.player, B.castles.enemy]) if (c.shake > 0) c.shake = Math.max(0, c.shake - dt * 8);

    // fixed-step physics
    B.acc += dt;
    while (B.acc >= DT) {
      B.acc -= DT;
      if (B.projectiles.length) updateProjectiles(DT);
    }
    for (const c of [B.castles.player, B.castles.enemy]) processSupport(c, dt);
    updateUnits(dt); updateDebris(dt); updateParticles(dt);

    switch (B.phase) {
      case 'intro': {
        B.phaseT += dt;
        const k = Math.min(1, B.phaseT / 2.2);
        const e = 1 - Math.pow(1 - k, 3);
        const pc = B.castles.player, ec = B.castles.enemy;
        const px = W.leftX - 520 + 520 * e, ex = W.rightX + 520 - 520 * e;
        pc.roll += (px - pc.x) * 1.0; ec.roll += (ex - ec.x) * 1.0;
        pc.x = px; ec.x = ex;
        if (k >= 1 && B.phaseT > 2.5) { banner('Раунд 1', 'Бой начинается!', 1100); beginTurn('player'); }
        break; }
      case 'playerAim':
        B.timer -= dt;
        if (B.timer <= 5 && Math.ceil(B.timer) !== B.lastTick) { B.lastTick = Math.ceil(B.timer); CB.Audio.play('tick'); }
        if (B.timer <= 0) { B.aim = null; banner('Время вышло', 'Ход переходит сопернику', 1100); B.phase = 'wait'; B.phaseT = 1.0; B.afterWait = endTurn; }
        break;
      case 'aiThink':
        B.phaseT -= dt;
        if (B.phaseT <= 0) {
          const plan = aiPlan();
          if (plan.unit.stats.support) { fire('enemy', plan.unit, 0, 0); break; }
          B.aiAim = { unit: plan.unit, vx: plan.vx, vy: plan.vy, t: 0 };
          B.phase = 'aiAim'; B.phaseT = 0.9;
        }
        break;
      case 'aiAim':
        B.phaseT -= dt; B.aiAim.t += dt;
        if (B.phaseT <= 0) fire('enemy', B.aiAim.unit, B.aiAim.vx, B.aiAim.vy);
        break;
      case 'flying':
        if (!B.projectiles.length) { B.phase = 'settle'; B.settleT = 0.7; }
        break;
      case 'settle':
        B.settleT -= dt;
        if (B.settleT <= 0 && !anyFalling() && !B.projectiles.length) {
          B.phase = 'resolved';
          const cb = B.onResolved; B.onResolved = null;
          hooks.onHud && hooks.onHud();
          if (!checkEnd() && cb) cb();
        }
        if (B.projectiles.length) B.phase = 'flying';
        break;
      case 'wait':
        B.phaseT -= dt;
        if (B.phaseT <= 0) { const f = B.afterWait; B.afterWait = null; f && f(); }
        break;
    }
    updateCamera(dt);
    hooks.onTick && hooks.onTick();
  }

  // --------------- Render ---------------
  function render() {
    const z = B.cam.z, fa = freeArea();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = (Math.random() - 0.5) * B.shake, sy = (Math.random() - 0.5) * B.shake;
    const ox = view.w / 2 - B.cam.x * z + sx, oy = view.top + fa.h / 2 - B.cam.y * z + sy;
    ctx.setTransform(view.dpr * z, 0, 0, view.dpr * z, view.dpr * ox, view.dpr * oy);
    CB.Art.drawBackground(ctx, B.arena, B.cam, view, B.t, groundY);
    CB.Art.drawGround(ctx, B.arena, groundY, B.t);

    for (const c of [B.castles.player, B.castles.enemy]) {
      CB.Art.drawCastle(ctx, c, B.t);
    }
    // debris
    for (const d of B.debris) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
      ctx.globalAlpha = Math.min(1, d.life / 0.6);
      const s = d.size;
      if (d.k === 'R') ctx.fillStyle = CB.Art.TEAM[d.team].roof;
      else if (d.k === '=') ctx.fillStyle = '#c47a3a';
      else ctx.fillStyle = '#c7cbd0';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = CB.Art.OUT; ctx.lineWidth = s > 10 ? 2 : 1.2; ctx.strokeRect(-s / 2, -s / 2, s, s);
      if (s > 10) { ctx.strokeStyle = 'rgba(29,35,64,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0); ctx.stroke(); }
      ctx.restore();
    }
    // units
    for (const c of [B.castles.player, B.castles.enemy]) {
      for (const u of c.units) {
        if (!u.alive) continue;
        const sel = B.selected === u && B.turn === 'player' && B.phase === 'playerAim';
        const aiSel = B.aiAim && B.aiAim.unit === u;
        if (sel || aiSel) {
          ctx.fillStyle = 'rgba(255,211,77,' + (0.45 + 0.25 * Math.sin(B.t * 6)) + ')';
          ctx.beginPath(); ctx.ellipse(u.x, u.y - 1, 11, 3.5, 0, 0, 7); ctx.fill();
          // pointer arrow
          const ay = u.y - 36 + Math.sin(B.t * 5) * 2;
          ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = CB.Art.OUT; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(u.x - 5, ay - 6); ctx.lineTo(u.x + 5, ay - 6); ctx.lineTo(u.x, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.save();
        if (u.flash > 0) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(B.t * 40);
        CB.Art.drawUnit(ctx, CB.UNITS[u.id].look, u.x, u.y, 1, c.facing, { team: c.team, bob: u.falling ? 0 : Math.sin(B.t * 3 + u.idx) * 0.6 });
        ctx.restore();
        if (u.cdLeft > 0 && c.team === 'blue') {
          ctx.fillStyle = 'rgba(29,35,64,0.85)'; ctx.beginPath(); ctx.arc(u.x + 9, u.y - 26, 5, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 7px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(u.cdLeft), u.x + 9, u.y - 25.6);
        }
        CB.Art.drawHpBar(ctx, u.x, u.y - 31, u.hp / u.maxhp, c.team);
        if (u.burn > 0) { ctx.fillStyle = 'rgba(255,120,40,0.8)'; ctx.beginPath(); ctx.arc(u.x - 9, u.y - 26, 2.5 + Math.sin(B.t * 10), 0, 7); ctx.fill(); }
      }
    }
    // projectiles
    for (const p of B.projectiles) CB.Art.drawProjectile(ctx, p, B.t);
    // particles
    for (const p of B.particles) {
      const k = p.life / p.max;
      if (p.type === 'smoke') { ctx.fillStyle = p.color + (0.55 * k) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, 7); ctx.fill(); }
      else if (p.type === 'spark') { ctx.fillStyle = p.color; ctx.globalAlpha = k; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.globalAlpha = 1; }
      else if (p.type === 'flash') { ctx.fillStyle = 'rgba(255,240,180,' + k + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - k * 0.4), 0, 7); ctx.fill(); }
      else if (p.type === 'ring') { ctx.strokeStyle = 'rgba(255,255,255,' + k + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - k * 0.8), 0, 7); ctx.stroke(); }
      else if (p.type === 'heal') { ctx.fillStyle = 'rgba(120,255,140,' + k + ')'; ctx.font = '700 9px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', p.x, p.y); }
    }
    // aim arc
    drawAim();
    // floaters
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of B.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = '400 ' + (f.text.length > 6 ? 11 : 14) + 'px "Russo One", sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = CB.Art.OUT; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    // screen-space aim indicator
    if (B.aim) {
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      const v = aimVelocity();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(B.aim.sx, B.aim.sy); ctx.lineTo(B.aim.cx, B.aim.cy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(B.aim.sx, B.aim.sy, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = CB.Art.OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(B.aim.cx, B.aim.cy, 12, 0, 7); ctx.fill(); ctx.stroke();
      if (v) {
        const pct = Math.round(v.power * 100);
        ctx.font = '400 15px "Russo One", sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeText(pct + '%', B.aim.cx, B.aim.cy - 24); ctx.fillStyle = '#fff'; ctx.fillText(pct + '%', B.aim.cx, B.aim.cy - 24);
      }
    }
  }

  function drawAim() {
    let u = null, vx = 0, vy = 0, proj = null, alpha = 1;
    if (B.aim && B.selected) { const v = aimVelocity(); if (!v) return; u = B.selected; vx = v.vx; vy = v.vy; proj = u.stats.proj; }
    else if (B.aiAim && B.phase === 'aiAim') { u = B.aiAim.unit; vx = B.aiAim.vx; vy = B.aiAim.vy; proj = u.stats.proj; alpha = Math.min(1, B.aiAim.t * 3) * 0.75; }
    if (!u || !proj) return;
    const m = muzzle(u);
    let x = m.x, y = m.y, t = 0;
    const g = W.gravity * proj.grav;
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.strokeStyle = 'rgba(29,35,64,' + (alpha * 0.7) + ')'; ctx.lineWidth = 1.2;
    let n = 0;
    const maxT = 1.05;
    while (t < maxT) {
      for (let i = 0; i < 6; i++) { vx += B.wind * DT; vy += g * DT; x += vx * DT; y += vy * DT; t += DT; }
      n++;
      if (n % 2 === 0) {
        const r = 3.4 * (1 - t / maxT * 0.6);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      }
      if (y > groundY(x)) break;
    }
  }

  // --------------- Public API ---------------
  function selectUnit(u) {
    if (!B || B.phase !== 'playerAim' || !u.alive || u.cdLeft > 0 || u.castle !== B.castles.player) return false;
    B.selected = u; CB.Audio.play('select'); CB.haptic('light');
    hooks.onHud && hooks.onHud();
    return true;
  }
  function useSupport() {
    if (!B || B.phase !== 'playerAim' || !B.selected || !B.selected.stats.support) return false;
    fire('player', B.selected, 0, 0); return true;
  }
  function surrender() { if (B && !B.over) finish(false, 'Вы сдались'); }
  function pause(v) { if (B) B.paused = v; }

  window.render_game_to_text = function () {
    if (!B) return JSON.stringify({ mode: 'menu' });
    const u2 = (u) => ({ id: u.id, hp: Math.round(u.hp), alive: u.alive, cd: u.cdLeft, x: Math.round(u.x), y: Math.round(u.y), falling: u.falling });
    return JSON.stringify({
      note: 'world coords: origin top-left, x right, y down; ground y≈560',
      phase: B.phase, turn: B.turn, round: B.round, wind: B.wind, timer: Math.round(B.timer),
      selected: B.selected && B.selected.id,
      player: { pct: Math.round(B.castles.player.hpFrac() * 100), x: B.castles.player.x, units: B.castles.player.units.map(u2) },
      enemy: { pct: Math.round(B.castles.enemy.hpFrac() * 100), x: B.castles.enemy.x, units: B.castles.enemy.units.map(u2) },
      projectiles: B.projectiles.map((p) => ({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y) })),
      debris: B.debris.length, over: B.over, result: B.result,
    });
  };
  window.advanceTime = function (ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) if (B && !B.paused) update(1 / 60);
    if (B) render();
  };

  return {
    setup, start, setInsets, selectUnit, useSupport, surrender, pause, w2s, s2w,
    get state() { return B; },
    clear() { B = null; },
    // test helper: fire the selected player unit with a given elevation/power
    debugFire(elevDeg, power) {
      if (!canAim()) return false;
      const p = B.selected.stats.proj; const sp = (W.vMin + power * (W.vMax - W.vMin)) * (p.speedMul || 1);
      const a = elevDeg * Math.PI / 180; fire('player', B.selected, Math.cos(a) * sp, -Math.sin(a) * sp); return true;
    },
  };
})();
