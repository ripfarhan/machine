// Render seeds with a given synth.js, write 44.1k stereo WAV + 22.05k mono/stereo WAVs for analysis + events JSON.
// usage: node render.js <synth.js> <outdir> <tag> <style|''> <bars> seed1 seed2 ...   (extra params via env P='{"chaos":.3}')
const fs = require('fs'), path = require('path');
const [,, synthPath, outDir, tag, style, barsS, ...seeds] = process.argv;
const S = require(path.resolve(synthPath))();
const extra = process.env.P ? JSON.parse(process.env.P) : {};
fs.mkdirSync(outDir, {recursive: true});
function wav(file, chans, sr){ const n = chans[0].length, C = chans.length, b = Buffer.alloc(44 + n * C * 2); const w = (o, s) => b.write(s, o, 'ascii');
  w(0, 'RIFF'); b.writeUInt32LE(36 + n * C * 2, 4); w(8, 'WAVE'); w(12, 'fmt '); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(C, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * C * 2, 28); b.writeUInt16LE(C * 2, 32); b.writeUInt16LE(16, 34); w(36, 'data'); b.writeUInt32LE(n * C * 2, 40);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < C; c++){ const x = Math.max(-1, Math.min(1, chans[c][i])); b.writeInt16LE(x < 0 ? x * 32768 : x * 32767, o); o += 2; } fs.writeFileSync(file, b); }
function down2(x){ const n = x.length >> 1, o = new Float32Array(n); for (let i = 0; i < n; i++){ const a = x[2 * i], b = x[2 * i + 1], c = x[2 * i + 2] || 0, p = x[2 * i - 1] || 0; o[i] = .25 * p + .5 * a + .25 * b + 0 * c; } return o; }
const mtof = f => Math.round(69 + 12 * Math.log2(f / 440));
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
for (const sd of seeds){ const seed = +sd; let p;
  if (style === 'random'){ p = S.randomize(S.DEF, true, mulberry(seed * 7919 + 13)); p.sr = 44100; if (+barsS) p.bars = +barsS; Object.assign(p, extra); }
  else p = Object.assign({seed, bars: +barsS, style: style || '', sr: 44100}, extra);
  const t0 = Date.now(); const plan = S.plan(p); const r = S.render(p); const ms = Date.now() - t0;
  const base = path.join(outDir, `${tag}_s${seed}`);
  wav(base + '_44k.wav', [r.L, r.R], 44100);
  const l2 = down2(r.L), r2 = down2(r.R), m2 = new Float32Array(l2.length); for (let i = 0; i < m2.length; i++) m2[i] = (l2[i] + r2[i]) * .5;
  wav(base + '_mono.wav', [m2], 22050); wav(base + '_st.wav', [l2, r2], 22050);
  // pitched events → midi notes for dissonance scoring
  const notes = [];
  for (const e of plan.events){ if (e.bus === 'drums' || ['kick', 'snare', 'hat', 'shaker', 'impact', 'riser', 'rumble', 'tex', 'drone'].indexOf(e.inst) >= 0) continue;
    if (e.inst === 'mono'){ for (const n of e.notes) notes.push({t: e.t + n.t, d: n.dur, m: n.m, i: 'bass', v: n.v || 1}); continue; }
    if (e.notes){ for (const m of e.notes) notes.push({t: e.t, d: e.dur, m, i: e.inst, v: e.v}); continue; }
    if (e.f) notes.push({t: e.t, d: e.dur || .25, m: mtof(e.f), i: e.inst, v: e.v}); }
  const chords = []; (plan.meta.sections || []).forEach(s => (s.chords || []).forEach(c => chords.push({bar: c.bar, bars: c.bars, name: c.name})));
  fs.writeFileSync(base + '_events.json', JSON.stringify({meta: plan.meta, BT: plan.BT, notes, chords}));
  console.log(`${tag} seed ${seed}: ${r.meta.styleName} ${r.meta.key} ${r.meta.bpm}bpm ${r.meta.bars} bars, ${plan.events.length} events, ${ms} ms`); }
