// Stability / NaN / CPU checks for the v2 effects. node tools/test-fx2.js
const A = require('./load.js')(); const sr = 48000, B = 128, secs = 6;
const src = (i) => { const t = i / sr; return .4 * Math.sin(2 * Math.PI * 220 * t) * (Math.sin(2 * Math.PI * .5 * t) > 0 ? 1 : .2) + (Math.random() - .5) * .15 * (i % 24000 < 600 ? 1 : 0); };
function run(name, make, mode, extra){ const fx = make(); const L = new Float32Array(B), R = new Float32Array(B), oL = new Float32Array(B), oR = new Float32Array(B); let pk = 0, bad = 0, ss = 0, cnt = 0; const t0 = Date.now();
  for (let b = 0; b < secs * sr / B; b++){ for (let i = 0; i < B; i++){ L[i] = src(b * B + i); R[i] = src(b * B + i + 7); } oL.fill(0); oR.fill(0); if (extra) extra(fx, b);
    if (mode === 'send') fx.process(L, R, oL, oR, B); else { fx.process(L, R, B, b * B); oL.set(L); oR.set(R); }
    for (let i = 0; i < B; i++){ const v = oL[i]; if (!isFinite(v) || !isFinite(oR[i])) bad++; else { pk = Math.max(pk, Math.abs(v)); ss += v * v; cnt++; } } }
  console.log(name.padEnd(14), (bad ? 'FAIL nonfinite ' + bad : 'ok') + ' peak ' + pk.toFixed(3) + ' rms ' + (20 * Math.log10(Math.sqrt(ss / cnt) + 1e-9)).toFixed(1) + ' dB cpu ' + ((Date.now() - t0) / 1000 / secs * 100).toFixed(2) + '%'); }
run('granular', () => new A.Granular(sr, 3), 'send');
run('granular frz', () => { const g = new A.Granular(sr, 3); return g; }, 'send', (g, b) => { if (b === 200) g.set({freeze: true, density: 30}); });
run('shimmer', () => new A.Shimmer(sr), 'send');
run('reverse', () => new A.ReverseDelay(sr), 'send');
run('resonator', () => { const r = new A.Resonator(sr); r.tune([57, 60, 64, 67]); return r; }, 'send');
run('freqshift', () => { const f = new A.FreqShift(sr); f.set({shift: 7, feedback: .6, time: .2}); return f; }, 'ins');
run('ringmod', () => new A.RingMod(sr), 'ins');
run('formant', () => { const f = new A.Formant(sr); f.set({rate: .3}); return f; }, 'ins');
run('folder', () => new A.Folder(sr), 'ins');
run('rotary', () => { const r = new A.Rotary(sr); r.set({fast: true}); return r; }, 'ins');
run('gate', () => { const g = new A.Gate(sr); g.on = true; return g; }, 'ins');
run('busfx', () => new A.BusFX(sr), 'ins', (f, b) => { if (b === 100) f.tapeStop(.6); if (b === 400) f.release(); if (b === 800) f.stutter(.06, .5, 1); });
