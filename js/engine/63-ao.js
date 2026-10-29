/* Maut ki Awaaz — engine module: the AO world (reverse-engineered from Max Cooper — AO; research/09-ao.md).
   What the track is, measured: 123 BPM, G major, NO drums at all. Two layers: (1) a sub-bass melody (49–110 Hz) that pulses
   on the off-beats, one long held note where a drop would be; (2) a harmonic "cloud" — a sustained chord drone chopped by an
   amplitude gate at sextuplet → 32nd → 64th-note rates that accelerate over the piece, L/R alternating (wide highs, mono sub),
   with its low-pass closing for the dark section. Harmony: first half hovers on a II pedal (A under D/Bm/Em/G), then the bass
   walks (B D C D) and settles into a IV ↔ I/3 pendulum (C2 ↔ B1) with the 5th (D4) as a common-tone drone on top.
   Spectrum: centroid 179 Hz, tilt −22 dB/decade, highs −28 dB, crest 6.9 dB. Additive: nothing here touches other worlds. */
'use strict';
function AWZ_AO(A){
  const P = A.PATCH, W = A.WORLDS, clamp = A.clamp, fit = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };

  // ---------------------------------------------------------------- cloud: a poly drone chopped at a beat-locked rate, ping-pong, with a ridden low-pass
  A.CloudInst = class extends A.PolyInst {
    constructor(sr, Voice, n, patch, seed){ super(sr, Voice, n, patch, seed); this.chop = {rate: 6, duty: .5, pp: .65, depth: .9}; this.bpm = 120; this.anchor = 0; this.t = 0;
      this.gL = 1; this.gR = 1; this.gk = 1 - Math.exp(-1 / (.0012 * sr)); this.lpL = new A.SVF(); this.lpR = new A.SVF(); this.lpF = new A.Smooth(3400, .25, sr / 128); this.lpNow = 3400; }
    doPlay(off, ev, pos){ if (ev.chop){ const now = this.t + (pos || 0) + off; Object.assign(this.chop, ev.chop); if (ev.chop.lp) this.lpF.set(ev.chop.lp); if (ev.chop.bpm) this.bpm = ev.chop.bpm; if (ev.chop.sync) this.anchor = now; return null; }
      return super.doPlay(off, ev, pos); }
    render(L, R, n){ const r = A.segRender(this, L, R, n); this.t += n; return r; }
    renderVoices(L, R, n, pos){ const act = this.pool.render(L, R, n); if (!act) return false;
      const sr = this.sr, C = this.chop, stepN = 60 / this.bpm / C.rate * sr, t0 = this.t + (pos || 0) - this.anchor, duty = C.duty, pp = C.pp, dep = C.depth, gk = this.gk;
      const f = this.lpF.tick(); this.lpL.set(f, .6, sr); this.lpR.set(f, .6, sr); const a = this.lpL, b = this.lpR; let gL = this.gL, gR = this.gR;
      for (let i = 0; i < n; i++){ const q = (t0 + i) / stepN, k = Math.floor(q), fr = q - k, open = fr < duty ? 1 : 0;
        const tl = open * (1 - pp) + pp * ((k & 1) === 0 ? open : 0), tr = open * (1 - pp) + pp * ((k & 1) === 1 ? open : 0);   // pp: 0 = both channels together, 1 = full ping-pong
        gL += (tl - gL) * gk; gR += (tr - gR) * gk;
        a.run(L[i]); b.run(R[i]); L[i] = a.lp * (1 - dep + dep * gL); R[i] = b.lp * (1 - dep + dep * gR); }
      this.gL = gL; this.gR = gR; return true; } };

  // ---------------------------------------------------------------- sounds
  Object.assign(P, {
    // the sub: a sine fundamental with a little 2nd/3rd harmonic, ~270 ms decay, no octave-down sub (the note IS the sub)
    ao_sub:   {inst: 'bass', p: {sub: 1, subOct: 0, harm: .7, shape: 2, cutoff: 150, res: .1, keytrack: .3, envAmt: .6, fd: .25, fs: .1, aa: .004, ad: .42, as: .22, ar: .14, drive: 2, asym: .06, harmHP: 60, harmLP: 900, subLP: 160, glide: .03, gain: 1}},
    // the cloud: dark detuned saws, slow attack, long release; the chop and the low-pass live in the instrument
    ao_cloud: {inst: 'cloud', p: {shape1: 2, shape2: 2, osc2Level: .75, detune2: 7, unison: 3, spread: 16, uniPan: .9, drift: 3, noise: .16, cutoff: 3200, res: .14, keytrack: .35, envAmt: .6, fa: .5, fd: 1.2, fs: .8, fr: 1, aa: .3, ad: .9, as: .85, ar: .55, gain: .42}},
    ao_glass: {inst: 'cloud', p: {shape1: 3, pw: .3, shape2: 2, osc2Level: .5, detune2: 5, unison: 2, spread: 10, uniPan: .8, drift: 2, noise: .2, cutoff: 4200, res: .1, keytrack: .4, envAmt: .5, fa: .4, fd: 1, fs: .8, fr: 1, aa: .35, ad: 1, as: .85, ar: .6, gain: .36}}});
  A.JITTER.cloud = A.JITTER.va;

  // ---------------------------------------------------------------- harmony: IV(add9) ↔ I pendulum with a iii colour; the sub decides the pedal
  A.FAM.ao = r => ({loop: [{deg: 3, bars: 4, type: 'add9'}, {deg: 0, bars: 4, type: 'tri'}, {deg: 3, bars: 4, type: 'add9'}, {deg: r.pick([2, 0, 2]), bars: 4, type: 'tri'}], pedal: null});
  A.FAMILIES = Object.keys(A.FAM);
  // form: hover (II pedal) → turn (bass walks) → pendulum (peak, sub holds) → dark (low-pass closed) → pendulum → out
  A.FORMS.ao = [['hover', 16, .25, .4], ['hover', 16, .4, .55], ['turn', 16, .55, .72, 'build'], ['pendulum', 32, .82, .92, 'peak'], ['dark', 16, .55, .48, 'break'], ['pendulum', 24, .88, .96, 'peak'], ['out', 8, .4, .03, 'outro']];

  // ---------------------------------------------------------------- the sub part: off-beat pulses, root on the one, the pedal in the hover, a held note at the drop
  A.PARTS.aosub = class { constructor(Pc, o){ this.slot = o.slot || 'sub'; this.r = Pc.rng('aosub'); this.vel = o.vel || 1; this.hold = 0; }
    bar(c){ const r = this.r, key = c.key, ch = c.chord, S = c.section, tag = S.tag || S.name, prog = c.pieceProg || 0;
      const hover = tag === 'hover', turn = tag === 'build';
      // the note: II pedal while hovering; the chord root after, the third under the I chord (the C2 ↔ B1 pendulum); the turn walks between them
      let pc; if (hover) pc = key.pc(1); else if (turn) pc = (c.barInSection % 8 < 4) ? key.pc(2) : key.pc(4); else pc = ch.deg === 0 && ch.third !== null ? ch.third : ch.root;
      const low = fit(pc + 36, 30, 41), up = hover ? 12 : 0;
      if (this.hold > 0){ this.hold--; return; }
      // the drop: the pulse stops and one note is held for two bars
      if (c.barInSection === 0 && tag === 'peak' && r() < .75){ c.emit(this.slot, 0, {note: low, vel: this.vel, dur: c.bar * 2 - c.step * .5}); this.hold = 1; return; }
      c.emit(this.slot, 0, {note: low, vel: this.vel, dur: c.step * 1.6});
      for (const s of [2, 6, 10, 14]){ if (hover && c.E < .35 && (s === 6 || s === 14) && r() < .5) continue; c.emit(this.slot, s, {note: low + up, vel: this.vel * (s === 2 || s === 10 ? .92 : .84), dur: c.step * .95}); }
      // the double hit (a pulse pushed a 16th early) and the odd octave jump up
      if (r() < .35) c.emit(this.slot, r.pick([1, 9, 5, 13]), {note: low + up, vel: this.vel * .7, dur: c.step * .6});
      if (!hover && r() < .15) c.emit(this.slot, 12, {note: low + 12, vel: this.vel * .8, dur: c.step * .9}); } };

  // ---------------------------------------------------------------- the cloud part: chord drone + the common-tone 5th on top; the chop rate rides the piece
  A.PARTS.aocloud = class { constructor(Pc, o){ this.slot = o.slot || 'cloud'; this.r = Pc.rng('aocloud'); this.vel = o.vel || .6; this.top = o.top !== false; this.rate = 6; }
    bar(c){ const r = this.r, S = c.section, tag = S.tag || S.name, prog = c.pieceProg || 0, bis = c.barInSection;
      // chop: sextuplets while hovering → 32nds in the turn → 64ths in the second half of the peak → back for the dark section → slow at the end
      let rate = 6, duty = .5, lp = 5200, depth = .9;
      if (tag === 'build'){ rate = 8; lp = 6500; } else if (tag === 'peak'){ rate = bis < S.bars / 2 ? 8 : 16; lp = 8000; depth = 1; } else if (tag === 'break'){ rate = 6; lp = 520; depth = .75; } else if (tag === 'outro'){ rate = 4; lp = 1200; depth = .6; }
      if (tag === 'hover' && prog > .12) rate = r() < .3 ? 8 : 6;
      if (rate !== this.rate || bis === 0){ this.rate = rate; c.emit(this.slot, 0, {chop: {rate, duty, pp: .65, depth, lp, bpm: 60 / c.beat, sync: bis === 0}}, true); }
      if (!c.chordStart && bis % 4 !== 0) return;
      // the chord: voiced notes, long (the gate does the rhythm); the 5th of the key held on top as the common tone
      const notes = c.voicing.notes.slice(0, 4), dur = Math.min(c.chordBars - c.barInChord, 4) * c.bar - c.step;
      notes.forEach((m, i) => c.emit(this.slot, 0, {note: fit(m, 55, 76), vel: this.vel * (.8 + .2 * r()), dur, pan: (i % 2 ? .35 : -.35)}, true));
      c.emit(this.slot, 0, {note: fit(c.chordRoot + 48, 48, 56), vel: this.vel * .95, dur, pan: 0}, true);   // the chord root low in the cloud (150–200 Hz body)
      if (this.top) c.emit(this.slot, 0, {note: fit(c.key.pc(4) + 60, 62, 69), vel: this.vel * .7, dur, pan: 0}, true);
      // rarely, a high single tone (the D5/F#5 that appears late in the track)
      if (tag === 'peak' && prog > .55 && r() < .22) c.emit(this.slot, r.pick([4, 8, 12]), {note: fit(c.key.pc(r.pick([4, 6, 1])) + 72, 72, 84), vel: this.vel * .55, dur: c.beat * 2, pan: r() < .5 ? -.5 : .5}, true); } };

  // ---------------------------------------------------------------- the world
  W.AO = {name: 'AO', desc: 'no drums: a sub-bass melody pulsing on the off-beats under a chord cloud chopped faster and faster', ref: 'Max Cooper — AO', v2: true,
    tempo: [120, 126], swing: [0, 0], modes: {ionian: 3, mixolydian: 1}, families: {ao: 1}, colour: [.3, .5], spread: [.4, .6], form: ['ao'], aeqFrom: 2,
    tracks: {
      sub:   {patch: ['ao_sub'], bus: 'bass', db: 0, width: 0},
      cloud: {patch: ['ao_cloud', 'ao_glass'], voices: 10, db: 3, hp: 120, lp: 11000, width: 1, plate: .12, hall: .2, delay: .1},
      fx:    {patch: ['fx'], db: -14, hp: 40, hall: .3, plate: .1}},
    parts: [
      {part: 'aosub', slot: 'sub', opts: {}, on: 0, core: true, tight: true},
      {part: 'aocloud', slot: 'cloud', opts: {}, on: .34, core: false, tight: true}],
    fx: {plate: {decay: .45, damping: .55}, hall: {rt60: 3, damp: 2500}, delay: {beats: .75, feedback: .3, lp: 2500, hp: 300, pingpong: 1}, duck: {bass: 0, ret: 0}, master: {tiltHigh: -1.5}},
    moves: {riser: 0, roll: 0, gate: 0, hpbuild: 0, climb: 0, halftime: 0, stutter: 0, freeze: 0, gap: .4, impact: .4, subdrop: .8, swell: .6, tapestop: .3, throw: .5, wash: .6, down: .5, keylift: .2}, macros: {chaos: .1, space: .4, motion: .3}};
  A.WORLD_LIST = Object.keys(W);
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_AO;
