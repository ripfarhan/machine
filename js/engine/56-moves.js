/* Maut ki Awaaz — engine module: transition moves + variation devices (v2, additive).
   The composer asks this module, once per bar, what should happen around section boundaries and phrase ends:
   risers, reverse swells, impacts + sub drops, downlifters, snare rolls, filter builds (HP sweep), trance gate, tape stops,
   buffer stutters, a breath of silence before the drop, delay throws, reverb washes, granular freeze in breaks,
   frequency-shifter climbs, half-time drums before the peak, a key lift into the last peak.
   Rotation: every move has a cooldown and the same move is not used at two boundaries in a row, so pieces do not
   repeat their transitions. Each world can weight or disable moves (world.moves). Engine commands use slot '@'. */
'use strict';
function AWZ_MOVES(A){
  // cooldown in bars, base weight, which boundaries it suits
  A.MOVES = {
    riser:    {cd: 24, w: 1,   into: ['peak', 'build', 'up']},
    swell:    {cd: 8,  w: 1,   into: ['peak', 'build', 'break', 'up', 'any']},
    impact:   {cd: 0,  w: 1,   at: ['peak', 'up']},
    subdrop:  {cd: 16, w: .6,  at: ['peak']},
    down:     {cd: 16, w: .9,  at: ['break', 'outro', 'downer']},
    roll:     {cd: 32, w: .8,  into: ['peak']},
    hpbuild:  {cd: 32, w: .9,  during: ['build']},
    gate:     {cd: 40, w: .5,  during: ['build', 'peak']},
    tapestop: {cd: 64, w: .45, into: ['break', 'outro']},
    stutter:  {cd: 12, w: .7,  into: ['peak', 'break', 'phrase']},
    gap:      {cd: 32, w: .7,  into: ['peak']},
    throw:    {cd: 16, w: .8,  into: ['break', 'phrase', 'outro']},
    wash:     {cd: 16, w: .7,  into: ['break', 'outro', 'any']},
    freeze:   {cd: 64, w: .5,  during: ['break']},
    climb:    {cd: 48, w: .4,  during: ['build']},
    halftime: {cd: 48, w: .45, during: ['build']},
    keylift:  {cd: 999, w: .35, at: ['lastpeak']}};

  A.MOVE_CAT = {riser: 'pitch', down: 'pitch', swell: 'pitch', impact: 'loud', subdrop: 'loud', hpbuild: 'filter', climb: 'filter', gap: 'silence', tapestop: 'silence', stutter: 'mech', roll: 'rhythm', halftime: 'rhythm', gate: 'rhythm', throw: 'space', wash: 'space', freeze: 'space', keylift: 'harmony'};
  A.Moves = class {
    constructor(comp, world){ this.c = comp; this.w = world; this.r = comp.P.rng('moves'); this.last = {}; this.prevPick = {}; this.log = []; this.lifted = false; this.planned = null;
      this.weights = Object.assign({}, ...Object.keys(A.MOVES).map(k => ({[k]: A.MOVES[k].w})), world.moves || {}); }
    ok(name){ const m = A.MOVES[name], wt = this.weights[name]; if (!wt) return false; const l = this.last[name]; return l === undefined || this.c.k - l >= m.cd; }
    use(name, note){ this.last[name] = this.c.k; this.log.push(note || name); }
    pick(cands, n){ const r = this.r, out = [], cats = {}; const pool = cands.filter(x => this.ok(x)); for (let i = 0; i < n && pool.length; i++){ let tot = 0; for (const x of pool) tot += this.weights[x] * (this.prevPick[x] ? .35 : 1); let u = r() * tot, ch = pool[0];
        for (const x of pool){ u -= this.weights[x] * (this.prevPick[x] ? .35 : 1); if (u <= 0){ ch = x; break; } } pool.splice(pool.indexOf(ch), 1); if (cats[A.MOVE_CAT[ch]]){ i--; continue; } cats[A.MOVE_CAT[ch]] = 1; out.push(ch); } this.prevPick = {}; for (const x of out) this.prevPick[x] = 1; return out; }
    slotFor(list){ for (const s of list) if (this.c.w.tracks[s]) return s; return null; }
    // called by the composer for every bar; pushes events into `out` (absolute sample times)
    bar(ctx){ const c = this.c, r = this.r, out = ctx.out, t0 = ctx.t0, stepN = c.stepN, barN = c.barN, S = ctx.S, next = ctx.next, bl = ctx.barsLeft, E = ctx.E, chaos = c.macro.chaos;
      const at = (step, slot, ev) => out.push({t: t0 + step * stepN, slot, ev}), cmd = (step, ev) => at(step, '@', ev), fx = (step, ev) => at(step, 'fx', ev);
      const nt = next ? next.tag || next.name : 'end', bigger = next && (next.E0 > E + .12 || next.tag === 'peak'), smaller = next && next.E0 < E - .15;
      const into = nt === 'peak' ? 'peak' : nt === 'build' ? 'build' : nt === 'break' ? 'break' : nt === 'outro' || nt === 'end' ? 'outro' : bigger ? 'up' : 'any';
      this.log = [];
      // ---- section starts (the downbeat that a transition was aiming at)
      if (ctx.sectionStart && c.k > 0){ const tag = S.tag || S.name; this.cleanup(cmd, fx);
        if (tag === 'peak' || ctx.arrivedUp){ if (this.ok('impact')){ fx(0, {fx: 'impact', vel: .85, dur: 3, freq: 50}); this.use('impact', 'impact on the downbeat'); }
          if (tag === 'peak' && this.ok('subdrop') && r() < .55){ fx(0, {fx: 'subdrop', vel: .7, dur: 2.2, freq: 55}); this.use('subdrop', 'sub drop'); }
          if (this.liftNote){ this.log.push(this.liftNote); this.liftNote = null; } }
        if ((tag === 'break' || tag === 'outro') && this.ok('down') && r() < .8){ fx(0, {fx: 'down', vel: .6, dur: barN * 2 / c.sr}); this.use('down', 'downlifter'); }
        if (tag === 'break' && this.ok('freeze') && r() < .6 && c.engineHas('gran')){ cmd(0, {cmd: 'freeze', on: true}); this.freezeOn = true; this.use('freeze', 'granular freeze — the last bar hangs in the air'); }
        if (tag === 'build'){ const L = S.bars; const ch = this.pick(['hpbuild', 'gate', 'climb', 'halftime'].filter(x => this.weights[x]), r() < .5 ? 1 : 2);
          for (const m of ch){ if (m === 'hpbuild'){ const hb = Math.min(L, 8); this.hpPlan = {hb, to: 420 + r() * 400}; this.use(m, `filter build: high-pass rises over the last ${hb} bars`); }
            else if (m === 'gate'){ cmd(0, {cmd: 'gate', on: true, k: r.pick([9, 11, 12, 13]), rot: r.int(0, 3)}); this.gateOn = true; this.use(m, 'trance gate on the music'); }
            else if (m === 'climb'){ cmd(0, {cmd: 'climb', dur: L * barN / c.sr}); this.use(m, 'barber-pole climb (frequency shifter)'); }
            else if (m === 'halftime'){ c.halfTimeFrom = c.k + Math.max(0, L - 4); c.halfTimeTo = c.k + L; this.use(m, 'drums go half-time for the last 4 bars'); } } }
        if (tag === 'peak' && this.ok('gate') && r() < .25){ cmd(0, {cmd: 'gate', on: true, k: r.pick([11, 13]), rot: 0}); this.gateOn = true; this.use('gate', 'gated pads in the peak'); } }
      // planned filter build starts when its bars arrive (emitted now, not queued bars ahead, so a cut build never leaks into the next section)
      if (this.hpPlan && !ctx.hold && (S.tag || S.name) === 'build' && bl <= this.hpPlan.hb){ cmd(0, {cmd: 'ramp', what: 'hp', from: 20, to: this.hpPlan.to, dur: bl * barN / c.sr, curve: 2}); this.hpPlan = null; }
      // HOLD loops the last 8 bars of a section: no boundary moves (they would fire every loop with no section start to undo them)
      if (ctx.hold){ if (!this.wasHold){ this.cleanup(cmd, fx); this.wasHold = true; } return this.log; } this.wasHold = false;
      if (!next) return this.log;
      // ---- approaching a boundary
      const bigInto = into === 'peak' || into === 'build' || into === 'up';
      if (bigInto && (bl === 8 || bl === 4 || bl === 2) && this.ok('riser') && r() < (bl === 8 ? .4 : bl === 4 ? .5 : .35) * (into === 'peak' ? 1 : .7)){ fx(0, {fx: 'riser', vel: .38 + E * .25, dur: bl * barN / c.sr, freq: 55 + r() * 40}); this.use('riser', `riser (${bl} bars) → ${nt.toUpperCase()}`); }
      if (into === 'peak' && bl === 2 && this.ok('roll') && r() < .7){ const sl = this.slotFor(['snare', 'click', 'perc', 'hat', 'shaker']); if (sl){ for (let s = 0; s < 16; s += 2) at(s, sl, {vel: .25 + s / 16 * .2}); this.use('roll', 'snare roll into the drop'); this.rolling = sl; } }
      if (into === 'peak' && bl === 1 && this.rolling){ const sl = this.rolling; for (let s = 0; s < 8; s++) at(s, sl, {vel: .45 + s / 8 * .2}); for (let s = 8; s < 15.5; s += .5) at(s, sl, {vel: .65 + (s - 8) / 8 * .3}); this.rolling = null; }
      if (bl === 1 && r() < (into === 'peak' ? .15 : into === 'build' || into === 'break' ? .3 : .55)){ /* plain boundary: only the arrangement changes (research/07 §0) */ }
      else if (bl === 1){ // the last bar: 1–2 moves from the pool that suits this boundary
        // into a drop: only the reverse swell. The half-beat gap and the buffer stutter read as a skipped note right before the drop.
        const pool = into === 'peak' ? ['swell'] :into === 'break' ? ['tapestop', 'throw', 'wash', 'swell', 'stutter'] : into === 'outro' ? ['tapestop', 'wash', 'throw'] : into === 'build' || into === 'up' ? ['swell', 'stutter', 'throw'] : ['swell', 'wash', 'throw'];
        const ch = this.pick(pool, into !== 'peak' && r() < .5 ? 2 : 1);
        for (const m of ch){
          if (m === 'swell'){ const b = r.pick([4, 8, 8, 12, 16]); fx(16 - b, {fx: 'swell', vel: .45 + r() * .2, dur: b * stepN / c.sr}); this.use(m, `reverse swell (${b / 4} beats) into the downbeat`); }
          else if (m === 'gap'){ cmd(14, {cmd: 'gap', dur: 2 * stepN / c.sr}); this.use(m, 'half a beat of silence before the drop'); }
          else if (m === 'stutter'){ const len = r.pick([1, .5, .5, .25]) * stepN / c.sr; cmd(12, {cmd: 'stutter', len, dur: 4 * stepN / c.sr - .004, pitch: into === 'peak' ? r.pick([0, 1, 2]) : 0}); this.use(m, `stutter (1/${Math.round(16 / (len * c.sr / stepN))} notes)`); }
          else if (m === 'tapestop'){ const st = r.pick([4, 6, 8]); cmd(16 - st, {cmd: 'tapestop', dur: st * stepN / c.sr * .9}); cmd(16, {cmd: 'release'}); this.use(m, `tape stop (${st / 4} beats)`); this.tapeStopped = true; }
          else if (m === 'throw'){ cmd(12, {cmd: 'throw', send: 'delay', amt: 2.5 + r() * 1.5, fb: .68 + r() * .14, dur: barN * (1 + r()) / c.sr}); this.use(m, 'delay throw'); }
          else if (m === 'wash'){ cmd(8, {cmd: 'throw', send: 'hall', amt: 3.5, dur: barN * 1.2 / c.sr}); this.use(m, 'reverb wash'); } } }
      else if ((c.bis % 8) === 7 && bl > 2 && r() < .12 + chaos * .35){ // phrase ends inside a section: small fills only
        const m = this.pick(['stutter', 'throw', 'swell'], 1)[0]; if (m === 'stutter'){ cmd(14, {cmd: 'stutter', len: .5 * stepN / c.sr, dur: 2 * stepN / c.sr - .004, pitch: 0}); this.use(m, 'phrase-end stutter'); }
        else if (m === 'throw'){ cmd(12, {cmd: 'throw', send: 'delay', amt: 2.5, fb: .7, dur: barN / c.sr}); this.use(m, 'delay throw'); } else if (m === 'swell'){ fx(12, {fx: 'swell', vel: .35, dur: 4 * stepN / c.sr}); this.use(m, 'small swell'); } }
      return this.log; }
    // undo section-scoped effects at a boundary
    cleanup(cmd, fx){ if (this.gateOn){ cmd(0, {cmd: 'gate', on: false}); this.gateOn = false; } if (this.freezeOn){ cmd(0, {cmd: 'freeze', on: false}); this.freezeOn = false; }
      if (this.tapeStopped){ cmd(0, {cmd: 'release'}); this.tapeStopped = false; } cmd(0, {cmd: 'ramp', what: 'hp', to: 10, dur: .05}); cmd(0, {cmd: 'climb', dur: 0}); this.hpPlan = null; this.rolling = null;
      if (this.c.halfTimeTo > this.c.k) this.c.halfTimeTo = -1; }
    // before the parts of a section's first bar are written: decide the key lift so the downbeat already sounds in the new key
    pre(S){ const c = this.c, r = this.r, tag = S.tag || S.name; if (tag !== 'peak') return;
      const lastPeak = c.sections.slice(c.si + 1).every(s => s.tag !== 'peak'), peaks = c.sections.filter(s => s.tag === 'peak').length;
      if (lastPeak && peaks >= 1 && c.si > 2 && !this.lifted && this.weights.keylift && this.ok('keylift') && r() < this.weights.keylift){ this.lifted = true; c.keyLift(r.pick([2, 2, 2, 5])); this.last.keylift = c.k; this.liftNote = 'key lift into the last peak'; } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_MOVES;
