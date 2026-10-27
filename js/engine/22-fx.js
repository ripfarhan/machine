/* Maut ki Awaaz — engine module: effects. Block processors: process(inL, inR, outL, outR, n) ADD into out unless noted.
   Constants: research/03 §6 (Dattorro 1997 plate, Signalsmith FDN, Juno-60 chorus, tape delay, limiter). */
'use strict';
function AWZ_FX(A){
  const TAU = A.TAU, tanh = A.tanh, clamp = A.clamp;
  // integer delay line with power-of-two mask (fast)
  class Line { constructor(n){ let s = 1; while (s < n + 2) s <<= 1; this.b = new Float32Array(s); this.m = s - 1; this.w = 0; }
    push(x){ this.b[this.w] = x; this.w = (this.w + 1) & this.m; }
    tap(d){ return this.b[(this.w - 1 - d) & this.m]; }
    tapf(d){ const p = this.w - 1 - d, i = Math.floor(p), f = p - i, m = this.m; const a = this.b[i & m], b = this.b[(i + 1) & m]; return a + (b - a) * f; } }
  A.Line = Line;

  // ---------------------------------------------------------------- Dattorro plate
  A.Plate = class { constructor(sr){ this.sr = sr; const S = n => Math.max(1, Math.round(n * sr / 29761)); this.S = S;
      this.pre = new Line(Math.round(.12 * sr)); this.ap = [142, 107, 379, 277].map(n => new Line(S(n))); this.apN = [142, 107, 379, 277].map(S);
      this.mL = new Line(S(672) + 64); this.dL1 = new Line(S(4453)); this.aL = new Line(S(1800)); this.dL2 = new Line(S(3720));
      this.mR = new Line(S(908) + 64); this.dR1 = new Line(S(4217)); this.aR = new Line(S(2656)); this.dR2 = new Line(S(3163));
      this.n = {m672: S(672), m908: S(908), d4453: S(4453), a1800: S(1800), d3720: S(3720), d4217: S(4217), a2656: S(2656), d3163: S(3163)};
      this.t = {L: [S(266), S(2974), S(1913), S(1996), S(1990), S(187), S(1066)], R: [S(353), S(3627), S(1228), S(2673), S(2111), S(335), S(121)]};
      this.bw = 0; this.dpL = 0; this.dpR = 0; this.fbL = 0; this.fbR = 0; this.lfo = 0; this.hp = new A.OnePole(); this.lpL = new A.SVF(); this.lpR = new A.SVF();
      this.set({}); }
    set(o){ this.decay = o.decay === undefined ? .7 : o.decay; this.damping = o.damping === undefined ? .35 : o.damping; this.bandwidth = o.bandwidth === undefined ? .8 : o.bandwidth;
      this.preD = Math.round((o.predelay === undefined ? .02 : o.predelay) * this.sr); this.exc = (o.excursion === undefined ? 16 : o.excursion) * this.sr / 29761; this.rate = o.rate === undefined ? .6 : o.rate;
      this.hp.setLP(o.inHP || 200, this.sr); this.lpL.set(o.outLP || 7500, .6, this.sr); this.lpR.set(o.outLP || 7500, .6, this.sr); this.gain = o.gain === undefined ? 1 : o.gain; }
    process(inL, inR, oL, oR, n){ const ap = this.ap, N = this.apN, nn = this.n, decay = this.decay, dd2 = clamp(decay + .15, .25, .5), damp = this.damping, bw = this.bandwidth, g = this.gain * .6, sr = this.sr;
      const tL = this.t.L, tR = this.t.R;
      for (let i = 0; i < n; i++){ let x = (inL[i] + inR[i]) * .5; x = this.hp.hp(x);
        this.pre.push(x); x = this.pre.tap(this.preD);
        this.bw += bw * (x - this.bw); x = this.bw;
        for (let k = 0; k < 4; k++){ const gk = k < 2 ? .75 : .625, L = ap[k], d = L.tap(N[k] - 1), w = x - gk * d; L.push(w); x = d + gk * w; }
        this.lfo += this.rate / sr; if (this.lfo >= 1) this.lfo -= 1; const ex1 = this.exc * A.sin1(this.lfo), ex2 = this.exc * A.sin1(this.lfo + .25);
        // left half
        let a = x + this.fbR * decay; { const L = this.mL, d = L.tapf(nn.m672 - 1 + ex1 + this.exc), w = a + .7 * d; L.push(w); a = d - .7 * w; }
        this.dL1.push(a); let b = this.dL1.tap(nn.d4453 - 1); this.dpL = b * (1 - damp) + this.dpL * damp; b = this.dpL * decay;
        { const L = this.aL, d = L.tap(nn.a1800 - 1), w = b - dd2 * d; L.push(w); b = d + dd2 * w; }
        this.dL2.push(b); this.fbL = this.dL2.tap(nn.d3720 - 1);
        // right half
        let c = x + this.fbL * decay; { const L = this.mR, d = L.tapf(nn.m908 - 1 + ex2 + this.exc), w = c + .7 * d; L.push(w); c = d - .7 * w; }
        this.dR1.push(c); let e = this.dR1.tap(nn.d4217 - 1); this.dpR = e * (1 - damp) + this.dpR * damp; e = this.dpR * decay;
        { const L = this.aR, d = L.tap(nn.a2656 - 1), w = e - dd2 * d; L.push(w); e = d + dd2 * w; }
        this.dR2.push(e); this.fbR = this.dR2.tap(nn.d3163 - 1);
        let yl = this.dR1.tap(tL[0]) + this.dR1.tap(tL[1]) - this.aR.tap(tL[2]) + this.dR2.tap(tL[3]) - this.dL1.tap(tL[4]) - this.aL.tap(tL[5]) - this.dL2.tap(tL[6]);
        let yr = this.dL1.tap(tR[0]) + this.dL1.tap(tR[1]) - this.aL.tap(tR[2]) + this.dL2.tap(tR[3]) - this.dR1.tap(tR[4]) - this.aR.tap(tR[5]) - this.dR2.tap(tR[6]);
        oL[i] += this.lpL.tick(yl) * g; oR[i] += this.lpR.tick(yr) * g; } } };

  // ---------------------------------------------------------------- FDN hall (8 lines, Hadamard diffuser ×4, Householder feedback, modulated)
  A.Hall = class { constructor(sr, seed){ this.sr = sr; const r = A.rng(seed || 77);
      this.diff = []; const stepMs = [20, 40, 80, 160];
      for (let s = 0; s < 4; s++){ const lines = [], lens = [], flips = []; for (let c = 0; c < 8; c++){ const ms = stepMs[s] * (c + r()) / 8; lens.push(Math.max(2, Math.round(ms * .001 * sr))); lines.push(new Line(lens[c] + 2)); flips.push(r() < .5 ? -1 : 1); }
        const perm = [0, 1, 2, 3, 4, 5, 6, 7]; for (let k = 7; k > 0; k--){ const j = Math.floor(r() * (k + 1)); const t = perm[k]; perm[k] = perm[j]; perm[j] = t; }
        this.diff.push({lines, lens, flips, perm}); }
      this.fb = []; this.fbLen = []; for (let c = 0; c < 8; c++){ const ms = 100 * Math.pow(2, (c + r() * .9) / 8); this.fbLen.push(Math.round(ms * .001 * sr)); this.fb.push(new Line(this.fbLen[c] + 128)); }
      this.v = new Float64Array(8); this.t = new Float64Array(8); this.lp = new Float64Array(8); this.ph = 0; this.pre = new Line(Math.round(.15 * sr)); this.hp = new A.OnePole(); this.oL = new A.SVF(); this.oR = new A.SVF(); this.set({}); }
    set(o){ const sr = this.sr; this.rt = o.rt60 === undefined ? 5 : o.rt60; this.g = this.fbLen.map(d => Math.pow(10, -3 * d / (this.rt * sr))); this.dampA = 1 - Math.exp(-TAU * (o.damp || 3500) / sr);
      this.preD = Math.round((o.predelay === undefined ? .03 : o.predelay) * sr); this.hp.setLP(o.inHP || 220, sr); this.oL.set(o.outLP || 6000, .6, sr); this.oR.set(o.outLP || 6000, .6, sr); this.gain = o.gain === undefined ? 1 : o.gain; this.modD = (o.mod === undefined ? .0007 : o.mod) * sr; }
    process(inL, inR, oL, oR, n){ const v = this.v, t = this.t, sr = this.sr, g = this.g, lp = this.lp, da = this.dampA, gain = this.gain * .35;
      for (let i = 0; i < n; i++){ let x = this.hp.hp((inL[i] + inR[i]) * .5); this.pre.push(x); x = this.pre.tap(this.preD);
        for (let c = 0; c < 8; c++) v[c] = x * (c & 1 ? -1 : 1);
        for (let s = 0; s < 4; s++){ const D = this.diff[s]; for (let c = 0; c < 8; c++){ D.lines[c].push(v[c]); t[c] = D.lines[c].tap(D.lens[c] - 1) * D.flips[c]; }
          for (let c = 0; c < 8; c++) v[c] = t[D.perm[c]];
          for (let h = 1; h < 8; h <<= 1) for (let a = 0; a < 8; a += h << 1) for (let b = a; b < a + h; b++){ const p = v[b], q = v[b + h]; v[b] = p + q; v[b + h] = p - q; }
          for (let c = 0; c < 8; c++) v[c] *= .35355339; }
        this.ph += .23 / sr; if (this.ph >= 1) this.ph -= 1;
        let sum = 0; for (let c = 0; c < 8; c++){ const d = this.fbLen[c] - 1 + (c < 3 ? this.modD * (1 + A.sin1(this.ph + c * .33)) : 0); const y = c < 3 ? this.fb[c].tapf(d) : this.fb[c].tap(this.fbLen[c] - 1); lp[c] += (y - lp[c]) * da; t[c] = lp[c] * g[c]; sum += t[c]; }
        sum *= -2 / 8; let yl = 0, yr = 0;
        for (let c = 0; c < 8; c++){ const fb = t[c] + sum; this.fb[c].push(fb + v[c]); if (c & 1) yr += t[c]; else yl += t[c]; }
        oL[i] += this.oL.tick(yl) * gain; oR[i] += this.oR.tick(yr) * gain; } } };

  // ---------------------------------------------------------------- tape delay: ping-pong, wow/flutter, darkening saturated feedback
  A.TapeDelay = class { constructor(sr){ this.sr = sr; this.L = new Line(Math.round(2.2 * sr)); this.R = new Line(Math.round(2.2 * sr)); this.t = .375 * sr; this.tt = this.t; this.fbL = 0; this.fbR = 0;
      this.hpL = new A.OnePole(); this.hpR = new A.OnePole(); this.lpL = new A.SVF(); this.lpR = new A.SVF(); this.w1 = 0; this.w2 = 0; this.w3 = 0; this.r = A.rng(91); this.drift = 0; this.set({}); }
    set(o){ const sr = this.sr; this.tt = clamp((o.time || .375) * sr, 64, 2 * sr); this.fb = clamp(o.feedback === undefined ? .4 : o.feedback, 0, .95); this.wow = (o.wow === undefined ? .0009 : o.wow) * sr; this.flutter = (o.flutter === undefined ? .00006 : o.flutter) * sr;
      this.hpL.setLP(o.hp || 250, sr); this.hpR.setLP(o.hp || 250, sr); this.lpL.set(o.lp || 3200, .6, sr); this.lpR.set(o.lp || 3200, .6, sr); this.pingpong = o.pingpong !== false; this.gain = o.gain === undefined ? 1 : o.gain; }
    process(inL, inR, oL, oR, n){ const sr = this.sr, k = 1 - Math.exp(-1 / (.25 * sr)), fb = this.fb, g = this.gain;
      for (let i = 0; i < n; i++){ this.t += (this.tt - this.t) * k;
        this.w1 += .7 / sr; this.w2 += 7.1 / sr; this.w3 += 11.3 / sr; if ((i & 255) === 0) this.drift += ((this.r() * 2 - 1) * .5 - this.drift) * .01;
        const mod = this.wow * (A.sin1(this.w1) + this.drift) + this.flutter * (A.sin1(this.w2) + .6 * A.sin1(this.w3)), d = this.t + mod;
        const yl = this.L.tapf(d), yr = this.R.tapf(d * (this.pingpong ? 1 : 1.013));
        let fl = this.lpL.tick(this.hpL.hp(yl)), fr = this.lpR.tick(this.hpR.hp(yr)); fl = tanh(fl * 1.4) / 1.4; fr = tanh(fr * 1.4) / 1.4;
        if (this.pingpong){ this.L.push((inL[i] + inR[i]) * .5 + fr * fb); this.R.push(fl * fb); } else { this.L.push(inL[i] + fl * fb); this.R.push(inR[i] + fr * fb); }
        oL[i] += fl * g; oR[i] += fr * g; } } };

  // ---------------------------------------------------------------- Juno-60 chorus (in place, wet/dry mix)
  A.JunoChorus = class { constructor(sr){ this.sr = sr; this.d = new Line(Math.round(.02 * sr)); this.lp = new A.SVF(); this.lp.set(10000, .7, sr); this.ph = 0; this.set({}); }
    set(o){ const mode = o.mode || 1; this.rate = mode === 2 ? .863 : mode === 3 ? 9.75 : .513; this.dmin = (mode === 3 ? 3.3 : 1.66) * .001 * this.sr; this.dmax = (mode === 3 ? 3.7 : 5.35) * .001 * this.sr; this.mix = o.mix === undefined ? .5 : o.mix; }
    process(L, R, n){ const c = (this.dmin + this.dmax) * .5, h = (this.dmax - this.dmin) * .5, mix = this.mix;
      for (let i = 0; i < n; i++){ const x = this.lp.tick((L[i] + R[i]) * .5); this.d.push(x); this.ph += this.rate / this.sr; if (this.ph >= 1) this.ph -= 1;
        const tri = 1 - 4 * Math.abs(this.ph - .5); const wl = this.d.tapf(c + h * tri), wr = this.d.tapf(c - h * tri);
        L[i] = L[i] * (1 - mix * .5) + wl * mix; R[i] = R[i] * (1 - mix * .5) + wr * mix; } } };

  // ---------------------------------------------------------------- phaser (6 first-order allpasses, stereo quadrature), in place
  A.Phaser = class { constructor(sr){ this.sr = sr; this.xl = new Float64Array(6); this.yl = new Float64Array(6); this.xr = new Float64Array(6); this.yr = new Float64Array(6); this.ph = 0; this.fl = 0; this.fr = 0; this.set({}); }
    set(o){ this.rate = o.rate || .12; this.depth = o.depth === undefined ? 1 : o.depth; this.fb = o.feedback === undefined ? .45 : o.feedback; this.mix = o.mix === undefined ? .5 : o.mix; this.lo = o.lo || 250; this.hi = o.hi || 2200; }
    process(L, R, n){ const sr = this.sr; let al = 0, ar = 0;
      for (let i = 0; i < n; i++){ if ((i & 15) === 0){ this.ph += this.rate * 16 / sr; const m1 = .5 + .5 * A.sin1(this.ph), m2 = .5 + .5 * A.sin1(this.ph + .25);
          const f1 = this.lo * Math.pow(this.hi / this.lo, m1 * this.depth), f2 = this.lo * Math.pow(this.hi / this.lo, m2 * this.depth), t1 = Math.tan(Math.PI * f1 / sr), t2 = Math.tan(Math.PI * f2 / sr); al = (t1 - 1) / (t1 + 1); ar = (t2 - 1) / (t2 + 1); }
        let xl = L[i] + this.fl * this.fb, xr = R[i] + this.fr * this.fb;
        for (let k = 0; k < 6; k++){ const yl = al * xl + this.xl[k] - al * this.yl[k]; this.xl[k] = xl; this.yl[k] = yl; xl = yl; const yr = ar * xr + this.xr[k] - ar * this.yr[k]; this.xr[k] = xr; this.yr[k] = yr; xr = yr; }
        this.fl = xl; this.fr = xr; L[i] = L[i] * (1 - this.mix * .5) + xl * this.mix; R[i] = R[i] * (1 - this.mix * .5) + xr * this.mix; } } };

  // ---------------------------------------------------------------- Haas widener (in place): delay one side a few ms, slight level drop
  A.Haas = class { constructor(sr){ this.sr = sr; this.d = new Line(Math.round(.04 * sr)); this.set({}); } set(o){ this.t = Math.round((o.ms === undefined ? 9 : o.ms) * .001 * this.sr); this.side = o.side || 1; this.amt = o.amount === undefined ? .7 : o.amount; }
    process(L, R, n){ const t = this.t, a = this.amt; for (let i = 0; i < n; i++){ const src = this.side > 0 ? R[i] : L[i]; this.d.push(src); const dl = this.d.tap(t); if (this.side > 0) R[i] = src * (1 - a) + dl * a; else L[i] = src * (1 - a) + dl * a; } } };

  // ---------------------------------------------------------------- tape saturation (in place): pre-emphasis, asymmetric tanh, de-emphasis, head bump, HF loss
  A.TapeSat = class { constructor(sr){ this.sr = sr; this.peL = new A.SVF(); this.peR = new A.SVF(); this.lpL = new A.SVF(); this.lpR = new A.SVF(); this.dcL = new A.DCBlock(); this.dcR = new A.DCBlock(); this.sL = 0; this.sR = 0; this.set({}); }
    set(o){ this.drive = o.drive === undefined ? 1.3 : o.drive; this.bias = o.bias === undefined ? .08 : o.bias; this.lpL.set(o.lp || 15000, .6, this.sr); this.lpR.set(o.lp || 15000, .6, this.sr); this.peL.set(3000, .7, this.sr); this.peR.set(3000, .7, this.sr); this.mix = o.mix === undefined ? 1 : o.mix; }
    process(L, R, n){ const d = this.drive, b = this.bias, tb = tanh(b), norm = 1 / Math.max(.5, tanh(d + b) - tb), mix = this.mix, slew = .75;
      for (let i = 0; i < n; i++){ let x = L[i], y = R[i];
        this.peL.tick(x); x = x + this.peL.hp * .58; this.peR.tick(y); y = y + this.peR.hp * .58;
        x = (tanh(x * d + b) - tb) * norm; y = (tanh(y * d + b) - tb) * norm;
        this.sL += (x - this.sL) * slew; this.sR += (y - this.sR) * slew; x = this.sL; y = this.sR;
        this.peL.tick(x); x = x - this.peL.hp * .37; this.peR.tick(y); y = y - this.peR.hp * .37;
        x = this.dcL.tick(this.lpL.tick(x)); y = this.dcR.tick(this.lpR.tick(y));
        L[i] += (x - L[i]) * mix; R[i] += (y - R[i]) * mix; } } };

  // ---------------------------------------------------------------- glue compressor (RMS, soft knee, dB-domain smoothing, sidechain HP), in place; returns max GR
  A.Glue = class { constructor(sr){ this.sr = sr; this.env = 1e-9; this.gr = 0; this.hp = new A.OnePole(); this.set({}); }
    set(o){ const sr = this.sr; this.thr = o.threshold === undefined ? -18 : o.threshold; this.ratio = o.ratio || 2; this.knee = o.knee === undefined ? 6 : o.knee; this.ka = 1 - Math.exp(-1 / ((o.attack || .02) * sr)); this.kr = 1 - Math.exp(-1 / ((o.release || .2) * sr)); this.kd = 1 - Math.exp(-1 / (.01 * sr)); this.hp.setLP(o.scHP || 90, sr); this.makeup = A.dbToGain(o.makeup || 0); }
    process(L, R, n){ let mx = 0; const thr = this.thr, ratio = this.ratio, knee = this.knee, sl = 1 - 1 / ratio;
      for (let i = 0; i < n; i++){ const s = this.hp.hp((L[i] + R[i]) * .5); this.env += (s * s - this.env) * this.kd;
        if ((i & 7) === 0){ const lv = 10 * Math.log10(this.env + 1e-12) + 3, over = lv - thr; let g = 0; if (over > knee / 2) g = over * sl; else if (over > -knee / 2){ const q = over + knee / 2; g = sl * q * q / (2 * knee); }
          this.gr += (g - this.gr) * (g > this.gr ? this.ka * 8 : this.kr * 8); this.gl = Math.pow(10, -this.gr / 20) * this.makeup; if (this.gr > mx) mx = this.gr; }
        L[i] *= this.gl; R[i] *= this.gl; }
      return mx; } };

  // ---------------------------------------------------------------- look-ahead limiter (moving minimum of needed gain + box smoothing), ceiling in linear; adds latency `look`
  A.Limiter = class { constructor(sr, lookSec){ this.sr = sr; this.look = Math.max(4, Math.round((lookSec || .002) * sr)); this.hold = Math.round(.003 * sr); const W = this.look + this.hold; this.W = W;
      this.dl = new Line(W + 4); this.dr = new Line(W + 4); this.need = new Float32Array(W + 1); this.qi = new Float64Array(W + 2); this.qv = new Float32Array(W + 2); this.qh = 0; this.qt = 0; this.pos = 0;
      this.box1 = new Float32Array(this.look); this.box2 = new Float32Array(this.look); this.b1i = 0; this.b2i = 0; this.s1 = this.look; this.s2 = this.look; this.box1.fill(1); this.box2.fill(1); this.env = 1; this.ceil = .89; this.rel = 1 - Math.exp(-1 / (.08 * sr)); this.minGain = 1; }
    set(o){ if (o.ceiling !== undefined) this.ceil = o.ceiling; if (o.release) this.rel = 1 - Math.exp(-1 / (o.release * this.sr)); }
    process(L, R, n){ const W = this.W, ceil = this.ceil; let mg = 1;
      for (let i = 0; i < n; i++){ const a = Math.max(Math.abs(L[i]), Math.abs(R[i])), nd = a > ceil ? ceil / a : 1, p = this.pos++;
        // monotone deque of minima over the last W samples
        while (this.qt > this.qh && this.qv[(this.qt - 1) % (W + 2)] >= nd) this.qt--;
        this.qi[this.qt % (W + 2)] = p; this.qv[this.qt % (W + 2)] = nd; this.qt++;
        while (this.qi[this.qh % (W + 2)] <= p - W) this.qh++;
        let g = this.qv[this.qh % (W + 2)];
        // release: never rise faster than the release slew
        if (g > this.env) g = this.env + (g - this.env) * this.rel; this.env = g;
        // two cascaded box filters (each length look/2... using full look for smoothness)
        const lk = this.look; this.s1 += g - this.box1[this.b1i]; this.box1[this.b1i] = g; this.b1i = (this.b1i + 1) % lk; const g1 = this.s1 / lk;
        this.s2 += g1 - this.box2[this.b2i]; this.box2[this.b2i] = g1; this.b2i = (this.b2i + 1) % lk; let gs = this.s2 / lk; if (gs > 1) gs = 1;
        this.dl.push(L[i]); this.dr.push(R[i]); let yl = this.dl.tap(W) * gs, yr = this.dr.tap(W) * gs;
        if (yl > ceil) yl = ceil; else if (yl < -ceil) yl = -ceil; if (yr > ceil) yr = ceil; else if (yr < -ceil) yr = -ceil;
        L[i] = yl; R[i] = yr; if (gs < mg) mg = gs; }
      this.minGain = mg; } };

  // ---------------------------------------------------------------- loudness meter (BS.1770 K-weighting, short-term 3 s) — coefficients derived by bilinear transform for any sr
  A.Loudness = class { constructor(sr){ this.sr = sr; const k = (f0, G, Q, type) => { const K = Math.tan(Math.PI * f0 / sr), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, .4996667741545416);
        if (type === 'shelf'){ const a0 = 1 + K / Q + K * K; return {b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0}; }
        const a0 = 1 + K / Q + K * K; return {b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0}; };
      this.c1 = k(1681.974450955533, 3.999843853973347, .7071752369554196, 'shelf'); this.c2 = k(38.13547087602444, 0, .5003270373238773, 'hp');
      this.z = new Float64Array(8); this.blk = Math.round(.1 * sr); this.acc = 0; this.cnt = 0; this.hist = new Float64Array(30); this.hi = 0; this.filled = 0; this.lufs = -70; }
    biq(c, x, z, o){ const y = c.b0 * x + z[o]; z[o] = c.b1 * x - c.a1 * y + z[o + 1]; z[o + 1] = c.b2 * x - c.a2 * y; return y; }
    process(L, R, n){ const z = this.z; for (let i = 0; i < n; i++){ const l = this.biq(this.c2, this.biq(this.c1, L[i], z, 0), z, 2), r = this.biq(this.c2, this.biq(this.c1, R[i], z, 4), z, 6); this.acc += l * l + r * r;
        if (++this.cnt >= this.blk){ this.hist[this.hi] = this.acc / this.cnt; this.hi = (this.hi + 1) % 30; this.filled = Math.min(30, this.filled + 1); this.acc = 0; this.cnt = 0; let s = 0; for (let k = 0; k < this.filled; k++) s += this.hist[k]; this.lufs = -0.691 + 10 * Math.log10(s / this.filled + 1e-12); } } } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_FX;
