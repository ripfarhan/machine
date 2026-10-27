/* Maut ki Awaaz — engine module: instruments = voice pools + patch + per-event variation ("no sound twice").
   Interface: play(off, ev) where ev = {note, vel, dur, ...}; render(L, R, n); allOff(); patch (live, mutable). */
'use strict';
function AWZ_INST(A){
  const clamp = A.clamp;
  // per-event jitter of a few numeric patch fields; returns a shallow copy (events are rare: tens per second at most)
  function vary(p, r, amt, fields){ if (!amt) return p; const q = Object.assign({}, p); for (const f in fields) if (typeof q[f] === 'number') q[f] *= 1 + (r() * 2 - 1) * fields[f] * amt; return q; }
  A.vary = vary;
  // equal-power pan gains normalised so centre = 1/1
  const panTo = (v, pan) => { if (pan === undefined || pan === 0){ v.gl = 1; v.gr = 1; return; } const q = clamp(pan, -1, 1); v.gl = Math.cos((q + 1) * Math.PI / 4) * Math.SQRT2; v.gr = Math.sin((q + 1) * Math.PI / 4) * Math.SQRT2; };
  A.panTo = panTo;
  // per-event patch overrides (ev.mod) on top of the instrument patch
  const withMod = (p, mod) => mod ? Object.assign({}, p, mod) : p;

  // Events are queued and applied at their exact sample inside render(): the block is split at event offsets, so a voice
  // re-used while still sounding (mono retrigger, steal) keeps rendering its old note right up to the new onset (no gap, no click).
  function segRender(self, L, R, n){ const P = self.pend; if (!P.length) return self.renderVoices(L, R, n, 0);
    if (P.length > 1) P.sort((a, b) => a.off - b.off); let pos = 0, any = false;
    for (let i = 0; i < P.length; i++){ const e = P[i], o = Math.min(n - 1, Math.max(0, e.off | 0)); if (o > pos){ any = self.renderVoices(L.subarray(pos, o), R.subarray(pos, o), o - pos, pos) || any; pos = o; } self.doPlay(0, e.ev, pos); }
    P.length = 0; if (pos < n) any = self.renderVoices(pos ? L.subarray(pos) : L, pos ? R.subarray(pos) : R, n - pos, pos) || any; return any; }
  A.segRender = segRender;

  A.DrumInst = class { constructor(sr, kind, patch, seed){ this.sr = sr; this.kind = kind; this.patch = patch || {}; this.r = A.rng(seed || 5); this.var = 1;
      const V = {kick: [A.KickVoice, 3], snare: [A.SnareVoice, 4], hat: [A.HatVoice, 6], shaker: [A.ShakerVoice, 6], tom: [A.TomVoice, 6], perc: [A.ResPercVoice, 10]}[kind];
      this.pool = new A.Pool(() => new V[0](sr), V[1]); this.pend = []; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ const p = withMod(this.patch, ev.mod), r = this.r, k = this.kind, vel = clamp(ev.vel === undefined ? 1 : ev.vel, 0, 1.5); const before = this.pool.clock;
      if (k === 'kick'){ this.pool.each(v => { if (v.on) v.ka = Math.exp(-1 / (.01 * this.sr)); }); this.pool.get().start(off, vel, vary(p, r, this.var, {ampTau: .08, click: .3, fStart: .02}), r); }
      else if (k === 'hat'){ if (!ev.open) this.pool.each(v => { if (v.on && v.open) v.choke(); }); this.pool.get().start(off, vel, vary(p, r, this.var, {closedTau: .12, openTau: .1, tune: .01}), r, ev.open); }
      else if (k === 'tom' || k === 'perc'){ this.pool.get().start(off, vel, vary(p, r, this.var, {ampTau: .1, tau: .12, noise: .2}), r, ev.freq || A.mtof(ev.note || 60)); }
      else this.pool.get().start(off, vel, vary(p, r, this.var, {noiseTau: .1, tau: .12, f1: .02, noiseF: .05}), r);
      if (this.pool.clock !== before) for (const v of this.pool.v) if (v.age === this.pool.clock){ panTo(v, ev.pan); break; } }
    render(L, R, n){ return segRender(this, L, R, n); }
    renderVoices(L, R, n){ return this.pool.render(L, R, n); }
    allOff(){ this.pend.length = 0; this.pool.each(v => v.on = false); } };

  // polyphonic note instrument over any voice class with start(off, note, vel, dur, p) / release()
  A.PolyInst = class { constructor(sr, Voice, n, patch, seed){ this.sr = sr; this.patch = patch || {}; this.r = A.rng(seed || 9); this.var = 1; let k = 0; this.pool = new A.Pool(() => new Voice(sr, (seed || 1) * 17 + (k++)), n); this.pend = []; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ const v = this.pool.get(); const base = withMod(this.patch, ev.mod), p = this.var ? vary(base, this.r, this.var, {cutoff: .12, ad: .12, fd: .15, res: .1, drive: .15, envAmt: .1, sustain: .1, bright: .12}) : base;
      v.start(off, ev.note, clamp(ev.vel === undefined ? .8 : ev.vel, 0, 1.3), ev.dur || .25, p); panTo(v, ev.pan); return v; }
    render(L, R, n){ return segRender(this, L, R, n); }
    renderVoices(L, R, n){ return this.pool.render(L, R, n); }
    allOff(){ this.pend.length = 0; this.pool.each(v => { if (v.on && v.release) v.release(); }); } };

  // monophonic legato instrument (bass / lead): overlapping notes glide, separated notes retrigger
  A.MonoInst = class { constructor(sr, Voice, patch, seed){ this.sr = sr; this.patch = patch || {}; this.v = new Voice(sr, seed || 3); this.v.on = false; this.r = A.rng(seed || 3); this.endAt = 0; this.t = 0; this.var = 1; this.pend = []; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev, pos){ const now = this.t + (pos || 0) + off; const base = withMod(this.patch, ev.mod), p = this.var ? vary(base, this.r, this.var, {cutoff: .1, ad: .1, fd: .12, drive: .1}) : base; const legato = this.v.on && now < this.endAt && (ev.slide || this.patch.legato);
      if (legato && this.v.glideTo){ this.v.glideTo(ev.note, ev.dur); this.v.target = A.mtof(ev.note); }
      else this.v.start(off, ev.note, clamp(ev.vel === undefined ? .9 : ev.vel, 0, 1.3), ev.dur || .25, p, legato);
      if (legato && !this.v.glideTo){ this.v.gateLeft = Math.max(1, Math.round((ev.dur || .25) * this.sr)); }
      this.v.on = true; panTo(this.v, ev.pan); this.endAt = now + (ev.dur || .25) * this.sr; }
    render(L, R, n){ const r = segRender(this, L, R, n); this.t += n; return r; }
    renderVoices(L, R, n){ if (this.v.on) this.v.on = this.v.render(L, R, n); return this.v.on; }
    allOff(){ this.pend.length = 0; if (this.v.on && this.v.release) this.v.release(); } };

  // continuous texture voices: rain (Poisson clicks through band-passes), hiss, wind, crackle, drone (just-intonation partials)
  const DRONE_R = [1, 1.5, 2, 3], DRONE_A = [.5, .25, .18, .07];
  A.TextureInst = class { constructor(sr, patch, seed){ this.sr = sr; this.patch = patch || {kind: 'rain'}; this.nz = new A.Noise(seed || 31); this.r = A.rng(seed || 31); this.a = new A.SVF(); this.b = new A.SVF(); this.c = new A.SVF(); this.lvl = new A.Smooth(0, .8, sr);
      this.ph = new Float64Array(6); this.lfo = this.r(); this.drop = 0; this.dropL = 0; this.dropR = 0; this.pop = 0; this.note = 45; }
    play(off, ev){ if (ev.level !== undefined) this.lvl.set(ev.level); if (ev.note !== undefined) this.note = ev.note; if (ev.kind) this.patch = Object.assign({}, this.patch, {kind: ev.kind}); }
    render(L, R, n){ const sr = this.sr, p = this.patch, k = p.kind; if (this.lvl.t < 1e-4 && this.lvl.v < 1e-4) return false;
      if (k === 'wind'){ this.a.set(500 + 1500 * (.5 + .5 * A.sin1(this.lfo)), 4, sr); this.b.set(700 + 1300 * (.5 + .5 * A.sin1(this.lfo + .37)), 4, sr); }
      else if (k === 'rain'){ this.a.set(2600, .9, sr); this.b.set(7000, .7, sr); }
      else if (k === 'hiss'){ this.a.set(5000, .5, sr); }
      else if (k === 'crackle'){ this.a.set(2400, .6, sr); }
      this.lfo += n * .05 / sr; const dInc = this.dInc || (this.dInc = new Float64Array(4)); if (k === 'drone'){ const f = A.mtof(this.note); for (let q = 0; q < 4; q++) dInc[q] = f * DRONE_R[q] * (1 + q * .0007) / sr; }
      for (let i = 0; i < n; i++){ const g = this.lvl.tick(); let l = 0, r = 0;
        if (k === 'rain'){ // binaural-ish rain: Poisson drops with random pan + soft wash
          if (this.r() < (p.rate || 30) / sr){ this.drop = (.3 + this.r() * .7) * (this.r() < .1 ? 2 : 1); const pan = this.r(); this.dropL = Math.cos(pan * 1.5708); this.dropR = Math.sin(pan * 1.5708); }
          const w = this.nz.white(); this.a.tick(w * this.drop); this.drop *= .93; this.b.tick(w);
          const wash = this.b.lp * .06; l = this.a.bp * this.dropL * 1.4 + wash; r = this.a.bp * this.dropR * 1.4 + wash * .9; }
        else if (k === 'wind'){ const w = this.nz.white(); this.a.tick(w); this.b.tick(this.nz.white()); l = this.a.bp * .5; r = this.b.bp * .5; }
        else if (k === 'hiss'){ const w = this.nz.pink(); this.a.tick(w); l = this.a.hp * .4 + w * .05; r = l * .97; }
        else if (k === 'crackle'){ if (this.r() < 9 / sr) this.pop = (this.r() * 2 - 1) * (this.r() < .12 ? 1 : .35); else this.pop *= .3; this.a.tick(this.pop + this.nz.white() * .01); l = this.a.hp * .7; r = this.r() < .5 ? l : l * .6; }
        else { for (let q = 0; q < 4; q++){ this.ph[q] += dInc[q]; l += A.sin1(this.ph[q]) * DRONE_A[q]; r += A.sin1(this.ph[q] + q * .13) * DRONE_A[q]; } l *= .4; r *= .4; }
        L[i] += l * g; R[i] += r * g; }
      return true; }
    allOff(){ this.lvl.set(0); } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_INST;
