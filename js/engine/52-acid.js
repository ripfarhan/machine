/* Maut ki Awaaz — engine module: TB-303 acid voice and sequencer (v2, additive). Every number below is from
   research/08-acid-science.md (section in brackets).
   Voice, stage by stage:
     oscillator  PolyBLEP saw; the 303 square = −tanh(70·saw + 4.37) on the half-cycle-shifted saw (~47 % duty, one sharp
                 and one rounded edge) + a 44.5 Hz high-pass  [6.1]
     filter      the TB-303 diode ladder as fitted by Open303 "TB_303": 4 coupled poles, resonance loop gain up to ~16 (it
                 self-oscillates at 17, capped below), a 150 Hz high-pass in the feedback, soft cubic saturation, passband
                 gain falling as resonance rises (the 303's bass loss), peak rising with resonance; 4x oversampled  [6.2]
     cutoff      f = 313.8·7.63^c · 2^(S·(MEG − O) + accent): exponential, bipolar env mod that never reaches zero  [6.3]
     MEG         instant attack, τ = 200·10^decay ms — accented notes fixed at τ = 200 ms; slid notes do not retrigger  [6.4]
     accent      VCA + (0.45 + 3·accent)·MEG, and the sweep capacitor: charged through a diode (τc = 47 + 100·res ms),
                 leaking at τd = 100 ms — consecutive accents ratchet the cutoff up ~33 % and lag ~96 ms: the "wow"  [1.8, 6.3]
     VEG         instant attack, τ = 1.23 s decay; at gate end 8 ms hold + 8 ms linear fall; gain de-clicked by 2 poles @200 Hz [6.4]
     slide       one-pole on log2(frequency), τ = 22 ms, not tied to tempo; gate held through the step, no retrigger  [6.5]
     drive       post-filter tanh(d·x + 0.15) − tanh(0.15), d = 6…30 dB, first-order ADAA at 4x, tone low-pass 3.5–7 kHz  [6.6]
     de-harsh    a dynamic bell (−3 dB max at 3.2 kHz) when the 2.5–4.5 kHz band runs > 6 dB over 0.3–2.5 kHz  [6.8]
   Knobs per note in ev.mod (all 0…1): cut, res, env, dec, acc, dist, wave (+ accOn flag), smoothed like hands on knobs. */
'use strict';
function AWZ_ACID(A){
  const clamp = A.clamp, blep = A.blep, LN2 = Math.LN2;
  const TAU = (sec, rate) => 1 - Math.exp(-1 / (sec * rate));
  const logcosh = x => { const a = Math.abs(x); return a + Math.log1p(Math.exp(-2 * a)) - LN2; };
  const OS = 4;

  A.AcidVoice = class {
    constructor(sr, seed){ this.sr = sr; this.fs = sr * OS; const r = this.r = A.rng(seed || 5);
      this.ph = r(); this.lf = Math.log2(110); this.lt = this.lf; this.y1 = 0; this.y2 = 0; this.y3 = 0; this.y4 = 0; this.fbh = 0; this.sqh = 0;
      this.meg = 0; this.megS = 0; this.accOn = 0; this.vc = 0; this.veg = 0; this.gateLeft = 0; this.relI = -1; this.ga = 0; this.gb = 0; this.vel = .85;
      this.k = {cut: .3, res: .6, env: .5, dec: .3, acc: .6, dist: .3, wave: 0, gain: 1}; this.kt = Object.assign({}, this.k);
      this.d1 = new A.SVF(); this.d2 = new A.SVF(); this.d1.set(17500, .5412, this.fs); this.d2.set(17500, 1.3066, this.fs);   // 4-pole Butterworth decimator
      this.xp = 0; this.tone = 0; this.dcx = 0; this.dcy = 0; this.on = false; this.gl = 1; this.gr = 1; this.note = 45; this.f0 = 110; this.cutNow = 400; this.off = 0;
      this.duty = (r() - .5) * .04;   // unit-to-unit variance of the square's duty (±2 %)
      this.kSlide = TAU(.022, sr); this.kKnob = TAU(.012, sr); this.kMeg = TAU(.003, sr); this.kVeg = Math.exp(-1 / (1.23 * sr)); this.kGain = TAU(1 / (2 * Math.PI * 200), sr);
      this.kFbHp = TAU(1 / (2 * Math.PI * 150), this.fs); this.kSqHp = TAU(1 / (2 * Math.PI * 44.5), this.fs); this.kDc = Math.exp(-2 * Math.PI * 24 / sr);
      this.dt = 1 / sr; this.relHold = Math.round(.008 * sr); this.relLen = Math.round(.008 * sr);
      // de-harsh detector + bell
      this.bH = new A.SVF(); this.bM = new A.SVF(); this.bell = new A.SVF(); this.bH.set(3300, .9, sr); this.bM.set(900, .5, sr); this.bell.set(3200, 1.5, sr); this.eH = 1e-9; this.eM = 1e-9; this.bellG = 1; this.kEn = TAU(.05, sr); }
    knobs(p){ const t = this.kt; if (p.cut !== undefined) t.cut = +p.cut; if (p.res !== undefined) t.res = +p.res; if (p.env !== undefined) t.env = +p.env; if (p.dec !== undefined) t.dec = +p.dec;
      if (p.acc !== undefined) t.acc = +p.acc; if (p.dist !== undefined) t.dist = +p.dist; if (p.wave !== undefined) t.wave = +p.wave; if (p.gain !== undefined) t.gain = +p.gain; }
    start(off, note, vel, dur, p){ this.off = off; this.knobs(p); if (!this.on) this.k = Object.assign({}, this.kt);
      this.note = note; this.lt = Math.log2(A.mtof(note)); this.lf = this.lt; this.vel = vel; this.accOn = p.accOn ? 1 : 0;
      this.meg = 1; this.veg = 1; this.relI = -1; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); }
    glide(note, dur, p){ this.knobs(p); this.note = note; this.lt = Math.log2(A.mtof(note)); this.relI = -1; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); }
    release(){ this.gateLeft = 0; }
    render(L, R, n){ const K = this.k, T = this.kt, fs = this.fs, d1 = this.d1, d2 = this.d2; let i0 = this.off; this.off = 0;
      for (let n0 = i0; n0 < n; n0++){
        // ---- control, once per output sample
        const kk = this.kKnob; K.cut += (T.cut - K.cut) * kk; K.res += (T.res - K.res) * kk; K.env += (T.env - K.env) * kk; K.dec += (T.dec - K.dec) * kk;
        K.acc += (T.acc - K.acc) * kk; K.dist += (T.dist - K.dist) * kk; K.wave += (T.wave - K.wave) * kk; K.gain += (T.gain - K.gain) * kk;
        this.lf += (this.lt - this.lf) * this.kSlide; const f = Math.pow(2, this.lf); this.f0 = f;
        const decT = this.accOn ? .2 : .2 * Math.pow(10, clamp(K.dec, 0, 1)); this.meg *= Math.exp(-this.dt / decT); this.megS += (this.meg - this.megS) * this.kMeg;
        // gate → VEG: τ 1.23 s while held; after the gate, 8 ms hold then an 8 ms linear fall
        let rel = 1; if (this.gateLeft > 0){ this.gateLeft--; if (this.gateLeft === 0) this.relI = 0; } else if (this.relI >= 0){ this.relI++; rel = this.relI < this.relHold ? 1 : Math.max(0, 1 - (this.relI - this.relHold) / this.relLen); }
        this.veg *= this.kVeg;
        const res = clamp(K.res, 0, 1), acc = clamp(K.acc, 0, 1), megA = this.accOn ? this.megS : 0;
        // accent sweep capacitor (diode charge, leak), smoothing set by the resonance gang
        const tc = .047 + .1 * res; this.vc += (Math.max(0, megA - .1 - this.vc) / tc - this.vc / .1) * this.dt;
        const accTerm = acc * ((1 - res) * megA + res * this.vc / .28);
        // cutoff: knob → Hz, bipolar exponential env mod (S octaves, offset O), accent on top
        const c = clamp(K.cut, 0, 1), m = clamp(K.env, 0, 1), S = (1 - c) * (3.774 * m + .737) + c * (4.195 * m + .864), O = .0483 * c + .294;
        let fr = 313.8 * Math.pow(7.6305, c) * Math.pow(2, S * (this.megS - O) + accTerm); fr = clamp(fr, 200, 18000); this.cutNow = fr;
        // diode-ladder coefficients (Open303 TB_303 fit)
        const fx = fr / (Math.SQRT2 * fs), rr = (1 - Math.exp(-3 * res * .93)) / (1 - Math.exp(-3)), fx2 = fx * fx, fx3 = fx2 * fx;
        const b0 = (.00045522346 + 6.1922189 * fx) / (1 + 12.358354 * fx + 4.4156345 * fx2), poly = 16.998792 + 213.87126 * fx + 614.95611 * fx2 - 476.47308 * fx3 - 5837.7917 * fx3 * fx + 7198.6997 * fx3 * fx2 + fx3 * fx3;
        const kf = rr * poly, gc = (1 + rr) * (1 + rr * (poly / 17 - 1)) * 2;
        // VCA: envelope + accent, de-clicked by two poles at 200 Hz
        const vcaRaw = (this.veg + this.accOn * (.45 + 3 * acc) * this.meg) * rel * this.vel * .32 * K.gain;
        this.ga += (vcaRaw - this.ga) * this.kGain; this.gb += (this.ga - this.gb) * this.kGain; const vca = this.gb;
        const dist = clamp(K.dist, 0, 1), dOn = dist > .02, dDb = 6 + 24 * dist, dGain = Math.pow(10, dDb / 20), bias = .15, tb = Math.tanh(bias), comp = (.5 / Math.tanh(dGain * .5)) * Math.pow(10, -.15 * (dDb - 6) / 20),
          toneK = TAU(1 / (2 * Math.PI * (6000 - 3000 * dist)), fs), wv = clamp(K.wave, 0, 1), dt = f / fs, wet = clamp(dist * 2, 0, 1);
        let out = 0;
        for (let o = 0; o < OS; o++){
          let ph = this.ph + dt; if (ph >= 1) ph -= 1; this.ph = ph;
          const saw = 2 * ph - 1 - blep(ph, dt); let x = saw;
          if (wv > .001){ let p2 = ph + .5 + this.duty; p2 -= Math.floor(p2); const s2 = 2 * p2 - 1 - blep(p2, dt), sq = -Math.tanh(70 * s2 + 4.37);
            this.sqh += (sq - this.sqh) * this.kSqHp; x = saw + (sq - this.sqh - saw) * wv; }
          // ladder: u = x − HP150(k·sat(y4))
          let yv = this.y4; if (yv > 1.4142) yv = 1.4142; else if (yv < -1.4142) yv = -1.4142; const fbIn = kf * (yv - yv * yv * yv / 6);
          this.fbh += (fbIn - this.fbh) * this.kFbHp; const u = x - (fbIn - this.fbh);
          this.y1 += 2 * b0 * (u - this.y1 + this.y2); this.y2 += b0 * (this.y1 - 2 * this.y2 + this.y3); this.y3 += b0 * (this.y2 - 2 * this.y3 + this.y4); this.y4 += b0 * (this.y3 - 2 * this.y4);
          let a = gc * this.y4 * vca;
          // pedal after the filter: ADAA tanh (antiderivative = log cosh)
          if (dOn){ const xi = dGain * a + bias, dx = xi - this.xp; const y = Math.abs(dx) > 1e-5 ? (logcosh(xi) - logcosh(this.xp)) / dx : Math.tanh(.5 * (xi + this.xp)); this.xp = xi;
            a = a + ((y - tb) * comp - a) * wet; }
          this.tone += (a - this.tone) * toneK; d1.run(this.tone); d2.run(d1.lp); out = d2.lp; }
        if (this.y4 < 1e-20 && this.y4 > -1e-20){ this.y1 = this.y2 = this.y3 = this.y4 = 0; }
        // de-harsh: dynamic bell at 3.2 kHz
        this.bH.run(out); this.bM.run(out); this.eH += (this.bH.bp * this.bH.bp - this.eH) * this.kEn; this.eM += (this.bM.bp * this.bM.bp - this.eM) * this.kEn;
        const over = 10 * Math.log10((this.eH + 1e-12) / (this.eM + 1e-12)) - 6, tgt = over > 0 ? Math.pow(10, -Math.min(3, over * .5) / 20) : 1; this.bellG += (tgt - this.bellG) * this.kEn;
        if (this.bellG < .999){ this.bell.run(out); out += (this.bellG - 1) * this.bell.k * this.bell.bp; }
        // 24 Hz high-pass (the 303's output coupling)
        const yo = out - this.dcx + this.kDc * this.dcy; this.dcx = out; this.dcy = yo;
        L[n0] += yo * this.gl; R[n0] += yo * this.gr;
        if (this.gateLeft === 0 && this.relI > this.relHold + this.relLen + 400 && Math.abs(this.gb) < 1e-5){ this.relI = -1; return false; } }
      return true; } };

  // mono instrument with 303 tie semantics: a note flagged slide that lands while the gate is still open glides, no retrigger
  A.AcidInst = class { constructor(sr, patch, seed){ this.sr = sr; this.patch = patch || {}; this.v = new A.AcidVoice(sr, seed); this.pend = []; this.var = 0; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ const v = this.v, p = ev.mod ? Object.assign({}, this.patch, ev.mod) : this.patch, vel = clamp(ev.vel === undefined ? .85 : ev.vel, 0, 1.2), dur = ev.dur || .1;
      if (ev.slide && v.on && v.gateLeft > 0) v.glide(ev.note, dur, p); else { v.start(off, ev.note, vel, dur, p); v.on = true; }
      const pan = ev.pan || 0; v.gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2; v.gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2; }
    render(L, R, n){ return A.segRender(this, L, R, n); }
    renderVoices(L, R, n){ const v = this.v; if (!v.on) return false; v.on = v.render(L, R, n); return v.on; }
    allOff(){ this.pend.length = 0; this.v.gateLeft = 0; } };

  // ---------------------------------------------------------------- the sequencer and the hands on the knobs
  const P = A.PARTS, fit = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
  const ease = q => .5 - .5 * Math.cos(Math.PI * clamp(q, 0, 1));
  const DEG_LOW = {0: .45, 12: .15, 3: .08, 7: .08, 10: .08, 5: .04, 1: .04, 99: .08}, DEG_UP = {0: .35, 12: .2, 3: .12, 7: .12, 10: .12, 5: .05};
  // one 16-step pattern [6.10]: Note .68 / Rest .22 / Tie .10, rests leaning onto the "e" and "a"; root .45, +12 .15, b3 / 5 / b7 .08,
  // 4 / b2 .04, chromatic neighbour .08 (forced slide); octave up .18 / down .05; accents .28 leaning off-beat with one 2–4 run
  // (p .3); slides .18 (→ .5 into an octave jump or a semitone); 8 candidates scored on root ratio, flourishes and syncopation
  function genPattern(r, opts, depth){ const up = !!opts.up; let best = null, bs = -1e9;
    for (let cand = 0; cand < 8; cand++){ const st = []; let restRun = 0;
      for (let i = 0; i < 16; i++){ const e_a = i % 2 === 1, down = i % 4 === 0;
        let type; if (i === 0) type = r() < .95 ? 'note' : 'rest'; else type = r.weighted({note: .68, rest: .22 * (e_a ? 1.4 : down ? .6 : 1) * (up ? 1.6 : 1), tie: .1});
        if (type === 'rest' && restRun >= 3) type = 'note'; if (type === 'tie' && (!i || st[i - 1].type === 'rest')) type = 'note'; restRun = type === 'rest' ? restRun + 1 : 0;
        const deg = +r.weighted(up ? DEG_UP : DEG_LOW); st.push({type, deg: deg === 99 ? 0 : deg, chrom: deg === 99, oct: 0, acc: false, slide: false}); }
      for (let i = 0; i < 16; i++){ const s = st[i]; if (s.type !== 'note') continue; const u = r(); s.oct = u < .18 ? 12 : u < .23 && !(i > 0 && st[i - 1].oct < 0) ? -12 : 0; }
      // chromatic neighbours: a semitone off the next note, always slid into it
      for (let i = 0; i < 16; i++){ const s = st[i]; if (!s.chrom) continue; const nx = st[(i + 1) % 16]; if (nx.type !== 'note' || s.type !== 'note'){ s.chrom = false; continue; } s.deg = nx.deg + (r() < .5 ? -1 : 1); s.oct = nx.oct; s.slide = true; }
      // accents
      let nAcc = 0; for (let i = 0; i < 16; i++){ const s = st[i]; if (s.type !== 'note') continue; if (r() < .28 * (i % 2 ? 1.5 : .75)){ s.acc = true; nAcc++; } }
      if (r() < .3){ const a0 = r.int(0, 12), len = r.int(2, 4); for (let i = a0; i < a0 + len && i < 16; i++) if (st[i].type === 'note' && !st[i].acc){ st[i].acc = true; nAcc++; } }
      for (let i = 15; nAcc > 7 && i >= 0; i--) if (st[i].acc){ st[i].acc = false; nAcc--; }
      for (let i = 0; nAcc < 2 && i < 16; i += 3) if (st[i].type === 'note' && !st[i].acc){ st[i].acc = true; nAcc++; }
      // slides
      let run = 0; for (let i = 0; i < 16; i++){ const s = st[i], nx = st[(i + 1) % 16]; if (s.type !== 'note' || nx.type !== 'note'){ run = 0; continue; } if (s.slide){ run++; continue; }
        const jump = Math.abs((nx.deg + nx.oct) - (s.deg + s.oct)), p = jump === 12 || jump === 1 ? .5 : .18; if (run < 3 && r() < (up ? p * .6 : p)){ s.slide = true; run++; } else run = 0; }
      // score
      const notes = st.filter(s => s.type === 'note'), rootR = notes.filter(s => s.deg === 0 || s.deg === 12).length / Math.max(1, notes.length);
      const flour = st.filter((s, i) => s.slide && (s.chrom || st[(i + 1) % 16].oct !== s.oct)).length, sync = st.filter((s, i) => i % 2 === 1 && s.type === 'note').length + st.filter((s, i) => i % 2 === 1 && s.acc).length;
      if (sync < 2 || sync > 8) continue; let sc = 0; if (rootR >= .4 && rootR <= .6) sc += 2; else sc -= Math.abs(rootR - .5) * 4; if (flour >= 1 && flour <= 2) sc += 1.5; if (sync >= 3 && sync <= 6) sc += 2; sc += r() * .5;
      if (sc > bs){ bs = sc; best = st; } }
    return best || ((depth || 0) < 4 ? genPattern(r, opts, (depth || 0) + 1) : Array.from({length: 16}, (_, i) => ({type: i % 2 ? 'rest' : 'note', deg: 0, chrom: false, oct: i % 8 === 6 ? 12 : 0, acc: i % 4 === 2, slide: false}))); }
  function mutate(r, pat){ const q = pat.map(s => Object.assign({}, s)), i = r.int(1, 15), s = q[i], m = r.int(0, 3);
    if (m === 3){ const first = q.shift(); q.push(first); return q; }   // rotate the rhythm by one
    if (s.type === 'note'){ if (m === 0) s.acc = !s.acc; else if (m === 1) s.slide = !s.slide && q[(i + 1) % 16].type === 'note'; else s.oct = s.oct ? 0 : 12; } return q; }
  function sister(r, pat){ let q = pat; for (let k = 0; k < 4; k++) q = mutate(r, q); return q; }   // ≥ 60 % of steps shared

  P.tb303 = class {
    constructor(Pc, o){ this.slot = o.slot || 'acid'; const r = this.r = Pc.rng('tb303' + this.slot); this.layer = o.layer || 0; this.vel = o.vel || .85; this.pan = o.pan || 0;
      this.wave = o.wave !== undefined ? o.wave : (r() < .62 ? 0 : 1); this.A = genPattern(r, {up: this.layer > 0}); this.B = sister(r, this.A); this.C = genPattern(r, {up: this.layer > 0}); this.cur = this.A;
      // hands: arc (32/64 bars, raised cosine) + phrase ride (8/16 bars, eased 1–4 bars) + wobble (1/f, ±0.04)  [6.9]
      this.arc = {from: .08, to: .3, at: 0, len: 32}; this.ph = {from: 0, to: 0, at: 0, ease: 2, next: 8}; this.wob = [0, 0, 0]; this.highBars = 0; this.lastTag = null; this.secAt = 0; this.decAt = r.int(0, 15); this.K1 = null; this.lastBar = -9; }
    cutArc(bar){ const A0 = this.arc; return A0.from + (A0.to - A0.from) * ease((bar - A0.at) / A0.len); }
    phRide(bar){ const Ph = this.ph; return Ph.from + (Ph.to - Ph.from) * ease((bar - Ph.at) / Ph.ease); }
    knobsAt(bar, c){ const r = this.r, S = c.section || {}, tag = S.tag || S.name || '', E = c.E, A0 = this.arc, Ph = this.ph;
      if (tag !== this.lastTag){ this.lastTag = tag; this.secAt = bar; const now = this.cutArc(bar);
        if (tag === 'break' || tag === 'outro') this.arc = {from: now, to: .05 + .1 * r(), at: bar, len: 1};
        else if (tag === 'build') this.arc = {from: Math.min(now, .25), to: .7 + .12 * r(), at: bar, len: Math.max(8, S.bars || 16)};
        else if (tag === 'peak') this.arc = {from: now, to: .56 + .14 * r(), at: bar, len: 4};
        else this.arc = {from: now, to: clamp(.1 + E * .55, .08, .7), at: bar, len: r() < .5 ? 32 : 64}; }
      else if (bar - A0.at >= A0.len && tag !== 'break' && tag !== 'outro'){ const now = this.cutArc(bar); this.arc = {from: now, to: clamp(.08 + E * .62 + (r() - .5) * .2, .05, .72), at: bar, len: r() < .5 ? 32 : 64}; }
      if (bar >= Ph.next){ const cur = this.phRide(bar); this.ph = {from: cur, to: (r() - .5) * .3, at: bar, ease: r.int(1, 4), next: bar + (r() < .5 ? 8 : 16)}; }
      for (let k = 0; k < 3; k++) this.wob[k] = this.wob[k] * .7 + (r() - .5) * .04 / (k + 1);
      let cut = clamp(this.cutArc(bar) + this.phRide(bar) + this.wob[0] + this.wob[1] + this.wob[2], .02, .85);
      // never park the peak above ~2.5 kHz for more than 8 bars  [6.9, 4.7]
      this.highBars = cut > .68 ? this.highBars + 1 : 0; if (this.highBars > 8) cut -= .12;
      const cutN = clamp((cut - .08) / .62, 0, 1), fresh = bar - this.secAt < 1;
      const res = fresh ? .5 : clamp(.55 + .33 * cutN + this.wob[1] * 2 + (tag === 'break' ? .1 : 0), .4, .92);
      const env = clamp(.85 - .6 * cutN + this.wob[2] * 3 + (tag === 'break' ? .1 : 0), .25, .85);
      const tri = Math.abs(((bar + this.decAt) % 16) / 8 - 1), dec = clamp(.15 + .45 * (1 - tri) + (tag === 'build' || tag === 'break' ? .15 : 0), .1, .8);
      const acc = tag === 'peak' ? .9 : clamp(.5 + .3 * E * E, .5, .85), dist = clamp(.25 + .5 * E, .2, .75);
      return {cut, res, env, dec, acc, dist}; }
    bar(c){ const r = this.r, S = c.section || {}, tag = S.tag || S.name || '', E = c.E, bar = c.barIndex;
      // a seek or a new piece: re-anchor the hands at this bar
      if (bar !== this.lastBar + 1) this.K1 = null; this.lastBar = bar;
      const K0 = this.K1 || this.knobsAt(bar, c), K1 = this.knobsAt(bar + 1, c); this.K1 = K1;
      if (this.layer && E < .55) return;
      // patterns: rare note changes; the knobs carry the form  [6.10]
      if (bar % 8 === 0 && r() < .5) this.B = mutate(r, this.B);
      if (bar % 32 === 0 && bar > 0){ if (r() < .5) this.A = sister(r, this.A); else this.C = genPattern(r, {up: this.layer > 0}); }
      if (bar % 8 === 0) this.cur = tag === 'break' || tag === 'outro' ? this.C : (bar / 8) % 4 === 3 ? this.B : this.A;
      const pat = this.cur, root = fit(c.chordRoot + (this.layer ? 48 : 36), this.layer ? 45 : 33, this.layer ? 57 : 45), tilt = (c.brightness - .5) * .12;
      for (let s = 0; s < 16; s++){ const st = pat[s]; if (st.type !== 'note') continue; if (c.density < .3 && (s & 1) && !st.acc) continue;
        let len = 1; while (len < 4 && s + len < 16 && pat[s + len].type === 'tie') len++;   // ties hold the gate
        const nx = pat[(s + len) % 16], slideOut = st.slide && nx.type === 'note', pv = pat[(s + 15) % 16], slideIn = s > 0 && pv.type === 'note' && pv.slide;
        let m = root + st.deg + st.oct; if (!st.chrom && !c.key.inScale(m)) m = c.key.snap(m);
        const q = s / 16, L = (a, b) => a + (b - a) * q;
        c.emit(this.slot, s, {note: m, vel: this.vel, dur: c.step * (slideOut ? len + .12 : len - 1 + .55), slide: slideIn, pan: this.pan,
          mod: {cut: clamp(L(K0.cut, K1.cut) + tilt - (this.layer ? .1 : 0), 0, 1), res: L(K0.res, K1.res), env: L(K0.env, K1.env), dec: L(K0.dec, K1.dec), acc: L(K0.acc, K1.acc),
            dist: clamp(L(K0.dist, K1.dist) - (this.layer ? .1 : 0), 0, 1), accOn: st.acc ? 1 : 0, wave: this.wave}}); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_ACID;
