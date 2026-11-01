// UI: menus, squad, forge, arenas, matchmaking, battle HUD, results. Telegram WebApp integration.
(function () {
  const $ = (id) => document.getElementById(id);
  const tg = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const tgv = (v) => { try { return tg.isVersionAtLeast(v); } catch (e) { return false; } };
  let S = null; // save data
  let tab = 'home';
  let match = null; // { opp, ... }
  let hintStage = 0;

  // ---------------- Telegram ----------------
  function initTelegram() {
    if (!tg) return;
    try {
      tg.ready(); tg.expand();
      if (tgv('6.1')) { tg.setHeaderColor('#1d2340'); tg.setBackgroundColor('#7fe0e6'); tg.BackButton.onClick(onBack); }
      if (tgv('7.7')) tg.disableVerticalSwipes();
    } catch (e) { /* older clients */ }
  }
  function tgUser() { try { return tg && tg.initDataUnsafe && tg.initDataUnsafe.user; } catch (e) { return null; } }
  function onBack() {
    if (!$('modal').classList.contains('hidden') && CB.Battle.state && !CB.Battle.state.over) { closeModal(); CB.Battle.pause(false); return; }
    if (!$('hud').classList.contains('hidden')) { openPause(); return; }
    if (!$('match').classList.contains('hidden')) { cancelMatch(); return; }
    if (tab !== 'home') setTab('home');
  }
  function syncBackButton() {
    if (!tg || !tgv('6.1')) return;
    const show = tab !== 'home' || !$('hud').classList.contains('hidden') || !$('match').classList.contains('hidden');
    try { show ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* ignore */ }
  }

  // ---------------- Helpers ----------------
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
  }
  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function initials(name) { return (name || '?').trim().charAt(0).toUpperCase(); }
  function xpNeed(lv) { return 80 + lv * 40; }
  function owned(id) { return S.units[id] > 0; }
  function nextLeague(tr) { return CB.LEAGUES.find((l) => l.min > tr); }
  function save() { CB.Save.save(); }
  function click() { CB.Audio.play('click'); CB.haptic('light'); }
  function arenaIndex(a) { return CB.ARENAS.indexOf(a); }

  // ---------------- Loading ----------------
  async function boot() {
    initTelegram();
    $('loadfill').style.width = '30%';
    const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    S = await CB.Save.load();
    $('loadfill').style.width = '70%';
    const u = tgUser();
    if (u && u.first_name && (S.name === 'Игрок' || !S.name)) S.name = u.first_name.slice(0, 16);
    CB.Audio.setEnabled(S.sound !== false);
    // pre-render portraits
    for (const id of CB.UNIT_ORDER) { CB.Art.portrait(id, 'blue', 64); CB.Art.portrait(id, 'red', 64); }
    await fontsReady;
    CB.Battle.setup($('game'), { onHud: updateHud, onBanner: showBanner, onEnd: onBattleEnd, onTick: onTick, onAimStart: () => hideHint(), onAimEnd: () => {} });
    $('loadfill').style.width = '100%';
    setTimeout(() => { $('loadfill').parentElement.classList.add('hidden'); $('btn-start').classList.remove('hidden'); }, 250);
  }
  $('btn-start').addEventListener('click', () => {
    CB.Audio.init(); click();
    $('loading').classList.add('hidden');
    showMenu();
  });

  // ---------------- Menu ----------------
  function showMenu() {
    $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('match').classList.add('hidden');
    $('game').style.visibility = 'hidden';
    renderTop(); setTab(tab);
  }
  function renderTop() {
    $('m-name').textContent = S.name; $('m-avatar').firstChild.nodeValue = initials(S.name);
    $('m-level').textContent = S.level;
    $('m-xp').style.width = Math.min(100, S.xp / xpNeed(S.level) * 100) + '%';
    $('m-trophies').textContent = fmt(S.trophies); $('m-coins').textContent = fmt(S.coins);
    $('btn-sound').textContent = S.sound === false ? '🔇' : '🔊';
    const lg = CB.leagueFor(S.trophies), nx = nextLeague(S.trophies), ar = CB.arenaFor(S.trophies);
    $('m-league').textContent = 'Лига: ' + lg.name;
    $('m-arena').textContent = 'Арена: ' + ar.name;
    $('m-badge').style.background = lg.color; $('m-badge').firstChild.textContent = lg.name.charAt(0);
    if (nx) {
      $('m-prog').style.width = ((S.trophies - lg.min) / (nx.min - lg.min) * 100) + '%';
      $('m-next').textContent = 'До лиги «' + nx.name + '»: ' + (nx.min - S.trophies) + ' кубков';
    } else { $('m-prog').style.width = '100%'; $('m-next').textContent = 'Высшая лига достигнута'; }
    const ready = forgeReady();
    $('nav').querySelector('[data-tab="forge"]').style.color = ready ? '#ffc93c' : '';
  }
  $('btn-sound').addEventListener('click', () => {
    S.sound = S.sound === false; CB.Audio.init(); CB.Audio.setEnabled(S.sound); save(); renderTop(); click();
  });
  $('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return; click(); setTab(b.dataset.tab);
  });
  $('league-card').addEventListener('click', () => { click(); setTab('arena'); });

  function setTab(t) {
    tab = t;
    for (const b of $('nav').querySelectorAll('button')) b.classList.toggle('active', b.dataset.tab === t);
    const sheet = $('sheet');
    if (t === 'home') { sheet.classList.add('hidden'); $('home').classList.remove('hidden'); }
    else {
      sheet.classList.remove('hidden'); $('home').classList.add('hidden');
      if (t === 'squad') renderSquad(); else if (t === 'forge') renderForge(); else renderArenas();
    }
    syncBackButton();
  }

  // ---------------- Squad ----------------
  function renderSquad() {
    const el = $('sheet-inner'); const keep = el.scrollTop;
    let h = '<h2>Отряд</h2><div class="sub">Выберите от ' + CB.DECK_MIN + ' до ' + CB.DECK_MAX + ' юнитов для боя. Юниты из отряда занимают комнаты замка.</div>';
    h += '<div class="section-title"><span>В бою (' + S.deck.length + '/' + CB.DECK_MAX + ')</span></div><div class="deck-row">';
    for (let i = 0; i < CB.DECK_MAX; i++) {
      const id = S.deck[i];
      h += id ? '<div class="deck-slot filled" data-rm="' + id + '"><img alt="" src="' + CB.Art.portrait(id, 'blue', 64) + '"></div>' : '<div class="deck-slot"></div>';
    }
    h += '</div><div class="section-title"><span>Все юниты</span><span class="pill" style="font-size:13px"><span class="ico ico-coin"></span>' + fmt(S.coins) + '</span></div><div class="unit-grid">';
    for (const id of CB.UNIT_ORDER) {
      const u = CB.UNITS[id]; const lv = S.units[id] || 0; const inDeck = S.deck.includes(id);
      const st = CB.unitStats(id, Math.max(1, lv));
      const locked = !lv;
      h += '<div class="ucard' + (inDeck ? ' in-deck' : '') + (locked ? ' locked' : '') + '">';
      if (!locked) h += '<div class="lv">Ур. ' + lv + '</div>';
      h += '<div class="top"><img alt="" src="' + CB.Art.portrait(id, 'blue', 64) + '"><div><div class="nm">' + u.name + '</div><div class="rl">' + u.role + '</div></div></div>';
      h += '<div class="ds">' + u.desc + '</div>';
      h += '<div class="st"><span>❤ ' + st.hp + '</span>' + (st.proj ? '<span>💥 ' + Math.round(st.proj.unit) + '</span>' : '<span>✚ ' + (st.heal || st.repair + ' бл.') + '</span>') + '<span>⟳ ' + (u.cd ? u.cd + ' х.' : 'нет') + '</span></div>';
      h += '<div class="perk">' + (lv >= 3 ? '✓' : '🔒') + ' Ур. 3: +15% радиус' + '<br>' + (lv >= 6 ? '✓' : '🔒') + ' Ур. 6: ' + u.perk6 + '</div>';
      if (locked) {
        const fi = CB.FORGE_TRACK.findIndex((r) => r.unit === id);
        h += '<div class="acts"><span class="rl">Открывается в Кузнице (' + (fi >= 0 ? CB.FORGE_TRACK[fi].pts : '?') + ' очков)</span></div>';
      } else {
        const cost = CB.upgradeCost(lv); const max = lv >= CB.MAX_UNIT_LEVEL;
        h += '<div class="acts"><button class="btn btn-small ' + (inDeck ? '' : 'btn-blue') + '" data-toggle="' + id + '">' + (inDeck ? 'Убрать' : 'В отряд') + '</button>';
        h += '<button class="btn btn-small btn-gold" data-up="' + id + '"' + (max || S.coins < cost ? ' disabled' : '') + '>' + (max ? 'Макс.' : '▲ ' + cost) + '</button></div>';
      }
      h += '</div>';
    }
    h += '</div>';
    el.innerHTML = h; el.scrollTop = keep;
  }
  $('sheet-inner').addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle],[data-up],[data-rm],[data-cup],[data-claim]'); if (!t) return;
    if (t.dataset.toggle || t.dataset.rm) {
      const id = t.dataset.toggle || t.dataset.rm;
      const i = S.deck.indexOf(id);
      if (i >= 0) { if (S.deck.length <= CB.DECK_MIN) { toast('В отряде должно быть минимум ' + CB.DECK_MIN + ' юнита'); return; } S.deck.splice(i, 1); }
      else { if (S.deck.length >= CB.DECK_MAX) { toast('Отряд полон: максимум ' + CB.DECK_MAX); return; } S.deck.push(id); }
      click(); save(); renderSquad();
    } else if (t.dataset.up) {
      const id = t.dataset.up; const lv = S.units[id]; const cost = CB.upgradeCost(lv);
      if (S.coins < cost) return;
      S.coins -= cost; S.units[id] = lv + 1; S.forgePts++;
      CB.Audio.play('coin'); CB.haptic('success');
      toast(CB.UNITS[id].name + ' — уровень ' + (lv + 1) + (lv + 1 === 3 || lv + 1 === 6 ? '. Открыт новый перк' : '') + '. +1 очко Кузницы');
      save(); renderTop(); renderSquad();
    } else if (t.dataset.cup) {
      const k = t.dataset.cup; const def = CB.CASTLE_UPGRADES[k]; const lv = S.castle[k]; const cost = def.cost(lv);
      if (S.coins < cost || lv >= def.max) return;
      S.coins -= cost; S.castle[k] = lv + 1; S.forgePts++;
      CB.Audio.play('repair'); CB.haptic('success'); toast(def.name + ' — уровень ' + (lv + 1) + '. +1 очко Кузницы');
      save(); renderTop(); renderForge();
    } else if (t.dataset.claim) {
      claimForge(); renderTop(); renderForge();
    }
  });

  // ---------------- Forge ----------------
  function forgeReady() { const r = CB.FORGE_TRACK[S.forgeClaimed]; return r && S.forgePts >= r.pts; }
  function claimForge() {
    let got = [];
    while (forgeReady()) {
      const r = CB.FORGE_TRACK[S.forgeClaimed];
      S.coins += r.coins || 0; got.push('+' + r.coins + ' монет');
      if (r.unit && !owned(r.unit)) { S.units[r.unit] = 1; if (S.deck.length < CB.DECK_MAX) S.deck.push(r.unit); got.push('новый юнит: ' + CB.UNITS[r.unit].name); }
      S.forgeClaimed++;
    }
    if (got.length) { CB.Audio.play('win'); CB.haptic('success'); toast('Награда Кузницы: ' + got.join(', ')); save(); }
  }
  function renderForge() {
    const el = $('sheet-inner'); const keep = el.scrollTop;
    const icons = { walls: '🧱', towers: '🏯', armor: '🛡️' };
    let h = '<h2>Кузница</h2><div class="sub">Каждое улучшение юнита или замка приносит очко Кузницы. Копите очки и забирайте награды: монеты и новых юнитов.</div>';
    h += '<div class="section-title"><span>Награды · ' + S.forgePts + ' очков</span>' + (forgeReady() ? '<button class="btn btn-small btn-green" data-claim="1">Забрать</button>' : '') + '</div><div class="forge-track">';
    CB.FORGE_TRACK.forEach((r, i) => {
      const cls = i < S.forgeClaimed ? 'done' : (S.forgePts >= r.pts ? 'ready' : '');
      h += '<div class="reward ' + cls + '"><div class="rp">' + r.pts + ' оч.</div>';
      h += r.unit ? '<img alt="" src="' + CB.Art.portrait(r.unit, 'blue', 64) + '"><div class="rv">' + CB.UNITS[r.unit].name + '</div>' : '<div class="rv" style="padding-top:8px">💰<br>' + r.coins + '</div>';
      h += '<div class="rl" style="font-size:11px;font-weight:900">' + (i < S.forgeClaimed ? 'Получено' : (cls ? 'Готово' : '')) + '</div></div>';
    });
    h += '</div><div class="section-title"><span>Улучшения замка</span><span class="pill" style="font-size:13px"><span class="ico ico-coin"></span>' + fmt(S.coins) + '</span></div>';
    for (const k of Object.keys(CB.CASTLE_UPGRADES)) {
      const d = CB.CASTLE_UPGRADES[k]; const lv = S.castle[k]; const max = lv >= d.max; const cost = d.cost(lv);
      let pips = ''; for (let i = 1; i <= d.max; i++) pips += '<i class="' + (i <= lv ? 'on' : '') + '"></i>';
      h += '<div class="up-row"><div class="up-ico">' + icons[k] + '</div><div class="up-info"><div class="nm">' + d.name + ' · ур. ' + lv + '</div><div class="ds">' + d.desc + '</div><div class="pips">' + pips + '</div></div>';
      h += '<button class="btn btn-small btn-gold" data-cup="' + k + '"' + (max || S.coins < cost ? ' disabled' : '') + '>' + (max ? 'Макс.' : '▲ ' + cost) + '</button></div>';
    }
    el.innerHTML = h; el.scrollTop = keep;
  }

  // ---------------- Arenas / leagues / leaderboard ----------------
  function seasonInfo() {
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { n: (now.getFullYear() - 2026) * 12 + now.getMonth() + 1, days: Math.ceil((end - now) / 86400000), seed: start.getTime() / 86400000 };
  }
  function leaderboard() {
    const si = seasonInfo(); let seed = si.seed;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rows = CB.BOT_NAMES.map((n) => ({ name: n, tr: Math.round(150 + rnd() * 3600) }));
    for (let i = 0; i < 24; i++) rows.push({ name: CB.BOT_NAMES[i % CB.BOT_NAMES.length] + (10 + Math.floor(rnd() * 89)), tr: Math.round(rnd() * 1400) });
    rows.push({ name: S.name + ' (вы)', tr: S.trophies, me: true });
    rows.sort((a, b) => b.tr - a.tr);
    return rows;
  }
  function renderArenas() {
    const el = $('sheet-inner');
    const si = seasonInfo();
    let h = '<h2>Арены и лиги</h2><div class="sub">Побеждайте, чтобы получать кубки. Новые арены открываются с ростом кубков и приносят особые опасности.</div>';
    h += '<div class="section-title"><span>Арены</span></div><div class="ladder">';
    const cur = CB.arenaFor(S.trophies);
    for (const a of CB.ARENAS) {
      const lock = S.trophies < a.min;
      h += '<div class="lrow' + (a === cur ? ' cur' : '') + (lock ? ' locked' : '') + '"><div class="lb" style="background:' + a.pal.ground + '"></div><div class="lt">' + a.name + '<small>' + a.hazardText + '</small></div><div class="lm">' + (lock ? '🔒 ' : '') + a.min + ' 🏆</div></div>';
    }
    h += '</div><div class="section-title"><span>Лиги</span></div><div class="ladder">';
    const lg = CB.leagueFor(S.trophies);
    for (const l of CB.LEAGUES) {
      h += '<div class="lrow' + (l === lg ? ' cur' : '') + (S.trophies < l.min ? ' locked' : '') + '"><div class="lb" style="background:' + l.color + '"></div><div class="lt">' + l.name + '</div><div class="lm">' + l.min + '+ 🏆</div></div>';
    }
    h += '</div><div class="section-title"><span>Сезон ' + si.n + ' · таблица лидеров</span><span class="rl" style="font-size:12px;color:#6b7091">ещё ' + si.days + ' дн.</span></div><div class="board">';
    const rows = leaderboard(); const myIdx = rows.findIndex((r) => r.me);
    rows.forEach((r, i) => {
      if (i < 10 || Math.abs(i - myIdx) <= 1) {
        if (i >= 10 && i === myIdx - 1 && myIdx - 1 > 10) h += '<div class="brow sep">…</div>';
        h += '<div class="brow' + (r.me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span><span>' + escapeHtml(r.name) + '</span><span class="tr">' + fmt(r.tr) + ' 🏆</span></div>';
      }
    });
    h += '</div><div class="sub" style="margin-top:14px">Победы: ' + S.wins + ' · Поражения: ' + S.losses + ' · Рекорд: ' + S.bestTrophies + ' 🏆</div>';
    h += '<button class="btn btn-small" id="btn-reset" style="margin-top:6px">Сбросить прогресс</button>';
    el.innerHTML = h;
    $('btn-reset').addEventListener('click', () => {
      modal('<h3>Сбросить прогресс?</h3><div class="result-reason">Кубки, монеты и юниты вернутся к началу.</div><div class="btn-row"><button class="btn" data-m="no">Отмена</button><button class="btn btn-red" data-m="yes">Сбросить</button></div>', (a) => {
        closeModal(); if (a === 'yes') { const name = S.name; CB.Save.reset(); S = CB.Save.get(); S.name = name; save(); renderTop(); setTab('home'); toast('Прогресс сброшен'); }
      });
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------------- Modal ----------------
  let modalCb = null;
  function modal(html, cb) { $('modal-box').innerHTML = html; $('modal').classList.remove('hidden'); modalCb = cb; }
  function closeModal() { $('modal').classList.add('hidden'); modalCb = null; }
  $('modal').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b && modalCb) { click(); modalCb(b.dataset.m); } });

  // ---------------- Matchmaking ----------------
  let mmTimers = [];
  $('btn-battle').addEventListener('click', () => {
    click();
    if (S.deck.length < CB.DECK_MIN) { toast('Соберите отряд минимум из ' + CB.DECK_MIN + ' юнитов'); setTab('squad'); return; }
    startMatchmaking();
  });
  $('btn-cancel-mm').addEventListener('click', () => { click(); cancelMatch(); });
  function cancelMatch() { mmTimers.forEach(clearTimeout); mmTimers = []; $('match').classList.add('hidden'); showMenu(); }
  function makeOpponent() {
    const tr = Math.max(0, S.trophies + Math.round((Math.random() - 0.45) * 120));
    const pool = CB.UNIT_ORDER.filter((id) => {
      const ai = CB.UNITS[id].unlock - 1; return ai <= arenaIndex(CB.arenaFor(S.trophies)) + 1;
    });
    const size = Math.min(CB.DECK_MAX, Math.max(4, S.deck.length + (Math.random() < 0.4 ? 1 : 0) - (Math.random() < 0.3 ? 1 : 0)));
    const avgLv = S.deck.reduce((a, id) => a + S.units[id], 0) / S.deck.length;
    const ids = [];
    const must = ['wrecker', 'scout'];
    for (const m of must) if (pool.includes(m)) ids.push(m);
    const rest = pool.filter((id) => !ids.includes(id)).sort(() => Math.random() - 0.5);
    while (ids.length < size && rest.length) ids.push(rest.shift());
    const deck = ids.map((id) => ({ id, level: Math.max(1, Math.min(CB.MAX_UNIT_LEVEL, Math.round(avgLv + (Math.random() - 0.5) * 1.6))) }));
    const cu = {}; for (const k of Object.keys(S.castle)) cu[k] = Math.max(1, S.castle[k] + Math.round((Math.random() - 0.5) * 2));
    return { name: CB.BOT_NAMES[Math.floor(Math.random() * CB.BOT_NAMES.length)], trophies: tr, deck, castle: cu };
  }
  function startMatchmaking() {
    $('menu').classList.add('hidden'); $('match').classList.remove('hidden');
    $('mm-search').classList.remove('hidden'); $('mm-found').classList.add('hidden'); $('btn-cancel-mm').classList.remove('hidden');
    const arena = CB.arenaFor(S.trophies);
    $('mm-arena').textContent = 'Арена: ' + arena.name + ' · ' + CB.leagueFor(S.trophies).name;
    syncBackButton();
    const opp = makeOpponent();
    mmTimers.push(setTimeout(() => {
      CB.Audio.play('select'); CB.haptic('medium');
      $('mm-search').classList.add('hidden'); $('mm-found').classList.remove('hidden'); $('btn-cancel-mm').classList.add('hidden');
      $('vs-me').textContent = S.name; $('vs-me-av').textContent = initials(S.name); $('vs-me-tr').textContent = fmt(S.trophies) + ' 🏆';
      $('vs-op').textContent = opp.name; $('vs-op-av').textContent = initials(opp.name); $('vs-op-tr').textContent = fmt(opp.trophies) + ' 🏆';
      mmTimers.push(setTimeout(() => startBattle(opp, arena), 1700));
    }, 1300 + Math.random() * 1500));
  }

  // ---------------- Battle ----------------
  function startBattle(opp, arena) {
    mmTimers = [];
    match = { opp, arena, startTrophies: S.trophies };
    $('match').classList.add('hidden'); $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
    $('game').style.visibility = 'visible';
    $('h-pname').textContent = S.name; $('h-pav').textContent = initials(S.name); $('h-ptr').textContent = fmt(S.trophies) + ' 🏆';
    $('h-ename').textContent = opp.name; $('h-eav').textContent = initials(opp.name); $('h-etr').textContent = fmt(opp.trophies) + ' 🏆';
    hintStage = S.tutorialDone ? 99 : 0;
    // narrow (portrait) screens: bring castles closer so they read bigger
    const ar = window.innerWidth / window.innerHeight;
    const gap = ar < 0.8 ? 500 : ar < 1.3 ? 560 : 640;
    CB.WORLD.leftX = 550 - gap / 2; CB.WORLD.rightX = 550 + gap / 2;
    const skill = Math.min(0.92, 0.3 + S.trophies / 3200 + (S.level - 1) * 0.01);
    CB.Battle.start({
      arena, aiSkill: skill,
      playerDeck: S.deck.map((id) => ({ id, level: S.units[id] })),
      enemyDeck: opp.deck,
      playerCastle: S.castle, enemyCastle: opp.castle,
      playerBlueprint: Math.min(CB.BLUEPRINTS.length - 1, Math.floor(S.level / 3) % CB.BLUEPRINTS.length),
      enemyBlueprint: Math.floor(Math.random() * CB.BLUEPRINTS.length),
    });
    buildCards(); layoutInsets(); syncBackButton();
    CB.haptic('heavy');
  }
  function layoutInsets() {
    const top = document.querySelector('.hud-top').getBoundingClientRect().bottom + 6;
    const bottom = window.innerHeight - document.querySelector('.hud-bottom').getBoundingClientRect().top;
    CB.Battle.setInsets(top, bottom);
  }
  window.addEventListener('resize', () => { if (!$('hud').classList.contains('hidden')) layoutInsets(); });
  if (tg && tg.onEvent) try { tg.onEvent('viewportChanged', () => { if (!$('hud').classList.contains('hidden')) layoutInsets(); }); } catch (e) { /* ignore */ }

  let cardEls = [];
  function buildCards() {
    const B = CB.Battle.state; const wrap = $('cards'); wrap.innerHTML = ''; cardEls = [];
    B.castles.player.units.forEach((u) => {
      const d = document.createElement('button'); d.className = 'card';
      d.innerHTML = '<span class="lvb">' + u.stats.level + '</span>' + (u.stats.support ? '<span class="sup">✚</span>' : '') + '<img alt="" src="' + CB.Art.portrait(u.id, 'blue', 64) + '"><div class="cn">' + u.stats.name + '</div><div class="hpb"><div></div></div>';
      d.addEventListener('click', () => {
        if (!u.alive) { toast(u.stats.name + ' выбыл из боя'); return; }
        if (u.cdLeft > 0) { toast('Перезарядка: ещё ' + u.cdLeft + ' х.'); return; }
        const B = CB.Battle.state;
        if (B.phase !== 'playerAim') { toast('Дождитесь своего хода'); return; }
        CB.Battle.selectUnit(u);
      });
      wrap.appendChild(d); cardEls.push({ el: d, u });
    });
    const mini = (side, el, team) => { $(el).innerHTML = B.castles[side].units.map((u) => '<img alt="" src="' + CB.Art.portrait(u.id, team, 64) + '">').join(''); };
    mini('player', 'h-pminis', 'blue'); mini('enemy', 'h-eminis', 'red');
    updateHud();
  }
  function updateHud() {
    const B = CB.Battle.state; if (!B || $('hud').classList.contains('hidden')) return;
    const pp = Math.round(B.castles.player.hpFrac() * 100), ep = Math.round(B.castles.enemy.hpFrac() * 100);
    $('h-ppct').textContent = pp + '%'; $('h-epct').textContent = ep + '%';
    // bar shows remaining until collapse threshold (25%)
    $('h-pbar').style.width = Math.max(0, (pp - 25) / 75 * 100) + '%';
    $('h-ebar').style.width = Math.max(0, (ep - 25) / 75 * 100) + '%';
    $('h-round').textContent = 'Раунд ' + B.round + '/' + CB.WORLD.maxRounds;
    const w = $('h-wind');
    if (B.wind) { w.classList.remove('hidden'); w.textContent = 'Ветер ' + (B.wind > 0 ? '→' : '←') + ' ' + Math.abs(B.wind); } else w.classList.add('hidden');
    const pm = $('h-pminis').children, em = $('h-eminis').children;
    B.castles.player.units.forEach((u, i) => pm[i] && pm[i].classList.toggle('dead', !u.alive));
    B.castles.enemy.units.forEach((u, i) => em[i] && em[i].classList.toggle('dead', !u.alive));
    const myTurn = B.phase === 'playerAim';
    for (const { el, u } of cardEls) {
      el.classList.toggle('sel', myTurn && B.selected === u);
      el.classList.toggle('dead', !u.alive); el.classList.toggle('cd', u.alive && u.cdLeft > 0);
      el.querySelector('.hpb > div').style.width = Math.max(0, u.hp / u.maxhp * 100) + '%';
      let cd = el.querySelector('.cdb');
      const txt = !u.alive ? '✖' : (u.cdLeft > 0 ? u.cdLeft : '');
      if (txt !== '') { if (!cd) { cd = document.createElement('div'); cd.className = 'cdb'; el.appendChild(cd); } cd.textContent = txt; } else if (cd) cd.remove();
      if (myTurn && B.selected === u && el.scrollIntoView && !el._vis) { el._vis = true; } else if (B.selected !== u) el._vis = false;
    }
    const sup = myTurn && B.selected && B.selected.stats.support;
    $('btn-use').classList.toggle('hidden', !sup);
    if (sup) $('btn-use').textContent = B.selected.stats.support === 'heal' ? 'Лечить отряд (+' + B.selected.stats.heal + ')' : 'Починить замок (' + B.selected.stats.repair + ' бл.)';
    updateHint();
  }
  $('btn-use').addEventListener('click', () => { click(); CB.Battle.useSupport(); });
  let lastTimer = -1;
  function onTick() {
    const B = CB.Battle.state; if (!B) return;
    const t = $('h-timer');
    let v;
    if (B.phase === 'playerAim') { v = Math.max(0, Math.ceil(B.timer)); t.classList.toggle('low', v <= 5); t.classList.remove('enemy'); }
    else { v = B.turn === 'enemy' ? '…' : '–'; t.classList.remove('low'); t.classList.toggle('enemy', B.turn === 'enemy'); }
    if (v !== lastTimer) { t.textContent = v; lastTimer = v; }
  }

  // ---------------- Tutorial hints ----------------
  function updateHint() {
    const B = CB.Battle.state; const h = $('hint');
    if (!B || B.phase !== 'playerAim' || hintStage >= 99) { h.classList.add('hidden'); return; }
    let msg = '';
    if (B.selected && B.selected.stats.support) msg = 'Юнит поддержки: нажмите «Применить»';
    else if (hintStage === 0) msg = '<span class="hand">👆</span> Потяните назад от замка, чтобы прицелиться. Отпустите — выстрел';
    else if (hintStage === 1) msg = 'Бейте по нижнему ярусу: без опоры верхние этажи рухнут вместе с юнитами';
    else if (hintStage === 2) msg = 'Выбирайте юнитов снизу. После выстрела у многих перезарядка';
    else { h.classList.add('hidden'); return; }
    h.innerHTML = msg; h.classList.remove('hidden');
  }
  function hideHint() { $('hint').classList.add('hidden'); }

  // ---------------- Banners ----------------
  let bannerT = null;
  function showBanner(text, sub, ms) {
    const b = $('banner'); $('banner-t').textContent = text;
    const s = $('banner-s'); if (sub) { s.textContent = sub; s.classList.remove('hidden'); } else s.classList.add('hidden');
    b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.add('hidden'), ms || 1100);
    if (text === 'Ход соперника' && hintStage < 99) { hintStage++; if (hintStage >= 3) { S.tutorialDone = true; save(); } }
  }

  // ---------------- Pause ----------------
  $('btn-pause').addEventListener('click', () => { click(); openPause(); });
  function openPause() {
    const B = CB.Battle.state; if (!B || B.over) return;
    CB.Battle.pause(true);
    modal('<h3>Пауза</h3><div class="stack"><button class="btn btn-green" data-m="go">Продолжить</button><button class="btn" data-m="snd">' + (S.sound === false ? 'Включить звук' : 'Выключить звук') + '</button><button class="btn btn-red" data-m="give">Сдаться</button></div>', (a) => {
      if (a === 'go') { closeModal(); CB.Battle.pause(false); }
      else if (a === 'snd') { S.sound = S.sound === false; CB.Audio.setEnabled(S.sound); save(); closeModal(); openPause(); }
      else if (a === 'give') { closeModal(); CB.Battle.pause(false); CB.Battle.surrender(); }
    });
  }
  document.addEventListener('visibilitychange', () => {
    const B = CB.Battle.state;
    if (document.hidden && B && !B.over && !$('hud').classList.contains('hidden') && $('modal').classList.contains('hidden')) openPause();
  });

  // ---------------- Results ----------------
  function onBattleEnd(res) {
    const B = CB.Battle.state;
    const win = res.win;
    const stars = win ? 1 + (res.enemyPct <= 0.4 ? 1 : 0) + (res.playerPct >= 0.75 ? 1 : 0) : 0;
    const surrendered = res.reason === 'Вы сдались';
    const dTr = win ? 26 + Math.floor(Math.random() * 7) + (stars === 3 ? 4 : 0) : (surrendered ? -20 : -Math.min(S.trophies, 14 + Math.floor(Math.random() * 5)));
    const coins = win ? 55 + stars * 25 + arenaIndex(match.arena) * 15 : (surrendered ? 0 : 20);
    const xp = win ? 30 + stars * 10 : 12;
    const prevArena = arenaIndex(CB.arenaFor(S.trophies)); const prevLeague = CB.leagueFor(S.trophies);
    S.trophies = Math.max(0, S.trophies + dTr); S.bestTrophies = Math.max(S.bestTrophies, S.trophies);
    S.coins += coins; S.xp += xp; win ? S.wins++ : S.losses++;
    let levelUp = false;
    while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; levelUp = true; S.coins += 100; }
    const newArena = arenaIndex(CB.arenaFor(S.trophies)) > prevArena ? CB.arenaFor(S.trophies) : null;
    const newLeague = CB.leagueFor(S.trophies) !== prevLeague && S.trophies > match.startTrophies ? CB.leagueFor(S.trophies) : null;
    save();

    let h = '<div class="result-title ' + (win ? 'win' : 'lose') + '">' + (win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ') + '</div>';
    h += '<div class="result-reason">' + res.reason + '</div>';
    if (win) { h += '<div class="stars">'; for (let i = 0; i < 3; i++) h += '<span class="' + (i < stars ? '' : 'off') + '">⭐</span>'; h += '</div>'; }
    h += '<div class="rewards"><span class="pill"><span class="ico ico-cup">🏆</span>' + (dTr >= 0 ? '+' : '') + dTr + '</span><span class="pill"><span class="ico ico-coin"></span>+' + coins + '</span><span class="pill">XP +' + xp + '</span></div>';
    if (levelUp) h += '<div class="unlock-note">Новый уровень игрока: ' + S.level + ' · +100 монет</div>';
    if (newArena) h += '<div class="unlock-note">Открыта арена «' + newArena.name + '»</div>';
    if (newLeague) h += '<div class="unlock-note">Новая лига: ' + newLeague.name + '</div>';
    h += '<div class="result-stats">Ваш замок: ' + Math.round(res.playerPct * 100) + '% · Замок соперника: ' + Math.round(res.enemyPct * 100) + '%<br>Раундов: ' + res.rounds + ' · Выстрелов: ' + (res.stats.shots || 0) + ' · Сбито юнитов: ' + (res.stats.kills || 0) + '</div>';
    h += '<div class="btn-row"><button class="btn" data-m="menu">В меню</button><button class="btn btn-gold" data-m="again">Ещё бой</button></div>';
    if (forgeReady()) h += '<div class="result-reason" style="margin:10px 0 0">В Кузнице ждёт награда</div>';
    modal(h, (a) => {
      closeModal(); CB.Battle.clear(); $('hud').classList.add('hidden'); $('banner').classList.add('hidden');
      if (a === 'again') { $('game').style.visibility = 'hidden'; startMatchmaking(); }
      else showMenu();
    });
  }

  boot();
})();
