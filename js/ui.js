/* UI orchestration: screens, HUD, shop, rewards, ad/IAP flows. */
(function () {
  const $ = id => document.getElementById(id), S = CM.save.d, app = $('app');
  const game = new CM.Game($('c')); CM.game = game;
  const show = id => { $(id).classList.remove('hidden'); }, hide = id => { $(id).classList.add('hidden'); };
  let runCoinsSeen = 0, paused = false, overData = null, evoLevel = -1, toastT;

  /* ---------- layout ---------- */
  function layout() {
    const sc = Math.min(innerWidth / CM.W, innerHeight / 600, 1.45), H = Math.min(innerHeight / sc, 860), bw = CM.W * sc, bh = H * sc;
    app.style.width = bw + 'px'; app.style.height = bh + 'px'; app.style.fontSize = (16 * sc) + 'px'; game.resize(bw, bh, sc, H);
    drawEvo(true);
  }
  addEventListener('resize', layout); layout();

  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }
  function persist() { CM.save.write(); refresh(); }
  function refresh() {
    $('coins').textContent = $('mCoins').textContent = $('sCoins').textContent = CM.fmt(S.coins);
    $('best').textContent = $('mBest').textContent = CM.fmt(S.best);
    for (const k of ['hammer', 'shake']) { const el = $('cnt' + k[0].toUpperCase() + k.slice(1)), n = S.items[k]; el.textContent = n > 0 ? n : 'AD'; el.className = 'badge' + (n > 0 ? '' : ' ad'); }
    $('mDailyBest').textContent = S.daily.date === CM.today() ? 'Best ' + CM.fmt(S.daily.score) : '';
    $('giftDot').classList.toggle('hidden', S.lastClaim === CM.today());
  }
  function addCoins(n) { S.coins += n; persist(); }

  /* ---------- evolution strip ---------- */
  function drawEvo(force) {
    const cv = $('evo'), c = cv.getContext('2d'), ml = game.state === 'playing' || game.state === 'over' ? game.maxLevel : 0;
    if (!force && ml === evoLevel) return; evoLevel = ml; c.clearRect(0, 0, 660, 48);
    for (let i = 0; i <= CM.MAXL; i++) { c.save(); c.translate(30 + i * 60, 24); c.globalAlpha = i <= ml + 1 ? 1 : .55; CM.drawPlanet(c, i, 7 + i * .9, S.skin); c.restore();
      if (i < CM.MAXL) { c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('›', 60 + i * 60, 30); } }
  }
  function drawIcon(cv, lv, skin, face) {
    const c = cv.getContext('2d'), s = cv.width; c.clearRect(0, 0, s, s); c.save(); c.translate(s / 2, s / 2); const r = s * .42; CM.drawPlanet(c, lv, r, skin); if (face) CM.drawFace(c, r, 0, 1); c.restore();
  }

  /* ---------- game callbacks ---------- */
  game.cb.score = v => { $('score').textContent = CM.fmt(v); };
  game.cb.next = lv => drawIcon($('nextC'), lv, S.skin, false);
  game.cb.coinsEarned = tot => { const d = tot - runCoinsSeen; runCoinsSeen = tot; if (d > 0) { S.coins += d; CM.save.write(); $('coins').textContent = $('mCoins').textContent = CM.fmt(S.coins); } };
  game.cb.combo = n => { const el = $('combo'); el.textContent = ['', '', 'NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!'][Math.min(n, 5)] + (n > 5 ? ' ×' + n : ''); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 900); };
  game.cb.toast = toast;
  game.cb.dropped = n => { if (n === 1) $('hint').style.opacity = 0; };
  game.cb.hammered = () => { S.items.hammer--; setTool(null); persist(); };
  game.cb.over = onOver;

  function setTool(t) { game.tool = t; $('pwHammer').classList.toggle('active', t === 'hammer'); if (t === 'hammer') toast('Tap a planet to smash it'); }

  /* ---------- flow ---------- */
  function startGame(mode) {
    CM.audio.init(); CM.audio.click(); hide('menu'); hide('over'); hide('pause'); show('hud'); runCoinsSeen = 0; S.games++; CM.save.write();
    $('modeTag').textContent = mode === 'daily' ? '📅 DAILY' : ''; $('hint').style.opacity = S.games <= 2 ? 1 : 0; $('hint').style.display = S.games <= 2 ? '' : 'none';
    game.start(mode); game.maxLevel = 0; evoLevel = -1; refresh(); CM.track('game_start', { mode, n: S.games });
  }
  function toMenu() { hide('hud'); hide('over'); hide('pause'); game.state = 'menu'; refresh(); show('menu'); }

  function onOver() {
    CM.track('game_over', { score: game.score, lvl: game.maxLevel, mode: game.mode });
    const bonus = Math.floor(game.score / 60); addCoins(bonus);
    let newBest = false;
    if (game.mode === 'daily') { if (S.daily.date !== CM.today() || game.score > S.daily.score) { S.daily = { date: CM.today(), score: game.score }; newBest = true; } }
    else if (game.score > S.best) { S.best = game.score; newBest = true; }
    overData = { score: game.score, coins: game.coinsEarned + bonus, bonus, doubled: false }; persist();
    $('ovTitle').textContent = game.mode === 'daily' ? 'DAILY RESULT' : 'GAME OVER';
    $('ovScore').textContent = CM.fmt(game.score); $('ovNew').textContent = newBest ? '🏆 NEW BEST!' : ''; if (newBest) CM.audio.win();
    $('ovBest').textContent = CM.fmt(game.mode === 'daily' ? S.daily.score : S.best); $('ovCoins').textContent = '+' + CM.fmt(overData.coins);
    drawIcon($('ovTop'), game.maxLevel, S.skin, true);
    $('ovContinue').classList.toggle('hidden', game.continues >= 2); $('ovDouble').classList.remove('hidden'); $('ovDouble').disabled = false;
    show('over');
  }
  async function afterRun(next) { await CM.ads.interstitial('post_run'); next(); }

  $('mPlay').onclick = () => startGame('normal');
  $('mDaily').onclick = () => startGame('daily');
  $('ovAgain').onclick = () => { CM.audio.click(); afterRun(() => startGame(game.mode)); };
  $('ovMenu').onclick = () => { CM.audio.click(); afterRun(toMenu); };
  $('ovContinue').onclick = async () => { if (await CM.ads.rewarded('continue')) { hide('over'); game.rescue(); CM.track('continue'); } else toast('Watch the full ad to continue'); };
  $('ovDouble').onclick = async () => { if (!overData.doubled && await CM.ads.rewarded('double_coins')) { overData.doubled = true; addCoins(overData.coins); CM.audio.coin(); $('ovCoins').textContent = '+' + CM.fmt(overData.coins * 2); $('ovDouble').classList.add('hidden'); } };
  $('ovShare').onclick = async () => {
    const txt = `I scored ${CM.fmt(overData.score)} in Cosmic Merge 🪐☀️ Can you beat me?`;
    try { if (navigator.share) await navigator.share({ title: 'Cosmic Merge', text: txt, url: location.href }); else { await navigator.clipboard.writeText(txt + ' ' + location.href); toast('Copied to clipboard'); } } catch (e) {}
  };
  $('pauseBtn').onclick = () => { if (game.state !== 'playing') return; CM.audio.click(); pause(true); };
  function pause(on) { if (on) { game.state = 'paused'; show('pause'); } else { hide('pause'); game.state = 'playing'; } }
  $('pResume').onclick = () => pause(false);
  $('pRestart').onclick = () => { hide('pause'); startGame(game.mode); };
  $('pMenu').onclick = () => toMenu();
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pause(true); });

  /* ---------- power-ups ---------- */
  async function usePower(kind) {
    if (game.state !== 'playing') return; CM.audio.click();
    if (kind === 'swap') { if (await CM.ads.rewarded('swap')) game.swapNext(); return; }
    if (S.items[kind] <= 0) { if (await CM.ads.rewarded('free_' + kind)) { S.items[kind]++; persist(); toast('+1 ' + kind); } return; }
    if (kind === 'hammer') { setTool(game.tool === 'hammer' ? null : 'hammer'); return; }
    if (kind === 'shake') { S.items.shake--; game.doShake(); persist(); }
  }
  $('pwHammer').onclick = () => usePower('hammer'); $('pwShake').onclick = () => usePower('shake'); $('pwSwap').onclick = () => usePower('swap');
  $('coinPill').onclick = () => { if (game.state === 'playing') pause(true); openShop(); };
  $('coinPill2').onclick = () => openShop();

  /* ---------- shop ---------- */
  function openShop() { CM.audio.click(); buildShop(); show('shop'); }
  function buildShop() {
    const list = $('shopList'); list.innerHTML = '';
    const sec = t => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; list.appendChild(d); };
    const item = (ico, title, sub, btn, onclick, cls = 'green', disabled) => {
      const d = document.createElement('div'); d.className = 'item'; d.innerHTML = `<div class="ico"></div><div class="txt"><b></b><span></span></div>`;
      if (ico instanceof HTMLElement) d.firstChild.replaceWith(ico); else d.firstChild.textContent = ico;
      d.querySelector('b').textContent = title; d.querySelector('span').textContent = sub;
      if (btn) { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = btn; b.disabled = !!disabled; b.onclick = onclick; d.appendChild(b); }
      list.appendChild(d); return d;
    };
    sec('FREE COINS');
    item('📺', '+100 coins', 'Watch a short video', 'Watch', async () => { if (await CM.ads.rewarded('shop_coins')) { addCoins(100); CM.audio.coin(); buildShop(); } }, 'gold');
    sec('POWER-UPS');
    item('🔨', 'Hammer ×1', 'Smash any planet · you own ' + S.items.hammer, '120 🪙', () => buy(120, () => S.items.hammer++), 'green', S.coins < 120);
    item('🌀', 'Shake ×1', 'Shuffle the pile · you own ' + S.items.shake, '90 🪙', () => buy(90, () => S.items.shake++), 'green', S.coins < 90);
    sec('PLANET SKINS');
    for (const [id, sk] of Object.entries(CM.SKINS)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 80; drawIcon(cv, 5, id, true);
      const owned = S.skins.includes(id), sel = S.skin === id; let label, fn, cls = 'green', dis = false;
      if (sel) { label = 'Equipped'; dis = true; } else if (owned) { label = 'Equip'; fn = () => { S.skin = id; game.sprites = {}; persist(); buildShop(); game.cb.next(game.next || 0); drawEvo(true); }; }
      else if (sk.iap) { label = CM.iap.products[sk.iap].price; cls = 'gold'; fn = async () => { if (await CM.iap.buy(sk.iap)) { persist(); buildShop(); toast('Unlocked!'); } }; }
      else { label = sk.cost + ' 🪙'; dis = S.coins < sk.cost; fn = () => buy(sk.cost, () => { S.skins.push(id); S.skin = id; game.sprites = {}; drawEvo(true); }); }
      const it = item(cv, sk.name, owned ? 'Owned' : 'Collect them all', label, fn, cls, dis); if (sel) it.classList.add('sel');
    }
    sec('SPECIAL OFFERS');
    for (const id of ['starter_pack', 'remove_ads', 'coins_s', 'coins_m', 'coins_l']) {
      const p = CM.iap.products[id]; if (id === 'remove_ads' && S.noAds) continue; if (id === 'starter_pack' && S.noAds && S.skins.includes('gold')) continue;
      item(id === 'starter_pack' ? '🎁' : id === 'remove_ads' ? '🚫' : '🪙', p.title, p.desc, p.price, async () => { if (await CM.iap.buy(id)) { persist(); buildShop(); CM.audio.coin(); toast('Thank you! 💛'); } }, 'gold');
    }
  }
  function buy(cost, fn) { if (S.coins < cost) return toast('Not enough coins'); S.coins -= cost; fn(); CM.audio.coin(); persist(); buildShop(); }
  $('mShop').onclick = openShop;
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { CM.audio.click(); hide(b.dataset.close); if (b.dataset.close === 'shop' && game.state === 'paused' && $('pause').classList.contains('hidden')) show('pause'); });

  /* ---------- daily reward ---------- */
  const REWARDS = [{ c: 100 }, { c: 150 }, { h: 2 }, { c: 250 }, { s: 2 }, { c: 400 }, { c: 1000, h: 2, s: 2 }];
  const rLabel = r => r.c && !r.h ? r.c + '🪙' : r.c ? '🎁' : r.h ? '🔨×' + r.h : '🌀×' + r.s;
  function nextDay() { const y = new Date(Date.now() - 864e5), ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0'); return (S.lastClaim === ys ? S.streak : 0) % 7; }
  function openDaily() {
    CM.audio.click(); const claimed = S.lastClaim === CM.today(), cur = claimed ? (S.streak - 1) % 7 : nextDay(), g = $('dayGrid'); g.innerHTML = '';
    REWARDS.forEach((r, i) => { const d = document.createElement('div'); d.className = 'day' + (i === cur && !claimed ? ' cur' : '') + (i < cur || (i === cur && claimed) ? ' done' : ''); d.innerHTML = `<div>Day ${i + 1}</div><i>${rLabel(r)}</i>`; g.appendChild(d); });
    $('dClaim').disabled = $('dDouble').disabled = claimed; $('dClaim').textContent = claimed ? 'Come back tomorrow' : 'Claim'; show('daily');
  }
  function claim(mult) {
    const idx = nextDay(), r = REWARDS[idx]; S.streak = idx + 1; S.lastClaim = CM.today();
    if (r.c) S.coins += r.c * mult; if (r.h) S.items.hammer += r.h * mult; if (r.s) S.items.shake += r.s * mult; persist(); CM.audio.coin(); CM.track('daily_claim', { day: idx + 1, mult }); openDaily();
  }
  $('mGift').onclick = openDaily; $('dClaim').onclick = () => claim(1);
  $('dDouble').onclick = async () => { if (await CM.ads.rewarded('daily_x2')) claim(2); };

  /* ---------- settings ---------- */
  $('mSettings').onclick = () => { $('setSound').checked = S.sound; $('setHaptics').checked = S.haptics; CM.audio.click(); show('settings'); };
  $('setSound').onchange = e => { S.sound = e.target.checked; persist(); }; $('setHaptics').onchange = e => { S.haptics = e.target.checked; persist(); };
  $('setRestore').onclick = async () => { if (CM.iap.provider && CM.iap.provider.restore) await CM.iap.provider.restore(); toast('Purchases restored'); };
  $('setReset').onclick = () => { if (confirm('Erase all progress?')) CM.save.reset(); };

  /* ---------- menu logo planets ---------- */
  function drawLogo() {
    const c = $('logoC').getContext('2d'); c.clearRect(0, 0, 360, 240); const t = performance.now() / 1000;
    [[75, 140, 4, 0], [180, 100, 10, 1.3], [292, 145, 6, 2.1], [128, 195, 2, 3.2], [245, 202, 3, .7]].forEach(([x, y, lv, p]) => {
      const r = CM.RAD[lv] * (lv === 10 ? .8 : 1.25), by = Math.sin(t * 1.6 + p) * 5; c.save(); c.translate(x, y + by);
      if (lv === 10) { const g = c.createRadialGradient(0, 0, r * .8, 0, 0, r * 1.6); g.addColorStop(0, 'rgba(255,190,60,.55)'); g.addColorStop(1, 'rgba(255,190,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.6, 0, 7); c.fill(); }
      CM.drawPlanet(c, lv, r, S.skin); CM.drawFace(c, r, (t + p) % 4 > 3.85 ? 1 : 0, 1); c.restore(); });
  }

  /* ---------- main loop ---------- */
  function loop(now) { game.frame(now); if (game.state === 'menu') drawLogo(); else drawEvo(); requestAnimationFrame(loop); }
  refresh(); requestAnimationFrame(loop);
  if (S.lastClaim !== CM.today() && S.games > 0) setTimeout(openDaily, 600);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  CM.debug = /debug/.test(location.search);
})();
