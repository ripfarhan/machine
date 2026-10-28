/* Maut ki Awaaz — engine module: voices, second set (v2, additive).
   FM (2-op + feedback; basses, digital plucks, metallic textures — low index, never a bell), drawbar organ, formant "choir"
   / vocal-chop voice, 808 boom with glide, and the transition FX voice (riser, downlifter, impact, sub drop, reverse swell).
   Same voice contract as 21-synth: start(off, note, vel, dur, p) / release() / render(L, R, n) → active; gl/gr pan gains. */
'use strict';
function AWZ_SYNTH2(A){
  const TAU = A.TAU, tanh = A.tanh, clamp = A.clamp, mtof = A.mtof;

  // ---------------------------------------------------------------- FM: carrier + modulator (ratio, index envelope, self-feedback), LP after
  A.FMVoice = class { constructor(sr, seed){ this.sr = sr; this.aenv = new A.ADSR(sr); this.ienv = new A.ADSR(sr); this.lp = new A.SVF(); this.r = A.rng(seed * 13 + 7); this.cp = 0; this.mp = 0; this.fbk = 0; }
    start(off, note, vel, dur, p){ this.p = p; this.off = off; this.note = note; this.vel = vel; this.freq = mtof(note) * Math.pow(2, (p.tune || 0) / 1200); this.target = this.freq; this.gateLeft = Math.max(1, Math.round(dur * this.sr));
      const sounding = this.aenv.stage > 0 && this.aenv.v > 1e-3; if (!sounding){ this.cp = 0; this.mp = this.r() * .1; this.lp.reset(); }
      this.aenv.setTimes(p.aa || .002, p.ad || .4, p.as === undefined ? .6 : p.as, p.ar || .2); this.ienv.setTimes(.0008, p.id || .25, p.is === undefined ? .2 : p.is, p.ir || .2);
      if (!sounding){ this.aenv.v = 0; this.ienv.v = 0; } this.aenv.trigger(1); this.ienv.trigger(1); this.lp.set(Math.min(this.sr * .45, (p.lp || 4000) * (.6 + .6 * vel)), .7, this.sr); }
    glideTo(note, dur){ this.target = mtof(note); this.note = note; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); }
    release(){ this.gateLeft = 0; this.aenv.release(); this.ienv.release(); }
    render(L, R, n){ const p = this.p, sr = this.sr, ratio = p.ratio || 1, I0 = (p.index || 2) * (.6 + .5 * this.vel), fbA = p.feedback || 0, g = this.vel * (p.gain || 1), glide = p.glide ? 1 - Math.exp(-1 / (p.glide * sr)) : 1; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ if (this.gateLeft > 0 && --this.gateLeft === 0){ this.aenv.release(); this.ienv.release(); }
        this.freq += (this.target - this.freq) * glide; const f = this.freq;
        this.mp += f * ratio / sr; if (this.mp >= 1) this.mp -= 1; const mod = A.sin1(this.mp + this.fbk * fbA); this.fbk = mod;
        this.ienv.step(); const I = I0 * this.ienv.v; this.cp += f / sr; if (this.cp >= 1) this.cp -= 1; this.lp.run(A.sin1(this.cp + mod * I * .16)); this.aenv.step(); const y = this.lp.lp * this.aenv.v * g;
        L[s] += y * this.gl; R[s] += y * this.gr; if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- drawbar organ: additive sines (16' 8' 4' 2⅔' 2' 1⅗' 1⅓'), key click, percussion; pairs with A.Rotary
  const DB_R = [.5, 1, 2, 3, 4, 5, 6];
  A.OrganVoice = class { constructor(sr, seed){ this.sr = sr; this.ph = new Float64Array(7); this.aenv = new A.ADSR(sr); this.nz = new A.Noise(seed * 5 + 3); this.r = A.rng(seed * 3 + 1); }
    start(off, note, vel, dur, p){ this.p = p; this.off = off; this.note = note; this.vel = vel; this.f = mtof(note); this.gateLeft = Math.max(1, Math.round(dur * this.sr)); this.i = 0;
      if (!(this.aenv.stage > 0 && this.aenv.v > 1e-3)) for (let k = 0; k < 7; k++) this.ph[k] = this.r();
      this.aenv.setTimes(p.aa || .006, .1, 1, p.ar || .08); this.aenv.v = Math.min(this.aenv.v, .3); this.aenv.trigger(1); this.db = p.drawbars || [.5, 1, .7, .3, .5, 0, .2]; this.perc = p.perc === undefined ? .5 : p.perc; this.pe = 1; }
    release(){ this.gateLeft = 0; this.aenv.release(); }
    render(L, R, n){ const sr = this.sr, f = this.f, db = this.db, g = this.vel * (this.p.gain || 1) * .22, kp = Math.exp(-1 / (.18 * sr)); let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ if (this.gateLeft > 0 && --this.gateLeft === 0) this.aenv.release(); let y = 0;
        for (let k = 0; k < 7; k++){ const fk = f * DB_R[k]; if (!db[k] || fk > sr * .45) continue; this.ph[k] += fk / sr; if (this.ph[k] >= 1) this.ph[k] -= 1; y += A.sin1(this.ph[k]) * db[k] * (k === 3 || k === 2 ? 1 + this.perc * this.pe : 1); }
        this.pe *= kp; if (this.i++ < .004 * sr) y += this.nz.white() * .25 * (1 - this.i / (.004 * sr));
        this.aenv.step(); const o = y * this.aenv.v * g; L[s] += o * this.gl; R[s] += o * this.gr; if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- formant "choir" / vocal chop: detuned saws + breath through 3 vowel formants; chops bend into pitch
  const FG = [1, .55, .3], VOW = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240]];
  A.ChoirVoice = class { constructor(sr, seed){ this.sr = sr; this.o = [new A.VAOsc(sr, seed * 7 + 1), new A.VAOsc(sr, seed * 7 + 2), new A.VAOsc(sr, seed * 7 + 3)]; this.f = [new A.SVF(), new A.SVF(), new A.SVF()]; this.aenv = new A.ADSR(sr); this.nz = new A.Noise(seed * 11 + 5); this.r = A.rng(seed * 17 + 9); this.k = 0; }
    start(off, note, vel, dur, p){ this.p = p; this.off = off; this.note = note; this.vel = vel; this.f0 = mtof(note); this.gateLeft = Math.max(1, Math.round(dur * this.sr));
      this.aenv.setTimes(p.aa || .25, p.ad || .5, p.as === undefined ? .8 : p.as, p.ar || .6); if (!(this.aenv.stage > 0 && this.aenv.v > 1e-3)) this.aenv.v = 0; this.aenv.trigger(1);
      this.vow = p.vowel === undefined ? this.r() * 4 : p.vowel; this.vdrift = (this.r() - .5) * (p.vdrift === undefined ? .6 : p.vdrift); this.bend = p.bend ? (this.r() < .5 ? -1 : 1) * p.bend : 0; this.bendK = 1; this.t = 0; this.k = 0; }
    release(){ this.gateLeft = 0; this.aenv.release(); }
    render(L, R, n){ const p = this.p, sr = this.sr, g = this.vel * (p.gain || 1) * .5, det = p.detune || 9, br = p.breath === undefined ? .08 : p.breath, bk = Math.exp(-1 / ((p.bendTime || .08) * sr)); let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ if (this.gateLeft > 0 && --this.gateLeft === 0) this.aenv.release();
        if (this.k-- <= 0){ this.k = 32; this.t += 32 / sr; let v = this.vow + this.vdrift * this.t; v = ((v % 8) + 8) % 8; if (v > 4) v = 8 - v; const i = Math.min(3, Math.floor(v)), fr = v - i, a = VOW[i], b = VOW[i + 1];   // ping-pong a→u→a: no jump from the last vowel back to the first
          for (let q = 0; q < 3; q++) this.f[q].set(a[q] + (b[q] - a[q]) * fr, p.q || 7, sr); }
        this.bendK *= bk; const f = this.f0 * Math.pow(2, this.bend * this.bendK / 12);
        const dr = Math.pow(2, det / 1200), O = this.o; O[0].run(f / dr, 2, .5, 4); O[1].run(f, 2, .5, 4); O[2].run(f * dr, 2, .5, 4); let x = O[0].y + O[1].y + O[2].y; x = x * .33 + this.nz.white() * br;
        let y = 0; for (let q = 0; q < 3; q++){ this.f[q].run(x); y += this.f[q].bp * FG[q]; }
        this.aenv.step(); const o = y * this.aenv.v * g; L[s] += o * this.gl; R[s] += o * this.gr; if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- 808 boom: sine with a fast pitch drop into the note, long decay, drive, glide between notes
  A.BoomVoice = class { constructor(sr, seed){ this.sr = sr; this.ph = 0; this.aenv = new A.ADSR(sr); this.lp = new A.SVF(); }
    start(off, note, vel, dur, p){ this.p = p; this.off = off; this.note = note; this.vel = vel; this.target = mtof(note); this.gateLeft = Math.max(1, Math.round(dur * this.sr));
      const sounding = this.aenv.stage > 0 && this.aenv.v > 1e-3; if (!sounding){ this.ph = 0; this.freq = this.target; this.pe = 1; this.aenv.v = 0; } else this.pe = .3;
      this.aenv.setTimes(.001, p.decay || 1.2, 0, p.ar || .15); this.aenv.trigger(1); this.lp.set(p.lp || 900, .7, this.sr); }
    glideTo(note, dur){ this.target = mtof(note); this.note = note; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); }
    release(){ this.gateLeft = 0; this.aenv.release(); }
    render(L, R, n){ const p = this.p, sr = this.sr, kp = Math.exp(-1 / ((p.ptau || .035) * sr)), gk = 1 - Math.exp(-1 / ((p.glide || .07) * sr)), drv = p.drive || 1.8, dn = Math.tanh(drv), g = this.vel * (p.gain || 1); let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ if (this.gateLeft > 0 && --this.gateLeft === 0) this.aenv.release(); this.freq += (this.target - this.freq) * gk; this.pe *= kp;
        this.ph += this.freq * (1 + (p.pitch || 1.2) * this.pe) / sr; if (this.ph >= 1) this.ph -= 1;
        this.lp.run(tanh(A.sin1(this.ph) * drv) / dn); this.aenv.step(); const y = this.lp.lp * this.aenv.v * g; L[s] += y * this.gl; R[s] += y * this.gr; if (!this.aenv.active) return false; }
      return true; } };

  // ---------------------------------------------------------------- transition FX voice (event-driven: ev.fx = 'riser' | 'down' | 'impact' | 'subdrop' | 'swell')
  A.FxVoice = class { constructor(sr, seed){ this.sr = sr; this.nz = new A.Noise(seed * 29 + 3); this.bp = new A.SVF(); this.bp2 = new A.SVF(); this.lp = new A.SVF(); this.ph = 0; }
    begin(off, ev){ this.off = off; this.kind = ev.fx; this.vel = ev.vel === undefined ? .8 : ev.vel; this.N = Math.max(64, Math.round((ev.dur || 2) * this.sr)); this.i = 0; this.ph = 0; this.bp.reset(); this.bp2.reset(); this.lp.reset(); this.base = ev.freq || 55; }
    render(L, R, n){ const sr = this.sr, N = this.N, k = this.kind, g = this.vel; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++, q = i / N; let y = 0, side = 0;
        if (k === 'riser' || k === 'down'){ if (q >= 1) return false; const u = k === 'riser' ? q : 1 - q, fc = 250 * Math.pow(32, u), amp = (k === 'riser' ? Math.pow(q, 2.2) : Math.pow(1 - q, 1.6)) * Math.min(1, Math.pow(1800 / fc, .45));
          if ((i & 15) === 0){ this.bp.set(fc, 2.5, sr); this.bp2.set(fc * 1.5, 3, sr); } const w = this.nz.white(); this.bp.tick(w); this.bp2.tick(w);
          this.ph += this.base * 2 * Math.pow(4, u) / sr; if (this.ph >= 1) this.ph -= 1; y = (this.bp.bp * .9 + this.bp2.bp * .5) * amp + A.sin1(this.ph) * amp * .12; side = this.bp2.bp * amp * .5; }
        else if (k === 'swell'){ if (q >= 1) return false; const amp = Math.pow(q, 4); if ((i & 63) === 0) this.bp.set(2500 + 4000 * q, .6, sr); this.bp.tick(this.nz.white()); y = this.bp.hp * amp * .7; side = this.bp.bp * amp * .4; }
        else if (k === 'impact'){ if (q >= 1) return false; const t = i / sr, f = this.base * (1 + 2 * Math.exp(-t / .03)); this.ph += f / sr; if (this.ph >= 1) this.ph -= 1;
          if (i === 0) this.lp.set(1800, .7, sr); this.lp.tick(this.nz.white()); y = A.sin1(this.ph) * Math.exp(-t / .55) * 1.1 + this.lp.lp * Math.exp(-t / .09) * .8; side = this.lp.lp * Math.exp(-t / .2) * .3; }
        else if (k === 'subdrop'){ if (q >= 1) return false; const t = i / sr, f = 30 + (this.base * 1.3 - 30) * Math.exp(-t / .35); this.ph += f / sr; if (this.ph >= 1) this.ph -= 1; y = tanh(A.sin1(this.ph) * 1.6) * Math.min(1, t / .004) * Math.exp(-t / ((N / sr) * .45)); }
        else return false;
        L[s] += (y + side) * g; R[s] += (y - side) * g; }
      return true; } };
  A.FxInst = class { constructor(sr){ this.sr = sr; this.pool = new A.Pool(() => new A.FxVoice(sr, 7), 6); this.pend = []; this.patch = {}; this.var = 0; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ const v = this.pool.get(); v.begin(off, ev); v.gl = 1; v.gr = 1; }
    render(L, R, n){ return A.segRender(this, L, R, n); }
    renderVoices(L, R, n){ return this.pool.render(L, R, n); }
    allOff(){ this.pend.length = 0; this.pool.each(v => v.on = false); } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_SYNTH2;
