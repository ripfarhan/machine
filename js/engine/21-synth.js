/* Maut ki Awaaz — engine module: melodic voices.
   VAVoice: virtual-analog poly voice (2 osc + sub + noise, unison with random phase and drift, ladder or SVF, exponential
   ADSRs, LFO). BassVoice: separated sine sub + filtered harmonic layer (research/03 §4). Modal voices: felt piano, EP,
   mallets — damped resonator banks struck by a soft hammer (research/03 §5.6), replacing the FM piano and KS pluck. */
'use strict';
function AWZ_SYNTH(A){
  const TAU = A.TAU, tanh = A.tanh, clamp = A.clamp, mtof = A.mtof;
  const CR = 16;   // control-rate interval (samples)
  // shared live modulation (macros → held notes): patch.live = {cut (oct), lfo (oct depth), res, rate}
  const LIVE0 = {cut: 0, lfo: 0, res: 0, rate: 0}; A.LIVE0 = LIVE0; A.live = () => ({cut: 0, lfo: 0, res: 0, rate: 0});

  // ---------------------------------------------------------------- VA poly voice
  A.VAVoice = class { constructor(sr, seed){ this.sr = sr; this.o = []; for (let k = 0; k < 6; k++) this.o.push(new A.VAOsc(sr, seed * 7 + k));
      this.fL = new A.Ladder(); this.fR = new A.Ladder(); this.sL = new A.SVF(); this.sR = new A.SVF(); this.fenv = new A.ADSR(sr); this.aenv = new A.ADSR(sr); this.nz = new A.Noise(seed * 13 + 5); this.subPh = 0; this.r = A.rng(seed * 31 + 3); }
    start(off, note, vel, dur, p){ const sr = this.sr; this.p = p; this.off = off; this.note = note; this.vel = vel; this.cnt = 0; this.gateLeft = Math.max(1, Math.round(dur * sr));
      this.freq = mtof(note); this.target = this.freq; this.det0 = (this.r() * 2 - 1) * (p.detuneRand === undefined ? 3 : p.detuneRand);
      const sounding = this.aenv.stage > 0 && this.aenv.v > 1e-3;   // re-used while audible (mono retrigger / steal): keep phase + filter state → no click
      const reset = p.phaseReset; if (!sounding) for (let k = 0; k < 6; k++) this.o[k].ph = reset ? 0 : this.r();
      if (!sounding) this.subPh = 0; this.cutJ = 1 + (this.r() * 2 - 1) * .045; this.lfoPh = this.r(); this.vibT = 0;
      this.fenv.setTimes(p.fa || .001, p.fd || .3, p.fs === undefined ? 0 : p.fs, p.fr || .3); this.aenv.setTimes(p.aa || .002, p.ad || .4, p.as === undefined ? .7 : p.as, (p.ar || .3) * (1 + (this.r() * 2 - 1) * .06));
      this.fenv.v = 0; this.fenv.trigger(1); this.aenv.trigger(1); if (!p.legatoKeep && !sounding){ this.fL.reset(); this.fR.reset(); this.sL.reset(); this.sR.reset(); }
      this.k = 0; this.panW = 0;
      // unison detune ratios and pan gains are fixed per note: precompute (was pow() per sample per voice)
      const U = Math.max(1, Math.min(3, p.unison || 1)), sp = p.spread || 0, panSp = p.uniPan === undefined ? .6 : p.uniPan; this.U = U;
      if (!this.um){ this.um = new Float64Array(3); this.uL = new Float64Array(3); this.uR = new Float64Array(3); }
      for (let u = 0; u < U; u++){ const cents = U > 1 ? (u / (U - 1) - .5) * sp : 0; this.um[u] = Math.pow(2, (cents + this.det0) / 1200);
        const pan = U > 1 ? (u / (U - 1) - .5) * 2 * panSp : 0, c = .5 * (1 - Math.abs(pan)); this.uL[u] = (1 - pan) * .5 + c; this.uR[u] = (1 + pan) * .5 + c; } }
    glideTo(note, dur){ this.target = mtof(note); this.note = note; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); }
    release(){ this.gateLeft = 0; this.fenv.release(); this.aenv.release(); }
    render(L, R, n){ const p = this.p, sr = this.sr; let i0 = this.off; this.off = 0;
      const U = this.U, ladder = p.filter !== 'svf', o2 = p.osc2Level === undefined ? .7 : p.osc2Level, subL = p.sub || 0, nzL = p.noise || 0;
      const s1 = p.shape1 === undefined ? 2 : p.shape1, s2 = p.shape2 === undefined ? 2 : p.shape2, semi2 = Math.pow(2, ((p.semi2 || 0) * 100 + (p.detune2 || 7)) / 1200), drift = p.drift === undefined ? 3 : p.drift;
      const lv = p.live || LIVE0, gU = 1 / Math.sqrt(U * (1 + o2 * o2)), glideK = p.glide ? 1 - Math.exp(-1 / (p.glide * sr)) : 1;
      let cut = 0, fsr = 0;
      for (let s = i0; s < n; s++){
        if (this.gateLeft > 0 && --this.gateLeft === 0){ this.fenv.release(); this.aenv.release(); }
        if (this.k-- <= 0){ this.k = CR;
          this.freq += (this.target - this.freq) * (glideK === 1 ? 1 : 1 - Math.pow(1 - glideK, CR));
          this.lfoPh += (p.lfoRate || .2) * (1 + lv.rate) * CR / sr; const lfo = A.sin1(this.lfoPh);
          const kt = Math.pow(2, (this.note - 60) / 12 * (p.keytrack === undefined ? .5 : p.keytrack));
          const env = this.fenv.v, venv = (p.envAmt || 0) + (p.velEnv || 0) * (this.vel - .7);
          cut = clamp((p.cutoff || 1200) * this.cutJ * kt * Math.pow(2, venv * env + ((p.lfoCut || 0) + lv.lfo) * lfo + (p.cutMod || 0) + lv.cut), 25, sr * .44);
          const res = clamp((p.res || 0) + lv.res, 0, 1.05);
          this.cutNow = cut; if (ladder){ this.fL.set(cut, res, sr); this.fL.drive = p.drive || 1; if (U > 1){ this.fR.set(cut * 1.01, res, sr); this.fR.drive = p.drive || 1; } }
          else { const q = .5 + res * 6; this.sL.set(cut, q, sr); if (U > 1) this.sR.set(cut * 1.01, q, sr); }
          this.vibT += CR / sr; const vibA = (p.vib || 0) * clamp((this.vibT - (p.vibDelay || .35)) / .4, 0, 1);
          this.fmul = Math.pow(2, ((p.lfoPitch || 0) * lfo + vibA * A.sin1(this.vibT * (p.vibRate || 5.2))) / 1200);
          this.pw = clamp((p.pw || .5) + (p.pwm || 0) * A.sin1(this.lfoPh * 1.37 + .25), .08, .92); }
        const f = this.freq * this.fmul; let xl = 0, xr = 0;
        const um = this.um, uL = this.uL, uR = this.uR, pw = this.pw;
        for (let u = 0; u < U; u++){ const fu = f * um[u];
          const oa = this.o[u * 2]; oa.run(fu, s1, pw, drift); let b = 0; if (o2){ const ob = this.o[u * 2 + 1]; ob.run(fu * semi2, s2, pw, drift); b = ob.y; } const v = (oa.y + b * o2) * gU;
          xl += v * uL[u]; xr += v * uR[u]; }
        if (subL){ this.subPh += f * .5 / sr; if (this.subPh >= 1) this.subPh -= 1; const sq = (this.subPh < .5 ? 1 : -1) + A.blep(this.subPh, f * .5 / sr) - A.blep((this.subPh + .5) % 1, f * .5 / sr); xl += sq * subL * .5; xr += sq * subL * .5; }
        if (nzL){ const w = this.nz.white() * nzL; xl += w; xr += w; }
        let yl, yr;
        if (U > 1){ if (ladder){ this.fL.run(xl); yl = this.fL.y; this.fR.run(xr); yr = this.fR.y; } else { this.sL.run(xl); this.sR.run(xr); yl = p.filterMode === 'bp' ? this.sL.bp : this.sL.lp; yr = p.filterMode === 'bp' ? this.sR.bp : this.sR.lp; } }
        else { const xm = (xl + xr) * .5; if (ladder){ this.fL.run(xm); yl = yr = this.fL.y; } else { this.sL.run(xm); yl = yr = p.filterMode === 'bp' ? this.sL.bp : p.filterMode === 'hp' ? this.sL.hp : this.sL.lp; } }
        this.fenv.step(); this.aenv.step(); const a = this.aenv.v * this.vel * (p.gain || 1);
        L[s] += yl * a * this.gl; R[s] += yr * a * this.gr;
        if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- bass: sine sub + filtered harmonic layer, mono, glide
  // p: sub (level), subOct (0 | -1), harm (level), shape (osc shape 2 saw/3 sq), cutoff, res, keytrack, envAmt, fd, fs, aa, ad, as, ar, drive, asym, harmHP, harmLP, glide, subDrive
  A.BassVoice = class { constructor(sr, seed){ this.sr = sr; this.osc = new A.VAOsc(sr, seed); this.osc2 = new A.VAOsc(sr, seed + 1); this.lad = new A.Ladder(); this.hp = new A.SVF(); this.lp = new A.SVF(); this.slp = new A.SVF(); this.fenv = new A.ADSR(sr); this.aenv = new A.ADSR(sr); this.dc = new A.DCBlock(); this.subPh = 0; }
    start(off, note, vel, dur, p, legato){ const sr = this.sr; this.p = p; this.off = off; this.vel = vel; this.note = note; this.gateLeft = Math.max(1, Math.round(dur * sr)); this.target = mtof(note);
      const sounding = this.aenv.stage > 0 && this.aenv.v > 1e-3;   // retrigger while still sounding: keep phase + env continuous (no click)
      if (!legato || !this.freq){ this.freq = this.target; if (!sounding){ this.subPh = 0; this.osc.ph = .5; this.osc2.ph = .5; this.lad.reset(); this.hp.reset(); this.lp.reset(); this.slp.reset(); this.dc.x1 = this.dc.y1 = 0; } }   // saw starts at its zero crossing
      this.fenv.setTimes(.0008, p.fd || .15, p.fs || 0, p.fr || .1); this.aenv.setTimes(p.aa || .003, p.ad || .3, p.as === undefined ? .8 : p.as, p.ar || .06);
      if (!legato && !sounding){ this.fenv.v = 0; this.aenv.v = 0; } this.fenv.trigger(1); this.aenv.trigger(1); this.k = 0;
      this.hp.set(p.harmHP || 110, .7, sr); this.lp.set(p.harmLP || 3500, .7, sr); this.slp.set(p.subLP || 130, .7, sr); }
    release(){ this.gateLeft = 0; this.fenv.release(); this.aenv.release(); }
    render(L, R, n){ const p = this.p, sr = this.sr; let i0 = this.off; this.off = 0; const glideK = 1 - Math.exp(-1 / (Math.max(.002, p.glide || .03) * sr));
      const subLvl = p.sub === undefined ? 1 : p.sub, harm = p.harm === undefined ? .5 : p.harm, sh = p.shape || 2, asym = p.asym || .1, drv = p.drive || 1.4, tA = tanh(asym), dn = Math.tanh(drv + asym) - tA, sdrv = p.subDrive || 1.2, sdn = Math.tanh(sdrv + .1) - tanh(.1);
      for (let s = i0; s < n; s++){
        if (this.gateLeft > 0 && --this.gateLeft === 0){ this.fenv.release(); this.aenv.release(); }
        this.freq += (this.target - this.freq) * glideK;
        if (this.k-- <= 0){ this.k = CR; const kt = Math.pow(2, (this.note - 36) / 12 * (p.keytrack === undefined ? .5 : p.keytrack));
          const cut = clamp((p.cutoff || 220) * kt * Math.pow(2, (p.envAmt || 2) * this.fenv.v * (.7 + .6 * this.vel) + (p.cutMod || 0) + (p.live ? p.live.cut * .6 : 0)), 30, 4000); this.lad.set(cut, p.res || .25, sr); this.lad.drive = 1.2; this.cutNow = cut; }
        const f = this.freq, fs = f * (p.subOct === -1 ? .5 : 1);
        this.subPh += fs / sr; if (this.subPh >= 1) this.subPh -= 1;
        let sub = A.sin1(this.subPh); sub = (tanh(sub * sdrv + .1) - tanh(.1)) / sdn; sub = this.slp.tick(sub);
        let h = 0; if (harm){ const a = this.osc.tick(f, sh, .5, 1.2), b = p.osc2 ? this.osc2.tick(f * 1.004, p.osc2, .4, 1.2) * .6 : 0; h = this.lad.tick((a + b) * .6);
          h = (tanh(h * drv + asym) - tA) / dn; h = this.dc.tick(h); this.hp.tick(h); h = this.lp.tick(this.hp.hp); }
        this.fenv.tick(); const env = this.aenv.tick() * this.vel;
        const y = (sub * subLvl + h * harm) * env * (p.gain || 1); L[s] += y * this.gl; R[s] += y * this.gr;
        if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- modal resonator voices
  // partial bank: up to MAXP partials × 2 detuned "strings" (piano) — y = 2r cosw y1 - r² y2 + g x
  const MAXP = 14;
  A.ModalVoice = class { constructor(sr, seed){ this.sr = sr; this.n = 0; this.c = new Float64Array(MAXP * 2); this.r2 = new Float64Array(MAXP * 2); this.g = new Float64Array(MAXP * 2); this.y1 = new Float64Array(MAXP * 2); this.y2 = new Float64Array(MAXP * 2); this.rr = new Float64Array(MAXP * 2);
      this.nz = new A.Noise(seed * 3 + 1); this.th = new A.SVF(); this.lp = new A.SVF(); this.r = A.rng(seed * 101 + 7); }
    // p.kind: 'felt' | 'piano' | 'ep' | 'marimba' | 'vibes' | 'kalimba' | 'glass'
    start(off, note, vel, dur, p){ this.note = note; const sr = this.sr, f0 = this.f0 = mtof(note) * (1 + (this.r() * 2 - 1) * .0004); this.p = p; this.off = off; this.vel = vel; this.i = 0; this.gateLeft = Math.max(1, Math.round(dur * sr)); this.damped = false;
      const kind = p.kind || 'felt'; let parts = [];
      if (kind === 'felt' || kind === 'piano'){ const B = note < 48 ? .0001 : note < 72 ? .0002 : .0005, P = note < 48 ? 12 : note < 72 ? 9 : 6, t1 = clamp(7 - (note - 36) * .11, 1.4, 8) * (p.sustain || 1), hc = (kind === 'felt' ? 700 : 1400) + (kind === 'felt' ? 1500 : 3500) * vel * (p.bright || 1);
        for (let k = 1; k <= P; k++){ const fk = k * f0 * Math.sqrt(1 + B * k * k); if (fk > sr * .45) break; const hs = 1 / Math.sqrt(1 + Math.pow(fk / hc, 4));
          parts.push([fk, Math.pow(k, -1.15) * hs, t1 / (1 + .35 * (k - 1)), .6]); } }
      else if (kind === 'ep'){ parts = [[f0, 1, 4 * (p.sustain || 1), .4], [2 * f0, .32, 3, .4], [3 * f0, .08, 1.5, .4], [f0 * (7.05 + (this.r() - .5) * .3), .2 * (.4 + vel), .06, 0]]; }
      else if (kind === 'marimba'){ parts = [[f0, 1, .7 * (p.sustain || 1), 0], [3.932 * f0, .3 * vel, .22, 0], [9.538 * f0, .08 * vel, .07, 0]]; }
      else if (kind === 'vibes'){ parts = [[f0, 1, 3.5 * (p.sustain || 1), 0], [4 * f0, .25 * vel, .9, 0], [10 * f0, .05, .25, 0]]; }
      else if (kind === 'kalimba'){ parts = [[f0, 1, 1.6 * (p.sustain || 1), 0], [5.4 * f0, .18 * vel, .18, 0], [9.3 * f0, .06, .08, 0]]; }
      else { parts = [[f0, 1, 2.2 * (p.sustain || 1), .3], [2.32 * f0, .4, 1.2, 0], [4.25 * f0, .18, .6, 0], [6.63 * f0, .08, .3, 0]]; }   // glass
      let j = 0; const cents = p.unisonCents === undefined ? .6 : p.unisonCents;
      for (const [fk, ak, t60, two] of parts){ if (fk >= sr * .45) continue;
        for (let s2 = 0; s2 < (two ? 2 : 1); s2++){ const fr = fk * Math.pow(2, (s2 ? 1 : -1) * cents * two / 1200), w = TAU * fr / sr, r = Math.pow(10, -3 / (Math.max(.02, t60) * (s2 ? 1.15 : 1) * sr));
          this.c[j] = 2 * r * Math.cos(w); this.r2[j] = r * r; this.rr[j] = r; this.g[j] = ak * (two ? .6 : 1) * Math.sin(w) ; this.y1[j] = 0; this.y2[j] = 0; j++; if (j >= MAXP * 2) break; }
        if (j >= MAXP * 2) break; }
      this.n = j; this.exLen = Math.max(8, Math.round((kind === 'felt' ? 2.6 - 1.6 * vel : kind === 'piano' ? 1.4 - .8 * vel : .8) * .001 * sr)); this.ex = 0; this.exG = 2 / this.exLen;   // unit-area hammer: low partials get amplitude ≈ ak, the hammer length filters the highs
      this.th.reset(); this.th.set(kind === 'felt' ? 380 : 1200, 1, sr); this.thump = kind === 'felt' || kind === 'piano' ? (p.thump === undefined ? .06 : p.thump) * vel : 0;
      this.lp.reset(); this.lp.set(p.lp || (kind === 'felt' ? 2400 + 2600 * vel : 9000), .6, sr); this.pickup = kind === 'ep'; this.life = 0; }
    release(){ this.gateLeft = 0; }
    damp(){ if (this.damped) return; this.damped = true; const k = this.p.release || .25, rr = Math.pow(10, -3 / (k * this.sr));
      for (let j = 0; j < this.n; j++){ const r = Math.min(this.rr[j], rr), w = Math.acos(clamp(this.c[j] / (2 * this.rr[j]), -1, 1)); this.c[j] = 2 * r * Math.cos(w); this.r2[j] = r * r; this.rr[j] = r; } }
    render(L, R, n){ const sr = this.sr, g = this.vel * (this.p.gain || 1), N = this.n, c = this.c, r2 = this.r2, gg = this.g, y1 = this.y1, y2 = this.y2; let i0 = this.off; this.off = 0; let peak = 0;
      for (let s = i0; s < n; s++){ const i = this.i++;
        if (this.gateLeft > 0 && --this.gateLeft === 0) this.damp();
        let x = 0; if (i < this.exLen){ const ph = i / this.exLen; x = (.5 - .5 * Math.cos(TAU * ph) + this.nz.white() * .02) * this.exG; }
        let y = 0; for (let j = 0; j < N; j++){ const v = c[j] * y1[j] - r2[j] * y2[j] + gg[j] * x; y2[j] = y1[j]; y1[j] = v; y += v; }
        if (this.thump && i < .03 * sr){ this.th.tick(this.nz.white()); y += this.th.bp * this.thump * (1 - i / (.03 * sr)); }
        if (this.pickup){ y = y + .35 * y * y - .1 * y * y * y; }
        y = this.lp.tick(y) * g * .25; L[s] += y * this.gl; R[s] += y * this.gr; const a = y < 0 ? -y : y; if (a > peak) peak = a; }
      this.life = peak > 1e-5 ? 0 : this.life + 1;
      return this.life < 40 && this.i < sr * 14; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_SYNTH;
