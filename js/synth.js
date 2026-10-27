/* Maut ki machine — SYNTH: a math-based generative synthesiser.
   Every sample is computed: FM operators, Karplus–Strong strings, modal resonator banks (membrane, bar, glass, metal
   mode ratios), PolyBLEP oscillators through TPT state-variable filters, unison pads with stereo chorus, FM felt pianos,
   granular clouds, Shepard risers, a feedback-delay-network reverb, a glue compressor and a look-ahead limiter.
   The music comes from systems that evolve rather than loop: a curated progression grammar with voice leading, motifs that
   re-harmonise themselves against every chord (chord-tone roles, not fixed pitches) and develop as A A' B A, Fibonacci-word
   and Euclidean rhythms, 1/f (Voss) and L-system melodic walks, polymetric arpeggio cycles, cellular automata, logistic-map
   and Lorenz-attractor modulation. Same parameters → same audio.
   Self-contained so it runs in a Web Worker (via SYNTH_CORE.toString()) and in Node for testing. */
'use strict';
function SYNTH_CORE(){
  const TAU = Math.PI * 2;

  // =========================================================== utilities
  function rngOf(seed){ let a = (seed >>> 0) || 1; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashSeed(){ let h = 2166136261 >>> 0; for (let i = 0; i < arguments.length; i++){ h ^= Math.imul((arguments[i] | 0) + 0x9E3779B9, 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0; } return h >>> 0; }
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, k) => a + (b - a) * k;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const pick = (r, a) => a[(r() * a.length) | 0];
  const rr = (r, a, b) => a + r() * (b - a);
  const pickW = (r, o) => { let s = 0; for (const k in o) s += Math.max(0, o[k]); let x = r() * s; for (const k in o){ x -= Math.max(0, o[k]); if (x <= 0) return k; } return Object.keys(o)[0]; };
  function euclid(k, n, rot){ const o = []; for (let i = 0; i < n; i++) o.push(Math.floor((i + 1) * k / n) - Math.floor(i * k / n) ? 1 : 0); return o.map((_, i) => o[((i - (rot | 0)) % n + n) % n]); }
  // Fibonacci word (L-system A→AB, B→A): an aperiodic long/short rhythm that still feels ordered
  function fibWord(n){ let s = 'A'; while (s.length < n) s = s.replace(/A|B/g, c => c === 'A' ? 'AB' : 'A'); return s.slice(0, n); }
  // 1/f "Voss" noise: a few dice re-rolled at halving rates — melodies drawn from it sound neither random nor mechanical
  function voss(r, n, dice){ const d = Array.from({length: dice}, () => r()), o = []; for (let i = 0; i < n; i++){ for (let k = 0; k < dice; k++) if (i % (1 << k) === 0) d[k] = r(); o.push(d.reduce((a, b) => a + b, 0) / dice); } return o; }
  // sine by table, phase in cycles
  const SN = 4096, SIN = new Float32Array(SN + 1); for (let i = 0; i <= SN; i++) SIN[i] = Math.sin(i / SN * TAU);
  function sin1(ph){ ph -= Math.floor(ph); const x = ph * SN, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); }
  function blep(t, dt){ if (t < dt){ t /= dt; return t + t - t * t - 1; } if (t > 1 - dt){ t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
  // TPT state-variable filter (Simper)
  function svf(){ return {ic1: 0, ic2: 0, a1: 1, a2: 0, a3: 0, k: 1, lp: 0, bp: 0, hp: 0}; }
  function svfSet(s, fc, q, sr){ const g = Math.tan(Math.PI * clamp(fc, 10, sr * .45) / sr), k = 1 / q; s.k = k; s.a1 = 1 / (1 + g * (g + k)); s.a2 = g * s.a1; s.a3 = g * s.a2; }
  function svfTick(s, v0){ const v3 = v0 - s.ic2, v1 = s.a1 * s.ic1 + s.a2 * v3, v2 = s.ic2 + s.a2 * s.ic1 + s.a3 * v3; s.ic1 = 2 * v1 - s.ic1; s.ic2 = 2 * v2 - s.ic2; s.lp = v2; s.bp = v1; s.hp = v0 - s.k * v1 - v2; return v2; }
  function fadeTail(m, sr, sec){ const n = m.length, f = Math.min(n, (sec * sr) | 0); for (let i = 0; i < f; i++) m[n - 1 - i] *= i / f; }
  // damped-sine (modal) bank added into out: y[n] = 2r cos w y[n-1] - r² y[n-2]
  function modal(sr, out, f0, ratios, amps, decays, gain){ const n = out.length;
    for (let k = 0; k < ratios.length; k++){ const f = f0 * ratios[k]; if (f > sr * .45 || f < 15) continue;
      const w = TAU * f / sr, r = Math.exp(-1 / (decays[k] * sr)), c = 2 * r * Math.cos(w), r2 = r * r, lim = Math.min(n, Math.ceil(decays[k] * sr * 7) + 2);
      let y2 = 0, y1 = amps[k] * gain * r * Math.sin(w); if (n > 1) out[1] += y1;
      for (let i = 2; i < lim; i++){ const y = c * y1 - r2 * y2; out[i] += y; y2 = y1; y1 = y; } } }
  // stereo chorus applied in place to a finished stereo buffer: two modulated delay lines, opposite phase per side
  function chorusST(sr, l, r, depthMs, rate, mix, seed){ const n = l.length, N = Math.round(.04 * sr), bl = new Float32Array(N), br = new Float32Array(N); let i = 0, ph = (seed % 97) / 97;
    const base = .012 * sr, dep = depthMs * .001 * sr, rd = (b, pos) => { let x = pos; while (x < 0) x += N; const i0 = x | 0, f = x - i0; return b[i0 % N] + (b[(i0 + 1) % N] - b[i0 % N]) * f; };
    for (let s = 0; s < n; s++){ bl[i] = l[s]; br[i] = r[s]; ph += rate / sr; const d1 = base + dep * sin1(ph), d2 = base + dep * sin1(ph + .5), d3 = base * .7 + dep * sin1(ph * 1.31 + .25);
      const yl = rd(bl, i - d1) * .7 + rd(br, i - d3) * .3, yr = rd(br, i - d2) * .7 + rd(bl, i - d3 * 1.1) * .3; i = (i + 1) % N; l[s] = l[s] * (1 - mix * .5) + yl * mix; r[s] = r[s] * (1 - mix * .5) + yr * mix; } }

  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const MODES = {minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], pentMinor: [0, 3, 5, 7, 10]};
  // physical mode ratios
  const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501];     // circular membrane (Bessel zeros)
  const BODIES = {
    wood: {r: [1, 2.57, 4.42, 6.1], a: [1, .45, .2, .1], d: [.08, .04, .022, .014]},
    glass: {r: [1, 2.32, 4.25, 6.63, 9.38], a: [1, .55, .32, .18, .1], d: [1.1, .7, .42, .26, .16]},
    membrane: {r: MEMBRANE.slice(0, 6), a: [1, .62, .45, .32, .22, .15], d: [.32, .2, .14, .1, .08, .06]},
    bar: {r: [1, 3.932, 9.538], a: [1, .32, .1], d: [.7, .22, .07]},                 // tuned marimba bar 1 : 3.9 : 9.5
    metal: {r: [1, 1.414, 2.233, 2.756, 3.702, 4.467], a: [1, .75, .6, .42, .3, .2], d: [1.6, 1.2, .9, .65, .45, .3]}};
  const METAL6 = [2, 3, 4.16, 5.43, 6.79, 8.21];
  const panLR = pan => { const p = clamp(pan, -1, 1); return [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)]; };

  // =========================================================== instruments (each returns {m} mono or {l, r} stereo)
  const I = {};
  // kick: sine with a two-stage pitch drop, a 3 ms click, gentle saturation (never a square), low-passed so it stays round
  I.kick = (sr, e) => { const P = e.p, n = Math.ceil((P.decay * 5 + .08) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    let ph = 0, amp = 1, pe = 1; const ak = Math.exp(-1 / (P.decay * sr)), pk = Math.exp(-1 / (P.pitchT * sr)), atk = .0012 * sr, clk = .003 * sr, dr = clamp(P.drive, 1, 1.9), dn = Math.tanh(dr), lp = svf(); svfSet(lp, 6500, .6, sr);
    for (let i = 0; i < n; i++){ const f = P.f1 + (P.f0 - P.f1) * pe; pe *= pk; ph += f / sr; let x = sin1(ph) * amp; amp *= ak; if (i < atk) x *= i / atk;
      if (i < clk) x += (nz() * 2 - 1) * (1 - i / clk) * P.click * .7; m[i] = svfTick(lp, Math.tanh(x * dr) / dn); }
    fadeTail(m, sr, .02); return {m}; };
  I.snare = (sr, e) => { const P = e.p, n = Math.ceil((Math.max(P.tone, P.noise) * 6 + .03) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    if (!P.clap) modal(sr, m, P.f0, MEMBRANE, [1, .6, .45, .35, .3, .22, .18, .14], MEMBRANE.map((r, k) => P.tone / (1 + k * .55)), .55 * P.body);
    const s = svf(); svfSet(s, P.nf, P.clap ? 1.2 : .7, sr); const h = svf(); svfSet(h, 9500, .7, sr);
    const bursts = P.clap ? [0, .0095, .0195, .031] : [0], tail = P.noise;
    for (let i = 0; i < n; i++){ const t = i / sr; let env = 0;
      if (P.clap){ for (let b = 0; b < 3; b++){ const d = t - bursts[b]; if (d >= 0) env += Math.exp(-d / .0055) * .8; } const d = t - bursts[3]; if (d >= 0) env += Math.exp(-d / tail); }
      else env = Math.exp(-t / tail) * Math.min(1, t / .0007);
      svfTick(s, nz() * 2 - 1); const x = P.clap ? s.bp : s.bp * .6 + s.hp * .4; m[i] += svfTick(h, x) * env * P.snap; }
    fadeTail(m, sr, .01); return {m}; };
  // hat: filtered noise blended with six square partials at metallic ratios (the 808 recipe), high-passed, short
  I.hat = (sr, e) => { const P = e.p, d = e.open ? P.open : P.closed, n = Math.ceil((d * 6 + .01) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    const ph = new Float64Array(6), inc = METAL6.map(r => r * P.base / sr), h1 = svf(), h2 = svf(), bp = svf(); svfSet(h1, P.hp, .6, sr); svfSet(h2, P.hp * .9, .6, sr); svfSet(bp, P.ring, 2, sr);
    const lp = svf(); svfSet(lp, 15500, .5, sr); let a = 1; const ak = Math.exp(-1 / (d * sr)), atk = .0006 * sr, nzA = clamp(P.noisy, .3, .95);
    for (let i = 0; i < n; i++){ let x = 0; for (let k = 0; k < 6; k++){ ph[k] += inc[k]; if (ph[k] >= 1) ph[k] -= 1; x += ph[k] < .5 ? 1 : -1; }
      x = x / 6 * (1 - nzA) + (nz() * 2 - 1) * nzA; svfTick(h1, x); svfTick(h2, h1.hp); svfTick(bp, h2.hp);
      m[i] = svfTick(lp, h2.hp * .7 + bp.bp * .35) * a * (i < atk ? i / atk : 1); a *= ak; }
    fadeTail(m, sr, .004); return {m}; };
  I.perc = (sr, e) => { const B = BODIES[e.body] || BODIES.wood, dm = e.decay || 1, n = Math.ceil((Math.max.apply(null, B.d) * dm * 6 + .02) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    modal(sr, m, e.f, B.r, B.a, B.d.map(x => x * dm), .5);
    const s = svf(); svfSet(s, Math.min(e.f * 3.5, 9000), .7, sr); const sn = Math.min(n, (.005 * sr) | 0);
    for (let i = 0; i < sn; i++){ svfTick(s, nz() * 2 - 1); m[i] += s.bp * (1 - i / sn) * .3 * (e.hard || .5); }
    fadeTail(m, sr, .01); return {m}; };
  // Karplus–Strong with fractional-delay allpass tuning and decay stretch; a small body resonance warms the pluck
  I.string = (sr, e) => { const f = e.f, P = e.p, n = Math.ceil((e.dur + P.rel * 4 + .05) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    const N = sr / f, L = Math.max(2, Math.floor(N - 1.6)), frac = N - 1.5 - L, buf = new Float32Array(L + 1);
    let lp = 0; const bc = clamp(P.bright * (e.bright || 1), .04, 1); for (let i = 0; i <= L; i++){ lp += (nz() * 2 - 1 - lp) * bc; buf[i] = lp; }
    let mean = 0; for (let i = 0; i <= L; i++) mean += buf[i]; mean /= L + 1; for (let i = 0; i <= L; i++) buf[i] -= mean;
    const rho = Math.pow(10, -3 / (P.t60 * f)), C = (1 - frac) / (1 + frac), S = .5; let apx = 0, apy = 0, prev = 0, idx = 0, g = 1, dx = 0, dy = 0;
    const gN = e.dur * sr, rk = Math.exp(-1 / (P.rel * sr)), body = svf(); svfSet(body, clamp(f * 2.5, 180, 900), 1.6, sr);
    for (let i = 0; i < n; i++){ const x = buf[idx], y = rho * ((1 - S) * x + S * prev); prev = x; const ap = C * y + apx - C * apy; apx = y; apy = ap; buf[idx] = ap; if (++idx > L) idx = 0;
      if (i > gN) g *= rk; const o = x * g, dco = o - dx + .995 * dy; dx = o; dy = dco; svfTick(body, dco); m[i] = (dco + body.bp * .35) * 1.4; }
    fadeTail(m, sr, .01); return {m}; };
  // FM: carrier + modulator (+ optional second modulator), decaying index, feedback. Index is capped so it never turns to noise.
  I.fm = (sr, e) => { const P = e.p, f = e.f, n = Math.ceil((e.dur + P.rel * 5 + .02) * sr), m = new Float32Array(n);
    const iScale = Math.sqrt(clamp(440 / f, .2, 2.2)) * (e.bright || 1), I0 = Math.min(P.index * iScale, 4.5), Is = Math.min(P.indexSus * iScale, 2.5);
    const fm = f * P.ratio, fm2 = f * (P.ratio2 || 0); let pc = 0, pm = 0, pm2 = 0, fb = 0, ie = 1, d = 1, rel = 1, vp = 0;
    const ik = Math.exp(-1 / (P.idecay * sr)), atk = Math.max(1, P.atk * sr), dk = Math.exp(-1 / (P.dec * sr)), rk = Math.exp(-1 / (P.rel * sr)), gN = e.dur * sr, vibF = 5.1 / sr, vibA = P.vib || 0;
    for (let i = 0; i < n; i++){ let env; if (i < atk) env = i / atk; else { d *= dk; env = P.sus + (1 - P.sus) * d; } if (i > gN) rel *= rk;
      const Ii = Is + (I0 - Is) * ie; ie *= ik; vp += vibF; const vib = vibA ? 1 + vibA * sin1(vp) * Math.min(1, i / (sr * .35)) : 1;
      pc += f * vib / sr; pm += fm * vib / sr; pm2 += fm2 / sr;
      const mod = sin1(pm + fb * (P.fb || 0) / TAU + (fm2 ? sin1(pm2) * P.index2 * ie / TAU : 0)); fb = mod;
      m[i] = sin1(pc + Ii * mod / TAU) * env * rel; }
    fadeTail(m, sr, .01); return {m}; };
  // PolyBLEP saw/square pair through a resonant state-variable filter with its own envelope
  I.saw = (sr, e) => { const P = e.p, f = e.f, n = Math.ceil((e.dur + P.rel * 5 + .02) * sr), m = new Float32Array(n), s = svf();
    const dt = f / sr, dt2 = f * (1 + (P.det || .0035)) / sr; let t1 = (e.seed % 997) / 997, t2 = .37, d = 1, rel = 1, fe = 1, vp = 0;
    const atk = Math.max(1, P.atk * sr), dk = Math.exp(-1 / (P.dec * sr)), rk = Math.exp(-1 / (P.rel * sr)), fk = Math.exp(-1 / (P.fdec * sr)), gN = e.dur * sr, br = e.bright || 1, vibA = P.vib || 0;
    for (let i = 0; i < n; i++){ vp += 5.1 / sr; const vb = vibA ? 1 + vibA * sin1(vp) * Math.min(1, i / (sr * .35)) : 1;
      t1 += dt * vb; if (t1 >= 1) t1 -= 1; t2 += dt2 * vb; if (t2 >= 1) t2 -= 1;
      let x = 2 * t1 - 1 - blep(t1, dt); x += P.sq ? ((t2 < .5 ? 1 : -1) + blep(t2, dt2) - blep((t2 + .5) % 1, dt2)) * .6 : (2 * t2 - 1 - blep(t2, dt2)) * .5;
      if ((i & 15) === 0) svfSet(s, f * (P.cut + P.famt * fe) * br, P.res, sr); fe *= fk; svfTick(s, x);
      let env; if (i < atk) env = i / atk; else { d *= dk; env = P.sus + (1 - P.sus) * d; } if (i > gN) rel *= rk;
      m[i] = s.lp * env * rel * .5 + (P.sub ? sin1(i * f * (f < 70 ? 1 : .5) / sr) * env * rel * P.sub : 0); }
    fadeTail(m, sr, .01); return {m}; };
  // synth pluck: two detuned saws + a quiet square an octave down through a 4-pole low-pass whose cutoff falls fast. No resonance, no
  // inharmonic partials, so it never rings like a bell or a string — the soft analog arp of modern electronica.
  I.synpluck = (sr, e) => { const P = e.p, f = e.f, n = Math.ceil((Math.min(e.dur, 2) + P.dec * 5 + .03) * sr), m = new Float32Array(n), s1 = svf(), s2 = svf(), nz = rngOf(e.seed);
    const dt1 = f * (1 - P.det) / sr, dt2 = f * (1 + P.det) / sr, dt3 = f * .5 / sr; let t1 = nz(), t2 = nz(), t3 = nz(), fe = 1, a = 1;
    const fk = Math.exp(-1 / (P.fdec * sr)), ak = Math.exp(-1 / (P.dec * sr)), atk = Math.max(1, .0025 * sr), br = clamp(e.bright === undefined ? .6 : e.bright, .15, 1.2), vel = e.vel === undefined ? .8 : e.vel;
    const base = clamp(f * P.cut, 120, 4000), top = clamp(f * P.famt * (.4 + .6 * vel) * (.5 + br), base, 9000);
    for (let i = 0; i < n; i++){ t1 += dt1; if (t1 >= 1) t1 -= 1; t2 += dt2; if (t2 >= 1) t2 -= 1; t3 += dt3; if (t3 >= 1) t3 -= 1;
      const x = (2 * t1 - 1 - blep(t1, dt1)) * .5 + (2 * t2 - 1 - blep(t2, dt2)) * .5 + ((t3 < .5 ? 1 : -1) + blep(t3, dt3) - blep((t3 + .5) % 1, dt3)) * P.sub;
      if ((i & 15) === 0){ const fc = base + (top - base) * fe; svfSet(s1, fc, .62, sr); svfSet(s2, fc, .55, sr); } fe *= fk;
      const y = svfTick(s2, svfTick(s1, x)); m[i] = y * a * (i < atk ? i / atk : 1) * .45; a *= ak; }
    fadeTail(m, sr, .01); return {m}; };
  // blip: a sine with a short harmonic FM transient (ratio 2, index falling to zero in ~25 ms) — soft, round, dry
  I.blip = (sr, e) => { const P = e.p, f = e.f, n = Math.ceil((P.dec * 5 + .02) * sr), m = new Float32Array(n); let pc = 0, pm = 0, ie = 1, a = 1;
    const ik = Math.exp(-1 / (.025 * sr)), ak = Math.exp(-1 / (P.dec * sr)), atk = Math.max(1, .003 * sr), I0 = P.index * (e.vel === undefined ? .8 : e.vel);
    for (let i = 0; i < n; i++){ pc += f / sr; pm += f * 2 / sr; m[i] = sin1(pc + I0 * ie * sin1(pm) / TAU) * a * (i < atk ? i / atk : 1) * .5; ie *= ik; a *= ak; }
    fadeTail(m, sr, .01); return {m}; };
  // mallet = modal bar/glass struck at pitch
  I.mallet = (sr, e) => I.perc(sr, {f: e.f, body: e.p.body, decay: e.p.decay * (e.dur > .4 ? 1.2 : 1), hard: .4 + .5 * (e.bright || .5), seed: e.seed});
  // keys: a two-pair FM piano (tone pair at 1:1, hammer pair at 1:14), key-tracked decay, three slightly detuned strings per note,
  // velocity opens the tone. kind: 'felt' (dark, close-miked upright with a soft thump), 'epiano' (tine), 'glass' (bright, long)
  I.keys = (sr, e) => { const P = e.p, notes = e.notes || [Math.round(69 + 12 * Math.log2(e.f / 440))], nn = notes.length, kind = P.kind || 'felt', vel = clamp(e.vel === undefined ? .8 : e.vel, .15, 1), br = clamp(e.bright === undefined ? .55 : e.bright, .1, 1.3);
    const maxDec = kind === 'glass' ? 5 : kind === 'epiano' ? 3.2 : 2.8, n = Math.ceil((Math.min(e.dur, 6) + (P.rel || .4) * 5 + .05) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed), gN = e.dur * sr;
    const lp = svf(), lpR = svf(); const fc = kind === 'felt' ? 2600 * (.5 + br) : kind === 'epiano' ? 3600 * (.5 + br) : 6500 * (.5 + br); svfSet(lp, fc, .55, sr); svfSet(lpR, fc * 1.05, .55, sr);
    notes.forEach((mn, j) => { const f = mtof(mn), [gl, gr] = panLR(clamp((mn - 64) / 30, -.55, .55) + (nn > 1 ? (j / (nn - 1) - .5) * .3 : 0));
      const dec = clamp(maxDec * Math.pow(220 / f, .55), .35, maxDec), dk = Math.exp(-1 / (dec * sr)), rk = Math.exp(-1 / ((P.rel || .4) * sr)), atk = Math.max(1, .0025 * sr);
      const I0 = (kind === 'epiano' ? 1.2 : kind === 'glass' ? 1.7 : 1.0) * (.45 + .9 * vel) * (.6 + .6 * br) * Math.sqrt(clamp(330 / f, .3, 2)), ik = Math.exp(-1 / ((kind === 'glass' ? .9 : .32) * sr)), hamI = (kind === 'felt' ? .5 : kind === 'glass' ? .08 : .3) * vel, hk = Math.exp(-1 / (.02 * sr));
      const strings = kind === 'epiano' ? [[0, 1]] : [[-1.8, .5], [0, 1], [1.9, .5]];
      for (const [cents, g] of strings){ const fv = f * Math.pow(2, cents / 1200); let pc = nz(), pm = nz(), ph = nz(), ie = 1, he = 1, a = 1, rel = 1, fb = 0;
        for (let i = 0; i < n; i++){ const env = (i < atk ? i / atk : 1) * a; a *= dk; if (i > gN) rel *= rk; if (rel < 1e-4) break;
          pc += fv / sr; pm += fv / sr; ph += fv * 14 / sr; const mod = sin1(pm + fb * .12 / TAU); fb = mod; const hm = sin1(ph) * hamI * he; he *= hk;
          const x = sin1(pc + (I0 * ie * mod + hm) / TAU) * env * rel * g * .5; ie *= ik; l[i] += x * gl; r[i] += x * gr; } }
      if (kind === 'felt'){ const th = svf(); svfSet(th, 420 + 200 * nz(), 1.1, sr); const tn = Math.min(n, (.014 * sr) | 0); for (let i = 0; i < tn; i++){ svfTick(th, nz() * 2 - 1); const x = th.bp * (1 - i / tn) * .35 * vel; l[i] += x * gl; r[i] += x * gr; } } });
    for (let i = 0; i < n; i++){ l[i] = svfTick(lp, l[i]); r[i] = svfTick(lpR, r[i]); }
    fadeTail(l, sr, .01); fadeTail(r, sr, .01); return {l, r}; };

  // ---------- chord-holding stereo voices
  function lzAt(e, t){ const a = e.mod; if (!a) return 0; const x = t / e.modT, i = Math.floor(x); if (i <= 0) return a[0]; if (i >= a.length - 1) return a[a.length - 1]; return a[i] + (a[i + 1] - a[i]) * (x - i); }
  I.pad = (sr, e) => { const P = e.p, notes = e.notes, n = Math.ceil((e.dur + P.rel * 4 + .05) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed);
    const atk = Math.max(1, P.atk * sr), gN = e.dur * sr, rk = Math.exp(-1 / (P.rel * sr)), nn = notes.length, br = e.bright === undefined ? .5 : e.bright;
    if (P.kind === 'supersaw' || P.kind === 'lush'){ const lush = P.kind === 'lush', V = lush ? (nn > 4 ? 4 : 5) : (nn > 4 ? 2 : 3), g0 = (lush ? .34 : .3) / Math.sqrt(V);
      notes.forEach((mn, j) => { const f = mtof(mn), pj = nn > 1 ? (j / (nn - 1) - .5) * 1.5 : 0;
        for (let v = 0; v < V; v++){ const cents = (v - (V - 1) / 2) * P.det * (lush ? .8 : 1), fv = f * Math.pow(2, cents / 1200), dt = fv / sr; let t = nz(); const [gl, gr] = panLR(pj + (v - (V - 1) / 2) * .35);
          for (let i = 0; i < n; i++){ t += dt; if (t >= 1) t -= 1; const x = (2 * t - 1 - blep(t, dt)) * g0; l[i] += x * gl; r[i] += x * gr; } } });
      const sl = svf(), sR = svf(), sl2 = svf(), sR2 = svf(); const fAtk = Math.max(1, (lush ? P.atk * 1.6 : P.atk * .8) * sr);
      for (let i = 0; i < n; i++){ if ((i & 31) === 0){ const z = lzAt(e, i / sr), fe = Math.min(1, i / fAtk), fc = P.cut * (.45 + br) * (1 + .55 * z) * (lush ? (.35 + .65 * fe) : 1); svfSet(sl, fc, P.res, sr); svfSet(sR, fc * 1.04, P.res, sr); if (lush){ svfSet(sl2, fc * 1.6, .6, sr); svfSet(sR2, fc * 1.5, .6, sr); } }
        l[i] = svfTick(sl, l[i]); r[i] = svfTick(sR, r[i]); if (lush){ l[i] = svfTick(sl2, l[i]); r[i] = svfTick(sR2, r[i]); } }
      if (lush) chorusST(sr, l, r, 2.6, .55, .5, e.seed); }
    else if (P.kind === 'fmpad'){
      notes.forEach((mn, j) => { const f = mtof(mn), pj = nn > 1 ? (j / (nn - 1) - .5) * 1.4 : 0; for (let side = 0; side < 2; side++){ const fv = f * Math.pow(2, (side ? 1 : -1) * P.det / 1200); let pc = nz(), pm = nz(); const lf = P.lfo * (1 + j * .13 + side * .07), ph0 = nz();
          const g = .22 * (side ? Math.sin((pj + 1) * Math.PI / 4) : Math.cos((pj + 1) * Math.PI / 4)), out = side ? r : l;
          const bI = Math.min(P.index * (.6 + br * .8), 2.2) / TAU; let Ii = 0;
          for (let i = 0; i < n; i++){ if ((i & 63) === 0) Ii = bI * (.55 + .45 * sin1(ph0 + i * lf / sr)); pc += fv / sr; pm += fv * P.ratio / sr; out[i] += sin1(pc + Ii * sin1(pm)) * g; } } });
      chorusST(sr, l, r, 1.8, .4, .35, e.seed); }
    else { // additive: harmonic partials with independent slow amplitude drift — the timbre breathes
      notes.forEach((mn, j) => { const f = mtof(mn), K = 8; for (let k = 1; k <= K; k++){ const fk = f * k * (1 + P.stretch * (k - 1) * (k - 1)); if (fk > sr * .42) break;
          const a0 = .2 / Math.pow(k, P.tilt), rate = P.shimmer * (.3 + nz()), ph0 = nz(), side = (k + j) & 1, out = side ? r : l, other = side ? l : r;
          const w = TAU * fk / sr, cw = Math.cos(w), sw = Math.sin(w), p0 = nz() * TAU; let c = Math.cos(p0), sn = Math.sin(p0);
          for (let b = 0; b < n; b += 64){ const e0 = Math.min(n, b + 64), amp0 = a0 * (.55 + .45 * sin1(ph0 + b * rate / sr)), amp1 = a0 * (.55 + .45 * sin1(ph0 + e0 * rate / sr)), da = (amp1 - amp0) / (e0 - b); let amp = amp0;
            for (let i = b; i < e0; i++){ const c2 = c * cw - sn * sw; sn = sn * cw + c * sw; c = c2; const x = sn * amp; amp += da; out[i] += x * .8; other[i] += x * .25; }
            const g = 1.5 - .5 * (c * c + sn * sn); c *= g; sn *= g; } } });
      chorusST(sr, l, r, 2, .3, .3, e.seed); }
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / atk) * (i > gN ? Math.pow(rk, i - gN) : 1); l[i] *= env; r[i] *= env; }
    if (e.gate){ let gv = 0; const gk = 1 - Math.exp(-1 / (.004 * sr)); for (let i = 0; i < n; i++){ const tg = e.gate[Math.floor(i / sr / e.gateST) % 16] ? 1 : .06; gv += (tg - gv) * gk; l[i] *= gv; r[i] *= gv; } }
    const f = Math.min(n, (.05 * sr) | 0); for (let i = 0; i < f; i++){ l[n - 1 - i] *= i / f; r[n - 1 - i] *= i / f; }
    return {l, r}; };
  // just-intonation drone: root, fifth (3/2), octave — slow beating between detuned pairs
  I.drone = (sr, e) => { const n = Math.ceil((e.dur + 3) * sr), l = new Float32Array(n), r = new Float32Array(n), f = mtof(e.root), atk = 2.5 * sr, rel = 2.5 * sr, gN = e.dur * sr;
    const parts = [[1, .5], [1.5, .3], [2, .18], [3, .06]]; const beat = .17 + (e.seed % 7) * .06;
    parts.forEach(([ratio, a], k) => { let pl = k * .13, pr = k * .29; const fl = f * ratio, fr = f * ratio + beat * (k + 1) * .5;
      for (let i = 0; i < n; i++){ pl += fl / sr; pr += fr / sr; l[i] += sin1(pl) * a; r[i] += sin1(pr) * a; } });
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / atk) * (i > gN ? Math.max(0, 1 - (i - gN) / rel) : 1); l[i] *= env * .5; r[i] *= env * .5; } return {l, r}; };
  // texture: granular cloud on chord tones / resonant wind / Lorenz-driven FM drone / vinyl crackle
  I.tex = (sr, e) => { const n = Math.ceil((e.dur + 2) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed), P = e.p, gN = e.dur * sr;
    if (P.kind === 'grains'){ let t = 0; while (t < e.dur){ const z = lzAt(e, t), dens = P.density * (.4 + .6 * (z * .5 + .5)), ch = e.chordAt(e.t + t), mn = ch[(nz() * ch.length) | 0] + 12 * ((nz() * 2) | 0);
        const f = mtof(mn), glen = (.04 + nz() * .18) * sr, s0 = (t * sr) | 0, [gl, gr] = panLR(nz() * 2 - 1), idx = Math.min(P.fm, 1) * nz(); let ph = nz(), pm = 0;
        for (let i = 0; i < glen && s0 + i < n; i++){ const w = .5 - .5 * Math.cos(TAU * i / glen); ph += f / sr; pm += f * 2 / sr; const x = sin1(ph + idx * sin1(pm) / TAU) * w * .16; l[s0 + i] += x * gl; r[s0 + i] += x * gr; }
        t += 1 / Math.max(1, dens) * (.4 + nz() * 1.2); } }
    else if (P.kind === 'wind'){ const a = svf(), b = svf(); for (let i = 0; i < n; i++){ if ((i & 63) === 0){ const z = lzAt(e, i / sr); svfSet(a, 300 + 2600 * (z * .5 + .5), P.q, sr); svfSet(b, 360 + 2400 * (.5 - z * .5), P.q, sr); }
        svfTick(a, nz() * 2 - 1); svfTick(b, nz() * 2 - 1); l[i] = a.bp * .5; r[i] = b.bp * .5; } }
    else if (P.kind === 'glitch'){ let t = .2; const bt = P.beat || .5;
      while (t < e.dur){ const z = lzAt(e, t), ch = e.chordAt(e.t + t), mn = ch[(nz() * ch.length) | 0] + 12 * (1 + ((nz() * 3) | 0)), f = mtof(mn), burst = nz() < .22 ? 2 + ((nz() * 5) | 0) : 1, step = bt / 8 * (nz() < .5 ? 1 : .5);
        for (let b = 0; b < burst; b++){ const s0 = ((t + b * step) * sr) | 0, glen = (.006 + nz() * .045) * sr, [gl, gr] = panLR(nz() < .5 ? -.8 - nz() * .2 : .8 + nz() * .2), g = (.16 + .12 * nz()) * (1 - b / (burst + 1)); let ph = 0, pm = 0;
          for (let i = 0; i < glen && s0 + i < n; i++){ const w = i < 24 ? i / 24 : Math.exp(-(i - 24) / (glen * .35)); ph += f / sr; pm += f * 2 / sr; const x = sin1(ph + .4 * sin1(pm) / TAU) * w * g; l[s0 + i] += x * gl; r[s0 + i] += x * gr; } }
        t += bt / 4 * (1 + ((nz() * (10 - P.density * .6 + 2 * (1 - z))) | 0)); } }
    else if (P.kind === 'crackle'){ const h = svf(); svfSet(h, 2400, .6, sr); let pop = 0, hiss = 0; const pr = 7 * (P.rate || 1) / sr;
      for (let i = 0; i < n; i++){ if (nz() < pr) pop = (nz() * 2 - 1) * (nz() < .12 ? 1 : .3); else pop *= .25; hiss = (nz() * 2 - 1) * .012; svfTick(h, pop + hiss); const x = h.hp * .6; l[i] = x; r[i] = nz() < .5 ? x : x * .7; } }
    else { const f = mtof(e.root); let pc = 0, pm = 0; for (let i = 0; i < n; i++){ const z = lzAt(e, i / sr), ratio = 1.5 + z * 1.2, idx = .8 + (z * .5 + .5) * 1.6; pc += f / sr; pm += f * ratio / sr; const x = sin1(pc + idx * sin1(pm) / TAU) * .18; l[i] = x * (.6 + .4 * z); r[i] = x * (.6 - .4 * z); } }
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / (1.5 * sr)) * (i > gN ? Math.max(0, 1 - (i - gN) / (1.5 * sr)) : 1); l[i] *= env; r[i] *= env; } return {l, r}; };
  I.riser = (sr, e) => { const n = Math.ceil((e.dur + .05) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed), a = svf(), b = svf(); let ph = 0;
    for (let i = 0; i < n; i++){ const k = i / n, fc = 250 * Math.pow(36, k); if ((i & 31) === 0){ svfSet(a, fc, 2.2, sr); svfSet(b, fc * 1.07, 2.2, sr); } svfTick(a, nz() * 2 - 1); svfTick(b, nz() * 2 - 1);
      ph += (110 * Math.pow(8, k)) / sr; const env = Math.pow(k, 2.2), s = sin1(ph) * .12 * env; l[i] = (a.bp * .6) * env + s; r[i] = (b.bp * .6) * env + s; }
    fadeTail(l, sr, .03); fadeTail(r, sr, .03); return {l, r}; };
  // Shepard riser: octave-spaced partials glide up forever under a Gaussian window on log-frequency — the ear hears an endless climb
  I.shepard = (sr, e) => { const n = Math.ceil((e.dur + .3) * sr), l = new Float32Array(n), r = new Float32Array(n), K = 7, ph = new Float64Array(K), phR = new Float64Array(K), f0 = e.f0 || 40, cyc = e.cycle || 6, gN = e.dur * sr;
    for (let i = 0; i < n; i++){ const t = i / sr, pos = (t / cyc) % 1, env = Math.min(1, i / (sr * .5)) * (i > gN ? Math.max(0, 1 - (i - gN) / (sr * .25)) : 1) * (e.rise ? Math.pow(Math.min(1, t / e.dur), 1.4) : 1); let x = 0, y = 0;
      for (let k = 0; k < K; k++){ const oct = k + pos, f = f0 * Math.pow(2, oct); if (f > sr * .4) continue; const w = Math.exp(-Math.pow((oct - K / 2) / 1.5, 2)); ph[k] += f / sr; phR[k] += f * 1.003 / sr; x += sin1(ph[k]) * w; y += sin1(phR[k]) * w; }
      l[i] = x * .14 * env; r[i] = y * .14 * env; }
    return {l, r}; };
  I.impact = (sr, e) => { const n = Math.ceil(1.8 * sr), m = new Float32Array(n), nz = rngOf(e.seed), s = svf(); let ph = 0;
    for (let i = 0; i < n; i++){ const t = i / sr, f = 28 + 46 * Math.exp(-t / .25); ph += f / sr; if ((i & 31) === 0) svfSet(s, 150 + 6000 * Math.exp(-t / .12), .7, sr); svfTick(s, nz() * 2 - 1);
      m[i] = sin1(ph) * Math.exp(-t / .55) * Math.min(1, t / .002) + s.lp * Math.exp(-t / .3) * .4; } fadeTail(m, sr, .05); return {m}; };
  // =========================================================== genre instruments
  // mono legato line: one event plays a whole phrase, so slides are real portamento and the filter/amp state carries across notes
  I.mono = (sr, e) => { const P = e.p, N = e.notes, k = P.kind, n = Math.ceil((e.len + (P.rel || .06) * 6 + .05) * sr), m = new Float32Array(n);
    if (!N.length) return {m};
    const s1 = svf(), s2 = svf(); let p1 = 0, p2 = .37, p3 = 0, f = mtof(N[0].m), ft = f, a = 0, stage = 1, fenv = 0, gate = false, ni = -1, acc = 0, vel = 1, gk = 1, lfo = (e.seed % 1000) / 1000;
    const atkK = 1 - Math.exp(-1 / ((P.atk || .003) * sr)), decK = Math.exp(-1 / ((P.dec || .3) * sr)), relK = Math.exp(-1 / ((P.rel || .05) * sr)), fdK = Math.exp(-1 / ((P.fdec || .15) * sr)), sus = P.sus === undefined ? .7 : P.sus;
    const slideK = 1 - Math.exp(-1 / ((P.glide || .06) * sr)), dropK = 1 - Math.exp(-1 / ((P.drop || .0004) * sr)), dropTo = P.dropSemi ? Math.pow(2, P.dropSemi / 12) : 1, gain = P.gain || 1;
    let next = Math.max(0, Math.round(N[0].t * sr)), endAt = -1;
    for (let i = 0; i < n; i++){
      while (i === next){ ni++; const nt = N[ni], slide = !!nt.slide && gate; ft = mtof(nt.m); acc = nt.acc ? 1 : 0; vel = nt.v === undefined ? 1 : nt.v;
        if (slide) gk = slideK; else { f = ft * dropTo; gk = dropK; stage = 0; fenv = 1; if (k === 'b808' || k === 'log' || k === 'upright') a *= .3; }
        gate = true; endAt = i + Math.max(1, Math.round(nt.dur * sr)); next = ni + 1 < N.length ? Math.max(i + 1, Math.round(N[ni + 1].t * sr)) : -1; }
      if (i === endAt) gate = false;
      f += (ft - f) * gk;
      if (gate){ if (stage === 0){ a += (1.0001 - a) * atkK; if (a >= .995){ a = 1; stage = 1; } } else a = sus + (a - sus) * decK; } else a *= relK;
      fenv *= fdK; const dt = f / sr; let x = 0;
      if (k === 'acid' || k === 'square' || k === 'saw' || k === 'garage'){ p1 += dt; if (p1 >= 1) p1 -= 1; const saw = 2 * p1 - 1 - blep(p1, dt); let osc = saw;
        if (k === 'square' || k === 'garage' || (k === 'acid' && P.sq)){ p2 += dt; if (p2 >= 1) p2 -= 1; const sq = (p2 < .5 ? 1 : -1) + blep(p2, dt) - blep((p2 + .5) % 1, dt); osc = k === 'garage' ? saw * .5 + sq * .5 : sq * .8; }
        lfo += (P.wob || 0) / sr;
        if ((i & 15) === 0){ let fc, q = P.res || .9;
          if (k === 'acid'){ fc = P.cut * (e.cutAt ? e.cutAt(i / sr) : 1) * (1 + P.env * fenv * (1 + acc * 1.4)); q = P.res * (1 + acc * .25); }
          else if (k === 'garage') fc = f * (1.6 + P.famt * (.5 + .5 * sin1(lfo)) * (.6 + .4 * fenv));
          else fc = f * (P.cut + P.famt * fenv);
          svfSet(s1, fc, q, sr); svfSet(s2, fc, .7, sr); }
        svfTick(s1, osc); x = s1.lp; if (k === 'acid'){ x = svfTick(s2, x); x = Math.tanh(x * (2.2 + acc * 2.5)) * .55; } }
      else if (k === 'reese'){ p1 += dt * (1 + P.det); p2 += dt * (1 - P.det); p3 += dt * .5; if (p1 >= 1) p1 -= 1; if (p2 >= 1) p2 -= 1; lfo += P.lfo / sr;
        const o = (2 * p1 - 1 - blep(p1, dt)) + (2 * p2 - 1 - blep(p2, dt));
        if ((i & 15) === 0) svfSet(s1, P.cut * (1 + .75 * sin1(lfo)) * (.7 + .5 * fenv), 1.1, sr);
        x = Math.tanh((svfTick(s1, o) * .45 + sin1(p3) * .55) * 1.7) * .7; }
      else if (k === 'b808'){ p1 += dt; x = Math.tanh(sin1(p1) * P.drive) / Math.tanh(P.drive); }
      else if (k === 'log'){ p1 += dt; x = Math.tanh((sin1(p1) + .3 * sin1(p1 * 2.01) * fenv) * 1.5) * .8; }
      else if (k === 'upright'){ p1 += dt; x = sin1(p1) * .8 + .28 * sin1(2 * p1) * (.4 + .6 * fenv) + .1 * sin1(3 * p1) * fenv; }
      else { p1 += dt; x = sin1(p1) + .12 * sin1(2 * p1); }   // sub
      m[i] = x * a * vel * gain; }
    fadeTail(m, sr, .02); return {m}; };

  // chord stabs: detuned saws through a plucked filter, a band-passed dub chord, drawbar organ, or FM e-piano / soft piano
  I.stab = (sr, e) => { const P = e.p, k = P.kind, notes = e.notes, nn = notes.length, rel = P.rel || .06, n = Math.ceil((e.dur + rel * 6 + .03) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed);
    const gN = Math.round(e.dur * sr), br = e.bright === undefined ? .6 : e.bright, panOf = j => nn > 1 ? (j / (nn - 1) - .5) * 1.3 : 0;
    if (k === 'epiano' || k === 'piano'){ notes.forEach((mn, j) => { const o = I.fm(sr, {f: mtof(mn), dur: e.dur, p: P.fm, bright: br}).m, pn = panOf(j), gl = Math.cos((pn + 1) * Math.PI / 4) * .42, gr = Math.sin((pn + 1) * Math.PI / 4) * .42;
        for (let i = 0; i < Math.min(n, o.length); i++){ l[i] += o[i] * gl; r[i] += o[i] * gr; } }); return {l, r}; }
    notes.forEach((mn, j) => { const f = mtof(mn), pn = panOf(j), gl = Math.cos((pn + 1) * Math.PI / 4), gr = Math.sin((pn + 1) * Math.PI / 4);
      if (k === 'organ'){ const HR = [1, 2, 3, 4, 6, 8], AM = P.bars, ph0 = nz(); for (let h = 0; h < HR.length; h++){ if (!AM[h]) continue; const fh = f * HR[h]; if (fh > sr * .4) break; const amp = AM[h] * .13; let ph = ph0 * (h + 1);
          for (let i = 0; i < n; i++){ ph += fh / sr; const x = sin1(ph) * amp; l[i] += x * gl; r[i] += x * gr; } } }
      else for (let v = 0; v < 2; v++){ const fv = f * (1 + (v ? 1 : -1) * (P.det || .004)), dt = fv / sr; let t = nz(); for (let i = 0; i < n; i++){ t += dt; if (t >= 1) t -= 1; const x = (2 * t - 1 - blep(t, dt)) * .12; l[i] += x * gl; r[i] += x * gr; } } });
    const fl = svf(), fr = svf(); let fe = 1, d = 1, rl = 1; const fk = Math.exp(-1 / ((P.fdec || .12) * sr)), dk = Math.exp(-1 / ((P.dec || .25) * sr)), rk = Math.exp(-1 / (rel * sr)), atk = Math.max(1, .002 * sr), sus = P.sus || 0;
    for (let i = 0; i < n; i++){ if (k !== 'organ' && (i & 15) === 0){ const fc = k === 'dub' ? P.cut * (1 + .9 * fe) : P.cut * (1 + P.famt * fe) * (.5 + br); svfSet(fl, fc, P.res || .8, sr); svfSet(fr, fc * 1.03, P.res || .8, sr); } fe *= fk;
      let env; if (i < atk) env = i / atk; else { d *= dk; env = sus + (1 - sus) * d; } if (i > gN) rl *= rk; env *= rl;
      if (k === 'organ'){ l[i] *= env; r[i] *= env; } else if (k === 'dub'){ svfTick(fl, l[i]); svfTick(fr, r[i]); l[i] = fl.bp * env * 1.8; r[i] = fr.bp * env * 1.8; } else { l[i] = svfTick(fl, l[i]) * env; r[i] = svfTick(fr, r[i]) * env; } }
    const ft = Math.min(n, (.01 * sr) | 0); for (let i = 0; i < ft; i++){ l[n - 1 - i] *= i / ft; r[n - 1 - i] *= i / ft; } return {l, r}; };

  // formant "vocal chop": a saw voice through three vowel formants, with vibrato and a falling tail
  const VOW = {a: [800, 1150, 2900], e: [400, 1700, 2600], i: [300, 2200, 3000], o: [450, 800, 2830], u: [325, 700, 2530]};
  I.vox = (sr, e) => { const P = e.p, f0 = e.f, n = Math.ceil((e.dur + .14) * sr), m = new Float32Array(n), F = VOW[e.vowel] || VOW.a, b = [svf(), svf(), svf()], g = [1, .55, .3];
    F.forEach((fq, j) => svfSet(b[j], fq * P.shift, 8, sr)); let ph = 0, rl = 1; const gN = e.dur * sr, atk = .008 * sr, rk = Math.exp(-1 / (.045 * sr)), fallK = Math.exp(-1 / (.09 * sr)); let fall = 1;
    for (let i = 0; i < n; i++){ const vib = 1 + .007 * sin1(i * 5.5 / sr) * Math.min(1, i / (.12 * sr)); if (i > gN){ fall = .88 + (fall - .88) * fallK; rl *= rk; }
      const dt = f0 * vib * fall / sr; ph += dt; if (ph >= 1) ph -= 1; const src = 2 * ph - 1 - blep(ph, dt); let x = 0; for (let j = 0; j < 3; j++){ svfTick(b[j], src); x += b[j].bp * g[j]; }
      m[i] = x * .55 * Math.min(1, i / atk) * rl; }
    fadeTail(m, sr, .01); return {m}; };
  I.shaker = (sr, e) => { const d = e.dec || .05, n = Math.ceil((d * 6 + .02) * sr), m = new Float32Array(n), nz = rngOf(e.seed), s = svf(); svfSet(s, 7600, 1.1, sr); const atk = .006 * sr;
    for (let i = 0; i < n; i++){ svfTick(s, nz() * 2 - 1); m[i] = s.bp * Math.min(1, i / atk) * Math.exp(-Math.max(0, i - atk) / (d * sr)); } fadeTail(m, sr, .005); return {m}; };
  // techno rumble: the kick's low tail smeared through a resonant low-pass
  I.rumble = (sr, e) => { const D = e.dur || .45, n = Math.ceil(D * 1.6 * sr), m = new Float32Array(n), nz = rngOf(e.seed), s = svf(), s2 = svf(); svfSet(s, 92, 1.6, sr); svfSet(s2, 92, .7, sr); const atk = .03 * sr, dk = D * sr * .45;
    for (let i = 0; i < n; i++){ svfTick(s, nz() * 2 - 1); svfTick(s2, s.lp); m[i] = Math.tanh(s2.lp * 7) * Math.min(1, i / atk) * Math.exp(-i / dk); } fadeTail(m, sr, .02); return {m}; };

  // =========================================================== effects (streaming, chunked)
  function FDN(sr, size, rt60, damp){ const base = [29.7, 37.1, 41.1, 43.7, 53.1, 61.3, 67.9, 73.1], len = base.map(ms => Math.max(8, Math.round(ms * size * sr / 1000)));
    const lines = len.map(L => new Float32Array(L)), pos = new Int32Array(8), g = len.map(L => Math.pow(10, -3 * L / (rt60 * sr))), lp = new Float32Array(8), o = new Float32Array(8), dc = clamp(damp, 0, .95);
    const ap = [4.7, 3.6, 12.7, 9.3].map(ms => ({b: new Float32Array(Math.max(2, Math.round(ms * sr / 1000))), i: 0})), pre = new Float32Array(Math.max(2, Math.round(.022 * sr))); let pi = 0;
    return (inp, oL, oR, n) => { for (let s = 0; s < n; s++){ let x = pre[pi]; pre[pi] = inp[s]; if (++pi >= pre.length) pi = 0;
        for (let a = 0; a < 4; a++){ const A = ap[a], d = A.b[A.i], y = d - .7 * x; A.b[A.i] = x + .7 * y; if (++A.i >= A.b.length) A.i = 0; x = y; }
        let yl = 0, yr = 0; for (let k = 0; k < 8; k++){ const v = lines[k][pos[k]]; if (k & 1) yr += v; else yl += v; lp[k] = v + (lp[k] - v) * dc; o[k] = lp[k] * g[k]; }
        for (let h = 1; h < 8; h <<= 1) for (let i = 0; i < 8; i += h << 1) for (let j = i; j < i + h; j++){ const a = o[j], b = o[j + h]; o[j] = a + b; o[j + h] = a - b; }
        for (let k = 0; k < 8; k++){ lines[k][pos[k]] = o[k] * .35355339 + x * (k & 1 ? -.5 : .5); if (++pos[k] >= len[k]) pos[k] = 0; }
        oL[s] += yl * .3; oR[s] += yr * .3; } }; }
  function PingPong(sr, time, fb, tone){ const N = Math.max(2, Math.round(time * sr)), bl = new Float32Array(N), br = new Float32Array(N), a = Math.exp(-TAU * tone / sr); let i = 0, ll = 0, lr = 0, hl = 0;
    return (inp, oL, oR, n) => { for (let s = 0; s < n; s++){ const dl = bl[i], dr = br[i]; ll = dl + (ll - dl) * a; lr = dr + (lr - dr) * a; hl += (inp[s] - hl) * .02; bl[i] = (inp[s] - hl) + lr * fb; br[i] = ll * fb; if (++i >= N) i = 0; oL[s] += dl; oR[s] += dr; } }; }

  // =========================================================== composition — the evolving engine
  const DEF = {seed: 7, vary: 0, style: '', fx: null, bpm: 120, tonic: 9, mode: 'minor', bars: 112, rhythm: 'auto', form: 'auto', melody: 'auto', color: .3, motion: .3, develop: .5, chaos: .35, poly: .6,
    density: .62, bright: .5, metal: .25, swing: .52, humanize: .35, pump: .35, drive: .2, verb: .55, delay: .4, width: .9, arpRate: 16,
    layers: {kick: 1, snare: 1, hat: 1, perc: 1, bass: 1, arp: 1, pad: 1, keys: 1, lead: 1, tex: 1}, palette: {}};

  // progression grammar, in scale-degree indices (0 = tonic). Each loop is a phrase people have loved for decades; the mode decides the chord qualities.
  const PROG = {
    minor: {4: [[0, 5, 2, 6], [0, 5, 3, 6], [0, 6, 5, 6], [0, 2, 6, 5], [5, 6, 0, 0], [0, 3, 5, 4], [0, 5, 0, 6], [3, 0, 5, 6], [0, 0, 5, 6], [0, 2, 3, 6], [5, 2, 6, 0], [0, 6, 3, 5]],
      2: [[0, 5], [0, 6], [0, 3], [0, 2], [5, 0], [0, 4]], 8: [[0, 5, 2, 6, 0, 5, 3, 4], [0, 6, 5, 6, 0, 6, 3, 4], [0, 5, 2, 6, 3, 5, 0, 6]]},
    dorian: {4: [[0, 3, 0, 3], [0, 3, 6, 5], [0, 1, 0, 3], [0, 5, 3, 0], [0, 3, 4, 0], [0, 6, 3, 0], [0, 2, 3, 0]], 2: [[0, 3], [0, 1], [0, 6], [0, 5]], 8: [[0, 3, 0, 3, 0, 1, 6, 5]]},
    major: {4: [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 5, 4], [0, 3, 0, 4], [1, 4, 0, 0], [0, 5, 1, 4], [3, 0, 4, 5], [0, 2, 3, 5]], 2: [[0, 3], [0, 5], [0, 4], [5, 3]], 8: [[0, 4, 5, 3, 0, 4, 1, 3]]},
    lydian: {4: [[0, 1, 0, 1], [0, 1, 5, 4], [0, 4, 1, 0], [0, 1, 2, 1]], 2: [[0, 1], [0, 4]], 8: [[0, 1, 0, 1, 5, 4, 0, 1]]},
    mixolydian: {4: [[0, 6, 3, 0], [0, 6, 0, 6], [0, 3, 6, 0], [0, 4, 6, 3]], 2: [[0, 6], [0, 3]], 8: [[0, 6, 3, 0, 0, 6, 4, 3]]}};
  // vamp family measured off the reference tracks: two chords that trade places for bars at a time (i↔VI, i↔iv, i↔III, I↔vi…)
  PROG.vampMinor = {2: [[0, 5], [0, 5], [0, 3], [0, 2], [0, 6], [5, 0]], 3: [[0, 5, 3], [0, 3, 6], [0, 5, 6], [0, 2, 5]], 4: [[0, 5, 2, 6], [0, 3, 5, 6], [0, 5, 0, 3]]};
  PROG.vampMajor = {2: [[5, 0], [5, 0], [0, 3], [0, 5], [0, 4]], 3: [[5, 0, 3], [5, 3, 0], [0, 3, 5]], 4: [[5, 3, 0, 4], [0, 4, 5, 3]]};
  PROG.phrygian = {4: [[0, 1, 0, 1], [0, 1, 6, 1], [0, 6, 1, 0], [0, 2, 1, 0]], 2: [[0, 1], [0, 6]], 8: [[0, 1, 0, 1, 0, 6, 1, 0]]};
  PROG.harmonicMinor = PROG.minor; PROG.pentMinor = {4: [[0, 2, 0, 3], [0, 3, 2, 0], [0, 4, 3, 0]], 2: [[0, 3], [0, 2]], 8: [[0, 2, 0, 3, 0, 4, 3, 0]]};
  const STACK = {tri: [0, 2, 4], sev: [0, 2, 4, 6], sus2: [0, 1, 4], sus4: [0, 3, 4], add9: [0, 2, 4, 8], nine: [0, 2, 4, 6, 8], quart: [0, 3, 6], six: [0, 2, 4, 5], m11: [0, 2, 6, 8, 10], open: [0, 4, 7], sus2o: [0, 1, 4, 7]};

  function plan(p){
    if (GS[p.style]) return planGenre(p, GS[p.style]);
    const R = rngOf(hashSeed(p.seed, 11)), V = rngOf(hashSeed(p.seed, 977, p.vary)), H = rngOf(hashSeed(p.seed, 313)), A = rngOf(hashSeed(p.seed, 541, p.vary));   // R: identity · H: harmony · V: parts · A: arrangement
    const beat = 60 / p.bpm, ST = beat / 4, BT = beat * 4;
    const scale = MODES[p.mode] || MODES.minor, nS = scale.length, tonic = ((p.tonic | 0) % 12 + 12) % 12, minorish = scale.indexOf(3) >= 0;
    const dpc = d => (tonic + scale[((d % nS) + nS) % nS]) % 12;
    const dmidi = (d, base) => base + 12 * Math.floor(d / nS) + tonic + scale[((d % nS) + nS) % nS];
    const rhythm = p.rhythm && p.rhythm !== 'auto' ? p.rhythm : pickW(R, {four: 36, drive: 10, broken: 26, half: 12, ca: 10, none: 6});
    const form = ['arc', 'rise', 'twin', 'ambient', 'cooper', 'steps'].indexOf(p.form) >= 0 ? p.form : pickW(R, {cooper: 30, steps: 20, arc: 20, rise: 15, twin: 15, ambient: rhythm === 'none' ? 80 : 2});
    const mt = p.metal, ring = Math.max(0, mt - .6) * 5, bright = p.bright;
    // ---------- palette (auto picks lean to what carries an emotional electronic piece: pianos, plucks, lush pads)
    const SW = (STYLES[p.style] || STYLES.cooper).pal || {}, BANNED = {arp: ['pluck', 'mallet', 'bell', 'glass', 'keys', 'epiano'], lead: ['pluck', 'glass', 'keys', 'mallet']}, W = (k, d) => { const o = Object.assign({}, d, SW[k] || {}); (BANNED[k] || []).forEach(x => delete o[x]); return o; };
    const pal = {bass: pickW(R, W('bass', {sub: 3, fm: 2, subsaw: 3})), arp: pickW(R, W('arp', {synth: 5, blip: 2, saw: 2})),
      pad: pickW(R, W('pad', {lush: 4, fmpad: 2, additive: 1.5, supersaw: 1.5})), lead: pickW(R, W('lead', {synth: 3, sawlead: 2, fmlead: 1.5})),
      perc: pickW(R, W('perc', {membrane: 3, wood: 1})), tex: pickW(R, W('tex', {grains: 2 + mt, wind: 2, chaos: 1.5, crackle: .3})), keys: pickW(R, W('keys', {glass: 2, felt: 2, epiano: .5}))};
    for (const k in pal) if (p.palette[k] && p.palette[k] !== 'auto') pal[k] = p.palette[k];
    const malletBody = r => pickW(r, {bar: 3, wood: 2, glass: ring, metal: ring * .6});
    const keysOf = kind => ({inst: 'keys', kind, rel: kind === 'glass' ? .6 : .4});
    // ---------- patches, randomised once per seed
    const PT = {
      kick: {f0: rr(R, 95, 150), f1: rr(R, 42, 52), pitchT: rr(R, .018, .04), decay: rr(R, .22, .4) * (rhythm === 'drive' ? .85 : 1), click: rr(R, .12, .4), drive: rr(R, 1.1, 1.5) + p.drive * .4},
      snare: {f0: rr(R, 165, 225), tone: rr(R, .05, .12), noise: rr(R, .1, .2), nf: rr(R, 1400, 2800), body: rr(R, .4, 1), snap: rr(R, .55, .95), clap: R() < .45},
      hat: {base: rr(R, 300, 420), closed: rr(R, .02, .045), open: rr(R, .14, .3), hp: rr(R, 6500, 8800), ring: rr(R, 8500, 11500), noisy: rr(R, .45, .9)},
      bass: pal.bass === 'fm' ? {inst: 'fm', ratio: pick(R, [1, .5, 2, 1]), index: rr(R, 1.2, 2.4) * (.6 + mt * .6), indexSus: rr(R, .15, .5), idecay: rr(R, .05, .18), atk: .004, dec: rr(R, .15, .4), sus: rr(R, .5, .85), rel: .07, fb: rr(R, 0, .3)}
        : pal.bass === 'subsaw' ? {inst: 'saw', cut: rr(R, 1.3, 2.4), famt: rr(R, 2, 8) * (.5 + bright), fdec: rr(R, .06, .25), res: rr(R, .8, 1.8), atk: .004, dec: .35, sus: .75, rel: .07, sub: .6, det: .002}
        : pal.bass === 'string' ? {inst: 'string', t60: rr(R, .9, 2.2), bright: rr(R, .18, .4), rel: .1}
        : {inst: 'mono', kind: 'sub', atk: .008, dec: .6, sus: .85, rel: .09, glide: .04, gain: 1.05},
      arp: pal.arp === 'synth' ? {inst: 'synpluck', det: rr(R, .002, .006), cut: rr(R, 1.1, 1.8), famt: rr(R, 4, 9), fdec: rr(R, .05, .14), dec: rr(R, .14, .32), sub: rr(R, 0, .25)}
        : pal.arp === 'blip' ? {inst: 'blip', index: rr(R, .6, 1.6), dec: rr(R, .08, .2)}
        : pal.arp === 'bell' ? {inst: 'fm', ratio: pick(R, [3.5, 1.4142, 2.756, 4, 1.618, 3]), index: rr(R, 1.5, 3.2) * (.5 + mt), indexSus: rr(R, 0, .3), idecay: rr(R, .06, .3), atk: .002, dec: rr(R, .25, .8), sus: 0, rel: rr(R, .25, .7)}
        : pal.arp === 'epiano' ? {inst: 'fm', ratio: 1, ratio2: 14, index: rr(R, .9, 1.8) * (.6 + mt * .6), index2: rr(R, .3, .9), indexSus: .2, idecay: rr(R, .15, .4), atk: .002, dec: rr(R, .5, 1.2), sus: .1, rel: .3}
        : pal.arp === 'pluck' ? {inst: 'string', t60: rr(R, .6, 2.2), bright: rr(R, .35, .9), rel: .08}
        : pal.arp === 'saw' ? {inst: 'saw', cut: rr(R, 1.2, 2.2), famt: rr(R, 3, 8) * (.4 + bright), fdec: rr(R, .04, .16), res: rr(R, .6, 1.1), atk: .002, dec: rr(R, .1, .4), sus: rr(R, 0, .3), rel: rr(R, .05, .25), sq: R() < .4, det: rr(R, .002, .008)}
        : pal.arp === 'keys' ? keysOf(pal.keys) : pal.arp === 'glass' ? keysOf('glass') : {inst: 'mallet', body: malletBody(R), decay: rr(R, .45, 1.1)},
      pad: pal.pad === 'lush' ? {kind: 'lush', det: rr(R, 9, 22), cut: rr(R, 700, 2200) * (.5 + bright), res: rr(R, .5, .8), atk: rr(R, .8, 2.4), rel: rr(R, 1.5, 3.5)}
        : pal.pad === 'supersaw' ? {kind: 'supersaw', det: rr(R, 7, 18), cut: rr(R, 700, 1800) * (.5 + bright), res: rr(R, .6, 1), atk: rr(R, .4, 1.6), rel: rr(R, 1, 2.8)}
        : pal.pad === 'fmpad' ? {kind: 'fmpad', ratio: pick(R, [1, 2, .5, 3]), index: rr(R, .4, 1.4) * (.5 + mt), lfo: rr(R, .04, .2), det: rr(R, 3, 9), atk: rr(R, .6, 2), rel: rr(R, 1.2, 3)}
        : {kind: 'additive', tilt: rr(R, 1, 1.7) - bright * .4, stretch: rr(R, 0, .001), shimmer: rr(R, .05, .35), atk: rr(R, .7, 2), rel: rr(R, 1.2, 3)},
      lead: pal.lead === 'synth' ? {inst: 'synpluck', det: rr(R, .003, .007), cut: rr(R, 1.4, 2.2), famt: rr(R, 3, 6), fdec: rr(R, .12, .3), dec: rr(R, .35, .7), sub: rr(R, .1, .3)}
        : pal.lead === 'fmlead' ? {inst: 'fm', ratio: pick(R, [1, 2]), index: rr(R, .8, 1.6) * (.5 + mt * .5), indexSus: rr(R, .4, 1.1), idecay: rr(R, .15, .5), atk: .012, dec: .45, sus: .7, rel: .25, vib: .004, fb: rr(R, 0, .4)}
        : pal.lead === 'sawlead' ? {inst: 'saw', cut: 2, famt: rr(R, 3, 7) * (.4 + bright), fdec: .3, res: rr(R, .8, 1.8), atk: .01, dec: .5, sus: .7, rel: .2, vib: .0045, det: .006}
        : pal.lead === 'pluck' ? {inst: 'string', t60: rr(R, 1.4, 3.2), bright: rr(R, .5, 1), rel: .15}
        : pal.lead === 'glass' ? keysOf('glass') : pal.lead === 'keys' ? keysOf(pal.keys) : {inst: 'mallet', body: malletBody(R), decay: rr(R, .8, 1.3)},
      keys: keysOf(pal.keys), perc: {body: pal.perc, decay: rr(R, .3, .55), reg: pal.perc === 'glass' || pal.perc === 'metal' ? 60 : pal.perc === 'wood' ? 50 : 43},
      tex: pal.tex === 'grains' ? {kind: 'grains', density: rr(R, 5, 14), fm: rr(R, .1, .8) * (.3 + mt)} : pal.tex === 'wind' ? {kind: 'wind', q: rr(R, 3, 9)} : pal.tex === 'crackle' ? {kind: 'crackle', rate: 1} : pal.tex === 'glitch' ? {kind: 'glitch', density: rr(R, 4, 11), beat: 60 / p.bpm} : {kind: 'chaos'}};

    // ---------- form: sections with an energy curve
    const FORMS = {arc: [['intro', .12, .3], ['build', .12, .55], ['peak', .24, 1], ['break', .13, .35], ['build', .07, .65], ['peak', .19, 1], ['outro', .13, .3]],
      rise: [['intro', .1, .25], ['rise', .22, .4], ['rise', .22, .65], ['peak', .32, 1], ['outro', .14, .32]],
      twin: [['intro', .1, .3], ['groove', .18, .7], ['peak', .2, 1], ['break', .14, .35], ['groove', .1, .75], ['peak', .16, 1], ['outro', .12, .3]],
      ambient: [['intro', .2, .2], ['swell', .3, .38], ['bloom', .3, .6], ['outro', .2, .22]],
      cooper: [['intro', .09, .22], ['low', .07, .32], ['groove', .16, .55], ['groove', .16, .75], ['peak', .2, 1], ['low', .06, .35], ['peak', .18, 1], ['outro', .08, .28]],
      steps: [['intro', .08, .2], ['groove', .12, .45], ['groove', .14, .62], ['groove', .14, .78], ['peak', .3, 1], ['low', .05, .3], ['peak', .1, 1], ['outro', .07, .25]]};
    const B = Math.max(16, Math.round(p.bars / 4) * 4), F = FORMS[form];
    const secs = []; let acc = 0;
    F.forEach(([name, f, e], i) => { const bars = Math.max(4, Math.round(f * B / 4) * 4); secs.push({name, bar0: acc, bars, e, eTo: e, chaosMul: 1, idx: i}); acc += bars; });
    secs.forEach((s, i) => { if (s.name === 'build' || s.name === 'rise' || s.name === 'swell') s.eTo = secs[i + 1] ? Math.max(s.e, secs[i + 1].e * .85) : s.e;
      s.chaosMul = form === 'rise' ? [1, .85, .55, .22, .1][i] || .1 : s.name === 'break' ? 1.25 : s.name === 'peak' ? .8 : 1; });
    const NB = acc, NSTEP = NB * 16;
    const secOf = bar => { for (let i = secs.length - 1; i >= 0; i--) if (bar >= secs[i].bar0) return secs[i]; return secs[0]; };
    const energy = bar => { const s = secOf(bar), k = (bar - s.bar0) / s.bars; return lerp(s.e, s.eTo, k); };
    const isPeak = S => S.name === 'peak' || S.name === 'bloom', isBuild = S => S.name === 'build' || S.name === 'rise' || S.name === 'swell', isCalm = S => S.name === 'intro' || S.name === 'break' || S.name === 'outro' || S.name === 'low';
    const peaks = secs.filter(isPeak), firstPeak = peaks.length ? peaks[0] : secs[Math.floor(secs.length / 2)];

    // ---------- chaos and continuous modulation
    const LOG = new Float32Array(NSTEP); { let x = .31 + R() * .3; for (let i = 0; i < NSTEP; i++){ const s = secOf(i >> 4), r = clamp(3.5 + .49 * p.chaos * s.chaosMul, 3.3, 3.999); x = r * x * (1 - x); if (x <= 0 || x >= 1) x = .5 + R() * .1; LOG[i] = x; } }
    const LZ = new Float32Array(NSTEP), LZ2 = new Float32Array(NSTEP); { let x = 1 + R(), y = 1, z = 1 + R() * 2; const dt = .006;
      for (let i = 0; i < NSTEP; i++){ for (let s = 0; s < 3; s++){ const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; } LZ[i] = clamp(x / 20, -1, 1); LZ2[i] = clamp((z - 25) / 22, -1, 1); } }

    // ---------- harmony: a loop from the grammar, one colour palette for the whole piece, voice-led
    const isDim = d => nS === 7 && ((dpc(d + 4) - dpc(d) + 12) % 12) === 6;
    const chordType = (root, r) => { const c = p.color, maj = ((dpc(root + 2) - dpc(root) + 12) % 12) === 4;
      if (c < .2) return pickW(r, {open: 4, tri: 3, sus2: 2, sus2o: 1});
      if (c < .4) return pickW(r, {tri: 5, sus2: 3, open: 2, add9: 1, sus4: .5});
      if (c < .6) return pickW(r, maj ? {add9: 3, tri: 3, sus2: 2, sev: 1} : {tri: 3, add9: 2, sus2: 2, sev: 2});
      if (c < .85) return pickW(r, maj ? {add9: 3, nine: 2, sev: 2, sus2: 1.5, six: 1} : {sev: 3, nine: 3, add9: 2, sus2: 1, m11: .5});
      return pickW(r, maj ? {nine: 3, add9: 2, quart: 1.5, sus2: 1.5, six: 1} : {nine: 3, m11: 1.5, quart: 2, add9: 1.5, sev: 1}); };
    const chordName = (root, type) => { const pcs = STACK[type].map(x => dpc(root + x)), rp = pcs[0], iv = pcs.map(q => (q - rp + 12) % 12), has = x => iv.indexOf(x) >= 0;
      if (type === 'quart') return NOTE[rp] + '⁴'; if (type === 'open') return NOTE[rp] + '5'; if (type === 'sus2' || type === 'sus2o') return NOTE[rp] + 'sus2'; if (type === 'sus4') return NOTE[rp] + 'sus4';
      const m = has(3) && !has(4), dim = m && has(6) && !has(7); let q = dim ? (has(10) ? 'm7♭5' : 'dim') : m ? 'm' : '';
      if (!dim){ if (has(11)) q += 'maj7'; else if (has(10)) q += '7'; } if (type === 'add9') q += 'add9'; if (type === 'six') q += '6'; if (type === 'm11') q += '11'; if (type === 'nine') q = q.replace('7', '9'); return NOTE[rp] + q; };
    let lastVoice = null;
    const voice = pcs => { const lo = 52, hi = 79, opts = pcs.map(pc => { const o = []; for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m); return o; }); let best = null, bc = 1e9; const cur = [];
      const rec = i => { if (i === opts.length){ const s = cur.slice().sort((a, b) => a - b); for (let k = 1; k < s.length; k++){ const iv = s[k] - s[k - 1]; if (iv < 2) return; if (s[k] < 60 && iv < 3) return; if (s[k] < 57 && iv < 5) return; } if (s[s.length - 1] - s[0] > 22) return;
          for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++){ const iv = s[b] - s[a]; if (iv % 12 === 1 && iv !== 11 && iv < 23) return; if (iv % 12 === 11 && iv !== 11 && iv < 23) return; }   // a 9th sits a major 7th above the 3rd, never a semitone or a minor 9th
          let c = 0; if (lastVoice) for (const m of s){ let d = 99; for (const q of lastVoice) d = Math.min(d, Math.abs(m - q)); c += d; } else c = Math.abs((s[0] + s[s.length - 1]) / 2 - 64) * .6;
          for (let k = 1; k < s.length; k++) if (s[k] - s[k - 1] === 2 && s[k] < 64) c += 1.5;   // close seconds low down turn to mud
          c += H() * .7; if (c < bc){ bc = c; best = s; } return; } for (const m of opts[i]){ cur.push(m); rec(i + 1); cur.pop(); } };
      rec(0); if (!best) best = pcs.map(pc => 57 + ((pc - 57) % 12 + 12) % 12).sort((a, b) => a - b); lastVoice = best; return best; };
    const STY = STYLES[p.style] || STYLES.cooper, vampy = STY.vamp === undefined ? true : STY.vamp;
    const lib = vampy && nS === 7 ? (minorish ? PROG.vampMinor : PROG.vampMajor) : (PROG[p.mode] || PROG.minor), loopLen = vampy ? (p.motion < .3 ? 2 : p.motion < .7 ? pickW(H, {2: 3, 3: 2, 4: 1}) : pickW(H, {3: 2, 4: 3})) : (p.motion < .25 ? pickW(H, {2: 3, 4: 2}) : p.motion < .75 ? pickW(H, {4: 5, 2: 1, 8: 1}) : pickW(H, {4: 3, 8: 2}));
    const degs = pick(H, lib[loopLen] || lib[4] || lib[2]).map(d => isDim(d) ? (d + (H() < .5 ? 1 : -1) + nS) % nS : d);
    // uneven bar lengths per chord (the home chord lingers): the reference tracks sit on one chord ~60 % of the time
    const lenPat = vampy ? pick(H, loopLen === 2 ? [[3, 1], [2, 2], [4, 2], [6, 2], [2, 1], [3, 1]] : loopLen === 3 ? [[2, 1, 1], [4, 2, 2], [2, 2, 2]] : [[2, 1, 1, 2], [1, 1, 1, 1], [2, 2, 2, 2]]) : null;
    const mkChord = (root, type) => { const pcs = STACK[type].map(x => dpc(root + x)); return {root, type, pcs, name: chordName(root, type), bass: 33 + ((dpc(root) - 33) % 12 + 12) % 12}; };
    const loopA = degs.map(d => mkChord(d, chordType(d, H)));
    // the break's loop: the same chords with one substitution (relative, or the sixth degree), so the breakdown feels like a new room in the same house
    const loopB = loopA.map((c, i) => { if (i !== 1 && i !== loopA.length - 1) return c; if (H() > .55 + p.develop * .3) return c; const alt = (c.root + (minorish ? 5 : 5)) % nS; return isDim(alt) ? c : mkChord(alt, chordType(alt, H)); });
    const hrBase = p.motion < .3 ? 4 : p.motion < .65 ? 2 : 1;
    const chords = [], chordBar = [];
    let ti = 0; secs.forEach(S => { const calm = isCalm(S) || S.name === 'swell', hr = Math.min(S.bars, calm ? Math.min(8, hrBase * 2) : hrBase), lp = S.name === 'break' || S.name === 'low' ? loopB : loopA, slow = p.motion < .25 ? 2 : 1;
      let b = S.bar0; while (b < S.bar0 + S.bars){ const want = lenPat ? lenPat[ti % lenPat.length] * slow : hr, bars = Math.min(want, S.bar0 + S.bars - b), c = lp[ti % lp.length]; chords.push(Object.assign({bar: b, bars}, c)); b += bars; ti++; } });
    chords.forEach(c => { c.voicing = voice(c.pcs); for (let b = c.bar; b < c.bar + c.bars; b++) chordBar[b] = c; });
    const chordAtBar = bar => chordBar[clamp(bar, 0, NB - 1)];
    const chordAtT = t => chordAtBar(Math.floor(t / BT)).voicing;
    // the ladder: a chord's tones laid out across two octaves — melodies live on rungs, so the same shape re-harmonises itself under every chord
    const ladderOf = (c, lo, hi) => { const o = []; for (let m = lo; m <= hi; m++) if (c.pcs.indexOf(m % 12) >= 0) o.push(m); return o; };
    const scaleBetween = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), o = []; for (let m = lo + 1; m < hi; m++) if (scale.indexOf(((m - tonic) % 12 + 12) % 12) >= 0) o.push(m); return o.length ? o[o.length >> 1] : null; };

    // ---------- rhythm generators
    function CA(rule, r){ let row = Array.from({length: 16}, () => r() < .3 ? 1 : 0); return () => { const nx = row.map((_, i) => (rule >> (row[(i + 15) % 16] * 4 + row[i] * 2 + row[(i + 1) % 16])) & 1), c = nx.reduce((a, b) => a + b, 0);
      row = c === 0 || c >= 15 ? Array.from({length: 16}, () => r() < .3 ? 1 : 0) : nx; return row; }; }
    const caHat = CA(pick(V, [150, 90, 105]), V), caPerc = CA(pick(V, [30, 45, 86, 135]), V), caKick = CA(pick(V, [18, 22, 26, 146]), V), caFill = CA(30, V);
    const RV = p.vary ? V : R, kickEu = euclid(3 + Math.floor(RV() * 3), 16, 0), backbeat = RV() < .6, snEu = euclid(2 + Math.floor(RV() * 2), 16, 4);
    const bassStyle = rhythm === 'drive' ? pick(RV, ['pulse', 'pulse', 'offbeat', 'syncop']) : rhythm === 'four' ? pick(RV, ['offbeat', 'sustain', 'offbeat', 'roll', 'sustain']) : rhythm === 'half' || rhythm === 'none' ? 'sustain' : pick(RV, ['syncop', 'sustain', 'syncop', 'pulse']);
    const bassEu = euclid(5, 16, Math.floor(V() * 4) * 2);
    const polyLens = p.poly < .25 ? [8, 16] : p.poly < .55 ? [6, 12, 10] : p.poly < .8 ? [5, 7, 9, 11] : [7, 9, 11, 13, 5];
    const pA = {len: pick(V, polyLens)}, pB = {len: pick(V, polyLens)}; pA.pat = euclid(2 + Math.floor(V() * 3), pA.len, Math.floor(V() * pA.len)); pB.pat = euclid(2 + Math.floor(V() * 2), pB.len, Math.floor(V() * pB.len));
    pA.tone = Array.from({length: pA.len}, () => pick(V, [0, 0, 0, 2])); pB.tone = Array.from({length: pB.len}, () => 0);   // chord-tone index, never a random scale degree
    const hatAcc = euclid(pick(V, [5, 7, 3]), 16, Math.floor(V() * 16)), hatVoss = voss(V, 64, 5);

    // ---------- motif: rhythm from Euclid / a Fibonacci word / a cellular automaton; pitch from a 1/f walk, an L-system or a Lorenz slice; everything on chord-tone rungs
    const melodyK = p.melody && p.melody !== 'auto' ? p.melody : pickW(R, {voss: 3, lsys: 2, euclid: 2, fib: 2, lorenz: 1});
    function makeMotif(r){ const len = 32; let pos;
      const rk = melodyK === 'fib' || melodyK === 'lsys' ? 'fib' : melodyK === 'lorenz' ? 'ca' : 'euclid';
      if (rk === 'fib'){ const w = fibWord(len); pos = []; let i = 0; while (i < len){ pos.push(i); i += w[i] === 'A' ? pick(r, [2, 3, 4]) : pick(r, [1, 2]); } pos = pos.filter(s => s < len); }
      else if (rk === 'ca'){ let row = Array.from({length: len}, (_, i) => i % 4 === 0 ? 1 : 0); for (let g = 0; g < 3; g++) row = row.map((_, i) => (90 >> (row[(i + len - 1) % len] * 4 + row[i] * 2 + row[(i + 1) % len])) & 1); pos = row.map((v, i) => v ? i : -1).filter(i => i >= 0 && i % 2 === 0); if (pos.length < 4) pos = euclid(7, len, 0).map((v, i) => v ? i : -1).filter(i => i >= 0); }
      else { const k = 5 + Math.floor(r() * 5); pos = euclid(k, len, Math.floor(r() * 4) * 2).map((v, i) => v ? i : -1).filter(i => i >= 0); }
      if (pos[0] !== 0) pos.unshift(0); if (pos.length > 11) pos = pos.filter((_, i) => i % 2 === 0 || i === 0);
      // pitches: rungs 0..6 on the ladder (two octaves of chord tones)
      let rungs; const n = pos.length;
      if (melodyK === 'voss'){ const vs = voss(r, n, 4); rungs = vs.map(v => Math.round(1 + v * 4.5)); }
      else if (melodyK === 'lsys'){ let s = 'A'; const rules = {A: pick(r, ['AB', 'A-B', 'AB+']), B: pick(r, ['A', 'B-A', '+A']), '+': '+', '-': '-'}; for (let g = 0; g < 5 && s.length < n * 3; g++) s = s.split('').map(c => rules[c] || c).join('');
        let cur = 2, dir = 1; rungs = []; for (const c of s){ if (rungs.length >= n) break; if (c === '+') dir = 1; else if (c === '-') dir = -1; else { rungs.push(cur); cur = clamp(cur + (c === 'A' ? dir : -dir * 2), 0, 6); } } while (rungs.length < n) rungs.push(2); }
      else if (melodyK === 'lorenz'){ rungs = pos.map(s => Math.round(3 + 3 * LZ[(s * 3) % NSTEP])); }
      else { let cur = 1 + Math.floor(r() * 3); rungs = pos.map((_, i) => { if (i) cur = clamp(cur + +pickW(r, {'-2': 1, '-1': 3, '0': 1.5, '1': 3, '2': 1, '3': .4}), 0, 6); return cur; }); }
      const contour = pick(r, ['arch', 'rise', 'fall', 'none']); rungs = rungs.map((g, i) => { const k = i / Math.max(1, n - 1), bias = contour === 'arch' ? Math.round(Math.sin(k * Math.PI) * 1.5) : contour === 'rise' ? Math.round(k * 2) : contour === 'fall' ? Math.round((1 - k) * 2) : 0; return clamp(g + bias, 0, 6); });
      const vel = voss(r, n, 4);
      const notes = pos.map((s, i) => ({s, rung: rungs[i], v: .6 + .4 * vel[i], pass: i > 0 && (s & 1) === 1 && Math.abs(rungs[i] - rungs[i - 1]) === 1 && r() < .5}));
      return relen({len, notes}); }
    function relen(m){ m.notes.sort((a, b) => a.s - b.s); m.notes.forEach((n, i) => n.len = Math.max(1, (i + 1 < m.notes.length ? m.notes[i + 1].s : m.len) - n.s)); return m; }
    const copyM = m => ({len: m.len, notes: m.notes.map(n => Object.assign({}, n))});
    // variants: A' changes the tail, B inverts or lifts, R runs backwards — development means choosing among them, not scrambling the theme
    function variant(m, kind, r){ const c = copyM(m), N = c.notes;
      if (kind === 'tail'){ for (let i = Math.max(1, N.length - 2 - Math.floor(r() * 2)); i < N.length; i++) N[i].rung = clamp(N[i].rung + pick(r, [-1, 1, 2]), 0, 6); }
      else if (kind === 'invert'){ const r0 = N[0].rung; N.forEach(n => n.rung = clamp(r0 - (n.rung - r0), 0, 6)); }
      else if (kind === 'lift'){ N.forEach(n => n.rung = clamp(n.rung + 1, 0, 6)); }
      else if (kind === 'retro'){ const rs = N.map(n => n.rung).reverse(); N.forEach((n, i) => n.rung = rs[i]); }
      else if (kind === 'thin'){ c.notes = N.filter((n, i) => i === 0 || (n.s & 3) === 0 || r() < .35); relen(c); }
      else if (kind === 'aug'){ c.notes = N.filter(n => n.s < c.len / 2).map(n => Object.assign({}, n, {s: n.s * 2})); relen(c); }
      return c; }
    const motifR = p.vary ? V : R, motif = makeMotif(motifR), dv = p.develop;
    const MV = {A: motif, A2: variant(motif, 'tail', motifR), B: variant(motif, pickW(motifR, {invert: 2, lift: 2, retro: dv}), motifR), T: variant(motif, 'thin', motifR), G: variant(variant(motif, 'aug', motifR), 'thin', motifR)};
    const schemes = [['A', 'A2', 'A', 'B'], ['A', 'B', 'A', 'A2'], ['A', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'B']];
    // mutation that sticks: from the second peak on, the theme itself has moved (develop decides how far)
    const motif2 = dv > .35 ? variant(variant(motif, 'tail', motifR), dv > .7 ? 'lift' : 'tail', motifR) : motif;
    const MV2 = {A: motif2, A2: variant(motif2, 'tail', motifR), B: variant(motif2, pickW(motifR, {invert: 2, lift: 1, retro: dv}), motifR), T: variant(motif2, 'thin', motifR), G: MV.G};
    const schemeOf = (S, k) => { const sc = schemes[(S.idx + Math.floor(k * 2)) % schemes.length]; return isPeak(S) && S.idx > firstPeak.idx && dv > .5 && k > .5 ? sc.map(x => x === 'A' ? 'B' : x) : sc; };

    // ---------- arrangement: roles enter one at a time (every 4 bars in the intro, faster in the second build), leave in reverse in the outro
    const L = Object.assign({keys: 1}, p.layers);
    const roleOK = {kick: L.kick && rhythm !== 'none', snare: L.snare && rhythm !== 'none', hat: L.hat && rhythm !== 'none', perc: L.perc, bass: L.bass, arp: L.arp, pad: L.pad, keys: L.keys, lead: L.lead && A() < ((STYLES[p.style] || STYLES.cooper).leadW === undefined ? 1 : (STYLES[p.style] || STYLES.cooper).leadW), tex: L.tex};
    const ROLES = Object.keys(roleOK).filter(k => roleOK[k]);
    const firstW = pickW(A, {pad: 3, keys: 3, arp: 2, tex: 1.5}), order = [firstW].concat(['tex', 'pad', 'keys', 'hat', 'perc', 'arp', 'bass', 'kick', 'snare', 'lead'].filter(x => x !== firstW).map(x => ({x, w: {tex: 1, pad: 2, keys: 2, hat: 3, perc: 3.5, arp: 4, bass: 5, kick: 6, snare: 6.5, lead: 8}[x] + A() * 2.5})).sort((a, b) => a.w - b.w).map(o => o.x)).filter(x => roleOK[x]);
    const act = []; const all = new Set(ROLES), breakKeep = new Set(['pad', 'keys', 'tex']); if (A() < .45 && roleOK.arp) breakKeep.add('arp'); if (A() < .3 && roleOK.hat) breakKeep.add('hat'); if (A() < .25 && roleOK.bass) breakKeep.add('bass'); if (A() < .35 && roleOK.lead) breakKeep.add('lead');
    const leadW = STY.leadW === undefined ? 1 : STY.leadW;
    const introLen = secs[0].bars + (isBuild(secs[1] || {}) ? secs[1].bars : 0), step0 = Math.max(2, Math.round(introLen / Math.max(1, order.length)) >> 1 << 1);
    secs.forEach((S, si) => { for (let b = 0; b < S.bars; b++){ const bar = S.bar0 + b; let set;
      if (si < firstPeak.idx){ const steppy = form === 'cooper' || form === 'steps', barQ = Math.floor(bar / 4) * 4, nIn = steppy ? Math.min(order.length, Math.max(1, Math.ceil(order.length * (barQ + 4) / Math.max(4, firstPeak.bar0)))) : Math.min(order.length, 1 + Math.floor(bar / step0));
        set = new Set(order.slice(0, nIn));
        if (S.name === 'intro'){ set.delete('kick'); set.delete('snare'); } if (S.name === 'low'){ set.delete('kick'); set.delete('snare'); set.delete('bass'); if (b > 1) set.delete('hat'); }
        if (isBuild(S)){ if (b < S.bars - 1 && S.bars > 4) set.delete('kick'); if (b < S.bars * .5) set.delete('snare'); } if (!set.has('lead') && isBuild(S) && b >= S.bars - 4 && roleOK.lead && A() < .2) set.add('lead');
        if (S.name === 'groove' && si > 0 && secs[si - 1].name === 'groove' && roleOK.kick) set.add('kick'); }
      else if (isPeak(S)) set = new Set(all);
      else if (S.name === 'groove') set = new Set([...all].filter(r => r !== 'lead' || b >= S.bars / 2));
      else if (S.name === 'break' || S.name === 'low'){ set = new Set([...all].filter(r => breakKeep.has(r))); if (S.name === 'low' && roleOK.arp) set.add('arp'); if (!set.size) set.add(ROLES[0]); }
      else if (isBuild(S)){ const prev = act[S.bar0 - 1] || new Set(), back = order.filter(r => !prev.has(r)), nIn = Math.ceil(back.length * (b + 1) / S.bars); set = new Set([...prev, ...back.slice(0, nIn)]); if (b < S.bars - 1 && roleOK.kick) set.delete('kick'); if (b === S.bars - 1 && roleOK.kick) set.add('kick'); }
      else { const nOut = Math.floor(order.length * b / S.bars), gone = order.slice().reverse().slice(0, nOut); set = new Set([...all].filter(r => gone.indexOf(r) < 0)); if (!set.size) set.add(order[0]); }
      act[bar] = set; } });

    // ---------- events
    const ev = [], kicks = []; let seq = 0;
    const T = (gs, s) => gs * ST + ((s & 1) ? (p.swing - .5) * 2 * ST : 0) + ((s & 3) ? (V() * 2 - 1) * p.humanize * .006 : 0);
    const add = o => { o.seed = hashSeed(p.seed, p.vary, seq++); ev.push(o); return o; };
    const G = {kick: .78, snare: .7, hat: .4, perc: .15, bass: .3, arp: .21, pad: .26, keys: .39, lead: .24, tex: .24, drone: .1, riser: .17, impact: .42};
    const ARPMUL = {synth: 1.25, blip: 1.1, keys: 1.15, pluck: 1, saw: .85, epiano: 1.1, mallet: 1, bell: .8}, LEADMUL = {synth: 1.2, keys: 1.3, pluck: 1.1, glass: 1.1, sawlead: .8, fmlead: .9, mallet: 1};
    let arpCfg = null, arpCfg2 = null, lastFillBar = -9, phraseCache = null; const arpMask = pick(V, [[1, 1, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [1, 0, 1, 0]]);
    const bassNotes = []; let bassStart = 0;
    const flushBass = endBar => { if (bassNotes.length){ const t0 = bassStart * BT, len = endBar * BT - t0; add({inst: 'mono', t: t0, len, notes: bassNotes.map(n => Object.assign({}, n, {t: n.t - t0, dur: Math.min(n.dur, len - (n.t - t0))})), p: PT.bass, bus: 'bass', pan: 0, v: G.bass}); } bassNotes.length = 0; };
    const playBass = (t, bar, pitch, dur, v) => { if (PT.bass.inst === 'mono'){ if (!bassNotes.length) bassStart = bar; bassNotes.push({t, m: pitch, dur, v}); } else add({inst: PT.bass.inst, t, v: v * G.bass, f: mtof(pitch), dur, p: PT.bass, bright: .6, bus: 'bass', pan: 0}); };
    const keysInPeak = A() < ((STYLES[p.style] || STYLES.cooper).keysPeak === undefined ? .2 : (STYLES[p.style] || STYLES.cooper).keysPeak), keysPat = pick(V, ['broken', 'broken', 'block', 'roll']), keysSteps = pick(V, [[0, 4, 8, 12], [0, 6, 8, 14], [0, 3, 6, 8, 11, 14], [0, 8]]), keysVoss = voss(V, 128, 5);
    for (let bar = 0; bar < NB; bar++){
      const S = secOf(bar), k = (bar - S.bar0) / S.bars, e = energy(bar), ch = chordAtBar(bar), set = act[bar], nextS = secOf(bar + 1), last = bar === S.bar0 + S.bars - 1;
      const lastBarOfBuild = isBuild(S) && last && nextS !== S && nextS.e > S.e + .15 && rhythm !== 'none';
      const dens = p.density * (.55 + .45 * e), brt = clamp(.3 + .5 * e + .15 * LZ[bar * 16] + (bright - .5) * .6, .15, 1.2), dyn = clamp(.5 + .5 * e, .4, 1);
      const hRow = caHat(), pRow = caPerc(), kRow = caKick(), hatVar = (bar >> 2) & 1, chaosOn = p.chaos * S.chaosMul;
      const ladder = ladderOf(ch, 64, 91), pool = ladderOf(ch, 55, 84);
      const gap = s => lastBarOfBuild && s >= 12;    // the silence before the drop
      const MVS = isPeak(S) && S.idx > firstPeak.idx ? MV2 : MV;
      for (let s = 0; s < 16; s++){ const gs = bar * 16 + s, t = T(gs, s), lg = LOG[gs], strong = (s & 3) === 0;
        if (gap(s)) continue;
        // kick
        if (set.has('kick')){ let v = 0;
          if (rhythm === 'four') v = s % 4 === 0 ? 1 : ((s === 6 || s === 14) && dens > .6 && e > .8 ? .42 : (s === 14 && lg > 1 - dens * .4 && chaosOn > .3 ? .4 : 0));
          else if (rhythm === 'drive') v = s % 2 === 0 ? (s % 4 === 0 ? 1 : .6) : 0;
          else if (rhythm === 'broken') v = kickEu[s] ? (s === 0 ? 1 : .88) : (kRow[s] && lg > .85 && s % 2 === 0 && chaosOn > .4 ? .45 : 0);
          else if (rhythm === 'half') v = s === 0 || s === 10 ? 1 : (s === 7 && lg > .7 && chaosOn > .3 ? .5 : 0);
          else if (rhythm === 'ca') v = s === 0 ? 1 : (kRow[s] && s % 2 === 0 && lg > .5 ? .8 : 0);
          if (v > 0){ add({inst: 'kick', t, v: v * G.kick * dyn, p: PT.kick, bus: 'drums'}); if (v >= .6) kicks.push(t); } }
        // snare / clap
        if (set.has('snare')){ let v = 0;
          if (rhythm === 'four') v = backbeat ? (s === 4 || s === 12 ? 1 : 0) : (s === 12 ? .8 : 0);
          else if (rhythm === 'drive') v = s === 12 ? .75 : (s === 4 ? .6 : 0);
          else if (rhythm === 'half') v = s === 8 ? 1 : 0;
          else if (rhythm === 'broken') v = snEu[s] ? .9 : 0;
          else if (rhythm === 'ca') v = (s === 4 || s === 12) && pRow[s] ? .9 : (s === 12 ? .7 : 0);
          if (v > 0) add({inst: 'snare', t, v: v * G.snare * dyn, p: PT.snare, bus: 'drums', pan: 0, sv: .2}); }
        // build roll
        if (isBuild(S) && k > .74 && roleOK.snare && rhythm !== 'none'){ const fin = last, every = fin ? 1 : k > .87 ? 2 : 4;
          if (s % every === 0) add({inst: 'snare', t, v: (.2 + .6 * (k - .74) / .26) * G.snare * (fin ? (.6 + s / 30) : 1), p: Object.assign({}, PT.snare, {clap: false}), bus: 'drums', sv: .3}); }
        // hats: 8ths with a Euclidean accent, 16ths when dense; the CA only rewrites them when chaos asks
        if (set.has('hat')){ const acc = hatAcc[s] ? 1 : [.9, .4, .6, .4][s & 3]; let pl = (s & 1) === 0 || (dens > .55 && (hatVar ? hatAcc[(s + 8) % 16] : hatAcc[s])) || (chaosOn > .55 && hRow[s] && lg > .6);
          if (rhythm === 'half') pl = (s & 1) === 0 || (hRow[s] && lg > .7); if (rhythm === 'ca') pl = (s & 1) === 0 || hRow[s];
          const open = (rhythm === 'four' && (s & 3) === 2 && e > .55 && (bassStyle !== 'offbeat' || (bar & 1))) || (s === 14 && hRow[s] && e > .75);
          if (pl && (e > .45 || (s & 1) === 0)) add({inst: 'hat', t, v: acc * (.7 + .3 * hatVoss[gs % 64]) * G.hat * dyn * (open ? 1.25 : 1), open, p: PT.hat, bus: 'drums', pan: (s & 2 ? .5 : -.5) * p.width}); }
        // two polymetric percussion lines on chord tones, thinned by the automaton
        if (set.has('perc') && e > .5){ const ia = gs % pA.len, ib = gs % pB.len, pcsA = ladderOf(ch, PT.perc.reg, PT.perc.reg + 12);
          if (pA.pat[ia] && (pRow[s] || lg > .55)) add({inst: 'perc', t, v: (.5 + .5 * lg) * G.perc * (.5 + .5 * dyn), f: mtof(pcsA[pA.tone[ia] % pcsA.length]), body: PT.perc.body, decay: PT.perc.decay, hard: .3 + .5 * lg, bus: 'duck', pan: ((ia / pA.len) - .5) * 1.6 * p.width, sv: .18, sd: .12 * p.delay});
          if (pB.pat[ib] && e > .35 && lg > .3){ const pcsB = ladderOf(ch, 43, 55); add({inst: 'perc', t: t + .001, v: (.35 + .4 * lg) * G.perc, f: mtof(pcsB[pB.tone[ib] % pcsB.length]), body: pB.len % 2 ? 'wood' : 'membrane', decay: .6, hard: .6, bus: 'duck', pan: -((ib / pB.len) - .5) * 1.4 * p.width, sv: .12, sd: .1 * p.delay}); } }
        // bass: the root, held across the chord or moving under the kick; a fifth or octave now and then
        if (set.has('bass')){ let hit = false, len = 2, d = 0;
          if (bassStyle === 'sustain'){ hit = s === 0 && (bar === ch.bar || (isPeak(S) && (bar - ch.bar) % 2 === 0)); len = Math.min(bar === ch.bar ? ch.bars : 2, 2) * 16 - .5; }
          else if (bassStyle === 'offbeat'){ hit = (s & 3) === 2; len = 1.6; }
          else if (bassStyle === 'roll'){ hit = (s & 3) !== 0; len = .9; }
          else if (bassStyle === 'pulse'){ hit = (s & 1) === 0; len = 1.5; }
          else { hit = !!bassEu[s]; len = 2.5; }
          if (hit && !(lastBarOfBuild && s > 8)){ const r5 = V(); if (s !== 0 && bassStyle !== 'sustain'){ if (r5 < .1 + chaosOn * .1) d = 7; else if (r5 < .16 + chaosOn * .1) d = 12; }
            playBass(t, bar, ch.bass + d, len * ST, (s === 0 ? 1 : .85) * dyn); } }
        // arpeggio: chord tones in a polymetric cycle; accents from 1/f noise; ratchets when chaos is up
        if (set.has('arp')){ if (!arpCfg || bar === S.bar0){ const rate = isCalm(S) || S.name === 'swell' ? 2 : (p.arpRate === 8 ? 2 : 1);
            arpCfg = {rate, pat: pick(V, ['up', 'down', 'updown', 'converge', 'walk', 'thirds', 'up']), plen: pick(V, p.poly < .3 ? [4, 8] : [3, 5, 7, 5, 6]), oct: isPeak(S) ? 1 : 0, gate: euclid(Math.round(lerp(6, 14, dens)), 16, Math.floor(V() * 4) * 2), walk: 0, vel: voss(V, 32, 4), n: 0};
            arpCfg2 = {rate: 1, pat: pick(V, ['down', 'thirds', 'updown']), plen: pick(V, [3, 5, 7].filter(x => x !== arpCfg.plen)), oct: 1, gate: euclid(Math.round(lerp(4, 9, dens)), 16, 1 + Math.floor(V() * 4) * 2), walk: 0, vel: voss(V, 32, 4), n: 0}; }
          const arpStep = (cfg, vMul, panSign, octOff, sdMul) => { if (s % cfg.rate !== 0 || !(cfg.gate[s] || (p.poly > .6 && hRow[s] && lg > .5)) || !(e > .5 || lg > .2 || strong)) return;
            const P = pool.length, n = cfg.n++, ci = n % cfg.plen, cyc = Math.floor(n / cfg.plen); let ix;
            if (cfg.pat === 'up') ix = (ci + cyc) % P; else if (cfg.pat === 'down') ix = P - 1 - (ci + cyc) % P;
            else if (cfg.pat === 'updown'){ const per = Math.max(1, 2 * P - 2), q = (ci + cyc * 2) % per; ix = q < P ? q : per - q; }
            else if (cfg.pat === 'converge') ix = ci % 2 ? P - 1 - ((ci >> 1) + cyc) % P : ((ci >> 1) + cyc) % P;
            else if (cfg.pat === 'thirds') ix = (ci * 2 + cyc) % P;
            else { cfg.walk = clamp(cfg.walk + (lg > .5 ? 1 : -1), 0, P - 1); ix = cfg.walk; }
            let mn = pool[clamp(ix, 0, P - 1)] + octOff; if (cfg.oct && ci === 0 && cyc % 2) mn += 12; while (mn > 84 + octOff) mn -= 12; while (mn < 57 + octOff) mn += 12;
            const vel = (.55 + .45 * cfg.vel[gs % 32]) * (ci === 0 ? 1.12 : 1) * (.45 + .55 * dyn) * vMul, gate = cfg.rate * ST * (.6 + 1.2 * lg);
            const ratchet = chaosOn > .4 && lg > .93 && cfg.rate === 1 ? 2 : 1;
            for (let q = 0; q < ratchet; q++) add({inst: PT.arp.inst, t: t + q * ST / 2, v: vel * G.arp * (ARPMUL[pal.arp] || 1) * (q ? .7 : 1), f: mtof(mn), vel, dur: gate / ratchet, p: PT.arp, body: PT.arp.body, decay: PT.arp.decay, bright: brt, bus: 'duck', pan: clamp(panSign * (ci / Math.max(1, cfg.plen - 1) - .5) * 1.6 * p.width, -1, 1), sv: .28, sd: .35 * p.delay * sdMul}); };
          const arpOn = isPeak(S) ? ((bar - S.bar0) % 8 < 6 || e > .9) : arpMask[((bar - S.bar0) >> 1) & 3]; if (arpOn) arpStep(arpCfg, 1, 1, 0, 1);
          if (p.poly > .45 && isPeak(S) && e > .8 && ((bar - S.bar0) >> 2) % 2 === 1) arpStep(arpCfg2, .45, -1, 12, 1.6); }
        // keys: broken chords in the calm sections, long chords on changes elsewhere — the piano in the breakdown
        if (set.has('keys')){ const calm = isCalm(S) || S.name === 'swell' || S.name === 'groove', lad = ladderOf(ch, 48, 76);
          if (keysPat === 'block' || !calm){ if (!calm && !keysInPeak && !isBuild(S)){} else if (s === 0 && (bar === ch.bar || (!calm && (bar - ch.bar) % 2 === 0))){ const vl = .5 + .3 * e; add({inst: 'keys', t, v: G.keys * .8, vel: vl, notes: ch.voicing.map(m => m - (ch.voicing[0] > 60 ? 12 : 0)), dur: (calm ? Math.min(ch.bars, 2) : 1) * BT * .95, p: PT.keys, bright: brt, bus: 'duck', pan: 0, sv: .4, sd: .1 * p.delay}); } }
          else if (calm && keysSteps.indexOf(s) >= 0){ const i = keysSteps.indexOf(s), m = keysPat === 'roll' ? lad[(i + (bar - ch.bar) * 2) % lad.length] : lad[(i * 2 + (bar & 1)) % lad.length], vl = .45 + .35 * keysVoss[gs % 128] + .15 * e;
            add({inst: 'keys', t, v: G.keys, vel: vl, f: mtof(m), dur: ST * 6, p: PT.keys, bright: brt, bus: 'duck', pan: (m - 62) / 40, sv: .42, sd: .15 * p.delay}); } }
        // lead: the motif, re-harmonised on the ladder; A A' B A schemes; thin in builds, augmented in breaks
        if (set.has('lead')){ const phraseLen = 32, pgs = gs - S.bar0 * 16, ph = Math.floor(pgs / phraseLen), rel = pgs % phraseLen;
          if (rel === 0 || !phraseCache || phraseCache.S !== S || phraseCache.ph !== ph){ const sc = schemeOf(S, k); let key = sc[ph % 4]; if (isBuild(S)) key = ph % 2 ? 'T' : key; if (S.name === 'break' || S.name === 'intro') key = 'G'; phraseCache = {S, ph, m: MVS[key] || MVS.A, key}; }
          for (const nt of phraseCache.m.notes) if (nt.s === rel){ let mn; const rung = clamp(nt.rung, 0, ladder.length - 1);
              if (nt.pass && phraseCache.prevM !== undefined){ const target = ladder[rung]; const pt = scaleBetween(phraseCache.prevM, target); mn = pt === null ? target : pt; } else mn = ladder[rung];
              if (phraseCache.key === 'G') mn -= 12; while (mn > 91) mn -= 12; phraseCache.prevM = mn;
              const vel = nt.v * (S.name === 'groove' ? .8 : 1) * (.6 + .4 * dyn), dur = Math.min(nt.len, 8) * ST * (phraseCache.key === 'G' ? 1.6 : .95);
              add({inst: PT.lead.inst, t, v: vel * G.lead * (LEADMUL[pal.lead] || 1), vel, f: mtof(mn), dur, p: PT.lead, body: PT.lead.body, decay: PT.lead.decay, bright: brt * 1.05, bus: 'duck', pan: .1, sv: .32, sd: .4 * p.delay}); } }
      }
      // fills every 8 bars in the driving sections
      if ((isPeak(S) || S.name === 'groove') && roleOK.perc && (bar - S.bar0) % 8 === 7 && bar - lastFillBar > 4 && rhythm !== 'none'){ lastFillBar = bar; const fr = caFill(), lad = ladderOf(ch, 48, 60);
        for (let s = 12; s < 16; s++) if (fr[s] || s === 15) add({inst: 'perc', t: T(bar * 16 + s, s), v: (.45 + .1 * (s - 12)) * G.perc, f: mtof(lad[(s - 12) % lad.length]), body: 'membrane', decay: .7, hard: .7, bus: 'duck', pan: (s - 13.5) * .3, sv: .2}); }
      // bass phrases flush every 4 bars, at section edges, or when the bass leaves
      const nextSet = act[bar + 1]; if (bar + 1 >= NB || (bar + 1) % 4 === 0 || nextS !== S || !nextSet || !nextSet.has('bass')) flushBass(bar + 1);
      // chord-length events
      if (set.has('pad') && bar === ch.bar){ const notes = ch.voicing.slice(); if (isPeak(S) && p.color > .4) notes.push(ch.voicing[1] + 12);
        add({inst: 'pad', t: bar * BT, v: G.pad * (.65 + .35 * (1 - e * .5)), notes, dur: ch.bars * BT, p: PT.pad, bright: brt, mod: LZ.subarray(bar * 16, Math.min(NSTEP, (bar + ch.bars) * 16 + 16)), modT: ST, bus: 'duck', sv: .5}); }
      if (set.has('pad') && bar === S.bar0 && (isCalm(S) || form === 'ambient') && p.color > .3) add({inst: 'drone', t: bar * BT, v: G.drone, root: dmidi(0, 36), dur: S.bars * BT, bus: 'bass', sv: .3});
      if (set.has('tex') && (bar === S.bar0 || (act[bar - 1] && !act[bar - 1].has('tex')))){ let nb = 0; while (bar + nb < NB && secOf(bar + nb) === S && act[bar + nb].has('tex')) nb++;
        add({inst: 'tex', t: bar * BT, v: G.tex * (isPeak(S) ? .55 : 1) * (pal.tex === 'crackle' ? .8 : 1), dur: nb * BT, p: PT.tex, root: dmidi(ch.root, 36), chordAt: chordAtT, mod: LZ2.subarray(bar * 16, Math.min(NSTEP, (bar + nb) * 16 + 16)), modT: ST, bus: 'duck', sv: .55}); }
      if (bar === S.bar0 && bar > 0 && (isPeak(S) || S.e > secs[S.idx - 1].e + .15) && set.has('kick') && rhythm !== 'none' && !p.noSweeteners) add({inst: 'impact', t: bar * BT, v: G.impact, bus: 'drums', sv: .45});
      if ((isBuild(S) || ((S.name === 'groove' || S.name === 'low') && nextS !== S && nextS.e > S.e + .15)) && nextS !== S && !p.noSweeteners && bar === S.bar0 + S.bars - Math.min(8, Math.max(4, S.bars >> 1))){ const nb = S.bar0 + S.bars - bar;
        add({inst: 'shepard', t: bar * BT, v: G.riser * .9, dur: nb * BT - ST * 4, f0: mtof(dmidi(0, 24)), cycle: BT * 2, rise: true, bus: 'duck', sv: .5});
        if (rhythm !== 'none') add({inst: 'riser', t: (bar + Math.max(0, nb - 4)) * BT, v: G.riser * .8, dur: Math.min(nb, 4) * BT - ST * 4, bus: 'duck', sv: .5}); }
    }
    flushBass(NB);
    const fxC = resolveFx(p, (STYLES[p.style] || STYLES.cooper).fx, rngOf(hashSeed(p.seed, 733)));
    const meta = {bpm: p.bpm, key: NOTE[tonic] + ' ' + p.mode, style: p.style, styleName: STYLES[p.style] ? STYLES[p.style].name : 'free', fx: Object.keys(fxC).filter(k => fxC[k]), rhythm, form, palette: pal, bassStyle, bars: NB, duration: NB * BT,
      sections: secs.map(s => ({name: s.name, bar0: s.bar0, bars: s.bars, e: s.e, eTo: s.eTo, chords: chords.filter(c => c.bar >= s.bar0 && c.bar < s.bar0 + s.bars).map(c => ({bar: c.bar, bars: c.bars, name: c.name}))})),
      events: ev.length, loop: loopA.map(c => c.name).join(' – '), melody: melodyK, motif: motif.notes.length + ' notes / ' + motif.len + ' steps', poly: pA.len + '/' + pB.len};
    return {events: ev, kicks, beat, BT, duration: NB * BT, meta, fx: fxC, fxp: fxPlan(secs, NB, BT, beat, fxC, rngOf(hashSeed(p.seed, 734)))};
  }
  // =========================================================== effects choice (shared by both engines)
  const FXN = ['lofi', 'tape', 'phaser', 'chorus', 'sweep', 'crush', 'dubthrow', 'stutter', 'tapestop', 'reverse'];
  // explicit p.fx wins; otherwise 1–3 effects are drawn from the style's weights — a different combination per piece
  function resolveFx(p, w, r){ const o = {}; FXN.forEach(k => o[k] = false);
    if (p.fx && typeof p.fx === 'object'){ FXN.forEach(k => o[k] = !!p.fx[k]); return o; }
    if (!w) return o; const pool = Object.assign({}, w), cnt = 1 + Math.floor(r() * 3);
    for (let i = 0; i < cnt; i++){ const k = pickW(r, pool); if (!pool[k]) break; o[k] = true; pool[k] = 0; }
    if (o.lofi && o.tape) o.tape = false; return o; }
  // section-level automation: filter sweeps per bar, and edits applied to the finished mix (stutters, tape stops, reverse swells)
  function fxPlan(secs, NB, BT, beat, fx, r){ const lp = new Float32Array(NB + 2).fill(20000), hp = new Float32Array(NB + 2).fill(20), post = [];
    const isDrop = s => /drop|peak|hook|groove/.test(s.name), isBuild = s => /build|rise|groove|low/.test(s.name);
    secs.forEach((S, i) => { const nx = secs[i + 1];
      if (fx.sweep){ if (S.name === 'break' || S.name === 'low' || S.name === 'swell' || (S.name === 'intro' && r() < .6)){ const lo = rr(r, 350, 900); for (let b = 0; b < S.bars; b++) lp[S.bar0 + b] = lo * Math.pow(20000 / lo, Math.pow(b / S.bars, 2.2)); }
        if (isBuild(S) && nx && isDrop(nx) && nx.e > S.e + .12){ const nb = Math.min(S.bars, 8); for (let b = 0; b < nb; b++) hp[S.bar0 + S.bars - nb + b] = 20 + 650 * Math.pow((b + 1) / nb, 2); } }
      if (nx && isDrop(nx) && nx.e > S.e + .12 && i > 0){ const tD = nx.bar0 * BT;
        if (fx.tapestop && r() < .75) post.push({type: 'tapestop', t0: tD - 2 * beat, t1: tD});
        else if (fx.stutter && r() < .65) post.push({type: 'buildrepeat', t0: tD - 4 * beat, t1: tD});
        if (fx.reverse) post.push({type: 'reverse', t: tD, len: beat * (r() < .5 ? 2 : 1)}); }
      if (fx.stutter && isDrop(S)) for (let b = S.bar0 + 7; b < S.bar0 + S.bars - 1; b += 8) if (r() < .5) post.push({type: 'stutter', t0: (b + 1) * BT - beat, t1: (b + 1) * BT, slice: beat / pick(r, [2, 4, 4, 8])}); });
    return {lp, hp, post}; }
  // =========================================================== genre engine
  // Each style is a grammar: tempo, mode, kit, a groove library per drum voice, which roles carry the bass / chords / top line,
  // how the harmony loops, and which effects it likes. Every piece draws one option per slot, so styles never sound alike
  // and two pieces of the same style still differ in groove, sounds, arrangement and effects.
  const GS = {
    deephouse: {name: 'deep house', w: 3, bpm: [118, 124], swing: [.54, .6], pump: [.3, .55], mode: {minor: 3, dorian: 4, mixolydian: 1}, form: {club: 3, arc: 2}, bars: [96, 112, 128], prog: {jazzy: 3, loop: 2, vamp2: 1}, types: 'rich', chordBars: [1, 2, 2],
      kick: '909', snare: {clap: 3, snare: 1}, hat: {noise: 2, metal: 1}, perc: {rim: 2, conga: 2}, drums: 'house', bass: {offbeat: 3, garage: 1, sub: 1}, chords: {organ: 2, comp: 3, stab: 1, pad: 1}, top: {vox: 3, riff: 2, lead: 1, none: 2}, tex: {none: 2, crackle: 1, wind: 1},
      fx: {chorus: 2, phaser: 1, tape: 2, sweep: 3, dubthrow: 1, reverse: 1}},
    dubtechno: {name: 'dub techno', w: 2, bpm: [118, 126], swing: [.5, .55], verb: [.55, .8], delay: [.55, .85], bright: [.3, .5], density: [.4, .62], mode: {minor: 3, dorian: 3}, form: {club: 2, rise: 2}, bars: [112, 128, 144], prog: {vamp1: 3, vamp2: 3}, types: 'dub', chordBars: [4, 8],
      kick: 'soft', snare: {rim: 3, clap: 1}, hat: {noise: 1, shaker: 2}, perc: {rim: 1}, drums: 'dub', bass: {sub: 4, offbeat: 1}, chords: {dub: 6}, top: {none: 4, riff: 1}, tex: {crackle: 2, wind: 2, none: 1}, fx: {tape: 2, sweep: 2, chorus: 1, phaser: 1, dubthrow: 2}},
    techno: {name: 'techno', w: 3, bpm: [128, 136], swing: [.5, .53], drive: [.4, .7], pump: [.45, .75], density: [.62, .85], mode: {minor: 3, phrygian: 2}, form: {club: 3, rise: 2}, bars: [112, 128, 144], prog: {vamp1: 3, vamp2: 2}, types: 'dark', chordBars: [4, 8],
      kick: 'rumble', snare: {clap: 3, rim: 1}, hat: {noise: 3, metal: 1}, perc: {rim: 2, tom: 1, conga: 1}, drums: 'techno', bass: {rolling: 3, sub: 1, acid: 1}, chords: {stab: 3, gated: 1, none: 3}, top: {riff: 3, arp: 2, none: 2}, tex: {chaos: 2, wind: 1, none: 2},
      fx: {sweep: 3, crush: 1, stutter: 2, phaser: 1, reverse: 1, dubthrow: 1}},
    acid: {name: 'acid', w: 2, bpm: [124, 132], swing: [.5, .55], pump: [.35, .6], drive: [.35, .6], mode: {minor: 2, phrygian: 2, dorian: 1}, form: {club: 2, rise: 2}, bars: [112, 128], prog: {vamp1: 4, vamp2: 2}, types: 'dark', chordBars: [4, 8],
      kick: '909', snare: {clap: 3, snare: 1}, hat: {noise: 3}, perc: {rim: 2, tom: 1}, drums: 'techno', bass: {acid: 6}, chords: {none: 3, stab: 1, pad: 1}, top: {none: 3, riff: 1}, tex: {none: 2, chaos: 1}, fx: {sweep: 2, phaser: 2, stutter: 1, crush: 1, dubthrow: 1}},
    electro: {name: 'electro', w: 2, bpm: [124, 134], swing: [.5, .54], drive: [.3, .6], mode: {minor: 3, phrygian: 1, dorian: 1}, form: {club: 2, arc: 2}, bars: [96, 112, 128], prog: {vamp2: 3, loop: 2}, types: 'dark', chordBars: [2, 4],
      kick: 'electro', snare: {snare: 2, clap: 2}, hat: {metal: 3}, perc: {tom: 2, rim: 1}, drums: 'electro', bass: {square: 4, acid: 1}, chords: {stab: 2, pad: 1, none: 2}, top: {arp: 3, riff: 2, vox: 1}, tex: {none: 2, chaos: 1}, fx: {phaser: 2, crush: 2, stutter: 2, chorus: 1}},
    garage: {name: 'UK garage', w: 2, bpm: [130, 136], swing: [.6, .68], pump: [.3, .55], mode: {minor: 3, dorian: 2}, form: {club: 2, loop: 2}, bars: [96, 112, 128], prog: {jazzy: 3, loop: 2}, types: 'rich', chordBars: [1, 2],
      kick: '909', snare: {snare: 2, clap: 2}, hat: {noise: 2, shaker: 1}, perc: {rim: 3}, drums: 'garage', bass: {garage: 4, sub: 1}, chords: {organ: 3, stab: 2, comp: 1}, top: {vox: 4, riff: 1, none: 1}, tex: {none: 3, crackle: 1}, fx: {chorus: 2, sweep: 2, stutter: 2, reverse: 1, dubthrow: 1}},
    dnb: {name: 'drum & bass', w: 2, bpm: [170, 176], swing: [.5, .54], pump: [.15, .35], density: [.6, .85], mode: {minor: 4, dorian: 1, harmonicMinor: 1}, form: {dnb: 4}, bars: [128, 144, 160], prog: {loop: 3, vamp2: 2}, types: 'mid', chordBars: [2, 4],
      kick: '909', snare: {snare: 4}, hat: {noise: 2, metal: 1}, perc: {rim: 2}, drums: 'dnb', bass: {reese: 5, sub: 1}, chords: {pad: 4, stab: 1}, top: {riff: 2, arp: 1, vox: 1, none: 2}, tex: {wind: 2, grains: 1, none: 1}, fx: {sweep: 3, reverse: 2, stutter: 1, tapestop: 1, chorus: 1}},
    lofi: {name: 'lo-fi hip hop', w: 2, bpm: [76, 92], swing: [.58, .66], bright: [.25, .45], verb: [.25, .45], humanize: [.5, .8], pump: [.05, .2], mode: {dorian: 2, minor: 2, major: 1, mixolydian: 1}, form: {loop: 5}, bars: [48, 56, 64], prog: {jazzy: 5, loop: 1}, types: 'jazz', chordBars: [1, 2],
      kick: 'boom', snare: {lofi: 3, rim: 1}, hat: {noise: 1, shaker: 1}, perc: {rim: 2}, drums: 'boombap', bass: {walking: 2, sub: 2}, chords: {comp: 5, pad: 1}, top: {riff: 2, lead: 1, none: 2}, tex: {crackle: 5}, fx: {lofi: 6, tape: 3, chorus: 1, tapestop: 1}},
    trap: {name: 'trap', w: 2, bpm: [136, 150], swing: [.5, .53], pump: [.05, .25], drive: [.3, .6], verb: [.25, .5], mode: {minor: 3, harmonicMinor: 2, phrygian: 1}, form: {loop: 2, club: 2}, bars: [64, 80, 96], prog: {loop: 2, vamp2: 3}, types: 'triad', chordBars: [2, 4],
      kick: 'trap', snare: {trap: 4}, hat: {metal: 2, noise: 1}, perc: {rim: 1}, drums: 'trap', bass: {b808: 6}, chords: {pad: 3, stab: 1}, top: {riff: 4, vox: 1, lead: 1}, tex: {none: 2, wind: 1}, fx: {tapestop: 2, reverse: 2, stutter: 1, lofi: 1, sweep: 1}},
    synthwave: {name: 'synthwave', w: 2, bpm: [96, 112], swing: [.5, .52], verb: [.45, .7], width: [.85, 1], pump: [.2, .45], mode: {minor: 3, major: 1, dorian: 1}, form: {arc: 3, club: 1}, bars: [96, 112], prog: {loop: 5}, types: 'triad', chordBars: [1, 2],
      kick: '909', snare: {big: 5}, hat: {noise: 2}, perc: {tom: 1}, drums: 'synthwave', bass: {octave: 6}, chords: {pad: 4, gated: 2}, top: {lead: 3, arp: 3, riff: 1}, tex: {none: 3, wind: 1}, fx: {chorus: 4, tape: 2, reverse: 1, sweep: 1}},
    amapiano: {name: 'amapiano', w: 2, bpm: [110, 116], swing: [.54, .6], pump: [.15, .35], verb: [.3, .55], mode: {minor: 2, dorian: 3, major: 1}, form: {club: 2, loop: 2}, bars: [96, 112, 128], prog: {jazzy: 3, loop: 2}, types: 'rich', chordBars: [1, 2],
      kick: 'soft', snare: {rim: 2, clap: 2}, hat: {shaker: 4}, perc: {conga: 3}, drums: 'amapiano', bass: {log: 6}, chords: {piano: 4, pad: 1}, top: {vox: 2, riff: 2, none: 1}, tex: {none: 3, crackle: 1}, fx: {chorus: 1, sweep: 2, reverse: 1, dubthrow: 1}}};

  // groove library — 16 steps per bar. X accent · x hit · o soft · g ghost · ? chance (density) · r roll (hats) · . rest.
  // [main variants…] — a piece picks one main and one alternate per voice; Variation re-picks them.
  const DR = {
    house: {k: ['X...X...X...X...'], s: ['....X.......X...', '....X.......X..g', '....X..g....X...'], h: ['xgxgxgxgxgxgxgxg', 'x?x?x?x?x?x?x?x?', '.gx..gx..gx..gx.'], o: ['..X...X...X...X.', '..x...x...x...x?'],
      p: ['...x..x....x.x..', '..g..x....g..x..', '.......x.......x', '...x.....x..x...'], x: ['gxgxgxgxgxgxgxgx', ''], xi: 'shaker'},
    dub: {k: ['X...X...X...X...'], s: ['............x...', '................', '....g.......x...'], h: ['g.g.g.g.g.g.g.g.', 'g?g?g?g?g?g?g?g?'], o: ['..x...x...x...x.', '..o...o...o...o.'], p: ['...g......x.....', '......g.....g...'], x: ['gxgxgxgxgxgxgxgx', ''], xi: 'shaker'},
    techno: {k: ['X...X...X...X...', 'X...X...X...X..g'], s: ['....X.......X...', '............X...', '................'], h: ['xgxgXgxgxgxgXgxg', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'], o: ['..X...X...X...X.', '..x...x...x...x.'],
      p: ['x..x..x...x..x..', '..x..x..x..x..x.', '...x..x....x..x.', '.x..x..x..x..x..'], x: ['..x...x...x...x.', ''], xi: 'ride'},
    electro: {k: ['X.....X...X.....', 'X......XX.....X.', 'X..X......X..X..', 'X.....X..X....x.'], s: ['....X.......X...', '....X.......X.x.'], h: ['xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.', 'xgxgxgxgxgxgxgxg'], o: ['......x.......x.', ''],
      p: ['..x.....x.x.....', '...x..x.......x.'], x: [''], xi: ''},
    garage: {k: ['X.........X.....', 'X......x..X.....', 'X.........X..x..', 'X..x......X.....'], s: ['....X.......X...', '....X.......X..g'], h: ['x.xgx.xgx.xgx.xg', 'xgxgxgxgxgxgxgxg', '.gx..gx..gx..gx.'], o: ['......x.......x.', '..x.......x.....', ''],
      p: ['..g..x....g..x..', '...x......x..x..'], x: [''], xi: ''},
    dnb: {k: ['X.........X.....', 'X.........X..x..', 'X.X.......X.....', 'X.........x.X...'], s: ['....X.......X...', '....X..g.g..X..g', '....X.......X.g.'], h: ['x.x.x.x.x.x.x.x.', 'xgxgxgxgxgxgxgxg', 'x.xgx.x.x.xgx.x.'], o: ['..x.......x.....', ''],
      p: ['......g.......g.', ''], x: ['x...x...x...x...', ''], xi: 'ride'},
    boombap: {k: ['X......x..X.....', 'X.....X..x......', 'X.......X.x.....', 'X..x......X...x.'], s: ['....X.......X...', '....X.......X..g', '....X..g....X...'], h: ['x.x.x.x.x.x.x.x.', 'xgx.xgx.xgx.xgx.', 'x.xgx.x.x.xgx.x.'], o: ['..............x.', ''],
      p: ['.......g.......g', '...g.......g....'], x: [''], xi: ''},
    trap: {k: ['X......X..X.....', 'X.....X...X..X..', 'X..X......X.....', 'X.......X.x.....'], s: ['........X.......', '........X......g'], h: ['x.x.x.x.x.x.x.x.', 'x.x.xrx.x.x.x.r.', 'xxx.x.x.xrx.x.x.', 'x.x.x.x.xxx.r.xr'], o: ['', '..............x.'],
      p: ['', '....g.......g...'], x: [''], xi: ''},
    synthwave: {k: ['X...X...X...X...', 'X.......X.......', 'X.......X.x.....'], s: ['....X.......X...'], h: ['x.x.x.x.x.x.x.x.', 'xgxgxgxgxgxgxgxg'], o: ['', '..x...x...x...x.'], p: [''], x: [''], xi: ''},
    amapiano: {k: ['X...X...X...X...', 'X.......X.......', 'X...X...X...X..x'], s: ['....x.......x...', '......x.......x.', '...x.......x..x.'], h: [''], o: ['', '..g...g...g...g.'],
      p: ['...x..x...x..x..', '..x..x...x..x...', 'x..x..x..x..x.x.'], x: ['xgxgxgxgxgxgxgxg', 'xgxxxgxxxgxxxgxx'], xi: 'shaker'}};
  const CPAT = {stab: ['X.....X.....X...', '...X......X.....', 'X..X..X.........', '......X.......X.', 'X.......X..X....', '..X..X....X..X..'],
    dub: ['..X.......X.....', '...X.....X......', 'X.....X.....X...', '..X...X...X...X.'], organ: ['..X...X...X...X.', 'X..X..X...X..X..', '...X..X....X..X.', '..X..X.X..X..X.X'],
    comp: ['X.........X.....', 'X.....X.......X.', '..X.......X..X..', 'X......X..X.....'], piano: ['X..X..X...X..X..', 'X.....X..X..X...', '...X..X..X....X.']};
  const BPAT = {garage: ['X..s..X...x.x...', 'X.....x.X..x....', 'X..X..x...X..s..'], log: ['..X...X..X..X...', 'X..X...X..X.X...', '...X..X...X..X.X', '..X..sX...X...X.']};
  const VPAT = ['..X..X....X.....', 'X..X..X...X..X..', '...X..X.......X.', 'X.X...X..X......', '......X..X..X...'];
  const PROGS = {vamp1: [[0]], vamp2: [[0, 3], [0, 6], [0, 5], [0, 4]], loop: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 4, 0], [0, 2, 5, 6], [5, 6, 0, 0], [0, 4, 5, 3]],
    jazzy: [[1, 4, 0, 5], [0, 5, 1, 4], [3, 2, 1, 0], [0, 3, 1, 4], [1, 4, 0, 0], [3, 4, 2, 5]]};
  const TYPES = {rich: {sev: 3, nine: 3, add9: 2, sus2: 1}, dub: {sev: 3, nine: 3}, dark: {tri: 2, sus2: 2, sus4: 1, quart: 2}, triad: {tri: 6, add9: 1, sus2: 1}, jazz: {sev: 3, nine: 4}, mid: {tri: 2, sev: 2, add9: 2, sus2: 1}};
  const FORMS_G = {club: [['intro', .125, .3], ['build', .125, .55], ['drop', .25, 1], ['break', .125, .3], ['build', .0625, .6], ['drop', .1875, 1], ['outro', .125, .3]],
    arc: [['intro', .12, .25], ['build', .12, .5], ['drop', .24, 1], ['break', .13, .35], ['build', .07, .6], ['drop', .19, 1], ['outro', .13, .25]],
    rise: [['intro', .1, .2], ['build', .22, .45], ['build', .22, .7], ['drop', .32, 1], ['outro', .14, .3]],
    loop: [['intro', .0625, .35], ['verse', .25, .7], ['hook', .125, .95], ['verse', .25, .75], ['hook', .1875, 1], ['outro', .125, .3]],
    dnb: [['intro', .16, .3], ['build', .09, .55], ['drop', .25, 1], ['break', .16, .3], ['build', .06, .6], ['drop', .19, 1], ['outro', .09, .3]]};
  const parsePat = str => { const o = []; for (let s = 0; s < 16; s++){ const c = (str || '')[s] || '.'; o.push(c === 'X' ? {v: 1} : c === 'x' ? {v: .78} : c === 'o' ? {v: .55} : c === 'g' ? {v: .3, ghost: 1} : c === '?' ? {v: .6, ch: 1} : c === 'r' ? {v: .6, roll: 1} : c === 's' ? {v: .9, slide: 1} : null); } return o; };
  const wShuffle = (r, list, w) => { const left = list.slice(), out = []; while (left.length){ const ww = {}; left.forEach(k => ww[k] = (w[k] === undefined ? 1 : w[k]) + .001); const k = pickW(r, ww); out.push(k); left.splice(left.indexOf(k), 1); } return out; };

  function planGenre(p, G){
    const R = rngOf(hashSeed(p.seed, 11)), V = rngOf(hashSeed(p.seed, 977, p.vary)), H = rngOf(hashSeed(p.seed, 313)), A = rngOf(hashSeed(p.seed, 541, p.vary)), FXR = rngOf(hashSeed(p.seed, 733));
    const beat = 60 / p.bpm, ST = beat / 4, BT = beat * 4;
    const scale = MODES[p.mode] || MODES.minor, nS = scale.length, tonic = ((p.tonic | 0) % 12 + 12) % 12;
    const dpc = d => (tonic + scale[((d % nS) + nS) % nS]) % 12;
    const dmidi = (d, base) => base + 12 * Math.floor(d / nS) + tonic + scale[((d % nS) + nS) % nS];
    const L = p.layers, pal = p.palette || {};
    // ---------- sounds and roles (R: fixed per seed)
    const pk = (key, w) => pal[key] && pal[key] !== 'auto' ? pal[key] : pickW(R, w);
    const part = {bass: pk('bassline', G.bass), chords: pk('chords', G.chords), top: pk('topline', G.top), tex: pk('tex', G.tex)};
    const kitK = G.kick, kitS = pickW(R, G.snare), kitH = pickW(R, G.hat), kitP = pickW(R, G.perc), fx = resolveFx(p, G.fx, FXR);
    const KICK = {'909': {f0: rr(R, 140, 170), f1: rr(R, 45, 52), pitchT: rr(R, .025, .04), decay: rr(R, .26, .34), click: rr(R, .3, .5), drive: rr(R, 1.6, 2.2)}, rumble: {f0: rr(R, 130, 160), f1: rr(R, 44, 50), pitchT: .03, decay: rr(R, .24, .3), click: .35, drive: 2.2},
      soft: {f0: rr(R, 100, 120), f1: rr(R, 44, 50), pitchT: .03, decay: rr(R, .22, .28), click: .1, drive: 1.2}, electro: {f0: rr(R, 110, 130), f1: rr(R, 46, 50), pitchT: .05, decay: rr(R, .4, .55), click: .15, drive: 1.4},
      boom: {f0: rr(R, 110, 130), f1: rr(R, 48, 54), pitchT: .03, decay: rr(R, .3, .38), click: .12, drive: 1.15}, trap: {f0: rr(R, 150, 180), f1: rr(R, 50, 56), pitchT: .02, decay: rr(R, .16, .22), click: .5, drive: 1.8}}[kitK];
    KICK.drive *= 1 + p.drive * .6;
    const SN = {f0: rr(R, 170, 230), tone: rr(R, .05, .12), noise: rr(R, .1, .2), nf: rr(R, 1600, 3400), body: rr(R, .5, 1), snap: rr(R, .6, 1), clap: kitS === 'clap'};
    if (kitS === 'lofi') Object.assign(SN, {nf: rr(R, 1000, 1500), noise: rr(R, .12, .18), body: 1, tone: .1});
    if (kitS === 'big') Object.assign(SN, {noise: rr(R, .22, .32), nf: rr(R, 2200, 3200)});
    const HAT = {base: rr(R, 300, 420), closed: rr(R, .025, .05), open: rr(R, .16, .32), hp: rr(R, 6400, 8600), ring: rr(R, 8000, 10000), noisy: kitH === 'noise' ? rr(R, .65, .9) : rr(R, .15, .35)};
    const RIDE = Object.assign({}, HAT, {open: rr(R, .35, .5), noisy: .45, hp: 7200});
    const rimF = rr(R, 1400, 1900), congaBase = pick(R, [50, 53, 55]);
    // ---------- form
    const formK = FORMS_G[p.form] ? p.form : pickW(R, G.form), F = FORMS_G[formK], B = Math.max(16, Math.round(p.bars / 4) * 4);
    const secs = []; let acc = 0; F.forEach(([name, f, e]) => { const bars = Math.max(4, Math.round(f * B / 4) * 4); secs.push({name, bar0: acc, bars, e, eTo: e}); acc += bars; });
    secs.forEach((s, i) => { if (s.name === 'build') s.eTo = secs[i + 1] ? Math.max(s.e, secs[i + 1].e * .85) : s.e; s.idx = i; });
    const NB = acc, NSTEP = NB * 16, secOf = bar => { for (let i = secs.length - 1; i >= 0; i--) if (bar >= secs[i].bar0) return secs[i]; return secs[0]; };
    const energy = bar => { const s = secOf(bar), k = (bar - s.bar0) / s.bars; return lerp(s.e, s.eTo, k); };
    const firstMain = secs.findIndex(s => /drop|verse|hook/.test(s.name));
    // ---------- modulation sources
    const LOG = new Float32Array(NSTEP); { let x = .31 + V() * .3; for (let i = 0; i < NSTEP; i++){ x = clamp(3.6 + .39 * p.chaos, 3.4, 3.999) * x * (1 - x); if (x <= 0 || x >= 1) x = .5; LOG[i] = x; } }
    const LZ = new Float32Array(NSTEP); { let x = 1 + R(), y = 1, z = 1 + R() * 2; for (let i = 0; i < NSTEP; i++){ for (let s = 0; s < 3; s++){ const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * .006; y += dy * .006; z += dz * .006; } LZ[i] = clamp(x / 20, -1, 1); } }
    // ---------- harmony: a loop, like real songs — repeated, with an alternate loop for breaks
    const STACK = {tri: [0, 2, 4], sev: [0, 2, 4, 6], sus2: [0, 1, 4], sus4: [0, 3, 4], add9: [0, 2, 4, 8], nine: [0, 2, 4, 6, 8], quart: [0, 3, 6]};
    const isDim = d => nS === 7 && ((dpc(d + 4) - dpc(d) + 12) % 12) === 6;
    const chordName = (root, type) => { const pcs = STACK[type].map(x => dpc(root + x)), rp = pcs[0], iv = pcs.map(q => (q - rp + 12) % 12), has = x => iv.indexOf(x) >= 0;
      if (type === 'quart') return NOTE[rp] + '⁴'; if (type === 'sus2') return NOTE[rp] + 'sus2'; if (type === 'sus4') return NOTE[rp] + 'sus4';
      const m = has(3) && !has(4), dim = m && has(6) && !has(7); let q = dim ? (has(10) ? 'm7♭5' : 'dim') : m ? 'm' : '';
      if (!dim){ if (has(11)) q += 'maj7'; else if (has(10)) q += '7'; } if (type === 'add9') q += 'add9'; if (type === 'nine') q = q.replace('7', '9'); return NOTE[rp] + q; };
    let lastVoice = null;
    const voice = pcs => { const lo = 50, hi = 76, opts = pcs.map(pc => { const o = []; for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m); return o; }); let best = null, bc = 1e9; const cur = [];
      const rec = i => { if (i === opts.length){ const s = cur.slice().sort((a, b) => a - b); for (let k = 1; k < s.length; k++){ if (s[k] - s[k - 1] < 2) return; if (s[k] < 59 && s[k] - s[k - 1] < 5) return; } if (s[s.length - 1] - s[0] > 21) return;
          let c = 0; if (lastVoice) for (const m of s){ let d = 99; for (const q of lastVoice) d = Math.min(d, Math.abs(m - q)); c += d; } else c = Math.abs((s[0] + s[s.length - 1]) / 2 - 63);
          c += H() * .9; if (c < bc){ bc = c; best = s; } return; } for (const m of opts[i]){ cur.push(m); rec(i + 1); cur.pop(); } };
      rec(0); if (!best) best = pcs.map(pc => 55 + ((pc - 55) % 12 + 12) % 12).sort((a, b) => a - b); lastVoice = best; return best; };
    const tw = Object.assign({}, TYPES[G.types]); if (p.color > .7){ tw.sev = (tw.sev || 0) + 2; tw.nine = (tw.nine || 0) + 1.5; } if (p.color < .25){ tw.tri = (tw.tri || 0) + 3; }
    const fam = pickW(H, G.prog), jazz = G.types === 'jazz' || fam === 'jazzy';
    const mkLoop = degs => degs.map(d => { let root = d; if (isDim(root) && !jazz) root = (root + 2) % nS; const type = pickW(H, tw); return {root, type}; });
    const loopA = mkLoop(pick(H, PROGS[fam])), loopB = H() < .55 ? mkLoop(pick(H, PROGS[fam])) : loopA;
    [loopA, loopB, loopA].forEach(lp => lp.forEach(c => { c.pcs = STACK[c.type].map(x => dpc(c.root + x)); c.voicing = voice(c.pcs); c.bass = 33 + ((dpc(c.root) - 33) % 12 + 12) % 12; c.name = chordName(c.root, c.type); }));
    let cb = pick(R, G.chordBars); if (p.motion > .72 && cb > 1) cb = Math.max(1, cb >> 1); if (p.motion < .22) cb = Math.min(8, cb * 2); if (loopA.length < 3) cb = Math.max(cb, 2);
    const chordBar = []; const chords = [];
    secs.forEach(S => { const lp = S.name === 'break' ? loopB : loopA; for (let b = 0; b < S.bars; b++){ const c = lp[Math.floor(b / cb) % lp.length], bar = S.bar0 + b, start = b % cb === 0;
      chordBar[bar] = Object.assign({}, c, {bar: start ? bar : chordBar[bar - 1] ? chordBar[bar - 1].bar : bar, bars: Math.min(cb, S.bars - (b - b % cb))}); if (start) chords.push({bar, bars: Math.min(cb, S.bars - b), name: c.name}); } });
    // ---------- groove: one main + one alternate variant per drum voice (V — Variation re-rolls these)
    const D = DR[G.drums], DP = {};
    for (const v of ['k', 's', 'h', 'o', 'p', 'x']){ const list = (D[v] || ['']).filter(x => x !== undefined); const a = pick(V, list), b = V() < .6 ? pick(V, list) : a; DP[v] = [parsePat(a), parsePat(b)]; }
    const rollN = pick(V, [2, 3]);
    // ---------- arrangement: which roles play in which bar — an order drawn per piece (A)
    const has = {kick: L.kick && !!D.k.join(''), snare: L.snare, hat: L.hat && !!(D.h.join('') + D.o.join('')), perc: L.perc && !!D.p.join(''), x: L.hat && !!D.x.join(''), bass: L.bass,
      chords: L.pad && part.chords !== 'none', top: (L.arp || L.lead) && part.top !== 'none', tex: L.tex && part.tex !== 'none'};
    const ROLES = Object.keys(has).filter(k => has[k]);
    const loopy = formK === 'loop', ew = loopy ? {chords: 4, tex: 3, kick: .5, hat: 1, x: 1, perc: 1, bass: .6, snare: .4} : {kick: 3, hat: 3, x: 2, perc: 1.5, chords: 2, tex: 2, bass: 1.2, snare: .8};
    const topEarly = A() < .3; let order = wShuffle(A, ROLES.filter(r => r !== 'top'), ew); if (has.top) order.splice(topEarly ? Math.floor(A() * order.length) : order.length, 0, 'top');
    const verseTop = A() < .35, brk = {top: A() < .65, perc: A() < .4, hat: A() < .35, bass: A() < .3, x: A() < .35};
    const act = []; const all = new Set(ROLES);
    const rampEnd = firstMain > 0 ? secs[firstMain].bar0 : 4, k0 = Math.min(order.length, 1 + (A() < .5 ? 1 : 0) + (loopy ? 1 : 0));
    const entry = {}; order.forEach((r, j) => { entry[r] = j < k0 ? 0 : Math.min(rampEnd, Math.round((j - k0 + 1) * rampEnd / (order.length - k0 + 1) / 4) * 4); }); if (has.top && !topEarly) entry.top = rampEnd;   // the hook usually waits for the drop
    secs.forEach((S, si) => { for (let b = 0; b < S.bars; b++){ const bar = S.bar0 + b; let set;
      if (si < firstMain) set = new Set(order.filter(r => entry[r] <= bar && (r !== 'top' || entry.top < rampEnd)));
      else if (S.name === 'drop' || S.name === 'hook') set = new Set(all);
      else if (S.name === 'verse') set = new Set([...all].filter(r => r !== 'top' || verseTop));
      else if (S.name === 'break'){ set = new Set(['chords', 'tex'].filter(r => all.has(r))); for (const r in brk) if (brk[r] && all.has(r)) set.add(r); if (!set.size) set.add(ROLES[0]); }
      else if (S.name === 'build'){ const prev = act[S.bar0 - 1] || new Set(); const back = order.filter(r => !prev.has(r)); const nIn = Math.ceil(back.length * (b + 1) / S.bars); set = new Set([...prev, ...back.slice(0, nIn)]); if (b < S.bars - 1 || !all.has('kick')) set.delete('kick'); if (b === S.bars - 1 && all.has('kick')) set.add('kick'); }
      else { const nOut = Math.floor(order.length * b / S.bars); const gone = order.slice().reverse().slice(0, nOut); set = new Set([...all].filter(r => gone.indexOf(r) < 0)); if (!set.size) set.add(order[0]); }
      act[bar] = set; } });
    const fills = wShuffle(A, ['roll', 'tom', 'gap', 'hatroll', 'kickroll'], {roll: 2, tom: G.drums === 'synthwave' ? 4 : 1, gap: 1.5, hatroll: G.drums === 'trap' ? 4 : 1, kickroll: 1}).slice(0, 2); let fillN = 0;
    const beatDrop = loopy && A() < .55;
    // ---------- parts
    const T = (gs, s) => gs * ST + ((s & 1) ? (p.swing - .5) * 2 * ST : 0) + ((s & 3) ? (V() * 2 - 1) * p.humanize * .007 : 0);
    const ev = [], kicks = []; let seq = 0; const add = o => { o.seed = hashSeed(p.seed, p.vary, seq++); ev.push(o); return o; };
    const GN = {kick: 1, snare: .42, hat: .12, open: .1, x: .1, perc: .22, bass: .72, chords: .22, top: .24, vox: .24, tex: .28, rumble: .45, impact: .5, riser: .2};
    // levels calibrated by soloing each role across seeds: chords ≈ −10 dB and the top line ≈ −10 dB under the drums, bass a few dB under
    const CHM = {dub: 7, stab: 6, organ: 5, comp: 1.6, pad: 2, gated: 2, piano: 1.25}; GN.chords *= CHM[part.chords] || 1; GN.top = .5; GN.vox = .36; GN.hat = .16; GN.open = .13;
    if (kitK === 'boom') GN.kick = .85; if (part.bass === 'b808'){ GN.bass = .5; GN.kick = .85; } if (G === GS.lofi) GN.bass *= .55;
    // bass
    const BP = {acid: {kind: 'acid', cut: rr(R, 220, 480), env: rr(R, 3, 7), res: rr(R, 5, 11), fdec: rr(R, .12, .3), dec: .5, sus: .75, sq: R() < .3, glide: .05, rel: .02, gain: .9},
      square: {kind: 'square', cut: 1.5, famt: rr(R, 4, 10), res: 1.2, fdec: .08, dec: .18, sus: .4, rel: .03, gain: .8}, rolling: {kind: pick(R, ['square', 'saw']), cut: 1.4, famt: rr(R, 3, 8), res: 1.1, fdec: .06, dec: .12, sus: .2, rel: .02, gain: .85},
      octave: {kind: 'saw', cut: 1.6, famt: rr(R, 3, 8), res: 1, fdec: .1, dec: .2, sus: .35, rel: .04, gain: .8}, reese: {kind: 'reese', det: rr(R, .005, .012), cut: rr(R, 300, 650), lfo: rr(R, .15, .5), atk: .02, dec: 1, sus: .9, rel: .12, glide: .12, gain: .85},
      b808: {kind: 'b808', drive: rr(R, 1.5, 3.2), dropSemi: rr(R, 1, 3), drop: .03, atk: .002, dec: rr(R, .7, 1.4), sus: 0, rel: .08, glide: .07, gain: 1}, sub: {kind: 'sub', atk: .01, dec: .6, sus: .85, rel: .08, glide: .05, gain: 1.1},
      garage: {kind: 'garage', famt: rr(R, 3, 7), wob: pick(R, [1, 2]) / beat, res: 1.4, dec: .3, sus: .6, rel: .04, glide: .05, gain: .8}, walking: {kind: 'upright', atk: .004, dec: .35, sus: .25, rel: .06, gain: 1.15},
      offbeat: {kind: pick(R, ['saw', 'sub', 'square']), cut: 1.3, famt: rr(R, 2, 6), res: .9, fdec: .1, dec: .25, sus: .5, rel: .04, gain: .9}, log: {kind: 'log', dropSemi: rr(R, 5, 9), drop: .03, dec: rr(R, .25, .45), sus: 0, rel: .05, glide: .06, gain: .95}}[part.bass] || {kind: 'sub', gain: 1};
    const bPat = BPAT[part.bass] ? parsePat(pick(V, BPAT[part.bass])) : null;
    const acidSeq = Array.from({length: 16}, (_, s) => ({on: s === 0 || V() < .68, d: pick(V, [0, 0, 0, 7, 2, 4, 6, -1]), o: V() < .22 ? 12 : 0, acc: V() < .3, slide: V() < .25}));
    const subPulse = A() < .5, reeseStab = A() < .5;
    let mono = [], monoStart = 0; const flushMono = endBar => { if (mono.length){ const t0 = monoStart * BT, len = endBar * BT - t0;
        const cutAt = part.bass === 'acid' ? (tt => { const b = clamp(Math.floor((t0 + tt) / BT), 0, NB - 1), e = energy(b); return (.35 + 1.4 * e) * (1 + .5 * LZ[b * 16]); }) : null;
        add({inst: 'mono', t: t0, len, notes: mono.map(n => Object.assign({}, n, {t: n.t - t0, dur: Math.min(n.dur, len - (n.t - t0))})), p: BP, cutAt, bus: 'bass', pan: 0, v: GN.bass}); } mono = []; };
    // chords
    const SP = {stab: {kind: 'saw', cut: rr(R, 500, 1100), famt: rr(R, 3, 8), res: rr(R, .7, 1.5), fdec: rr(R, .05, .14), dec: rr(R, .12, .3), sus: 0, rel: .05, det: rr(R, .003, .008)},
      dub: {kind: 'dub', cut: rr(R, 700, 1500), res: rr(R, 1, 1.8), fdec: rr(R, .05, .12), dec: rr(R, .08, .16), sus: 0, rel: .04},
      organ: {kind: 'organ', bars: pick(R, [[1, 1, .6, .5, 0, .3], [1, .8, 0, .6, .4, 0], [.8, 1, .7, .3, .3, .2]]), dec: rr(R, .2, .5), sus: rr(R, .3, .6), rel: .04},
      comp: {kind: 'epiano', fm: {inst: 'fm', ratio: 1, ratio2: 14, index: rr(R, 1, 1.8), index2: rr(R, .3, .9), indexSus: .2, idecay: rr(R, .15, .35), atk: .002, dec: rr(R, .6, 1.2), sus: .15, rel: .25}, rel: .3},
      piano: {kind: 'piano', fm: {inst: 'fm', ratio: 1, index: rr(R, .6, 1.2), indexSus: .1, idecay: rr(R, .2, .5), atk: .003, dec: rr(R, .8, 1.6), sus: .05, rel: .4, fb: .1}, rel: .4}}[part.chords];
    const PADP = pick(R, [{kind: 'supersaw', det: rr(R, 7, 18), cut: rr(R, 800, 2000) * (.5 + p.bright), res: rr(R, .6, 1), atk: rr(R, .3, 1.2), rel: rr(R, .8, 2)}, {kind: 'fmpad', ratio: pick(R, [1, 2, .5]), index: rr(R, .4, 1.4), lfo: rr(R, .04, .2), det: rr(R, 3, 8), atk: rr(R, .4, 1.5), rel: rr(R, 1, 2.5)},
      {kind: 'additive', tilt: rr(R, 1, 1.6) - p.bright * .4, stretch: rr(R, 0, .001), shimmer: rr(R, .05, .35), atk: rr(R, .5, 1.5), rel: rr(R, 1, 2.5)}]);
    if (part.chords === 'gated') { PADP.kind = 'supersaw'; PADP.atk = .01; PADP.det = PADP.det || 12; PADP.cut = PADP.cut || 1600; PADP.res = PADP.res || .8; PADP.rel = .3; }
    const cPat = CPAT[part.chords] ? [parsePat(pick(V, CPAT[part.chords])), parsePat(pick(V, CPAT[part.chords]))] : null;
    const gatePat = parsePat(pick(V, ['x.xxx.xxx.x.xxx.', 'xx.xx.xx.xx.x.x.', 'x.x.xxx.x.x.xx.x'])).map(q => q ? 1 : 0);
    // top line
    const topInst = part.top === 'lead' ? pickW(R, {sawlead: 2, fmlead: 2}) : part.top === 'riff' ? pickW(R, G.drums === 'trap' ? {pluck: 2, flute: 2, saw: 1} : {pluck: 2, saw: 2, fm: 1, square: 1}) : pickW(R, {saw: 2, pluck: 2, epiano: 1});
    const TP = {pluck: {inst: 'string', t60: rr(R, .8, 2), bright: rr(R, .4, .85), rel: .08}, saw: {inst: 'saw', cut: rr(R, 1.4, 2.6), famt: rr(R, 3, 9) * (.4 + p.bright), fdec: rr(R, .06, .2), res: rr(R, .8, 2), atk: .003, dec: rr(R, .15, .4), sus: .25, rel: .1, det: .005},
      square: {inst: 'saw', sq: true, cut: rr(R, 1.4, 2.4), famt: rr(R, 3, 7), fdec: .12, res: 1, atk: .003, dec: .25, sus: .3, rel: .08, det: .004}, fm: {inst: 'fm', ratio: pick(R, [1, 2]), index: rr(R, 1, 2.4), indexSus: .4, idecay: .2, atk: .005, dec: .4, sus: .5, rel: .15},
      flute: {inst: 'fm', ratio: 1, index: rr(R, .3, .6), indexSus: .25, idecay: .3, atk: .035, dec: .5, sus: .7, rel: .18, vib: .006},
      sawlead: {inst: 'saw', cut: 2.2, famt: rr(R, 3, 7) * (.4 + p.bright), fdec: .3, res: rr(R, .8, 1.8), atk: .015, dec: .5, sus: .7, rel: .25, vib: .0045, det: .006}, fmlead: {inst: 'fm', ratio: pick(R, [1, 2]), index: rr(R, 1.2, 2.6), indexSus: .8, idecay: .4, atk: .015, dec: .45, sus: .7, rel: .25, vib: .004, fb: rr(R, 0, .4)},
      epiano: {inst: 'fm', ratio: 1, ratio2: 14, index: rr(R, 1, 2), index2: .6, indexSus: .2, idecay: .3, atk: .002, dec: .8, sus: .1, rel: .3}}[topInst];
    const topBase = part.top === 'lead' ? 62 : topInst === 'pluck' || topInst === 'flute' ? 67 : 64;
    const makeRiff = (r, len, longNotes) => { const k = longNotes ? 3 + Math.floor(r() * 3) : len === 16 ? 3 + Math.floor(r() * 4) : 5 + Math.floor(r() * 5), rot = Math.floor(r() * 4) * (longNotes ? 4 : 1);
      const pos = euclid(k, len, rot).map((v, i) => v ? i : -1).filter(i => i >= 0); let d = pick(r, [0, 2, 4]);
      const notes = pos.map((s, i) => { const nt = {s, d, v: i === 0 ? 1 : .75 + r() * .25}; d = clamp(d + +pickW(r, {'0': 1.5, '1': 3, '-1': 3, '2': 1.5, '-2': 1.5, '3': .5, '-3': .5, '4': .4}), -2, 9); return nt; });
      notes.forEach((n, i) => n.len = Math.max(1, (i + 1 < notes.length ? notes[i + 1].s : len) - n.s)); return {len, notes}; };
    const mutate = (m, r) => { const c = {len: m.len, notes: m.notes.map(n => Object.assign({}, n))}; const half = c.notes.filter(n => n.s >= c.len / 2); half.forEach(n => { if (r() < .4 + .5 * p.develop) n.d = clamp(n.d + pick(r, [-2, -1, 1, 2, 3]), -2, 10); }); return c; };
    const riffA = makeRiff(V, part.top === 'lead' ? 32 : pick(V, [16, 16, 32]), part.top === 'lead'), riffB = mutate(riffA, V);
    const vPat = parsePat(pick(V, VPAT)), vowels = Array.from({length: 4}, () => pick(R, ['a', 'o', 'e', 'u', 'i'])), voxP = {shift: rr(R, .9, 1.25)};
    const arpCfg = {pat: pick(V, ['up', 'down', 'updown', 'thirds']), plen: pick(V, [3, 4, 5, 6]), rate: p.arpRate === 8 || G.drums === 'synthwave' && V() < .5 ? 2 : 1, gate: euclid(Math.round(lerp(6, 14, p.density)), 16, Math.floor(V() * 16))}; let arpN = 0;
    // ---------- the bar loop
    for (let bar = 0; bar < NB; bar++){
      const S = secOf(bar), k = (bar - S.bar0) / S.bars, e = energy(bar), ch = chordBar[bar], set = act[bar], last = bar === S.bar0 + S.bars - 1, nextS = secOf(bar + 1);
      const change = last && bar + 1 < NB && nextS !== S, fill = change && (set.has('kick') || set.has('snare')) && !(fx.tapestop && /drop|hook/.test(nextS.name)) ? fills[fillN++ % fills.length] : null;
      const dyn = clamp(.4 + .6 * e, .3, 1), dens = p.density * (.55 + .45 * e), alt = S.name === 'break' || S.name === 'hook' || (S.name === 'drop' && S.idx > firstMain) ? 1 : 0;
      const bright = clamp(.3 + .6 * e + .15 * LZ[bar * 16], .15, 1.1), dropOut = beatDrop && S.name === 'verse' && (bar - S.bar0) % 8 === 7;
      for (let s = 0; s < 16; s++){ const gs = bar * 16 + s, t = T(gs, s), lg = LOG[gs], gap = (fill === 'gap' && s >= 12) || (dropOut && s >= 8);
        if (gap) continue;
        const hit = (q, ghostOK) => { if (!q) return 0; if (q.ghost && (lg < .45 - .35 * p.chaos || !ghostOK)) return 0; if (q.ch && lg > .25 + .55 * dens) return 0; return q.v * (.9 + .2 * lg); };
        // kick (+ rumble), fills
        if (set.has('kick')){ let v = hit(DP.k[alt][s], true); if (fill === 'kickroll' && s >= 12) v = s % 2 === 0 ? .8 : .5;
          if (v){ add({inst: 'kick', t, v: v * GN.kick * dyn, p: KICK, bus: 'drums'}); if (v >= .6) kicks.push(t); if (kitK === 'rumble' && v >= .6) add({inst: 'rumble', t: t + .01, v: GN.rumble * dyn, dur: beat * .9, bus: 'drums', sv: .1}); } }
        if (set.has('snare')){ const q = DP.s[alt][s], v = hit(q, true);
          if (v){ const big = kitS === 'big', throwIt = fx.dubthrow && v > .7 && lg > .82;
            if (kitS === 'rim') add({inst: 'perc', t, v: v * GN.snare * .8, f: rimF, body: 'wood', decay: .5, hard: .9, bus: 'drums', pan: .1, sv: .2, sd: throwIt ? .9 : 0});
            else { add({inst: 'snare', t, v: v * GN.snare * dyn, p: Object.assign({}, SN, {clap: kitS === 'clap' || kitS === 'trap'}), bus: 'drums', sv: big ? .85 : .22, sd: throwIt ? .9 : 0}); if (kitS === 'trap' && v > .6) add({inst: 'snare', t: t + .004, v: v * GN.snare * .6, p: Object.assign({}, SN, {clap: false, noise: .08}), bus: 'drums', sv: .2}); } }
          if (fill === 'roll' && s >= 8) add({inst: 'snare', t, v: (.25 + .6 * (s - 8) / 7) * GN.snare, p: Object.assign({}, SN, {clap: false}), bus: 'drums', sv: .3}); }
        if (fill === 'tom' && s >= 10 && (s % 2 === 0 || s >= 14)) add({inst: 'perc', t, v: .7 * GN.perc * 2, f: 190 - (s - 10) * 18, body: 'membrane', decay: .9, hard: .8, bus: 'drums', pan: (s - 12) * .2, sv: .3});
        if (set.has('hat')){ const q = DP.h[alt][s];
          if (q && q.roll){ for (let r = 0; r < rollN; r++) add({inst: kitH === 'shaker' ? 'shaker' : 'hat', t: t + r * ST / rollN, v: (.45 + .4 * r / rollN) * GN.hat * dyn, p: HAT, dec: .04, bus: 'drums', pan: .3 * p.width}); }
          else { const v = hit(q, true); if (v) add({inst: kitH === 'shaker' ? 'shaker' : 'hat', t, v: v * GN.hat * dyn * [1, .7, .85, .7][s & 3], p: HAT, dec: .05, bus: 'drums', pan: (s & 2 ? .5 : -.5) * p.width}); }
          const vo = hit(DP.o[alt][s], true); if (vo && kitH !== 'shaker') add({inst: 'hat', t, v: vo * GN.open * dyn, open: true, p: HAT, bus: 'drums', pan: -.3 * p.width, sv: .1});
          if (fill === 'hatroll' && s >= 12) for (let r = 0; r < 3; r++) add({inst: 'hat', t: t + r * ST / 3, v: (.4 + .15 * (s - 12)) * GN.hat, p: HAT, bus: 'drums', pan: .2}); }
        if (set.has('x')){ const v = hit(DP.x[alt][s], true); if (v){ if (D.xi === 'ride') add({inst: 'hat', t, v: v * GN.x * .8, open: true, p: RIDE, bus: 'drums', pan: .45 * p.width, sv: .12}); else add({inst: 'shaker', t, v: v * GN.x * dyn, dec: .045, bus: 'drums', pan: .35 * p.width}); } }
        if (set.has('perc')){ const v = hit(DP.p[alt][s], true); if (v){ const throwIt = fx.dubthrow && lg > .88;
            if (kitP === 'rim') add({inst: 'perc', t, v: v * GN.perc, f: rimF, body: 'wood', decay: .5, hard: .9, bus: 'drums', pan: (lg - .5) * 1.2 * p.width, sv: .15, sd: throwIt ? .8 : .08 * p.delay});
            else if (kitP === 'tom') add({inst: 'perc', t, v: v * GN.perc * 1.6, f: pick(V, [95, 120, 150]), body: 'membrane', decay: .7, hard: .7, bus: 'drums', pan: (lg - .5) * p.width, sv: .2});
            else add({inst: 'perc', t, v: v * GN.perc * 1.5, f: mtof(dmidi(ch.root + Math.floor(lg * 3) * 2, congaBase)), body: 'membrane', decay: .55, hard: .6, bus: 'drums', pan: (lg - .5) * 1.4 * p.width, sv: .15, sd: throwIt ? .7 : 0}); } }
        // ---- bass: notes gathered into a legato phrase
        if (set.has('bass') && !(fill === 'gap' && s >= 12)){ const pb = part.bass, root = ch.bass, dur = n => n * ST; let note = null;
          if (pb === 'offbeat'){ if ((s & 3) === 2) note = {m: root + (s === 14 && lg > .75 ? 12 : 0), dur: dur(1.5)}; }
          else if (pb === 'garage' || pb === 'log'){ const q = bPat[s]; if (q){ const iv = pick(V, [0, 0, 0, 12, 7]); note = {m: (pb === 'log' ? root + 12 : root) + (iv === 7 ? (dpc(ch.root + 4) - dpc(ch.root) + 12) % 12 : iv), dur: dur(pb === 'log' ? 2.5 : 1.6), slide: q.slide, acc: q.v >= 1}; } }
          else if (pb === 'sub'){ if (s === 0 && bar === ch.bar) note = {m: root, dur: Math.min(ch.bars, 2) * BT - ST * .5}; else if (subPulse && s === 10 && e > .6) note = {m: root, dur: dur(1.2), v: .8}; }
          else if (pb === 'rolling'){ if (s % 4 !== 0) note = {m: root + ((s % 4 === 2) && lg > .6 ? 12 : 0), dur: dur(.8), v: s % 4 === 2 ? 1 : .8}; }
          else if (pb === 'acid'){ const st = acidSeq[s]; if (st.on){ if (bar % 4 === 3 && s === 15 - (bar % 8)) st.d = pick(V, [0, 2, 4, 7]); note = {m: dmidi(ch.root + st.d, 36) + st.o, dur: dur(st.slide ? 1.1 : .55), acc: st.acc, slide: st.slide}; } }
          else if (pb === 'square'){ const kq = DP.k[alt][s]; if (kq || ((s === 7 || s === 13) && lg > .55)) note = {m: root + (s % 4 === 2 ? 12 : 0), dur: dur(1)}; }
          else if (pb === 'reese'){ if (s === 0 && bar === ch.bar) note = {m: root > 40 ? root - 12 : root, dur: ch.bars * BT - ST * .3, slide: true}; else if (reeseStab && s === 10 && (bar - ch.bar) % 2 === 1) note = {m: root > 40 ? root - 12 : root, dur: dur(4), acc: true}; }
          else if (pb === 'b808'){ const kq = DP.k[alt][s], rt = root > 40 ? root - 12 : root; if (kq){ let nx = 16; for (let j = s + 1; j < 16; j++) if (DP.k[alt][j]){ nx = j; break; } const up = lg > .8 ? 12 : lg < .12 ? 7 : 0; note = {m: rt + (up === 7 ? (dpc(ch.root + 4) - dpc(ch.root) + 12) % 12 : up), dur: dur(nx - s) - .01, slide: up !== 0 && V() < .5}; } }
          else if (pb === 'walking'){ if (s % 4 === 0){ const bt = s >> 2, nx = chordBar[Math.min(NB - 1, bar + 1)], tones = ch.pcs.map(pc => 45 + ((pc - 45) % 12 + 12) % 12).sort((a, b) => a - b);
              const m = bt === 0 ? root + 12 : bt === 3 ? (nx.bass + 12) + (lg > .5 ? 1 : -1) : tones[Math.min(tones.length - 1, bt)]; note = {m, dur: dur(3.6)}; } }
          else if (pb === 'octave'){ if (s % 2 === 0) note = {m: root + ((s >> 1) % 2 ? 12 : 0), dur: dur(1.5)}; }
          if (note){ if (!mono.length) monoStart = bar; note.t = t; mono.push(note); } }
        // ---- chords
        if (set.has('chords') && cPat){ const q = cPat[alt][s]; if (q && !(fill === 'gap' && s >= 12)){ const pc = part.chords; let nx = 16; for (let j = s + 1; j < 16; j++) if (cPat[alt][j]){ nx = j; break; }
            const dur = pc === 'comp' ? Math.min(8, nx - s) * ST * .95 : pc === 'piano' ? rr(V, 1.5, 3) * ST : pc === 'organ' ? rr(V, 1, 1.6) * ST : pc === 'dub' ? .11 : rr(V, .7, 1.2) * ST;
            const notes = pc === 'comp' || pc === 'piano' ? ch.voicing : ch.voicing.slice(0, 4), throwIt = fx.dubthrow && lg > .8;
            add({inst: 'stab', t, v: q.v * GN.chords * (.6 + .4 * dyn), notes, dur, p: SP, bright, bus: 'duck', sv: pc === 'dub' ? .55 : .3, sd: throwIt ? 1 : pc === 'dub' ? .8 : pc === 'stab' ? .3 * p.delay + .1 : .15 * p.delay}); } }
        // ---- top line
        if (set.has('top')){ const pt = part.top;
          if (pt === 'riff' || pt === 'lead'){ const len = riffA.len, ph = Math.floor((gs - S.bar0 * 16) / len), rel = (gs - S.bar0 * 16) % len, rf = ph % 4 === 3 ? riffB : riffA;
            for (const nt of rf.notes) if (nt.s === rel){ let mn = dmidi(ch.root + nt.d, topBase); while (mn > 86) mn -= 12; while (mn < 52) mn += 12;
              add({inst: TP.inst, t, v: nt.v * GN.top * (pt === 'lead' ? 1.6 : 1) * (S.name === 'verse' ? .8 : 1), f: mtof(mn), dur: Math.min(nt.len, pt === 'lead' ? 12 : 4) * ST * .92, p: TP, bright: bright * 1.1, bus: 'duck', pan: .1, sv: .3, sd: .4 * p.delay}); } }
          else if (pt === 'vox'){ const q = vPat[s]; if (q && (lg > .2 || q.v >= 1)){ const tones = ch.voicing.map(m => { while (m < 63) m += 12; while (m > 79) m -= 12; return m; }).sort((a, b) => a - b), mn = tones[(Math.floor(gs / 3) + (lg > .6 ? 1 : 0)) % tones.length];
              add({inst: 'vox', t, v: q.v * GN.vox, f: mtof(mn), vowel: vowels[(gs >> 2) % vowels.length], dur: (lg > .7 ? 2 : 1) * ST * .9, p: voxP, bus: 'duck', pan: (lg - .5) * .8 * p.width, sv: .35, sd: .5 * p.delay + .1}); } }
          else if (pt === 'arp' && s % arpCfg.rate === 0 && arpCfg.gate[s] && (e > .45 || lg > .3)){ const pool = ch.voicing.concat(ch.voicing.map(m => m + 12)).sort((a, b) => a - b), n = arpN++, ci = n % arpCfg.plen, cyc = Math.floor(n / arpCfg.plen), P = pool.length;
            let ix = arpCfg.pat === 'up' ? (ci + cyc) % P : arpCfg.pat === 'down' ? P - 1 - (ci + cyc) % P : arpCfg.pat === 'thirds' ? (ci * 2 + cyc) % P : (() => { const per = Math.max(1, 2 * P - 2), q = (ci + cyc * 2) % per; return q < P ? q : per - q; })();
            let mn = pool[clamp(ix, 0, P - 1)]; if (mn < 60) mn += 12; while (mn > 84) mn -= 12;
            add({inst: TP.inst, t, v: (.6 + .4 * lg) * GN.top * .55, f: mtof(mn), dur: arpCfg.rate * ST * (.6 + .8 * lg), p: TP, bright, bus: 'duck', pan: clamp((ci / Math.max(1, arpCfg.plen - 1) - .5) * 1.5 * p.width, -1, 1), sv: .25, sd: .35 * p.delay}); } }
      }
      // phrase boundary for the bass line: every 4 bars, at section edges, or when the bass drops out
      const nextSet = act[bar + 1]; if (bar + 1 >= NB || (bar + 1) % 4 === 0 || nextS !== S || !nextSet || !nextSet.has('bass')) flushMono(bar + 1);
      // sustained chord voices
      if (set.has('chords') && (part.chords === 'pad' || part.chords === 'gated') && bar === ch.bar){ const len = ch.bars * BT;
        add({inst: 'pad', t: bar * BT, v: GN.chords * (part.chords === 'gated' ? 1.1 : .9), notes: ch.voicing, dur: len, p: PADP, bright, mod: LZ.subarray(bar * 16, Math.min(NSTEP, (bar + ch.bars) * 16 + 16)), modT: ST, gate: part.chords === 'gated' ? gatePat : null, gateST: ST, bus: 'duck', sv: .45}); }
      if (set.has('tex') && (bar === S.bar0 || (act[bar - 1] && !act[bar - 1].has('tex')))){ let nb = 0; while (bar + nb < NB && secOf(bar + nb) === S) nb++;
        add({inst: 'tex', t: bar * BT, v: GN.tex * (part.tex === 'crackle' ? .9 : S.name === 'drop' ? .5 : 1), dur: nb * BT, p: {kind: part.tex, density: 12, fm: .5, q: 6, rate: 1 + p.chaos}, root: dmidi(ch.root, 36), chordAt: tt => chordBar[clamp(Math.floor(tt / BT), 0, NB - 1)].voicing, mod: LZ.subarray(bar * 16, Math.min(NSTEP, (bar + nb) * 16 + 16)), modT: ST, bus: 'duck', sv: .5}); }
      if (fx.lofi && bar === 0) add({inst: 'tex', t: 0, v: .22, dur: NB * BT, p: {kind: 'crackle', rate: 1}, bus: 'duck', sv: 0});
      if (bar === S.bar0 && /drop|hook/.test(S.name) && bar > 0 && act[bar].has('kick')) add({inst: 'impact', t: bar * BT, v: GN.impact, bus: 'drums', sv: .45});
      if (S.name === 'build' && nextS !== S && bar === S.bar0 + S.bars - Math.min(4, Math.max(2, S.bars >> 2)) && !fx.tapestop){ const nb = S.bar0 + S.bars - bar; add({inst: 'riser', t: bar * BT, v: GN.riser, dur: nb * BT - ST * 2, bus: 'duck', sv: .5}); }
    }
    flushMono(NB);
    const meta = {bpm: p.bpm, key: NOTE[tonic] + ' ' + p.mode, style: p.style, styleName: G.name, rhythm: G.drums, form: formK, palette: part, kit: kitK + '/' + kitS + '/' + kitH, fx: Object.keys(fx).filter(k => fx[k]), bars: NB, duration: NB * BT,
      sections: secs.map(s => ({name: s.name, bar0: s.bar0, bars: s.bars, e: s.e, eTo: s.eTo, chords: chords.filter(c => c.bar >= s.bar0 && c.bar < s.bar0 + s.bars)})),
      events: ev.length, loop: loopA.map(c => c.name).join(' – '), poly: '', motif: '', bassStyle: part.bass};
    return {events: ev, kicks, beat, BT, duration: NB * BT, meta, fx, fxp: fxPlan(secs, NB, BT, beat, fx, FXR)};
  }

  // =========================================================== styles and randomiser
  // each style is a set of ranges that make sense together; a roll stays inside one style. These run on the evolving engine;
  // the genre styles (GS) are loop grammars and are only reached by choosing them explicitly.
  const STYLES = {
    cooper: {name: 'emergence — evolving, Max Cooper-leaning', w: 6, bpm: [116, 128], rhythm: {four: 4, drive: 3, broken: 3, ca: 1}, form: {cooper: 4, steps: 3, rise: 1, twin: 1}, mode: {minor: 6, dorian: 1, major: 1, lydian: .5}, color: [.05, .4], motion: [.1, .5], develop: [.4, .75], chaos: [.2, .5], poly: [.55, .95], density: [.6, .85], bright: [.4, .62], metal: [.1, .4], swing: [.53, .62], humanize: [.15, .4], pump: [.2, .5], drive: [.15, .4], verb: [.45, .7], delay: [.35, .6], width: [.9, 1], keysPeak: .05, leadW: .35, vamp: true,
      pal: {arp: {synth: 5, blip: 2, saw: 2}, lead: {synth: 3, sawlead: 1.5, fmlead: 1}, pad: {lush: 4, fmpad: 3, additive: 1, supersaw: 2}, keys: {felt: 4, glass: .5, epiano: 0}, tex: {glitch: 3, grains: 3, wind: 2, chaos: 1.5, crackle: 0}, bass: {sub: 3, fm: 2, subsaw: 3}}, fx: {sweep: 3, reverse: 2, stutter: 3, chorus: 1, tape: 1}},
    cinematic: {vamp: false, name: 'cinematic', w: 2, bpm: [104, 122], rhythm: {broken: 2, four: 1, half: 1}, form: {rise: 2, arc: 2}, mode: {minor: 2, lydian: 1, dorian: 1, major: 1}, color: [.3, .7], keysPeak: .5, pal: {arp: {synth: 4, blip: 2, saw: 1}, lead: {synth: 3, sawlead: 1}, keys: {felt: 3, glass: 1}}, develop: [.5, .85], motion: [.35, .7], chaos: [.15, .4], verb: [.55, .8], width: [.85, 1], pump: [.1, .35], drive: [.05, .25], metal: [.1, .4], fx: {reverse: 2, sweep: 2, chorus: 1, tape: 1}},
    broken: {vamp: false, name: 'broken beat / IDM', w: 2, bpm: [120, 138], rhythm: {broken: 4, ca: 2}, form: {arc: 2, twin: 2, steps: 2, rise: 1}, mode: {minor: 2, dorian: 2, pentMinor: 1, lydian: 1}, swing: [.55, .64], density: [.5, .75], pump: [.15, .4], drive: [.15, .45], color: [.15, .55], motion: [.2, .6], develop: [.5, .85], chaos: [.35, .7], poly: [.55, .9], humanize: [.3, .6], fx: {stutter: 3, crush: 2, phaser: 1, sweep: 1}},
    deep: {vamp: false, name: 'deep house (evolving)', w: 2, bpm: [118, 125], rhythm: {four: 5, broken: 1}, form: {arc: 2, twin: 2, rise: 1}, mode: {minor: 3, dorian: 3, mixolydian: 1}, swing: [.53, .6], density: [.5, .72], pump: [.35, .6], drive: [.15, .4], color: [.45, .8], motion: [.3, .6], chaos: [.15, .4], metal: [.1, .3], keysPeak: .5, pal: {arp: {synth: 3, saw: 2, blip: 1}, keys: {felt: 2, epiano: 1}}, fx: {chorus: 2, tape: 2, sweep: 2, dubthrow: 1}},
    technoE: {name: 'techno (evolving)', w: 2, bpm: [126, 134], rhythm: {drive: 3, four: 3, ca: 1}, form: {rise: 2, arc: 2, twin: 1}, mode: {minor: 3, phrygian: 2, harmonicMinor: 1}, swing: [.5, .54], density: [.6, .85], pump: [.4, .7], drive: [.3, .6], color: [.05, .35], motion: [.05, .3], develop: [.3, .6], chaos: [.3, .6], bright: [.35, .6], metal: [.2, .5], verb: [.35, .6], keysPeak: 0, leadW: .4, vamp: true, form: {steps: 3, rise: 2, cooper: 1}, pal: {arp: {saw: 3, synth: 4, blip: 1}, lead: {sawlead: 2, fmlead: 2, synth: 2}, tex: {glitch: 3, chaos: 2, wind: 1}}, fx: {sweep: 3, stutter: 2, crush: 1, phaser: 1}},
    halftime: {vamp: false, name: 'downtempo', w: 1.5, bpm: [84, 100], rhythm: {half: 1}, form: {arc: 2, twin: 1, rise: 1}, mode: {minor: 3, harmonicMinor: 1, dorian: 1, pentMinor: 1}, swing: [.54, .62], density: [.4, .62], pump: [.2, .45], drive: [.2, .5], color: [.2, .55], motion: [.3, .6], verb: [.4, .65], fx: {tape: 2, lofi: 1, reverse: 1, sweep: 1}},
    ambient: {vamp: false, name: 'ambient', w: 1, bpm: [70, 100], bars: [64, 80, 96], rhythm: {none: 1}, form: {ambient: 1}, mode: {major: 1, lydian: 2, dorian: 1, minor: 1}, density: [.3, .5], pump: [0, .1], drive: [0, .2], verb: [.65, .9], delay: [.4, .7], color: [.35, .8], motion: [.2, .5], chaos: [.2, .45], swing: [.5, .55], keysPeak: .6, pal: {arp: {blip: 3, synth: 2}, keys: {felt: 3, glass: 1}}, fx: {chorus: 2, tape: 2, phaser: 1}}};
  const ALL = Object.assign({}, STYLES, GS);
  const GEN = {swing: [.5, .56], density: [.45, .75], pump: [.2, .5], drive: [.1, .4], color: [.1, .5], motion: [.25, .65], develop: [.4, .8], chaos: [.2, .55], poly: [.4, .85], bright: [.4, .62], metal: [.1, .4], humanize: [.25, .6], verb: [.4, .7], delay: [.25, .55], width: [.8, 1]};
  // full = every dial; otherwise the song's identity (style, seed, key, mode, tempo, groove, swing, form, length, sounds, effects) and the user's other dials stay
  function randomize(cur, full, rnd){ const r = rnd || Math.random, o = JSON.parse(JSON.stringify(Object.assign({}, DEF, cur || {})));
    const others = Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, k === o.style && !full ? 0 : v.w]));   // New piece moves to another style 3 times in 4
    const sk = !full && STYLES[o.style] && r() < .25 ? o.style : pickW(r, others), S = STYLES[sk];
    o.style = sk; o.seed = 1 + Math.floor(r() * 999998); o.vary = 0; o.tonic = Math.floor(r() * 12); o.mode = pickW(r, S.mode); o.melody = 'auto';
    o.bpm = Math.round(rr(r, S.bpm[0], S.bpm[1])); o.rhythm = S.rhythm ? pickW(r, S.rhythm) : 'auto'; o.form = pickW(r, S.form); o.palette = {}; o.fx = null;
    o.bars = pick(r, S.bars || [96, 112, 112, 128, 144]); const sw = S.swing || GEN.swing; o.swing = +rr(r, sw[0], sw[1]).toFixed(2);
    if (full){ for (const k in GEN){ if (k === 'swing') continue; const g = S[k] || GEN[k]; o[k] = +rr(r, g[0], g[1]).toFixed(2); }
      o.arpRate = o.bpm > 128 || r() < .25 ? 8 : 16; o.layers = Object.assign({}, DEF.layers); if (sk === 'ambient'){ o.layers.kick = o.layers.snare = o.layers.hat = 0; } }
    else if (o.rhythm !== 'none' && !o.layers.kick && !o.layers.snare && !o.layers.hat) Object.assign(o.layers, {kick: 1, snare: 1, hat: 1});   // leaving an ambient roll brings the drums back
    return o; }

  // =========================================================== mastering tools
  // glue compressor: RMS detector, soft knee, slow enough to breathe with the bar rather than chew the transients
  function glue(L, R, sr, thrDb, ratio, kneeDb, atkS, relS){ const n = L.length, BK = 32, dk = 1 - Math.exp(-1 / (.02 * sr / BK)), ak = 1 - Math.exp(-1 / (atkS * sr / BK)), rk = 1 - Math.exp(-1 / (relS * sr / BK)); let rms = 1e-6, grDb = 0, maxGr = 0, gPrev = 1;
    for (let b = 0; b < n; b += BK){ const e0 = Math.min(n, b + BK); let s = 0; for (let i = b; i < e0; i++){ const x = (L[i] + R[i]) * .5; s += x * x; } rms += (s / (e0 - b) - rms) * dk;
      const lv = 10 * Math.log10(rms + 1e-12), over = lv - thrDb; let gr = 0;
      if (over > kneeDb / 2) gr = over * (1 - 1 / ratio); else if (over > -kneeDb / 2){ const q = over + kneeDb / 2; gr = (1 - 1 / ratio) * q * q / (2 * kneeDb); }
      grDb += (gr - grDb) * (gr > grDb ? ak : rk); if (grDb > maxGr) maxGr = grDb; const g = Math.pow(10, -grDb / 20), dg = (g - gPrev) / (e0 - b); let gi = gPrev;
      for (let i = b; i < e0; i++){ gi += dg; L[i] *= gi; R[i] *= gi; } gPrev = g; } return maxGr; }
  // look-ahead peak limiter: the gain needed over the next window is found with a monotone deque, reached ahead of the peak, released slowly
  function limiter(L, R, sr, ceil, lookS, relS){ const n = L.length, W = Math.max(2, Math.round(lookS * sr)), need = new Float32Array(n);
    for (let i = 0; i < n; i++){ const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = a > ceil ? ceil / a : 1; }
    const dq = new Int32Array(n + 1); let h = 0, t = 0, env = 1; const ak = 1 - Math.exp(-1 / (W * .3)), rk = 1 - Math.exp(-1 / (relS * sr));
    for (let i = 0; i < n; i++){ const j = Math.min(n - 1, i + W - 1); while (t > h && need[dq[t - 1]] >= need[j]) t--; dq[t++] = j; while (dq[h] < i) h++;   // dq holds indices of rising minima over [i, i+W)
      const gmin = need[dq[h]]; env += (gmin - env) * (gmin < env ? ak : rk); L[i] *= env; R[i] *= env;
      if (L[i] > ceil) L[i] = ceil; else if (L[i] < -ceil) L[i] = -ceil; if (R[i] > ceil) R[i] = ceil; else if (R[i] < -ceil) R[i] = -ceil; } }
  // loudness: RMS of the loudest half of 400 ms windows
  function loudHalf(L, R, sr){ const W = (.4 * sr) | 0, total = L.length, rms = []; for (let i = 0; i + W <= total; i += W){ let s = 0; for (let j = i; j < i + W; j += 4) s += L[j] * L[j] + R[j] * R[j]; rms.push(Math.sqrt(s / (W / 2))); }
    rms.sort((a, b) => b - a); const top = rms.slice(0, Math.max(1, rms.length >> 1)); return top.reduce((a, b) => a + b, 0) / top.length || 1e-6; }

  // =========================================================== render
  function render(p0, progress){
    const p = Object.assign({}, DEF, p0 || {}); p.layers = Object.assign({}, DEF.layers, (p0 && p0.layers) || {}); p.palette = Object.assign({}, (p0 && p0.palette) || {});
    const sr = p.sr || 44100, P = plan(p), ev = P.events.sort((a, b) => a.t - b.t), total = Math.ceil((P.duration + 4) * sr);
    const OL = new Float32Array(total), OR = new Float32Array(total), CH = 16384;
    const dL = new Float32Array(CH), dR = new Float32Array(CH), uL = new Float32Array(CH), uR = new Float32Array(CH), bL = new Float32Array(CH), bR = new Float32Array(CH), vS = new Float32Array(CH), dS = new Float32Array(CH), mL = new Float32Array(CH), mR = new Float32Array(CH);
    const verb = FDN(sr, .8 + p.verb * .9, 1.2 + p.verb * 4.5, .25 + (1 - p.bright) * .4), dly = PingPong(sr, P.beat * .75, .28 + p.delay * .38, 2200 + p.bright * 2500);
    const kickS = P.kicks.map(t => Math.round(t * sr)).sort((a, b) => a - b), depth = p.pump * .6, prel = .07 + (1 - p.density) * .05, scK = Math.exp(-1 / (prel * sr)), atkS = Math.max(1, .004 * sr); let ki = 0, scEnv = 0, scAt = -1e9;
    // bus tone: the music bus keeps out of the bass, the bass bus stays mono and warm, the reverb never carries mud or fizz
    const mhL = svf(), mhR = svf(); svfSet(mhL, 140, .6, sr); svfSet(mhR, 140, .6, sr); const bLP = svf(); svfSet(bLP, 2600, .55, sr); const vHP = svf(); svfSet(vHP, 230, .6, sr); const vLL = svf(), vLR = svf(); svfSet(vLL, 4500 + p.bright * 5000, .5, sr); svfSet(vLR, 4400 + p.bright * 5000, .5, sr);
    // master state
    const hpA = Math.exp(-TAU * 24 / sr), shA = 1 - Math.exp(-TAU * 4200 / sr), lsA = 1 - Math.exp(-TAU * 130 / sr), sdA = 1 - Math.exp(-TAU * 160 / sr), shelf = Math.pow(10, lerp(0, 4.5, p.bright) / 20), lshelf = Math.pow(10, 1.5 / 20), drv = 1 + Math.max(0, p.drive - .35) * 1.4;
    let hxL = 0, hyL = 0, hxR = 0, hyR = 0, lsL = 0, lsR = 0, lwL = 0, lwR = 0, sLo = 0;
    const active = []; let ei = 0; const CACHE = new Map();
    // ---- effect chain state (only what this piece uses runs)
    const FX = P.fx || {}, FXP = P.fxp || {post: []}, NBb = Math.round(P.duration / P.BT), lpC = FXP.lp, hpC = FXP.hp;
    const swL = svf(), swR = svf(), hwL = svf(), hwR = svf();
    const phL = {x: new Float32Array(4), y: new Float32Array(4)}, phR = {x: new Float32Array(4), y: new Float32Array(4)}; let phP = 0, aL = 0, aR = 0, fbL = 0, fbR = 0; const phRate = .18 + (p.seed % 7) * .04;
    const apS = (st, k, a, x) => { const y = -a * x + st.x[k] + a * st.y[k]; st.x[k] = x; st.y[k] = y; return y; };
    const CN = Math.round(.045 * sr), cL = new Float32Array(CN), cR = new Float32Array(CN); let cI = 0, cP = 0;
    const WN = Math.round(.03 * sr), wL = new Float32Array(WN), wR = new Float32Array(WN); let wI = 0, wP = 0, wP2 = 0; const wowD = FX.lofi ? .0022 : .0009, flD = FX.lofi ? .0006 : .00025;
    const loL = svf(), loR = svf(), lhL = svf(), lhR = svf(); svfSet(loL, FX.lofi ? 5000 : 11000, .7, sr); svfSet(loR, FX.lofi ? 5000 : 11000, .7, sr); svfSet(lhL, 90, .7, sr); svfSet(lhR, 90, .7, sr);
    let crL = 0, crR = 0;
    const rd = (buf, N, pos) => { let x = pos; while (x < 0) x += N; const i0 = x | 0, f = x - i0, a = buf[i0 % N], b = buf[(i0 + 1) % N]; return a + (b - a) * f; };
    // one-shots that are identical apart from level: three noise variants each, so repeats are not sample-identical
    const cacheKey = e => { const v = e.seed % 3; switch (e.inst){ case 'kick': return 'k' + v; case 'snare': return 's' + v + (e.p.clap ? 'c' : 'n') + e.p.tone.toFixed(3); case 'hat': return 'h' + v + (e.open ? 'o' + e.p.open.toFixed(2) : 'c') + e.p.noisy.toFixed(2); case 'shaker': return 'sh' + v + (e.dec || .05).toFixed(3); case 'rumble': return 'ru' + v + (e.dur || .45).toFixed(2);
      case 'impact': return 'i'; case 'perc': return 'p' + v + e.body + Math.round(e.f) + '_' + (e.decay || 1).toFixed(2) + '_' + (e.hard || .5).toFixed(1); case 'mallet': return 'm' + v + e.p.body + Math.round(e.f) + '_' + (e.dur > .4 ? 1 : 0) + (e.bright || .5).toFixed(1);
      case 'keys': return e.notes ? null : 'ky' + v + e.p.kind + Math.round(e.f) + '_' + (Math.round((e.vel || .8) * 8)) + '_' + Math.round((e.bright || .5) * 6) + '_' + Math.round(Math.min(e.dur, 6) * 8); default: return null; } };
    for (let c0 = 0; c0 < total; c0 += CH){ const n = Math.min(CH, total - c0); dL.fill(0); dR.fill(0); uL.fill(0); uR.fill(0); bL.fill(0); bR.fill(0); vS.fill(0); dS.fill(0); mL.fill(0); mR.fill(0);
      while (ei < ev.length && ev[ei].t * sr < c0 + n){ const e = ev[ei++], fn = I[e.inst]; if (!fn) continue; const ck = cacheKey(e); let o = ck && CACHE.get(ck); if (!o){ if (ck) e.seed = hashSeed(e.seed % 3, 41); o = fn(sr, e); if (ck) CACHE.set(ck, o); } const pan = clamp(e.pan || 0, -1, 1);
        active.push({s0: Math.max(0, Math.round(e.t * sr)), o, v: e.v, gl: Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr: Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2, bus: e.bus === 'drums' ? 0 : e.bus === 'bass' ? 1 : 2, sv: e.sv || 0, sd: e.sd || 0}); }
      for (let a = active.length - 1; a >= 0; a--){ const A = active[a], o = A.o, len = o.m ? o.m.length : o.l.length, from = Math.max(c0, A.s0), to = Math.min(c0 + n, A.s0 + len);
        const TL = A.bus === 0 ? dL : A.bus === 1 ? bL : uL, TR = A.bus === 0 ? dR : A.bus === 1 ? bR : uR, v = A.v;
        if (o.m){ const m = o.m, gl = A.gl * v, gr = A.gr * v, sv = A.sv * v, sd = A.sd * v; for (let i = from; i < to; i++){ const x = m[i - A.s0], j = i - c0; TL[j] += x * gl; TR[j] += x * gr; if (sv) vS[j] += x * sv; if (sd) dS[j] += x * sd; } }
        else { const l = o.l, r = o.r, sv = A.sv * v * .5, sd = A.sd * v * .5; for (let i = from; i < to; i++){ const x = l[i - A.s0], y = r[i - A.s0], j = i - c0; TL[j] += x * v; TR[j] += y * v; if (sv) vS[j] += (x + y) * sv; if (sd) dS[j] += (x + y) * sd; } }
        if (A.s0 + len <= c0 + n) active.splice(a, 1); }
      for (let i = 0; i < n; i++){ svfTick(vHP, vS[i]); vS[i] = vHP.hp; }
      dly(dS, uL, uR, n); verb(vS, mL, mR, n);
      for (let i = 0; i < n; i++){ const si = c0 + i; while (ki < kickS.length && kickS[ki] <= si){ ki++; scAt = si; scEnv = depth; }
        let g = 1; if (scEnv > 1e-4){ const da = si - scAt; g = 1 - scEnv * (da < atkS ? da / atkS : 1); if (da >= atkS) scEnv *= scK; }
        svfTick(mhL, uL[i]); svfTick(mhR, uR[i]); let ml = mhL.hp * g, mr = mhR.hp * g, dl = dL[i], dr = dR[i];
        const bm = svfTick(bLP, (bL[i] + bR[i]) * .5), bs = Math.tanh(bm * 1.3) / 1.3 * (1 - (1 - g) * .6);
        if (FX.sweep && lpC){ if ((i & 31) === 0){ const tb = si / sr / P.BT, b0 = Math.min(NBb, tb | 0), b1 = Math.min(NBb, b0 + 1), fr = tb - (tb | 0);
            const lv = lpC[b0] + (lpC[b1] - lpC[b0]) * Math.min(1, fr), hv = hpC[b0] + (hpC[b1] - hpC[b0]) * Math.min(1, fr); svfSet(swL, lv, .9, sr); svfSet(swR, lv, .9, sr); svfSet(hwL, hv, .7, sr); svfSet(hwR, hv, .7, sr); }
          ml = svfTick(swL, ml); mr = svfTick(swR, mr); svfTick(hwL, ml); svfTick(hwR, mr); ml = hwL.hp; mr = hwR.hp; }
        if (FX.phaser){ if ((i & 31) === 0){ phP += 32 * phRate / sr; const f1 = 380 * Math.pow(6, .5 + .5 * sin1(phP)), f2 = 380 * Math.pow(6, .5 + .5 * sin1(phP + .25)), t1 = Math.tan(Math.PI * f1 / sr), t2 = Math.tan(Math.PI * f2 / sr); aL = (t1 - 1) / (t1 + 1); aR = (t2 - 1) / (t2 + 1); }
          let xl = ml + fbL * .5, xr = mr + fbR * .5; for (let k = 0; k < 4; k++){ xl = apS(phL, k, aL, xl); xr = apS(phR, k, aR, xr); } fbL = xl; fbR = xr; ml = (ml + xl) * .62; mr = (mr + xr) * .62; }
        if (FX.chorus){ cL[cI] = ml; cR[cI] = mr; cP += .65 / sr; const dl1 = (.013 + .0035 * sin1(cP)) * sr, dr1 = (.013 + .0035 * sin1(cP + .5)) * sr; const yl = rd(cL, CN, cI - dl1), yr = rd(cR, CN, cI - dr1); cI = (cI + 1) % CN; ml = ml * .82 + yr * .42; mr = mr * .82 + yl * .42; }
        if (FX.crush){ if (si % 3 === 0){ crL = Math.round(dl * 14) / 14; crR = Math.round(dr * 14) / 14; } dl = dl * .45 + crL * .7; dr = dr * .45 + crR * .7; }
        let l = (dl + bs + ml + svfTick(vLL, mL[i]) * p.verb * 1.1) * .38, r = (dr + bs + mr + svfTick(vLR, mR[i]) * p.verb * 1.1) * .38;
        // high-pass ~24 Hz
        hyL = hpA * (hyL + l - hxL); hxL = l; hyR = hpA * (hyR + r - hxR); hxR = r; l = hyL; r = hyR;
        // low shelf for weight, high shelf for air
        lwL += (l - lwL) * lsA; lwR += (r - lwR) * lsA; l = l + lwL * (lshelf - 1); r = r + lwR * (lshelf - 1);
        lsL += (l - lsL) * shA; lsR += (r - lsR) * shA; l = lsL + (l - lsL) * shelf; r = lsR + (r - lsR) * shelf;
        // mono below ~160 Hz, width above
        const M = (l + r) * .5; let Sd = (l - r) * .5; sLo += (Sd - sLo) * sdA; Sd = sLo * .3 + (Sd - sLo) * (.6 + p.width * .95); l = M + Sd; r = M - Sd;
        if (FX.lofi || FX.tape){ wL[wI] = l; wR[wI] = r; wP += .55 / sr; wP2 += 5.3 / sr; const dd = (.008 + wowD * sin1(wP) + flD * sin1(wP2)) * sr; l = rd(wL, WN, wI - dd); r = rd(wR, WN, wI - dd); wI = (wI + 1) % WN;
          l = svfTick(loL, l); r = svfTick(loR, r);
          if (FX.lofi){ svfTick(lhL, l); svfTick(lhR, r); l = Math.round(lhL.hp * 900) / 900; r = Math.round(lhR.hp * 900) / 900; } else { l = Math.tanh(l * 1.6) / 1.6; r = Math.tanh(r * 1.6) / 1.6; } }
        OL[c0 + i] = drv > 1 ? Math.tanh(l * drv) / drv : l; OR[c0 + i] = drv > 1 ? Math.tanh(r * drv) / drv : r; }
      if (progress) progress(Math.min(.96, (c0 + n) / total)); }
    // edits on the finished mix: stutters / beat-repeat builds, tape stops, reverse swells into drops
    for (const q of FXP.post || []){
      if (q.type === 'stutter' || q.type === 'buildrepeat'){ const s0 = Math.round(q.t0 * sr), s1 = Math.min(total, Math.round(q.t1 * sr)); if (s0 < 0 || s1 <= s0) continue; const cl = OL.slice(s0, s1), cr = OR.slice(s0, s1), N = s1 - s0;
        const plan2 = q.type === 'stutter' ? [[0, N, Math.max(64, Math.round(q.slice * sr))]] : [[0, N >> 1, N >> 3], [N >> 1, (N >> 1) + (N >> 2), N >> 4], [(N >> 1) + (N >> 2), N, N >> 5]];
        for (const [a, b, sl] of plan2) for (let i = a; i < b; i++){ const j = a + ((i - a) % sl), w = Math.min(1, (i - a) % sl / 48, (sl - (i - a) % sl) / 48); OL[s0 + i] = cl[j] * w; OR[s0 + i] = cr[j] * w; } }
      else if (q.type === 'tapestop'){ const s0 = Math.round(q.t0 * sr), s1 = Math.min(total, Math.round(q.t1 * sr)), N = s1 - s0; if (s0 < 0 || N <= 0) continue; const cl = OL.slice(s0, s1), cr = OR.slice(s0, s1); let pos = 0;
        for (let i = 0; i < N; i++){ const k = pos | 0, fr = pos - k, fade = Math.min(1, (N - i) / (sr * .03)); OL[s0 + i] = k + 1 < N ? (cl[k] + (cl[k + 1] - cl[k]) * fr) * fade : 0; OR[s0 + i] = k + 1 < N ? (cr[k] + (cr[k + 1] - cr[k]) * fr) * fade : 0; pos += Math.pow(1 - i / N, 1.7); } }
      else if (q.type === 'reverse'){ const N = Math.round(q.len * sr), s0 = Math.round(q.t * sr); if (s0 - N < 0 || s0 + N > total) continue; const cl = OL.slice(s0, s0 + N), cr = OR.slice(s0, s0 + N);
        for (let i = 0; i < N; i++){ const g = Math.pow(i / N, 2) * .75; OL[s0 - N + i] += cl[N - 1 - i] * g; OR[s0 - N + i] += cr[N - 1 - i] * g; } } }
    // mastering: level → glue → level again → look-ahead limiter at −1 dBFS. raw: un-normalised, for level calibration
    if (!p.raw){ const g1 = Math.pow(10, -13 / 20) / loudHalf(OL, OR, sr); for (let i = 0; i < total; i++){ OL[i] *= g1; OR[i] *= g1; }
      glue(OL, OR, sr, -16, 2.2, 6, .012, .22);
      const g2 = Math.pow(10, -11.5 / 20) / loudHalf(OL, OR, sr); for (let i = 0; i < total; i++){ OL[i] *= g2; OR[i] *= g2; }
      limiter(OL, OR, sr, .89, .0015, .06); }
    if (progress) progress(1);
    return {sr, L: OL, R: OR, meta: P.meta};
  }
  return {render, randomize, STYLES: ALL, EVOLVING: STYLES, GS, FXN, plan: p => plan(Object.assign({}, DEF, p, {layers: Object.assign({}, DEF.layers, p && p.layers), palette: Object.assign({}, p && p.palette)})), DEF, resolveFx, MODES, NOTE};
}
if (typeof module !== 'undefined' && module.exports) module.exports = SYNTH_CORE;
