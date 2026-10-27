/* Maut ki Awaaz — engine module: tracks, buses, sends, sidechain, master.
   track → [HP → LP → drive → chorus → haas] → gain/pan/width → bus (drums | bass | music); post-fader sends → plate, hall, delay.
   Ducking is deterministic (kick events, research/03 §6.11) and only touches the low end: bass bus fully, reverb returns lightly.
   Master: tilt shelves → glue → tape → mono below ~120 Hz → loudness auto-gain → look-ahead limiter (−1 dBTP-ish ceiling). */
'use strict';
function AWZ_MIXER(A){
  const clamp = A.clamp, BLK = 128;
  A.AEQ_F = [45, 110, 300, 1000, 3200, 9000];
  A.AEQ_TARGET = A.AEQ_TARGET || [0, 0, 0, 0, 0, 0];   // overwritten by 58-target.js (tools/target.js measures the reference set)
  A.Track = class { constructor(sr, name, bus, inst, o){ o = o || {}; this.sr = sr; this.name = name; this.bus = bus; this.inst = inst; this.L = new Float32Array(BLK); this.R = new Float32Array(BLK);
      this.gain = new A.Smooth(A.dbToGain(o.db || 0), .05, sr / BLK); this.pan = o.pan || 0; this.width = o.width === undefined ? 1 : o.width;
      this.hpL = new A.SVF(); this.hpR = new A.SVF(); this.lpL = new A.SVF(); this.lpR = new A.SVF(); this.hpF = o.hp || 0; this.lpF = o.lp || 0; this.drive = o.drive || 0;
      this.chorus = o.chorus ? new A.JunoChorus(sr) : null; if (this.chorus) this.chorus.set(o.chorus); this.haas = o.haas ? new A.Haas(sr) : null; if (this.haas) this.haas.set(o.haas);
      this.send = {plate: o.plate || 0, hall: o.hall || 0, delay: o.delay || 0}; this.mute = false; this.solo = false; this.peak = 0; this.rms = 0; this.active = false; this.fade = 1; this.duck = o.duck || 0; this.id = o.id || 0;
      this.eq = (o.eq || []).map(([fc, db, q]) => { const a = new A.SVF(), b = new A.SVF(); a.set(fc, q || .8, sr); b.set(fc, q || .8, sr); return {a, b, g: A.dbToGain(db) - 1}; }); }
    process(n){ const L = this.L, R = this.R; L.fill(0, 0, n); R.fill(0, 0, n); this.active = this.inst.render(L, R, n); const sr = this.sr;
      if (this.hpF){ this.hpL.set(this.hpF, .7, sr); this.hpR.set(this.hpF, .7, sr); for (let i = 0; i < n; i++){ this.hpL.tick(L[i]); L[i] = this.hpL.hp; this.hpR.tick(R[i]); R[i] = this.hpR.hp; } }
      if (this.lpF){ this.lpL.set(this.lpF, .7, sr); this.lpR.set(this.lpF, .7, sr); for (let i = 0; i < n; i++){ L[i] = this.lpL.tick(L[i]); R[i] = this.lpR.tick(R[i]); } }
      for (const e of this.eq){ const a = e.a, b = e.b, g = e.g * a.k; for (let i = 0; i < n; i++){ a.tick(L[i]); L[i] += g * a.bp; b.tick(R[i]); R[i] += g * b.bp; } }   // bells: x + (G-1)·k·bp
      if (this.drive > 0){ const d = 1 + this.drive * 3, nm = 1 / A.tanh(d); for (let i = 0; i < n; i++){ L[i] = A.tanh(L[i] * d) * nm; R[i] = A.tanh(R[i] * d) * nm; } }
      if (this.chorus) this.chorus.process(L, R, n); if (this.haas) this.haas.process(L, R, n);
      const g = this.gain.tick() * (this.mute ? 0 : 1) * this.fade, p = clamp(this.pan, -1, 1), gl = Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2 * g, gr = Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2 * g, w = this.width;
      let pk = 0, ss = 0;
      for (let i = 0; i < n; i++){ let l = L[i], r = R[i]; if (w !== 1){ const m = (l + r) * .5, s = (l - r) * .5 * w; l = m + s; r = m - s; } l *= gl; r *= gr; L[i] = l; R[i] = r; const a = Math.max(Math.abs(l), Math.abs(r)); if (a > pk) pk = a; ss += l * l + r * r; }
      this.peak = Math.max(pk, this.peak * .9); this.rms = Math.sqrt(ss / (2 * n)); } };

  A.Mixer = class { constructor(sr){ this.sr = sr; this.tracks = [];
      const z = () => new Float32Array(BLK); this.bus = {drums: [z(), z()], bass: [z(), z()], music: [z(), z()]}; this.sendBuf = {plate: [z(), z()], hall: [z(), z()], delay: [z(), z()]}; this.ret = {plate: [z(), z()], hall: [z(), z()], delay: [z(), z()]};
      this.plate = new A.Plate(sr); this.hall = new A.Hall(sr, 11); this.delay = new A.TapeDelay(sr); this.retGain = {plate: new A.Smooth(1, .2, sr / BLK), hall: new A.Smooth(1, .2, sr / BLK), delay: new A.Smooth(1, .2, sr / BLK)};
      this.drumGlue = new A.Glue(sr); this.drumGlue.set({threshold: -20, ratio: 3, attack: .015, release: .12, scHP: 60});
      this.musicSat = new A.TapeSat(sr); this.musicSat.set({drive: 1.15, bias: .05, lp: 16000, mix: 1});
      this.lsL = new A.SVF(); this.lsR = new A.SVF(); this.hsL = new A.SVF(); this.hsR = new A.SVF(); this.monoLo = new A.SVF();
      this.glue = new A.Glue(sr); this.glue.set({threshold: -16, ratio: 2, attack: .03, release: .25, knee: 6, scHP: 90});
      this.tape = new A.TapeSat(sr); this.tape.set({drive: 1.1, bias: .04, lp: 17000, mix: .6});
      this.loud = new A.Loudness(sr); this.lim = new A.Limiter(sr, .002); this.lim.set({ceiling: A.dbToGain(-1.2), release: .1});
      this.autoGain = 1; this.target = -11; this.autoOn = true; this.agK = 1 - Math.exp(-1 / (2.5 * sr / BLK)); this.master = new A.Smooth(1, .05, sr / BLK);
      this.kicks = []; this.duckDepth = {bass: 10, ret: 3, music: 0}; this.duckRel = .16; this.tiltLow = 1; this.tiltHigh = 0; this.musicLP = new A.Smooth(20000, .08, sr / BLK); this.mLPL = new A.SVF(); this.mLPR = new A.SVF();
      this.preL = 0; this.grMaster = 0; this.outPeak = 0; this.crush = 0; this.chL = 0; this.chR = 0; this.chC = 0; this.phaser = new A.Phaser(sr); this.phaserMix = 0;
      this.mBells = [[300, -4, .8], [1000, -2, .7]].map(([fc, db, q]) => ({fc, db, q, a: new A.SVF(), b: new A.SVF()})); this.setMusicEQ();
      // loudness reference = slow peak-hold of short-term loudness → quiet sections stay quiet, the arc survives normalisation
      this.lref = -20; this.lrefDecay = .04; this.maxBoost = A.dbToGain(14);
      // auto-EQ toward the reference balance (research/06): 6 octave-ish band meters on the pre-tilt sum, slow bounded bells
      this.aeq = {on: true, gate: 1, f: A.AEQ_F, target: A.AEQ_TARGET.slice(), meas: new Float64Array(6).fill(1e-9), g: new Float64Array(6), bpm: [], bl: [], br: [], k: 1 - Math.exp(-BLK / (3 * sr)), kg: 1 - Math.exp(-BLK / (20 * sr)), max: 6};
      A.AEQ_F.forEach((f, i) => { const m = new A.SVF(); m.set(f, 1.3, sr); this.aeq.bpm.push(m); const a = new A.SVF(), b = new A.SVF(); a.set(f, i === 0 || i === 5 ? .6 : .9, sr); b.set(f, i === 0 || i === 5 ? .6 : .9, sr); this.aeq.bl.push(a); this.aeq.br.push(b); }); }
    setMusicEQ(arr){ if (arr) arr.forEach((v, i) => { if (this.mBells[i]) Object.assign(this.mBells[i], {fc: v[0], db: v[1], q: v[2] || this.mBells[i].q}); });
      for (const e of this.mBells){ e.a.set(e.fc, e.q, this.sr); e.b.set(e.fc, e.q, this.sr); e.g = A.dbToGain(e.db) - 1; } }
    add(t){ this.tracks.push(t); return t; }
    kickAt(sampleTime){ this.kicks.push(sampleTime); if (this.kicks.length > 8) this.kicks.shift(); }
    duckGain(t, depthDb){ // deterministic ease-out duck from the most recent kick at or before t
      let k = -1e12; for (let i = this.kicks.length - 1; i >= 0; i--) if (this.kicks[i] <= t){ k = this.kicks[i]; break; }
      const dt = (t - k) / this.sr, atk = .004, hold = .025, rel = this.duckRel;   // 4 ms attack: a sub-ms gain step on a sine is itself a click
      if (dt < 0 || dt > atk + hold + rel) return 1;
      let x; if (dt < atk){ const q = dt / atk; x = q * q * (3 - 2 * q); } else if (dt < atk + hold) x = 1; else { const q = (dt - atk - hold) / rel; x = 1 - (1 - Math.pow(1 - q, 2.2)); }
      return Math.pow(10, -depthDb * x / 20); }
    process(oL, oR, n, t0){ const B = this.bus, S = this.sendBuf, sr = this.sr;
      for (const k in B){ B[k][0].fill(0, 0, n); B[k][1].fill(0, 0, n); } for (const k in S){ S[k][0].fill(0, 0, n); S[k][1].fill(0, 0, n); this.ret[k][0].fill(0, 0, n); this.ret[k][1].fill(0, 0, n); }
      const anySolo = this.tracks.some(t => t.solo);
      for (const t of this.tracks){ t.process(n); if (anySolo && !t.solo) continue; const b = B[t.bus];
        for (let i = 0; i < n; i++){ b[0][i] += t.L[i]; b[1][i] += t.R[i]; }
        for (const s in t.send){ const g = t.send[s]; if (!g) continue; const sb = S[s]; for (let i = 0; i < n; i++){ sb[0][i] += t.L[i] * g; sb[1][i] += t.R[i] * g; } } }
      // FX returns
      this.plate.process(S.plate[0], S.plate[1], this.ret.plate[0], this.ret.plate[1], n);
      this.hall.process(S.hall[0], S.hall[1], this.ret.hall[0], this.ret.hall[1], n);
      this.delay.process(S.delay[0], S.delay[1], this.ret.delay[0], this.ret.delay[1], n);
      // buses
      this.drumGlue.process(B.drums[0], B.drums[1], n);
      const mlp = this.musicLP.tick(); if (mlp < 19000){ this.mLPL.set(mlp, .7, sr); this.mLPR.set(mlp, .7, sr); for (let i = 0; i < n; i++){ B.music[0][i] = this.mLPL.tick(B.music[0][i]); B.music[1][i] = this.mLPR.tick(B.music[1][i]); } }
      this.musicSat.process(B.music[0], B.music[1], n);
      for (const e of this.mBells){ if (!e.g) continue; const a = e.a, b = e.b, g = e.g * a.k, ML = B.music[0], MR = B.music[1]; for (let i = 0; i < n; i++){ a.tick(ML[i]); ML[i] += g * a.bp; b.tick(MR[i]); MR[i] += g * b.bp; } }
      if (this.phaserMix > .01) this.phaser.process(B.music[0], B.music[1], n);
      if (this.crush > .01){ const hold = 1 + Math.floor(this.crush * 5), q = Math.pow(2, 15 - this.crush * 9), mix = this.crush * .6, ML = B.music[0], MR = B.music[1];   // lo-fi: sample-rate + bit reduction (Y = broken)
        for (let i = 0; i < n; i++){ if (++this.chC >= hold){ this.chC = 0; this.chL = Math.round(ML[i] * q) / q; this.chR = Math.round(MR[i] * q) / q; } ML[i] += (this.chL - ML[i]) * mix; MR[i] += (this.chR - MR[i]) * mix; } }
      const rp = this.retGain.plate.tick(), rh = this.retGain.hall.tick(), rd = this.retGain.delay.tick(), dB = this.duckDepth;
      this.lsL.set(140, .7, sr); this.lsR.set(140, .7, sr); this.hsL.set(5500, .7, sr); this.hsR.set(5500, .7, sr); this.monoLo.set(120, .7, sr);
      const lowG = this.tiltLow - 1, hiG = Math.pow(10, this.tiltHigh / 20) - 1, Q = this.aeq, acc = [0, 0, 0, 0, 0, 0], G = Q.lin || (Q.lin = new Float64Array(6));
      for (let i = 0; i < n; i++){ const t = t0 + i, gB = this.duckGain(t, dB.bass), gR = this.duckGain(t, dB.ret);
        let l = B.drums[0][i] + B.bass[0][i] * gB + B.music[0][i] + (this.ret.plate[0][i] * rp + this.ret.hall[0][i] * rh + this.ret.delay[0][i] * rd) * gR;
        let r = B.drums[1][i] + B.bass[1][i] * gB + B.music[1][i] + (this.ret.plate[1][i] * rp + this.ret.hall[1][i] * rh + this.ret.delay[1][i] * rd) * gR;
        if (Q.on){ const mono = (l + r) * .5; for (let b = 0; b < 6; b++){ const m = Q.bpm[b]; m.tick(mono); acc[b] += m.bp * m.bp; const gg = G[b]; if (gg){ const a = Q.bl[b], c = Q.br[b]; a.tick(l); c.tick(r); l += gg * a.k * a.bp; r += gg * c.k * c.bp; } } }
        this.lsL.tick(l); this.lsR.tick(r); l += this.lsL.lp * lowG; r += this.lsR.lp * lowG; this.hsL.tick(l); this.hsR.tick(r); l += this.hsL.hp * hiG; r += this.hsR.hp * hiG;
        // mono below ~120 Hz: remove the low side component
        const s = (l - r) * .5; this.monoLo.tick(s); l -= this.monoLo.lp; r += this.monoLo.lp;
        oL[i] = l; oR[i] = r; }
      if (Q.on){ let tot = 0; for (let b = 0; b < 6; b++){ Q.meas[b] += (acc[b] / n + 1e-12 - Q.meas[b]) * Q.k; tot += Q.meas[b]; }
        // adapt only while the music is substantial (gate set by the engine from energy; quiet intros/breaks keep their colour)
        if (Q.gate > 0 && tot > 1e-7){ const d = []; let mean = 0; for (let b = 0; b < 6; b++){ d[b] = 10 * Math.log10(Q.meas[b]) - Q.target[b]; mean += d[b] / 6; }
          for (let b = 0; b < 6; b++){ const want = clamp(-(d[b] - mean) * .75, -Q.max, Q.max * .7); Q.g[b] += (want - Q.g[b]) * Q.kg * Q.gate; } }
        for (let b = 0; b < 6; b++) G[b] = Math.pow(10, Q.g[b] / 20) - 1; }
      this.grMaster = this.glue.process(oL, oR, n); this.tape.process(oL, oR, n);
      this.loud.process(oL, oR, n);
      if (this.autoOn){ const st = this.loud.filled > 5 ? this.loud.lufs : -70, dt = n / sr;
        if (st > this.lref) this.lref += (st - this.lref) * (1 - Math.exp(-dt / 1.5)); else this.lref -= this.lrefDecay * dt;
        const want = clamp(Math.pow(10, (this.target - this.lref) / 20), .05, this.maxBoost); this.autoGain += (want - this.autoGain) * this.agK; }
      const g = this.autoGain * this.master.tick(); for (let i = 0; i < n; i++){ oL[i] *= g; oR[i] *= g; }
      this.lim.process(oL, oR, n); let pk = 0; for (let i = 0; i < n; i++){ const a = Math.max(Math.abs(oL[i]), Math.abs(oR[i])); if (a > pk) pk = a; } this.outPeak = pk; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_MIXER;
