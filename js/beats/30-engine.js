/* ganYEET BARS — live engine: the Maut ki Awaaz engine and composer, with scenes loaded as worlds, section jumps that land on the next bar instead of
   the next four, the five dials (Scene, Hard to open, Bounce, Dirt, Drop), and a beat that hears the mic. Existing engine files are not edited. */
'use strict';
function AWZ_B_ENGINE(A){
  const clamp = A.clamp, BLK = 128, Base = A.Composer;
  A.Composer = class extends Base {
    constructor(sr, g, w){ super(sr, g, w); }
    // a pad press lands on the next bar line
    applyNudge(){ const n = this.nudge, S = this.sections, cur = this.si; if (n === 'verse' || n === 'hook' || n === 'break2' || n === 'outro2'){ if (cur >= S.length) return; this.nudge = null; S[cur].bars = Math.max(1, this.bis); const mk = n === 'verse' ? {name: 'verse', bars: 16, E0: .46, E1: .58, tag: ''} : n === 'hook' ? {name: 'hook', bars: 8, E0: .84, E1: .92, tag: 'peak'} : n === 'break2' ? {name: 'break', bars: 4, E0: .26, E1: .26, tag: 'break'} : {name: 'outro', bars: 8, E0: .34, E1: .06, tag: 'outro'}; S.splice(cur + 1, 0, mk); this.planRev = (this.planRev || 0) + 1; this.totalBars = S.reduce((a, s) => a + s.bars, 0); if (this.bis >= S[cur].bars){ this.si++; this.bis = 0; } return; } super.applyNudge(); }
    nextBar(){ if (this.nudge && this.nudge !== 'hold' && this.bis % 4 !== 0 && this.bis > 0) this.applyNudge(); return super.nextBar(); } };
  A.BeatEngine = class extends A.Engine {
    constructor(sr){ super(sr); const M = this.mixer; M.aeq.on = false; M.target = -10.5; M.setMusicEQ([[320, -2.5, .8], [2600, 0, .9]]); this.macro = Object.assign(this.macro, {energy: .5, y: .15}); this.look = .15; this.listens = true; this.voxOn = false; this.voxAcc = 0; this.voxN = 0; this.voxQuiet = 99; this.carve = 0; this.hard = .5; this.dirt = .3; A.DIRT = 1; this.endMode = 'repeat'; this.singing = false; }
    makeInst(slot, gp, spec){ const sr = this.sr, seed = A.hash(this.g.seed, slot) & 0xffff; switch (gp.inst){ case 'struck': return new A.MonoInst(sr, A.StruckVoice, gp.p, seed); case 'pluck': return new A.PolyInst(sr, A.PluckVoice, spec.voices || 10, gp.p, seed); case 'scare': return new A.PolyInst(sr, A.ScareVoice, spec.voices || 2, gp.p, seed); case 'found': return new A.FoundInst(sr, seed); default: return super.makeInst(slot, gp, spec); } }
    makeTrack(slot, spec, id){ const s2 = Object.assign({}, spec); let special = null; if (typeof spec.ins === 'string'){ special = spec.ins; delete s2.ins; } const tr = super.makeTrack(slot, s2, id); tr.spec = spec; if (special === 'trem'){ const t = new A.Tremolo(this.sr); t.set({rate: 4.2, depth: .26}); tr.ins = [t]; } else if (special === 'crush' || special === 'crushkeys'){ const x = new A.SPCrush(this.sr); x.set(special === 'crush' ? {bits: 12, rate: 26040, lp: 11000, mix: .7} : {bits: 12, rate: 26040, lp: 8000, mix: .65}); tr.ins = [x]; } return tr; }
    loadScene(worldKey, seed, over){ const g = A.makeGenome(worldKey, seed); g.formScale = [1]; g.bounce = over && over.bounce !== undefined ? over.bounce : .5; if (over && over.bpm) g.bpm = over.bpm; if (over && over.tonic !== undefined) g.tonic = over.tonic; this.load(g); return g; }
    load(genome){ if (genome.bounce === undefined) genome.bounce = .5; if (!genome.formScale) genome.formScale = [1]; super.load(genome); this.comp.look = this.look; const M = this.mixer; M.aeq.on = false; M.target = -10.5; this.applyHard(this.hard); this.applyDirt(this.dirt); if (this.mutes) for (const k in this.mutes) this.setMute(k, this.mutes[k]); }
    // Hard to open: dense and aggressive ↔ sparse and tender. Moves the energy the arrangement sees, and how much plays
    applyHard(v){ this.hard = clamp(v, 0, 1); if (this.comp){ this.setMacro('energy', .28 + this.hard * .44); this.setMacro('density', .3 + this.hard * .5); } }
    // Dirt: drive on everything but the sub, tape, and the 808's harmonic copy
    applyDirt(v){ this.dirt = clamp(v, 0, 1); A.DIRT = .35 + this.dirt * 1.3; if (this.comp) this.setMacro('y', .05 + this.dirt * .5); }
    setBounce(v){ if (this.g) this.g.bounce = clamp(v, 0, 1); }
    drop(){ this.nudge('build'); }
    section(kind){ if (this.comp) this.comp.doNudge(kind); this.out.msg({type: 'pending', section: kind}); }
    voice(){}
    setMute(cat, on){ this.mutes = this.mutes || {}; this.mutes[cat] = !!on; for (const slot in (this.tracks || {})){ const tr = this.tracks[slot]; if (/^(fx|ghost|scare|tex|pad)$/.test(slot)) continue; const c = tr.bus === 'drums' ? 'drums' : tr.bus === 'bass' ? 'bass' : 'keys'; tr.mute = !!this.mutes[c]; } }
    voxTick(level, n){ if (!this.voxOn) return; const dt = n / this.sr; this.voxFloor = this.voxFloor === undefined ? .003 : level < this.voxFloor ? this.voxFloor + (level - this.voxFloor) * Math.min(1, dt / .2) : this.voxFloor + (level - this.voxFloor) * Math.min(1, dt / 6); const singing = level > Math.max(.012, this.voxFloor * 3); this.voxSinging = singing; this.voxAcc += singing ? n : 0; this.voxN += n; this.carve += ((this.listens && singing ? 1 : 0) - this.carve) * (singing ? .1 : .012); const b = this.mixer.mBells[1]; if (b) b.g = A.dbToGain(-4.5 * this.carve) - 1; }
    // while you sing, the melody parts wait; when you stop for a bar they come back
    voxBar(){ const c = this.comp; if (!this.voxOn || !this.listens){ if (this.voxHeld){ c.parts.forEach(p => { if (p.voxHold){ p.user = 0; p.voxHold = false; } }); this.voxHeld = false; } return; } const frac = this.voxN ? this.voxAcc / this.voxN : 0, sing = frac > .22; this.voxAcc = 0; this.voxN = 0; this.singing = sing; const peak = c.sec && c.sec().tag === 'peak'; c.parts.forEach(p => { if (p.spec.part !== 'motif' && p.spec.part !== 'chops') return; if (sing && !peak){ if (!p.user){ p.user = -1; p.voxHold = true; } } else if (p.voxHold){ p.user = 0; p.voxHold = false; } }); this.voxHeld = sing; }
    // written one bar at a time, just before it starts, so a press lands on the next bar line
    schedule(){ const c = this.comp, ahead = Math.round(this.look * this.sr); while (c.t < this.t + BLK + ahead){
        if (c.done && this.endMode === 'stop'){ if (!c.endSent){ c.endSent = true; this.out.msg({type: 'end', stopped: true}); } c.t += c.barN; continue; }
        if (c.done){ c.seek(8); c.done = false; this.out.msg({type: 'repeat'}); }
        this.voxBar(); c.v2 = true; const bar = c.nextBar(); this.lastE = bar.info.E; this.mixer.aeq.gate = 0;
        for (const e of bar.events){ if (e.slot === '@'){ this.q.push({t: Math.round(e.t), slot: '@', ev: e.ev}); continue; } const tr = this.tracks[e.slot]; if (!tr) continue; this.q.push({t: Math.round(e.t), slot: e.slot, ev: e.ev}); const ev = e.ev; if (ev.note !== undefined) this.out.note(e.t, tr.id, ev.note, ev.vel || .7, (ev.dur || .2) * this.sr); else if (ev.level === undefined) this.out.note(e.t, tr.id, ev.kick ? -1 : ev.open ? -3 : -2, ev.vel || .7, 0); }
        if (!bar.info.done) this.out.msg(Object.assign({type: 'bar'}, bar.info)); this.mapMacros(); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_B_ENGINE;
