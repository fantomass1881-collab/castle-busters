// Player progress: Telegram CloudStorage when running inside Telegram, browser storage otherwise
window.CB = window.CB || {};
CB.Save = (function () {
  const KEY = 'cb_save_v2';
  const defaults = () => ({
    v: 2,
    name: 'Игрок',
    coins: 300,
    trophies: 0,
    bestTrophies: 0,
    xp: 0,
    level: 1,
    wins: 0,
    losses: 0,
    units: { wrecker: 1, scout: 1, knight: 1, archer: 1, fairy: 1 }, // owned unit -> level
    deck: ['wrecker', 'scout', 'knight', 'archer', 'fairy'],
    castle: { walls: 1, towers: 1, armor: 1 },
    forgePts: 0,
    forgeClaimed: 0,
    tutorialDone: false,
    sound: true,
  });
  let data = defaults();

  function tgCloud() {
    try {
      const tg = window.Telegram && Telegram.WebApp;
      if (tg && tg.CloudStorage && tg.initData && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) return tg.CloudStorage;
    } catch (e) { /* no-op */ }
    return null;
  }
  function browserStore() {
    try { const s = window.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) { return null; }
  }

  function merge(obj) {
    const d = defaults();
    if (!obj || typeof obj !== 'object') return d;
    const out = Object.assign(d, obj);
    out.units = Object.assign(defaults().units, obj.units || {});
    out.castle = Object.assign(defaults().castle, obj.castle || {});
    if (!Array.isArray(out.deck) || !out.deck.length) out.deck = defaults().deck;
    out.deck = out.deck.filter((id) => out.units[id]).slice(0, CB.DECK_MAX);
    return out;
  }

  function load() {
    return new Promise((resolve) => {
      const cloud = tgCloud();
      const fromBrowser = () => {
        const s = browserStore();
        if (s) { try { data = merge(JSON.parse(s.getItem(KEY) || 'null')); } catch (e) { data = defaults(); } }
        resolve(data);
      };
      if (cloud) {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; fromBrowser(); } }, 2500);
        try {
          cloud.getItem(KEY, (err, val) => {
            if (done) return; done = true; clearTimeout(timer);
            if (!err && val) { try { data = merge(JSON.parse(val)); resolve(data); return; } catch (e) { /* fallthrough */ } }
            fromBrowser();
          });
        } catch (e) { done = true; clearTimeout(timer); fromBrowser(); }
      } else fromBrowser();
    });
  }

  let pending = null;
  function save() {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const json = JSON.stringify(data);
      const s = browserStore(); if (s) { try { s.setItem(KEY, json); } catch (e) { /* quota */ } }
      const cloud = tgCloud(); if (cloud) { try { cloud.setItem(KEY, json, () => {}); } catch (e) { /* ignore */ } }
    }, 250);
  }

  function reset() { data = defaults(); save(); }

  return { load, save, reset, get: () => data };
})();
