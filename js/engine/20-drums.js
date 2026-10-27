/* Maut ki Awaaz — engine module: drum voices.
   Every drum: tuned body + transient + soft nonlinearity + post filters; phase reset per hit; exponential pitch envelopes
   integrated into phase; small per-hit variation ("round robin"). Constants follow research/03 §3 (808 hat bank, 808 boom,
   909 kick/snare, clap burst timing). Voices add mono output into the track buffer (L and R). */
'use strict';
function AWZ_DRUMS(A){
  const TAU = A.TAU, tanh = A.tanh, clamp = A.clamp;

  // voice pool with stealing (oldest first); voices implement start(off, vel, p, rng) and render(L, R, n) → bool active
  A.Pool = class { constructor(make, n){ this.v = []; for (let i = 0; i < n; i++){ const x = make(i); x.age = 0; x.on = false; this.v.push(x); } this.clock = 0; }
    get(){ let best = null; for (const x of this.v) if (!x.on){ best = x; break; }
      if (!best){ let old = Infinity; for (const x of this.v) if (x.age < old){ old = x.age; best = x; } }
      best.age = ++this.clock; best.on = true; best.gl = 1; best.gr = 1; return best; }
    render(L, R, n){ let any = false; for (const x of this.v) if (x.on){ x.on = x.render(L, R, n); any = true; } return any; }
    each(fn){ for (const x of this.v) fn(x); }
    activeCount(){ let c = 0; for (const x of this.v) if (x.on) c++; return c; } };

  // ---------------------------------------------------------------- kick
  // p: fStart, fEnd, tau (pitch, s), sweep2 (extra fast sweep Hz), ampHold (s), ampTau (s), click (lin), drive, asym, lp, hp, knock (lin), knockF, blip (808 octave blip), sub (dry sine mix after drive)
  A.KickVoice = class { constructor(sr){ this.sr = sr; this.lp = new A.SVF(); this.hp = new A.OnePole(); this.kn = new A.SVF(); this.ck = new A.SVF(); this.nz = new A.Noise(7); }
    start(off, vel, p, r){ this.p = p; this.off = off; this.i = 0; this.ph = 0; this.vel = vel; const sr = this.sr, j = 1 + (r() * 2 - 1) * .012;
      this.fS = p.fStart * j; this.fE = p.fEnd * (1 + (r() * 2 - 1) * .004); this.kp = Math.exp(-1 / (p.tau * sr)); this.k2 = Math.exp(-1 / (.004 * sr)); this.kb = Math.exp(-1 / (.0025 * sr)); this.ks = Math.exp(-1 / (.12 * sr));
      this.e1 = 1; this.e2 = 1; this.eb = 1; this.es = 1; this.amp = 1; this.ka = Math.exp(-1 / (p.ampTau * (1 + (r() * 2 - 1) * .04) * sr)); this.hold = (p.ampHold || .012) * sr; this.atk = .0006 * sr;
      this.kc = Math.exp(-1 / ((p.clickTau || .0012) * sr)); this.ec = 1;
      this.lp.reset(); this.lp.set(p.lp || 9000, .6, sr); this.hp.setLP(p.hp || 28, sr); this.hp.z = 0; this.kn.reset(); this.kn.set(p.knockF || 1200, 1.4, sr); this.ck.reset(); this.ck.set(3000, .6, sr);
      this.dn = Math.tanh(p.drive || 1); this.len = Math.ceil((this.hold + p.ampTau * sr * 7) + this.atk); this.ekn = 1; this.kkn = Math.exp(-1 / (.008 * sr)); }
    render(L, R, n){ const p = this.p, sr = this.sr; let i0 = this.off; this.off = 0; const g = this.vel, drive = p.drive || 1, asym = p.asym || 0, ta = tanh(asym), dn = Math.tanh(drive + asym) - ta, blip = p.blip || 0, sub = p.sub || 0;
      for (let s = i0; s < n; s++){ const i = this.i++;
        let f = this.fE + (this.fS - this.fE) * this.e1 + (p.sweep2 || 0) * this.e2; if (blip) f *= (1 + blip * this.eb) * (1 + .04 * this.es);
        this.e1 *= this.kp; this.e2 *= this.k2; this.eb *= this.kb; this.es *= this.ks;
        this.ph += f / sr; if (this.ph >= 1) this.ph -= 1;
        let a; if (i < this.atk) a = i / this.atk; else if (i < this.hold) a = 1; else { this.amp *= this.ka; a = this.amp; }
        const body = A.sin1(this.ph) * a;
        let x = body;
        if (p.click){ this.ck.tick(this.nz.white()); x += this.ck.hp * this.ec * p.click; this.ec *= this.kc; }
        if (p.knock){ this.kn.tick(this.nz.white()); x += this.kn.bp * this.ekn * p.knock; this.ekn *= this.kkn; }
        let y = drive > 1.01 || asym ? (tanh(x * drive + asym) - ta) / dn : x;
        if (sub) y = y * (1 - sub) + body * sub;
        y = this.lp.tick(y); y = y - this.hp.lp(y);
        const o = y * g; L[s] += o * this.gl; R[s] += o * this.gr;
        if (i > this.len) return false; }
      return true; } };

  // ---------------------------------------------------------------- snare / clap / brush / rim
  // p.mode: 'snare' | 'clap' | 'brush' | 'rim' ; f1,f2 body, bodyTau, noiseF (BP), noiseQ, noiseTau, snap, body, noise, drive, hp, lp
  A.SnareVoice = class { constructor(sr){ this.sr = sr; this.bp = new A.SVF(); this.bp2 = new A.SVF(); this.hp = new A.SVF(); this.lp = new A.SVF(); this.r1 = new A.SVF(); this.r2 = new A.SVF(); this.nz = new A.Noise(11); this.bursts = new Float32Array(4); }
    start(off, vel, p, r){ this.p = p; this.off = off; this.i = 0; this.vel = vel; const sr = this.sr, m = p.mode || 'snare'; this.m = m;
      this.p1 = 0; this.p2 = 0; this.eb = 1; this.kb1 = Math.exp(-1 / ((p.bodyTau || .055) * sr)); this.kb2 = Math.exp(-1 / ((p.bodyTau || .055) * .64 * sr)); this.e1 = 1; this.e2 = 1; this.epd = 1; this.kpd = Math.exp(-1 / (.008 * sr));
      this.en = 1; this.kn = Math.exp(-1 / ((p.noiseTau || .14) * (1 + (r() * 2 - 1) * .06) * sr)); this.esn = 1; this.ksn = Math.exp(-1 / (.003 * sr));
      this.bp.reset(); this.bp.set(p.noiseF || 4500, p.noiseQ || .8, sr); this.bp2.reset(); this.bp2.set((p.noiseF || 1600) * 2, 1.5, sr); this.hp.reset(); this.hp.set(p.hp || 140, .7, sr); this.lp.reset(); this.lp.set(p.lp || 12000, .7, sr);
      if (m === 'clap'){ for (let k = 0; k < 4; k++) this.bursts[k] = ([0, .009, .018, .029][k] + (k ? (r() * 2 - 1) * .0015 : 0)) * sr; }
      if (m === 'rim'){ this.r1.reset(); this.r2.reset(); this.r1.set(p.f1 || 455, 30, sr); this.r2.set(p.f2 || 1667, 30, sr); }
      this.len = Math.ceil(sr * (m === 'rim' ? .12 : (p.noiseTau || .14) * 7 + .04)); this.dn = Math.tanh(p.drive || 1); }
    render(L, R, n){ const p = this.p, sr = this.sr, m = this.m, g = this.vel, drv = p.drive || 1; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; let x = 0; const w = this.nz.white();
        if (m === 'snare'){ const pd = 1 + .25 * this.epd; this.epd *= this.kpd;
          this.p1 += (p.f1 || 185) * pd / sr; this.p2 += (p.f2 || 330) * pd / sr; const atk = i < .0005 * sr ? i / (.0005 * sr) : 1;
          x = (A.sin1(this.p1) * this.e1 + A.sin1(this.p2) * this.e2 * .56) * (p.body === undefined ? 1 : p.body) * atk; this.e1 *= this.kb1; this.e2 *= this.kb2;
          this.bp.tick(w); const nzv = (this.bp.bp * .8 + (w - this.bp.lp) * .25) * this.en * (p.noise === undefined ? .8 : p.noise) * atk; this.en *= this.kn;
          x += nzv + w * this.esn * (p.snap || .3) * .5; this.esn *= this.ksn; }
        else if (m === 'clap'){ let e = 0; for (let k = 0; k < 3; k++){ const d = i - this.bursts[k]; if (d >= 0) e += Math.exp(-d / (.0025 * sr)) * (d < .0002 * sr ? d / (.0002 * sr) : 1); }
          const d3 = i - this.bursts[3]; if (d3 >= 0){ e += this.en * (d3 < .0002 * sr ? d3 / (.0002 * sr) : 1); this.en *= this.kn; }
          this.bp.tick(w); this.bp2.tick(w); x = (this.bp.bp + this.bp2.bp * .5) * e * 1.6; }
        else if (m === 'brush'){ const a = Math.min(1, i / (.025 * sr)); this.bp.tick(w); x = this.bp.bp * a * this.en * (.7 + .3 * A.sin1(i * 37 / sr)); this.en *= this.kn; }
        else { const imp = i < .0005 * sr ? (1 - i / (.0005 * sr)) * 8 : 0; this.r1.tick(imp); this.r2.tick(imp); x = this.r1.bp * .6 + this.r2.bp * .5; }
        let y = drv > 1.01 ? tanh(x * drv) / this.dn : x;
        this.hp.tick(y); y = this.hp.hp; y = this.lp.tick(y);
        const o = y * g; L[s] += o * this.gl; R[s] += o * this.gr;
        if (i > this.len) return false; }
      return true; } };

  // ---------------------------------------------------------------- 808-style metallic hats / cymbal / ride
  const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
  // p: tune (×), closedTau, openTau, bpF, hpF, air (noise), body (3440 band level for open)
  A.HatVoice = class { constructor(sr){ this.sr = sr; this.ph = new Float64Array(6); this.bp = new A.SVF(); this.bp2 = new A.SVF(); this.hp = new A.SVF(); this.hp2 = new A.SVF(); this.lp = new A.SVF(); this.nz = new A.Noise(13); this.choked = false; }
    start(off, vel, p, r, open){ this.p = p; this.off = off; this.i = 0; this.vel = vel; this.open = !!open; this.choked = false; const sr = this.sr;
      for (let k = 0; k < 6; k++) this.ph[k] = r(); this.tune = (p.tune || 1) * (1 + (r() * 2 - 1) * .006);
      const tau = (open ? (p.openTau || .16) : (p.closedTau || .018)) * (1 + (r() * 2 - 1) * .06); this.k = Math.exp(-1 / (tau * sr)); this.e = 1; this.kc = Math.exp(-1 / (.003 * sr));
      this.bp.reset(); this.bp.set(p.bpF || 7100, 1.2, sr); this.bp2.reset(); this.bp2.set(3440 * (p.tune || 1), 1.3, sr); this.hp.reset(); this.hp.set(p.hpF || 7000, .7, sr); this.hp2.reset(); this.hp2.set((p.hpF || 7000) * .9, .7, sr); this.lp.reset(); this.lp.set(p.lp || 15500, .6, sr);
      this.len = Math.ceil(tau * 7 * sr) + 64; }
    choke(){ this.choked = true; }
    render(L, R, n){ const p = this.p, sr = this.sr, g = this.vel, air = p.air === undefined ? .2 : p.air, body = this.open ? (p.body || .25) : 0; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; let m = 0;
        for (let k = 0; k < 6; k++){ const dt = HAT_F[k] * this.tune / sr; let t = this.ph[k] + dt; if (t >= 1) t -= 1; this.ph[k] = t; let q = t < .5 ? 1 : -1; q += A.blep(t, dt) - A.blep((t + .5) % 1, dt); m += q; }
        m = m / 6; const w = this.nz.white();
        this.bp.tick(m); this.bp2.tick(m); this.hp.tick(this.bp.bp + w * air * .6); this.hp2.tick(this.hp.hp);
        let y = this.hp2.hp + this.bp2.bp * body;
        y = this.lp.tick(y); const a = i < .0003 * sr ? i / (.0003 * sr) : 1;
        if (this.choked) this.e *= this.kc; else this.e *= this.k;
        const o = y * a * this.e * g * 1.6; L[s] += o * this.gl; R[s] += o * this.gr;
        if (i > this.len || this.e < 1e-4) return false; }
      return true; } };

  // ---------------------------------------------------------------- shaker (soft onset, band-limited noise)
  A.ShakerVoice = class { constructor(sr){ this.sr = sr; this.bp = new A.SVF(); this.hp = new A.SVF(); this.nz = new A.Noise(17); }
    start(off, vel, p, r){ this.p = p; this.off = off; this.i = 0; this.vel = vel; const sr = this.sr; this.atk = (p.atk || .008) * sr; this.k = Math.exp(-1 / ((p.tau || .045) * (1 + (r() * 2 - 1) * .1) * sr)); this.e = 1;
      this.bp.reset(); this.bp.set((p.f || 6500) * (1 + (r() * 2 - 1) * .03), .9, sr); this.hp.reset(); this.hp.set(p.hp || 4000, .7, sr); this.len = Math.ceil(this.atk + (p.tau || .045) * 7 * sr); }
    render(L, R, n){ const g = this.vel; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; this.bp.tick(this.nz.white()); this.hp.tick(this.bp.bp); let a; if (i < this.atk) a = i / this.atk; else { this.e *= this.k; a = this.e; }
        const o = this.hp.hp * a * g * 1.4; L[s] += o * this.gl; R[s] += o * this.gr; if (i > this.len) return false; }
      return true; } };

  // ---------------------------------------------------------------- tuned membrane: toms / congas / bongo (sine with pitch env + noise)
  // p: ratio (fStart/fEnd), pTau, ampTau, noise, noiseTau ; pitch from note
  A.TomVoice = class { constructor(sr){ this.sr = sr; this.bp = new A.SVF(); this.lp = new A.SVF(); this.nz = new A.Noise(19); }
    start(off, vel, p, r, f){ this.p = p; this.off = off; this.i = 0; this.vel = vel; const sr = this.sr; this.f = f * (1 + (r() * 2 - 1) * .008); this.ph = 0; this.ep = 1; this.kp = Math.exp(-1 / ((p.pTau || .045) * sr));
      this.e = 1; this.k = Math.exp(-1 / ((p.ampTau || .25) * (1 + (r() * 2 - 1) * .05) * sr)); this.en = 1; this.kn = Math.exp(-1 / ((p.noiseTau || .03) * sr));
      this.bp.reset(); this.bp.set(f * 2, 1.2, sr); this.lp.reset(); this.lp.set(p.lp || 5000, .6, sr); this.len = Math.ceil((p.ampTau || .25) * 7 * sr); }
    render(L, R, n){ const p = this.p, sr = this.sr, g = this.vel, ratio = (p.ratio || 1.6) - 1, nzA = p.noise === undefined ? .15 : p.noise; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; const f = this.f * (1 + ratio * this.ep); this.ep *= this.kp; this.ph += f / sr; if (this.ph >= 1) this.ph -= 1;
        const a = i < .0008 * sr ? i / (.0008 * sr) : 1; this.bp.tick(this.nz.white());
        let y = A.sin1(this.ph) * this.e * a + this.bp.bp * this.en * nzA; this.e *= this.k; this.en *= this.kn;
        y = this.lp.tick(tanh(y * 1.3) / .86); const o = y * g; L[s] += o * this.gl; R[s] += o * this.gr; if (i > this.len) return false; }
      return true; } };

  // ---------------------------------------------------------------- resonant perc: clave / woodblock / metal tick (high-Q resonators struck by an impulse)
  // p: ratios [..], q, tau, gains [..], noise
  A.ResPercVoice = class { constructor(sr){ this.sr = sr; this.r = [new A.SVF(), new A.SVF(), new A.SVF()]; this.hp = new A.SVF(); this.nz = new A.Noise(23); }
    start(off, vel, p, r, f){ this.p = p; this.off = off; this.i = 0; this.vel = vel; const sr = this.sr, rat = p.ratios || [1, 2.57, 4.42];
      for (let k = 0; k < 3; k++){ this.r[k].reset(); this.r[k].set(Math.min(f * (rat[k] || 0) || 1, sr * .45), p.q || 35, sr); }
      this.hp.reset(); this.hp.set(p.hp || 250, .7, sr); this.k = Math.exp(-1 / ((p.tau || .03) * sr)); this.e = 1; this.len = Math.ceil((p.tau || .03) * 8 * sr) + 32; }
    render(L, R, n){ const p = this.p, sr = this.sr, g = this.vel, gains = p.gains || [1, .45, .2]; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; const imp = i < .0005 * sr ? (1 - i / (.0005 * sr)) * 6 + this.nz.white() * (p.noise || .3) : 0;
        let y = 0; for (let k = 0; k < 3; k++){ if (!gains[k]) continue; this.r[k].tick(imp); y += this.r[k].bp * gains[k]; }
        this.hp.tick(tanh(y * this.e * 1.5)); this.e *= this.k; const o = this.hp.hp * g; L[s] += o * this.gl; R[s] += o * this.gr; if (i > this.len) return false; }
      return true; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_DRUMS;
