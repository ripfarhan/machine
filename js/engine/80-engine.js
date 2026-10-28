/* Maut ki Awaaz — engine module: the engine.
   Builds tracks for a genome's world, runs the composer one bar ahead, dispatches events sample-accurately, maps the
   macros onto sound continuously (held notes follow via shared `live` objects), crossfades between pieces, and posts
   what is about to happen (future notes, bar/section info, meters) to the UI. One engine per audio context. */
'use strict';
function AWZ_ENGINE(A){
  const clamp = A.clamp, BLK = 128;
  const DRUM = {kick: 1, snare: 1, hat: 1, shaker: 1, tom: 1, perc: 1};
  A.Engine = class {
    constructor(sr){ this.sr = sr; this.mixer = new A.Mixer(sr); this.q = new A.EventQueue(); this.t = 0; this.tracks = {}; this.slots = []; this.out = new A.Outbox(8192); this.comp = null; this.g = null; this.w = null;
      this.macro = {energy: .5, mood: .5, space: .5, density: .5, chaos: .2, motion: .4, x: .5, y: .2}; this.auto = true; this.endMode = 'repeat'; this.queued = null; this.history = []; this.blocks = 0; this.playing = true; this.lastE = .3;
      this.lfoT = 0; this.reroll = {}; this.pieceStart = 0; this.onEnd = null; }
    // ---------------------------------------------------------------- build
    makeInst(slot, gp, spec){ const sr = this.sr, seed = A.hash(this.g.seed, slot) & 0xffff, p = gp.p;
      if (gp.inst === 'va' || gp.inst === 'mono' || gp.inst === 'bass') p.live = A.live();
      switch (gp.inst){
        case 'va': return new A.PolyInst(sr, A.VAVoice, Math.max(16, (spec.voices || 10) + 6), p, seed);
        case 'mono': return new A.MonoInst(sr, A.VAVoice, p, seed);
        case 'bass': return new A.MonoInst(sr, A.BassVoice, p, seed);
        case 'modal': return new A.PolyInst(sr, A.ModalVoice, Math.max(14, (spec.voices || 10) + 4), p, seed);
        case 'tex': return new A.TextureInst(sr, p, seed);
        case 'fm': return new A.PolyInst(sr, A.FMVoice, spec.voices || 8, p, seed);
        case 'fmmono': return new A.MonoInst(sr, A.FMVoice, p, seed);
        case 'organ': return new A.PolyInst(sr, A.OrganVoice, spec.voices || 10, p, seed);
        case 'choir': return new A.PolyInst(sr, A.ChoirVoice, spec.voices || 10, p, seed);
        case 'boom': return new A.MonoInst(sr, A.BoomVoice, p, seed);
        case 'acid': return new A.AcidInst(sr, p, seed);
        case 'fx': return new A.FxInst(sr);
        default: return new A.DrumInst(sr, gp.inst, p, seed); } }
    makeTrack(slot, spec, id){ const gp = A.genomePatch(this.g, slot, this.reroll[slot] || 0), inst = this.makeInst(slot, gp, spec), norm = A.PATCH_NORM[gp.name] || 0;
      const bus = spec.bus || (DRUM[gp.inst] ? 'drums' : 'music');
      // mix hygiene (research/03 §7; measured: renders were +6…+11 dB in 200–500 Hz vs the Cooper reference) — chords and keys leave the low-mids to the bass
      const pad = /^pad/.test(gp.name), stab = /^(stab|arp|pluck)/.test(gp.name), keys = gp.inst === 'modal';
      const hp = Math.max(spec.hp || 0, pad ? 180 : stab ? 200 : keys ? 160 : 0), eq = (spec.eq || []).concat(pad || stab ? [[340, -3.5, .9]] : keys ? [[300, -3, .9]] : []);
      const tr = new A.Track(this.sr, slot, bus, inst, {db: (spec.db || 0) + norm + (bus === 'bass' ? 3 : gp.inst === 'kick' ? 2 : 0), pan: spec.pan || 0, width: spec.width, hp: hp || undefined, eq, lp: spec.lp, drive: spec.drive, chorus: spec.chorus, haas: spec.haas, plate: spec.plate, hall: spec.hall, delay: spec.delay, id});
      for (const k of ['gran', 'shim', 'rev', 'reso']) if (spec[k]) tr.send[k] = spec[k];
      if (spec.ins){ const MK = {rotary: A.Rotary, folder: A.Folder, formant: A.Formant, ring: A.RingMod, phaser: A.Phaser}; tr.ins = spec.ins.map(o => { const fx = new MK[o.type](this.sr); fx.set(o); return fx; }); } tr.spec = spec; tr.patchName = gp.name; tr.instKind = gp.inst; tr.basePatch = Object.assign({}, gp.p); tr.baseSend = Object.assign({}, tr.send); tr.baseDrive = spec.drive || 0; tr.basePan = spec.pan || 0; tr.baseChorus = spec.chorus ? spec.chorus.mix : 0;
      tr.liveT = {cut: 0, lfo: 0, res: 0, rate: 0}; tr.panPh = (id * .618) % 1; tr.panRate = .013 + (id % 5) * .007; tr.dying = false; return tr; }
    load(genome){ const first = !this.g; this.g = genome; const w = this.w = A.WORLDS[genome.world];
      // fade out whatever is playing; it is removed once silent
      for (const tr of this.mixer.tracks) tr.dying = true; this.q.clear(); this.reroll = {};
      this.slots = Object.keys(w.tracks); this.tracks = {};
      this.slots.forEach((slot, i) => { const tr = this.makeTrack(slot, w.tracks[slot], i); this.tracks[slot] = tr; this.mixer.add(tr); });
      this.comp = new A.Composer(this.sr, genome, w); this.comp.t = this.t + Math.round((first ? .15 : 1.2) * this.sr);
      // macros: world defaults on top of neutral, the mood knob shows the genome's mode
      this.macro = Object.assign({energy: .5, space: .5, density: .5, chaos: .2, motion: .4, x: .5, y: .2}, genome.macros || {}, {mood: this.comp.modeIdx / 5}); Object.assign(this.comp.macro, this.macro);
      this.fx(); this.resetFx(); this.mapMacros(true); this.applyGov(); this.pieceStart = this.comp.t;
      this.out.msg({type: 'piece', genome, world: w.name, desc: w.desc, ref: w.ref, slots: this.slots.map(s => ({slot: s, patch: this.tracks[s].patchName, kind: this.tracks[s].instKind, bus: this.tracks[s].bus})),
        sections: this.comp.sections, bpm: genome.bpm, key: A.NOTE[genome.tonic], mode: genome.mode, family: genome.family, loop: this.comp.loop.chords.map(c => ({name: c.name, bars: c.bars, deg: c.deg})), t0: this.comp.t, macros: this.macro}); }
    fx(){ const f = this.w.fx, M = this.mixer, bpm = this.g.bpm; M.plate.set(f.plate || {}); M.hall.set(f.hall || {});
      this.baseDelay = Object.assign({time: (f.delay.beats || .75) * 60 / bpm, feedback: .4, wow: .0009, flutter: .00006}, f.delay); M.delay.set(this.baseDelay);
      // v2 send effects this world uses (created once, reused across pieces); unused ones stop processing
      const SND = {gran: () => new A.Granular(this.sr, 91), shim: () => new A.Shimmer(this.sr), rev: () => new A.ReverseDelay(this.sr), reso: () => new A.Resonator(this.sr)}, ws = this.w.sends || {};
      this.fxp = this.fxp || {}; for (const k in SND){ if (ws[k]){ const pr = this.fxp[k] || (this.fxp[k] = SND[k]()); const o = Object.assign({}, ws[k]); if (k === 'rev' && o.beats) o.time = o.beats * 60 / bpm; pr.set(o); M.addSend(k, pr, ws[k].ret === undefined ? 1 : ws[k].ret); if (this.retire) delete this.retire[k]; }
        // not used by the new world: let its tail ring out under the fading piece, then drop it (a later world gets a fresh one, no stale audio)
        else if (M.x2.sends[k]){ this.retire = this.retire || {}; if (!this.retire[k]) this.retire[k] = this.t + 14 * this.sr; } }
      M.gate.stepN = 60 / bpm / 4 * this.sr; M.gate.on = false; M.fshiftOn = 0; this.ramps = []; this.throwMul = {plate: 1, hall: 1, delay: 1}; this.fbMul = 1;
      M.duckDepth.bass = f.duck.bass; M.duckDepth.ret = f.duck.ret; M.duckRel = Math.min(.22, 60 / bpm * .42); this.baseTilt = (f.master && f.master.tiltHigh) || 0; }
    // ---------------------------------------------------------------- macros → sound
    setMacro(k, v){ if (!(k in this.macro)) return; this.macro[k] = clamp(v, 0, 1); if (this.comp) this.comp.setMacro(k, this.macro[k]); this.mapMacros(); }
    mapMacros(force){ const m = this.macro, M = this.mixer, f = this.w.fx, s = m.space, y = m.y, x = m.x;
      // SPACE: sends, hall size, delay feedback, plate decay
      const ks = {plate: .3 + 1.5 * s, hall: .15 + 2.1 * s * s + .3 * s, delay: .25 + 1.5 * s};
      const tm = this.throwMul || {plate: 1, hall: 1, delay: 1}; for (const tr of M.tracks){ if (tr.dying || !tr.baseSend) continue; for (const k in ks) tr.send[k] = tr.baseSend[k] * ks[k] * (tm[k] || 1); for (const k of ['gran', 'shim', 'rev', 'reso']) if (tr.baseSend[k]) tr.send[k] = tr.baseSend[k] * (.4 + 1.2 * s); }
      const rt = (f.hall.rt60 || 5) * (.45 + 1.1 * s); if (force || Math.abs(rt - (this._rt || 0)) > .25){ M.hall.set(Object.assign({}, f.hall, {rt60: rt})); this._rt = rt; }
      const pd = clamp((f.plate.decay || .7) * (.82 + .35 * s), .3, .93); if (force || Math.abs(pd - (this._pd || 0)) > .02){ M.plate.set(Object.assign({}, f.plate, {decay: pd})); this._pd = pd; }
      // CHAOS + broken: tape wow on the delay; SPACE: feedback
      const fb = clamp(this.baseDelay.feedback * (.55 + .9 * s) * (this.fbMul || 1), 0, .88), wow = this.baseDelay.wow * (1 + y * 5 + m.chaos * 2), fl = this.baseDelay.flutter * (1 + y * 6);
      if (force || Math.abs(fb - (this._fb || 0)) > .01 || Math.abs(wow - (this._wow || 0)) > 1e-5){ M.delay.set(Object.assign({}, this.baseDelay, {feedback: fb, wow, flutter: fl})); this._fb = fb; this._wow = wow; }
      // ENERGY: below the middle the music bus closes (dark, distant); above it the drums step forward and the tape works harder
      M.musicLP.set(m.energy < .5 ? 1800 * Math.pow(2, m.energy * 2 * 3.5) : 20000);
      M.phaserMix = Math.max(0, m.motion - .45) * 1.3; if (M.phaser) M.phaser.set({rate: .04 + m.motion * .35, depth: 1, feedback: .35 + m.motion * .3, mix: Math.min(.7, M.phaserMix)});
      // MOOD: tilt; X (warm ↔ glass): tilt + per-track brightness; Y (clean ↔ broken): drive, tape, crush
      M.tiltHigh = this.baseTilt + (m.mood - .5) * 2.5 + (x - .5) * 3; M.tiltLow = 1 + (.5 - x) * .25;
      M.tape.set({drive: 1.1 + y * 1.4 + Math.max(0, m.energy - .5) * .8, bias: .04 + y * .08, lp: 17000 - y * 6000, mix: .6 + .4 * y}); M.crush = Math.max(0, y - .55) / .45;
      for (const tr of M.tracks){ if (tr.dying || !tr.spec) continue; const k = tr.instKind, melodic = k === 'va' || k === 'mono' || k === 'modal';
        if (tr.bus === 'music') tr.drive = tr.baseDrive + y * .55;
        if (tr.bus === 'drums') tr.gain.set(A.dbToGain((tr.spec.db || 0) + (A.PATCH_NORM[tr.patchName] || 0) + (tr.instKind === 'kick' ? 2 : 0) + (m.energy - .5) * 4));
        if (melodic){ tr.liveT.cut = (x - .5) * 2.4 + (tr.shCut || 0); tr.liveT.lfo = (m.motion - .3) * 1.8; tr.liveT.rate = m.motion * 5; }
        if (k === 'bass') tr.liveT.cut = (x - .5) * 1.2;
        if (k === 'modal'){ tr.inst.patch.bright = (tr.basePatch.bright || 1) * (.45 + 1.1 * x); tr.inst.patch.sustain = (tr.basePatch.sustain || 1) * (.7 + .8 * s); }
        if (tr.chorus) tr.chorus.mix = clamp(tr.baseChorus * (.5 + x) + m.motion * .2, 0, .9);
        if (k === 'perc' || k === 'hat') tr.inst.var = .6 + m.chaos * 1.6; else if (tr.inst) tr.inst.var = .7 + m.chaos * .9; }
      // world-specific: these tracks open with the arc (CRESCENDO)
      if (this.w.openWithE) for (const slot of this.w.openWithE){ const tr = this.tracks[slot]; if (tr) tr.liveT.cut += (this.lastE - .45) * 2.6; }
      // v2: hand-ridden filter (a slow triangle over N bars) on chosen tracks
      if (this.w.ride && this.comp) for (const rd of this.w.ride){ const tr = this.tracks[rd.slot]; if (tr){ const ph = (this.comp.k % rd.bars) / rd.bars; tr.liveT.cut += ((1 - Math.abs(2 * ph - 1)) - .5) * rd.depth; } } }
    nudge(kind){ if (this.comp) this.comp.doNudge(kind); this.out.msg({type: 'nudge', kind, at: 'next phrase'}); }
    voice(slot, cmd){ const tr = this.tracks[slot]; if (!tr) return; const parts = this.comp.parts.filter(p => p.slot === slot);
      if (cmd === 'mute') tr.mute = !tr.mute; else if (cmd === 'solo') tr.solo = !tr.solo;
      else if (cmd === 'on') parts.forEach(p => p.user = p.user === 1 ? 0 : 1); else if (cmd === 'off') parts.forEach(p => p.user = p.user === -1 ? 0 : -1);
      else if (cmd === 'reroll'){ this.reroll[slot] = (this.reroll[slot] || 0) + 1; const n = this.reroll[slot];
        const spec = this.w.tracks[slot], opts = this.w.tracks[slot].patch; this.g.patches[slot] = opts[(opts.indexOf(this.g.patches[slot]) + 1) % opts.length];
        const nt = this.makeTrack(slot, spec, tr.id); nt.mute = tr.mute; nt.solo = tr.solo; tr.dying = true; this.tracks[slot] = nt; this.mixer.add(nt);
        const P2 = Object.assign({}, this.comp.P, {rng: name => A.rng(A.hash(this.g.seed, name, 'reroll', n))});
        parts.forEach(p => { p.obj = new A.PARTS[p.spec.part](P2, Object.assign({slot}, p.spec.opts || {})); }); this.mapMacros(); }
      this.out.msg({type: 'voice', slot, mute: this.tracks[slot].mute, solo: this.tracks[slot].solo, patch: this.tracks[slot].patchName, user: parts.length ? parts[0].user : 0}); }
    queue(genome){ this.queued = genome; }
    // v2 transition commands from 56-moves (slot '@'), applied at their exact block
    ramp(key, from, to, sec, curve, set, done){ this.ramps = (this.ramps || []).filter(r => r.key !== key); this.ramps.push({key, from, to, t0: this.t, n: Math.max(1, sec * this.sr), curve, set, done}); }
    fxCmd(ev){ const M = this.mixer, sr = this.sr;
      switch (ev.cmd){
        case 'tapestop': M.busfx.tapeStop(ev.dur); break;
        case 'stutter': M.busfx.stutter(ev.len, ev.dur, ev.pitch); break;
        case 'release': M.busfx.release(); break;
        case 'gap': M.gap.snap(0); this.ramp('gap', 0, 1, ev.dur, 8, v => M.gap.set(v < .99 ? 0 : 1)); break;
        case 'ramp': if (ev.what === 'hp'){ const from = ev.from === undefined ? M.hpSweep.v : ev.from; this.ramp('hp', from, ev.to, ev.dur, ev.curve, v => M.hpSweep.set(v)); } break;
        case 'gate': M.gate.on = !!ev.on; if (ev.on){ M.gate.pat = A.euclid(ev.k || 11, 16, ev.rot || 0); M.gate.t0 = this.comp ? this.comp.t - this.comp.barN : this.t; M.gate.depth = .85; } break;
        case 'freeze': if (this.fxp && this.fxp.gran){ this.fxp.gran.freeze = !!ev.on; if (ev.on) this.fxp.gran.density = Math.max(this.fxp.gran.density, 26); else { this.fxp.gran.freeze = false; if (this.w.sends && this.w.sends.gran) this.fxp.gran.set(this.w.sends.gran); } } break;
        case 'throw': { const k = ev.send, tm = this.throwMul; tm[k] = ev.amt || 3; if (ev.fb) this.fbMul = ev.fb / Math.max(.1, this.baseDelay.feedback); this.mapMacros(); this.ramp('throw-' + k, 1, 0, ev.dur || 1, 1, () => {}, () => { tm[k] = 1; this.fbMul = 1; this.mapMacros(); }); break; }
        case 'climb': if (!ev.dur){ this.ramp('climb', M.fshiftOn, 0, .3, 1, v => { M.fshiftOn = v; M.fshift.mix = v; }); break; }
          M.fshift.set({shift: 2, mix: 0, feedback: .45, time: 60 / this.g.bpm / 2}); this.ramp('climb', 0, 1, ev.dur, 1.5, v => { M.fshiftOn = .001 + v * .6; M.fshift.mix = v * .55; M.fshift.shift = 2 + v * 30; }); break; } }
    // live telemetry for the MATH view (only while it is open): every number the engine is using right now
    mathSnap(){ const sr = this.sr, M = this.mixer, c = this.comp, voices = [];
      const vinfo = (slot, kind, v) => { const o = {slot, kind, age: v.age || 0};
        if (kind === 'va' || kind === 'mono'){ Object.assign(o, {note: v.note, f: v.freq * (v.fmul || 1), env: v.aenv ? v.aenv.v : 0, stage: v.aenv ? v.aenv.stage : 0, fenv: v.fenv ? v.fenv.v : 0, cut: v.cutNow || 0, base: v.p ? v.p.cutoff : 0, amt: v.p ? v.p.envAmt || 0 : 0, res: v.p ? v.p.res || 0 : 0, vel: v.vel, U: v.U || 1, lfo: v.lfoPh !== undefined ? A.sin1(v.lfoPh) : 0, lfoCut: v.p ? (v.p.lfoCut || 0) + (v.p.live ? v.p.live.lfo : 0) : 0, live: v.p && v.p.live ? v.p.live.cut : 0}); }
        else if (kind === 'acid') Object.assign(o, {kind: 'mono', note: v.note, f: v.f0, env: v.gb * 3, stage: v.gateLeft > 0 ? 2 : 4, fenv: v.meg, cut: v.cutNow || 0, base: 313.8 * Math.pow(7.6305, v.k.cut), amt: v.k.env, res: v.k.res, vel: v.vel, U: 1, lfo: 0, lfoCut: 0, live: 0});
        else if (kind === 'bass') Object.assign(o, {note: v.note, f: v.freq, fsub: v.freq * (v.p && v.p.subOct === -1 ? .5 : 1), env: v.aenv.v, stage: v.aenv.stage, cut: v.cutNow || 0, vel: v.vel});
        else if (kind === 'modal') Object.assign(o, {note: v.note, f: v.f0, n: v.n, mk: v.p ? v.p.kind : '', t: v.i / sr, vel: v.vel});
        else if (kind === 'kick'){ const p = v.p || {}; Object.assign(o, {fS: v.fS, fE: v.fE, tau: p.tau, t: v.i / sr, f: v.fE + (v.fS - v.fE) * v.e1, amp: v.amp, ampTau: p.ampTau, vel: v.vel}); }
        else Object.assign(o, {t: v.i / sr, e: v.e !== undefined ? v.e : v.en, f: v.f || 0, vel: v.vel, open: v.open});
        return o; };
      for (const slot of this.slots){ const tr = this.tracks[slot]; if (!tr) continue; const inst = tr.inst, k = tr.instKind; let list = [];
        if (inst.pool) list = inst.pool.v.filter(v => v.on).sort((a, b) => b.age - a.age).slice(0, 3); else if (inst.v && inst.v.on) list = [inst.v];
        for (const v of list) voices.push(vinfo(slot, k, v)); }
      const pats = []; for (const p of c.parts){ const o = p.obj, d = {slot: p.slot, part: p.spec.part, active: p.on};
        if (o.pat) d.bits = o.pat.join(''); if (o.gate && o.gate.join && p.spec.part === 'pad') d.bits = o.gate.join('');
        if (o.lanes) d.lanes = o.lanes.slice(0, 5).map(L => { const P = L.p || L.period || L.len || 16; return L.hits ? {p: P, bits: L.hits.join(''), i: ((c.k * 16) % P)} : {p: P, bits: L.gate ? L.gate.join('') : L.acc ? L.acc.map(x => x ? 1 : 0).join('') : '', n: L.n, len: L.len}; });
        if (o.target) d.bits = o.target.join(''); if (o.eps !== undefined) d.phase = {base: o.base, eps: o.eps}; if (o.alt) d.kick = {mode: o.mode, alt: o.alt}; pats.push(d); }
      let nv = 0; for (const slot of this.slots){ const tr = this.tracks[slot], inst = tr && tr.inst; if (!inst) continue; if (inst.pool) nv += inst.pool.activeCount(); else if (inst.v && inst.v.on) nv++; }
      const g = this.g; return {type: 'math', t: this.t, sr, nv, total: c.totalBars || 0, gov: this.gov ? {load: this.gov.load, level: this.gov.level} : null, raw: Array.from(this.rawL || []), comp: c.dbg || null, voices, pats, seed: g.seed, world: g.world,
        macro: Object.assign({}, this.macro), mix: {lufs: M.loud.lufs, lref: M.lref, target: M.target, autoGain: M.autoGain, gr: M.grMaster, peak: M.outPeak, aeqG: Array.from(M.aeq.g), aeqT: M.aeq.target.slice(), aeqM: Array.from(M.aeq.meas).map(x => 10 * Math.log10(x + 1e-12)), aeqF: M.aeq.f, gate: M.aeq.gate,
          duckB: M.duckGain(this.t, M.duckDepth.bass), duckDepth: M.duckDepth.bass, lastKick: M.kicks.length ? (this.t - M.kicks[M.kicks.length - 1]) / sr : -1, tilt: M.tiltHigh, crush: M.crush, gateOn: M.gate.on, hp: M.hpSweep.v, fsh: M.fshiftOn > .002 ? M.fshift.shift : 0, bus: M.busfx.mode, sends: Object.keys(M.x2.sends), phaser: M.phaserMix, musicLP: M.musicLP.v, hallRT: this._rt, delayFB: this._fb}}; }
    next(){ if (this.comp) this.comp.doNudge('next'); }
    // scrub: drop what is scheduled but not yet heard and restart the bar grid right now at the chosen bar
    // reset every transition effect (a seek or a new piece must never inherit a tape stop, gate, HP sweep or freeze)
    resetFx(){ const M = this.mixer; M.busfx.mode = 0; M.gate.on = false; M.hpSweep.snap(10); M.gap.snap(1); M.fshiftOn = 0; M.fshift.mix = 0; this.ramps = []; this.throwMul = {plate: 1, hall: 1, delay: 1}; this.fbMul = 1;
      if (this.fxp && this.fxp.gran && this.w && this.w.sends && this.w.sends.gran) this.fxp.gran.set(this.w.sends.gran); else if (this.fxp && this.fxp.gran) this.fxp.gran.freeze = false; if (this.comp && this.comp.moves){ const mv = this.comp.moves; mv.gateOn = mv.freezeOn = mv.tapeStopped = false; mv.rolling = null; this.comp.halfTimeTo = -1; } }
    // FX MOVES toggle: switching off drops any queued transition commands/sounds and releases whatever is engaged (gently)
    setV2(on){ on = !!on; if (this.v2 === on) return; this.v2 = on; if (on) return; this.q.filter(e => e.slot !== '@' && e.slot !== 'fx');
      const M = this.mixer; if (M.busfx.mode) M.busfx.release(); M.gate.on = false; M.hpSweep.set(10); M.gap.set(1); this.ramps = []; this.throwMul = {plate: 1, hall: 1, delay: 1}; this.fbMul = 1; this.mapMacros(); if (M.fshiftOn > .001) this.fxCmd({cmd: 'climb', dur: 0});
      if (this.fxp && this.fxp.gran){ if (this.w && this.w.sends && this.w.sends.gran) this.fxp.gran.set(this.w.sends.gran); else this.fxp.gran.freeze = false; }
      if (this.comp){ this.comp.halfTimeTo = -1; const mv = this.comp.moves; if (mv){ mv.gateOn = mv.freezeOn = mv.tapeStopped = false; mv.rolling = null; mv.hpPlan = null; } } }
    // CPU governor (live playback only; the host feeds it wall-clock ms per block — Date.now() deltas average out to the true cost).
    // It never drops notes. Over ~78% of the real-time budget it lowers render quality a step: fewer unison oscillators on new notes,
    // then release tails end at −50 dB instead of −62, then the 303 runs 2x instead of 4x. Back under ~50% for 5 s → a step back up.
    govern(ms, n){ const G = this.gov || (this.gov = {acc: 0, nb: 0, level: 0, calm: 0, load: 0}); G.acc += ms; G.nb += n; if (G.nb < this.sr * .5) return;
      const load = G.acc / (G.nb / this.sr * 1000); G.acc = 0; G.nb = 0; G.load = load;
      if (load > .78){ G.calm = 0; if (G.level < 3){ G.level++; this.applyGov(); this.out.msg({type: 'gov', level: G.level, load}); } }
      else if (load < .5 && G.level > 0){ if (++G.calm >= 10){ G.calm = 0; G.level--; this.applyGov(); this.out.msg({type: 'gov', level: G.level, load}); } } else G.calm = 0; }
    applyGov(){ const lv = this.gov ? this.gov.level : 0, Q = A.Q || (A.Q = {}), L = [[3, 8e-4, 4], [2, 8e-4, 4], [2, 3e-3, 2], [1, 6e-3, 2]][lv]; Q.uni = L[0]; Q.tail = L[1]; Q.os = L[2];
      for (const slot in this.tracks){ const inst = this.tracks[slot] && this.tracks[slot].inst; if (inst && inst.pool) inst.pool.cap = 0; } }
    seek(bar){ const c = this.comp; if (!c) return; this.q.clear(); this.resetFx(); for (const tr of this.mixer.tracks) if (tr.inst.pend) tr.inst.pend.length = 0; c.seek(bar); c.t = this.t + 64; c.done = false; c.endSent = false; this.out.msg({type: 'seek', bar, t0: c.t}); }
    pickNext(){ if (this.queued){ const g = this.queued; this.queued = null; return g; }
      const others = A.WORLD_LIST.filter(w => w !== this.g.world); const seed = (A.hash(this.g.seed, 'next', this.history.length) >>> 0); const r = A.rng(seed);
      return A.makeGenome(r.pick(others), seed); }
    // ---------------------------------------------------------------- run
    schedule(){ const c = this.comp, ahead = c.barN; while (c.t < this.t + BLK + ahead){
        if (c.done && this.endMode === 'repeat'){ c.seek(0); c.done = false; this.out.msg({type: 'repeat'}); }
        if (c.done && this.endMode === 'stop'){ if (!c.endSent){ c.endSent = true; this.out.msg({type: 'end', stopped: true}); } c.t += c.barN; continue; }
        if (c.done){ this.history.push(this.g); if (this.history.length > 20) this.history.shift(); if (this.auto){ const g = this.onEnd ? this.onEnd(this.g) : null; this.load(g || this.pickNext()); return; } else if (!c.endSent){ c.endSent = true; this.out.msg({type: 'end'}); } }
        c.v2 = this.v2 !== false && this.g.v2 !== false; const bar = c.nextBar(); this.lastE = bar.info.E; const af = this.w.aeqFrom === undefined ? .35 : this.w.aeqFrom; this.mixer.aeq.gate = clamp((bar.info.E - af) / .3, 0, 1);
        if (bar.info.chordStart && this.fxp && this.fxp.reso && this.mixer.x2.sends.reso) this.fxp.reso.tune(bar.info.voicing.concat([bar.info.bass + 12]));
        for (const e of bar.events){ if (e.slot === '@'){ this.q.push({t: Math.round(e.t), slot: '@', ev: e.ev}); continue; } const tr = this.tracks[e.slot]; if (!tr) continue; this.q.push({t: Math.round(e.t), slot: e.slot, ev: e.ev});
          const ev = e.ev; if (ev.note !== undefined) this.out.note(e.t, tr.id, ev.note, ev.vel || .7, (ev.dur || .2) * this.sr); else if (ev.level === undefined) this.out.note(e.t, tr.id, ev.kick ? -1 : ev.open ? -3 : -2, ev.vel || .7, 0); }
        if (!bar.info.done){ const m = Object.assign({type: 'bar'}, bar.info); if (m.planRev !== this._planRev){ this._planRev = m.planRev; m.sections = c.sections.map(s => Object.assign({}, s)); } this.out.msg(m); this.mapMacros(); } } }
    process(L, R, n){ if (!this.comp){ L.fill(0, 0, n); R.fill(0, 0, n); return; } this.schedule();
      const end = this.t + n, q = this.q;
      while (q.size && q.peek().t < end){ const e = q.pop(); if (e.slot === '@'){ this.fxCmd(e.ev); continue; } const tr = this.tracks[e.slot]; if (!tr || tr.dying) continue; const off = Math.max(0, Math.min(n - 1, e.t - this.t));
        tr.inst.play(off, e.ev); if (e.ev.kick && !tr.mute) this.mixer.kickAt(Math.max(this.t, e.t)); }
      if (this.retire){ const MX = this.mixer; for (const k in this.retire) if (this.t > this.retire[k]){ delete MX.x2.sends[k]; delete MX.x2.retG[k]; if (this.fxp) delete this.fxp[k]; delete this.retire[k]; } }
      if (this.ramps && this.ramps.length){ const tt = this.t, RA = this.ramps; let w = 0; for (let ri = 0; ri < RA.length; ri++){ const rp = RA[ri], q2 = clamp((tt - rp.t0) / Math.max(1, rp.n), 0, 1), v = rp.from + (rp.to - rp.from) * Math.pow(q2, rp.curve || 1); rp.set(v); if (q2 >= 1){ if (rp.done) rp.done(); } else RA[w++] = rp; } if (this.ramps === RA) RA.length = w; }
      // smooth live modulation; slow auto-pan with MOTION; fade dying tracks
      // CHAOS ≥ .5: sample-and-hold filter jumps on every 16th (melodic tracks), snapping, not gliding
      const ch = this.macro.chaos; if (this.comp){ const st = Math.floor((this.t - this.pieceStart) / this.comp.stepN); if (st !== this._shStep){ this._shStep = st; const amt = Math.max(0, ch - .5) * 2.4;
          for (const tr of this.mixer.tracks){ if (tr.bus !== 'music' || !tr.spec) continue; const prev = tr.shCut || 0; tr.shCut = amt ? (Math.random() < .5 ? (Math.random() * 2 - 1) * amt : prev * .5) : 0; tr.liveT.cut += tr.shCut - prev; if (amt && tr.inst.patch && tr.inst.patch.live) tr.inst.patch.live.cut += tr.shCut - prev; } } }
      const kS = 1 - Math.exp(-n / (.12 * this.sr)), mo = this.macro.motion, dt = n / this.sr; let dead = false;
      for (const tr of this.mixer.tracks){ const lv = tr.inst.patch && tr.inst.patch.live;
        if (lv){ lv.cut += (tr.liveT.cut - lv.cut) * kS; lv.lfo += (tr.liveT.lfo - lv.lfo) * kS; lv.rate += (tr.liveT.rate - lv.rate) * kS; }
        if (tr.bus === 'music' && tr.spec){ tr.panPh += tr.panRate * dt * (.3 + mo * 6); tr.pan = clamp(tr.basePan + Math.sin(tr.panPh * 6.2832) * Math.max(0, mo - .2) * .9, -1, 1); }
        if (tr.dying){ tr.fade -= dt / 2.5; if (tr.fade <= 0){ tr.fade = 0; dead = true; } } }
      if (dead) this.mixer.tracks = this.mixer.tracks.filter(t => !(t.dying && t.fade <= 0));
      this.mixer.process(L, R, n, this.t); this.t = end; this.blocks++;
      if (this.mathOn){ const L0 = this.rawL || (this.rawL = new Float32Array(32)); for (let i = 0; i < 32; i++) L0[i] = L[i * 4]; if (this.blocks % 24 === 0){ let m = null; try { m = this.mathSnap(); } catch (err){ m = null; } if (m) this.out.msg(m); } }
      if (this.blocks % 8 === 0){ const T = this.tracks; this.out.msg({type: 'meters', t: this.t, peaks: this.slots.map(s => T[s] ? T[s].peak : 0), lufs: this.mixer.loud.lufs, gr: this.mixer.grMaster, out: this.mixer.outPeak}); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_ENGINE;
