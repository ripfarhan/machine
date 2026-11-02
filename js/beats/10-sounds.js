/* ganYEET BARS — sounds. Additive: runs after the Maut ki Awaaz engine modules, only on beats.html.
   Rap drum kits, 808s and keys as patches on the existing voices; new voices: found-sound percussion (Monte Booker's idea of
   replacing the drum kit with recorded objects), a chop sampler (MPC-style slices with mute groups), an imaginary record
   pressed offline so chops have real smear and bleed, drum-machine grit and tremolo inserts, and the vocal chain. */
'use strict';
function AWZ_B_SOUNDS(A){
  const clamp = A.clamp, tanh = A.tanh, TAU = A.TAU, mtof = A.mtof;
  A.MODES.harmonic = [0, 2, 3, 5, 7, 8, 11];
  A.MODES.phrygdom = [0, 1, 4, 5, 7, 8, 10];

  Object.assign(A.PATCH, {
    // ---------------------------------------------------------------- kicks
    kick_dust:  {inst: 'kick', p: {fStart: 165, fEnd: 52, tau: .03, ampHold: .018, ampTau: .13, click: .2, clickTau: .0016, drive: 2.2, asym: .08, lp: 5200, hp: 30, knock: .22, knockF: 850, sub: .12}},
    kick_tight: {inst: 'kick', p: {fStart: 210, fEnd: 58, tau: .018, ampHold: .01, ampTau: .085, click: .35, clickTau: .001, drive: 1.8, asym: .05, lp: 8000, hp: 34, knock: .15, knockF: 1400}},
    kick_live:  {inst: 'kick', p: {fStart: 140, fEnd: 62, tau: .02, ampHold: .008, ampTau: .07, click: .22, clickTau: .0014, drive: 1.3, lp: 4500, hp: 40, knock: .3, knockF: 700}},
    kick_box:   {inst: 'kick', p: {fStart: 190, fEnd: 75, tau: .012, ampHold: .004, ampTau: .05, click: .05, drive: 1.6, lp: 2800, hp: 45, knock: .5, knockF: 420}},
    kick_big:   {inst: 'kick', p: {fStart: 230, fEnd: 46, tau: .04, ampHold: .03, ampTau: .24, click: .3, drive: 3, asym: .15, lp: 5000, hp: 28, knock: .2, knockF: 1000, sub: .2}},
    kick_trap:  {inst: 'kick', p: {fStart: 260, fEnd: 55, tau: .016, ampHold: .01, ampTau: .075, click: .45, clickTau: .0008, drive: 2.2, lp: 9000, hp: 40, knock: .1, knockF: 2000}},
    // ---------------------------------------------------------------- snares and claps
    snare_crack:{inst: 'snare', p: {mode: 'snare', f1: 200, f2: 360, bodyTau: .06, noiseF: 3200, noiseQ: .7, noiseTau: .12, snap: .5, body: .9, noise: .9, drive: 1.8, hp: 150, lp: 9000}},
    snare_shot: {inst: 'snare', p: {mode: 'snare', f1: 320, f2: 540, bodyTau: .025, noiseF: 2600, noiseQ: .8, noiseTau: .06, snap: .8, body: 1, noise: .45, drive: 2.2, hp: 220, lp: 9500}},
    snare_trap: {inst: 'snare', p: {mode: 'snare', f1: 210, f2: 340, bodyTau: .045, noiseF: 5200, noiseQ: .7, noiseTau: .11, snap: .6, body: .75, noise: .85, drive: 1.7, hp: 260, lp: 13000}},
    snare_live: {inst: 'snare', p: {mode: 'snare', f1: 175, f2: 300, bodyTau: .09, noiseF: 3800, noiseQ: .6, noiseTau: .16, snap: .4, body: .8, noise: .8, drive: 1.2, hp: 110, lp: 9000}},
    clap_tight: {inst: 'snare', p: {mode: 'clap', noiseF: 1500, noiseQ: 1, noiseTau: .07, hp: 500, lp: 10000}},
    clap_big:   {inst: 'snare', p: {mode: 'clap', noiseF: 1250, noiseQ: .9, noiseTau: .17, hp: 350, lp: 9000, drive: 1.4}},
    clap_snap:  {inst: 'snare', p: {mode: 'clap', noiseF: 2400, noiseQ: 1.2, noiseTau: .03, hp: 900, lp: 11000}},
    // ---------------------------------------------------------------- hats
    hat_dust:   {inst: 'hat', p: {tune: .95, closedTau: .02, openTau: .15, bpF: 6500, hpF: 6000, air: .35, lp: 11000}},
    hat_crisp:  {inst: 'hat', p: {tune: 1.1, closedTau: .012, openTau: .14, bpF: 8500, hpF: 8000, air: .4, lp: 16000}},
    hat_jazz:   {inst: 'hat', p: {tune: .62, closedTau: .22, openTau: .5, bpF: 5000, hpF: 3500, air: .1, body: .4, lp: 11000}},
    // ---------------------------------------------------------------- procession band and primal drums
    dhol_low:   {inst: 'tom', p: {ratio: 1.35, pTau: .03, ampTau: .22, noise: .2, noiseTau: .02, lp: 2400}},
    dhol_high:  {inst: 'tom', p: {ratio: 1.25, pTau: .012, ampTau: .08, noise: .45, noiseTau: .012, lp: 4500}},
    tom_floor:  {inst: 'tom', p: {ratio: 1.7, pTau: .05, ampTau: .34, noise: .22, noiseTau: .03, lp: 3000}},
    tasha:      {inst: 'snare', p: {mode: 'snare', f1: 480, f2: 780, bodyTau: .03, noiseF: 3500, noiseQ: .9, noiseTau: .05, snap: .7, body: .8, noise: .7, drive: 1.5, hp: 400, lp: 10000}},
    // ---------------------------------------------------------------- 808s and basses
    boom_long:  {inst: 'boom', p: {decay: 1.6, ptau: .02, pitch: .9, glide: .06, drive: 2.6, lp: 900, gain: .95}},
    boom_drill: {inst: 'boom', p: {decay: 1.1, ptau: .015, pitch: 1.1, glide: .09, drive: 3.2, lp: 1100, gain: .9}},
    boom_soft:  {inst: 'boom', p: {decay: 2.2, ptau: .02, pitch: .5, glide: .08, drive: 1.3, lp: 420, gain: 1}},
    bass_short: {inst: 'bass', p: {sub: 1, subOct: 0, harm: .18, shape: 2, cutoff: 320, res: .1, keytrack: .4, envAmt: .9, fd: .12, fs: .1, aa: .004, ad: .2, as: .75, ar: .05, drive: 1.3, asym: .06, harmHP: 90, harmLP: 900, subLP: 170, glide: .02, gain: .95}},
    bass_funk:  {inst: 'bass', p: {sub: .72, subOct: 0, harm: .62, shape: 1.4, cutoff: 480, res: .22, keytrack: .5, envAmt: 1.7, fd: .09, fs: .12, aa: .002, ad: .16, as: .42, ar: .05, drive: 1.5, asym: .1, harmHP: 90, harmLP: 2400, subLP: 170, glide: .03, gain: .9}},
    bass_neo:   {inst: 'bass', p: {sub: .9, subOct: 0, harm: .34, shape: 1.8, cutoff: 360, res: .2, keytrack: .5, envAmt: 1.2, fd: .18, fs: .22, aa: .006, ad: .3, as: .7, ar: .08, drive: 1.3, asym: .08, harmHP: 100, harmLP: 1500, subLP: 170, glide: .075, gain: .92}},
    bass_stomp: {inst: 'bass', p: {sub: .85, subOct: 0, harm: .8, shape: 2, osc2: 3, cutoff: 420, res: .32, keytrack: .4, envAmt: 2.2, fd: .14, fs: .16, aa: .003, ad: .24, as: .55, ar: .07, drive: 3.4, asym: .2, harmHP: 150, harmLP: 2600, subLP: 150, glide: .04, gain: .78}},
    // ---------------------------------------------------------------- keys
    ep_tine:    {inst: 'modal', p: {kind: 'ep', sustain: .9, release: .22, lp: 5200, gain: 1.15, unisonCents: 1}},
    piano_honk: {inst: 'modal', p: {kind: 'piano', sustain: .8, bright: 1.05, thump: .05, release: .2, gain: 1, unisonCents: 4.5}},
    felt_soft:  {inst: 'modal', p: {kind: 'felt', sustain: 1, bright: .8, thump: .08, release: .4, gain: 1.2, unisonCents: 1.6}},
    harp_pluck: {inst: 'va', p: {shape1: 2, shape2: 1, osc2Level: .4, detune2: 4, drift: 1.5, filter: 'svf', cutoff: 1300, res: .08, keytrack: .7, envAmt: 2.2, fa: .001, fd: .16, fs: 0, fr: .2, aa: .001, ad: .7, as: 0, ar: .3, gain: .85}},
    stab_anthem:{inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .8, detune2: 11, unison: 3, spread: 28, uniPan: .85, drift: 3, cutoff: 1200, res: .14, keytrack: .4, envAmt: 1.3, fa: .002, fd: .22, fs: .35, fr: .15, aa: .004, ad: .22, as: .55, ar: .14, gain: .5}},
    brass_band: {inst: 'va', p: {shape1: 2, shape2: 3, pw: .42, osc2Level: .6, detune2: 13, unison: 3, spread: 30, uniPan: .5, drift: 7, cutoff: 780, res: .1, keytrack: .5, envAmt: 1.7, fa: .025, fd: .24, fs: .55, fr: .15, aa: .014, ad: .22, as: .72, ar: .1, vib: 14, vibDelay: .18, vibRate: 5.8, gain: .5}},
    // ---------------------------------------------------------------- leads
    sax_tenor:  {inst: 'mono', p: {shape1: 2, shape2: 3, pw: .36, osc2Level: .35, detune2: 5, drift: 3, noise: .03, cutoff: 760, res: .22, keytrack: .55, envAmt: 1.4, velEnv: 1.2, fa: .02, fd: .22, fs: .45, fr: .15, aa: .024, ad: .3, as: .8, ar: .09, vib: 13, vibDelay: .28, vibRate: 5.2, glide: .035, legato: true, gain: .58}},
    bansuri:    {inst: 'mono', p: {shape1: .18, shape2: 1, osc2Level: .16, detune2: 3, drift: 4, noise: .045, filter: 'svf', cutoff: 3400, res: .04, keytrack: .4, aa: .055, ad: .25, as: .86, ar: .16, vib: 20, vibDelay: .22, vibRate: 5.5, glide: .055, legato: true, gain: .78}},
    horn_lead:  {inst: 'mono', p: {shape1: 2, shape2: 2, osc2Level: .7, detune2: 9, drift: 7, cutoff: 820, res: .12, keytrack: .5, envAmt: 1.6, fa: .02, fd: .2, fs: .5, fr: .12, aa: .012, ad: .2, as: .78, ar: .08, vib: 18, vibDelay: .16, vibRate: 6, glide: .03, legato: true, gain: .55}},
    saw_big:    {inst: 'mono', p: {shape1: 2, shape2: 2, osc2Level: .85, detune2: 12, drift: 4, cutoff: 1500, res: .14, keytrack: .4, envAmt: .9, fa: .004, fd: .3, fs: .55, fr: .15, aa: .004, ad: .3, as: .8, ar: .12, vib: 7, vibDelay: .4, vibRate: 5, glide: .02, legato: true, gain: .5}},
    strings_hi: {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .7, detune2: 10, unison: 3, spread: 15, uniPan: .8, drift: 5, filter: 'svf', cutoff: 2100, res: .06, keytrack: .4, envAmt: .35, fa: .4, fd: 1, fs: .7, fr: .5, aa: .2, ad: .7, as: .85, ar: .55, vib: 7, vibDelay: .5, vibRate: 5, gain: .42}},
    found_kit:  {inst: 'found', p: {}},
    chop_main:  {inst: 'chop', p: {}}
  });

  // ---------------------------------------------------------------- found-sound percussion
  // kinds: grinder (pepper grinder ticks) · bottle (shaken water) · clink (glass on glass) · tap (finger on a skin) · crumple (cracker box)
  A.FoundVoice = class { constructor(sr, seed){ this.sr = sr; this.nz = new A.Noise(seed * 7 + 41); this.a = new A.SVF(); this.b = new A.SVF(); this.c = new A.SVF(); this.r = A.rng(seed * 11 + 5); this.ph = 0; }
    start(off, ev){ const sr = this.sr, r = this.r, k = this.kind = ev.kindF || 'tap'; this.off = off; this.i = 0; this.vel = ev.vel === undefined ? .7 : ev.vel; this.imp = 0; this.ph = 0; this.a.reset(); this.b.reset(); this.c.reset();
      const J = 1 + (r() - .5) * .16;
      if (k === 'grinder'){ this.len = .13 * J * sr; this.rate = 160 / sr; this.a.set(6200 * J, 1.4, sr); this.b.set(3100 * J, 1.1, sr); }
      else if (k === 'bottle'){ this.len = .16 * J * sr; this.rate = 90 / sr; this.a.set(1500 * J, 2.2, sr); this.b.set(3100 * J, 1.4, sr); this.f = 900 * J; }
      else if (k === 'clink'){ this.len = .24 * sr; this.a.set(2840 * J, 34, sr); this.b.set(5210 * J, 30, sr); this.c.set(7360 * J, 24, sr); }
      else if (k === 'crumple'){ this.len = .09 * J * sr; this.rate = 300 / sr; this.a.set(1400 * J, .9, sr); this.b.set(3600 * J, .8, sr); }
      else { this.len = .16 * sr; this.f = (ev.freq || 245) * J; this.a.set(2100, .8, sr); } }
    render(L, R, n){ const sr = this.sr, k = this.kind, g = this.vel, N = this.len; let i0 = this.off; this.off = 0;
      for (let s = i0; s < n; s++){ const i = this.i++; if (i >= N) return false; const q = i / N; let y = 0;
        if (k === 'grinder' || k === 'crumple' || k === 'bottle'){ if (this.nz.white() * .5 + .5 < this.rate * (k === 'bottle' ? 1 + 3 * Math.sin(q * 9.4) * Math.sin(q * 9.4) : 1)) this.imp = (this.nz.white() * .5 + .5) * 1.6; else this.imp *= k === 'crumple' ? .7 : .84;
          const w = this.nz.white() * this.imp; this.a.run(w); this.b.run(w); const env = Math.sin(Math.min(1, q * 1.15) * Math.PI);
          y = (this.a.bp * .9 + this.b.bp * .45) * env;
          if (k === 'bottle'){ this.ph += this.f * (1 + q * 1.6) / sr; if (this.ph >= 1) this.ph -= 1; y += A.sin1(this.ph) * this.imp * .12 * env; } }
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

  // ---------------------------------------------------------------- chop sampler: plays slices of a pressed record, one mute group like an MPC pad bank
  A.ChopVoice = class { constructor(sr){ this.sr = sr; this.atk = Math.round(.0015 * sr); this.relN = Math.round(.012 * sr); }
    start(off, ev, rec){ this.off = off; this.rec = rec; this.pos = ev.pos || 0; this.left = Math.max(32, Math.round((ev.dur || .3) * this.sr)); this.rate = Math.pow(2, (ev.semi || 0) / 12) * (ev.rev ? -1 : 1); this.vel = ev.vel === undefined ? .8 : ev.vel; this.i = 0; this.relI = -1; }
    choke(){ if (this.relI < 0) this.relI = 0; }
    render(L, R, n){ const rec = this.rec; if (!rec) return false; const BL = rec.L, BR = rec.R, N = BL.length, rate = this.rate, g = this.vel, relN = this.relN, atk = this.atk; let i0 = this.off, p = this.pos; this.off = 0;
      for (let s = i0; s < n; s++){ let a = this.i < atk ? this.i / atk : 1; this.i++; if (this.relI < 0 && --this.left <= 0) this.relI = 0; if (this.relI >= 0){ a *= 1 - this.relI / relN; if (++this.relI >= relN){ this.pos = p; return false; } }
        let q = p % N; if (q < 0) q += N; const j = q | 0, f = q - j, j2 = j + 1 >= N ? 0 : j + 1; L[s] += (BL[j] + (BL[j2] - BL[j]) * f) * a * g * this.gl; R[s] += (BR[j] + (BR[j2] - BR[j]) * f) * a * g * this.gr; p += rate; }
      this.pos = p; return true; } };
  A.ChopInst = class { constructor(sr, rec){ this.sr = sr; this.rec = rec; this.patch = {}; this.var = 1; this.pool = new A.Pool(() => new A.ChopVoice(sr), 5); this.pend = []; this.last = null; }
    play(off, ev){ this.pend.push({off, ev}); }
    doPlay(off, ev){ if (!this.rec) return; if (this.last && this.last.on && !ev.layer) this.last.choke(); const v = this.pool.get(); v.start(off, ev, this.rec); A.panTo(v, ev.pan); this.last = v; }
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

  // ---------------------------------------------------------------- an imaginary record, pressed offline
  // A chop only sounds like a chop if the source has its own room, its tail bleeds across the cuts and it was sped up. So: a short
  // band take of the song's chord loop is rendered (twice round, second pass kept so tails wrap), filtered like vinyl, then sped up.
  const CELLS = {soul: [[0, 6, 10], [0, 3, 8, 11], [0, 7, 10, 14], [2, 6, 8, 12]], gospel: [[0, 8], [0, 6, 12], [0, 10]], jazz: [[0, 3, 7, 11], [2, 7, 10], [0, 6, 9, 14]], band: [[0, 3, 6, 8, 11, 14], [0, 4, 6, 10, 12], [0, 3, 8, 11]], felt: [[0, 4, 8, 12], [0, 6, 10], [0, 3, 8]]};
  A.pressRecord = function(spec, sr){ sr = sr || 48000; const kind = spec.kind || 'soul', semis = spec.semis || 0, rate = Math.pow(2, semis / 12), bpmS = spec.bpm / rate, r = A.rng(A.hash(spec.seed, 'press', kind)), barS = 240 / bpmS, stepS = barS / 16;
    const loop = spec.chords, loopBars = loop.reduce((a, c) => a + c.bars, 0), passSec = loopBars * barS, tailSec = 2, totalSec = passSec * 2 + tailSec, N = Math.ceil(totalSec * sr), BL = 128;
    const mk = (V, n, name, over) => new A.PolyInst(sr, V, n, Object.assign({}, A.PATCH[name].p, over || {}), A.hash(spec.seed, name) & 0xffff);
    const layers = [], layer = (inst, gain, plate) => { const l = {inst, gain, plate, ev: []}; layers.push(l); return l; };
    let ep = null, str = null, cho = null, mel = null;
    if (kind === 'soul'){ ep = layer(mk(A.ModalVoice, 18, 'ep_tine'), .8, .16); str = layer(mk(A.VAVoice, 12, 'strings_hi', {cutoff: 1500, gain: .34}), .5, .3); cho = layer(mk(A.ChoirVoice, 8, 'choir', {aa: .35, ar: .7, gain: .55}), .55, .4); }
    else if (kind === 'gospel'){ ep = layer(mk(A.OrganVoice, 16, 'organ_soft', {aa: .02, ar: .25}), .6, .22); cho = layer(mk(A.ChoirVoice, 10, 'choir', {aa: .22, ar: .5, gain: .8}), .9, .45); str = layer(mk(A.ModalVoice, 14, 'piano_honk'), .55, .2); }
    else if (kind === 'jazz'){ ep = layer(mk(A.ModalVoice, 18, 'piano_honk'), .85, .18); str = layer(mk(A.VAVoice, 8, 'strings_hi', {cutoff: 1100, gain: .2}), .35, .3); mel = layer(mk(A.VAVoice, 2, 'sax_tenor'), .55, .28); }
    else if (kind === 'band'){ ep = layer(mk(A.VAVoice, 16, 'brass_band'), .85, .18); mel = layer(mk(A.VAVoice, 3, 'horn_lead'), .62, .22); }
    else { ep = layer(mk(A.ModalVoice, 18, 'felt_soft'), .95, .24); str = layer(mk(A.VAVoice, 8, 'strings_hi', {cutoff: 900, gain: .22}), .4, .35); }
    const add = (l, t, ev) => { if (l) l.ev.push({t, ev}); };
    const cell = () => r.pick(CELLS[kind] || CELLS.soul), cellA = cell(), cellB = cell(); const chordAt = [], hits = []; let t0 = 0;
    for (let pass = 0; pass < 2; pass++){ let barIdx = 0; for (let ci = 0; ci < loop.length; ci++){ const c = loop[ci]; if (!pass){ chordAt.push(barIdx); hits.push([]); }
        const notes = c.notes.map(m => m - semis), durHold = c.bars * barS;
        for (let b = 0; b < c.bars; b++){ const bar0 = t0 + (barIdx + b) * barS, ce = (barIdx + b) % 2 ? cellB : cellA;
          for (const s0 of ce){ const s = s0 + (s0 % 2 ? .28 : 0), t = bar0 + s * stepS, vel = (s0 % 8 === 0 ? .72 : .58) + r() * .12, len = stepS * (kind === 'band' ? 1.6 : kind === 'felt' ? 7 : 3.4);
            notes.forEach((m, i) => add(ep, t + i * .007 + (r() - .5) * .004, {note: m, vel, dur: len})); if (!pass) hits[ci].push(b * 16 + s0); } }
        if (str) notes.forEach(m => add(str, t0 + barIdx * barS + r() * .02, {note: m + (kind === 'gospel' ? 0 : 12), vel: .5, dur: durHold * .98}));
        if (cho){ const top = notes[notes.length - 1]; add(cho, t0 + barIdx * barS + .02, {note: top, vel: .6, dur: durHold * .9}); if (notes.length > 2) add(cho, t0 + barIdx * barS + .05, {note: notes[1], vel: .4, dur: durHold * .9}); }
        if (mel){ const top = notes[notes.length - 1], pts = [0, 3, 6, 10, 12]; pts.forEach((s, i) => { if (r() < .6) add(mel, t0 + (barIdx + (i > 3 ? 0 : 0)) * barS + s * stepS, {note: notes[(i * 2) % notes.length] + 12, vel: .55 + r() * .2, dur: stepS * (i === 4 ? 3 : 1.6)}); }); void top; }
        barIdx += c.bars; }
      t0 += passSec; }
    layers.forEach(l => l.ev.sort((a, b) => a.t - b.t));
    // the room
    const plate = new A.Plate(sr); plate.set({decay: .62, damping: .5, predelay: .012, inHP: 280, outLP: 6500}); const OL = new Float32Array(N), OR = new Float32Array(N), bl = new Float32Array(BL), br = new Float32Array(BL), sl = new Float32Array(BL), sr2 = new Float32Array(BL), rl = new Float32Array(BL), rr = new Float32Array(BL), idx = layers.map(() => 0);
    for (let p = 0; p < N; p += BL){ const n = Math.min(BL, N - p), tEnd = (p + n) / sr; sl.fill(0); sr2.fill(0); rl.fill(0); rr.fill(0); for (let li = 0; li < layers.length; li++){ const l = layers[li]; while (idx[li] < l.ev.length && l.ev[idx[li]].t < tEnd){ const e = l.ev[idx[li]++]; l.inst.play(Math.max(0, Math.min(n - 1, Math.round(e.t * sr) - p)), e.ev); } bl.fill(0); br.fill(0); l.inst.render(bl, br, n); for (let i = 0; i < n; i++){ const a = bl[i] * l.gain, b = br[i] * l.gain; OL[p + i] += a; OR[p + i] += b; sl[i] += a * l.plate; sr2[i] += b * l.plate; } }
      plate.process(sl, sr2, rl, rr, n); for (let i = 0; i < n; i++){ OL[p + i] += rl[i]; OR[p + i] += rr[i]; } }
    // the vinyl: band-limit, tape saturation, narrow stereo, wow, crackle
    const hpL = new A.SVF(), hpR = new A.SVF(), lpL = new A.SVF(), lpR = new A.SVF(), lo = spec.hp || 180, hi = spec.lp || (kind === 'band' ? 7800 : 6800); hpL.set(lo, .7, sr); hpR.set(lo, .7, sr); lpL.set(hi, .7, sr); lpR.set(hi, .7, sr); const nz = new A.Noise(A.hash(spec.seed, 'vinyl') | 1); let pop = 0, pk = 1e-6;
    const wowD = Math.round(.004 * sr); for (let i = 0; i < N; i++){ const m = (OL[i] + OR[i]) * .5, s = (OL[i] - OR[i]) * .5 * .55; let a = m + s, b = m - s; hpL.run(a); a = hpL.hp; hpR.run(b); b = hpR.hp; a = lpL.tick(a); b = lpR.tick(b); a = tanh(a * 1.5); b = tanh(b * 1.5); if (nz.white() > .9996) pop = nz.white(); pop *= .55; a += pop * .05; b += pop * .04; OL[i] = a; OR[i] = b; const q = Math.abs(a) > Math.abs(b) ? Math.abs(a) : Math.abs(b); if (q > pk) pk = q; }
    void wowD;
    // speed the record up: read the second pass at `rate` (with slow wow), into a loop exactly one playback pass long
    const outN = Math.round(passSec / rate * sr), L = new Float32Array(outN), R = new Float32Array(outN), start = passSec * sr, norm = .72 / pk, wr = (spec.wow === undefined ? .0016 : spec.wow), wf = .55 + r() * .3; let ph = r();
    for (let i = 0; i < outN; i++){ ph += wf / sr; const w = Math.sin(ph * TAU) * wr * sr * .05, q = start + i * rate + w, j = Math.floor(q), f = q - j, j1 = Math.min(N - 1, j + 1), j0 = Math.min(N - 1, Math.max(0, j)); L[i] = (OL[j0] + (OL[j1] - OL[j0]) * f) * norm; R[i] = (OR[j0] + (OR[j1] - OR[j0]) * f) * norm; }
    const barN = outN / loopBars, chordPos = chordAt.map(b => b * barN); return {L, R, barN, chordPos, chordBars: loop.map(c => c.bars), hits, n: outN, kind, semis}; };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_B_SOUNDS;
