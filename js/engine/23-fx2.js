/* Maut ki Awaaz — engine module: effects, second set (v2: built on top of 22-fx, nothing there changes).
   Send processors: process(inL, inR, outL, outR, n) ADD into out.  In-place processors: process(L, R, n).
   Granular cloud/freeze · shimmer · reverse delay · frequency shifter (barber-pole) · ring mod · tuned resonator bank ·
   vowel/formant filter · wavefolder · rotary · trance gate · tape-stop + buffer stutter (bus) · pitch shifter.
   Everything allocation-free in process(); denormals flushed in feedback paths. */
'use strict';
function AWZ_FX2(A){
  const TAU = A.TAU, tanh = A.tanh, clamp = A.clamp, Line = A.Line;
  const flush = x => (x < 1e-20 && x > -1e-20) ? 0 : x;

  // ---------------------------------------------------------------- pitch shifter (two crossfaded delay taps, 40 ms window)
  class Shifter { constructor(sr, win){ this.sr = sr; this.L = new Line(Math.round(sr * .2)); this.N = Math.round((win || .04) * sr); this.p = 0; this.ratio = 2; }
    tick(x){ this.L.push(x); const N = this.N; this.p += (1 - this.ratio); while (this.p < 0) this.p += N; while (this.p >= N) this.p -= N;
      const d1 = this.p, d2 = (this.p + N * .5) % N, w1 = A.sin1(d1 / N * .5), w2 = A.sin1(d2 / N * .5);
      return this.L.tapf(d1 + 2) * w1 * w1 + this.L.tapf(d2 + 2) * w2 * w2; } }
  A.Shifter = Shifter;

  // ---------------------------------------------------------------- granular cloud (send). freeze = stop writing → the last seconds hang in the air
  A.Granular = class { constructor(sr, seed){ this.sr = sr; this.n = Math.round(sr * 4); this.bL = new Float32Array(this.n); this.bR = new Float32Array(this.n); this.w = 0; this.r = A.rng(seed || 91);
      this.G = []; for (let i = 0; i < 28; i++) this.G.push({on: false, pos: 0, inc: 1, len: 0, i: 0, gl: 1, gr: 1, amp: 1}); this.acc = 0; this.set({}); this.frozen = false; }
    set(o){ this.density = o.density === undefined ? 18 : o.density; this.size = o.size || .12; this.spread = o.spread || 1.5; this.pitches = o.pitches || [1, 1, 2, .5, 1.5]; this.rev = o.reverse === undefined ? .25 : o.reverse;
      this.gain = o.gain === undefined ? .8 : o.gain; this.freeze = !!o.freeze; this.jitter = o.jitter === undefined ? .3 : o.jitter; }
    spawn(){ const g = this.G.find(x => !x.on); if (!g) return; const r = this.r, sr = this.sr, len = Math.max(64, Math.round(this.size * (1 + (r() * 2 - 1) * this.jitter) * sr));
      const back = Math.min(this.n - len * 3 - 8, Math.round((.05 + r() * this.spread) * sr)); const ratio = this.pitches[Math.floor(r() * this.pitches.length)], rev = r() < this.rev;
      g.on = true; g.len = len; g.i = 0; g.inc = rev ? -ratio : ratio; g.pos = (this.w - back - (rev ? 0 : len * ratio) + this.n * 4) % this.n; if (rev) g.pos = (this.w - back + this.n * 4) % this.n;
      const pan = r(); g.gl = Math.cos(pan * 1.5708); g.gr = Math.sin(pan * 1.5708); g.amp = .5 + .5 * r(); }
    process(inL, inR, oL, oR, n){ const sr = this.sr, N = this.n, gain = this.gain / Math.sqrt(Math.max(1, this.density * this.size));
      for (let i = 0; i < n; i++){ if (!this.freeze){ this.bL[this.w] = inL[i]; this.bR[this.w] = inR[i]; } this.w = (this.w + 1) % N;
        this.acc += this.density / sr; while (this.acc >= 1){ this.acc -= 1; this.spawn(); }
        let l = 0, r = 0;
        for (const g of this.G){ if (!g.on) continue; const ph = g.i / g.len, win = A.sin1(ph * .5), w = win * win * g.amp; let p = g.pos % N; if (p < 0) p += N; const j = p | 0, f = p - j, j2 = (j + 1) % N;
          const sl = this.bL[j] + (this.bL[j2] - this.bL[j]) * f, sR = this.bR[j] + (this.bR[j2] - this.bR[j]) * f; l += sl * w * g.gl; r += sR * w * g.gr; g.pos += g.inc; if (++g.i >= g.len) g.on = false; }
        oL[i] += l * gain; oR[i] += r * gain; } } };

  // ---------------------------------------------------------------- shimmer (send): diffuse reverb with an octave-up shifter in its feedback loop
  A.Shimmer = class { constructor(sr){ this.sr = sr; this.hall = new A.Hall(sr, 202); this.hall.set({rt60: 6, damp: 6000, predelay: .02, gain: 1}); this.shL = new Shifter(sr, .05); this.shR = new Shifter(sr, .05);
      this.tmpL = new Float32Array(128); this.tmpR = new Float32Array(128); this.oL = new Float32Array(128); this.oR = new Float32Array(128); this.fbL = 0; this.fbR = 0; this.hp = new A.OnePole(); this.hp2 = new A.OnePole(); this.hp.setLP(300, sr); this.hp2.setLP(300, sr); this.set({}); }
    set(o){ this.fb = o.feedback === undefined ? .55 : o.feedback; this.gain = o.gain === undefined ? .7 : o.gain; this.shL.ratio = this.shR.ratio = o.ratio || 2; if (o.rt60) this.hall.set({rt60: o.rt60, damp: 6000, predelay: .02, gain: 1}); }
    process(inL, inR, oL, oR, n){ const tL = this.tmpL, tR = this.tmpR, hL = this.oL, hR = this.oR; hL.fill(0, 0, n); hR.fill(0, 0, n);
      for (let i = 0; i < n; i++){ tL[i] = inL[i] + this.fbL; tR[i] = inR[i] + this.fbR; }
      this.hall.process(tL, tR, hL, hR, n);
      for (let i = 0; i < n; i++){ const sl = this.hp.hp(this.shL.tick(hL[i])), sR = this.hp2.hp(this.shR.tick(hR[i])); this.fbL = flush(tanh(sl * this.fb)); this.fbR = flush(tanh(sR * this.fb)); oL[i] += hL[i] * this.gain; oR[i] += hR[i] * this.gain; } } };

  // ---------------------------------------------------------------- reverse delay (send): the last segment played backwards (two Hann-windowed readers), with feedback
  A.ReverseDelay = class { constructor(sr){ this.sr = sr; this.Ln = new Line(Math.round(sr * 4.5)); this.Rn = new Line(Math.round(sr * 4.5)); this.c = 0; this.set({}); }
    set(o){ this.N = Math.max(256, Math.round((o.time || .5) * this.sr)); this.fb = o.feedback === undefined ? .35 : o.feedback; this.gain = o.gain === undefined ? .9 : o.gain; }
    process(inL, inR, oL, oR, n){ const N = this.N;
      for (let i = 0; i < n; i++){ const c = this.c, c2 = (c + N / 2) % N; // reader k plays the window that ended N samples ago, backwards
        const w1 = A.sin1(c / N * .5), w2 = A.sin1(c2 / N * .5), d1 = 2 * c, d2 = 2 * c2;
        const l = this.Ln.tap(d1) * w1 * w1 + this.Ln.tap(d2) * w2 * w2, r = this.Rn.tap(d1) * w1 * w1 + this.Rn.tap(d2) * w2 * w2;
        this.Ln.push(inL[i] + flush(l * this.fb)); this.Rn.push(inR[i] + flush(r * this.fb)); this.c = (c + 1) % N; oL[i] += l * this.gain; oR[i] += r * this.gain; } } };

  // ---------------------------------------------------------------- frequency shifter (single-sideband via IIR Hilbert pair, Niemitalo) + optional feedback delay = barber-pole riser
  const HA = [.6923878, .9360654322959, .9882295226860, .9987488452737].map(x => x * x), HB = [.4021921162426, .8561710882420, .9722909545651, .9952884791278].map(x => x * x);
  class Hilbert { constructor(){ this.a = new Float64Array(16); this.b = new Float64Array(16); this.d = 0; }
    tick(x){ let y = x; const a = this.a; for (let k = 0; k < 4; k++){ const o = k * 4, out = HA[k] * (y + a[o + 3]) - a[o + 1]; a[o + 1] = a[o]; a[o] = y; a[o + 3] = a[o + 2]; a[o + 2] = out; y = out; }
      let z = x; const b = this.b; for (let k = 0; k < 4; k++){ const o = k * 4, out = HB[k] * (z + b[o + 3]) - b[o + 1]; b[o + 1] = b[o]; b[o] = z; b[o + 3] = b[o + 2]; b[o + 2] = out; z = out; }
      const re = y, im = this.d; this.d = z; this.re = re; this.im = im; } }
  A.FreqShift = class { constructor(sr){ this.sr = sr; this.hL = new Hilbert(); this.hR = new Hilbert(); this.ph = 0; this.dl = new Line(Math.round(sr * 1.2)); this.dr = new Line(Math.round(sr * 1.2)); this.set({}); }
    set(o){ this.shift = o.shift === undefined ? 30 : o.shift; this.mix = o.mix === undefined ? 1 : o.mix; this.fb = o.feedback || 0; this.dt = Math.round((o.time || .25) * this.sr); }
    process(L, R, n){ const inc = this.shift / this.sr;
      for (let i = 0; i < n; i++){ this.ph += inc; this.ph -= Math.floor(this.ph); const c = A.sin1(this.ph + .25), s = A.sin1(this.ph);
        const xl = L[i] + flush(this.dl.tap(this.dt) * this.fb), xr = R[i] + flush(this.dr.tap(this.dt) * this.fb);
        this.hL.tick(xl); this.hR.tick(xr); const yl = this.hL.re * c - this.hL.im * s, yr = this.hR.re * s + this.hR.im * c;   // R: 90° offset → stereo motion
        this.dl.push(tanh(yl)); this.dr.push(tanh(yr)); L[i] += (yl - L[i]) * this.mix; R[i] += (yr - R[i]) * this.mix; } } };

  // ---------------------------------------------------------------- ring modulator (in place)
  A.RingMod = class { constructor(sr){ this.sr = sr; this.ph = 0; this.set({}); }
    set(o){ this.f = o.freq || 220; this.mix = o.mix === undefined ? .5 : o.mix; }
    process(L, R, n){ const inc = this.f / this.sr; for (let i = 0; i < n; i++){ this.ph += inc; if (this.ph >= 1) this.ph -= 1; const m = A.sin1(this.ph); L[i] += (L[i] * m - L[i]) * this.mix; R[i] += (R[i] * m - R[i]) * this.mix; } } };

  // ---------------------------------------------------------------- tuned resonator bank (send): feedback combs at chord tones — noise and drums "sing" the harmony
  A.Resonator = class { constructor(sr){ this.sr = sr; this.k = 6; this.L = []; this.R = []; this.lp = new Float64Array(12); this.per = new Float64Array(6); this.tper = new Float64Array(6);
      for (let i = 0; i < 6; i++){ this.L.push(new Line(Math.round(sr / 25))); this.R.push(new Line(Math.round(sr / 25))); this.per[i] = this.tper[i] = sr / (110 * (i + 1)); } this.set({}); }
    set(o){ this.fb = o.feedback === undefined ? .965 : o.feedback; this.damp = o.damp === undefined ? .35 : o.damp; this.gain = o.gain === undefined ? .35 : o.gain; }
    tune(midis){ for (let i = 0; i < 6; i++){ const m = midis[i % midis.length] + (i >= midis.length ? 12 : 0); this.tper[i] = clamp(this.sr / A.mtof(m), 8, this.sr / 26); } }
    process(inL, inR, oL, oR, n){ const fb = this.fb, d = this.damp, g = this.gain;
      for (let i = 0; i < n; i++){ let l = 0, r = 0; const xl = inL[i] * .25, xr = inR[i] * .25;
        for (let k = 0; k < 6; k++){ this.per[k] += (this.tper[k] - this.per[k]) * .0005; const p = this.per[k];
          const yl = this.L[k].tapf(p - 1), yr = this.R[k].tapf(p * 1.0007 - 1); const a = k * 2;
          this.lp[a] += (yl - this.lp[a]) * (1 - d); this.lp[a + 1] += (yr - this.lp[a + 1]) * (1 - d);
          this.L[k].push(flush(xl + this.lp[a] * fb)); this.R[k].push(flush(xr + this.lp[a + 1] * fb)); l += yl; r += yr; }
        oL[i] += tanh(l * g) ; oR[i] += tanh(r * g); } } };

  // ---------------------------------------------------------------- vowel / formant filter (in place): 3 band-passes morphing a → e → i → o → u
  const VOW = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240]], VG = [1, .5, .25];
  A.Formant = class { constructor(sr){ this.sr = sr; this.f = []; for (let i = 0; i < 6; i++) this.f.push(new A.SVF()); this.ph = 0; this.set({}); }
    set(o){ this.vowel = o.vowel === undefined ? 0 : o.vowel; this.rate = o.rate || 0; this.depth = o.depth === undefined ? 1 : o.depth; this.mix = o.mix === undefined ? .8 : o.mix; this.q = o.q || 8; }
    process(L, R, n){ const sr = this.sr; this.ph += this.rate * n / sr; let v = this.vowel + (this.rate ? (.5 + .5 * A.sin1(this.ph)) * 4 * this.depth : 0); v = ((v % 4) + 4) % 4; const i0 = Math.floor(v), fr = v - i0, a = VOW[i0], b = VOW[(i0 + 1) % 5];
      for (let k = 0; k < 3; k++){ const fq = a[k] + (b[k] - a[k]) * fr; this.f[k].set(fq, this.q, sr); this.f[k + 3].set(fq * 1.01, this.q, sr); }
      for (let i = 0; i < n; i++){ let l = 0, r = 0; for (let k = 0; k < 3; k++){ this.f[k].tick(L[i]); l += this.f[k].bp * VG[k]; this.f[k + 3].tick(R[i]); r += this.f[k + 3].bp * VG[k]; }
        L[i] += (l - L[i]) * this.mix; R[i] += (r - R[i]) * this.mix; } } };

  // ---------------------------------------------------------------- wavefolder (in place): sine fold, then a gentle low-pass to tame the new highs
  A.Folder = class { constructor(sr){ this.sr = sr; this.lL = new A.SVF(); this.lR = new A.SVF(); this.set({}); }
    set(o){ this.drive = o.drive === undefined ? 2 : o.drive; this.mix = o.mix === undefined ? .5 : o.mix; this.lL.set(o.lp || 6000, .7, this.sr); this.lR.set(o.lp || 6000, .7, this.sr); }
    process(L, R, n){ const d = this.drive, m = this.mix; for (let i = 0; i < n; i++){ const fl = this.lL.tick(A.sin1(L[i] * d * .25)), fr = this.lR.tick(A.sin1(R[i] * d * .25)); L[i] += (fl * .7 - L[i]) * m; R[i] += (fr * .7 - R[i]) * m; } } };

  // ---------------------------------------------------------------- rotary speaker (in place): horn + drum, Doppler via modulated delay, AM, slow/fast with inertia
  A.Rotary = class { constructor(sr){ this.sr = sr; this.d = new Line(Math.round(sr * .02)); this.hp = 0; this.dp = 0; this.sp = .8; this.set({}); this.x = new A.SVF(); }
    set(o){ this.fast = !!o.fast; this.mix = o.mix === undefined ? .7 : o.mix; }
    process(L, R, n){ const sr = this.sr, tgt = this.fast ? 6.7 : .8; this.sp += (tgt - this.sp) * (1 - Math.exp(-n / (sr * (this.fast ? .9 : 1.6)))); this.x.set(800, .7, sr);
      for (let i = 0; i < n; i++){ const m = (L[i] + R[i]) * .5; this.x.tick(m); const lo = this.x.lp, hi = m - lo; this.d.push(hi);
        this.hp += this.sp / sr; this.dp += this.sp * .85 / sr; if (this.hp >= 1) this.hp -= 1; if (this.dp >= 1) this.dp -= 1;
        const s = A.sin1(this.hp), c = A.sin1(this.hp + .25), dd = A.sin1(this.dp);
        const h = this.d.tapf(sr * .0012 * (1 + .9 * s)), hl = h * (.75 + .25 * c), hr = h * (.75 - .25 * c), ll = lo * (.85 + .15 * dd), lr = lo * (.85 - .15 * dd);
        L[i] += (hl + ll - L[i]) * this.mix; R[i] += (hr + lr - R[i]) * this.mix; } } };

  // ---------------------------------------------------------------- trance gate (in place): 16-step volume pattern synced to the bar, 2 ms smoothing
  A.Gate = class { constructor(sr){ this.sr = sr; this.g = 1; this.pat = A.euclid(11, 16, 0); this.on = false; this.depth = 1; this.stepN = sr * .125; this.t0 = 0; this.k = 1 - Math.exp(-1 / (.002 * sr)); }
    process(L, R, n, t){ if (!this.on && this.g > .999) return; for (let i = 0; i < n; i++){ let tgt = 1; if (this.on){ const s = Math.floor((t + i - this.t0) / this.stepN), p = ((s % 16) + 16) % 16, ph = ((t + i - this.t0) / this.stepN) - s; tgt = this.pat[p] && ph < .72 ? 1 : 1 - this.depth; }
        this.g += (tgt - this.g) * this.k; L[i] *= this.g; R[i] *= this.g; } } };

  // ---------------------------------------------------------------- bus transport effects (in place): tape stop, buffer stutter (beat-repeat on real audio)
  A.BusFX = class { constructor(sr){ this.sr = sr; this.n = Math.round(sr * 3); this.bL = new Float32Array(this.n); this.bR = new Float32Array(this.n); this.w = 0; this.mode = 0; this.rd = 0; this.speed = 1; this.k = 0; this.fade = 1; }
    // tape stop: playback slows to zero over `dur` seconds (quadratic), then silence until release()
    tapeStop(dur){ this.mode = 1; this.rd = this.w - 1; this.speed = 1; this.decel = 1 / Math.max(.05, dur) / this.sr; this.fade = 1; }
    // stutter: loop the last `len` seconds for `dur` seconds, each repeat a little quieter (and optionally pitched up)
    stutter(len, dur, pitchUp){ this.mode = 2; this.len = Math.max(64, Math.round(len * this.sr)); this.s0 = (this.w - this.len + this.n) % this.n; this.i = 0; this.left = Math.round(dur * this.sr); this.rep = 0; this.pu = pitchUp || 0; this.rate = 1; this.fade = 1; }
    release(){ if (this.mode) { this.mode = 3; this.relN = Math.round(.006 * this.sr); this.relI = 0; } }
    process(L, R, n){ const N = this.n;
      for (let i = 0; i < n; i++){ this.bL[this.w] = L[i]; this.bR[this.w] = R[i]; this.w = (this.w + 1) % N; const m = this.mode; if (!m) continue;
        if (m === 1){ this.speed = Math.max(0, this.speed - this.decel * 2 * Math.max(.2, this.speed)); this.rd += this.speed; let p = this.rd % N; if (p < 0) p += N; const j = p | 0, f = p - j, j2 = (j + 1) % N;
          const g = Math.min(1, this.speed * 4); L[i] = (this.bL[j] + (this.bL[j2] - this.bL[j]) * f) * g; R[i] = (this.bR[j] + (this.bR[j2] - this.bR[j]) * f) * g; }
        else if (m === 2){ if (this.left-- <= 0){ this.release(); continue; } const len = this.len, pos = this.i, x = pos % len; let p = (this.s0 + x * this.rate) % N;
          const j = p | 0, f = p - j, j2 = (j + 1) % N, edge = Math.min(1, x / 96, (len - x) / 96), gg = Math.pow(.92, this.rep) * edge;
          L[i] = (this.bL[j] + (this.bL[j2] - this.bL[j]) * f) * gg; R[i] = (this.bR[j] + (this.bR[j2] - this.bR[j]) * f) * gg;
          if (++this.i % len === 0){ this.rep++; if (this.pu) this.rate = Math.min(2, this.rate * Math.pow(2, this.pu / 12)); } }
        else { const q = this.relI++ / this.relN; if (q >= 1){ this.mode = 0; continue; } L[i] *= q; R[i] *= q; } } } };   // short fade back in to the live signal
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_FX2;
