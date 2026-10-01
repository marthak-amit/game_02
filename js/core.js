/* Core services: save data, audio, ads, in-app purchases, analytics. */
const CM = (window.CM = {});

/* ---------- helpers ---------- */
CM.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
CM.fmt = n => Math.floor(n).toLocaleString('en-US');
CM.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
CM.seedFromDate = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- analytics (swap body for Firebase / GameAnalytics later) ---------- */
CM.track = (name, params) => { (CM.track.log = CM.track.log || []).push({ t: Date.now(), name, params }); if (CM.debug) console.debug('[track]', name, params || ''); };

/* ---------- save data ---------- */
CM.save = (() => {
  const KEY = 'cosmicmerge_v1';
  const def = { coins: 300, best: 0, daily: { date: '', score: 0 }, items: { hammer: 2, shake: 2 }, skins: ['cosmic'], skin: 'cosmic',
    noAds: false, maxEver: -1, sound: true, music: true, missions: { date: '', list: [] }, haptics: true, streak: 0, lastClaim: '', games: 0, lastInterstitial: 0, adsToday: { date: '', n: 0 } };
  let d;
  try { d = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { d = JSON.parse(JSON.stringify(def)); }
  const api = { d, write() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); } };
  return api;
})();

/* ---------- audio (fully synthesized, no asset files) ---------- */
CM.audio = {
  ctx: null, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination); } catch (e) {}
  },
  on() { return CM.save.d.sound && this.ctx; },
  tone(f, dur, type = 'sine', vol = 0.3, slideTo = 0, delay = 0) {
    if (!this.on()) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, hp = 800) {
    if (!this.on()) return; const c = this.ctx, n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  pop(level, combo = 0) { const base = 330 * Math.pow(2, (level * 2 + combo) / 12); this.tone(base, 0.18, 'triangle', 0.32, base * 1.5); this.tone(base * 2, 0.12, 'sine', 0.12, 0, 0.03); },
  drop() { this.tone(180, 0.09, 'sine', 0.25, 90); },
  hit(v) { const n = performance.now(); if (n - (this._h || 0) < 70) return; this._h = n; if (v > 160) this.tone(120 + Math.random() * 40, 0.06, 'sine', Math.min(0.18, v / 2500), 70); },
  click() { this.tone(520, 0.06, 'square', 0.08, 780); },
  coin() { this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.18, 'square', 0.1, 0, 0.07); },
  boom() { this.noise(0.5, 0.35, 200); this.tone(90, 0.4, 'sawtooth', 0.25, 40); },
  over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.25, f * 0.97, i * 0.16)); },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.25, 0, i * 0.09)); },
  /* ---- calm generative music: soft pads + bass + dreamy plucks through a delay ---- */
  mus: null,
  musicSwitch() {
    if (!this.ctx) return; const m = this.mus || (this.mus = this._musicInit()), want = !!CM.save.d.music;
    m.level = want ? 0.9 : 0; this._musicGain(m); if (want && !m.timer) { m.next = this.ctx.currentTime + 0.2; m.bar = 0; m.timer = setInterval(() => this._musicSched(m), 150); }
    if (!want && m.timer) setTimeout(() => { if (!CM.save.d.music && m.timer) { clearInterval(m.timer); m.timer = null; } }, 1500);
  },
  music(on) { if (!this.mus) return; this.mus.level = CM.save.d.music ? (on ? 0.9 : 0.4) : 0; this._musicGain(this.mus); },
  suspend(on) { if (!this.ctx) return; try { on ? this.ctx.suspend() : this.ctx.resume(); } catch (e) {} },
  _musicGain(m) { m.bus.gain.setTargetAtTime(m.level, this.ctx.currentTime, 0.6); },
  _musicInit() {
    const c = this.ctx, bus = c.createGain(); bus.gain.value = 0; bus.connect(c.destination);
    const dly = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain();
    dly.delayTime.value = 0.45; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 1800; send.gain.value = 0.5;
    send.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(bus);
    return { bus, send, level: 0, timer: null, next: 0, bar: 0, beat: 60 / 74 };
  },
  _note(m, f, t, dur, type, vol, att, send) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(m.bus); if (send) g.connect(m.send); o.start(t); o.stop(t + dur + 0.1);
  },
  _musicSched(m) {
    const c = this.ctx; if (!c || c.state !== 'running') { m.next = Math.max(m.next, c ? c.currentTime : 0); return; }
    const hz = n => 440 * Math.pow(2, (n - 69) / 12), B = m.beat, bar = B * 4;
    const PROG = [[[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]], [[45, 48, 52, 55], [41, 45, 48, 52], [48, 52, 55, 59], [43, 47, 50, 55]]];
    while (m.next < c.currentTime + 0.8) {
      const t = m.next, chords = PROG[(m.bar >> 2) % 2], ch = chords[m.bar % 4];
      for (const n of ch) { this._note(m, hz(n), t, bar * 1.15, 'triangle', 0.028, 1.2, true); this._note(m, hz(n + 12) * 1.003, t, bar * 1.1, 'sine', 0.018, 1.4, true); }
      this._note(m, hz(ch[0] - 12), t, B * 3, 'sine', 0.085, 0.05, false);
      if (m.bar % 2 === 0) this._note(m, hz(ch[0] - 12), t + B * 2, B * 1.8, 'sine', 0.05, 0.05, false);
      const scale = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[1] + 24, ch[2] + 24, ch[3] + 24, ch[0] + 24]; let idx = (Math.random() * 4) | 0;
      for (let i = 0; i < 8; i++) { if (Math.random() < 0.55) { idx = Math.max(0, Math.min(scale.length - 1, idx + ((Math.random() * 3) | 0) - 1)); this._note(m, hz(scale[idx]), t + i * B / 2, 1.6, 'sine', 0.05, 0.01, true); } }
      m.next += bar; m.bar++;
    }
  },
  buzz(ms) { if (CM.save.d.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
};

/* ---------- ads ----------
 * All ad calls in the game go through CM.ads. The default provider is a dev
 * mock (fake overlay). To go live, call CM.ads.setProvider({ rewarded, interstitial })
 * from the native wrapper (AdMob via Capacitor) or an H5 ads SDK (e.g. Google
 * AdSense for Games / AdinPlay / CrazyGames). Each returns a Promise.        */
CM.ads = {
  provider: null, lastInter: 0, sessionGames: 0,
  setProvider(p) { this.provider = p; },
  async rewarded(placement) {
    CM.track('ad_rewarded_request', { placement });
    let ok;
    if (this.provider && this.provider.rewarded) { try { ok = await this.provider.rewarded(placement); } catch (e) { ok = false; } }
    else ok = await this._mock(placement, 3, true);
    CM.track('ad_rewarded_' + (ok ? 'completed' : 'skipped'), { placement });
    if (!ok && this.provider && CM.toast) CM.toast('Ad not available right now, try again');
    return ok;
  },
  canInterstitial() {
    const s = CM.save.d; if (s.noAds) return false;
    return s.games >= 3 && Date.now() - this.lastInter > 75000;
  },
  async interstitial(placement) {
    if (!this.canInterstitial()) return false;
    this.lastInter = Date.now(); CM.track('ad_interstitial', { placement });
    if (this.provider && this.provider.interstitial) { try { await this.provider.interstitial(placement); } catch (e) {} }
    else await this._mock(placement, 2, false);
    return true;
  },
  _mock(placement, secs, mustWatch) {
    return new Promise(res => {
      const ov = document.getElementById('adOverlay'), tm = document.getElementById('adTimer'), cl = document.getElementById('adClose');
      let left = secs; ov.classList.remove('hidden'); cl.disabled = true; cl.textContent = 'Wait…';
      const done = ok => { clearInterval(iv); ov.classList.add('hidden'); cl.onclick = null; res(ok); };
      const tick = () => { tm.textContent = left > 0 ? left + 's' : ''; if (left <= 0) { cl.disabled = false; cl.textContent = mustWatch ? 'Claim reward' : 'Close'; } left--; };
      const iv = setInterval(tick, 1000); tick();
      cl.onclick = () => done(left < 0);
    });
  }
};

/* ---------- in-app purchases ----------
 * Product ids must match the ones created in Google Play Console / App Store.
 * Replace CM.iap.provider with a real billing bridge (Capacitor / cordova-plugin-purchase). */
CM.iap = {
  provider: null,
  products: {
    remove_ads: { title: 'Remove Ads', desc: 'No more pop-up ads. Rewarded ads stay optional.', price: '$2.99' },
    starter_pack: { title: 'Starter Pack', desc: '2,500 coins + Gold skin + No Ads + 5 of each power-up', price: '$4.99' },
    coins_s: { title: '1,200 Coins', desc: 'A handful of coins', price: '$0.99', coins: 1200 },
    coins_m: { title: '4,000 Coins', desc: 'Best for skins', price: '$2.99', coins: 4000 },
    coins_l: { title: '12,000 Coins', desc: 'Best value', price: '$7.99', coins: 12000 },
    skin_gold: { title: 'Gold Skin', desc: 'Luxurious golden planets', price: '$1.99' }
  },
  setProvider(p) { this.provider = p; },
  async buy(id) {
    CM.track('iap_start', { id });
    let ok;
    if (this.provider) { try { ok = await this.provider.buy(id); } catch (e) { ok = false; } }
    else ok = await this._mock(id);
    if (ok) { this.grant(id); CM.track('iap_success', { id }); }
    return ok;
  },
  grant(id) {
    const s = CM.save.d, p = this.products[id];
    if (p.coins) s.coins += p.coins;
    if (id === 'remove_ads') s.noAds = true;
    if (id === 'skin_gold' && !s.skins.includes('gold')) s.skins.push('gold');
    if (id === 'starter_pack') { s.noAds = true; s.coins += 2500; s.items.hammer += 5; s.items.shake += 5; if (!s.skins.includes('gold')) s.skins.push('gold'); }
    CM.save.write();
  },
  _mock(id) {
    return new Promise(res => {
      const p = this.products[id], ov = document.getElementById('buyOverlay');
      document.getElementById('buyText').innerHTML = p.title + '<br>' + p.price + '<br><small>(dev mode – no real charge)</small>';
      ov.classList.remove('hidden');
      document.getElementById('buyOk').onclick = () => { ov.classList.add('hidden'); res(true); };
      document.getElementById('buyNo').onclick = () => { ov.classList.add('hidden'); res(false); };
    });
  }
};
