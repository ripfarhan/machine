/* Maut ki Awaaz — engine module: parts (the players).
   A part is called once per bar with a context c and emits events with c.emit(slot, step, ev), step = 16th position in the bar
   (fractional allowed; swing/humanise applied by the composer). Parts never pick their own chords: harmony comes from c.
   Cooper rules baked in: chord loop is the song; no sound twice (per-event jitter happens in the instruments); clicky quiet
   drums; clean sub; prime-length loops; processes (rain→grid, per-note drift) give each world its identity. */
'use strict';
function AWZ_PARTS(A){
  const clamp = A.clamp, PRIMES = [3, 5, 7, 11, 13];
  // 1/f (Voss) sequence for velocities / slow variation
  A.voss = (r, n, dice) => { const d = []; for (let k = 0; k < dice; k++) d.push(r()); const o = []; for (let i = 0; i < n; i++){ for (let k = 0; k < dice; k++) if (i % (1 << k) === 0) d[k] = r(); o.push(d.reduce((a, b) => a + b, 0) / dice); } return o; };
  const fitRange = (m, lo, hi) => { while (m < lo) m += 12; while (m > hi) m -= 12; return m; };

  A.PARTS = {};
  // ---------------------------------------------------------------- pad / chords: hold · swell · gated · pulse ; bends (suspended top voice), strum
  A.PARTS.pad = class { constructor(P, o){ this.slot = o.slot || 'pad'; this.mode = o.mode || 'hold'; this.strum = o.strum === undefined ? .025 : o.strum; this.bend = o.bend === undefined ? .45 : o.bend; this.vel = o.vel || .62; this.r = P.rng('pad' + this.slot); this.delayTop = 0; this.gate = o.gate || A.euclid(11, 16, 2); this.oct = o.oct || 0; }
    bar(c){ const r = this.r, v = c.voicing; let notes = v.notes.map(m => m + 12 * this.oct); if (c.opening && notes.length) notes = notes.concat([fitRange(notes[notes.length - 1] + 12, 60, 91)]);
      if (this.mode === 'gated'){ for (let s = 0; s < 16; s++) if (this.gate[s] || (c.E > .85 && s % 2 === 0)) notes.forEach((m, i) => c.emit(this.slot, s + i * .02, {note: m, vel: this.vel * (s % 4 === 0 ? 1 : .8), dur: c.step * .9})); return; }
      if (this.mode === 'pulse'){ for (let s = 0; s < 16; s += 4) notes.forEach((m, i) => c.emit(this.slot, s + i * .04, {note: m, vel: this.vel * (s ? .75 : 1), dur: c.step * 3.2})); return; }
      const restrike = this.mode === 'swell' && !c.chordStart && c.barInChord % 2 === 0;
      if (!c.chordStart && !restrike) return;
      const dur = (c.chordStart ? c.chordBars : Math.min(2, c.chordBars - c.barInChord)) * c.bar - c.step * .5, bendIt = c.chordStart && r() < this.bend && c.nextChordIn > 0, bendBeats = r() < .5 ? 1 : 2;
      notes.forEach((m, i) => { const top = i === notes.length - 1; let at = (this.strum * i * c.stepsPerSec) + (r() * .4);
        if (top && this.delayTop) at += this.delayTop * 4;
        let d = dur - (top && this.delayTop ? this.delayTop * c.beat : 0); if (top && bendIt) d += bendBeats * c.beat;
        c.emit(this.slot, at, {note: m, vel: this.vel * (restrike ? .7 : 1) * (.9 + r() * .2), dur: Math.max(c.beat, d)}); });
      this.delayTop = c.chordStart && bendIt ? bendBeats : 0; } };

  // ---------------------------------------------------------------- stabs: 32-step pattern (40–55 % density), short chord hits, cutoff swept by a 2-bar triangle
  A.PARTS.stab = class { constructor(P, o){ this.slot = o.slot || 'stab'; const r = this.r = P.rng('stab'); const k = o.hits || r.int(12, 17); this.pat = A.euclid(k, 32, r.int(0, 6)); for (let i = 0; i < 4; i++){ const j = r.int(0, 31); this.pat[j] = this.pat[j] ? 0 : 1; } this.pat[0] = 1; this.gate = o.gate || 1.4; this.vel = o.vel || .7; this.n = o.notes || 3; }
    bar(c){ const half = (c.barIndex & 1) * 16, notes = c.voicing.notes.slice(-this.n);
      for (let s = 0; s < 16; s++){ if (!this.pat[half + s]) continue; if (c.E < .55 && (half + s) % 4 !== 0 && this.r() < .4) continue;
        const ph = (half + s) / 32, tri = 1 - 2 * Math.abs(ph - .5), cm = -1.2 + 2.2 * tri * (.4 + .6 * c.E) + (c.brightness - .5);
        notes.forEach((m, i) => c.emit(this.slot, s + i * .03, {note: m, vel: this.vel * (s % 4 === 0 ? 1 : .82), dur: c.step * this.gate, mod: {cutMod: cm}})); } } };

  // ---------------------------------------------------------------- arpeggio lanes: each lane a prime-length cycle over chord tones, own rate/octave/gate; Turing-style slip
  A.PARTS.arp = class { constructor(P, o){ this.slot = o.slot || 'arp'; const r = this.r = P.rng('arp' + this.slot); this.lanes = [];
      const nL = o.lanes || r.int(1, 2), periods = r.weighted ? null : null;
      for (let k = 0; k < nL; k++){ const period = o.periods ? o.periods[k] : r.pick(k ? [5, 7, 11] : [3, 4, 5, 6, 7]); const len = o.gateLen || r.pick([16, 12, 16, 10]);
        const idx = Array.from({length: period}, (_, i) => r.pick(['up', 'up', 'down', 'skip', 'rand']) === 'rand' ? r.int(0, 5) : (o.shape === 'down' ? period - 1 - i : i) % 6);
        this.lanes.push({period, idx, n: 0, rate: o.rate || (k ? 2 : 1), oct: k ? 1 : 0, gate: A.euclid(Math.round(len * (o.density || r.range(.55, .85))), len, r.int(0, 3)), len, vel: A.voss(r, 64, 4), lo: o.lo || 57, hi: o.hi || 84}); }
      this.dur = o.dur || .8; this.vel0 = o.vel || .7; }
    bar(c){ const pool = []; c.voicing.notes.forEach(m => pool.push(m)); c.voicing.notes.forEach(m => pool.push(m + 12)); pool.sort((a, b) => a - b);
      this.lanes.forEach((L, k) => { if (k > 0 && c.E < .7 && !c.forceAll) return;
        for (let s = 0; s < 16; s += L.rate){ const gs = c.barIndex * 16 + s; if (!L.gate[gs % L.len] && !(c.density > .75 && gs % 2 === 0)) continue;
          if (c.density < .35 && s % 4 !== 0) continue;
          const i = L.n++ % L.period; if (i === 0 && this.r() < c.mutation) L.idx[this.r.int(0, L.period - 1)] = this.r.int(0, 5);
          let m = pool[L.idx[i] % pool.length] + 12 * L.oct; m = fitRange(m, L.lo, L.hi + L.oct * 6);
          const vel = this.vel0 * (.55 + .45 * L.vel[gs % 64]) * (i === 0 ? 1.1 : 1) * (k ? .7 : 1);
          c.emit(this.slot, s, {note: m, vel, dur: c.step * L.rate * this.dur, pan: k ? .45 * (k % 2 ? 1 : -1) : 0});
          if (c.chaos > .55 && this.r() < (c.chaos - .55) * .25) c.emit(this.slot, s + L.rate * .5, {note: m, vel: vel * .6, dur: c.step * .4}); } }); } };

  // ---------------------------------------------------------------- prime pluck lanes (Penrose Tiling): several lanes of prime length, each its own register/pan; lanes join one by one
  A.PARTS.lanes = class { constructor(P, o){ this.slot = o.slot || 'pluck'; const r = this.r = P.rng('lanes'); const ps = r.shuffle ? null : null; const primes = o.primes || [5, 7, 11, 13, 3];
      this.lanes = primes.slice(0, o.count || 4).map((p, k) => { const hits = A.euclid(Math.max(2, Math.round(p * r.range(.35, .6))), p, r.int(0, p - 1)); return {p, hits, deg: Array.from({length: p}, () => r.pick([0, 1, 2, 3, 4, 0, 2])), oct: [0, 1, -1, 1, 2][k], pan: [0, -.55, .55, -.3, .3][k], vel: .55 + r() * .2, at: k}; });
      this.rate = o.rate || 1; }
    bar(c){ const tones = c.voicing.notes.slice().sort((a, b) => a - b), n = tones.length; const avail = Math.min(this.lanes.length, 1 + Math.floor(c.layerIndex * this.lanes.length + c.E * 1.5));
      for (let k = 0; k < avail; k++){ const L = this.lanes[k];
        for (let s = 0; s < 16; s += this.rate){ const gs = (c.barIndex * 16 + s) / this.rate, i = gs % L.p; if (!L.hits[i]) continue; if (c.density < .4 && this.r() < .4) continue;
          const m = fitRange(tones[L.deg[i] % n] + 12 * L.oct, 60, 93); c.emit(this.slot, s, {note: m, vel: L.vel * (.8 + .2 * this.r()), dur: c.step * 3, pan: L.pan + (this.r() - .5) * .2}); } } } };

  // ---------------------------------------------------------------- phase-drift chord (My Mind Is Slipping): each chord tone repeats at its own slightly different tempo
  A.PARTS.phase = class { constructor(P, o){ this.slot = o.slot || 'pluck'; const r = this.r = P.rng('phase'); this.base = o.base || r.pick([2, 3, 4]); this.eps = o.eps || r.range(.004, .012); this.t = new Float64Array(8); this.started = false; this.vel = o.vel || .6; this.durSteps = o.durSteps || 6; }
    bar(c){ const tones = c.voicing.notes.slice(0, 6).concat(c.voicing.notes.length < 4 ? [c.voicing.notes[0] + 12] : []); const T0 = c.barIndex * 16, T1 = T0 + 16, eps = this.eps * (.4 + 1.2 * c.motion);
      if (!this.started){ for (let k = 0; k < 8; k++) this.t[k] = T0 + k * .5; this.started = true; }
      tones.forEach((m, k) => { const per = this.base * (1 + k * eps); while (this.t[k] < T1){ if (this.t[k] >= T0) c.emit(this.slot, this.t[k] - T0, {note: m, vel: this.vel * (.75 + .25 * this.r()), dur: c.step * this.durSteps, pan: ((k / Math.max(1, tones.length - 1)) - .5) * 1.2}, true); this.t[k] += per; } }); } };

  // ---------------------------------------------------------------- motif lead: rhythm → contour → pentatonic pitches; sentence A A′ B (rest); development operators; optional fractal elaboration
  A.PARTS.motif = class { constructor(P, o){ this.slot = o.slot || 'lead'; const r = this.r = P.rng('motif'); this.P = P; this.fractal = !!o.fractal; this.depth = 0; this.vel = o.vel || .7; this.lo = o.lo || 62; this.hi = o.hi || 86;
      const len = r.weighted({3: 1.5, 4: 3, 5: 2.5, 6: 2, 7: 1}) | 0; const cells = [[0, 3, 6, 10], [0, 4, 6, 8, 12], [0, 2, 4, 7, 10, 12], [0, 6, 8, 12, 14], [0, 3, 8, 11], [0, 2, 6, 8, 10, 14], [0, 4, 10, 12, 14]];
      let pos = r.pick(cells).slice(0, len); if (pos.length < len) for (let k = pos.length; k < len; k++) pos.push(Math.min(15, pos[k - 1] + 2));
      const contour = r.pick(['arch', 'valley', 'desc', 'asc', 'zig']); let rung = r.int(2, 4); const rungs = pos.map((_, i) => { if (i){ const dir = contour === 'asc' ? 1 : contour === 'desc' ? -1 : contour === 'arch' ? (i < len / 2 ? 1 : -1) : contour === 'valley' ? (i < len / 2 ? -1 : 1) : (i % 2 ? 1 : -1); rung = clamp(rung + dir * (r() < .75 ? 1 : 2), 0, 7); } return rung; });
      this.motif = pos.map((p, i) => ({s: p, rung: rungs[i], len: (pos[i + 1] === undefined ? 16 : pos[i + 1]) - p})); this.motif[this.motif.length - 1].len = Math.max(this.motif[this.motif.length - 1].len, 4); this.phrase = 0; this.vari = 0; }
    variant(kind){ const m = this.motif.map(n => Object.assign({}, n)), r = this.r;
      if (kind === 'answer'){ m[m.length - 1].rung = clamp(m[m.length - 1].rung + r.pick([-2, -1, 1]), 0, 7); }
      else if (kind === 'seq'){ m.forEach(n => n.rung = clamp(n.rung + 1, 0, 8)); }
      else if (kind === 'invert'){ const r0 = m[0].rung; m.forEach(n => n.rung = clamp(r0 - (n.rung - r0), 0, 8)); }
      else if (kind === 'frag'){ return m.slice(0, Math.max(2, Math.ceil(m.length / 2))).concat(m.slice(0, Math.max(2, Math.ceil(m.length / 2))).map(n => Object.assign({}, n, {s: n.s + 8}))).filter(n => n.s < 16); }
      return m; }
    elaborate(m){ if (!this.fractal || this.depth === 0) return m; const out = []; m.forEach(n => { out.push(n); if (n.len >= 4 && this.depth > 0){ const k = Math.min(3, this.depth); for (let j = 1; j <= k && n.s + j * Math.floor(n.len / (k + 1)) < 16; j++) out.push({s: n.s + j * Math.floor(n.len / (k + 1)), rung: clamp(n.rung + (j % 2 ? 1 : -1) * j, 0, 8), len: Math.max(1, Math.floor(n.len / (k + 1))), sub: true}); } }); return out.sort((a, b) => a.s - b.s); }
    bar(c){ const ph = Math.floor(c.barInSection / 2) % 4, inPh = c.barInSection % 2; if (inPh === 1 && ph !== 2) return;   // A (bar1) · A′ (bar3) · B (bars 5–6) · rest
      if (c.barInSection % 16 === 0 && c.barInSection > 0 && this.fractal) this.depth = Math.min(3, this.depth + 1);
      const kind = ph === 0 ? (c.sectionIdx > 2 && this.r() < .3 ? 'seq' : 'plain') : ph === 1 ? 'answer' : ph === 2 ? (c.E > .7 ? 'invert' : 'frag') : null; if (!kind) return;
      const ladder = []; for (let m = this.lo; m <= this.hi; m++) if (c.chordPcs.indexOf(m % 12) >= 0 || (c.key.inScale(m) && c.pent.has(m % 12))) ladder.push(m);
      const notes = this.elaborate(this.variant(kind)); const off = ph === 2 && inPh === 1 ? 0 : 0;
      notes.forEach(n => { const m = ladder[clamp(n.rung + 2, 0, ladder.length - 1)]; if (m === undefined) return; c.emit(this.slot, n.s + off, {note: m, vel: this.vel * (n.sub ? .65 : .9 + this.r() * .1), dur: c.step * Math.min(8, n.len) * .92}); }); } };

  // ---------------------------------------------------------------- felt keys: sparse single notes / dyads, long gaps; optional low "piano snare" cluster on 2 & 4 (Kiasmos)
  A.PARTS.keys = class { constructor(P, o){ this.slot = o.slot || 'keys'; this.r = P.rng('keys'); this.snare = !!o.snare; this.density = o.density || .5; this.vel = o.vel || .45; this.cell = A.voss(this.r, 64, 4); }
    bar(c){ const r = this.r, tones = c.voicing.notes.filter(m => m >= 57).concat(c.voicing.notes.map(m => m + 12).filter(m => m <= 84));
      if (this.snare && c.E > .45) [4, 12].forEach(s => { const root = fitRange(c.chordRoot + 36, 36, 47); [root, root + 1, root + 7].forEach((m, i) => c.emit(this.slot, s + i * .02, {note: m, vel: .38 + r() * .08, dur: c.step * 1.2})); });
      const slots = [0, 6, 10, 3, 12, 8]; const n = Math.round((.6 + 1.6 * this.density * (.4 + c.density)) * (c.calm ? 1.3 : .8));
      for (let k = 0; k < n; k++){ if (r() > .7) continue; const s = slots[(c.barIndex + k) % slots.length] + (r() < .3 ? 1 : 0); const m = tones[Math.floor(this.cell[(c.barIndex * 3 + k) % 64] * tones.length)];
        if (m === undefined) continue; c.emit(this.slot, s, {note: m, vel: this.vel * (.75 + r() * .35), dur: c.step * (8 + r() * 8)}); if (r() < .25) c.emit(this.slot, s + .03, {note: m - (r() < .5 ? 5 : 7), vel: this.vel * .7, dur: c.step * 8}); } } };

  // ---------------------------------------------------------------- bass: sub (root/pedal, sustained) · pulse · rolling 16ths · offbeat stab (octave up, separate slot) · half-time wobble
  A.PARTS.bass = class { constructor(P, o){ this.slot = o.slot || 'bass'; this.mode = o.mode || 'sub'; this.r = P.rng('bass' + this.mode); this.pat = o.pat || null; this.vel = o.vel || .9;
      if (this.mode === 'stab' && !this.pat){ const r = this.r; this.pat = r.pick([[3, 6, 11, 14], [2, 6, 10, 14], [3, 7, 10, 14], [6, 11, 14], [2, 7, 11]]); } }
    bar(c){ const r = this.r; let root = c.bassNote; if (root === undefined) return;
      if (this.mode === 'sub'){ if (c.chordStart || c.barInChord % 2 === 0) c.emit(this.slot, 0, {note: root, vel: this.vel, dur: Math.min(c.chordBars - c.barInChord, 2) * c.bar - c.step * .5, slide: !c.chordStart});
        if (c.E > .75 && c.density > .55 && r() < .35) c.emit(this.slot, 10, {note: root + (r() < .3 ? 7 : 0), vel: this.vel * .8, dur: c.step * 2.5}); }
      else if (this.mode === 'pulse'){ for (let s = 0; s < 16; s += 2) if (s % 4 === 2 || c.E > .7) c.emit(this.slot, s, {note: root + (s === 14 && r() < .2 ? 12 : 0), vel: this.vel * (s % 4 === 2 ? 1 : .8), dur: c.step * 1.6}); }
      else if (this.mode === 'rolling'){ for (let s = 0; s < 16; s++) if (s % 4 !== 0) c.emit(this.slot, s, {note: root, vel: this.vel * (s % 4 === 2 ? 1 : .78), dur: c.step * .8}); }
      else if (this.mode === 'stab'){ this.pat.forEach(s => { if (c.density < .4 && r() < .4) return; c.emit(this.slot, s, {note: fitRange(root + 12, 40, 55), vel: this.vel * (.8 + .2 * r()), dur: c.step * (1 + r())}); }); }
      else if (this.mode === 'halftime'){ c.emit(this.slot, 0, {note: root, vel: this.vel, dur: c.bar * .6}); c.emit(this.slot, 10, {note: root + (r() < .3 ? 12 : 0), vel: this.vel * .85, dur: c.bar * .3}); } } };

  // ---------------------------------------------------------------- kick: four · broken (0,7,10) · sparse · halftime · emergent ; phrase-end drop-outs
  A.PARTS.kick = class { constructor(P, o){ this.slot = 'kick'; this.mode = o.mode || 'four'; this.r = P.rng('kick'); this.vel = o.vel || .95; this.alt = this.r.pick([[0, 7, 10], [0, 6, 10], [0, 7, 10, 13], [0, 3, 10]]); }
    bar(c){ const r = this.r, endPhrase = (c.barInSection % 8) === 7 && r() < .45, last = c.barsLeftInSection === 1 && c.nextBigger;
      let steps = this.mode === 'four' ? [0, 4, 8, 12] : this.mode === 'broken' ? this.alt : this.mode === 'sparse' ? [0, 8] : this.mode === 'halftime' ? [0, 10] : [0, 4, 8, 12];
      if (this.mode === 'four' && c.E > .8 && c.density > .6 && r() < .25) steps = steps.concat([14]);
      steps.forEach(s => { if ((endPhrase || last) && s >= 12) return; c.emit(this.slot, s, {vel: this.vel * (s === 0 ? 1 : .92) * (.95 + .1 * r()), kick: true}); }); } };

  // ---------------------------------------------------------------- backbeat: snare / clap / rim on 2&4 (or 3 in half-time), ghosts with density
  A.PARTS.backbeat = class { constructor(P, o){ this.slot = o.slot || 'snare'; this.mode = o.mode || 'two4'; this.r = P.rng('bb'); this.vel = o.vel || .7; }
    bar(c){ const r = this.r, hits = this.mode === 'halftime' ? [8] : this.mode === 'broken' ? [4, 11] : [4, 12];
      hits.forEach(s => c.emit(this.slot, s, {vel: this.vel * (.92 + .1 * r())}));
      if (c.density > .5) [7, 15, 3].forEach(s => { if (r() < (c.density - .5) * .7) c.emit(this.slot, s, {vel: this.vel * .28}); }); } };

  // ---------------------------------------------------------------- hats: offbeat 8ths → 16ths with accents; open on the offbeat at high energy; swing applied by composer
  A.PARTS.hats = class { constructor(P, o){ this.slot = 'hat'; this.r = P.rng('hats'); this.vel = o.vel || .55; this.acc = [1, .45, .75, .45]; this.v = A.voss(this.r, 64, 4); this.open = o.open === undefined ? .5 : o.open; }
    bar(c){ const r = this.r; for (let s = 0; s < 16; s++){ const off8 = s % 4 === 2, on16 = s % 2 === 1;
        let play = off8 || (c.density > .55 && c.E > .55 && (s % 2 === 0 || r() < (c.density - .55))) || (on16 && c.density > .8 && r() < .5);
        if (!play) continue; const open = off8 && c.E > .78 && r() < this.open && s !== 14;
        c.emit(this.slot, s, {vel: this.vel * this.acc[s % 4] * (.7 + .3 * this.v[(c.barIndex * 16 + s) % 64]), open}); } } };

  // ---------------------------------------------------------------- micro-clicks: prime-length lanes of tiny resonant clicks, random pan, ratchets (Cooper "seething clicks")
  A.PARTS.clicks = class { constructor(P, o){ this.slot = o.slot || 'perc'; const r = this.r = P.rng('clicks'); const ps = o.primes || [5, 7, 11, 13, 3];
      this.lanes = ps.slice(0, o.count || 4).map(p => ({p, hits: A.euclid(Math.max(1, Math.round(p * r.range(.25, .5))), p, r.int(0, p - 1)), f: r.range(1800, 9000), ratios: [1, r.range(1.3, 2.9), r.range(3.1, 5.7)], q: r.range(12, 40), tau: r.range(.006, .03), pan: r.range(-.8, .8), vel: r.range(.3, .6)})); }
    bar(c){ const r = this.r, avail = Math.min(this.lanes.length, 1 + Math.floor(c.E * this.lanes.length * 1.2));
      for (let k = 0; k < avail; k++){ const L = this.lanes[k]; for (let s = 0; s < 16; s++){ const i = (c.barIndex * 16 + s) % L.p; if (!L.hits[i] || r() > .35 + c.density * .6) continue;
          const ev = {freq: L.f * (1 + (r() - .5) * .1), vel: L.vel * (.6 + .4 * r()), pan: clamp(L.pan + (r() - .5) * .4, -1, 1), mod: {ratios: L.ratios, q: L.q, tau: L.tau, noise: .5, hp: 900}};
          c.emit(this.slot, s, ev); if (c.chaos > .5 && r() < (c.chaos - .5) * .3){ for (let q = 1; q < 3; q++) c.emit(this.slot, s + q * .25, Object.assign({}, ev, {vel: ev.vel * (1 - q * .25)})); } } } } };

  // ---------------------------------------------------------------- rain → grid (Order from Chaos): Poisson drops pulled toward a hidden grid pattern as α rises
  A.PARTS.rain = class { constructor(P, o){ this.slot = o.slot || 'perc'; const r = this.r = P.rng('rain'); this.rate = o.rate || r.range(10, 22); this.target = A.euclid(r.int(5, 9), 16, r.int(0, 3)); this.f = r.range(2400, 5200); this.pslot = o.pitchSlot || null; }
    bar(c){ const r = this.r, alpha = c.alpha, secPerStep = c.step, n = Math.round(this.rate * 16 * secPerStep * (1 - .45 * alpha)), tg = this.target;
      for (let k = 0; k < n; k++){ let s = r() * 16; const g = Math.round(s) % 16;
        // survival biased to the target pattern as the grid takes over
        const on = tg[g]; if (alpha > .2 && !on && r() < alpha * .9) continue;
        s = s + alpha * (Math.round(s) - s); if (s >= 16) s -= 16;
        const accent = on && alpha > .6 ? 1 : .7; const ev = {freq: this.f * (1 + (r() - .5) * .6), vel: (.25 + .35 * r()) * accent, pan: (r() * 2 - 1) * .9, mod: {ratios: [1, 2.71, 5.13], q: 18 + 20 * r(), tau: .012 + .02 * r(), noise: .4, hp: 1200}};
        c.emit(this.slot, s, ev, true);
        if (this.pslot && on && alpha > .5 && r() < .18 * c.E){ const tones = c.voicing.notes; c.emit(this.pslot, Math.round(s), {note: fitRange(tones[Math.floor(r() * tones.length)] + 12, 67, 91), vel: .35, dur: c.step * 4, pan: ev.pan}); } } } };

  // ---------------------------------------------------------------- textures & drone: continuous beds whose level follows the section; drone on the tonic/pedal
  A.PARTS.texture = class { constructor(P, o){ this.slot = o.slot || 'tex'; this.kind = o.kind || 'hiss'; this.level = o.level || .5; this.follow = o.follow || 'inverse'; this.started = false; }
    bar(c){ const target = this.level * (this.follow === 'inverse' ? (1.15 - c.E * .6) : this.follow === 'constant' ? 1 : (.3 + .7 * c.E)) * (.6 + c.space * .8);
      c.emit(this.slot, 0, {level: target, kind: this.started ? undefined : this.kind, note: c.droneNote}); this.started = true; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_PARTS;
