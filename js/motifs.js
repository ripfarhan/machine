/* Maut ki machine — motif library: symbols drawn as paths, plus arrangements (scatter, mandala, frame, column, giant, trail, wallpaper) */
'use strict';
// Every motif draws centered on (0,0) at radius s, using the ctx's current fillStyle / strokeStyle / lineWidth.
// mode: 'fill' or 'stroke'. Motifs that only make sense one way ignore mode.
const MOTIFS = {
  eye(x, s, mode){ x.beginPath(); x.moveTo(-s, 0); x.quadraticCurveTo(0, -s * .72, s, 0); x.quadraticCurveTo(0, s * .72, -s, 0); x.closePath(); mode === 'fill' ? x.fill() : x.stroke();
    x.beginPath(); x.arc(0, 0, s * .34, 0, 7); mode === 'fill' ? x.stroke() : x.fill(); x.beginPath(); x.arc(0, 0, s * .14, 0, 7); x.fill(); },
  target(x, s){ for (let i = 1; i <= 3; i++){ x.beginPath(); x.arc(0, 0, s * i / 3, 0, 7); x.stroke(); } },
  crosshair(x, s){ x.beginPath(); x.arc(0, 0, s * .6, 0, 7); x.stroke(); x.beginPath(); for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]){ x.moveTo(a * s * .35, b * s * .35); x.lineTo(a * s, b * s); } x.stroke(); },
  spiral(x, s){ x.beginPath(); for (let a = 0; a < 6.28 * 3.2; a += .12){ const r = s * a / (6.28 * 3.2); a ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(0, 0); } x.stroke(); },
  bolt(x, s, mode){ x.beginPath(); [[-.2, -1], [.25, -1], [0, -.2], [.4, -.2], [-.3, 1], [-.05, .1], [-.45, .1]].forEach(([a, b], i) => i ? x.lineTo(a * s, b * s) : x.moveTo(a * s, b * s)); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); },
  crescent(x, s, mode){ x.beginPath(); x.moveTo(0, -s); x.bezierCurveTo(s * 1.35, -s * .55, s * 1.35, s * .55, 0, s); x.bezierCurveTo(s * .55, s * .5, s * .55, -s * .5, 0, -s); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); },
  drop(x, s, mode){ x.beginPath(); x.moveTo(0, -s); x.bezierCurveTo(s * .9, s * .1, s * .7, s, 0, s); x.bezierCurveTo(-s * .7, s, -s * .9, s * .1, 0, -s); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); },
  infinity(x, s){ x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(s * .5, -s * .7, s * 1.1, s * .7, 0, 0); x.bezierCurveTo(-s * 1.1, -s * .7, -s * .5, s * .7, 0, 0); x.stroke(); },
  hex(x, s, mode){ x.beginPath(); for (let i = 0; i < 6; i++){ const a = i * Math.PI / 3; i ? x.lineTo(Math.cos(a) * s, Math.sin(a) * s) : x.moveTo(Math.cos(a) * s, Math.sin(a) * s); } x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); x.beginPath(); for (let i = 0; i < 6; i++){ const a = i * Math.PI / 3 + .52; i ? x.lineTo(Math.cos(a) * s * .5, Math.sin(a) * s * .5) : x.moveTo(Math.cos(a) * s * .5, Math.sin(a) * s * .5); } x.closePath(); x.stroke(); },
  diamond(x, s, mode){ x.beginPath(); x.moveTo(0, -s); x.lineTo(s * .62, 0); x.lineTo(0, s); x.lineTo(-s * .62, 0); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); x.beginPath(); x.moveTo(0, -s * .45); x.lineTo(s * .28, 0); x.lineTo(0, s * .45); x.lineTo(-s * .28, 0); x.closePath(); mode === 'fill' ? x.stroke() : x.fill(); },
  arrow(x, s, mode){ x.beginPath(); x.moveTo(0, -s); x.lineTo(s * .6, -s * .3); x.lineTo(s * .22, -s * .3); x.lineTo(s * .22, s); x.lineTo(-s * .22, s); x.lineTo(-s * .22, -s * .3); x.lineTo(-s * .6, -s * .3); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); },
  chevrons(x, s){ x.beginPath(); for (let i = -1; i <= 1; i++){ x.moveTo(-s, i * s * .5 - s * .3); x.lineTo(0, i * s * .5 + s * .3); x.lineTo(s, i * s * .5 - s * .3); } x.stroke(); },
  zigzag(x, s){ x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(-s + i * s / 4, i % 2 ? s * .35 : -s * .35); x.stroke(); },
  waves(x, s){ for (let w = -1; w <= 1; w++){ x.beginPath(); for (let i = 0; i <= 24; i++){ const px = -s + i * s / 12; x.lineTo(px, w * s * .45 + Math.sin(i / 24 * 6.28 * 2) * s * .15); } x.stroke(); } },
  barcode(x, s){ let px = -s; let k = 0; while (px < s){ const w = (k % 3 === 0 ? .14 : k % 3 === 1 ? .06 : .09) * s; x.fillRect(px, -s * .7, w * .8, s * 1.4); px += w * 1.3; k++; } },
  dotring(x, s){ for (let i = 0; i < 12; i++){ const a = i * Math.PI / 6; x.beginPath(); x.arc(Math.cos(a) * s * .8, Math.sin(a) * s * .8, s * .12, 0, 7); x.fill(); } },
  hashgrid(x, s){ x.beginPath(); for (let i = -1; i <= 1; i += 2){ x.moveTo(-s, i * s * .33); x.lineTo(s, i * s * .33); x.moveTo(i * s * .33, -s); x.lineTo(i * s * .33, s); } x.stroke(); },
  rays(x, s){ x.beginPath(); for (let i = 0; i < 16; i++){ const a = i * Math.PI / 8; x.moveTo(Math.cos(a) * s * .45, Math.sin(a) * s * .45); x.lineTo(Math.cos(a) * s, Math.sin(a) * s); } x.stroke(); },
  asterisk(x, s){ x.beginPath(); for (let i = 0; i < 3; i++){ const a = i * Math.PI / 3; x.moveTo(-Math.cos(a) * s, -Math.sin(a) * s); x.lineTo(Math.cos(a) * s, Math.sin(a) * s); } x.stroke(); },
  plus(x, s){ x.fillRect(-s * .22, -s, s * .44, s * 2); x.fillRect(-s, -s * .22, s * 2, s * .44); },
  xmark(x, s){ x.save(); x.rotate(Math.PI / 4); x.fillRect(-s * .2, -s, s * .4, s * 2); x.fillRect(-s, -s * .2, s * 2, s * .4); x.restore(); },
  ring(x, s){ x.save(); x.lineWidth = x.lineWidth * 3; x.beginPath(); x.arc(0, 0, s * .75, 0, 7); x.stroke(); x.restore(); },
  squares(x, s){ for (let i = 1; i <= 3; i++){ x.strokeRect(-s * i / 3, -s * i / 3, s * 2 * i / 3, s * 2 * i / 3); } },
  capsule(x, s, mode){ x.beginPath(); x.moveTo(-s * .4, -s); x.lineTo(s * .4, -s); x.arc(s * .4, -s * .6, s * .4, -Math.PI / 2, Math.PI / 2 * 0 + 0.0001, false); x.arc(s * .4, s * .6, s * .4, -0.0001, Math.PI / 2); x.lineTo(-s * .4, s); x.arc(-s * .4, s * .6, s * .4, Math.PI / 2, Math.PI); x.arc(-s * .4, -s * .6, s * .4, Math.PI, Math.PI * 1.5); x.closePath(); mode === 'fill' ? x.fill() : x.stroke(); x.beginPath(); x.moveTo(-s * .8, 0); x.lineTo(s * .8, 0); x.stroke(); },
  ladder(x, s){ x.beginPath(); x.moveTo(-s * .4, -s); x.lineTo(-s * .4, s); x.moveTo(s * .4, -s); x.lineTo(s * .4, s); for (let i = -3; i <= 3; i++){ x.moveTo(-s * .4, i * s / 3.5); x.lineTo(s * .4, i * s / 3.5); } x.stroke(); },
  brackets(x, s){ x.beginPath(); x.moveTo(-s * .4, -s); x.lineTo(-s, -s); x.lineTo(-s, s); x.lineTo(-s * .4, s); x.moveTo(s * .4, -s); x.lineTo(s, -s); x.lineTo(s, s); x.lineTo(s * .4, s); x.stroke(); },
  hatch(x, s){ x.beginPath(); for (let i = -4; i <= 4; i++){ x.moveTo(-s, i * s / 4 - s * .3); x.lineTo(s, i * s / 4 + s * .3); } x.stroke(); },
  cluster(x, s){ const r = mulberry32(7); for (let i = 0; i < 14; i++){ const a = r() * 6.28, d = Math.sqrt(r()) * s; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, s * (.06 + r() * .12), 0, 7); x.fill(); } },
  glyph(x, s, mode, g){ x.save(); x.font = (g.font || '400') + ' ' + (s * 2) + 'px ' + (g.family || 'Anton, Impact, sans-serif'); x.textAlign = 'center'; x.textBaseline = 'middle'; mode === 'fill' ? x.fillText(g.ch, 0, s * .05) : x.strokeText(g.ch, 0, s * .05); x.restore(); },
};
// retired shapes (user call): anything that reads as a ring or a spiral never gets picked
const MOTIF_RETIRED = new Set(['spiral', 'ring', 'dotring', 'target', 'crosshair']);
const MOTIF_KEYS = Object.keys(MOTIFS).filter(k => k !== 'glyph' && !MOTIF_RETIRED.has(k));
const GLYPHS = ['§', '¶', '†', '‡', 'Ω', '∆', 'Σ', '₹', '@', '#', '%', '&', '?', '!', '∞', '÷', '×', '≈', '¿', '¡', '∂', 'Ø', 'Æ', 'ß', 'µ', '∴', '∵', '⁂', '※', '◊', '○', '◇', '△', '▽', '◯', 'क', 'ज', 'ॐ'.replace('ॐ', 'श'), 'ढ'];
const GLYPH_FAMILIES = ['"Anton",Impact,sans-serif', '"Archivo Black","Arial Black",sans-serif', '"JetBrains Mono",monospace', '"Bodoni Moda","Playfair Display",serif', '"Playfair Display",serif', '"Noto Sans Devanagari",sans-serif'];
// pick a motif spec from a seeded rng; weight glyphs at ~30%
function pickMotif(r){ if (r() < .3){ return {key: 'glyph', g: {ch: GLYPHS[(r() * GLYPHS.length) | 0], family: GLYPH_FAMILIES[(r() * GLYPH_FAMILIES.length) | 0]}}; } return {key: MOTIF_KEYS[(r() * MOTIF_KEYS.length) | 0]}; }
function drawMotif(x, spec, s, mode){ MOTIFS[spec.key](x, s, mode, spec.g); }
// Arrangements. Each takes (ctx, W, H, SC, r (seeded), t, pulse, colorFn) and draws into the text/deco layer.
const ARRANGE = {
  scatter(x, W, H, SC, r, t, pulse, col){ const n = 3 + ((r() * 6) | 0); const spec = r() < .6 ? pickMotif(r) : null;
    for (let i = 0; i < n; i++){ const m = spec || pickMotif(r), s = (28 + r() * 90) * SC, px = r() * W, py = r() * H, spin = (r() - .5) * 1.4, mode = r() < .5 ? 'fill' : 'stroke';
      x.save(); x.translate(px, py); x.rotate(r() * 6.28 + t * spin); const sc = 1 + pulse * .25 * (r() < .5 ? 1 : 0); x.scale(sc, sc); x.lineWidth = 3 * SC; x.fillStyle = x.strokeStyle = col(r); drawMotif(x, m, s, mode); x.restore(); } },
  mandala(x, W, H, SC, r, t, pulse, col){ const m = pickMotif(r), n = 6 + 2 * ((r() * 4) | 0), R = (160 + r() * 160) * SC * (1 + pulse * .12), cx = W * (.3 + r() * .4), cy = H * (.3 + r() * .4), s = (30 + r() * 40) * SC, spd = (r() - .5) * .8, mode = r() < .5 ? 'fill' : 'stroke';
    x.save(); x.translate(cx, cy); x.rotate(t * spd); x.lineWidth = 3 * SC; const c = col(r); x.fillStyle = x.strokeStyle = c;
    for (let i = 0; i < n; i++){ x.save(); x.rotate(i * 6.28 / n); x.translate(R, 0); x.rotate(Math.PI / 2); drawMotif(x, m, s, mode); x.restore(); }
    if (r() < .5){ x.beginPath(); x.arc(0, 0, R * .55, 0, 7); x.stroke(); } x.restore(); },
  frame(x, W, H, SC, r, t, pulse, col){ const m = pickMotif(r), s = (22 + r() * 22) * SC, gap = s * 3.2, mode = r() < .5 ? 'fill' : 'stroke', c = col(r), off = (t * 60 * SC) % gap, rows = r() < .5 ? ['top', 'bottom'] : ['left', 'right'];
    x.save(); x.lineWidth = 2.5 * SC; x.fillStyle = x.strokeStyle = c;
    for (const side of rows){ const horiz = side === 'top' || side === 'bottom'; const fixed = side === 'top' ? s * 1.6 : side === 'bottom' ? H - s * 1.6 : side === 'left' ? s * 1.6 : W - s * 1.6; const len = horiz ? W : H;
      for (let p = -gap + off; p < len + gap; p += gap){ x.save(); x.translate(horiz ? p : fixed, horiz ? fixed : p); x.rotate(horiz ? 0 : Math.PI / 2); drawMotif(x, m, s, mode); x.restore(); } }
    x.restore(); },
  column(x, W, H, SC, r, t, pulse, col){ const m = pickMotif(r), s = (26 + r() * 30) * SC, gap = s * 2.8, px = r() < .5 ? W * (.08 + r() * .1) : W * (.82 + r() * .1), mode = r() < .5 ? 'fill' : 'stroke', dir = r() < .5 ? 1 : -1, off = (t * 90 * SC * dir) % gap;
    x.save(); x.lineWidth = 2.5 * SC; x.fillStyle = x.strokeStyle = col(r); for (let y = -gap + off; y < H + gap; y += gap){ x.save(); x.translate(px, y); x.rotate(t * .6 * dir); drawMotif(x, m, s, mode); x.restore(); } x.restore(); },
  giant(x, W, H, SC, r, t, pulse, col){ const m = pickMotif(r), s = (260 + r() * 200) * SC * (1 + pulse * .08), spd = (r() - .5) * .3; x.save(); x.translate(W * (.35 + r() * .3), H * (.35 + r() * .3)); x.rotate(t * spd); x.lineWidth = 5 * SC; x.strokeStyle = x.fillStyle = col(r); x.globalAlpha = .9; drawMotif(x, m, s, r() < .25 ? 'fill' : 'stroke'); x.restore(); },
  trail(x, W, H, SC, r, t, pulse, col){ const m = pickMotif(r), n = 6 + ((r() * 6) | 0), x0 = r() * W, y0 = r() * H, x1 = r() * W, y1 = r() * H, s0 = (70 + r() * 60) * SC, mode = r() < .5 ? 'fill' : 'stroke', c = col(r), k0 = (t * .4) % 1;
    x.save(); x.lineWidth = 3 * SC; x.fillStyle = x.strokeStyle = c; for (let i = 0; i < n; i++){ const k = ((i / n) + k0) % 1; x.save(); x.translate(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); x.rotate(k * 3); x.globalAlpha = 1 - k * .7; drawMotif(x, m, s0 * (1 - k * .8), mode); x.restore(); } x.restore(); },
};
const ARRANGE_KEYS = Object.keys(ARRANGE);
// Wallpaper: tile one motif across a canvas (used for the silhouette fill)
function drawWallpaper(x, W, H, SC, r, col){ const m = pickMotif(r), cell = (110 + r() * 110) * SC, s = cell * (.28 + r() * .14), mode = r() < .5 ? 'fill' : 'stroke', stagger = r() < .5;
  x.lineWidth = 3 * SC; let row = 0; for (let y = cell / 2; y < H + cell; y += cell, row++) for (let cx = cell / 2 + (stagger && row % 2 ? cell / 2 : 0); cx < W + cell; cx += cell){ x.save(); x.translate(cx, y); x.rotate(((row + Math.round(cx / cell)) % 2) * Math.PI / 4); x.fillStyle = x.strokeStyle = col(r); drawMotif(x, m, s, mode); x.restore(); } }
