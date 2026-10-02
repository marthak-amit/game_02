/* Physics + rendering for Cosmic Merge. */
(function () {
  const W = 360, L = 26, R = 334, G = 1700, SUB = 3, FIXED = 1 / 120, HIT = .3;
  const PTS = i => (i + 1) * (i + 2) * 3;

  class Body {
    constructor(level, x, y) {
      this.level = level; this.r = CM.RAD[level]; this.m = this.r * this.r; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.angle = Math.random() * 6.28; this.age = 0; this.over = 0; this.dead = false; this.pop = 0; this.blink = Math.random() * 4; this.hurt = 0; this.px = x; this.py = y; this.sq = 0; this.sqT = 0; this.born = 9; this.special = false;
    }
  }

  class Game {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.H = 640; this.sc = 1; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.bodies = []; this.parts = []; this.rings = []; this.texts = []; this.sprites = {}; this.state = 'menu';
      this.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 900, z: .3 + Math.random() * .7, p: Math.random() * 6 }));
      this.decor = Array.from({ length: 9 }, (_, i) => ({ lv: i % 10, x: Math.random() * W, y: Math.random() * 640, vx: (Math.random() - .5) * 14, vy: -6 - Math.random() * 10, a: 0, w: (Math.random() - .5) * .8 }));
      this.shake = 0; this.t = 0; this.holdX = this.hx = W / 2; this.acc = 0; this.pointerDown = false; this.mode = 'normal'; this.tool = null; this.cb = {};
      this.bindInput();
    }
    get floor() { return this.H - 82; }
    get dangerY() { return this.floor - 352; }
    get dropY() { return this.dangerY - 44; }

    resize(boxW, boxH, sc, H) {
      this.sc = sc; this.H = H; this.cv.width = Math.round(boxW * this.dpr); this.cv.height = Math.round(boxH * this.dpr); this.sprites = {}; this.bgC = this.trayC = null;
    }

    sprite(lv, special) {
      const skin = CM.save.d.skin, key = special ? 'comet' : skin + lv, k = this.sc * this.dpr;
      if (this.sprites[key]) return this.sprites[key];
      const r = CM.RAD[lv], pad = lv === 8 ? r * .45 : 2, sz = Math.ceil((r + pad) * 2 * k) + 2, cv = document.createElement('canvas');
      cv.width = cv.height = sz; const c = cv.getContext('2d'); c.translate(sz / 2, sz / 2); c.scale(k, k); special ? CM.drawComet(c, r) : CM.drawPlanet(c, lv, r, skin);
      return (this.sprites[key] = { cv, half: sz / 2 / k });
    }

    /* ---------- run control ---------- */
    start(mode) {
      this.mode = mode; this.state = 'playing'; this.bodies = []; this.parts = []; this.texts = []; this.rings = [];
      this.score = 0; this.coinsEarned = 0; this.combo = 0; this.comboT = 0; this.maxLevel = 0; this.drops = 0; this.continues = 0; this.warn = 0; this.cool = 0.3; this.tool = null; this.pending = 0;
      this.rand = mode === 'daily' ? CM.rng(CM.seedFromDate(CM.today())) : Math.random.bind(Math);
      this.curS = false; this.nextS = false; this.cur = this.rollLevel(); this.next = this.rollLevel(); this.holdX = this.hx = W / 2; this.coinFx = []; this.trail = []; this.flash = 0; this.hfx = null; this.shards = [];
      this.cb.score && this.cb.score(0); this.cb.next && this.cb.next(this.next, this.nextS); this.cb.tool && this.cb.tool(null);
    }
    rollLevel() {
      const k = Math.min(4, 2 + Math.floor(this.drops / 12)), w = (this.drops > 20 ? [20, 22, 22, 19, 17] : [30, 28, 22, 13, 7]).slice(0, k + 1), tot = w.reduce((a, b) => a + b); let x = this.rand() * tot;
      for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return 0;
    }
    drop() {
      if (this.state !== 'playing' || this.tool) return;
      if (this.cool > 0) { this.pending = .5; return; }
      this.pending = 0; const r = CM.RAD[this.cur], b = new Body(this.cur, Math.max(L + r, Math.min(R - r, this.holdX)), this.dropY); this.hx = this.holdX; b.vy = 60; b.special = this.curS; this.bodies.push(b);
      this.cur = this.next; this.curS = this.nextS; this.next = this.rollLevel(); this.nextS = this.drops > 8 && this.rand() < .05; if (this.nextS) this.next = 2;
      if (b.special && !this._cometSeen) { this._cometSeen = 1; this.cb.toast && this.cb.toast('☄️ Comet! Upgrades any planet it touches'); }
      this.cool = 0.36; this.drops++; this.cb.next && this.cb.next(this.next, this.nextS); this.cb.dropped && this.cb.dropped(this.drops);
      CM.audio.drop();
    }
    swapNext() { let t = this.cur; this.cur = this.next; this.next = t; t = this.curS; this.curS = this.nextS; this.nextS = t; this.cb.next && this.cb.next(this.next, this.nextS); }

    /* ---------- power-ups ---------- */
    doShake() {
      CM.audio.swirl();
      for (const b of this.bodies) { b.vy -= 380 + Math.random() * 260; b.vx += (Math.random() - .5) * 360; }
      this.shake = 8; CM.audio.buzz(60);
    }
    hammerAt(x, y) {
      if (this.hfx) return false;
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        const b = this.bodies[i]; if ((b.x - x) ** 2 + (b.y - y) ** 2 < (b.r + 8) ** 2) { this.hfx = { b, t: 0, hit: false, tx: b.x, ty: b.y, lv: b.level }; CM.audio.whoosh(); CM.audio.buzz(15); return true; }
      } return false;
    }
    stepHammer(dt) {
      const h = this.hfx; if (!h) return; h.t += dt;
      if (this.bodies.indexOf(h.b) >= 0) { h.tx = h.b.x; h.ty = h.b.y; }
      if (!h.hit && h.t >= HIT) {
        h.hit = true; const i = this.bodies.indexOf(h.b), b = h.b;
        if (i >= 0) { this.bodies.splice(i, 1); this.shatter(b); }
        this.rings.push({ x: h.tx, y: h.ty, r: b.r * .5, max: b.r * 2, t: 0, col: '255,255,255' }); this.shake = 11; this.flash = .14; CM.audio.smash(); CM.audio.buzz([25, 20, 50]);
        for (const o of this.bodies) { const dx = o.x - h.tx, dy = o.y - h.ty, d = Math.hypot(dx, dy) || 1; if (d < b.r * 3) { o.vx += dx / d * 120; o.vy += dy / d * 120 - 60; } }
      }
      if (h.t > .66) this.hfx = null;
    }
    shatter(b) {
      this.burst(b.x, b.y, b.level, 18); const col = CM.SKINS[CM.save.d.skin].col(b.level);
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = 120 + Math.random() * 300; this.shards.push({ x: b.x + Math.cos(a) * b.r * .4, y: b.y + Math.sin(a) * b.r * .4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, rot: Math.random() * 6, vr: (Math.random() - .5) * 18, s: b.r * (.18 + Math.random() * .25), life: 0, col: `hsl(${col[0]},${col[1]}%,${Math.max(25, col[2] - 10 + Math.random() * 25)}%)` }); }
    }
    renderHammer(c) {
      const h = this.hfx; if (!h) return; const r = h.b.r, s = Math.max(.9, Math.min(2.4, r / 34)), Lh = 120 * s, th0 = -.55, T = { x: h.tx + r * .35, y: h.ty - r * .35 };
      const P = { x: T.x - Lh * Math.sin(th0), y: T.y - Lh * Math.cos(th0) }, t = h.t;
      const thAt = tt => tt < .14 ? 2.7 - .35 * (1 - Math.pow(1 - tt / .14, 2)) : tt < HIT ? 2.35 + (th0 - 2.35) * Math.pow((tt - .14) / (HIT - .14), 2) : th0 + .4 * (1 - Math.exp(-(tt - HIT) * 12));
      const alpha = t < .1 ? t / .1 : t > .46 ? Math.max(0, 1 - (t - .46) / .2) : 1;
      const draw = (th, a) => {
        c.save(); c.globalAlpha = a; c.translate(P.x, P.y); c.rotate(-th);
        const hg = c.createLinearGradient(-4 * s, 0, 4 * s, 0); hg.addColorStop(0, '#d9a066'); hg.addColorStop(.5, '#b87a3c'); hg.addColorStop(1, '#7a4e22'); c.fillStyle = hg; c.beginPath(); c.roundRect(-4.5 * s, 0, 9 * s, Lh, 3 * s); c.fill();
        c.fillStyle = '#5a3a1a'; for (let i = 0; i < 4; i++) c.fillRect(-4.8 * s, (4 + i * 6) * s, 9.6 * s, 2.5 * s);
        const mg = c.createLinearGradient(0, Lh - 18 * s, 0, Lh + 18 * s); mg.addColorStop(0, '#f2f5fb'); mg.addColorStop(.45, '#aab3c8'); mg.addColorStop(1, '#58617a');
        c.fillStyle = mg; c.beginPath(); c.roundRect(-32 * s, Lh - 18 * s, 64 * s, 36 * s, 6 * s); c.fill();
        c.fillStyle = '#3d445a'; c.fillRect(-32 * s, Lh - 18 * s, 7 * s, 36 * s); c.fillRect(25 * s, Lh - 18 * s, 7 * s, 36 * s);
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-22 * s, Lh - 13 * s, 44 * s, 4 * s);
        c.strokeStyle = '#2b3042'; c.lineWidth = 1.5 * s; c.beginPath(); c.roundRect(-32 * s, Lh - 18 * s, 64 * s, 36 * s, 6 * s); c.stroke(); c.restore();
      };
      if (t > .14 && t < HIT + .03) { for (let i = 3; i >= 1; i--) draw(thAt(Math.max(0, t - i * .018)), alpha * .12 * (4 - i)); }
      draw(thAt(t), alpha);
      if (t >= HIT && t < HIT + .16) { const k = (t - HIT) / .16; c.save(); c.translate(T.x - r * .1, T.y + r * .05); c.globalAlpha = 1 - k; c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i * .628 + .3, r0 = r * (.15 + k * .5), r1 = r * (.4 + k * .9); c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); } c.restore(); }
    }
    rescue() { // clear everything poking above the danger zone + a bit more
      const lim = this.dangerY + 100;
      for (let i = this.bodies.length - 1; i >= 0; i--) { const b = this.bodies[i]; if (b.y - b.r < lim) { this.burst(b.x, b.y, b.level, 10); this.bodies.splice(i, 1); } }
      for (const b of this.bodies) b.over = 0; this.warn = 0; this.state = 'playing'; this.cool = 0.6; this.continues++; this.shake = 8; CM.audio.boom();
    }

    /* ---------- physics ---------- */
    step(dt) {
      this.t += dt; this.shake *= Math.pow(.001, dt); if (this.shake < .1) this.shake = 0;
      this.stepFx(dt);
      if (this.state !== 'playing' && this.state !== 'over') return;
      if (this.state === 'over') return;
      if (this.cool > 0) { this.cool -= dt; } else if (this.pending > 0) { this.drop(); }
      if (this.pending > 0) this.pending -= dt;
      this.hx += (this.holdX - this.hx) * Math.min(1, dt * 22);
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; } }
      const h = dt / SUB, B = this.bodies, fl = this.floor, merges = [];
      for (const b of B) { b.px = b.x; b.py = b.y; b.age += dt; if (b.born < 5) b.born += dt; if (b.sq > .002) { b.sqT += dt * 26; b.sq *= Math.exp(-7 * dt); } else b.sq = 0; if (this.trail && b.age < 1.3 && b.vy > 450) this.trail.push({ x: b.x, y: b.y - b.vy * .012, r: b.r * .8, life: 0, lv: b.level }); if (b.pop > 0) b.pop = Math.max(0, b.pop - dt * 4); if (b.hurt > 0) b.hurt -= dt; }
      for (let s = 0; s < SUB; s++) {
        for (const b of B) {
          b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x - b.r < L) { b.x = L + b.r; if (b.vx < 0) b.vx *= (b.vx < -90 ? -.35 : 0); b.vy *= .999; }
          if (b.x + b.r > R) { b.x = R - b.r; if (b.vx > 0) b.vx *= (b.vx > 90 ? -.35 : 0); b.vy *= .999; }
          if (b.y + b.r > fl) { if (b.vy > 220) { CM.audio.hit(b.vy); this.squash(b, b.vy, 1); } b.y = fl - b.r; if (b.vy > 0) b.vy *= (b.vy > 140 ? -.28 : 0); b.vx *= .9985; }
        }
        for (let it = 0; it < 3; it++) {
          for (let i = 0; i < B.length; i++) {
            const a = B[i]; if (a.dead) continue;
            for (let j = i + 1; j < B.length; j++) {
              const c = B[j]; if (c.dead) continue;
              const dx = c.x - a.x, dy = c.y - a.y, rs = a.r + c.r; if (dx > rs || dx < -rs || dy > rs || dy < -rs) continue;
              const d2 = dx * dx + dy * dy; if (d2 >= rs * rs) continue;
              const d = Math.sqrt(d2) || .001, nx = dx / d, ny = dy / d;
              if (it === 0 && (a.special !== c.special ? (a.special ? c.level : a.level) < CM.MAXL : (!a.special && a.level === c.level))) { a.dead = c.dead = true; merges.push([a, c]); break; }
              const ia = 1 / a.m, ib = 1 / c.m, ov = rs - d, corr = ov / (ia + ib) * .85;
              a.x -= nx * corr * ia; a.y -= ny * corr * ia; c.x += nx * corr * ib; c.y += ny * corr * ib;
              const rvn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
              if (rvn < 0) {
                if (rvn < -260 && it === 0 && s === 0) { CM.audio.hit(-rvn); this.squash(a, -rvn, .6); this.squash(c, -rvn, .6); }
                const e = rvn < -90 ? .3 : 0, j2 = -(1 + e) * rvn / (ia + ib);
                a.vx -= j2 * ia * nx; a.vy -= j2 * ia * ny; c.vx += j2 * ib * nx; c.vy += j2 * ib * ny;
                const tx = -ny, ty = nx, rvt = (c.vx - a.vx) * tx + (c.vy - a.vy) * ty, jt = -rvt / (ia + ib) * .02;
                a.vx -= jt * ia * tx; a.vy -= jt * ia * ty; c.vx += jt * ib * tx; c.vy += jt * ib * ty;
              }
            }
          }
        }
        for (const b of B) { const sp = b.vx * b.vx + b.vy * b.vy; const dmp = sp < 9 ? .93 : .9998; b.vx *= dmp; b.vy *= dmp; }
      }
      for (const b of B) { b.angle += (b.vx / b.r) * dt * .7; }
      if (merges.length) this.doMerges(merges);
      // game over detection
      let worst = 0;
      for (const b of B) {
        if (b.dead) continue;
        if (b.age > 1.3 && b.y - b.r < this.dangerY && b.vx * b.vx + b.vy * b.vy < 22000) { b.over += dt; if (b.over > worst) worst = b.over; } else b.over = Math.max(0, b.over - dt * 2);
      }
      this.warn = worst;
      if (worst > 2.2) this.gameOver();
    }
    doMerges(list) {
      for (const [a, c] of list) {
        const x = (a.x + c.x) / 2, y = (a.y + c.y) / 2, lv = a.special ? c.level : a.level, wild = a.special || c.special;
        this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = .9;
        const mult = 1 + (this.combo - 1) * .5;
        if (lv === CM.MAXL) { // Supernova
          this.addScore(2500, x, y, 'SUPERNOVA!'); this.coin(40, x, y); this.burst(x, y, lv, 60); this.rings.push({ x, y, r: 10, max: 260, t: 0, col: '255,220,120' }); this.shake = 22; CM.audio.boom(); CM.audio.win(); CM.audio.buzz([60, 40, 120]);
          for (const b of this.bodies) if (b !== a && b !== c && !b.dead) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1; b.vx += dx / d * 500; b.vy += dy / d * 500 - 200; }
          continue;
        }
        const nb = new Body(lv + 1, x, y); nb.born = 0; nb.vx = (a.vx + c.vx) / 2; nb.vy = (a.vy + c.vy) / 2; nb.age = 1.0; nb.pop = 1; nb.angle = a.angle; nb.hurt = 0;
        this.bodies.push(nb); this.maxLevel = Math.max(this.maxLevel, lv + 1); this.cb.discover && this.cb.discover(lv + 1);
        if (wild) { this.rings.push({ x, y, r: 6, max: nb.r * 3, t: 0, col: '255,230,90' }); this.burst(x, y, lv + 1, 22); this.flash = .35; }
        const pts = Math.round(PTS(lv + 1) * mult); this.addScore(pts, x, y - nb.r * .5, this.combo > 1 ? 'x' + this.combo + '  +' + pts : '+' + pts);
        this.coin(Math.max(1, Math.floor((lv + 1) / 2)), x, y);
        this.burst(x, y, lv + 1, 8 + lv * 2); this.rings.push({ x, y, r: nb.r * .6, max: nb.r * 2.2, t: 0, col: '255,255,255' });
        for (const b of this.bodies) { if (b === nb || b.dead) continue; const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d < nb.r * 2.4 && d > .1) { const f = 90 * (1 - d / (nb.r * 2.4)); b.vx += dx / d * f * 3; b.vy += dy / d * f * 3; } }
        CM.audio.pop(lv, this.combo - 1); CM.audio.buzz(lv > 5 ? 40 : 15); this.shake = Math.max(this.shake, 1.5 + lv * .6);
        this.cb.merged && this.cb.merged(lv + 1, this.combo); this.flash = Math.max(this.flash, Math.min(.25, .04 * this.combo));
        if (this.combo >= 2) this.cb.combo && this.cb.combo(this.combo);
        if (lv + 1 === CM.MAXL) this.cb.toast && this.cb.toast('☀️ You made the SUN!');
      }
      this.bodies = this.bodies.filter(b => !b.dead);
    }
    addScore(p, x, y, txt) { this.score += p; this.cb.score && this.cb.score(this.score); this.texts.push({ x, y, t: 0, txt, big: p >= 200 }); }
    coin(n, x, y) { this.coinsEarned += n; this.cb.coinsEarned && this.cb.coinsEarned(this.coinsEarned, true); for (let i = 0; i < Math.min(5, n); i++) this.coinFx.push({ x, y, sx: x, sy: y, t: -i * .07, dx: (Math.random() - .5) * 80, dy: -30 - Math.random() * 40 }); }
    squash(b, v, k) { if (b.sq > .05) return; b.sq = Math.min(.3, v / 2600) * k; b.sqT = 0; }
    gameOver() {
      if (this.state === 'over') return; this.state = 'over'; CM.audio.over(); CM.audio.buzz([80, 50, 160]);
      for (const b of this.bodies) b.hurt = 99;
      setTimeout(() => this.cb.over && this.cb.over(), 900);
    }

    /* ---------- effects ---------- */
    burst(x, y, lv, n) {
      const col = CM.SKINS[CM.save.d.skin].col(lv);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 220; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0, max: .5 + Math.random() * .5, sz: 2 + Math.random() * 4, col: `hsl(${col[0] + (Math.random() * 30 - 15)},${Math.min(100, col[1] + 20)}%,${Math.min(90, col[2] + 15)}%)` }); }
    }
    stepFx(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; if (p.life > p.max) this.parts.splice(i, 1); }
      for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt * 2.6; if (r.t >= 1) this.rings.splice(i, 1); }
      for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.t += dt; t.y -= 34 * dt; if (t.t > 1.1) this.texts.splice(i, 1); }
      for (const s of this.stars) s.p += dt;
      this.stepHammer(dt);
      if (this.shards) for (let i = this.shards.length - 1; i >= 0; i--) { const q = this.shards[i]; q.life += dt; q.vy += 1100 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; if (q.life > .9) this.shards.splice(i, 1); }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.2);
      if (this.coinFx) for (let i = this.coinFx.length - 1; i >= 0; i--) { const q = this.coinFx[i]; q.t += dt * 1.5; if (q.t >= 1) { this.coinFx.splice(i, 1); this.cb.coinArrive && this.cb.coinArrive(); } }
      if (this.trail) for (let i = this.trail.length - 1; i >= 0; i--) { const q = this.trail[i]; q.life += dt; if (q.life > .28) this.trail.splice(i, 1); }
      if (!this.meteor && Math.random() < dt * .12) this.meteor = { x: Math.random() * W + 80, y: -10, t: 0 };
      if (this.meteor) { this.meteor.t += dt; this.meteor.x -= 380 * dt; this.meteor.y += 230 * dt; if (this.meteor.t > 1.4) this.meteor = null; }
      if (this.state === 'menu') for (const d of this.decor) { d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.w * dt; if (d.y < -80) { d.y = 720; d.x = Math.random() * W; } if (d.x < -80) d.x = W + 80; if (d.x > W + 80) d.x = -80; }
    }

    /* ---------- input ---------- */
    bindInput() {
      const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.width * W }; };
      cv.addEventListener('pointerdown', e => {
        CM.audio.init(); if (this.state !== 'playing') return; const p = pos(e); cv.setPointerCapture(e.pointerId);
        if (this.tool === 'hammer') { if (this.hammerAt(p.x, p.y)) { this.cb.hammered && this.cb.hammered(); } return; }
        this.pointerDown = true; this.holdX = p.x;
      });
      cv.addEventListener('pointermove', e => { if (this.state !== 'playing') return; const p = pos(e); if (this.pointerDown || e.pointerType === 'mouse') this.holdX = p.x; });
      const up = e => { if (this.pointerDown) { this.pointerDown = false; this.drop(); } };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { this.pointerDown = false; });
    }

    /* ---------- rendering ---------- */
    render() {
      const c = this.ctx, k = this.sc * this.dpr, H = this.H;
      c.setTransform(k, 0, 0, k, 0, 0);
      // background (pre-rendered once per resize)
      if (!this.bgC) this.buildCaches();
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.bgC, 0, 0); c.setTransform(k, 0, 0, k, 0, 0);
      if (this.meteor) { const m = this.meteor, g = c.createLinearGradient(m.x, m.y, m.x + 90, m.y - 55); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x + 90, m.y - 55); c.stroke(); }
      for (const s of this.stars) { const a = .35 + .65 * Math.abs(Math.sin(s.p * s.z)); c.fillStyle = `rgba(255,255,255,${a * s.z})`; c.fillRect(s.x, s.y % H, 1.4 * s.z + .4, 1.4 * s.z + .4); }
      if (this.state === 'menu') { this.renderMenu(c); return; }

      c.save();
      if (this.shake) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
      this.renderTray(c);
      // danger line
      const wa = Math.min(1, this.warn / 1.2), flash = this.warn > 0 ? .5 + .5 * Math.sin(this.t * 14) : 0;
      c.setLineDash([8, 7]); c.lineWidth = 2; c.strokeStyle = `rgba(255,${Math.round(90 - 60 * wa)},${Math.round(90 - 60 * wa)},${.28 + .72 * flash * wa + .1})`;
      c.beginPath(); c.moveTo(L, this.dangerY); c.lineTo(R, this.dangerY); c.stroke(); c.setLineDash([]);
      if (this.warn > 0) { c.fillStyle = `rgba(255,60,60,${.1 + .12 * flash})`; c.fillRect(L, this.dangerY - 30, R - L, 30); }
      // trail
      if (this.trail) for (const q of this.trail) { c.globalAlpha = (1 - q.life / .28) * .22; c.fillStyle = '#fff'; c.beginPath(); c.arc(q.x, q.y, q.r * (1 - q.life / .28 * .5), 0, 7); c.fill(); } c.globalAlpha = 1;
      // bodies
      for (const b of this.bodies) this.renderBody(c, b);
      // held piece + guide
      if (this.state === 'playing' && !this.tool) {
        const r = CM.RAD[this.cur], x = Math.max(L + r, Math.min(R - r, this.hx)), a = this.cool > 0 ? 1 - this.cool / .36 : 1;
        let ly = this.floor - r; for (const b of this.bodies) { const dx = Math.abs(b.x - x), rs = r + b.r; if (dx < rs) ly = Math.min(ly, b.y - Math.sqrt(rs * rs - dx * dx)); }
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.setLineDash([3, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(x, this.dropY + r); c.lineTo(x, ly - r); c.stroke(); c.setLineDash([]);
        c.strokeStyle = 'rgba(255,255,255,' + (.35 + .15 * Math.sin(this.t * 6)) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(x, ly, r, 0, 7); c.stroke();
        c.save(); c.globalAlpha = a; c.translate(x, this.dropY + Math.sin(this.t * 3) * 2); const es = 1 - Math.exp(-7 * a * .5) * Math.cos(14 * a * .5) * .6; c.scale(es, es); const sp = this.sprite(this.cur, this.curS); c.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); CM.drawFace(c, r, (this.t % 4) > 3.85 ? 1 : 0, 1, 0, .6); c.restore();
      }
      // fx
      if (this.shards) for (const q of this.shards) { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.globalAlpha = Math.max(0, 1 - q.life / .9); c.fillStyle = q.col; c.beginPath(); c.moveTo(0, -q.s); c.lineTo(q.s * .8, q.s * .6); c.lineTo(-q.s * .9, q.s * .4); c.closePath(); c.fill(); c.restore(); } c.globalAlpha = 1;
      this.renderHammer(c);
      if (this.coinFx) for (const q of this.coinFx) { if (q.t < 0) continue; const e = q.t * q.t, tx = W - 52, ty = 22, x = q.sx + q.dx * Math.sin(q.t * 3) + (tx - q.sx) * e, y = q.sy + q.dy * Math.sin(q.t * 3) + (ty - q.sy) * e;
        const g = c.createRadialGradient(x - 1.5, y - 1.5, 1, x, y, 6); g.addColorStop(0, '#fff3a0'); g.addColorStop(.6, '#ffc83d'); g.addColorStop(1, '#d98a00'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 5.5 * (1 - e * .4), 0, 7); c.fill(); }
      for (const r of this.rings) { c.strokeStyle = `rgba(${r.col},${(1 - r.t) * .7})`; c.lineWidth = 3 * (1 - r.t) + 1; c.beginPath(); c.arc(r.x, r.y, r.r + (r.max - r.r) * r.t, 0, 7); c.stroke(); }
      for (const p of this.parts) { c.globalAlpha = 1 - p.life / p.max; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.sz * (1 - p.life / p.max * .5), 0, 7); c.fill(); } c.globalAlpha = 1;
      c.textAlign = 'center'; c.lineJoin = 'round';
      for (const t of this.texts) { const a = Math.min(1, (1.1 - t.t) * 2), sz = t.big ? 20 : 15; c.globalAlpha = a; c.font = `700 ${sz * (1 + Math.max(0, .3 - t.t))}px Fredoka,system-ui,sans-serif`; c.lineWidth = 4; c.strokeStyle = '#3a1500'; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.big ? '#ffd23d' : '#fff'; c.fillText(t.txt, t.x, t.y); } c.globalAlpha = 1;
      c.restore();
      if (this.flash > 0) { c.fillStyle = `rgba(255,240,200,${this.flash * .5})`; c.fillRect(0, 0, W, H); }
    }
    buildCaches() {
      const mk = () => { const cv = document.createElement('canvas'); cv.width = this.cv.width; cv.height = this.cv.height; return cv; }, k = this.sc * this.dpr, H = this.H;
      this.bgC = mk(); let c = this.bgC.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
      const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a1260'); bg.addColorStop(.5, '#120c42'); bg.addColorStop(1, '#0b0820'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      const neb = c.createRadialGradient(W * .8, H * .25, 10, W * .8, H * .25, 220); neb.addColorStop(0, 'rgba(255,90,160,.16)'); neb.addColorStop(1, 'rgba(255,90,160,0)'); c.fillStyle = neb; c.fillRect(0, 0, W, H);
      const neb2 = c.createRadialGradient(W * .1, H * .75, 10, W * .1, H * .75, 240); neb2.addColorStop(0, 'rgba(60,140,255,.16)'); neb2.addColorStop(1, 'rgba(60,140,255,0)'); c.fillStyle = neb2; c.fillRect(0, 0, W, H);
      this.trayC = mk(); c = this.trayC.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); this.drawTray(c);
    }
    renderTray(c) { const k = this.sc * this.dpr; c.save(); c.scale(1 / k, 1 / k); c.drawImage(this.trayC, 0, 0); c.restore(); }
    drawTray(c) {
      const fl = this.floor, top = this.dropY - 26;
      c.fillStyle = 'rgba(10,6,40,.45)'; c.beginPath(); c.roundRect(L - 4, top, R - L + 8, fl - top + 6, [0, 0, 18, 18]); c.fill();
      c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = 'rgba(140,120,255,.35)'; c.shadowColor = '#8c78ff'; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(L - 3, top); c.lineTo(L - 3, fl + 2); c.lineTo(R + 3, fl + 2); c.lineTo(R + 3, top); c.stroke(); c.shadowBlur = 0;
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(L - 3, top); c.lineTo(L - 3, fl + 2); c.lineTo(R + 3, fl + 2); c.lineTo(R + 3, top); c.stroke();
    }
    renderBody(c, b) {
      const sp = this.sprite(b.level, b.special), bt = b.born < 2 ? b.born : 9, sc = bt < 2 ? 1 - Math.exp(-6 * bt) * Math.cos(13 * bt) * .75 : 1, sw = Math.sin(b.sqT) * b.sq;
      const al = this.acc / FIXED, ix = b.px + (b.x - b.px) * al, iy = b.py + (b.y - b.py) * al;
      c.save(); c.translate(ix, iy + b.r * (sw > 0 ? sw * .5 : 0));
      if (b.special) { const g = c.createRadialGradient(0, 0, b.r * .6, 0, 0, b.r * 2); g.addColorStop(0, 'rgba(255,230,120,.6)'); g.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, b.r * 2, 0, 7); c.fill(); }
      if (b.level === CM.MAXL || CM.SKINS[CM.save.d.skin].glow) { const col = CM.SKINS[CM.save.d.skin].col(b.level), g = c.createRadialGradient(0, 0, b.r * .8, 0, 0, b.r * 1.7); g.addColorStop(0, `hsla(${col[0]},100%,60%,.5)`); g.addColorStop(1, `hsla(${col[0]},100%,60%,0)`); c.fillStyle = g; c.beginPath(); c.arc(0, 0, b.r * 1.7, 0, 7); c.fill(); }
      c.scale(sc * (1 + sw), sc * (1 - sw)); c.save(); c.rotate(b.special ? this.t * 2 : b.angle); c.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); c.restore();
      const bl = (this.t + b.blink) % 4 > 3.85 ? 1 : 0, mood = b.hurt > 0 ? 2 : (b.pop > 0 ? 1 : (b.over > 0.3 ? 2 : 0));
      let lx = 0, ly = 0; if (this.state === 'playing') { const dx = this.hx - b.x, dy = this.dropY - b.y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
      CM.drawFace(c, b.r, bl, mood, lx, ly); c.restore();
    }
    renderMenu(c) {
      for (const d of this.decor) { const sp = this.sprite(d.lv); c.save(); c.translate(d.x, d.y); c.rotate(d.a); c.globalAlpha = .55; c.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2); c.restore(); }
    }
    frame(now) {
      if (CM.adActive || document.hidden) { this._last = now; this.acc = 0; return; }
      const dt = Math.min(.05, (now - (this._last || now)) / 1000); this._last = now;
      this.acc += dt; let n = 0; while (this.acc >= FIXED && n < 6) { this.step(FIXED); this.acc -= FIXED; n++; } if (n === 6) this.acc = 0;
      this.render();
    }
  }
  CM.Game = Game; CM.W = W;
})();
