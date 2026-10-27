// render each role solo (raw, no mastering) for a seed → band powers per role
const fs = require('fs'); const S = require('../../js/synth.js')();
const seed = +process.argv[2], roles = ['kick','snare','hat','perc','bass','arp','pad','keys','lead','tex'];
function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const p = S.randomize(S.DEF, true, mulberry(seed * 7919 + 13)); p.sr = 44100; p.bars = 48; p.raw = true; p.fx = {}; p.noSweeteners = true;
const out = {};
for (const r of roles){ const q = JSON.parse(JSON.stringify(p)); for (const k in q.layers) q.layers[k] = k === r ? 1 : 0; if (r !== 'keys') q.layers.keys = 0; else q.layers.keys = 1;
  const o = S.render(q); const n = o.L.length; // band powers via Goertzel-ish: use FFT-free approach: biquad bandpass? simpler: write mono wav and let python do it
  const m = new Float32Array(n >> 1); for (let i = 0; i < m.length; i++) m[i] = (o.L[2*i] + o.R[2*i] + o.L[2*i+1] + o.R[2*i+1]) * .25;
  const b = Buffer.alloc(44 + m.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + m.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(22050, 24); b.writeUInt32LE(44100, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(m.length * 2, 40);
  for (let i = 0; i < m.length; i++){ const x = Math.max(-1, Math.min(1, m[i] * 4)); b.writeInt16LE(x < 0 ? x * 32768 : x * 32767, 44 + i * 2); }
  fs.writeFileSync(`out/solo_s${seed}_${r}.wav`, b); console.log('seed', seed, r, 'done'); }
