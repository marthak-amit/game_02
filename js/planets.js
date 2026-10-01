/* Planet definitions + procedural art. Everything is drawn with canvas gradients (no image assets). */
CM.RAD = [13, 16, 19.5, 23.5, 28.5, 34.5, 41.5, 50, 60, 72, 87].map(r => +(r * 1.3).toFixed(1));
CM.NAMES = ['Dust', 'Pebble', 'Moon', 'Mercury', 'Mars', 'Venus', 'Earth', 'Neptune', 'Saturn', 'Jupiter', 'Sun'];
CM.MAXL = CM.RAD.length - 1;

/* [hue, sat, light] per level */
const COSMIC = [[215, 18, 62], [28, 38, 46], [215, 8, 78], [28, 70, 62], [8, 78, 52], [44, 85, 62], [212, 80, 54], [190, 85, 56], [42, 78, 62], [24, 55, 58], [42, 100, 56]];
CM.SKINS = {
  cosmic: { name: 'Cosmic', cost: 0, col: i => COSMIC[i] },
  candy: { name: 'Candy', cost: 600, col: i => [(i * 31 + 330) % 360, 78, 74] },
  neon: { name: 'Neon', cost: 1200, col: i => [(i * 33 + 120) % 360, 100, 52], glow: true },
  gold: { name: 'Gold', cost: 0, iap: 'skin_gold', col: i => [40 + i * 1.5, 70 + i * 3, 40 + i * 3.2], metal: true }
};

function hsl(c, dl = 0, da) { return `hsl(${c[0]},${c[1]}%,${Math.max(2, Math.min(97, c[2] + dl))}%${da != null ? ',' + da : ''})`; }
function hsla(c, dl, a) { return `hsla(${c[0]},${c[1]}%,${Math.max(2, Math.min(97, c[2] + dl))}%,${a})`; }
function prand(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }

/* Draws a planet centred on (0,0) with radius r. */
CM.drawPlanet = function (c, lv, r, skin) {
  const sk = CM.SKINS[skin] || CM.SKINS.cosmic, col = sk.col(lv), R = prand(lv + 7);
  c.save();
  // Saturn ring (back half)
  if (lv === 8) { c.save(); c.rotate(-0.35); c.strokeStyle = hsla(col, 8, 0.85); c.lineWidth = r * 0.16; c.beginPath(); c.ellipse(0, 0, r * 1.38, r * 0.42, 0, Math.PI, Math.PI * 2); c.stroke(); c.restore(); }
  const g = c.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.08, 0, 0, r);
  if (sk.metal) { g.addColorStop(0, hsl(col, 34)); g.addColorStop(0.35, hsl(col, 8)); g.addColorStop(0.7, hsl(col, -10)); g.addColorStop(1, hsl(col, -26)); }
  else { g.addColorStop(0, hsl(col, 26)); g.addColorStop(0.55, hsl(col)); g.addColorStop(1, hsl(col, -26)); }
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = g; c.fill();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, 7); c.clip();
  const dark = hsla(col, -22, 0.55), light = hsla(col, 24, 0.6);
  const blob = (x, y, rr, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x * r, y * r, rr * r, 0, 7); c.fill(); };
  const band = (y, h, fill) => { c.fillStyle = fill; c.fillRect(-r, y * r, 2 * r, h * r); };
  switch (lv) {
    case 0: for (let i = 0; i < 6; i++) blob((R() - .5) * 1.3, (R() - .5) * 1.3, .1 + R() * .1, dark); break;
    case 1: for (let i = 0; i < 5; i++) blob((R() - .5) * 1.4, (R() - .5) * 1.4, .12 + R() * .12, dark); blob(-.3, -.35, .16, light); break;
    case 2: blob(-.3, -.2, .26, dark); blob(.35, .25, .2, dark); blob(.05, .5, .14, dark); blob(.4, -.4, .12, dark); blob(-.5, .35, .1, dark); break;
    case 3: for (let i = 0; i < 9; i++) blob((R() - .5) * 1.6, (R() - .5) * 1.6, .07 + R() * .1, dark); break;
    case 4: blob(0, -1, .38, 'hsla(0,0%,100%,.85)'); blob(.3, .25, .3, dark); blob(-.4, .3, .2, dark); blob(-.3, -.2, .14, dark); break;
    case 5: for (let i = 0; i < 5; i++) { c.strokeStyle = light; c.lineWidth = r * .09; c.beginPath(); c.arc(0, (i - 2) * r * .4, r * (.9 - i * .05), .2 + i, 2.6 + i); c.stroke(); } break;
    case 6: blob(-.3, -.2, .38, 'hsl(125,48%,38%)'); blob(.42, .3, .3, 'hsl(125,48%,38%)'); blob(-.1, .6, .2, 'hsl(125,48%,38%)'); blob(.2, -.45, .17, 'hsl(125,48%,38%)');
      for (let i = 0; i < 3; i++) blob((R() - .5) * 1.4, (R() - .5) * 1.4, .13, 'hsla(0,0%,100%,.55)'); break;
    case 7: band(-.5, .18, dark); band(-.1, .22, light); band(.35, .16, dark); blob(.25, -.15, .17, 'hsla(215,70%,30%,.7)'); break;
    case 8: band(-.55, .14, dark); band(-.2, .2, light); band(.25, .18, dark); band(.62, .1, light); break;
    case 9: band(-.7, .15, 'hsla(20,50%,38%,.7)'); band(-.35, .2, 'hsla(35,60%,80%,.7)'); band(.05, .22, 'hsla(15,55%,40%,.7)'); band(.45, .18, 'hsla(35,60%,80%,.7)'); blob(.35, .3, .2, 'hsla(8,75%,45%,.9)'); break;
    case 10: { const gg = c.createRadialGradient(0, 0, 0, 0, 0, r); gg.addColorStop(0, 'hsla(55,100%,96%,.95)'); gg.addColorStop(.6, 'hsla(48,100%,68%,.4)'); gg.addColorStop(1, 'hsla(25,100%,50%,0)'); c.fillStyle = gg; c.fillRect(-r, -r, 2 * r, 2 * r);
      for (let i = 0; i < 6; i++) blob((R() - .5) * 1.2, (R() - .5) * 1.2, .08 + R() * .08, 'hsla(30,100%,50%,.35)'); break; }
  }
  // terminator shading + rim light
  const sh = c.createRadialGradient(-r * .35, -r * .4, r * .5, 0, 0, r * 1.05); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,30,.38)');
  c.fillStyle = sh; c.fillRect(-r, -r, 2 * r, 2 * r);
  c.restore();
  c.beginPath(); c.arc(-r * .3, -r * .38, r * .22, 0, 7); c.fillStyle = 'rgba(255,255,255,.22)'; c.save(); c.translate(0, 0); c.fill(); c.restore();
  c.lineWidth = Math.max(1, r * .05); c.strokeStyle = hsla(col, -34, .8); c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2, 0, 7); c.stroke();
  // Saturn ring (front half)
  if (lv === 8) { c.save(); c.rotate(-0.35); c.strokeStyle = hsla(col, 8, 0.95); c.lineWidth = r * 0.16; c.beginPath(); c.ellipse(0, 0, r * 1.38, r * 0.42, 0, 0, Math.PI); c.stroke(); c.restore(); }
  c.restore();
};

/* Cute face, drawn upright (not rotated with the planet). blink 0..1 closes eyes, mood: 0 calm, 1 happy, 2 worried */
CM.drawFace = function (c, r, blink, mood, lx = 0, ly = 0) {
  const ex = r * .27, ey = -r * .05, er = Math.max(1.6, r * .095);
  c.save(); c.fillStyle = '#2a1a3a'; c.strokeStyle = '#2a1a3a'; c.lineCap = 'round'; c.lineWidth = Math.max(1.2, r * .06);
  for (const s of [-1, 1]) {
    if (blink > .5 || mood === 1) { c.beginPath(); if (mood === 1) c.arc(s * ex, ey + er * .6, er * 1.1, Math.PI * 1.1, Math.PI * 1.9); else { c.moveTo(s * ex - er, ey); c.lineTo(s * ex + er, ey); } c.stroke(); }
    else { const ox = lx * er * .7, oy = ly * er * .6; c.beginPath(); c.ellipse(s * ex + ox, ey + oy, er, er * (mood === 2 ? 1.3 : 1.15), 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(s * ex + ox - er * .3, ey + oy - er * .35, er * .35, 0, 7); c.fill(); c.fillStyle = '#2a1a3a'; }
  }
  c.beginPath();
  if (mood === 2) { c.arc(0, r * .38, r * .1, Math.PI * 1.1, Math.PI * 1.9); }
  else if (mood === 1) { c.moveTo(-r * .16, r * .2); c.quadraticCurveTo(0, r * .5, r * .16, r * .2); c.closePath(); c.fill(); }
  else { c.arc(0, r * .16, r * .14, .25, Math.PI - .25); }
  c.stroke();
  c.fillStyle = 'rgba(255,90,120,.35)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * .45, r * .16, r * .1, r * .06, 0, 0, 7); c.fill(); }
  c.restore();
};

/* Wildcard comet: upgrades whatever planet it touches. */
CM.drawComet = function (c, r) {
  c.save();
  const g = (c.createConicGradient ? c.createConicGradient(0, 0, 0) : null);
  if (g) { ['#ff4d6d', '#ffb703', '#ffee32', '#2ed573', '#3a86ff', '#b05cff', '#ff4d6d'].forEach((col, i) => g.addColorStop(i / 6, col)); c.fillStyle = g; }
  else { const l = c.createLinearGradient(-r, -r, r, r); l.addColorStop(0, '#ff4d6d'); l.addColorStop(.5, '#ffee32'); l.addColorStop(1, '#3a86ff'); c.fillStyle = l; }
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  const sh = c.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r); sh.addColorStop(0, 'rgba(255,255,255,.7)'); sh.addColorStop(.5, 'rgba(255,255,255,.05)'); sh.addColorStop(1, 'rgba(0,0,40,.35)');
  c.fillStyle = sh; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .22 : r * .5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.globalAlpha = .9; c.fill();
  c.restore();
};
