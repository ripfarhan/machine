/* Maut ki Awaaz — engine module: parts, second set (v2, additive). Same contract as 50-parts: bar(c) emits with
   c.emit(slot, step, ev, raw). Recipes from research/02 §C (style atlas) and research/07.
   acid (303 line with accents/slides) · seq (Berlin-school sequencer, slow cutoff breath) · polyarp (Frahm coprime lanes
   over a held root) · reich (phase ensemble with drift-and-lock) · eno (incommensurable loops) · twostep (Burial/UKG
   shuffle, off-grid) · breaks (synthesised breakbeat) · chops (formant vocal chops) · boom (808 line) · toms (tonal 16ths). */
'use strict';
function AWZ_PARTS2(A){
  const clamp = A.clamp, P = A.PARTS;
  const fit = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };
  const scaleNear = (c, root, lo, hi) => { const o = []; for (let m = lo; m <= hi; m++) if (c.key.inScale(m)) o.push(m); return o.length ? o : [root]; };

  // ---------------------------------------------------------------- acid: 16-step 303 line. root-heavy, octave jumps, accents, slides, rests; one step mutates now and then
  P.acid = class { constructor(Pc, o){ this.slot = o.slot || 'acid'; const r = this.r = Pc.rng('acid' + this.slot); this.len = o.len || r.pick([16, 16, 12, 8]);
      this.steps = Array.from({length: 16}, () => this.mk()); this.vel = o.vel || .85; this.ride = r.range(0, 1); }
    mk(){ const r = this.r; return {rest: r() < .22, deg: r.weighted({0: 6, 7: 2, 12: 2.5, 3: 1.5, 10: 1.2, 5: 1, 1: .5}) | 0, acc: r() < .3, slide: r() < .25}; }
    bar(c){ const r = this.r; if (c.barIndex % 4 === 0 && r() < .2 + c.mutation){ this.steps[r.int(0, 15)] = this.mk(); }
      const root = fit(c.chordRoot + 36, 33, 44), ride = Math.sin((c.barIndex / 32 + this.ride) * Math.PI * 2) * .5 + .5, cm = -1.4 + 2.6 * ride * (.5 + .5 * c.E) + (c.brightness - .5);
      for (let s = 0; s < 16; s++){ const st = this.steps[s % this.len]; if (st.rest || (c.density < .35 && s % 2)) continue; const nx = this.steps[(s + 1) % this.len];
        const iv = st.deg === 3 && !c.key.inScale(root + 3) ? 4 : st.deg === 10 && !c.key.inScale(root + 10) ? 11 : st.deg; const note = root + iv;
        c.emit(this.slot, s, {note, vel: this.vel * (st.acc ? 1.15 : .8), dur: c.step * (nx.slide && !nx.rest ? 1.15 : .55), slide: st.slide, mod: {cutMod: cm + (st.acc ? .6 : 0), envAmt: st.acc ? 5 : 3.2, fd: st.acc ? .12 : .22}}); } } };

  // ---------------------------------------------------------------- seq: Berlin-school sequencer. 16 (+ optional 12) steps, transposed by the chord root, cutoff breathes over ~64 bars
  P.seq = class { constructor(Pc, o){ this.slot = o.slot || 'seq'; const r = this.r = Pc.rng('seq' + this.slot); this.lanes = (o.lens || [16]).map((len, k) => ({len, n: 0, oct: k ? 12 : 0, deg: Array.from({length: len}, (_, i) => i % 4 === 0 ? 0 : r.pick([0, 0, 2, 4, 7, 9, 12, 4, 2])), acc: Array.from({length: len}, (_, i) => i % 3 === 0 || i % 7 === 0)}));
      this.vel = o.vel || .75; this.ph = r(); this.rate = o.rate || 1; this.from = o.from || 0; }
    bar(c){ const sc = scaleNear(c, 48, 48, 84), root = fit(c.chordRoot + 48, 45, 56), sweep = Math.sin((c.barIndex / 64 + this.ph) * Math.PI * 2);
      this.lanes.forEach((L, k) => { if (k > 0 && c.E < .55) return; for (let s = 0; s < 16; s += this.rate){ const i = L.n++ % L.len; let m = root + L.deg[i] + L.oct; if (!c.key.inScale(m)) m = c.key.snap(m);
          c.emit(this.slot, s, {note: m, vel: this.vel * (L.acc[i] ? 1 : .72) * (k ? .7 : 1), dur: c.step * this.rate * .8, pan: k ? .4 : -.1, mod: {cutMod: sweep * 1.3 + (c.E - .5) * 1.2 + (L.acc[i] ? .3 : 0)}}); } }); } };

  // ---------------------------------------------------------------- polyarp: Frahm-style lanes over a held root, each with its own coprime length and chance; lanes join with the arc
  P.polyarp = class { constructor(Pc, o){ this.slot = o.slot || 'arp'; const r = this.r = Pc.rng('poly' + this.slot); const ivs = o.ivs || [3, 7, 10, 14, 15], lens = o.lens || [9, 10, 7, 16, 11];
      this.lanes = ivs.map((iv, k) => ({iv, len: lens[k % lens.length], hits: A.euclid(Math.max(2, Math.round(lens[k % lens.length] * r.range(.45, .8))), lens[k % lens.length], r.int(0, 5)), chance: r.range(.6, 1), n: 0, pan: [0, -.5, .5, -.25, .3][k % 5]})); this.vel = o.vel || .6; }
    bar(c){ const r = this.r, root = fit(c.chordRoot + 48, 45, 57), avail = Math.max(1, Math.min(this.lanes.length, Math.round(1 + c.layerIndex * this.lanes.length * .9 + (c.E - .4) * 2)));
      const cm = -1.6 + 3.2 * c.layerIndex + (c.E - .5);
      for (let k = 0; k < avail; k++){ const L = this.lanes[k]; let m = root + L.iv; if (!c.key.inScale(m)) m = c.key.snap(m);
        for (let s = 0; s < 16; s++){ const i = L.n++ % L.len; if (!L.hits[i] || r() > L.chance) continue; c.emit(this.slot, s, {note: m, vel: this.vel * (.7 + .3 * r()), dur: c.step * 1.6, pan: L.pan, mod: {cutMod: cm}}); } } } };

  // ---------------------------------------------------------------- reich: a 12-note cell on 5 pitch classes; voice B runs a hair faster until it is one 16th ahead, locks, then drifts again
  P.reich = class { constructor(Pc, o){ this.slot = o.slot || 'mar'; const r = this.r = Pc.rng('reich'); this.cell = Array.from({length: o.cell || 12}, () => r.int(0, 4)); this.vel = o.vel || .6;
      this.off = 0; this.lock = 0; this.drift = o.drift || .012; this.tB = 0; this.started = false; }
    bar(c){ const r = this.r, pcs = c.voicing.notes.concat(c.key.pentatonic(64, 80)).filter((m, i, a) => a.indexOf(m) === i).sort((a, b) => a - b).slice(0, 5); const T0 = c.barIndex * 16;
      if (!this.started){ this.tB = T0; this.nB = T0; this.lead = 0; this.nextLock = 1; this.started = true; }
      for (let s = 0; s < 16; s++){ const i = (T0 + s) % this.cell.length, m = fit(pcs[this.cell[i] % pcs.length], 64, 84); c.emit(this.slot, s, {note: m, vel: this.vel * (s % 4 === 0 ? 1 : .8), dur: c.step * 1.5, pan: -.35}, true); }
      if (c.E < .25){ this.tB = T0 + 16; this.nB = T0 + 16 + Math.round(this.lead); return; }   // voice B rests, stays aligned
      // voice B: plays a hair faster (period 1 − drift) until it has gained exactly one step, then locks for 4–12 cycles, then drifts again
      while (this.tB < T0 + 16){ const per = this.lock > 0 ? 1 : 1 - this.drift * (.5 + c.motion);
        if (this.tB >= T0){ const i = ((this.nB % this.cell.length) + this.cell.length) % this.cell.length, m = fit(pcs[this.cell[i] % pcs.length], 64, 84); c.emit(this.slot, this.tB - T0, {note: m, vel: this.vel * .85, dur: c.step * 1.4, pan: .35}, true); }
        this.nB++; this.tB += per; this.lead += 1 - per;
        if (this.lock > 0) this.lock -= 1 / this.cell.length;
        else if (this.lead >= this.nextLock){ this.tB = Math.round(this.tB); this.lead = Math.round(this.lead); this.nextLock = this.lead + 1; this.lock = r.int(4, 12); } } } };

  // ---------------------------------------------------------------- eno: each voice is one note on its own loop of incommensurable length (seconds); density emerges from the arithmetic
  P.eno = class { constructor(Pc, o){ this.slot = o.slot || 'loops'; const r = this.r = Pc.rng('eno'); const lens = o.loops || [17.3, 19.6, 20.1, 21.7, 23.9, 25.4, 31.1];
      this.loops = lens.map((L, k) => ({L: L * r.range(.97, 1.03), at: r() * L, k, oct: [0, 12, 0, 12, -12, 24, 0][k % 7], pan: [-.6, .5, -.2, .7, 0, -.4, .3][k % 7]})); this.t = 0; this.vel = o.vel || .5; this.durS = o.dur || 7; }
    bar(c){ const barSec = c.bar, T1 = this.t + barSec, tones = c.voicing.notes, n = Math.min(this.loops.length, 3 + Math.round(c.E * 5));
      for (let k = 0; k < n; k++){ const L = this.loops[k]; while (L.at < T1){ if (L.at >= this.t){ const m = fit(tones[k % tones.length] + L.oct, 48, 88); c.emit(this.slot, (L.at - this.t) / c.step, {note: m, vel: this.vel * (.7 + .3 * this.r()), dur: this.durS * (.8 + .4 * this.r()), pan: L.pan}, true); }
          L.at += L.L * (1 + (this.r() - .5) * .01); } }
      this.t = T1; } };

  // ---------------------------------------------------------------- twostep: Burial/UKG shuffle — skippy kick, snare 2&4 + end ghost, off-grid rims, swung pitched-down hats
  P.twostep = class { constructor(Pc, o){ const r = this.r = Pc.rng('2step'); this.kicks = r.pick([[0, 6, 10, 14], [0, 7, 10], [0, 10, 13], [0, 6, 11]]); this.sw = o.swing || r.range(.16, .26); this.vel = o.vel || .8; this.jit = o.jitter === undefined ? .25 : o.jitter; }
    bar(c){ const r = this.r, J = () => (r() - .5) * this.jit, sw = s => s + (s % 2 ? this.sw : 0);
      if (c.E > .3) this.kicks.forEach((s, i) => c.emit('kick', s, {vel: this.vel * (i ? .82 : 1), kick: true}));
      if (c.E > .35){ c.emit('snare', 4, {vel: this.vel * .8}); c.emit('snare', 12, {vel: this.vel * .85}); if (r() < .6) c.emit('snare', sw(15) + J() * .3, {vel: this.vel * .3}, true); }
      for (const s of [2, 7, 9, 13]) if (r() < .55 + c.density * .3) c.emit('perc', sw(s) + J(), {vel: .3 + r() * .25, freq: 1200 + r() * 900, mod: {ratios: [1, 2.3, 3.9], q: 14, tau: .02, noise: .4, hp: 400}}, true);
      for (let s = 2; s < 16; s += (c.density > .6 ? 2 : 4)) c.emit('hat', sw(s) + J() * .4, {vel: (.35 + .25 * r()) * (s % 4 === 2 ? 1 : .7), open: s === 10 && r() < .25}, true); } };

  // ---------------------------------------------------------------- breaks: synthesised breakbeat (Bicep/Four Tet), 2-bar phrase, ghost snares, fills every 8 bars
  const BRK = [{k: [0, 10], s: [4, 12], g: [7, 9, 15]}, {k: [0, 2, 10], s: [4, 12], g: [6, 14]}, {k: [0, 6, 10], s: [4, 13], g: [2, 9, 15]}, {k: [0, 3, 8, 10], s: [4, 12], g: [7, 14, 15]}];
  P.breaks = class { constructor(Pc, o){ const r = this.r = Pc.rng('breaks'); this.a = r.pick(BRK); this.b = r.pick(BRK); this.vel = o.vel || .85; }
    bar(c){ const r = this.r, pat = c.barIndex % 2 ? this.b : this.a, fill = c.barInSection % 8 === 7 && c.barsLeftInSection > 1;
      pat.k.forEach((s, i) => { if (fill && s > 8) return; c.emit('kick', s, {vel: this.vel * (i ? .85 : 1), kick: true}); });
      pat.s.forEach(s => c.emit('snare', s, {vel: this.vel * .9}));
      pat.g.forEach(s => { if (r() < .35 + c.density * .5) c.emit('snare', s, {vel: this.vel * (.18 + r() * .14)}); });
      if (fill) for (let s = 9; s < 16; s++) if (r() < .75) c.emit('snare', s, {vel: this.vel * (.3 + (s - 9) / 7 * .5)});
      for (let s = 0; s < 16; s++){ if (c.density < .4 && s % 2) continue; c.emit('hat', s, {vel: (s % 4 === 2 ? .55 : s % 2 ? .28 : .4) * (.8 + .4 * r()), open: s === 14 && r() < .3}); } } };

  // ---------------------------------------------------------------- chops: formant vocal chops on syncopated steps, pitched to chord tones, a few off the grid
  P.chops = class { constructor(Pc, o){ this.slot = o.slot || 'vox'; const r = this.r = Pc.rng('chops'); this.pos = r.pick([[3, 7, 10, 14], [2, 6, 11, 14], [3, 6, 10, 13, 15], [7, 10, 14]]); this.vel = o.vel || .6; this.up = o.up === undefined ? 12 : o.up; }
    bar(c){ const r = this.r, tones = c.voicing.notes; if (c.barInSection % 2 && r() < .5) return;
      for (const s of this.pos){ if (r() > .45 + c.density * .45) continue; const m = fit(tones[Math.floor(r() * tones.length)] + this.up, 64, 86); const off = r() < .3 ? (r() - .5) * .6 : 0;
        c.emit(this.slot, s + off, {note: m, vel: this.vel * (.7 + .3 * r()), dur: c.step * (r() < .3 ? 3 : 1.2), pan: (r() - .5) * .8}, off !== 0); } } };

  // ---------------------------------------------------------------- boom: 808 line on the kick pattern, gliding between roots and octaves
  P.boom = class { constructor(Pc, o){ this.slot = o.slot || 'boom'; const r = this.r = Pc.rng('boom'); this.pat = o.pat || r.pick([[0, 10], [0, 7, 10], [0, 3, 10], [0, 6, 8]]); this.vel = o.vel || .9; }
    bar(c){ const r = this.r, root = fit(c.chordRoot + 36, 31, 42); this.pat.forEach((s, i) => { const oct = i && r() < .25 ? 12 : 0; c.emit(this.slot, s, {note: root + oct, vel: this.vel * (i ? .85 : 1), dur: c.step * (i === this.pat.length - 1 ? 16 - s : this.pat[i + 1] - s) * .95, slide: i > 0 && r() < .35}); }); } };

  // ---------------------------------------------------------------- toms: tonal 16th toms tuned to chord tones (Bodzin)
  P.toms = class { constructor(Pc, o){ this.slot = o.slot || 'tom'; const r = this.r = Pc.rng('toms'); this.pat = o.pat || A.euclid(r.int(5, 7), 16, r.int(0, 3)); this.vel = o.vel || .5; }
    bar(c){ const tones = c.voicing.notes, r = this.r; for (let s = 0; s < 16; s++){ if (!this.pat[s] || r() > .5 + c.density * .5) continue; const m = fit(tones[(s * 7 + c.barIndex) % tones.length] - 12, 43, 62); c.emit(this.slot, s, {note: m, vel: this.vel * (.7 + .3 * r()), pan: ((s % 5) / 4 - .5) * .7}); } } };

  // ---------------------------------------------------------------- dubstab: dub-techno chord stab on offbeats, loose timing, one chord for a long time (Basic Channel lineage, research/07 D11)
  P.dubstab = class { constructor(Pc, o){ this.slot = o.slot || 'stab'; const r = this.r = Pc.rng('dub'); this.pat = o.pat || r.pick([[2, 6, 10, 14], [2, 10, 14], [2, 6, 14], [6, 10, 14], [2, 6, 10]]); this.vel = o.vel || .55; }
    bar(c){ const r = this.r, notes = c.voicing.notes.filter(m => m >= 55 && m <= 74).slice(0, 4); if (!notes.length) return;
      for (const s of this.pat){ if (r() > .55 + c.density * .45) continue; const loose = (r() - .5) * .25; notes.forEach((m, i) => c.emit(this.slot, s + loose + i * .01, {note: m, vel: this.vel * (.55 + .45 * r()), dur: c.step * .7}, true)); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_PARTS2;
