const A = require('./load.js')(); const fs = require('fs'); const sr = 48000, N = sr;
const out = {};
for (const [name, shape] of [['saw', 2], ['square', 3], ['tri', 1]]){ const o = new A.VAOsc(sr, 3), x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = o.tick(1760.3, shape, .5, 0); out[name] = Array.from(x); }
// ladder: impulse/noise response at resonance .95 and a cutoff sweep for stability
const L = new A.Ladder(), nz = new A.Noise(5), y = new Float32Array(N); let mx = 0;
for (let i = 0; i < N; i++){ L.set(200 * Math.pow(60, i / N), .97, sr); y[i] = L.tick(nz.white() * .3); mx = Math.max(mx, Math.abs(y[i])); if (!isFinite(y[i])) { console.log('NaN at', i); break; } }
out.ladder = Array.from(y); console.log('ladder sweep peak', mx.toFixed(3));
const L2 = new A.Ladder(); L2.set(1000, 1.0, sr); const z = new Float32Array(N); z[0] = 0; let e = 0; for (let i = 0; i < N; i++){ z[i] = L2.tick(i === 0 ? 1 : 0); if (i > N / 2) e += z[i] * z[i]; } console.log('ladder res=1.0 self-osc tail energy', e.toExponential(2));
fs.writeFileSync('/tmp/dsp.json', JSON.stringify(out));
