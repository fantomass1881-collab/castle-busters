// Procedural sound effects + light background music (Web Audio API, no files needed)
window.CB = window.CB || {};
CB.Audio = (function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let enabled = true, musicOn = true, musicTimer = null, step = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    if (musicOn) startMusic();
  }

  function noiseBuffer(dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return b;
  }

  function tone(freq, dur, type, vol, slideTo, when) {
    if (!ctx) return;
    const t = (when || ctx.currentTime);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, freq, vol, q) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 800; f.Q.value = q || 0.7;
    const g = ctx.createGain(); g.gain.value = vol || 0.4;
    s.connect(f).connect(g).connect(sfxGain); s.start();
  }

  const sfx = {
    click() { tone(660, 0.07, 'triangle', 0.15, 900); },
    select() { tone(520, 0.08, 'triangle', 0.15); tone(780, 0.1, 'triangle', 0.12, null, ctx && ctx.currentTime + 0.06); },
    launch() { noise(0.25, 1800, 0.25); tone(220, 0.25, 'sawtooth', 0.06, 90); },
    whoosh() { noise(0.35, 2600, 0.12, 2); },
    boom(big) { noise(big ? 0.9 : 0.55, big ? 500 : 900, big ? 0.9 : 0.6); tone(big ? 70 : 110, big ? 0.6 : 0.35, 'sine', 0.5, 35); },
    crumble() { noise(0.6, 380, 0.45); },
    hit() { tone(300, 0.12, 'square', 0.08, 140); },
    heal() { [660, 880, 1100].forEach((f, i) => tone(f, 0.25, 'sine', 0.12, null, ctx && ctx.currentTime + i * 0.08)); },
    repair() { [0, 0.12, 0.24].forEach((d) => tone(900, 0.06, 'square', 0.06, 600, ctx && ctx.currentTime + d)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, null, ctx && ctx.currentTime + i * 0.14)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, null, ctx && ctx.currentTime + i * 0.18)); },
    tick() { tone(1200, 0.04, 'square', 0.05); },
    coin() { tone(988, 0.08, 'square', 0.07); tone(1318, 0.18, 'square', 0.07, null, ctx && ctx.currentTime + 0.07); },
  };

  // Tiny looping medieval-ish tune
  const melody = [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 11, 7, 4, 2];
  const bass = [0, 0, -5, -5, -3, -3, -7, -7];
  function startMusic() {
    if (!ctx || musicTimer) return;
    const base = 293.66; // D4
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.05;
      const n = melody[step % melody.length];
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = base * Math.pow(2, n / 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g).connect(musicGain); o.start(t); o.stop(t + 0.4);
      if (step % 2 === 0) {
        const b = bass[(step / 2) % bass.length];
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = 'sine'; o2.frequency.value = base / 2 * Math.pow(2, b / 12);
        g2.gain.setValueAtTime(0.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o2.connect(g2).connect(musicGain); o2.start(t); o2.stop(t + 0.72);
      }
      step++;
    }, 300);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  return {
    init,
    play(name, arg) { if (!ctx || !enabled) return; try { sfx[name] && sfx[name](arg); } catch (e) { /* ignore */ } },
    setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.9 : 0; },
    isEnabled() { return enabled; },
    setMusic(v) { musicOn = v; if (v) startMusic(); else stopMusic(); },
  };
})();

// Telegram haptics helper
CB.haptic = function (kind) {
  try {
    const h = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback;
    if (!h || !Telegram.WebApp.initData || !Telegram.WebApp.isVersionAtLeast('6.1')) return;
    if (kind === 'light' || kind === 'medium' || kind === 'heavy' || kind === 'rigid' || kind === 'soft') h.impactOccurred(kind);
    else if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else h.selectionChanged();
  } catch (e) { /* not in Telegram */ }
};
