const A = require('./load.js')(); const sr = 48000;
// 1. loudness: 1 kHz full-scale sine in L only must read -3.01 LUFS
{ const m = new A.Loudness(sr), N = sr * 4, L = new Float32Array(N), R = new Float32Array(N); for (let i = 0; i < N; i++) L[i] = Math.sin(2 * Math.PI * 1000 * i / sr); m.process(L, R, N); console.log('LUFS 1k sine L-only (expect -3.01):', m.lufs.toFixed(2)); }
// 2. plate + hall impulse response: stable, decaying, RT estimate
for (const [name, mk] of [['plate', () => { const p = new A.Plate(sr); p.set({decay: .85, damping: .4}); return p; }], ['hall', () => { const h = new A.Hall(sr, 5); h.set({rt60: 6}); return h; }]]){
  const fx = mk(), N = sr * 10, iL = new Float32Array(128), iR = new Float32Array(128), oL = new Float32Array(128), oR = new Float32Array(128); const env = [];
  let e = 0, cnt = 0, nan = false;
  for (let b = 0; b < N / 128; b++){ iL.fill(0); iR.fill(0); oL.fill(0); oR.fill(0); if (b === 0){ iL[0] = 1; iR[0] = 1; } fx.process(iL, iR, oL, oR, 128);
    for (let i = 0; i < 128; i++){ if (!isFinite(oL[i])) nan = true; e += oL[i] * oL[i] + oR[i] * oR[i]; } if (++cnt === 375){ env.push(10 * Math.log10(e + 1e-20)); e = 0; cnt = 0; } }
  const d0 = env[1], t60 = env.findIndex(v => v < d0 - 60); console.log(name, 'finite', !nan, 'energy per 1s (dB):', env.map(v => v.toFixed(0)).join(' '), ' ~RT60', t60 > 0 ? t60 + ' s' : '>10 s'); }
// 3. limiter: ceiling respected on a loud noisy signal
{ const lim = new A.Limiter(sr, .002); lim.set({ceiling: .89}); const nz = new A.Noise(3); let mx = 0, mg = 1; for (let b = 0; b < 400; b++){ const L = new Float32Array(128), R = new Float32Array(128); for (let i = 0; i < 128; i++){ L[i] = nz.white() * 2.5 * (b % 50 < 10 ? 1 : .2); R[i] = L[i] * .9; } lim.process(L, R, 128); for (let i = 0; i < 128; i++) mx = Math.max(mx, Math.abs(L[i]), Math.abs(R[i])); mg = Math.min(mg, lim.minGain); } console.log('limiter max out', mx.toFixed(4), '(ceiling .89) min gain', mg.toFixed(3)); }
// 4. tape delay + chorus + phaser stability
{ const td = new A.TapeDelay(sr); td.set({time: .3, feedback: .9}); const ch = new A.JunoChorus(sr), ph = new A.Phaser(sr); let mx = 0, ok = true; const nz = new A.Noise(9);
  for (let b = 0; b < 2000; b++){ const L = new Float32Array(128), R = new Float32Array(128), oL = new Float32Array(128), oR = new Float32Array(128); if (b < 20) for (let i = 0; i < 128; i++){ L[i] = nz.white(); R[i] = L[i]; } td.process(L, R, oL, oR, 128); ch.process(oL, oR, 128); ph.process(oL, oR, 128); for (let i = 0; i < 128; i++){ if (!isFinite(oL[i])) ok = false; mx = Math.max(mx, Math.abs(oL[i])); } }
  console.log('tape fb .9 + chorus + phaser finite', ok, 'peak', mx.toFixed(3)); }
