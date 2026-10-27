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
      this.macro = {energy: .5, mood: .5, space: .5, density: .5, chaos: .2, motion: .4, x: .5, y: .2}; this.auto = true; this.queued = null; this.history = []; this.blocks = 0; this.playing = true; this.lastE = .3;
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
        default: return new A.DrumInst(sr, gp.inst, p, seed); } }
    makeTrack(slot, spec, id){ const gp = A.genomePatch(this.g, slot, this.reroll[slot] || 0), inst = this.makeInst(slot, gp, spec), norm = A.PATCH_NORM[gp.name] || 0;
      const bus = spec.bus || (DRUM[gp.inst] ? 'drums' : 'music');
      // mix hygiene (research/03 §7; measured: renders were +6…+11 dB in 200–500 Hz vs the Cooper reference) — chords and keys leave the low-mids to the bass
      const pad = /^pad/.test(gp.name), stab = /^(stab|arp|pluck)/.test(gp.name), keys = gp.inst === 'modal';
      const hp = Math.max(spec.hp || 0, pad ? 180 : stab ? 200 : keys ? 160 : 0), eq = (spec.eq || []).concat(pad || stab ? [[340, -3.5, .9]] : keys ? [[300, -3, .9]] : []);
      const tr = new A.Track(this.sr, slot, bus, inst, {db: (spec.db || 0) + norm + (bus === 'bass' ? 3 : gp.inst === 'kick' ? 2 : 0), pan: spec.pan || 0, width: spec.width, hp: hp || undefined, eq, lp: spec.lp, drive: spec.drive, chorus: spec.chorus, haas: spec.haas, plate: spec.plate, hall: spec.hall, delay: spec.delay, id});
      tr.spec = spec; tr.patchName = gp.name; tr.instKind = gp.inst; tr.basePatch = Object.assign({}, gp.p); tr.baseSend = Object.assign({}, tr.send); tr.baseDrive = spec.drive || 0; tr.basePan = spec.pan || 0; tr.baseChorus = spec.chorus ? spec.chorus.mix : 0;
      tr.liveT = {cut: 0, lfo: 0, res: 0, rate: 0}; tr.panPh = (id * .618) % 1; tr.panRate = .013 + (id % 5) * .007; tr.dying = false; return tr; }
    load(genome){ const first = !this.g; this.g = genome; const w = this.w = A.WORLDS[genome.world];
      // fade out whatever is playing; it is removed once silent
      for (const tr of this.mixer.tracks) tr.dying = true; this.q.clear(); this.reroll = {};
      this.slots = Object.keys(w.tracks); this.tracks = {};
      this.slots.forEach((slot, i) => { const tr = this.makeTrack(slot, w.tracks[slot], i); this.tracks[slot] = tr; this.mixer.add(tr); });
      this.comp = new A.Composer(this.sr, genome, w); this.comp.t = this.t + Math.round((first ? .15 : 1.2) * this.sr);
      // macros: world defaults on top of neutral, the mood knob shows the genome's mode
      this.macro = Object.assign({energy: .5, space: .5, density: .5, chaos: .2, motion: .4, x: .5, y: .2}, genome.macros || {}, {mood: this.comp.modeIdx / 5}); Object.assign(this.comp.macro, this.macro);
      this.fx(); this.mapMacros(true); this.pieceStart = this.comp.t;
      this.out.msg({type: 'piece', genome, world: w.name, desc: w.desc, ref: w.ref, slots: this.slots.map(s => ({slot: s, patch: this.tracks[s].patchName, kind: this.tracks[s].instKind, bus: this.tracks[s].bus})),
        sections: this.comp.sections, bpm: genome.bpm, key: A.NOTE[genome.tonic], mode: genome.mode, family: genome.family, loop: this.comp.loop.chords.map(c => ({name: c.name, bars: c.bars, deg: c.deg})), t0: this.comp.t, macros: this.macro}); }
    fx(){ const f = this.w.fx, M = this.mixer, bpm = this.g.bpm; M.plate.set(f.plate || {}); M.hall.set(f.hall || {});
      this.baseDelay = Object.assign({time: (f.delay.beats || .75) * 60 / bpm, feedback: .4, wow: .0009, flutter: .00006}, f.delay); M.delay.set(this.baseDelay);
      M.duckDepth.bass = f.duck.bass; M.duckDepth.ret = f.duck.ret; M.duckRel = Math.min(.22, 60 / bpm * .42); this.baseTilt = (f.master && f.master.tiltHigh) || 0; }
    // ---------------------------------------------------------------- macros → sound
    setMacro(k, v){ if (!(k in this.macro)) return; this.macro[k] = clamp(v, 0, 1); if (this.comp) this.comp.setMacro(k, this.macro[k]); this.mapMacros(); }
    mapMacros(force){ const m = this.macro, M = this.mixer, f = this.w.fx, s = m.space, y = m.y, x = m.x;
      // SPACE: sends, hall size, delay feedback, plate decay
      const ks = {plate: .3 + 1.5 * s, hall: .15 + 2.1 * s * s + .3 * s, delay: .25 + 1.5 * s};
      for (const tr of M.tracks){ if (tr.dying || !tr.baseSend) continue; for (const k in ks) tr.send[k] = tr.baseSend[k] * ks[k]; }
      const rt = (f.hall.rt60 || 5) * (.45 + 1.1 * s); if (force || Math.abs(rt - (this._rt || 0)) > .25){ M.hall.set(Object.assign({}, f.hall, {rt60: rt})); this._rt = rt; }
      const pd = clamp((f.plate.decay || .7) * (.82 + .35 * s), .3, .93); if (force || Math.abs(pd - (this._pd || 0)) > .02){ M.plate.set(Object.assign({}, f.plate, {decay: pd})); this._pd = pd; }
      // CHAOS + broken: tape wow on the delay; SPACE: feedback
      const fb = clamp(this.baseDelay.feedback * (.55 + .9 * s), 0, .82), wow = this.baseDelay.wow * (1 + y * 5 + m.chaos * 2), fl = this.baseDelay.flutter * (1 + y * 6);
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
      if (this.w.openWithE) for (const slot of this.w.openWithE){ const tr = this.tracks[slot]; if (tr) tr.liveT.cut += (this.lastE - .45) * 2.6; } }
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
    next(){ if (this.comp) this.comp.doNudge('next'); }
    pickNext(){ if (this.queued){ const g = this.queued; this.queued = null; return g; }
      const others = A.WORLD_LIST.filter(w => w !== this.g.world); const seed = (A.hash(this.g.seed, 'next', this.history.length) >>> 0); const r = A.rng(seed);
      return A.makeGenome(r.pick(others), seed); }
    // ---------------------------------------------------------------- run
    schedule(){ const c = this.comp, ahead = c.barN; while (c.t < this.t + BLK + ahead){
        if (c.done){ this.history.push(this.g); if (this.auto){ const g = this.onEnd ? this.onEnd(this.g) : null; this.load(g || this.pickNext()); return; } else if (!c.endSent){ c.endSent = true; this.out.msg({type: 'end'}); } }
        const bar = c.nextBar(); this.lastE = bar.info.E; const af = this.w.aeqFrom === undefined ? .35 : this.w.aeqFrom; this.mixer.aeq.gate = clamp((bar.info.E - af) / .3, 0, 1);
        for (const e of bar.events){ const tr = this.tracks[e.slot]; if (!tr) continue; this.q.push({t: Math.round(e.t), slot: e.slot, ev: e.ev});
          const ev = e.ev; if (ev.note !== undefined) this.out.note(e.t, tr.id, ev.note, ev.vel || .7, (ev.dur || .2) * this.sr); else if (ev.level === undefined) this.out.note(e.t, tr.id, ev.kick ? -1 : ev.open ? -3 : -2, ev.vel || .7, 0); }
        if (!bar.info.done){ this.out.msg(Object.assign({type: 'bar'}, bar.info)); this.mapMacros(); } } }
    process(L, R, n){ if (!this.comp){ L.fill(0, 0, n); R.fill(0, 0, n); return; } this.schedule();
      const end = this.t + n, q = this.q;
      while (q.size && q.peek().t < end){ const e = q.pop(), tr = this.tracks[e.slot]; if (!tr || tr.dying) continue; const off = Math.max(0, Math.min(n - 1, e.t - this.t));
        tr.inst.play(off, e.ev); if (e.ev.kick && !tr.mute) this.mixer.kickAt(Math.max(this.t, e.t)); }
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
      if (this.blocks % 8 === 0){ const T = this.tracks; this.out.msg({type: 'meters', t: this.t, peaks: this.slots.map(s => T[s] ? T[s].peak : 0), lufs: this.mixer.loud.lufs, gr: this.mixer.grMaster, out: this.mixer.outPeak}); } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_ENGINE;
