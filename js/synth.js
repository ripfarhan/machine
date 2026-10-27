/* Maut ki machine — SYNTH: a math-based generative synthesiser.
   Every sample is computed: FM operators, Karplus–Strong strings, modal resonator banks (membrane, bar, glass, metal
   mode ratios), PolyBLEP oscillators through TPT state-variable filters, granular clouds, a feedback-delay-network reverb.
   The music comes from systems that evolve rather than loop: Markov harmony with voice leading, a motif that develops
   (invert, retrograde, fragment, augment, mutate — mutations accumulate), elementary cellular automata rewriting rhythms
   every bar, logistic-map and Lorenz-attractor modulation. Same parameters → same audio.
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

  // =========================================================== instruments (each returns {m} mono or {l, r} stereo)
  const I = {};
  I.kick = (sr, e) => { const P = e.p, n = Math.ceil((P.decay * 5 + .08) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    let ph = 0, amp = 1, pe = 1; const ak = Math.exp(-1 / (P.decay * sr)), pk = Math.exp(-1 / (P.pitchT * sr)), atk = .0012 * sr, clk = .005 * sr, dr = P.drive, dn = Math.tanh(dr);
    for (let i = 0; i < n; i++){ const f = P.f1 + (P.f0 - P.f1) * pe; pe *= pk; ph += f / sr; let x = sin1(ph) * amp; amp *= ak; if (i < atk) x *= i / atk;
      if (i < clk) x += (nz() * 2 - 1) * (1 - i / clk) * P.click; m[i] = Math.tanh(x * dr) / dn; }
    fadeTail(m, sr, .02); return {m}; };
  I.snare = (sr, e) => { const P = e.p, n = Math.ceil((Math.max(P.tone, P.noise) * 6 + .03) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    if (!P.clap) modal(sr, m, P.f0, MEMBRANE, [1, .6, .45, .35, .3, .22, .18, .14], MEMBRANE.map((r, k) => P.tone / (1 + k * .55)), .55 * P.body);
    const s = svf(); svfSet(s, P.nf, P.clap ? 1.4 : .8, sr);
    const bursts = P.clap ? [0, .0095, .0195, .031] : [0], tail = P.noise;
    for (let i = 0; i < n; i++){ const t = i / sr; let env = 0;
      if (P.clap){ for (let b = 0; b < 3; b++){ const d = t - bursts[b]; if (d >= 0) env += Math.exp(-d / .0055) * .8; } const d = t - bursts[3]; if (d >= 0) env += Math.exp(-d / tail); }
      else env = Math.exp(-t / tail) * Math.min(1, t / .0007);
      svfTick(s, nz() * 2 - 1); m[i] += (P.clap ? s.bp : s.bp * .7 + s.hp * .3) * env * P.snap; }
    fadeTail(m, sr, .01); return {m}; };
  I.hat = (sr, e) => { const P = e.p, d = e.open ? P.open : P.closed, n = Math.ceil((d * 6 + .01) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    const ph = new Float64Array(6), inc = METAL6.map(r => r * P.base / sr), h1 = svf(), h2 = svf(), bp = svf(); svfSet(h1, P.hp, .6, sr); svfSet(h2, P.hp, .6, sr); svfSet(bp, P.ring, 2.5, sr);
    let a = 1; const ak = Math.exp(-1 / (d * sr)), atk = .0006 * sr;
    for (let i = 0; i < n; i++){ let x = 0; for (let k = 0; k < 6; k++){ ph[k] += inc[k]; if (ph[k] >= 1) ph[k] -= 1; x += ph[k] < .5 ? 1 : -1; }
      x = x / 6 * (1 - P.noisy) + (nz() * 2 - 1) * P.noisy; svfTick(h1, x); svfTick(h2, h1.hp); svfTick(bp, h2.hp);
      m[i] = (h2.hp * .75 + bp.bp * .45) * a * (i < atk ? i / atk : 1); a *= ak; }
    fadeTail(m, sr, .004); return {m}; };
  I.perc = (sr, e) => { const B = BODIES[e.body] || BODIES.wood, dm = e.decay || 1, n = Math.ceil((Math.max.apply(null, B.d) * dm * 6 + .02) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    modal(sr, m, e.f, B.r, B.a, B.d.map(x => x * dm), .5);
    const s = svf(); svfSet(s, Math.min(e.f * 3.5, 9000), .7, sr); const sn = Math.min(n, (.005 * sr) | 0);
    for (let i = 0; i < sn; i++){ svfTick(s, nz() * 2 - 1); m[i] += s.bp * (1 - i / sn) * .3 * (e.hard || .5); }
    fadeTail(m, sr, .01); return {m}; };
  // Karplus–Strong with fractional-delay allpass tuning and decay stretch
  I.string = (sr, e) => { const f = e.f, P = e.p, n = Math.ceil((e.dur + P.rel * 4 + .05) * sr), m = new Float32Array(n), nz = rngOf(e.seed);
    const N = sr / f, L = Math.max(2, Math.floor(N - 1.6)), frac = N - 1.5 - L, buf = new Float32Array(L + 1);
    let lp = 0; const bc = clamp(P.bright * (e.bright || 1), .04, 1); for (let i = 0; i <= L; i++){ lp += (nz() * 2 - 1 - lp) * bc; buf[i] = lp; }
    let mean = 0; for (let i = 0; i <= L; i++) mean += buf[i]; mean /= L + 1; for (let i = 0; i <= L; i++) buf[i] -= mean;
    const rho = Math.pow(10, -3 / (P.t60 * f)), C = (1 - frac) / (1 + frac), S = .5; let apx = 0, apy = 0, prev = 0, idx = 0, g = 1, dx = 0, dy = 0;
    const gN = e.dur * sr, rk = Math.exp(-1 / (P.rel * sr));
    for (let i = 0; i < n; i++){ const x = buf[idx], y = rho * ((1 - S) * x + S * prev); prev = x; const ap = C * y + apx - C * apy; apx = y; apy = ap; buf[idx] = ap; if (++idx > L) idx = 0;
      if (i > gN) g *= rk; const o = x * g, dco = o - dx + .995 * dy; dx = o; dy = dco; m[i] = dco * 1.6; }
    fadeTail(m, sr, .01); return {m}; };
  // FM: carrier + modulator (+ optional second modulator), decaying index, feedback
  I.fm = (sr, e) => { const P = e.p, f = e.f, n = Math.ceil((e.dur + P.rel * 5 + .02) * sr), m = new Float32Array(n);
    const iScale = Math.sqrt(clamp(440 / f, .2, 2.2)) * (e.bright || 1), I0 = P.index * iScale, Is = P.indexSus * iScale;
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
      m[i] = s.lp * env * rel * .5 + (P.sub ? sin1(i * f * .5 / sr) * env * rel * P.sub : 0); }
    fadeTail(m, sr, .01); return {m}; };
  // mallet = modal bar/glass struck at pitch
  I.mallet = (sr, e) => I.perc(sr, {f: e.f, body: e.p.body, decay: e.p.decay * (e.dur > .4 ? 1.2 : 1), hard: .4 + .5 * (e.bright || .5), seed: e.seed});

  // ---------- chord-holding stereo voices
  function lzAt(e, t){ const a = e.mod; if (!a) return 0; const x = t / e.modT, i = Math.floor(x); if (i <= 0) return a[0]; if (i >= a.length - 1) return a[a.length - 1]; return a[i] + (a[i + 1] - a[i]) * (x - i); }
  I.pad = (sr, e) => { const P = e.p, notes = e.notes, n = Math.ceil((e.dur + P.rel * 4 + .05) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed);
    const atk = Math.max(1, P.atk * sr), gN = e.dur * sr, rk = Math.exp(-1 / (P.rel * sr)), nn = notes.length;
    if (P.kind === 'supersaw'){ const V = nn > 4 ? 2 : 3;
      notes.forEach((mn, j) => { const f = mtof(mn), pj = nn > 1 ? (j / (nn - 1) - .5) * 1.5 : 0;
        for (let v = 0; v < V; v++){ const cents = (v - (V - 1) / 2) * P.det, fv = f * Math.pow(2, cents / 1200), dt = fv / sr; let t = nz(); const pan = clamp(pj + (v - (V - 1) / 2) * .35, -1, 1), gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
          for (let i = 0; i < n; i++){ t += dt; if (t >= 1) t -= 1; const x = (2 * t - 1 - blep(t, dt)) * .3; l[i] += x * gl; r[i] += x * gr; } } });
      const sl = svf(), sR = svf();
      for (let i = 0; i < n; i++){ if ((i & 31) === 0){ const z = lzAt(e, i / sr), fc = P.cut * (.45 + (e.bright || .5)) * (1 + .55 * z); svfSet(sl, fc, P.res, sr); svfSet(sR, fc * 1.04, P.res, sr); } l[i] = svfTick(sl, l[i]); r[i] = svfTick(sR, r[i]); } }
    else if (P.kind === 'fmpad'){
      notes.forEach((mn, j) => { const f = mtof(mn), pj = nn > 1 ? (j / (nn - 1) - .5) * 1.4 : 0; for (let side = 0; side < 2; side++){ const fv = f * Math.pow(2, (side ? 1 : -1) * P.det / 1200); let pc = nz(), pm = nz(); const lf = P.lfo * (1 + j * .13 + side * .07), ph0 = nz();
          const g = .22 * (side ? Math.sin((pj + 1) * Math.PI / 4) : Math.cos((pj + 1) * Math.PI / 4)), out = side ? r : l;
          const bI = P.index * (.6 + (e.bright || .5) * .8) / TAU; let Ii = 0;
          for (let i = 0; i < n; i++){ if ((i & 63) === 0) Ii = bI * (.55 + .45 * sin1(ph0 + i * lf / sr)); pc += fv / sr; pm += fv * P.ratio / sr; out[i] += sin1(pc + Ii * sin1(pm)) * g; } } }); }
    else { // additive: harmonic partials with independent slow amplitude drift — the timbre breathes
      notes.forEach((mn, j) => { const f = mtof(mn), K = 6; for (let k = 1; k <= K; k++){ const fk = f * k * (1 + P.stretch * (k - 1) * (k - 1)); if (fk > sr * .42) break;
          const a0 = .2 / Math.pow(k, P.tilt), rate = P.shimmer * (.3 + nz()), ph0 = nz(), side = (k + j) & 1, out = side ? r : l, other = side ? l : r;
          const w = TAU * fk / sr, cw = Math.cos(w), sw = Math.sin(w), p0 = nz() * TAU; let c = Math.cos(p0), sn = Math.sin(p0);
          for (let b = 0; b < n; b += 64){ const e0 = Math.min(n, b + 64), amp0 = a0 * (.55 + .45 * sin1(ph0 + b * rate / sr)), amp1 = a0 * (.55 + .45 * sin1(ph0 + e0 * rate / sr)), da = (amp1 - amp0) / (e0 - b); let amp = amp0;
            for (let i = b; i < e0; i++){ const c2 = c * cw - sn * sw; sn = sn * cw + c * sw; c = c2; const x = sn * amp; amp += da; out[i] += x * .8; other[i] += x * .25; }
            const g = 1.5 - .5 * (c * c + sn * sn); c *= g; sn *= g; } } }); }
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / atk) * (i > gN ? Math.pow(rk, i - gN) : 1); l[i] *= env; r[i] *= env; }
    const f = Math.min(n, (.05 * sr) | 0); for (let i = 0; i < f; i++){ l[n - 1 - i] *= i / f; r[n - 1 - i] *= i / f; }
    return {l, r}; };
  // just-intonation drone: root, fifth (3/2), octave — slow beating between detuned pairs
  I.drone = (sr, e) => { const n = Math.ceil((e.dur + 3) * sr), l = new Float32Array(n), r = new Float32Array(n), f = mtof(e.root), atk = 2.5 * sr, rel = 2.5 * sr, gN = e.dur * sr;
    const parts = [[1, .5], [1.5, .3], [2, .18], [3, .06]]; const beat = .17 + (e.seed % 7) * .06;
    parts.forEach(([ratio, a], k) => { let pl = k * .13, pr = k * .29; const fl = f * ratio, fr = f * ratio + beat * (k + 1) * .5;
      for (let i = 0; i < n; i++){ pl += fl / sr; pr += fr / sr; l[i] += sin1(pl) * a; r[i] += sin1(pr) * a; } });
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / atk) * (i > gN ? Math.max(0, 1 - (i - gN) / rel) : 1); l[i] *= env * .5; r[i] *= env * .5; } return {l, r}; };
  // texture: granular cloud on chord tones / resonant wind / Lorenz-driven FM drone
  I.tex = (sr, e) => { const n = Math.ceil((e.dur + 2) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed), P = e.p, gN = e.dur * sr;
    if (P.kind === 'grains'){ let t = 0; while (t < e.dur){ const z = lzAt(e, t), dens = P.density * (.4 + .6 * (z * .5 + .5)), ch = e.chordAt(e.t + t), mn = ch[(nz() * ch.length) | 0] + 12 * ((nz() * 3) | 0);
        const f = mtof(mn), glen = (.03 + nz() * .14) * sr, s0 = (t * sr) | 0, pan = nz() * 2 - 1, gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4), idx = P.fm * nz(); let ph = nz(), pm = 0;
        for (let i = 0; i < glen && s0 + i < n; i++){ const w = .5 - .5 * Math.cos(TAU * i / glen); ph += f / sr; pm += f * 2 / sr; const x = sin1(ph + idx * sin1(pm) / TAU) * w * .16; l[s0 + i] += x * gl; r[s0 + i] += x * gr; }
        t += 1 / Math.max(1, dens) * (.4 + nz() * 1.2); } }
    else if (P.kind === 'wind'){ const a = svf(), b = svf(); for (let i = 0; i < n; i++){ if ((i & 63) === 0){ const z = lzAt(e, i / sr); svfSet(a, 300 + 2600 * (z * .5 + .5), P.q, sr); svfSet(b, 360 + 2400 * (.5 - z * .5), P.q, sr); }
        svfTick(a, nz() * 2 - 1); svfTick(b, nz() * 2 - 1); l[i] = a.bp * .5; r[i] = b.bp * .5; } }
    else { const f = mtof(e.root); let pc = 0, pm = 0; for (let i = 0; i < n; i++){ const z = lzAt(e, i / sr), ratio = 1.5 + z * 1.2, idx = 1.2 + (z * .5 + .5) * 2.5; pc += f / sr; pm += f * ratio / sr; const x = sin1(pc + idx * sin1(pm) / TAU) * .18; l[i] = x * (.6 + .4 * z); r[i] = x * (.6 - .4 * z); } }
    for (let i = 0; i < n; i++){ const env = Math.min(1, i / (1.5 * sr)) * (i > gN ? Math.max(0, 1 - (i - gN) / (1.5 * sr)) : 1); l[i] *= env; r[i] *= env; } return {l, r}; };
  I.riser = (sr, e) => { const n = Math.ceil((e.dur + .05) * sr), l = new Float32Array(n), r = new Float32Array(n), nz = rngOf(e.seed), a = svf(), b = svf(); let ph = 0;
    for (let i = 0; i < n; i++){ const k = i / n, fc = 250 * Math.pow(36, k); if ((i & 31) === 0){ svfSet(a, fc, 2.2, sr); svfSet(b, fc * 1.07, 2.2, sr); } svfTick(a, nz() * 2 - 1); svfTick(b, nz() * 2 - 1);
      ph += (110 * Math.pow(8, k)) / sr; const env = Math.pow(k, 2.2), s = sin1(ph) * .12 * env; l[i] = (a.bp * .6) * env + s; r[i] = (b.bp * .6) * env + s; }
    fadeTail(l, sr, .03); fadeTail(r, sr, .03); return {l, r}; };
  I.impact = (sr, e) => { const n = Math.ceil(1.8 * sr), m = new Float32Array(n), nz = rngOf(e.seed), s = svf(); let ph = 0;
    for (let i = 0; i < n; i++){ const t = i / sr, f = 28 + 46 * Math.exp(-t / .25); ph += f / sr; if ((i & 31) === 0) svfSet(s, 150 + 6000 * Math.exp(-t / .12), .7, sr); svfTick(s, nz() * 2 - 1);
      m[i] = sin1(ph) * Math.exp(-t / .55) * Math.min(1, t / .002) + s.lp * Math.exp(-t / .3) * .4; } fadeTail(m, sr, .05); return {m}; };

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

  // =========================================================== composition
  const DEF = {seed: 7, vary: 0, bpm: 118, tonic: 9, mode: 'minor', bars: 112, rhythm: 'auto', form: 'auto', color: .5, motion: .45, develop: .55, chaos: .45, poly: .5,
    density: .6, bright: .55, metal: .5, swing: .57, humanize: .4, pump: .3, drive: .3, verb: .45, delay: .35, width: .9, arpRate: 16,
    layers: {kick: 1, snare: 1, hat: 1, perc: 1, bass: 1, arp: 1, pad: 1, lead: 1, tex: 1}, palette: {}};

  function plan(p){
    const R = rngOf(hashSeed(p.seed, 11)), V = rngOf(hashSeed(p.seed, 977, p.vary)), H = rngOf(hashSeed(p.seed, 313));   // R: identity · H: harmony · V: the parts (changes per variation)
    const beat = 60 / p.bpm, ST = beat / 4, BT = beat * 4;
    const scale = MODES[p.mode] || MODES.minor, nS = scale.length, tonic = ((p.tonic | 0) % 12 + 12) % 12;
    const dpc = d => (tonic + scale[((d % nS) + nS) % nS]) % 12;
    const dmidi = (d, base) => base + 12 * Math.floor(d / nS) + tonic + scale[((d % nS) + nS) % nS];
    const rhythm = p.rhythm && p.rhythm !== 'auto' ? p.rhythm : pickW(R, {four: 34, drive: 14, broken: 24, half: 10, ca: 13, none: 5});
    const form = p.form && p.form !== 'auto' ? p.form : pickW(R, {arc: 36, rise: 22, twin: 30, ambient: rhythm === 'none' ? 80 : 6});
    const pal = {bass: pick(R, ['fm', 'subsaw', 'string']), arp: pick(R, ['bell', 'pluck', 'saw', 'mallet', 'epiano']), pad: pick(R, ['supersaw', 'fmpad', 'additive']),
      lead: pick(R, ['fmlead', 'sawlead', 'mallet', 'pluck']), perc: pick(R, ['wood', 'glass', 'membrane', 'metal']), tex: pick(R, ['grains', 'wind', 'chaos'])};
    for (const k in pal) if (p.palette[k] && p.palette[k] !== 'auto') pal[k] = p.palette[k];
    const metal = p.metal, bright = p.bright;
    // ---------- patches, randomised once per seed
    const PT = {
      kick: {f0: rr(R, 105, 165), f1: rr(R, 40, 52), pitchT: rr(R, .016, .04), decay: rr(R, .2, .42) * (rhythm === 'drive' ? .8 : 1), click: rr(R, .15, .5), drive: rr(R, 1.3, 2.4) * (1 + p.drive * .8)},
      snare: {f0: rr(R, 165, 235), tone: rr(R, .05, .13), noise: rr(R, .09, .22), nf: rr(R, 1500, 3600), body: rr(R, .4, 1), snap: rr(R, .55, 1), clap: R() < .45},
      hat: {base: rr(R, 300, 420), closed: rr(R, .022, .05), open: rr(R, .16, .38), hp: rr(R, 6200, 8600), ring: rr(R, 8500, 12000), noisy: rr(R, .1, .55)},
      bass: pal.bass === 'fm' ? {inst: 'fm', ratio: pick(R, [1, .5, 2, 1]), index: rr(R, 1.4, 3.6) * (.6 + metal * .8), indexSus: rr(R, .15, .6), idecay: rr(R, .04, .18), atk: .004, dec: rr(R, .15, .4), sus: rr(R, .5, .85), rel: .07, fb: rr(R, 0, .4)}
        : pal.bass === 'subsaw' ? {inst: 'saw', cut: rr(R, 1.4, 3), famt: rr(R, 3, 12) * (.5 + bright), fdec: rr(R, .06, .25), res: rr(R, .8, 2.6), atk: .004, dec: .35, sus: .75, rel: .07, sub: .55, det: .002}
        : {inst: 'string', t60: rr(R, .9, 2.2), bright: rr(R, .18, .45), rel: .1},
      arp: pal.arp === 'bell' ? {inst: 'fm', ratio: pick(R, [3.5, 1.4142, 2.756, 4, 1.618, 3]), index: rr(R, 2, 6) * (.5 + metal), indexSus: rr(R, 0, .3), idecay: rr(R, .06, .3), atk: .002, dec: rr(R, .25, .8), sus: 0, rel: rr(R, .25, .7)}
        : pal.arp === 'epiano' ? {inst: 'fm', ratio: 1, ratio2: 14, index: rr(R, 1, 2.2) * (.6 + metal * .7), index2: rr(R, .3, 1.2), indexSus: .2, idecay: rr(R, .15, .4), atk: .002, dec: rr(R, .5, 1.2), sus: .1, rel: .3}
        : pal.arp === 'pluck' ? {inst: 'string', t60: rr(R, .6, 2.6), bright: rr(R, .35, .95), rel: .08}
        : pal.arp === 'saw' ? {inst: 'saw', cut: rr(R, 1.2, 3), famt: rr(R, 4, 16) * (.4 + bright), fdec: rr(R, .04, .22), res: rr(R, .7, 3.2), atk: .002, dec: rr(R, .1, .4), sus: rr(R, 0, .3), rel: rr(R, .05, .25), sq: R() < .4, det: rr(R, .002, .008)}
        : {inst: 'mallet', body: pick(R, ['bar', 'glass', 'wood', 'metal']), decay: rr(R, .5, 1.3)},
      pad: pal.pad === 'supersaw' ? {kind: 'supersaw', det: rr(R, 7, 20), cut: rr(R, 700, 2200) * (.5 + bright), res: rr(R, .6, 1.1), atk: rr(R, .4, 1.6), rel: rr(R, 1, 2.8)}
        : pal.pad === 'fmpad' ? {kind: 'fmpad', ratio: pick(R, [1, 2, .5, 3]), index: rr(R, .4, 1.8) * (.5 + metal), lfo: rr(R, .04, .22), det: rr(R, 3, 9), atk: rr(R, .6, 2), rel: rr(R, 1.2, 3)}
        : {kind: 'additive', tilt: rr(R, .9, 1.7) - bright * .4, stretch: rr(R, 0, .0012), shimmer: rr(R, .05, .4), atk: rr(R, .7, 2), rel: rr(R, 1.2, 3)},
      lead: pal.lead === 'fmlead' ? {inst: 'fm', ratio: pick(R, [1, 2, 3]), index: rr(R, 1.2, 3.2) * (.5 + metal), indexSus: rr(R, .5, 1.4), idecay: rr(R, .15, .5), atk: .012, dec: .45, sus: .7, rel: .25, vib: .004, fb: rr(R, 0, .5)}
        : pal.lead === 'sawlead' ? {inst: 'saw', cut: 2.2, famt: rr(R, 3, 8) * (.4 + bright), fdec: .3, res: rr(R, .8, 2), atk: .01, dec: .5, sus: .7, rel: .2, vib: .0045, det: .006}
        : pal.lead === 'pluck' ? {inst: 'string', t60: rr(R, 1.4, 3.2), bright: rr(R, .5, 1), rel: .15}
        : {inst: 'mallet', body: pick(R, ['bar', 'glass', 'metal']), decay: rr(R, .9, 1.6)},
      perc: {body: pal.perc, decay: rr(R, .7, 1.4)},
      tex: pal.tex === 'grains' ? {kind: 'grains', density: rr(R, 6, 26), fm: rr(R, .2, 2.5) * (.4 + metal)} : pal.tex === 'wind' ? {kind: 'wind', q: rr(R, 3, 9)} : {kind: 'chaos'}};

    // ---------- form
    const FORMS = {arc: [['intro', .12, .2], ['build', .12, .5], ['peak', .24, 1], ['break', .13, .3], ['build', .07, .6], ['peak', .19, 1], ['outro', .13, .22]],
      rise: [['intro', .1, .15], ['rise', .22, .32], ['rise', .22, .6], ['peak', .32, 1], ['outro', .14, .28]],
      twin: [['intro', .1, .2], ['groove', .18, .7], ['peak', .2, 1], ['break', .14, .3], ['groove', .1, .75], ['peak', .16, 1], ['outro', .12, .22]],
      ambient: [['intro', .2, .12], ['swell', .3, .32], ['bloom', .3, .55], ['outro', .2, .15]]};
    const B = Math.max(16, Math.round(p.bars / 4) * 4), F = FORMS[form];
    const secs = []; let acc = 0;
    F.forEach(([name, f, e], i) => { const bars = Math.max(4, Math.round(f * B / 4) * 4); secs.push({name, bar0: acc, bars, e, eTo: e, chaosMul: 1}); acc += bars; });
    secs.forEach((s, i) => { if (s.name === 'build' || s.name === 'rise' || s.name === 'swell') s.eTo = secs[i + 1] ? Math.max(s.e, secs[i + 1].e * .85) : s.e;
      s.chaosMul = form === 'rise' ? [1, .85, .55, .22, .1][i] || .1 : s.name === 'break' ? 1.25 : s.name === 'peak' ? .8 : 1; });
    const NB = acc, NSTEP = NB * 16;
    const secOf = bar => { for (let i = secs.length - 1; i >= 0; i--) if (bar >= secs[i].bar0) return secs[i]; return secs[0]; };
    const energy = bar => { const s = secOf(bar), k = (bar - s.bar0) / s.bars; return lerp(s.e, s.eTo, k); };

    // ---------- chaos and continuous modulation
    const LOG = new Float32Array(NSTEP); { let x = .31 + R() * .3; for (let i = 0; i < NSTEP; i++){ const s = secOf(i >> 4), r = clamp(3.55 + .44 * p.chaos * s.chaosMul, 3.4, 3.999); x = r * x * (1 - x); if (x <= 0 || x >= 1) x = .5 + R() * .1; LOG[i] = x; } }
    const LZ = new Float32Array(NSTEP), LZ2 = new Float32Array(NSTEP); { let x = 1 + R(), y = 1, z = 1 + R() * 2; const dt = .006;
      for (let i = 0; i < NSTEP; i++){ for (let s = 0; s < 3; s++){ const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; } LZ[i] = clamp(x / 20, -1, 1); LZ2[i] = clamp((z - 25) / 22, -1, 1); } }

    // ---------- harmony
    const DW = [.25, 1.4, 1.3, 3.0, 1.1, 2.6, .9];
    const isDim = d => nS === 7 && ((dpc(d + 4) - dpc(d) + 12) % 12) === 6;
    const nextRoot = (prev, r, home) => { const w = {}; for (let d = 0; d < nS; d++){ const mv = ((d - prev) % nS + nS) % nS, k = nS === 7 ? mv : Math.round(mv * 7 / nS) % 7; let x = DW[k]; if (d === 0) x *= 1 + home * 2.5; if (isDim(d)) x *= .08; if (d === prev) x *= .12; w[d] = x; } return +pickW(r, w); };
    const STACK = {tri: [0, 2, 4], sev: [0, 2, 4, 6], sus2: [0, 1, 4], sus4: [0, 3, 4], add9: [0, 2, 4, 8], nine: [0, 2, 4, 6, 8], quart: [0, 3, 6]};
    const chordType = r => { const c = p.color; return pickW(r, c < .25 ? {tri: 8, sus2: 1, sus4: 1} : c < .5 ? {tri: 4, sev: 3, sus2: 1.5, sus4: 1, add9: 1} : c < .75 ? {sev: 4, add9: 2.5, sus2: 1.5, tri: 1.5, nine: 1} : {nine: 3.5, sev: 2, quart: 2.5, add9: 2}); };
    const chordName = (root, type) => { const pcs = STACK[type].map(x => dpc(root + x)), rp = pcs[0], iv = pcs.map(q => (q - rp + 12) % 12), has = x => iv.indexOf(x) >= 0;
      if (type === 'quart') return NOTE[rp] + '⁴'; if (type === 'sus2') return NOTE[rp] + 'sus2'; if (type === 'sus4') return NOTE[rp] + 'sus4';
      const m = has(3) && !has(4), dim = m && has(6) && !has(7); let q = dim ? (has(10) ? 'm7♭5' : 'dim') : m ? 'm' : '';
      if (!dim){ if (has(11)) q += 'maj7'; else if (has(10)) q += '7'; } if (type === 'add9') q += 'add9'; if (type === 'nine') q = q.replace('7', '9').replace('maj9', 'maj9'); return NOTE[rp] + q; };
    let lastVoice = null;
    const voice = pcs => { const lo = 50, hi = 77, opts = pcs.map(pc => { const o = []; for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m); return o; }); let best = null, bc = 1e9; const cur = [];
      const rec = i => { if (i === opts.length){ const s = cur.slice().sort((a, b) => a - b); for (let k = 1; k < s.length; k++){ if (s[k] - s[k - 1] < 2) return; if (s[k] < 59 && s[k] - s[k - 1] < 5) return; } if (s[s.length - 1] - s[0] > 21) return;
          let c = 0; if (lastVoice) for (const m of s){ let d = 99; for (const q of lastVoice) d = Math.min(d, Math.abs(m - q)); c += d; } else c = Math.abs((s[0] + s[s.length - 1]) / 2 - 63);
          c += H() * .9; if (c < bc){ bc = c; best = s; } return; } for (const m of opts[i]){ cur.push(m); rec(i + 1); cur.pop(); } };
      rec(0); if (!best) best = pcs.map(pc => 55 + ((pc - 55) % 12 + 12) % 12).sort((a, b) => a - b); lastVoice = best; return best; };
    const theme = [0]; for (let i = 1; i < 4; i++) theme.push(nextRoot(theme[i - 1], R, i === 3 ? .05 : .35));
    const themeT = theme.map(() => chordType(R));
    const hrBase = p.motion < .25 ? 4 : p.motion < .55 ? 2 : p.motion < .82 ? 2 : 1;
    const chords = []; let prevRoot = 0;
    secs.forEach(S => { const calm = S.name === 'intro' || S.name === 'break' || S.name === 'outro' || S.name === 'swell'; let hr = calm ? Math.min(8, hrBase * 2) : S.name === 'peak' ? Math.max(1, hrBase === 4 ? 2 : hrBase) : hrBase;
      if (p.motion >= .82 && S.name === 'peak') hr = 1; hr = Math.min(hr, S.bars);
      let b = S.bar0, ti = 0; while (b < S.bar0 + S.bars){ const bars = Math.min(hr, S.bar0 + S.bars - b); let root, type;
        if (S.name === 'peak'){ root = theme[ti % 4]; type = themeT[ti % 4]; if (ti >= 4 && H() < p.develop * .45){ root = nextRoot(prevRoot, H, .2); type = chordType(H); } }
        else { root = b === 0 ? 0 : nextRoot(prevRoot, H, S.name === 'outro' ? .6 : .2); type = chordType(H); }
        const pcs = STACK[type].map(x => dpc(root + x)); chords.push({bar: b, bars, root, type, pcs, voicing: voice(pcs), bass: 33 + ((dpc(root) - 33) % 12 + 12) % 12, name: chordName(root, type)}); prevRoot = root; b += bars; ti++; } });
    const chordAtBar = bar => { let c = chords[0]; for (const q of chords){ if (q.bar <= bar) c = q; else break; } return c; };
    const chordAtT = t => chordAtBar(clamp(Math.floor(t / BT), 0, NB - 1)).voicing;

    // ---------- rhythm generators
    function CA(rule, r){ let row = Array.from({length: 16}, () => r() < .3 ? 1 : 0); return () => { const nx = row.map((_, i) => (rule >> (row[(i + 15) % 16] * 4 + row[i] * 2 + row[(i + 1) % 16])) & 1), c = nx.reduce((a, b) => a + b, 0);
      row = c === 0 || c >= 15 ? Array.from({length: 16}, () => r() < .3 ? 1 : 0) : nx; return row; }; }
    const caHat = CA(pick(V, [150, 90, 105]), V), caPerc = CA(pick(V, [30, 45, 86, 135]), V), caKick = CA(pick(V, [18, 22, 26, 146]), V), caArp = CA(pick(V, [90, 150, 60, 102]), V), caFill = CA(30, V);
    const kickEu = euclid(3 + Math.floor(R() * 3), 16, Math.floor(R() * 4) * 2), backbeat = R() < .6, snEu = euclid(2 + Math.floor(R() * 2), 16, 4);
    const bassStyle = rhythm === 'drive' ? 'pulse' : rhythm === 'four' ? pick(R, ['offbeat', 'sustain', 'offbeat', 'roll']) : rhythm === 'half' || rhythm === 'none' ? 'sustain' : pick(R, ['syncop', 'sustain', 'syncop']);
    const bassEu = euclid(5, 16, Math.floor(V() * 16));
    const polyLens = p.poly < .25 ? [8, 16] : p.poly < .55 ? [6, 12, 10] : p.poly < .8 ? [5, 7, 9, 11] : [7, 9, 11, 13, 5];
    const pA = {len: pick(V, polyLens), k: 0}, pB = {len: pick(V, polyLens), k: 0}; pA.pat = euclid(2 + Math.floor(V() * 3), pA.len, Math.floor(V() * pA.len)); pB.pat = euclid(2 + Math.floor(V() * 2), pB.len, Math.floor(V() * pB.len));
    pA.deg = Array.from({length: pA.len}, () => Math.floor(V() * 7)); pB.deg = Array.from({length: pB.len}, () => Math.floor(V() * 5) - 2);

    // ---------- motif
    function makeMotif(r){ const len = r() < .55 ? 16 : 32, k = 3 + Math.floor(r() * 4) + (len > 16 ? 2 : 0), pos = euclid(k, len, Math.floor(r() * 4)).map((v, i) => v ? i : -1).filter(i => i >= 0);
      const contour = pick(r, ['arch', 'rise', 'fall', 'zig', 'valley']); let d = pick(r, [0, 2, 4]);
      const notes = pos.map((s, i) => { const nt = {s, d, v: .7 + r() * .3}; const half = i < pos.length / 2, dir = contour === 'rise' ? 1 : contour === 'fall' ? -1 : contour === 'arch' ? (half ? 1 : -1) : contour === 'valley' ? (half ? -1 : 1) : (i % 2 ? -1 : 1);
        d = clamp(d + dir * (r() < .7 ? 1 : 2), -3, 10); return nt; }); return relen({len, notes}); }
    function relen(m){ m.notes.sort((a, b) => a.s - b.s); m.notes.forEach((n, i) => n.len = Math.max(1, (i + 1 < m.notes.length ? m.notes[i + 1].s : m.len) - n.s)); return m; }
    function develop(m, r){ const dv = p.develop;
      if (r() < .55 * dv){ const n = m.notes[(r() * m.notes.length) | 0]; n.d = clamp(n.d + pick(r, [-2, -1, 1, 2]), -3, 11); }
      if (r() < .25 * dv && m.notes.length > 2){ const i = 1 + ((r() * (m.notes.length - 1)) | 0), lo = m.notes[i - 1].s + 1, hi = m.notes[i + 1] ? m.notes[i + 1].s - 1 : m.len - 1; if (hi >= lo) m.notes[i].s = clamp(m.notes[i].s + pick(r, [-1, 1]), lo, hi); }
      if (r() < .16 * dv && m.notes.length < 10){ const i = (r() * (m.notes.length - 1)) | 0, a = m.notes[i], b = m.notes[i + 1]; if (b && b.s - a.s >= 2) m.notes.push({s: a.s + ((b.s - a.s) >> 1), d: Math.round((a.d + b.d) / 2) + pick(r, [-1, 1]), v: .6}); }
      if (r() < .1 * dv && m.notes.length > 3) m.notes.splice(1 + ((r() * (m.notes.length - 1)) | 0), 1);
      relen(m); let ph = m.notes.map(n => Object.assign({}, n)); const op = pickW(r, {plain: 3, invert: dv * 1.3, retro: dv * .9, frag: dv, aug: dv * .5, lift: dv * .7});
      if (op === 'invert'){ const d0 = ph[0].d; ph.forEach(n => n.d = d0 - (n.d - d0)); }
      else if (op === 'retro'){ const ds = ph.map(n => n.d).reverse(); ph.forEach((n, i) => n.d = ds[i]); }
      else if (op === 'frag'){ const h = ph.filter(n => n.s < m.len / 2); ph = h.concat(h.map(n => Object.assign({}, n, {s: n.s + m.len / 2}))); }
      else if (op === 'aug'){ ph = ph.filter(n => n.s < m.len / 2).map(n => Object.assign({}, n, {s: n.s * 2, len: n.len * 2})); }
      else if (op === 'lift') ph.forEach(n => n.d += 2);
      return {op, notes: ph, len: m.len}; }
    const motif = makeMotif(p.vary ? V : R);

    // ---------- events
    const ev = [], kicks = []; let seq = 0;
    const T = (gs, s) => gs * ST + ((s & 1) ? (p.swing - .5) * 2 * ST : 0) + ((s & 3) ? (V() * 2 - 1) * p.humanize * .006 : 0);
    const add = o => { o.seed = hashSeed(p.seed, p.vary, seq++); ev.push(o); return o; };
    const G = {kick: 1.0, snare: .42, hat: .13, perc: .28, bass: .74, arp: .26, pad: .2, lead: .26, tex: .32, drone: .2, riser: .22, impact: .55};
    const L = p.layers;
    let arpN = 0, arpCfg = null, motifPhrase = null, lastFillBar = -9;
    for (let bar = 0; bar < NB; bar++){
      const S = secOf(bar), k = (bar - S.bar0) / S.bars, e = energy(bar), ch = chordAtBar(bar), nextS = secOf(bar + 1), lastBarOfBuild = (S.name === 'build' || S.name === 'rise' || S.name === 'groove') && bar === S.bar0 + S.bars - 1 && nextS !== S && nextS.e > S.e + .15;
      const dens = p.density * (.55 + .45 * e), bright = clamp(.25 + .55 * e + .2 * LZ[bar * 16], .1, 1.2), dyn = clamp(.3 + .7 * e, .25, 1), rising = S.name === 'build' || S.name === 'rise';
      const on = {kick: L.kick && rhythm !== 'none' && (rising ? k >= .5 : e >= .45), snare: L.snare && rhythm !== 'none' && e >= .62,
        hat: L.hat && rhythm !== 'none' && e >= .28, perc: L.perc && e >= .12, bass: L.bass && (rising ? k >= .75 : (e >= .4 || (form === 'ambient' && e >= .3))), arp: L.arp && e >= .22, lead: L.lead && (S.name === 'peak' || (S.name === 'groove' && k > .5) || (S.name === 'bloom')),
        pad: L.pad, tex: L.tex && bar === S.bar0 && (e < .55 || S.name === 'peak' || form === 'ambient'), drone: L.pad && bar === S.bar0 && (S.name === 'intro' || S.name === 'break' || S.name === 'outro' || form === 'ambient')};
      const hRow = caHat(), pRow = caPerc(), kRow = caKick(), aRow = caArp();
      const gap = s => lastBarOfBuild && s >= 12;    // the silence before the drop
      for (let s = 0; s < 16; s++){ const gs = bar * 16 + s, t = T(gs, s), lg = LOG[gs];
        if (gap(s)) continue;
        // kick
        if (on.kick){ let v = 0;
          if (rhythm === 'four') v = s % 4 === 0 ? 1 : (s === 14 && lg > 1 - dens * .45 ? .42 : 0);
          else if (rhythm === 'drive') v = s % 2 === 0 ? (s % 4 === 0 ? 1 : .62) : 0;
          else if (rhythm === 'broken') v = kickEu[s] ? (s === 0 ? 1 : .88) : (kRow[s] && lg > .78 && s % 2 === 0 ? .5 : 0);
          else if (rhythm === 'half') v = s === 0 || s === 10 ? 1 : (s === 7 && lg > .6 ? .55 : 0);
          else if (rhythm === 'ca') v = s === 0 ? 1 : (kRow[s] && s % 2 === 0 && lg > .45 ? .82 : 0);
          if (v > 0){ add({inst: 'kick', t, v: v * G.kick * dyn, p: PT.kick, bus: 'drums'}); if (v >= .6) kicks.push(t); } }
        // snare / clap
        if (on.snare){ let v = 0;
          if (rhythm === 'four') v = backbeat ? (s === 4 || s === 12 ? 1 : 0) : (s === 12 ? .8 : 0);
          else if (rhythm === 'drive') v = s === 12 ? .75 : 0;
          else if (rhythm === 'half') v = s === 8 ? 1 : 0;
          else if (rhythm === 'broken') v = snEu[s] ? .9 : 0;
          else if (rhythm === 'ca') v = (s === 4 || s === 12) && pRow[s] ? .9 : (s === 12 ? .7 : 0);
          if (v > 0) add({inst: 'snare', t, v: v * G.snare * dyn, p: PT.snare, bus: 'drums', pan: 0, sv: .22}); }
        // build roll
        if ((S.name === 'build' || S.name === 'rise') && k > .74 && L.snare && rhythm !== 'none'){ const fin = bar === S.bar0 + S.bars - 1, every = fin ? 1 : k > .87 ? 2 : 4;
          if (s % every === 0 && !gap(s)) add({inst: 'snare', t, v: (.25 + .6 * (k - .74) / .26) * G.snare * (fin ? (.6 + s / 30) : 1), p: Object.assign({}, PT.snare, {clap: false}), bus: 'drums', sv: .3}); }
        // hats: accents, cellular mask, open on offbeats
        if (on.hat){ const acc = [1, .38, .62, .38][s & 3]; let pl = (s & 1) === 0 || hRow[s] || lg > 1 - dens * .5;
          if (rhythm === 'half' || rhythm === 'drive') pl = (s & 1) === 0 || (hRow[s] && lg > .5);
          const open = (rhythm === 'four' && (s & 3) === 2 && e > .55) || (s === 14 && hRow[s] && e > .7);
          if (pl && (e > .45 || (s & 1) === 0)) add({inst: 'hat', t, v: acc * (.6 + .4 * lg) * G.hat * dyn * (open ? 1.3 : 1), open, p: PT.hat, bus: 'drums', pan: (s & 2 ? .6 : -.6) * p.width}); }
        // two polymetric percussion lines, pitched on the scale, rewritten by a cellular automaton
        if (on.perc){ const ia = gs % pA.len, ib = gs % pB.len;
          if (pA.pat[ia] && (pRow[s] || e < .5 || lg > .4)) add({inst: 'perc', t, v: (.45 + .55 * lg) * G.perc * (.5 + .5 * dyn), f: mtof(dmidi(pA.deg[ia] + ch.root, 72)), body: PT.perc.body, decay: PT.perc.decay, hard: .3 + .5 * lg, bus: 'duck', pan: ((ia / pA.len) - .5) * 1.6 * p.width, sv: .35, sd: .3 * p.delay});
          if (pB.pat[ib] && e > .35 && lg > .3) add({inst: 'perc', t: t + .001, v: (.35 + .4 * lg) * G.perc, f: mtof(dmidi(pB.deg[ib] + ch.root, 60)), body: pB.len % 2 ? 'wood' : 'membrane', decay: .8, hard: .6, bus: 'duck', pan: -((ib / pB.len) - .5) * 1.4 * p.width, sv: .25, sd: .2 * p.delay}); }
        // bass
        if (on.bass){ let hit = false, len = 2, d = 0;
          if (bassStyle === 'sustain'){ hit = s === 0 && (bar === ch.bar || S.name === 'peak' || (bar - ch.bar) % 2 === 0); len = (bar === ch.bar ? ch.bars : 1) * 16 - .5; if (S.name === 'peak' && s === 0) len = Math.min(len, 16); }
          else if (bassStyle === 'offbeat'){ hit = (s & 3) === 2; len = 1.6; }
          else if (bassStyle === 'roll'){ hit = (s & 3) !== 0; len = .9; }
          else if (bassStyle === 'pulse'){ hit = (s & 1) === 0; len = 1.5; }
          else { hit = !!bassEu[s]; len = 2.5; }
          if (hit && !(lastBarOfBuild && s > 8)){ const r5 = V(); if (s !== 0 && r5 < .14) d = 4; else if (s !== 0 && r5 < .22) d = 7;
            const pitch = ch.bass + (d === 4 ? (dpc(ch.root + 4) - dpc(ch.root) + 12) % 12 : d === 7 ? 12 : 0);
            add({inst: PT.bass.inst, t, v: (s === 0 ? 1 : .85) * G.bass * dyn, f: mtof(pitch), dur: len * ST, p: PT.bass, bright: .6 + .4 * e, bus: 'duck', pan: 0}); } }
        // arpeggiator: chord tones in a polymetric cycle, gated by euclid × cellular automaton
        if (on.arp){ if (!arpCfg || bar === S.bar0){ const rate = S.name === 'break' || S.name === 'intro' || S.name === 'swell' ? 2 : (p.arpRate === 8 ? 2 : 1);
            arpCfg = {rate, pat: pick(V, ['up', 'down', 'updown', 'converge', 'walk', 'thirds']), plen: pick(V, p.poly < .3 ? [4, 8] : [3, 5, 7, 5, 6]), oct: 1 + Math.round(e * 2 * V()), gate: euclid(Math.round(lerp(5, 14, dens)), 16, Math.floor(V() * 16)), walk: 0}; }
          if (s % arpCfg.rate === 0 && (arpCfg.gate[s] || (p.poly > .5 && aRow[s])) && (e > .5 || lg > .25)){
            const pool = []; for (let o = 0; o <= arpCfg.oct; o++) ch.voicing.forEach(m => pool.push(m + 12 * o)); pool.sort((a, b) => a - b);
            const n = arpN++, ci = n % arpCfg.plen, cyc = Math.floor(n / arpCfg.plen), P = pool.length; let ix;
            if (arpCfg.pat === 'up') ix = (ci + cyc) % P; else if (arpCfg.pat === 'down') ix = P - 1 - (ci + cyc) % P;
            else if (arpCfg.pat === 'updown'){ const per = Math.max(1, 2 * P - 2), q = (ci + cyc * 2) % per; ix = q < P ? q : per - q; }
            else if (arpCfg.pat === 'converge') ix = ci % 2 ? P - 1 - ((ci >> 1) + cyc) % P : ((ci >> 1) + cyc) % P;
            else if (arpCfg.pat === 'thirds') ix = (ci * 2 + cyc) % P;
            else { arpCfg.walk = clamp(arpCfg.walk + (lg > .5 ? 1 : -1), 0, P - 1); ix = arpCfg.walk; }
            const mn = pool[clamp(ix, 0, P - 1)] + 12, gate = arpCfg.rate * ST * (.7 + 1.3 * LOG[(gs + 7) % NSTEP]);
            add({inst: PT.arp.inst, t, v: (.55 + .45 * lg) * (ci === 0 ? 1.15 : 1) * G.arp * (.45 + .55 * dyn), f: mtof(mn), dur: gate, p: PT.arp, body: PT.arp.body, decay: PT.arp.decay, bright, bus: 'duck', pan: clamp((ci / Math.max(1, arpCfg.plen - 1) - .5) * 1.7 * p.width, -1, 1), sv: .3, sd: .45 * p.delay}); } }
        // developed motif on the lead voice
        if (on.lead){ if (!motifPhrase || gs >= motifPhrase.end){ const ph = develop(motif, V); motifPhrase = Object.assign(ph, {start: gs, end: gs + ph.len}); }
          const rel = gs - motifPhrase.start; for (const nt of motifPhrase.notes) if (nt.s === rel){ const mn = dmidi(ch.root + nt.d, S.name === 'bloom' ? 60 : 72);
            add({inst: PT.lead.inst, t, v: nt.v * G.lead * (S.name === 'groove' ? .75 : 1), f: mtof(mn), dur: Math.min(nt.len, 8) * ST * .95, p: PT.lead, body: PT.lead.body, decay: PT.lead.decay, bright: bright * 1.1, bus: 'duck', pan: .12, sv: .3, sd: .4 * p.delay}); } }
      }
      // fills every 8 bars in the driving sections
      if ((S.name === 'peak' || S.name === 'groove') && (bar - S.bar0) % 8 === 7 && bar - lastFillBar > 4 && rhythm !== 'none'){ lastFillBar = bar; const fr = caFill();
        for (let s = 12; s < 16; s++) if (fr[s] || s === 15) add({inst: 'perc', t: T(bar * 16 + s, s), v: (.5 + .1 * (s - 12)) * G.perc, f: mtof(dmidi(ch.root + (s - 12) * 2, 72)), body: 'membrane', decay: .8, hard: .7, bus: 'duck', pan: (s - 13.5) * .3, sv: .3}); }
      // chord-length events
      if (on.pad && bar === ch.bar){ const notes = ch.voicing.slice(); if (S.name === 'peak' && p.color > .4) notes.push(ch.voicing[1] + 12);
        add({inst: 'pad', t: bar * BT, v: G.pad * (.6 + .4 * (1 - e * .5)), notes, dur: ch.bars * BT, p: PT.pad, bright, mod: LZ.subarray(bar * 16, Math.min(NSTEP, (bar + ch.bars) * 16 + 16)), modT: ST, bus: 'duck', sv: .45}); }
      if (on.drone) add({inst: 'drone', t: bar * BT, v: G.drone, root: dmidi(0, 36), dur: S.bars * BT, bus: 'duck', sv: .35});
      if (on.tex) add({inst: 'tex', t: bar * BT, v: G.tex * (S.name === 'peak' ? .5 : 1), dur: S.bars * BT, p: PT.tex, root: dmidi(ch.root, 36), chordAt: chordAtT, mod: LZ2.subarray(bar * 16, Math.min(NSTEP, (bar + S.bars) * 16 + 16)), modT: ST, bus: 'duck', sv: .55});
      if (bar === S.bar0 && (S.name === 'peak' || (S.name === 'groove' && S.e >= .7)) && bar > 0 && rhythm !== 'none') add({inst: 'impact', t: bar * BT, v: G.impact, bus: 'drums', sv: .45});
      if ((S.name === 'build' || S.name === 'rise') && bar === S.bar0 + S.bars - Math.min(4, Math.max(2, S.bars >> 2))){ const nb = S.bar0 + S.bars - bar; add({inst: 'riser', t: bar * BT, v: G.riser, dur: nb * BT - ST * 4, bus: 'duck', sv: .5}); }
    }
    const meta = {bpm: p.bpm, key: NOTE[tonic] + ' ' + p.mode, rhythm, form, palette: pal, bassStyle, bars: NB, duration: NB * BT,
      sections: secs.map(s => ({name: s.name, bar0: s.bar0, bars: s.bars, e: s.e, eTo: s.eTo, chords: chords.filter(c => c.bar >= s.bar0 && c.bar < s.bar0 + s.bars).map(c => ({bar: c.bar, bars: c.bars, name: c.name}))})),
      events: ev.length, motif: motif.notes.length + ' notes / ' + motif.len + ' steps', poly: pA.len + '/' + pB.len};
    return {events: ev, kicks, beat, BT, duration: NB * BT, meta};
  }

  // =========================================================== render
  function render(p0, progress){
    const p = Object.assign({}, DEF, p0 || {}); p.layers = Object.assign({}, DEF.layers, (p0 && p0.layers) || {}); p.palette = Object.assign({}, (p0 && p0.palette) || {});
    const sr = p.sr || 44100, P = plan(p), ev = P.events.sort((a, b) => a.t - b.t), total = Math.ceil((P.duration + 4) * sr);
    const OL = new Float32Array(total), OR = new Float32Array(total), CH = 16384;
    const dL = new Float32Array(CH), dR = new Float32Array(CH), uL = new Float32Array(CH), uR = new Float32Array(CH), vS = new Float32Array(CH), dS = new Float32Array(CH), mL = new Float32Array(CH), mR = new Float32Array(CH);
    const verb = FDN(sr, .75 + p.verb * .9, 1.1 + p.verb * 4.2, .3 + (1 - p.bright) * .45), dly = PingPong(sr, P.beat * .75, .28 + p.delay * .38, 2400 + p.bright * 2500);
    const kickS = P.kicks.map(t => Math.round(t * sr)).sort((a, b) => a - b), depth = p.pump * .6, prel = .07 + (1 - p.density) * .05, scK = Math.exp(-1 / (prel * sr)), atkS = Math.max(1, .004 * sr); let ki = 0, scEnv = 0, scAt = -1e9;
    // master state
    const hpA = Math.exp(-TAU * 26 / sr), shA = 1 - Math.exp(-TAU * 4200 / sr), sdA = 1 - Math.exp(-TAU * 160 / sr), shelf = Math.pow(10, lerp(-4, 2.5, p.bright) / 20), drv = 1 + p.drive * 2.2;
    let hxL = 0, hyL = 0, hxR = 0, hyR = 0, lsL = 0, lsR = 0, sLo = 0;
    const active = []; let ei = 0; const CACHE = new Map();
    // one-shots that are identical apart from level: three noise variants each, so repeats are not sample-identical
    const cacheKey = e => { const v = e.seed % 3; switch (e.inst){ case 'kick': return 'k' + v; case 'snare': return 's' + v + (e.p.clap ? 'c' : 'n') + e.p.tone.toFixed(3); case 'hat': return 'h' + v + (e.open ? 'o' : 'c');
      case 'impact': return 'i'; case 'perc': return 'p' + v + e.body + Math.round(e.f) + '_' + (e.decay || 1).toFixed(2) + '_' + (e.hard || .5).toFixed(1); case 'mallet': return 'm' + v + e.p.body + Math.round(e.f) + '_' + (e.dur > .4 ? 1 : 0) + (e.bright || .5).toFixed(1); default: return null; } };
    for (let c0 = 0; c0 < total; c0 += CH){ const n = Math.min(CH, total - c0); dL.fill(0); dR.fill(0); uL.fill(0); uR.fill(0); vS.fill(0); dS.fill(0); mL.fill(0); mR.fill(0);
      while (ei < ev.length && ev[ei].t * sr < c0 + n){ const e = ev[ei++], fn = I[e.inst]; if (!fn) continue; const ck = cacheKey(e); let o = ck && CACHE.get(ck); if (!o){ if (ck) e.seed = hashSeed(e.seed % 3, 41); o = fn(sr, e); if (ck) CACHE.set(ck, o); } const pan = clamp(e.pan || 0, -1, 1);
        active.push({s0: Math.max(0, Math.round(e.t * sr)), o, v: e.v, gl: Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr: Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2, drums: e.bus === 'drums', sv: e.sv || 0, sd: e.sd || 0}); }
      for (let a = active.length - 1; a >= 0; a--){ const A = active[a], o = A.o, len = o.m ? o.m.length : o.l.length, from = Math.max(c0, A.s0), to = Math.min(c0 + n, A.s0 + len);
        const TL = A.drums ? dL : uL, TR = A.drums ? dR : uR, v = A.v;
        if (o.m){ const m = o.m, gl = A.gl * v, gr = A.gr * v, sv = A.sv * v, sd = A.sd * v; for (let i = from; i < to; i++){ const x = m[i - A.s0], j = i - c0; TL[j] += x * gl; TR[j] += x * gr; if (sv) vS[j] += x * sv; if (sd) dS[j] += x * sd; } }
        else { const l = o.l, r = o.r, sv = A.sv * v * .5, sd = A.sd * v * .5; for (let i = from; i < to; i++){ const x = l[i - A.s0], y = r[i - A.s0], j = i - c0; TL[j] += x * v; TR[j] += y * v; if (sv) vS[j] += (x + y) * sv; if (sd) dS[j] += (x + y) * sd; } }
        if (A.s0 + len <= c0 + n) active.splice(a, 1); }
      dly(dS, uL, uR, n); verb(vS, mL, mR, n);
      for (let i = 0; i < n; i++){ const si = c0 + i; while (ki < kickS.length && kickS[ki] <= si){ ki++; scAt = si; scEnv = depth; }
        let g = 1; if (scEnv > 1e-4){ const da = si - scAt; g = 1 - scEnv * (da < atkS ? da / atkS : 1); if (da >= atkS) scEnv *= scK; }
        let l = (dL[i] + uL[i] * g + mL[i] * p.verb * 1.2) * .38, r = (dR[i] + uR[i] * g + mR[i] * p.verb * 1.2) * .38;
        // high-pass ~26 Hz
        hyL = hpA * (hyL + l - hxL); hxL = l; hyR = hpA * (hyR + r - hxR); hxR = r; l = hyL; r = hyR;
        // high shelf for the dark, sub-forward balance
        lsL += (l - lsL) * shA; lsR += (r - lsR) * shA; l = lsL + (l - lsL) * shelf; r = lsR + (r - lsR) * shelf;
        // mono below ~160 Hz, width above
        const M = (l + r) * .5; let Sd = (l - r) * .5; sLo += (Sd - sLo) * sdA; Sd = sLo * .15 + (Sd - sLo) * (.6 + p.width * .95); l = M + Sd; r = M - Sd;
        OL[c0 + i] = Math.tanh(l * drv) / drv; OR[c0 + i] = Math.tanh(r * drv) / drv; }
      if (progress) progress(Math.min(.98, (c0 + n) / total)); }
    // loudness: RMS of the loudest half of 400 ms windows → −11 dBFS, then a soft ceiling
    const W = (.4 * sr) | 0, rms = []; for (let i = 0; i + W <= total; i += W){ let s = 0; for (let j = i; j < i + W; j += 4) s += OL[j] * OL[j] + OR[j] * OR[j]; rms.push(Math.sqrt(s / (W / 2))); }
    rms.sort((a, b) => b - a); const top = rms.slice(0, Math.max(1, rms.length >> 1)), ref = top.reduce((a, b) => a + b, 0) / top.length || 1e-6, gain = Math.pow(10, -11 / 20) / ref;
    const ceil = x => { const a = Math.abs(x); return a > .82 ? Math.sign(x) * (.82 + .17 * Math.tanh((a - .82) / .17)) : x; };
    for (let i = 0; i < total; i++){ OL[i] = ceil(OL[i] * gain); OR[i] = ceil(OR[i] * gain); }
    if (progress) progress(1);
    return {sr, L: OL, R: OR, meta: P.meta};
  }
  return {render, plan: p => plan(Object.assign({}, DEF, p, {layers: Object.assign({}, DEF.layers, p && p.layers), palette: Object.assign({}, p && p.palette)})), DEF, MODES, NOTE};
}
if (typeof module !== 'undefined' && module.exports) module.exports = SYNTH_CORE;
