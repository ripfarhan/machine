/* Maut ki Awaaz — engine module: echo ghosts (v2, additive).
   A short sound of 1–3 s, mostly wet: one or two notes thrown into their own dub echo and a big reverb, in the background.
   It usually lands in the last bar of a chord on a note that belongs to the NEXT chord (or, in the dark worlds, on a note
   outside the key), so its echoes hang over the chord change: a moment of friction, then the harmony arrives under it.
   (Heard in a BREAKS piece the user loved: vocal chops through the ping-pong delay and the hall, around 0:23.)
   Every world gets a `ghost` track, added last so genomes keep their random draws. The part only plays with FX MOVES on,
   so v1 sound is unchanged. Per world: how often (amt), which sound, and whether it follows the grid or floats free. */
'use strict';
function AWZ_GHOSTS(A){
  const P = A.PATCH, W = A.WORLDS, fit = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; }, BLK = 128;

  // ---------------------------------------------------------------- its own echo: a tape delay used as an insert, mostly wet
  A.DubEcho = class { constructor(sr){ this.d = new A.TapeDelay(sr); this.wl = new Float32Array(BLK); this.wr = new Float32Array(BLK); this.dry = .3; this.wet = 1; }
    set(o){ this.d.set(o); if (o.dry !== undefined) this.dry = o.dry; if (o.wet !== undefined) this.wet = o.wet; }
    process(L, R, n){ const wl = this.wl, wr = this.wr, d = this.dry, w = this.wet; wl.fill(0, 0, n); wr.fill(0, 0, n); this.d.process(L, R, wl, wr, n);
      for (let i = 0; i < n; i++){ L[i] = L[i] * d + wl[i] * w; R[i] = R[i] * d + wr[i] * w; } } };

  // ---------------------------------------------------------------- sounds
  Object.assign(P, {
    ghost_vox:   {inst: 'choir', p: {aa: .008, ad: .3, as: .35, ar: .45, detune: 9, breath: .05, bend: 3, bendTime: .1, vdrift: 1.5, q: 10, gain: .9}},
    ghost_low:   {inst: 'choir', p: {aa: .04, ad: .6, as: .3, ar: .9, detune: 16, breath: .12, bend: 4, bendTime: .18, vdrift: .8, vowel: 3.6, q: 8, gain: .9}},
    ghost_bell:  {inst: 'fm', p: {ratio: 3.5, index: 2.2, id: .25, is: 0, ir: .3, lp: 6000, aa: .001, ad: .9, as: 0, ar: .8, gain: .6}},
    ghost_glass: {inst: 'fm', p: {ratio: 2, index: .6, id: .5, is: 0, ir: .5, lp: 8000, aa: .002, ad: 1.2, as: 0, ar: 1, gain: .6}},
    ghost_metal: {inst: 'fm', p: {ratio: 1.414, index: 2, id: .2, is: 0, ir: .2, lp: 5000, aa: .001, ad: .5, as: 0, ar: .5, feedback: .3, gain: .5}}});

  // ---------------------------------------------------------------- the part
  // amt ≈ calls per 8 bars · dark: share of notes outside the key (scary) · free: off the grid, not tied to chord changes
  A.PARTS.ghost = class { constructor(Pc, o){ this.slot = o.slot || 'ghost'; this.r = Pc.rng('ghost'); this.amt = o.amt || .5; this.dark = o.dark || 0; this.free = !!o.free;
      this.lo = o.lo || 67; this.hi = o.hi || 86; this.vel = o.vel || .6; this.peak = o.peak === undefined ? .3 : o.peak; this.cool = 0; }
    bar(c){ if (!c.v2) return; const r = this.r; this.cool--;
      const tag = c.section.tag || c.section.name, pre = c.nextChordIn === 1, intoBig = c.nextBigger && c.barsLeftInSection <= 2;
      let p = this.amt / 8 * (tag === 'break' ? 1.6 : tag === 'peak' ? this.peak : tag === 'build' ? .7 : 1);
      if (!this.free) p *= (pre ? 1.8 : .55) * (intoBig ? 1.6 : 1);
      const u = r(); if (this.cool > 0 || u > p) return; this.cool = this.free ? 2 : 3;
      // the note: next chord's tone the current chord lacks (friction, then it resolves) · outside the key (dark) · or a plain chord tone
      const cur = c.chordPcs, nxt = c.nextChordPcs || cur, w = r(); let pc;
      if (w < this.dark * .6) pc = (c.chordRoot + r.pick([1, 6, 8])) % 12;
      else if (w < .8){ const ant = nxt.filter(x => cur.indexOf(x) < 0); pc = ant.length ? r.pick(ant) : r.pick(nxt); }
      else pc = r.pick(cur);
      const m0 = fit(pc + 60, this.lo, this.hi), n = r() < .6 ? 1 : r() < .8 ? 2 : 3;
      const start = this.free ? r() * 13 : r.pick([6, 8, 10, 10, 11, 12]), pan = (r() - .5) * 1.2;
      let m = m0, s = start;
      for (let i = 0; i < n; i++){
        c.emit(this.slot, s, {note: m, vel: this.vel * (i ? .75 : 1) * (.8 + .25 * r()), dur: c.step * (i === n - 1 ? r.pick([2, 3, 4]) : 1.5), pan: i ? -pan * .6 : pan}, true);
        // the next note steps to the nearest tone of the next chord (the resolution the echo carries over the bar line)
        let best = m, bd = 99; for (const x of nxt){ for (const o of [-12, 0, 12]){ const cand = m - ((m % 12) - x) + o, d = Math.abs(cand - m); if (d > 0 && d < bd && cand >= this.lo - 5 && cand <= this.hi){ bd = d; best = cand; } } }
        m = best; s += r.pick([1.5, 2, 3]); if (s > 15.5) break; } } };

  // ---------------------------------------------------------------- per world: sound, rate, echo
  // heavy = often and loud wet; light = rare and quiet; free = off the grid, its own time
  const ECHO = (beats, fb, o) => Object.assign({type: 'echo', beats, feedback: fb, lp: 2400, hp: 450, wow: .0022, flutter: .0001, pingpong: true, dry: .3, wet: 1}, o || {});
  const G = {
    BREAKS:     {patch: ['ghost_vox'], amt: .35, db: -15, echo: ECHO(.75, .5)},
    ATLAS:      {patch: ['ghost_vox'], amt: .35, db: -15, echo: ECHO(.75, .5)},
    NIGHTBUS:   {patch: ['ghost_vox', 'ghost_low'], amt: .8, dark: .3, db: -13, echo: ECHO(1, .62)},
    FOG:        {patch: ['ghost_low', 'ghost_vox'], amt: 1.4, dark: .2, db: -12, lo: 60, hi: 79, echo: ECHO(.75, .66, {lp: 1800})},
    VOID:       {patch: ['ghost_low', 'ghost_metal'], amt: .9, dark: .7, db: -12, lo: 55, hi: 76, echo: ECHO(1.5, .62, {lp: 1700})},
    INTENSE:    {patch: ['ghost_metal', 'ghost_low'], amt: .8, dark: .55, db: -13, lo: 58, hi: 79, echo: ECHO(.75, .6)},
    TAPE:       {patch: ['ghost_vox', 'ghost_glass'], amt: .8, dark: .15, db: -13, echo: ECHO(1, .6, {wow: .004})},
    SAW:        {patch: ['ghost_glass'], amt: .7, dark: .3, db: -13, echo: ECHO(.75, .58)},
    BLOOM:      {patch: ['ghost_vox'], amt: .7, db: -13, echo: ECHO(.75, .6, {wow: .0035})},
    DRIFT:      {patch: ['ghost_bell', 'ghost_glass'], amt: .8, free: true, db: -13, echo: ECHO(1.333, .62)},
    AIRPORT:    {patch: ['ghost_bell', 'ghost_glass'], amt: .6, free: true, db: -14, echo: ECHO(1.5, .6, {lp: 3000})},
    REICH:      {patch: ['ghost_glass'], amt: .5, free: true, db: -15, echo: ECHO(1, .55)},
    FELT:       {patch: ['ghost_bell'], amt: .45, db: -15, echo: ECHO(.75, .5)},
    RETRO:      {patch: ['ghost_glass'], amt: .45, db: -15, echo: ECHO(.75, .52, {wow: .003})},
    CRESCENDO:  {patch: ['ghost_bell'], amt: .3, db: -16, echo: ECHO(.75, .48)},
    ARPRIDE:    {patch: ['ghost_vox'], amt: .35, db: -15, echo: ECHO(.75, .5)},
    ACID:       {patch: ['ghost_metal'], amt: .4, dark: .35, db: -15, echo: ECHO(.75, .55)},
    BERLIN:     {patch: ['ghost_glass'], amt: .45, db: -15, echo: ECHO(.75, .55)},
    REPETITION: {patch: ['ghost_vox'], amt: .4, db: -15, echo: ECHO(.75, .5)},
    PRIME:      {patch: ['ghost_bell'], amt: .35, db: -16, echo: ECHO(.75, .48)},
    TREEMAP:    {patch: ['ghost_bell'], amt: .4, db: -15, echo: ECHO(.75, .5)},
    PERPETUAL:  {patch: ['ghost_glass'], amt: .4, db: -15, echo: ECHO(.75, .5)},
    POLYMETER:  {patch: ['ghost_bell'], amt: .35, db: -16, echo: ECHO(.75, .48)},
    COSMIC:     {patch: ['ghost_vox'], amt: .5, db: -14, echo: ECHO(1, .55)},
    EMERGENCE:  {patch: ['ghost_glass'], amt: .45, db: -15, echo: ECHO(.75, .5)}};
  const DEF = {patch: ['ghost_glass'], amt: .4, db: -15, echo: ECHO(.75, .5)};
  for (const k in W){ const g = Object.assign({}, DEF, G[k] || {}), w = W[k]; if (w.tracks.ghost) continue;
    w.tracks.ghost = {patch: g.patch, voices: 6, db: g.db, hp: 260, hall: .7, plate: .05, pan: 0, ins: [g.echo]};
    w.parts = w.parts.concat([{part: 'ghost', slot: 'ghost', opts: {amt: g.amt, dark: g.dark || 0, free: !!g.free, lo: g.lo, hi: g.hi}, on: 0, core: true, tight: true}]); }
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_GHOSTS;
