/* ganYEET BARS — the song and the live engine. A song is a list of sections you can jump between at any bar line. Two scenes share key and
   tempo: A is the main beat, B is the beat switch (different drums, different sound). The composer writes one bar at a time, just before it
   starts, so a press on a section pad lands on the next bar; it listens to the mic level so the beat gets out of the way while you sing
   and answers back when you stop. Reuses the Maut ki Awaaz engine for mixing and output (see 80-engine.js). */
'use strict';
function AWZ_B_COMPOSER(A){
  const clamp = A.clamp, BLK = 128;
  A.SECTION_TYPES = ['intro', 'verse', 'hook', 'break', 'switch', 'outro'];
  const SEC = {
    intro:  {I: [.22, .3], on: {main: 1, dust: 1}, lp: 2400},
    verse:  {I: [.5, .72], on: {kick: 1, snare: 1, ghost: 1, hat: 1, bass: 1, main: 1, dust: 1}, lp: 20000},
    hook:   {I: [.92, 1], on: {kick: 1, snare: 1, ghost: 1, hat: 1, bass: 1, main: 1, hook: 1, spice: 1, dust: 1}, lp: 20000},
    break:  {I: [.2, .26], on: {main: 1, dust: 1}, lp: 3600},
    switch: {I: [.78, .9], on: {kick: 1, snare: 1, ghost: 1, hat: 1, bass: 1, main: 1, spice: 1, dust: 1}, lp: 20000, scene: 'B'},
    outro:  {I: [.3, .16], on: {main: 1, hat: 1, dust: 1}, lp: 2200}};
  const PLAN = [['intro', 4], ['verse', 16], ['hook', 8], ['verse', 16], ['hook', 8], ['switch', 8], ['break', 4], ['hook', 8], ['outro', 4]];

  A.BeatComposer = class {
    constructor(sr, g, w, records){ this.sr = sr; this.g = g; this.w = w; const seed = g.seed; this.records = records || {};
      this.bpm = g.bpm; this.stepSec = 60 / this.bpm / 4; this.stepN = this.stepSec * sr; this.barN = this.stepN * 16; this.macro = {energy: .5, space: .5, density: .5, chaos: 0, motion: .2, x: .5, y: .2, mood: .5};
      this.scene = {}; this.parts = [];
      for (const key of ['A', 'B']){ const G = g.genes[key], S = w.scenes[key], Pc = {seed, g, w, rng: name => A.rng(A.hash(seed, key, name))}, prog = A.PROGS[G.harmony.a][key === 'A' ? g.progA : g.progB], loop = A.makeLoop(g.tonic, prog), kk = new A.Key(g.tonic, prog.s); const voicing = (w.tracks[S.main] && w.tracks[S.main].voicing) || 'rootless'; let prev = null; const voiced = loop.map(ch => { const v = A.voiceChord(ch, voicing, prev); prev = v.notes; return v.notes; }); const rec = this.records[key] || null;
        this.scene[key] = {key: kk, loop, voiced, S, G, pocket: A.POCKETS[G.pocket.v], rec, loopBars: loop.reduce((a, c) => a + c.bars, 0),
          drums: new A.BPARTS.drums(Pc, {S, groove: G.groove.v, kit: G.kit.v}), bass: new A.BPARTS.bass(Pc, {S, mode: G.bass.v}), main: new A.BPARTS.main(Pc, {S, mode: G.main.v, rec}), hook: new A.BPARTS.hook(Pc, {S, mode: G.hook.v}), spice: new A.BPARTS.spice(Pc, {S, mode: G.spice.v, rec}), dust: S.dust ? new A.PARTS.texture(Pc, {slot: S.dust, kind: G.dust.v === 'rain' ? 'rain' : G.dust.v === 'hiss' ? 'hiss' : 'crackle', level: .55, follow: 'constant'}) : null}; }
      this.hum = A.rng(A.hash(seed, 'humanise')); this.r = A.rng(A.hash(seed, 'composer')); this.sections = PLAN.map(([type, bars], i) => ({name: type, type, bars, i})); this.pi = 0; this.autoForm = true; this.endAtForm = false; this.want = null; this.loopSection = false; this.bis = 0; this.k = 0; this.ci = 0; this.bic = 0; this.t = 0; this.done = false; this.endSent = false; this.modeIdx = 2; this.totalBars = this.sections.reduce((a, s) => a + s.bars, 0); this.vox = {sing: false, quiet: 99, on: false}; this.prevLP = -1; this.cur = this.sections[0]; this.prevScene = null; this.prevType = null; this.first = true; this.moveR = A.rng(A.hash(seed, 'moves')); }
    setMacro(k, v){ this.macro[k] = clamp(v, 0, 1); }
    doNudge(){}
    // a press on a section pad: lands on the next bar line
    jump(type){ if (!SEC[type]) return; this.want = type; }
    nextType(){ if (this.want) return this.want; if (this.bis + 1 < this.cur.bars) return this.cur.type; if (!this.autoForm) return this.cur.type; const n = this.sections[this.pi + 1]; return n ? n.type : 'verse'; }
    advance(){ if (this.want){ const type = this.want; this.want = null; this.first = false; let idx = -1; for (let i = this.pi + 1; i < this.sections.length; i++) if (this.sections[i].type === type){ idx = i; break; } if (idx < 0) idx = this.sections.findIndex(s => s.type === type); if (idx < 0) idx = this.pi; this.pi = idx; const s = this.sections[idx]; this.cur = {name: type, type, bars: s ? s.bars : 8, i: idx}; this.bis = 0; this.ci = 0; this.bic = 0; return true; }
      if (this.first){ this.first = false; return true; }
      if (this.bis >= this.cur.bars){ if (this.autoForm){ this.pi++; if (this.pi >= this.sections.length){ if (this.endAtForm){ this.done = true; return false; } this.pi = 1; } this.cur = this.sections[this.pi]; } this.bis = 0; this.ci = 0; this.bic = 0; return true; } return false; }
    nextBar(){ const sr = this.sr, out = [], startedSec = this.advance(); if (this.done){ const t0 = this.t; this.t += this.barN; this.k++; return {t0, events: [], info: {bar: this.k - 1, t0, done: true, E: 0, chordStart: false, voicing: [], changed: []}}; }
      const type = this.cur.type, D = SEC[type], key = D.scene || (type === 'switch' ? 'B' : 'A'), Sc = this.scene[key], loop = Sc.loop; let chordStart = false; if (this.ci >= loop.length) this.ci = 0;
      if (this.bic >= loop[this.ci].bars){ this.ci = (this.ci + 1) % loop.length; this.bic = 0; } if (this.bic === 0) chordStart = true; const ch = loop[this.ci], next = loop[(this.ci + 1) % loop.length], notes = Sc.voiced[this.ci];
      const prog = this.cur.bars > 1 ? this.bis / (this.cur.bars - 1) : 0, I = D.I[0] + (D.I[1] - D.I[0]) * prog, left = this.cur.bars - this.bis, sing = this.vox.on && this.vox.sing, quiet = this.vox.on ? this.vox.quiet : 0;
      const on = Object.assign({}, D.on); if (type === 'intro' && this.bis >= this.cur.bars - 2) on.hat = 1; if (type === 'verse' && this.bis >= 8) on.spice = 1; if (type === 'outro' && this.bis >= this.cur.bars - 1) on.hat = 0; if (type === 'break' && chordStart && this.bis === 0) on.bass = 1;
      const mute = this.mute || {}; if (mute.drums){ on.kick = on.snare = on.hat = on.ghost = on.spice = 0; } if (mute.bass) on.bass = 0; if (mute.keys){ on.main = on.hook = 0; }
      const t0 = this.t, stepN = this.stepN, PK = Sc.pocket, sw = PK.sw * (this.g.swingMul === undefined ? 1 : this.g.swingMul), hum = this.hum, loose = PK.loose * .001 * sr;
      const cat = {}; for (const c2 of ['kick', 'snare', 'clap', 'hat', 'bass', 'main', 'hook', 'sp1', 'sp2', 'sp3']) if (Sc.S[c2]) cat[Sc.S[c2]] = c2 === 'clap' ? 'snare' : c2 === 'main' || c2 === 'hook' ? 'keys' : c2.startsWith('sp') ? 'hat' : c2;
      const emit = (slot, step, ev, raw) => { let s = step; if (!raw && sw && Math.abs(s - Math.round(s)) < .01 && (Math.round(s) & 1)) s += sw; const cc = cat[slot] || 'keys', ms = PK[cc] === undefined ? 0 : PK[cc]; let t = t0 + s * stepN + ms * .001 * sr; if (cc !== 'kick' && cc !== 'bass') t += hum.gauss() * loose * (raw ? .3 : 1); out.push({t: Math.max(t0 - .01 * sr, t), slot, ev}); };
      const c = {emit, step: this.stepSec, stepsPerSec: 1 / this.stepSec, bar: this.stepSec * 16, beat: this.stepSec * 4, barIndex: this.k, barInSection: this.bis, left, type, I, E: I, on, chord: ch, nextChord: next, chordStart, chordBars: ch.bars, barInChord: this.bic, ci: this.ci, notes, rootPc: ch.root, key: Sc.key, sing, quiet, density: .5, space: .5, droneNote: 36, voicing: {notes}, dropIn: type === 'verse' && this.bis === 0 && this.prevType === 'intro' && false, bassOnly1: type === 'break', kickSteps: null};
      Sc.drums.bar(c); Sc.bass.bar(c); Sc.main.bar(c); if (on.hook) Sc.hook.bar(c); else if ((type === 'verse' || type === 'switch') && this.vox.on && quiet >= 1 && this.bis % 2 === 1 && !mute.keys) Sc.hook.bar(c, true); Sc.spice.bar(c); if (Sc.dust) Sc.dust.bar(c);
      // moves between sections
      const m = this.moveR, nt = this.nextType(), S0 = Sc.S; if (startedSec && !this.isSilent){ if (D.lp !== this.prevLP){ this.prevLP = D.lp; out.push({t: t0, slot: '@', ev: {cmd: 'musicLP', hz: D.lp}}); } if (this.releaseAt){ this.releaseAt = false; out.push({t: t0, slot: '@', ev: {cmd: 'release'}}); } if ((type === 'hook' || type === 'switch') && this.prevType !== type && this.k > 0) out.push({t: t0, slot: 'fx', ev: {fx: 'impact', vel: .42, dur: 2.2, freq: A.mtof(((ch.root % 12) + 24))}}); }
      if (left === 1 && nt !== type && this.autoForm){ const up = nt === 'hook' || nt === 'switch'; if (up){ const kind = m.weighted({gap: 2, swell: 2, riser: 1.5}); if (kind === 'gap') out.push({t: t0 + 12 * stepN, slot: '@', ev: {cmd: 'gap', dur: this.stepSec * 4}}); else if (kind === 'swell') out.push({t: t0 + 8 * stepN, slot: 'fx', ev: {fx: 'swell', vel: .8, dur: this.stepSec * 8}}); else out.push({t: t0, slot: 'fx', ev: {fx: 'riser', vel: .6, dur: this.stepSec * 16}}); }
        else if (nt === 'break' || nt === 'outro'){ out.push({t: t0 + 12 * stepN, slot: '@', ev: {cmd: 'tapestop', dur: this.stepSec * 4}}); this.releaseAt = true; } }
      void S0; out.sort((a, b) => a.t - b.t); this.prevType = type;
      const chordPcs = ch.pcs, scalePcs = Sc.key.sc.map(x => (x + Sc.key.tonic) % 12), info = {bar: this.k, t0, barN: this.barN, stepN, section: type, bis: this.bis, sbars: this.cur.bars, scene: key, chord: ch.name, nextChord: next.name, chordPcs, scalePcs, rootPc: ch.root, tonic: Sc.key.tonic, mode: Sc.key.mode, E: I, chordStart, voicing: notes, pending: this.want, sing, quiet};
      this.t += this.barN; this.k++; this.bis++; this.bic++; return {t0, events: out, info}; } };

  A.BeatEngine = class extends A.Engine {
    constructor(sr){ super(sr); this.macro = {energy: .55, mood: .5, space: .5, density: .5, chaos: 0, motion: .2, x: .5, y: .25}; const M = this.mixer; M.aeq.on = false; M.target = -10; M.setMusicEQ([[320, -2.5, .8], [2600, 0, .9]]); this.listens = true; this.voxOn = false; this.voxLevel = 0; this.voxAcc = 0; this.voxN = 0; this.voxQuiet = 99; this.carve = 0; this.records = {}; this.mutes = {}; this.autoForm = true; this.look = .12; this.haveVox = false; this.liveLevel = 0; }
    makeInst(slot, gp, spec){ const seed = A.hash(this.g.seed, slot) & 0xffff; if (gp.inst === 'found') return new A.FoundInst(this.sr, seed); if (gp.inst === 'chop') return new A.ChopInst(this.sr, this.records[spec.record]); return super.makeInst(slot, gp, spec); }
    makeTrack(slot, spec, id){ const s2 = Object.assign({}, spec); delete s2.ins; const tr = super.makeTrack(slot, s2, id); tr.spec = spec; if (spec.ins === 'trem'){ const t = new A.Tremolo(this.sr); t.set({rate: 4.2, depth: .3}); tr.ins = [t]; } else if (Array.isArray(spec.ins)){ tr.ins = spec.ins.map(o => { const x = new A.SPCrush(this.sr); x.set(o.o); return x; }); } return tr; }
    load(genome, records){ const first = !this.g; this.g = genome; this.records = records || {}; A.WORLDS.BEAT = A.beatWorld(genome); const w = this.w = A.WORLDS.BEAT;
      for (const tr of this.mixer.tracks) tr.dying = true; this.q.clear(); this.reroll = {}; this.slots = Object.keys(w.tracks); this.tracks = {};
      this.slots.forEach((slot, i) => { const tr = this.makeTrack(slot, w.tracks[slot], i); this.tracks[slot] = tr; this.mixer.add(tr); });
      const prevForm = this.comp ? this.comp.autoForm : true; this.comp = new A.BeatComposer(this.sr, genome, w, this.records); this.comp.autoForm = prevForm; this.comp.endAtForm = !!this.endAtForm; this.comp.mute = this.mutes; if (this.startAt) this.comp.want = this.startAt; this.comp.t = this.t + Math.round((first ? .15 : .35) * this.sr); this.fx(); this.resetFx(); this.mapMacros(true); this.applyGov(); this.pieceStart = this.comp.t;
      this.out.msg({type: 'piece', genome, slots: this.slots.map(s => ({slot: s, patch: this.tracks[s].patchName, kind: this.tracks[s].instKind, bus: this.tracks[s].bus})), scenes: w.scenes, sections: this.comp.sections, bpm: genome.bpm, tonic: genome.tonic, key: A.NOTE[genome.tonic], mode: genome.mode, t0: this.comp.t, barN: this.comp.barN}); }
    section(type){ if (this.comp) this.comp.jump(type); this.out.msg({type: 'pending', section: type}); }
    setAuto(on){ this.autoForm = !!on; if (this.comp) this.comp.autoForm = !!on; }
    setMute(cat, on){ this.mutes[cat] = !!on; const w = this.w; if (!w) return; const groups = {drums: ['kick', 'snare', 'clap', 'hat', 'sp1', 'sp2', 'sp3'], bass: ['bass'], keys: ['main', 'hook']}[cat] || []; for (const key of ['A', 'B']) for (const c of groups){ const slot = w.scenes[key][c], tr = slot && this.tracks[slot]; if (tr) tr.mute = !!on; } }
    fxCmd(ev){ if (ev.cmd === 'musicLP'){ this.mixer.musicLP.set(ev.hz); return; } super.fxCmd(ev); }
    // only what this screen controls: HIT, SPACE, DUST; BOUNCE goes straight into the composer
    mapMacros(force){ const m = this.macro, M = this.mixer, f = this.w && this.w.fx; if (!f) return; const s = m.space, y = m.y, ks = {plate: .25 + 1.5 * s, hall: .1 + 1.8 * s * s + .2 * s, delay: .25 + 1.5 * s};
      for (const tr of M.tracks){ if (tr.dying || !tr.baseSend) continue; for (const k in ks) tr.send[k] = tr.baseSend[k] * ks[k]; if (tr.bus === 'drums') tr.gain.set(A.dbToGain((tr.spec.db || 0) + (A.PATCH_NORM[tr.patchName] || 0) + (tr.instKind === 'kick' ? 2 : 0) + (m.energy - .5) * 5)); if (tr.bus === 'music') tr.drive = (tr.baseDrive || 0) + y * .35; if (tr.inst) tr.inst.var = .7; }
      const rt = (f.hall.rt60 || 3) * (.5 + s); if (force || Math.abs(rt - (this._rt || 0)) > .25){ M.hall.set(Object.assign({}, f.hall, {rt60: rt})); this._rt = rt; }
      M.tape.set({drive: 1.08 + y * 1.5 + Math.max(0, m.energy - .5) * .6, bias: .04 + y * .07, lp: 18000 - y * 8000, mix: .55 + .45 * y}); M.crush = Math.max(0, y - .7) / .3 * .6; M.tiltHigh = 1.6 - y * 2.2; M.tiltLow = 1.06; }
    setMacro(k, v){ if (k === 'bounce'){ if (this.g) this.g.swingMul = clamp(v, 0, 2); return; } super.setMacro(k, v); }
    voice(){}
    // voice level from the worklet: carve a little room in the keys around 2.6 kHz while singing, and tell the composer at each bar line
    voxTick(level, n){ if (!this.voxOn) return; const dt = n / this.sr; this.voxFloor = this.voxFloor === undefined ? .003 : level < this.voxFloor ? this.voxFloor + (level - this.voxFloor) * Math.min(1, dt / .2) : this.voxFloor + (level - this.voxFloor) * Math.min(1, dt / 6); const singing = level > Math.max(.012, this.voxFloor * 3); this.voxSinging = singing; this.voxAcc += singing ? n : 0; this.voxN += n; this.carve += ((this.listens && singing ? 1 : 0) - this.carve) * (singing ? .1 : .012); const b = this.mixer.mBells[1]; if (b) b.g = A.dbToGain(-4.5 * this.carve) - 1; }
    schedule(){ const c = this.comp, ahead = Math.round(this.look * this.sr); while (c.t < this.t + BLK + ahead){ if (c.done){ if (!c.endSent){ c.endSent = true; this.out.msg({type: 'end'}); } c.t += c.barN; continue; }
        if (this.voxOn){ const frac = this.voxN ? this.voxAcc / this.voxN : 0, sing = frac > .22; c.vox = {on: this.listens, sing, quiet: sing ? 0 : (c.vox.quiet || 0) + 1}; if (sing) c.vox.quiet = 0; this.voxAcc = 0; this.voxN = 0; } else c.vox = {on: false, sing: false, quiet: 0};
        const bar = c.nextBar(); if (bar.info.done) continue; this.lastE = bar.info.E; for (const e of bar.events){ if (e.slot === '@'){ this.q.push({t: Math.round(e.t), slot: '@', ev: e.ev}); continue; } const tr = this.tracks[e.slot]; if (!tr) continue; this.q.push({t: Math.round(e.t), slot: e.slot, ev: e.ev}); const ev = e.ev; if (ev.note !== undefined) this.out.note(e.t, tr.id, ev.note, ev.vel || .7, (ev.dur || .2) * this.sr); else if (ev.level === undefined) this.out.note(e.t, tr.id, ev.kick ? -1 : ev.open ? -3 : -2, ev.vel || .7, 0); }
        this.out.msg(Object.assign({type: 'bar'}, bar.info)); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_B_COMPOSER;
