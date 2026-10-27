// Regression guard: every world renders finite, non-silent audio within ceiling; prints CPU ratio.  node tools/test-all.js [seconds]
const A = require('./load.js')(); const secs = +(process.argv[2] || 40); let fail = 0;
for (const w of A.WORLD_LIST){ const e = new A.Engine(44100); e.auto = false; e.load(A.makeGenome(w, 3)); e.setMacro('energy', .8); const L = new Float32Array(128), R = new Float32Array(128); let bad = 0, pk = 0, ss = 0, n = 0; const t0 = Date.now();
  for (let b = 0; b < secs * 44100 / 128; b++){ e.process(L, R, 128); e.out.drain(); for (let i = 0; i < 128; i++){ const v = L[i]; if (!isFinite(v) || !isFinite(R[i])) bad++; else { pk = Math.max(pk, Math.abs(v)); ss += v * v; n++; } } }
  const rms = 20 * Math.log10(Math.sqrt(ss / Math.max(1, n)) + 1e-9), ok = !bad && rms > -45 && pk < 1; if (!ok) fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + w.padEnd(11) + ` nonfinite ${bad} peak ${pk.toFixed(3)} rms ${rms.toFixed(1)} dB cpu ${((Date.now() - t0) / 1000 / secs).toFixed(3)}`); }
process.exit(fail ? 1 : 0);
