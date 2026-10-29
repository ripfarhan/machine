/* Maut ki Awaaz — engine module: composer.
   genome → form plan (sections with an energy curve) → bars → events, generated one bar ahead.
   Arrangement: parts enter/leave by energy thresholds, re-evaluated on 4-bar boundaries with at most one entry per boundary
   ("one change per 8 bars" feel), everything re-evaluated at section starts. Drums leave in breaks and in the last bars of a
   build (Cooper: drums out before the peak). Harmony: one loop for the whole piece, voice-led, one substitution after a few
   cycles, MOOD moves the mode at the next loop boundary, the peak "opens" the voicing. */
'use strict';
function AWZ_COMPOSER(A){
  const clamp = A.clamp, lerp = A.lerp;
  // [name, bars, E start, E end, tag]
  A.FORMS = {
    swell:     [['intro', 16, .1, .25], ['grow', 16, .3, .45], ['A', 32, .5, .62], ['break', 16, .3, .22, 'break'], ['build', 16, .45, .78, 'build'], ['peak', 32, .86, .96, 'peak'], ['outro', 16, .42, .06, 'outro']],
    crescendo: [['intro', 16, .08, .18], ['rise', 16, .22, .36], ['rise', 16, .38, .52], ['rise', 16, .54, .68], ['rise', 16, .7, .84, 'build'], ['peak', 32, .9, 1, 'peak'], ['collapse', 8, .3, .22, 'break'], ['outro', 16, .3, .04, 'outro']],
    club:      [['intro', 16, .32, .44], ['groove', 32, .55, .66], ['break', 16, .3, .34, 'break'], ['build', 8, .5, .8, 'build'], ['drop', 32, .88, .94, 'peak'], ['groove', 16, .68, .6], ['outro', 16, .45, .08, 'outro']],
    ambient:   [['dawn', 16, .04, .2], ['open', 24, .2, .36], ['bloom', 24, .38, .55], ['hold', 16, .5, .42], ['fade', 16, .32, .03, 'outro']],
    emergence: [['chaos', 16, .08, .2], ['pull', 16, .24, .36], ['form', 16, .4, .55], ['grid', 32, .6, .74], ['break', 8, .34, .3, 'break'], ['build', 8, .5, .78, 'build'], ['peak', 32, .86, .96, 'peak'], ['dissolve', 16, .4, .04, 'outro']]};

  A.MACRO_KEYS = ['energy', 'mood', 'space', 'density', 'chaos', 'motion', 'x', 'y'];

  A.Composer = class {
    constructor(sr, genome, world){ this.sr = sr; this.g = genome; this.w = world; const seed = genome.seed;
      this.P = {seed, g: genome, w: world, rng: name => A.rng(A.hash(seed, name))};
      this.r = this.P.rng('composer'); this.hum = this.P.rng('humanise');
      this.key = new A.Key(genome.tonic, genome.mode); this.modeIdx = A.MODE_LADDER.indexOf(genome.mode);
      this.loop = A.buildLoop(this.key, genome.family, genome.colour, this.P.rng('loop'));
      this.bpm = genome.bpm; this.stepSec = 60 / this.bpm / 4; this.stepN = this.stepSec * sr; this.barN = this.stepN * 16;
      // sections (lengths varied per piece; multiples of 8 bars, min 8)
      const fr = this.P.rng('form'), F = A.FORMS[genome.form] || A.FORMS.swell;
      this.sections = F.map(s => ({name: s[0], bars: Math.max(8, Math.round(s[1] * fr.pick(genome.formScale || [.5, 1, 1, 1.5]) / 8) * 8), E0: s[2], E1: s[3], tag: s[4] || ''}));
      this.totalBars = this.sections.reduce((a, s) => a + s.bars, 0);
      this.parts = world.parts.map((spec, i) => ({spec, slot: spec.slot, obj: new A.PARTS[spec.part](this.P, Object.assign({slot: spec.slot}, spec.opts || {})), on: false, id: i, user: 0}));
      this.macro = Object.assign({energy: .5, mood: this.modeIdx / 5, space: .5, density: .5, chaos: .2, motion: .4, x: .5, y: .2}, genome.macros || {});
      this.v2 = genome.v2 !== false; this.moves = A.Moves ? new A.Moves(this, world) : null; this.halfTimeFrom = -1; this.halfTimeTo = -1; this.movesLog = []; this.prevE = 0;
      this.engineHas = name => !!(world.sends && world.sends[name]);
      this.k = 0; this.si = 0; this.bis = 0; this.ci = 0; this.bic = 0; this.cycle = 0; this.voicing = null; this.prevVoicing = null; this.subAt = -1; this.subChord = null;
      this.nudge = null; this.eOff = 0; this.hold = false; this.done = false; this.t = 0; this.lastInfo = null; this.changed = []; }
    rngFor(name){ return this.P.rng(name); }
    sec(){ return this.sections[Math.min(this.si, this.sections.length - 1)]; }
    setMacro(k, v){ this.macro[k] = clamp(v, 0, 1); }
    // nudges are applied at the next 4-bar boundary
    doNudge(kind){ this.nudge = kind; if (kind === 'hold') this.hold = !this.hold; }
    applyNudge(){ const n = this.nudge; if (!n || n === 'hold'){ this.nudge = null; return; } const S = this.sections, cur = this.si; if (cur >= S.length) return; this.nudge = null;
      const pk = S.find(s => s.tag === 'peak') || {name: 'peak', bars: 16, E0: .86, E1: .95, tag: 'peak'};
      const cut = () => { S[cur].bars = this.bis; };   // end the current section here
      if (n === 'build'){ cut(); S.splice(cur + 1, 0, {name: 'build', bars: 8, E0: Math.min(.6, this.lastE || .5), E1: .82, tag: 'build'}, Object.assign({}, pk, {bars: 16})); }
      else if (n === 'peak'){ cut(); S.splice(cur + 1, 0, Object.assign({}, pk, {bars: 16})); }
      else if (n === 'break'){ cut(); S.splice(cur + 1, 0, {name: 'break', bars: 8, E0: .3, E1: .26, tag: 'break'}, {name: 'return', bars: 16, E0: .62, E1: .7, tag: ''}); }
      else if (n === 'next'){ cut(); S.splice(cur + 1, S.length, {name: 'outro', bars: 8, E0: Math.min(.5, this.lastE || .4), E1: .03, tag: 'outro'}); }
      this.planRev = (this.planRev || 0) + 1; this.totalBars = S.reduce((a, s) => a + s.bars, 0); if (this.bis >= S[cur].bars){ this.si++; this.bis = 0; } }

    // jump to a bar of the plan (UI timeline scrub). Snaps to the phrase (4 bars); harmony lands on the matching chord of the loop.
    seek(bar){ const S = this.sections, total = S.reduce((a, s) => a + s.bars, 0); bar = Math.max(0, Math.min(total - 1, Math.round(bar / 4) * 4)); let acc = 0;
      for (let i = 0; i < S.length; i++){ if (bar < acc + S[i].bars){ this.si = i; this.bis = bar - acc; break; } acc += S[i].bars; }
      const L = this.loop.chords, lb = L.reduce((a, c) => a + c.bars, 0); let r = bar % lb, ci = 0; while (r >= L[ci].bars){ r -= L[ci].bars; ci++; }
      this.ci = ci; this.bic = r; this.voicing = null; this.done = false; this.forceArr = true; this.nudge = null;
      // a key lift belongs to the run that made it: seeking or repeating starts back in the home key
      if (this.lifted){ this.key.set(this.key.tonic - this.lifted, this.key.mode); this.rebuildLoopForMode(this.key.mode); this.lifted = 0; } if (this.moves){ this.moves.lifted = false; this.moves.hpPlan = null; this.moves.rolling = null; } this.halfTimeTo = -1; }
    pos(){ let acc = 0; for (let i = 0; i < Math.min(this.si, this.sections.length); i++) acc += this.sections[i].bars; return acc + this.bis; }
    chord(){ const ch = this.loop.chords[this.ci]; return this.subChord && this.subAt === this.cycle && this.ci === this.subIdx ? this.subChord : ch; }
    // v2: modulate the whole loop (same degrees, new tonic) — used by the key-lift move into the last peak
    keyLift(semi){ this.key.set(this.key.tonic + semi, this.key.mode); this.rebuildLoopForMode(this.key.mode); this.voicing = null; this.lifted = (this.lifted || 0) + semi; }
    rebuildLoopForMode(mode){ this.key.set(this.key.tonic, mode); this.loop.chords = this.loop.chords.map(c => { const n = A.makeChord(this.key, c.deg, c.type, {pedal: this.loop.pedal === null ? null : this.key.pc(this.loop.pedal)}); n.bars = c.bars; return n; }); this.subChord = null; }

    // build the next bar → {t0, events: [{t, slot, ev}], info}
    nextBar(){ const sr = this.sr, M = this.macro, out = [];
      // ---- section / form
      if (this.bis >= this.sec().bars && !(this.hold && this.si < this.sections.length)){ this.si++; this.bis = 0; }
      if (this.hold && this.bis >= this.sec().bars) this.bis = this.sec().bars - 8;   // HOLD: loop the last 8 bars of the section
      if (this.si >= this.sections.length){ this.done = true; const t0 = this.t; this.t += this.barN; this.k++; return {t0, events: [], info: Object.assign({}, this.lastInfo || {}, {bar: this.k - 1, t0, done: true, changed: [], chordStart: false, bis: -1})}; }   // past the end: silent bar, no nudges
      const S = this.sec(), seeked = !!this.forceArr, sectionStart = this.bis === 0 || seeked; this.forceArr = false;
      if (this.bis % 4 === 0) this.applyNudge();
      const S2 = this.sec(), newSec = this.bis === 0 && this.k > 0;   // recomputed after a nudge: a cut can start a new section here
      if (this.v2 && this.moves && newSec && !this.hold) this.moves.pre(S2);
      // ---- harmony
      let chordStart = false; const loopLen = this.loop.chords.length;
      if (!this.voicing){ chordStart = true; }
      else if (this.bic >= this.chord().bars){ this.bic = 0; this.ci++; chordStart = true;
        if (this.ci >= loopLen){ this.ci = 0; this.cycle++;
          const want = A.MODE_LADDER[clamp(Math.round(M.mood * 5), 0, 5)]; if (want !== this.key.mode) this.rebuildLoopForMode(want);
          // one substitution for a cycle after 2–4 cycles, more often with chaos
          if (this.cycle >= 2 && this.r() < .18 + M.chaos * .4 && S2.tag !== 'peak'){ this.subIdx = this.r.int(1, Math.max(1, loopLen - 1)) % loopLen; this.subAt = this.cycle; this.subChord = A.substitute(this.key, this.loop.chords[this.subIdx], this.r); } } }
      const ch = this.chord();
      if (chordStart){ this.prevVoicing = this.voicing; const open = this.lastE > .82; this.voicing = A.voice(ch, this.prevVoicing, {spread: clamp(this.g.spread + (open ? .25 : 0), 0, 1), rng: this.r}); }
      const v = this.voicing;
      // ---- energy
      const prog = this.bis / Math.max(1, S2.bars); let E = lerp(S2.E0, S2.E1, prog) + (M.energy - .5) * .7 + this.eOff; E = clamp(E, 0, 1); this.lastE = E;
      const nextS = this.sections[this.si + 1], barsLeft = S2.bars - this.bis, nextBigger = !!nextS && (nextS.E0 > E + .15 || nextS.tag === 'peak');
      this.dropZone = S2.tag === 'peak' || (!!nextS && nextS.tag === 'peak' && barsLeft <= 4);   // the CPU saver keeps full quality here
      const pieceProg = this.k / Math.max(1, this.totalBars);
      // ---- process α (rain → grid): world-defined curve, CHAOS pulls it back toward rain
      let alpha = this.w.alpha ? this.w.alpha(pieceProg, S2, prog) : 1; alpha = clamp(alpha * (1 - M.chaos * .7), 0, 1);
      // ---- arrangement
      const density = clamp(M.density * 1.15 + E * .25 - .2, 0, 1), shift = (M.density - .5) * .4;
      if (sectionStart || this.bis % 4 === 0){ let entries = 0; this.changed = [];
        const order = this.parts.slice().sort((a, b) => (a.spec.on || 0) - (b.spec.on || 0));
        for (const p of order){ const sp = p.spec; let want = E >= (sp.on || 0) - shift && E <= (sp.off === undefined ? 2 : sp.off);
          if (sp.drum && (S2.tag === 'break' || (S2.tag === 'build' && barsLeft <= (sp.preDrop || 4) && sp.dropBeforePeak !== false))) want = false;
          if (sp.only && sp.only.indexOf(S2.tag || S2.name) < 0) want = false;
          if (sp.not && sp.not.indexOf(S2.tag || S2.name) >= 0) want = false;
          if (S2.tag === 'outro' && sp.drum && E < (sp.on || 0) + .1) want = false;
          if (sp.core) want = true;   // the world's identity part never leaves
          if (p.user === 1) want = true; else if (p.user === -1) want = false;
          if (want && !p.on){ if (sectionStart || entries < 1 || sp.core){ p.on = true; entries++; this.changed.push('+' + p.slot); } }
          else if (!want && p.on){ p.on = false; this.changed.push('-' + p.slot); if (sp.part === 'texture') out.push({t: this.t, slot: p.slot, ev: {level: 0}}); } } }
      // ---- context
      const c = {emit: null, step: this.stepSec, stepsPerSec: 1 / this.stepSec, bar: this.stepSec * 16, beat: this.stepSec * 4,
        voicing: v, chord: ch, chordStart, chordBars: ch.bars, barInChord: this.bic, nextChordIn: ch.bars - this.bic, opening: E > .82 && S2.tag === 'peak',
        chordPcs: ch.pcs, chordRoot: ch.root, key: this.key, pent: new Set(this.key.pentatonic(60, 72).map(m => m % 12)), bassNote: v.bass, droneNote: v.sub + 12,
        barIndex: this.k, barInSection: this.bis, sectionIdx: this.si, section: S2, barsLeftInSection: barsLeft, nextBigger, layerIndex: clamp(pieceProg * 1.6, 0, 1),
        E, density, chaos: M.chaos, mutation: .02 + M.chaos * .35, motion: M.motion, space: M.space, brightness: M.mood * .5 + M.x * .5, calm: E < .3, alpha, forceAll: false, halfTime: this.v2 && this.k >= this.halfTimeFrom && this.k < this.halfTimeTo,
        v2: this.v2, nextChordPcs: this.loop.chords[(this.ci + 1) % loopLen].pcs};
      const t0 = this.t, stepN = this.stepN, swing = this.g.swing || 0, hum = this.hum, chaos = M.chaos;
      for (const p of this.parts){ if (!p.on) continue; const slot = p.slot, drum = !!p.spec.drum, tight = p.spec.tight;
        c.emit = (sl, step, ev, raw) => { let s = step; if (!raw && swing && Math.abs(s - Math.round(s)) < .01 && (Math.round(s) & 1)) s += swing;
          let t = t0 + s * stepN; if (!tight){ const h = (drum ? .0015 + chaos * .004 : .004 + chaos * .016) * sr; t += hum.gauss() * h * (raw ? .3 : 1); }
          out.push({t: Math.max(t0 - .01 * sr, t), slot: sl, ev}); };
        p.obj.bar(c); }
      out.sort((a, b) => a.t - b.t);
      // CHAOS glitch layer: beat-repeats (1/16 · 1/32 stutters), drop-outs and octave flips, never on the first beat of a phrase
      if (chaos > .3){ const beatN = stepN * 4, gr = this.P.rng('glitch' + this.k), add = [];
        for (let b = (this.bis % 8 === 0 ? 1 : 0); b < 4; b++){ if (gr() > (chaos - .3) * .7) continue; const b0 = t0 + b * beatN, b1 = b0 + beatN, kind = gr.weighted({stutter: 3, drop: 1, octave: 1.2, roll: chaos > .6 ? 1.5 : 0});
          const inBeat = out.filter(e => e.t >= b0 && e.t < b1 && e.ev.level === undefined && e.slot !== 'ghost');
          if (kind === 'drop'){ for (const e of inBeat) if (!e.ev.kick && gr() < .8) e.drop = true; }
          else if (kind === 'octave'){ for (const e of inBeat) if (e.ev.note !== undefined && e.ev.note < 84) e.ev = Object.assign({}, e.ev, {note: e.ev.note + 12}); }
          else { const div = kind === 'roll' ? 8 : gr() < .5 ? 4 : 8, seg = beatN / div, src = inBeat.filter(e => e.t < b0 + seg * 1.5); for (const e of inBeat) if (e.t >= b0 + seg * 1.5 && !e.ev.kick) e.drop = true;
            for (const e of src) for (let q = 1; q < div; q++) add.push({t: e.t + q * seg, slot: e.slot, ev: Object.assign({}, e.ev, {vel: (e.ev.vel || .7) * Math.pow(kind === 'roll' ? 1.04 : .86, q), dur: e.ev.dur ? Math.min(e.ev.dur, seg / sr * .9) : e.ev.dur, kick: false})}); } }
        if (add.length){ for (const a of add) out.push(a); } for (let i = out.length - 1; i >= 0; i--) if (out[i].drop) out.splice(i, 1); out.sort((a, b) => a.t - b.t); }
      // v2 transition moves (rotation + cooldowns live in 56-moves.js)
      this.movesLog = []; if (this.v2 && this.moves){ this.movesLog = this.moves.bar({out, t0, S: S2, next: nextS, barsLeft, E, sectionStart: newSec && !this.hold, hold: !!this.hold, arrivedUp: newSec && S2.E0 > this.prevE + .15}); out.sort((a, b) => a.t - b.t); }
      this.prevE = E;
      this.dbg = {E0: S2.E0, E1: S2.E1, prog, mE: M.energy, eOff: this.eOff, E, mDen: M.density, density, shift, alpha, chaos: M.chaos, mood: M.mood, pieceProg, barsLeft, si: this.si, bis: this.bis, sbars: S2.bars, section: S2.name, tag: S2.tag,
        ci: this.ci, bic: this.bic, cycle: this.cycle, loopLen, chord: ch.name, deg: ch.deg, type: ch.type, pcs: ch.pcs.slice(), sub: v.sub, bass: v.bass, notes: v.notes.slice(), swing, stepN, barN: this.barN, bpm: this.bpm, k: this.k, nEvents: out.length,
        tonic: this.key.tonic, mode: this.key.mode, sc: this.key.sc.slice(), family: this.loop.family, loop: this.loop.chords.map(c => c.name),
        parts: this.parts.map(p => ({slot: p.slot, part: p.spec.part, on: p.spec.on || 0, off: p.spec.off, eff: (p.spec.on || 0) - shift, active: p.on, core: !!p.spec.core, drum: !!p.spec.drum, user: p.user}))};
      const info = {bar: this.k, t0, pos: this.pos(), seeked, planRev: this.planRev || 0, total: this.totalBars, chordPcs: ch.pcs, scalePcs: this.key.sc.map(x => (x + this.key.tonic) % 12), barN: this.barN, section: S2.name, tag: S2.tag, si: this.si, nSections: this.sections.length, bis: this.bis, sbars: S2.bars, E, alpha, chord: ch.name, chordStart,
        nextChord: this.loop.chords[(this.ci + 1) % loopLen].name, active: this.parts.filter(p => p.on).map(p => p.slot), changed: this.changed, mode: this.key.mode, tonic: this.key.tonic,
        moves: this.movesLog, halfTime: c.halfTime, lifted: this.lifted || 0, progress: pieceProg, voicing: v.notes, bass: v.bass, cycle: this.cycle};
      this.lastInfo = info; this.changed = [];
      this.t += this.barN; this.k++; this.bis++; this.bic++;
      return {t0, events: out, info}; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_COMPOSER;
