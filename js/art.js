// Cartoon renderer helpers: background, castles, units, projectiles
window.CB = window.CB || {};
CB.Art = (function () {
  const OUT = '#1d2340'; // navy outline colour used everywhere
  const TEAM = {
    blue: { roof: '#3d7bf0', roofDark: '#2a56b8', flag: '#3d7bf0', belt: '#3d7bf0' },
    red: { roof: '#e5463f', roofDark: '#a82e2a', flag: '#e5463f', belt: '#e5463f' },
  };

  function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // ---------- Ground ----------
  function makeGround(W) {
    const G = W.groundY;
    return function groundY(x) {
      const near = Math.min(Math.abs(x - W.leftX), Math.abs(x - W.rightX));
      const k = Math.min(1, Math.max(0, (near - 120) / 120));
      const h = 16 * Math.sin(x / 150 + 0.7) + 9 * Math.sin(x / 61 + 2.1);
      return G + h * k * k;
    };
  }

  // ---------- Background ----------
  function mountains(ctx, pal, ox, baseY, amp, step, seed, color, dark, outline) {
    ctx.beginPath();
    ctx.moveTo(-2600 + ox, baseY + 400);
    for (let x = -2600; x <= 3800; x += step) {
      const n = Math.sin(x * 0.004 + seed) * 0.5 + Math.sin(x * 0.011 + seed * 2.3) * 0.35 + Math.sin(x * 0.023 + seed) * 0.15;
      const y = baseY - amp * (0.55 + n * 0.6);
      ctx.lineTo(x + ox, y);
    }
    ctx.lineTo(3800 + ox, baseY + 400); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke(); }
  }

  function pine(ctx, x, y, s, col) {
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 2 * s, y - 6 * s, 4 * s, 6 * s);
    ctx.beginPath();
    ctx.moveTo(x, y - 34 * s); ctx.lineTo(x + 11 * s, y - 14 * s); ctx.lineTo(x + 6 * s, y - 14 * s);
    ctx.lineTo(x + 14 * s, y - 4 * s); ctx.lineTo(x - 14 * s, y - 4 * s); ctx.lineTo(x - 6 * s, y - 14 * s);
    ctx.lineTo(x - 11 * s, y - 14 * s); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
  }

  function drawBackground(ctx, arena, cam, view, t, groundY) {
    const pal = arena.pal;
    // sky in screen space
    ctx.save(); ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, pal.sky1); g.addColorStop(1, pal.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();

    const cx = cam.x;
    // sun / moon
    ctx.save();
    const px1 = (cx - 550) * 0.85;
    if (arena.id === 'volcano') {
      ctx.fillStyle = 'rgba(255,120,60,0.35)'; ctx.beginPath(); ctx.arc(820 + px1, 150, 70, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(760 + px1, 120, 46, 0, 7); ctx.fill();
    }
    // clouds
    for (let i = 0; i < 7; i++) {
      const x = ((i * 380 + t * 8 * (1 + (i % 3) * 0.3)) % 2600) - 900 + px1 * 0.2;
      const y = 70 + (i * 37) % 110;
      ctx.fillStyle = arena.id === 'volcano' ? 'rgba(60,40,50,0.6)' : 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(x, y, 46, 14, 0, 0, 7); ctx.ellipse(x + 26, y - 8, 28, 14, 0, 0, 7); ctx.ellipse(x - 24, y - 4, 24, 11, 0, 0, 7); ctx.fill();
    }
    // far mountains (parallax)
    const p2 = (cx - 550) * 0.6;
    mountains(ctx, pal, p2, 470, 230, 40, 1.3, pal.far, pal.farDark, false);
    if (arena.id === 'volcano') {
      // volcano cone + glow
      ctx.beginPath(); ctx.moveTo(380 + p2, 470); ctx.lineTo(520 + p2, 230); ctx.lineTo(580 + p2, 230); ctx.lineTo(720 + p2, 470); ctx.closePath();
      ctx.fillStyle = '#3a2028'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,40,' + (0.55 + 0.25 * Math.sin(t * 3)) + ')';
      ctx.beginPath(); ctx.ellipse(550 + p2, 232, 32, 9, 0, 0, 7); ctx.fill();
    }
    if (arena.id === 'ice') {
      // snowy peaks
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { const x = -200 + i * 330 + p2; ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x + 40, 250); ctx.lineTo(x + 80, 300); ctx.closePath(); ctx.fill(); }
    }
    const p3 = (cx - 550) * 0.4;
    mountains(ctx, pal, p3, 520, 150, 30, 4.1, pal.mid, pal.farDark, true);
    // waterfalls
    if (pal.water) {
      for (const wx of [60, 1040, 1700]) {
        const x = wx + p3;
        // rocky cliff the water pours from
        ctx.beginPath(); ctx.moveTo(x - 50, 530); ctx.lineTo(x - 40, 330); ctx.quadraticCurveTo(x - 20, 290, x + 20, 300);
        ctx.quadraticCurveTo(x + 70, 285, x + 96, 320); ctx.lineTo(x + 110, 530); ctx.closePath();
        ctx.fillStyle = pal.farDark; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = pal.mid; ctx.beginPath(); ctx.ellipse(x + 26, 300, 60, 14, -0.05, 0, 7); ctx.fill();
        const wg = ctx.createLinearGradient(x, 0, x + 46, 0);
        wg.addColorStop(0, 'rgba(210,248,250,0.95)'); wg.addColorStop(0.5, '#ffffff'); wg.addColorStop(1, 'rgba(190,240,245,0.95)');
        ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(x + 4, 306); ctx.lineTo(x + 42, 306); ctx.lineTo(x + 52, 528); ctx.lineTo(x - 6, 528); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(120,210,220,0.8)';
        for (let k = 0; k < 4; k++) { const yy = 310 + ((t * 140 + k * 55) % 200); ctx.fillRect(x + 6 + k * 9, yy, 3, 22); }
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x - 6 + k * 19, 528 - Math.abs(Math.sin(t * 4 + k)) * 5, 13, 0, 7); ctx.fill(); }
      }
      // lake
      ctx.fillStyle = 'rgba(80,200,210,0.65)'; ctx.fillRect(-2000 + p3, 520, 6000, 60);
    }
    // trees row (closer)
    const p4 = (cx - 550) * 0.15;
    for (let i = -6; i < 30; i++) {
      const x = i * 90 + (i % 3) * 23 + p4;
      if (Math.abs(x - 230) < 140 || Math.abs(x - 870) < 140) continue;
      const y = groundY(x) + 6;
      pine(ctx, x, y, 0.8 + hash(i, 3) * 0.5, pal.tree);
    }
    ctx.restore();
  }

  function drawGround(ctx, arena, groundY, t) {
    const pal = arena.pal;
    ctx.beginPath();
    ctx.moveTo(-2600, 2000);
    for (let x = -2600; x <= 3800; x += 16) ctx.lineTo(x, groundY(x));
    ctx.lineTo(3800, 2000); ctx.closePath();
    ctx.fillStyle = pal.soil; ctx.fill();
    // grass band
    ctx.beginPath();
    for (let x = -2600; x <= 3800; x += 16) ctx.lineTo(x, groundY(x) - 2);
    for (let x = 3800; x >= -2600; x -= 16) ctx.lineTo(x, groundY(x) + 22);
    ctx.closePath(); ctx.fillStyle = pal.ground; ctx.fill();
    ctx.beginPath();
    for (let x = -2600; x <= 3800; x += 16) ctx.lineTo(x, groundY(x) + 14);
    for (let x = 3800; x >= -2600; x -= 16) ctx.lineTo(x, groundY(x) + 22);
    ctx.closePath(); ctx.fillStyle = pal.groundDark; ctx.fill();
    ctx.beginPath();
    for (let x = -2600; x <= 3800; x += 16) ctx.lineTo(x, groundY(x) - 2);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    // rocks & logs
    for (let i = -10; i < 40; i++) {
      const x = i * 137 + 40;
      if (Math.abs(x - 230) < 150 || Math.abs(x - 870) < 150) continue;
      const y = groundY(x) + 2;
      if (i % 3 === 0) { ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.ellipse(x, y, 9, 6, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (i % 5 === 1) { ctx.fillStyle = '#b8743c'; rr(ctx, x - 14, y - 9, 28, 9, 4); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
  }

  // ---------- Castle ----------
  const SOLID = { '#': 1, W: 1, '=': 1, R: 1, M: 1, T: 1 };

  function stoneColor(r, c, base) {
    const n = hash(r + 7, c + 3);
    const v = base + Math.floor(n * 18) - 9;
    return 'rgb(' + v + ',' + (v + 3) + ',' + (v + 7) + ')';
  }

  function drawCastle(ctx, castle, t) {
    const S = castle.S;
    const team = TEAM[castle.team];
    const ox = castle.left(), oy = castle.top();
    const G = castle.grid;
    const R = castle.rows, C = castle.cols;
    const shake = castle.shake || 0;
    ctx.save();
    ctx.translate(Math.sin(t * 60) * shake, 0);

    // hull + treads
    drawHull(ctx, castle, t);

    // room back walls
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = G[r][c];
      if (!cell.room || !cell.visibleBg) continue;
      const x = ox + c * S, y = oy + r * S;
      ctx.fillStyle = stoneColor(r, c, 120);
      ctx.fillRect(x - 0.5, y - 0.5, S + 1, S + 1);
      ctx.strokeStyle = 'rgba(29,35,64,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + S / 2); ctx.lineTo(x + S, y + S / 2);
      ctx.moveTo(x + ((r % 2) ? S / 2 : S / 4), y); ctx.lineTo(x + ((r % 2) ? S / 2 : S / 4), y + S / 2);
      ctx.stroke();
    }

    // solid cells
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = G[r][c];
      if (!cell.solid) continue;
      const x = ox + c * S, y = oy + r * S;
      const k = cell.k;
      if (k === 'R') { drawRoofCell(ctx, castle, r, c, x, y, S, team); continue; }
      if (k === '=') {
        ctx.fillStyle = '#c47a3a'; ctx.fillRect(x - 0.5, y + 3, S + 1, S - 3);
        ctx.fillStyle = '#e09a55'; ctx.fillRect(x - 0.5, y + 3, S + 1, 4);
        ctx.strokeStyle = 'rgba(29,35,64,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + S * 0.5, y + 7); ctx.lineTo(x + S * 0.5, y + S); ctx.stroke();
        ctx.fillStyle = stoneColor(r, c, 150); ctx.fillRect(x - 0.5, y - 0.5, S + 1, 3.5);
      } else {
        ctx.fillStyle = stoneColor(r, c, k === 'T' || k === 'M' ? 196 : 205);
        ctx.fillRect(x - 0.5, y - 0.5, S + 1, S + 1);
        // brick lines
        ctx.strokeStyle = 'rgba(29,35,64,0.22)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + S / 2); ctx.lineTo(x + S, y + S / 2);
        const off = ((r + c) % 2) ? S * 0.5 : S * 0.25;
        ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + S / 2);
        ctx.moveTo(x + ((off + S / 2) % S), y + S / 2); ctx.lineTo(x + ((off + S / 2) % S), y + S);
        ctx.stroke();
        if (hash(r, c) > 0.72) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 3, y + 3, S * 0.35, 2); }
        if (k === 'W') {
          ctx.fillStyle = OUT;
          ctx.beginPath(); ctx.moveTo(x + 5, y + S - 2); ctx.lineTo(x + 5, y + 8); ctx.arc(x + S / 2, y + 8, S / 2 - 5, Math.PI, 0); ctx.lineTo(x + S - 5, y + S - 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.fillRect(x + 6, y + 10, S - 12, 3);
        }
      }
      // damage cracks
      const f = cell.hp / cell.maxhp;
      if (f < 0.7) {
        ctx.strokeStyle = 'rgba(29,35,64,0.75)'; ctx.lineWidth = 1.4;
        const a = hash(r * 3, c * 5);
        ctx.beginPath(); ctx.moveTo(x + S * a, y); ctx.lineTo(x + S * 0.5, y + S * 0.45); ctx.lineTo(x + S * (1 - a), y + S); ctx.stroke();
        if (f < 0.4) { ctx.beginPath(); ctx.moveTo(x, y + S * a); ctx.lineTo(x + S * 0.5, y + S * 0.45); ctx.lineTo(x + S, y + S * 0.3); ctx.stroke(); ctx.fillStyle = 'rgba(29,35,64,0.15)'; ctx.fillRect(x, y, S, S); }
      }
    }

    // silhouette outline (only edges facing empty space)
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const cell = G[r][c];
      if (!cell.solid || cell.k === 'R') continue;
      const x = ox + c * S, y = oy + r * S;
      const up = r > 0 && G[r - 1][c].solid && G[r - 1][c].k !== 'R';
      const dn = r < R - 1 && G[r + 1][c].solid;
      const lf = c > 0 && G[r][c - 1].solid && G[r][c - 1].k !== 'R';
      const rt = c < C - 1 && G[r][c + 1].solid && G[r][c + 1].k !== 'R';
      if (!up) { ctx.moveTo(x, y); ctx.lineTo(x + S, y); }
      if (!dn && r < R - 1) { ctx.moveTo(x, y + S); ctx.lineTo(x + S, y + S); }
      if (!lf) { ctx.moveTo(x, y); ctx.lineTo(x, y + S); }
      if (!rt) { ctx.moveTo(x + S, y); ctx.lineTo(x + S, y + S); }
    }
    ctx.stroke();

    // burning cells
    for (const b of castle.burning) {
      const cell = G[b.r] && G[b.r][b.c];
      if (!cell || !cell.solid) continue;
      const x = ox + b.c * S + S / 2, y = oy + b.r * S + S / 2;
      for (let i = 0; i < 3; i++) {
        const ph = t * 9 + i * 2.1 + b.c;
        const h = 8 + Math.sin(ph) * 3;
        ctx.fillStyle = i === 0 ? 'rgba(255,90,30,0.85)' : 'rgba(255,200,60,0.85)';
        ctx.beginPath(); ctx.moveTo(x - 5 + i * 4, y + 4); ctx.quadraticCurveTo(x - 6 + i * 4, y - h, x - 2 + i * 4 + Math.sin(ph) * 2, y - h - 4); ctx.quadraticCurveTo(x + 2 + i * 4, y - h, x + 1 + i * 4, y + 4); ctx.fill();
      }
    }

    // flag on top-most roof
    if (castle.flagCell) {
      const fc = castle.flagCell; const cell = G[fc.r][fc.c];
      if (cell.solid) {
        const x = ox + fc.c * S + S / 2, y = oy + fc.r * S - S * 0.9;
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18); ctx.stroke();
        const wave = Math.sin(t * 5) * 2;
        ctx.fillStyle = team.flag; ctx.beginPath();
        const d = castle.facing;
        ctx.moveTo(x, y - 18); ctx.quadraticCurveTo(x + d * 8, y - 20 + wave, x + d * 15, y - 15 + wave); ctx.quadraticCurveTo(x + d * 8, y - 11 + wave, x, y - 11); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawRoofCell(ctx, castle, r, c, x, y, S, team) {
    const G = castle.grid;
    const isR = (rr_, cc) => rr_ >= 0 && cc >= 0 && rr_ < castle.rows && cc < castle.cols && G[rr_][cc].solid && G[rr_][cc].k === 'R';
    const above = isR(r - 1, c), L = isR(r, c - 1), Rt = isR(r, c + 1);
    ctx.beginPath();
    if (above || (L && Rt)) { ctx.rect(x - 0.5, y - 0.5, S + 1, S + 1); }
    else if (!L && Rt) { ctx.moveTo(x - 3, y + S); ctx.lineTo(x + S + 0.5, y - 0.5); ctx.lineTo(x + S + 0.5, y + S); ctx.closePath(); }
    else if (L && !Rt) { ctx.moveTo(x - 0.5, y - 0.5); ctx.lineTo(x + S + 3, y + S); ctx.lineTo(x - 0.5, y + S); ctx.closePath(); }
    else { ctx.moveTo(x - 1, y + S); ctx.lineTo(x + S / 2, y - S * 0.9); ctx.lineTo(x + S + 1, y + S); ctx.closePath(); }
    ctx.fillStyle = team.roof; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = team.roofDark; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 2, y + 4 + i * 6); ctx.lineTo(x + S + 2, y + 4 + i * 6); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    const f = G[r][c].hp / G[r][c].maxhp;
    if (f < 0.6) { ctx.fillStyle = 'rgba(29,35,64,0.25)'; ctx.fill(); }
  }

  function drawHull(ctx, castle, t) {
    const S = castle.S;
    const w = castle.cols * S + 14;
    const x = castle.x - w / 2, y = castle.bottom();
    const h = 30;
    // treads
    const tw = w * 0.34, th = 22;
    const roll = castle.roll || 0;
    for (const tx of [x + 8, x + w - 8 - tw]) {
      rr(ctx, tx, y + h - 6, tw, th, 10);
      ctx.fillStyle = '#3a3a48'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
      // tread studs
      ctx.fillStyle = '#5c5c6e';
      const per = tw * 2 + th * 1.4; const n = 12;
      for (let i = 0; i < n; i++) {
        let s = ((i / n) * per + roll) % per; if (s < 0) s += per;
        let px, py;
        if (s < tw - 10) { px = tx + 5 + s; py = y + h - 6 + 1.5; }
        else if (s < tw - 10 + th * 0.7) { px = tx + tw - 4; py = y + h - 6 + (s - (tw - 10)) / 0.7; }
        else if (s < 2 * (tw - 10) + th * 0.7) { px = tx + tw - 5 - (s - (tw - 10 + th * 0.7)); py = y + h - 6 + th - 3; }
        else { px = tx + 3; py = y + h - 6 + th - (s - (2 * (tw - 10) + th * 0.7)) / 0.7; }
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      // gears
      for (const gx of [tx + th * 0.5 + 1, tx + tw - th * 0.5 - 1]) {
        const gy = y + h - 6 + th / 2;
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(roll / 8);
        ctx.fillStyle = '#b8743c'; ctx.beginPath(); ctx.arc(0, 0, th * 0.32, 0, 7); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-th * 0.3, 0); ctx.lineTo(th * 0.3, 0); ctx.stroke(); }
        ctx.restore();
      }
    }
    // wooden hull
    ctx.beginPath();
    ctx.moveTo(x, y - 2); ctx.lineTo(x + w, y - 2); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x + 6, y + h); ctx.closePath();
    ctx.fillStyle = '#d9822b'; ctx.fill();
    ctx.fillStyle = '#b8661f'; ctx.fillRect(x + 6, y + h - 8, w - 12, 8);
    ctx.strokeStyle = 'rgba(29,35,64,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 3, y + 9); ctx.lineTo(x + w - 3, y + 9); ctx.stroke();
    // arches
    ctx.fillStyle = '#a55618';
    for (let i = 0; i < 3; i++) {
      const ax = x + w * (0.25 + i * 0.25);
      ctx.beginPath(); ctx.moveTo(ax - 9, y + h - 8); ctx.lineTo(ax - 9, y + 16); ctx.arc(ax, y + 16, 9, Math.PI, 0); ctx.lineTo(ax + 9, y + h - 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + w, y - 2); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x + 6, y + h); ctx.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
  }

  // ---------- Units ----------
  function drawUnit(ctx, look, x, y, k, facing, opts) {
    opts = opts || {};
    const f = facing || 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(k * f, k);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const bob = opts.bob || 0;
    // wings behind (fairy)
    if (look.hat === 'wings') {
      ctx.fillStyle = 'rgba(191,233,255,0.9)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(-6, -14 + bob, 6, 9, -0.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-3, -9 + bob, 4, 6, -1, 0, 7); ctx.fill(); ctx.stroke();
    }
    // legs
    ctx.fillStyle = '#3b3346';
    ctx.fillRect(-4, -5, 3, 5); ctx.fillRect(1, -5, 3, 5);
    // body
    rr(ctx, -5.5, -14 + bob, 11, 10, 3.5);
    ctx.fillStyle = look.tunic; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    // team belt
    ctx.fillStyle = opts.team === 'red' ? '#e5463f' : '#3d7bf0';
    ctx.fillRect(-5.5, -8 + bob, 11, 2.4);
    // head
    const hy = -19 + bob;
    ctx.beginPath(); ctx.arc(0, hy, 5.6, 0, 7); ctx.fillStyle = look.skin; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    // eyes
    ctx.fillStyle = OUT;
    if (look.hat !== 'knight') { ctx.fillRect(1.2, hy - 1, 1.6, 2.2); ctx.fillRect(3.6, hy - 1, 1.4, 2.2); }
    // hats
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.fillStyle = look.hatColor;
    switch (look.hat) {
      case 'helmet':
        ctx.beginPath(); ctx.arc(0, hy - 1, 6.2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-7, hy - 1.5, 14, 2); break;
      case 'cap':
        ctx.beginPath(); ctx.arc(0, hy - 1.5, 5.8, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, hy - 1.5); ctx.lineTo(9, hy - 0.5); ctx.lineTo(2, hy + 0.5); ctx.fill(); ctx.stroke(); break;
      case 'knight':
        rr(ctx, -6.4, hy - 7, 12.8, 13, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = OUT; ctx.fillRect(0, hy - 1.5, 6, 2);
        ctx.fillStyle = '#e5463f'; ctx.beginPath(); ctx.moveTo(-1, hy - 7); ctx.quadraticCurveTo(-8, hy - 14, -10, hy - 6); ctx.quadraticCurveTo(-5, hy - 9, -1, hy - 7); ctx.fill(); break;
      case 'hood':
        ctx.beginPath(); ctx.arc(0, hy, 7, Math.PI * 0.75, Math.PI * 0.2, false); ctx.quadraticCurveTo(-2, hy - 12, -7, hy + 3); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'wings':
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(-4, hy - 5); ctx.lineTo(-2, hy - 9); ctx.lineTo(0, hy - 6); ctx.lineTo(2, hy - 9); ctx.lineTo(4, hy - 5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'bandana':
        ctx.fillRect(-6, hy - 4.5, 12, 3.4); ctx.strokeRect(-6, hy - 4.5, 12, 3.4);
        ctx.beginPath(); ctx.moveTo(-6, hy - 3); ctx.lineTo(-10, hy - 5); ctx.lineTo(-10, hy); ctx.closePath(); ctx.fill(); break;
      case 'mask':
        ctx.fillStyle = look.hatColor; ctx.fillRect(-5.6, hy - 2.6, 11.2, 3.4);
        ctx.fillStyle = '#ffeb99'; ctx.fillRect(1.5, hy - 1.8, 1.6, 1.6); ctx.fillRect(3.8, hy - 1.8, 1.4, 1.6);
        ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(0, hy - 2, 5.8, Math.PI, 0); ctx.fill(); break;
      case 'wizard':
        ctx.beginPath(); ctx.moveTo(-8, hy - 3); ctx.lineTo(8, hy - 3); ctx.lineTo(1, hy - 6); ctx.lineTo(-3, hy - 18); ctx.lineTo(-4, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(-1.5, hy - 9, 1.6, 0, 7); ctx.fill(); break;
      case 'hardhat':
        ctx.beginPath(); ctx.arc(0, hy - 1.5, 6, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-7.5, hy - 2, 15, 2.2); ctx.strokeRect(-7.5, hy - 2, 15, 2.2); break;
    }
    // weapon in front hand
    ctx.save(); ctx.translate(7, -10 + bob);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.3;
    switch (look.weapon) {
      case 'bomb': ctx.fillStyle = '#2b2b38'; ctx.beginPath(); ctx.arc(1, 0, 4.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(3, -3); ctx.lineTo(5, -6); ctx.stroke(); break;
      case 'sling': ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -1); ctx.lineTo(-2, -5); ctx.moveTo(0, -1); ctx.lineTo(3, -5); ctx.stroke(); break;
      case 'axe': ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -7); ctx.stroke(); ctx.fillStyle = '#c9d1d9'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(7, -6, 5, 0); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); break;
      case 'bow': ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(-2, 0, 7, -1.2, 1.2); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0.5, -6.5); ctx.lineTo(0.5, 6.5); ctx.stroke(); break;
      case 'wand': ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(2, -5); ctx.stroke(); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(2, -6, 2.4, 0, 7); ctx.fill(); break;
      case 'dynamite': ctx.fillStyle = '#d23c3c'; ctx.fillRect(-2, -4, 3, 9); ctx.fillRect(1.5, -4, 3, 9); ctx.strokeRect(-2, -4, 6.5, 9); ctx.strokeStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(1, -4); ctx.lineTo(2, -8); ctx.stroke(); break;
      case 'rock': ctx.fillStyle = '#8f8a80'; ctx.beginPath(); ctx.arc(1, -1, 4.6, 0, 7); ctx.fill(); ctx.stroke(); break;
      case 'torch': ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(1, -4); ctx.stroke(); ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.quadraticCurveTo(1, -12, 4, -4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(1, -5, 1.5, 0, 7); ctx.fill(); break;
      case 'staff': ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -9); ctx.stroke(); ctx.fillStyle = '#b48cff'; ctx.beginPath(); ctx.arc(0, -10, 3, 0, 7); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); break;
      case 'wrench': ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(1, -4); ctx.stroke(); ctx.beginPath(); ctx.arc(1, -5, 2.6, 0.5, 5.5); ctx.stroke(); break;
    }
    ctx.restore();
    ctx.restore();
  }

  function drawHpBar(ctx, x, y, frac, team) {
    const w = 20;
    ctx.fillStyle = 'rgba(29,35,64,0.85)'; rr(ctx, x - w / 2 - 1, y - 1, w + 2, 5, 2); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#5ad35a' : frac > 0.25 ? '#ffc93c' : '#ff5a4a';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 3);
  }

  const portraitCache = {};
  function portrait(id, team, size) {
    const key = id + team + (size || 64);
    if (portraitCache[key]) return portraitCache[key];
    const s = size || 64;
    const c = document.createElement('canvas'); c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    const u = CB.UNITS[id];
    ctx.fillStyle = team === 'red' ? '#ffd9d6' : '#d8e6ff';
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, 7); ctx.clip();
    drawUnit(ctx, u.look, s / 2 - 2, s * 0.98, s / 26, 1, { team });
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 2, 0, 7); ctx.stroke();
    const url = c.toDataURL();
    portraitCache[key] = url;
    return url;
  }

  // ---------- Projectiles ----------
  function drawProjectile(ctx, p, t) {
    const sz = p.size;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
    switch (p.kind) {
      case 'bomb': case 'cluster': case 'bomblet': {
        const s = p.kind === 'bomblet' ? 5 : sz;
        ctx.fillStyle = p.kind === 'bomb' ? '#2b2b38' : '#b23a3a';
        ctx.beginPath(); ctx.arc(0, 0, s, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = (Math.floor(t * 20) % 2) ? '#ffd34d' : '#ff6a2a'; ctx.beginPath(); ctx.arc(s * 0.6, -s * 0.8, 2.5, 0, 7); ctx.fill();
        break; }
      case 'pellet':
        ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(0, 0, sz, 0, 7); ctx.fill(); ctx.stroke(); break;
      case 'axe':
        ctx.rotate(t * 18 * (p.vx > 0 ? 1 : -1));
        ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.stroke();
        ctx.fillStyle = '#c9d1d9'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(10, -7, 7, 1); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      case 'arrow': {
        const a = Math.atan2(p.vy, p.vx); ctx.rotate(a);
        ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.fillStyle = '#c9d1d9'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-11, -2.5, 4, 5);
        break; }
      case 'boulder':
        ctx.rotate(t * 6);
        ctx.fillStyle = '#8f8a80'; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const rr_ = sz * (0.85 + 0.15 * Math.sin(i * 2.3)); ctx.lineTo(Math.cos(a) * rr_, Math.sin(a) * rr_); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(3, 3, sz * 0.35, 0, 7); ctx.fill();
        break;
      case 'fire': case 'lava': {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, sz * 1.8);
        g.addColorStop(0, '#fff3a0'); g.addColorStop(0.4, '#ff9a2a'); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, sz * 1.8, 0, 7); ctx.fill();
        ctx.fillStyle = p.kind === 'lava' ? '#7a2a1a' : '#ff6a2a'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.8, 0, 7); ctx.fill(); ctx.stroke();
        break; }
      case 'orb': {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, sz * 2.2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9a6ff'); g.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, sz * 2.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#8a5cff'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.7, 0, 7); ctx.fill();
        break; }
      case 'rock':
        ctx.rotate(t * 4); ctx.fillStyle = '#9a8f80'; ctx.beginPath(); ctx.arc(0, 0, sz, 0, 7); ctx.fill(); ctx.stroke(); break;
    }
    ctx.restore();
  }

  return { OUT, TEAM, rr, hash, makeGround, drawBackground, drawGround, drawCastle, drawUnit, drawHpBar, portrait, drawProjectile, SOLID };
})();
