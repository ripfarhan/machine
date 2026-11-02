/* ganYEET BARS — voices. Additive: runs after the Maut ki Awaaz engine modules, only on beats.html. Math only, no samples.
   Struck 808 (Werner et al., DAFx 2014: an impulse into a resonator whose frequency and Q jump for about 6 ms, then sag; state survives
   retriggers, so no two hits match) with a band-split so the sub stays clean and phones still get harmonics. Plucked banjo, dhol and tasha
   patches, found-object percussion and an 808 cowbell, the roughness scare (Arnal: amplitude modulation at 30–150 Hz), drum-machine grit, the
   vocal chain. See research/10-rap.md. */
'use strict';
function AWZ_B_VOICES(A){
  const clamp = A.clamp, tanh = A.tanh, TAU = A.TAU, mtof = A.mtof;
  Object.assign(A.PATCH, {
    // struck 808s. f0 comes from the note; jump = frequency multiplier for the first ~6 ms; sag = how far above f0 the pitch sits as it falls; tau = amplitude decay (s)
    s808_kick:  {inst: 'struck', p: {tau: .15, jump: 2.2, jumpT: .006, sag: .2, sagT: .09, harm: .22, drive: 3, knock: .14, glide: .05, gain: 1}},
    s808_long:  {inst: 'struck', p: {tau: .9, jump: 1.9, jumpT: .006, sag: .14, sagT: .08, harm: .3, drive: 3.4, knock: .06, glide: .075, gain: .95}},
    s808_short: {inst: 'struck', p: {tau: .28, jump: 2, jumpT: .006, sag: .18, sagT: .08, harm: .28, drive: 3.4, knock: .1, glide: .05, gain: .95}},
    s808_blown: {inst: 'struck', p: {tau: .7, jump: 2.2, jumpT: .006, sag: .16, sagT: .08, harm: .62, drive: 8, knock: .12, glide: .06, gain: .85}},
    s808_soft:  {inst: 'struck', p: {tau: 1.3, jump: 1.3, jumpT: .008, sag: .05, sagT: .1, harm: .08, drive: 1.6, knock: 0, glide: .09, gain: 1}},
    kick_dust:  {inst: 'kick', p: {fStart: 165, fEnd: 54, tau: .03, ampHold: .016, ampTau: .12, click: .16, clickTau: .0016, drive: 1.9, asym: .08, lp: 5200, hp: 32, knock: .2, knockF: 850, sub: .14}},
    kick_box:   {inst: 'kick', p: {fStart: 190, fEnd: 75, tau: .012, ampHold: .004, ampTau: .055, click: .05, drive: 1.5, lp: 3000, hp: 45, knock: .5, knockF: 420}},
    snare_crack:{inst: 'snare', p: {mode: 'snare', f1: 195, f2: 350, bodyTau: .06, noiseF: 2900, noiseQ: .7, noiseTau: .11, snap: .35, body: .95, noise: .8, drive: 1.5, hp: 150, lp: 8000}},
    snare_dig:  {inst: 'snare', p: {mode: 'snare', f1: 280, f2: 470, bodyTau: .03, noiseF: 3400, noiseQ: .8, noiseTau: .07, snap: .5, body: .9, noise: .55, drive: 1.5, hp: 240, lp: 9000}},
    snare_high: {inst: 'snare', p: {mode: 'snare', f1: 340, f2: 610, bodyTau: .03, noiseF: 3800, noiseQ: .9, noiseTau: .06, snap: .5, body: .9, noise: .5, drive: 1.4, hp: 300, lp: 9000}},
    clap_soft:  {inst: 'snare', p: {mode: 'clap', noiseF: 1150, noiseQ: .9, noiseTau: .09, hp: 400, lp: 3400}},
    clap_tight: {inst: 'snare', p: {mode: 'clap', noiseF: 1450, noiseQ: 1, noiseTau: .07, hp: 500, lp: 8500}},
    tasha:      {inst: 'snare', p: {mode: 'snare', f1: 480, f2: 760, bodyTau: .025, noiseF: 3000, noiseQ: .9, noiseTau: .04, snap: .4, body: .8, noise: .55, drive: 1.3, hp: 420, lp: 8000}},
    hat_soft:   {inst: 'hat', p: {tune: .95, closedTau: .018, openTau: .15, bpF: 6500, hpF: 6000, air: .25, lp: 10500}},
    dhol_low:   {inst: 'tom', p: {ratio: 1.35, pTau: .03, ampTau: .2, noise: .16, noiseTau: .02, lp: 2200}},
    dhol_high:  {inst: 'tom', p: {ratio: 1.22, pTau: .012, ampTau: .075, noise: .32, noiseTau: .01, lp: 4000}},
    keys_ep:    {inst: 'modal', p: {kind: 'ep', sustain: .85, release: .22, lp: 4200, gain: 1.05, unisonCents: 1}},
    keys_piano: {inst: 'modal', p: {kind: 'piano', sustain: .7, bright: .8, thump: .05, release: .16, gain: 1, unisonCents: 2.2}},
    keys_stub:  {inst: 'modal', p: {kind: 'piano', sustain: .32, bright: .85, thump: .09, release: .07, gain: 1.05, unisonCents: 3}},
    keys_felt:  {inst: 'modal', p: {kind: 'felt', sustain: 1, bright: .8, thump: .08, release: .4, gain: 1.2, unisonCents: 1.4}},
    xylo:       {inst: 'modal', p: {kind: 'marimba', sustain: .9, release: .2, lp: 5200, gain: .95}},
    banjo:      {inst: 'pluck', p: {decay: 1.7, bright: .62, pick: .13, gain: .95}},
    horror:     {inst: 'va', p: {shape1: 0, shape2: 1, semi2: 12, osc2Level: .18, detune2: 5, drift: 6, filter: 'svf', cutoff: 1500, res: .05, keytrack: .4, aa: .01, ad: .5, as: .55, ar: .5, vib: 12, vibDelay: .1, vibRate: 3.4, gain: .85}},
    saw_soft:   {inst: 'mono', p: {shape1: 2, shape2: 2, osc2Level: .7, detune2: 9, drift: 4, cutoff: 1250, res: .12, keytrack: .4, envAmt: .7, fa: .004, fd: .3, fs: .55, fr: .15, aa: .006, ad: .3, as: .8, ar: .14, vib: 6, vibDelay: .4, vibRate: 5, glide: .03, legato: true, gain: .5}},
    scare_tone: {inst: 'scare', p: {gain: .9}},
    found_kit:  {inst: 'found', p: {}}});

  // ---------------------------------------------------------------- struck 808: a rotating phasor (amplitude stays put when frequency moves), hit by a short pulse, state kept across hits
  A.StruckVoice = class { constructor(sr, seed){ this.sr = sr; this.re = 0; this.im = 0; this.f = 50; this.target = 50; this.env = 0; this.gateLeft = 0; this.nz = new A.Noise((seed | 0) * 3 + 7); this.hp1 = new A.SVF(); this.hp2 = new A.SVF(); this.lp = new A.SVF(); this.kn = new A.SVF(); this.t = 1e9; this.pulse = 0; this.dc = new A.DCBlock(); this.vel = 0; this.note = 36; }
    start(off, note, vel, dur, p){ const sr = this.sr; this.p = p; this.off = off; this.note = note; this.vel = vel; this.target = mtof(note); if (this.env < 1e-3) this.f = this.target; else this.f = this.f + (this.target - this.f) * .85; this.gateLeft = Math.max(1, Math.round(dur * sr)); this.t = 0; this.pulse = Math.round(.001 * sr); this.pAmp = (TAU * this.target / sr) * 1.02 * vel / Math.max(1, this.pulse) * sr / this.target / TAU; this.decay = Math.exp(-1 / (p.tau * sr)); this.relK = Math.exp(-1 / (.03 * sr)); this.released = false; this.kAmp = (p.knock || 0) * vel; this.kE = 1; this.kK = Math.exp(-1 / (.004 * sr)); this.hp1.set(150, .7, sr); this.hp2.set(150, .7, sr); this.lp.set(1500, .7, sr); this.kn.set(2400, .9, sr); }
    glideTo(note, dur){ this.target = mtof(note); this.note = note; this.gateLeft = Math.max(1, Math.round(dur * this.sr)); this.decay = Math.max(this.decay, Math.exp(-1 / (this.p.tau * this.sr))); this.released = false; }
    release(){ this.gateLeft = 0; this.released = true; }
    render(L, R, n){ const p = this.p, sr = this.sr, gk = 1 - Math.exp(-1 / ((p.glide || .06) * sr)), jump = (p.jump || 2) - 1, jT = Math.exp(-1 / ((p.jumpT || .006) * sr)), sag = p.sag || 0, sT = Math.exp(-1 / ((p.sagT || .08) * sr)), drv = p.drive || 3, harm = p.harm === undefined ? .25 : p.harm, live = A.DIRT === undefined ? 1 : A.DIRT, H = harm * live, D = drv * (.5 + live * .5), dn = 1 / tanh(Math.min(3, D)), g = p.gain || 1; let i0 = this.off; this.off = 0;
      if (this.jE === undefined){ this.jE = 0; this.sE = 0; }
      for (let s = i0; s < n; s++){ if (this.t === 0){ this.jE = 1; this.sE = 1; } this.t++;
        if (this.gateLeft > 0 && --this.gateLeft === 0) this.released = true;
        this.f += (this.target - this.f) * gk; const fi = this.f * (1 + jump * this.jE + sag * this.sE); this.jE *= jT; this.sE *= sT;
        const w = TAU * fi / sr, c = Math.cos(w), si = Math.sin(w), a = this.released ? this.decay * this.relK : this.decay, nr = (this.re * c - this.im * si) * a, ni = (this.re * si + this.im * c) * a; this.re = nr; this.im = ni;
        if (this.pulse > 0){ this.pulse--; this.re += this.vel * .00105 * 48000 / sr * 22; }
        let y = this.im; const e = Math.abs(y); this.env = e > this.env ? e : this.env * .9995;
        // band-split: the sub stays clean; a driven copy is high-passed and low-passed so small speakers hear harmonics
        const sat = tanh(y * D + .12) * dn; this.dcv = this.dc.tick(sat); this.hp1.run(this.dcv); this.hp2.run(this.hp1.hp); const hh = this.lp.tick(this.hp2.hp); let o = y + hh * H;
        if (this.kAmp > 1e-4){ this.kn.run(this.nz.white()); o += this.kn.bp * this.kAmp * this.kE; this.kE *= this.kK; if (this.kE < 1e-3) this.kAmp = 0; }
        o *= g; L[s] += o * this.gl; R[s] += o * this.gr; if (this.env < 2e-5 && this.t > sr * .05 && !this.pulse){ this.re = 0; this.im = 0; this.env = 0; return false; } }
      return true; } };

  // ---------------------------------------------------------------- Karplus–Strong pluck, short and damped, for the procession banjo
  A.PluckVoice = class { constructor(sr, seed){ this.sr = sr; this.buf = new Float32Array(Math.ceil(sr / 40) + 4); this.nz = new A.Noise((seed | 0) * 5 + 11); this.len = 100; this.w = 0; this.lp = 0; this.aenv = new A.ADSR(sr); }
    start(off, note, vel, dur, p){ const sr = this.sr, f = mtof(note); this.p = p; this.off = off; this.note = note; this.vel = vel; const L = sr / f; this.int = Math.floor(L); this.frac = L - this.int; this.w = 0; this.rd = 0; this.lp = 0; this.gateLeft = Math.max(1, Math.round(dur * sr)); this.g = Math.pow(10, -3 / ((p.decay || 1.5) * f)); this.damp = 1 - (p.bright === undefined ? .6 : p.bright) * .5; const pk = Math.max(1, Math.round(this.int * (p.pick || .13))); let prev = 0; const b = this.buf; b.fill(0); for (let i = 0; i < this.int; i++){ const x = this.nz.white(); prev = prev + (x - prev) * (.5 + vel * .4); b[i] = prev; } const tmp = b.slice(0, this.int); for (let i = 0; i < this.int; i++) b[i] = tmp[i] - tmp[(i - pk + this.int) % this.int] * .9; this.aenv.v = 1; this.aenv.stage = 3; this.aenv.s = 1; this.pos = 0; this.yprev = 0; this.life = 0; }
    release(){ this.gateLeft = 1; }
    render(L, R, n){ const b = this.buf, N = this.int, g = this.g, d = this.damp, p = this.p; let i0 = this.off, peak = 0; this.off = 0; const vol = this.vel * (p.gain || 1) * .55;
      for (let s = i0; s < n; s++){ const x = b[this.pos], nx = b[(this.pos + 1) % N]; let y = x + (nx - x) * this.frac; this.lp += (y - this.lp) * (1 - d * .5); y = this.lp * g; b[this.pos] = y; this.pos = (this.pos + 1) % N; const o = x * vol; L[s] += o * this.gl; R[s] += o * this.gr; const a = o < 0 ? -o : o; if (a > peak) peak = a; }
      this.life = peak > 1e-4 ? 0 : this.life + 1; return this.life < 30; } };

  // ---------------------------------------------------------------- the scare: two tones a semitone apart, amplitude-modulated, the rate rising through the roughness zone; meant for its own echo
  A.ScareVoice = class { constructor(sr){ this.sr = sr; this.p1 = 0; this.p2 = 0; this.pm = 0; this.lp = new A.SVF(); this.aenv = new A.ADSR(sr); }
    start(off, note, vel, dur, p){ this.p = p; this.off = off; this.note = note; this.vel = vel; this.N = Math.max(64, Math.round(dur * this.sr)); this.i = 0; this.f1 = mtof(note); this.f2 = this.f1 * 1.0595; this.fm0 = p.fm0 || 30; this.fm1 = p.fm1 || 90; this.d1 = p.depth === undefined ? .9 : p.depth; this.lp.set(3600, .7, this.sr); this.aenv.v = 0; this.aenv.stage = 3; }
    release(){}
    render(L, R, n){ const sr = this.sr, N = this.N, g = this.vel * (this.p.gain || 1) * .5; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const q = this.i++ / N; if (q >= 1) return false; const fm = this.fm0 + (this.fm1 - this.fm0) * q * q, d = this.d1 * Math.min(1, q * 2.2); this.pm += fm / sr; if (this.pm >= 1) this.pm -= 1; this.p1 += this.f1 * (1 - .03 * q) / sr; if (this.p1 >= 1) this.p1 -= 1; this.p2 += this.f2 * (1 - .03 * q) / sr; if (this.p2 >= 1) this.p2 -= 1;
        const am = 1 + d * A.sin1(this.pm), x = (A.sin1(this.p1) + A.sin1(this.p2) * .8 + A.sin1(this.p1 * 2.01) * .18) * am * .4, env = Math.min(1, q * 12) * Math.pow(1 - q, .7), y = this.lp.tick(tanh(x * 1.3)) * env * g; L[s] += y * this.gl; R[s] += y * this.gr; }
      return true; } };

  // ---------------------------------------------------------------- found-sound percussion
  // kinds: grinder · bottle · clink · tap · crumple · cowbell (808: squares at 540 and 800 Hz through a band-pass)
  A.FoundVoice = class { constructor(sr, seed){ this.sr = sr; this.nz = new A.Noise(seed * 7 + 41); this.a = new A.SVF(); this.b = new A.SVF(); this.c = new A.SVF(); this.r = A.rng(seed * 11 + 5); this.ph = 0; }
    start(off, ev){ const sr = this.sr, r = this.r, k = this.kind = ev.kindF || 'tap'; this.off = off; this.i = 0; this.vel = ev.vel === undefined ? .7 : ev.vel; this.imp = 0; this.ph = 0; this.a.reset(); this.b.reset(); this.c.reset();
      const J = 1 + (r() - .5) * .16;
      if (k === 'grinder'){ this.len = .13 * J * sr; this.rate = 160 / sr; this.a.set(6200 * J, 1.4, sr); this.b.set(3100 * J, 1.1, sr); }
      else if (k === 'bottle'){ this.len = .16 * J * sr; this.rate = 90 / sr; this.a.set(1500 * J, 2.2, sr); this.b.set(3100 * J, 1.4, sr); this.f = 900 * J; }
      else if (k === 'clink'){ this.len = .24 * sr; this.a.set(2840 * J, 34, sr); this.b.set(5210 * J, 30, sr); this.c.set(7360 * J, 24, sr); }
      else if (k === 'crumple'){ this.len = .09 * J * sr; this.rate = 300 / sr; this.a.set(1400 * J, .9, sr); this.b.set(3600 * J, .8, sr); }
      else if (k === 'cowbell'){ this.len = .34 * sr; this.a.set(1750, 1.4, sr); this.b.set(3300, 1.6, sr); this.p1 = 0; this.p2 = 0; }
      else { this.len = .16 * sr; this.f = (ev.freq || 245) * J; this.a.set(2100, .8, sr); } }
    render(L, R, n){ const sr = this.sr, k = this.kind, g = this.vel, N = this.len; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; if (i >= N) return false; const q = i / N; let y = 0;
        if (k === 'grinder' || k === 'crumple' || k === 'bottle'){ if (this.nz.white() * .5 + .5 < this.rate * (k === 'bottle' ? 1 + 3 * Math.sin(q * 9.4) * Math.sin(q * 9.4) : 1)) this.imp = (this.nz.white() * .5 + .5) * 1.6; else this.imp *= k === 'crumple' ? .7 : .84;
          const w = this.nz.white() * this.imp; this.a.run(w); this.b.run(w); const env = Math.sin(Math.min(1, q * 1.15) * Math.PI);
          y = (this.a.bp * .9 + this.b.bp * .45) * env;
          if (k === 'bottle'){ this.ph += this.f * (1 + q * 1.6) / sr; if (this.ph >= 1) this.ph -= 1; y += A.sin1(this.ph) * this.imp * .12 * env; } }
        else if (k === 'cowbell'){ const t = i / sr; this.p1 += 540 / sr; if (this.p1 >= 1) this.p1 -= 1; this.p2 += 800 / sr; if (this.p2 >= 1) this.p2 -= 1; const x = (this.p1 < .5 ? 1 : -1) + (this.p2 < .5 ? 1 : -1); this.a.run(x * .5); this.b.run(x * .5); y = (this.a.bp * .9 + this.b.bp * .4) * (.72 * Math.exp(-t / .009) + .28 * Math.exp(-t / .085)) * Math.min(1, i / 24); }
        else if (k === 'clink'){ const x = i < 2 ? .42 : 0; this.a.run(x); this.b.run(x); this.c.run(x); y = (this.a.bp + this.b.bp * .7 + this.c.bp * .4) * Math.exp(-q * 5.5) * 2; }
        else { const t = i / sr; this.ph += this.f * (1 + .55 * Math.exp(-t / .012)) / sr; if (this.ph >= 1) this.ph -= 1; this.a.run(this.nz.white()); y = A.sin1(this.ph) * Math.exp(-t / .045) * (i < 16 ? i / 16 : 1) + this.a.bp * Math.exp(-t / .006) * .5; }
        const o = y * g; L[s] += o * this.gl; R[s] += o * this.gr; }
      return true; } };
  A.FoundInst = class { constructor(sr, seed){ this.sr = sr; this.patch = {}; this.var = 1; let k = 0; this.pool = new A.Pool(() => new A.FoundVoice(sr, (seed || 1) + (k++)), 8); this.pend = []; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ const v = this.pool.get(); v.start(off, ev); A.panTo(v, ev.pan); }
    render(L, R, n){ return A.segRender(this, L, R, n); }
    renderVoices(L, R, n){ return this.pool.render(L, R, n); }
    allOff(){ this.pend.length = 0; this.pool.each(v => v.on = false); } };

  // ---------------------------------------------------------------- inserts
  // 12-bit drum machine: sample-and-hold at about 26 kHz, 12-bit steps, a soft edge after
  A.SPCrush = class { constructor(sr){ this.sr = sr; this.set({}); this.hL = 0; this.hR = 0; this.c = 0; this.lpL = new A.SVF(); this.lpR = new A.SVF(); }
    set(o){ this.hold = Math.max(1, Math.round(this.sr / (o.rate || 26000))); this.q = Math.pow(2, (o.bits || 12) - 1); this.mix = o.mix === undefined ? 1 : o.mix; this.fc = o.lp || 12000; this.lpL && (this.lpL.set(this.fc, .7, this.sr), this.lpR.set(this.fc, .7, this.sr)); }
    process(L, R, n){ const q = this.q, m = this.mix, H = this.hold; if (!this.lpL.a2) { this.lpL.set(this.fc, .7, this.sr); this.lpR.set(this.fc, .7, this.sr); }
      for (let i = 0; i < n; i++){ if (++this.c >= H){ this.c = 0; this.hL = Math.round(L[i] * q) / q; this.hR = Math.round(R[i] * q) / q; } this.lpL.run(this.hL); this.lpR.run(this.hR); L[i] += (this.lpL.lp - L[i]) * m; R[i] += (this.lpR.lp - R[i]) * m; } } };
  // suitcase-piano autopan
  A.Tremolo = class { constructor(sr){ this.sr = sr; this.ph = 0; this.set({}); }
    set(o){ this.rate = o.rate || 4.4; this.depth = o.depth === undefined ? .35 : o.depth; }
    process(L, R, n){ const d = this.rate / this.sr, D = this.depth; for (let i = 0; i < n; i++){ this.ph += d; if (this.ph >= 1) this.ph -= 1; const s = A.sin1(this.ph) * D; L[i] *= 1 + s; R[i] *= 1 - s; } } };

  // ---------------------------------------------------------------- the vocal chain (live and when mixing a take)
  // high-pass → gentle compressor → presence lift → safety → sends to its own slap echo and plate. fx: dry | room | slap | big
  A.VoiceChain = class { constructor(sr){ this.sr = sr; this.hp = new A.SVF(); this.hp.set(90, .7, sr); this.pres = new A.SVF(); this.pres.set(3400, .8, sr); this.env = 1e-6; this.plate = new A.Plate(sr); this.delay = new A.TapeDelay(sr); this.z = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(128)); this.fx = 'room'; this.kA = Math.exp(-1 / (.005 * sr)); this.kR = Math.exp(-1 / (.12 * sr)); this.level = 0; this.kL = Math.exp(-1 / (.03 * sr)); this.setFx('room', 90); }
    setFx(fx, bpm){ this.fx = fx; const d = {dry: [0, 0, .08], room: [.17, .05, .12], slap: [.13, .3, .1], big: [.36, .22, .2]}[fx] || [.17, .05, .12]; this.sPlate = d[0]; this.sDelay = d[1]; this.fb = d[2]; this.plate.set({decay: fx === 'big' ? .72 : .5, damping: .45, predelay: .02, inHP: 220, outLP: 8000}); this.delay.set({time: 60 / (bpm || 90) * (fx === 'slap' ? .5 : .75), feedback: this.fb * 2, lp: 3400, hp: 380, wow: .0005, flutter: .00004, pingpong: true}); }
    // writes the processed voice into oL/oR (added); returns nothing. n ≤ 128
    process(x, oL, oR, n, gain){ const Z = this.z, dryL = Z[0], sL = Z[1], sR = Z[2], rL = Z[3], rR = Z[4]; let e = this.env, lv = this.level; const kA = this.kA, kR = this.kR, kL = this.kL, th = .11, ra = 1 / 3, pg = Math.pow(10, 2.5 / 20) - 1, makeup = 2.1;
      for (let i = 0; i < n; i++){ this.hp.run(x ? x[i] : 0); let y = this.hp.hp; const a = y < 0 ? -y : y; lv = a + (lv - a) * (a > lv ? .6 : kL); e = a > e ? a + (e - a) * kA : a + (e - a) * kR; const over = e / th, g = over > 1 ? Math.pow(over, ra - 1) : 1; y *= g * makeup; this.pres.run(y); y += this.pres.bp * pg * this.pres.k; y = tanh(y * .9) * 1.1; dryL[i] = y; sL[i] = y * this.sPlate; sR[i] = y * this.sDelay; rL[i] = 0; rR[i] = 0; }
      this.env = e < 1e-9 ? 1e-9 : e; this.level = lv < 1e-9 ? 0 : lv; const g0 = gain === undefined ? 1 : gain;
      if (this.sPlate){ this.plate.process(sL, sL, rL, rR, n); for (let i = 0; i < n; i++){ oL[i] += rL[i] * g0; oR[i] += rR[i] * g0; rL[i] = 0; rR[i] = 0; } }
      if (this.sDelay){ this.delay.process(sR, sR, rL, rR, n); for (let i = 0; i < n; i++){ oL[i] += rL[i] * g0; oR[i] += rR[i] * g0; } }
      for (let i = 0; i < n; i++){ const d = dryL[i] * g0; oL[i] += d; oR[i] += d; } } };

}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_B_VOICES;
