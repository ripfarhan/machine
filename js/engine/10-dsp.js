/* Maut ki Awaaz — engine module: DSP primitives. All state lives in plain numbers / typed arrays; nothing allocates in tick(). */
'use strict';
function AWZ_DSP(A){
  const TAU = A.TAU, clamp = A.clamp, tanh = A.tanh;

  // PolyBLEP residual for a discontinuity at phase 0 (t in [0,1), dt = f/sr)
  const blep = (t, dt) => { if (t < dt){ t /= dt; return t + t - t * t - 1; } if (t > 1 - dt){ t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };
  // integrated BLEP (BLAMP) for slope discontinuities (triangle corners)
  const blamp = (t, dt) => { if (t < dt){ t = t / dt - 1; return -1 / 3 * t * t * t; } if (t > 1 - dt){ t = (t - 1) / dt + 1; return 1 / 3 * t * t * t; } return 0; };
  A.blep = blep; A.blamp = blamp;

  // Virtual-analog oscillator: saw / square-pulse / triangle / sine, morphable, with slow analog drift.
  A.VAOsc = class { constructor(sr, seed){ this.sr = sr; this.ph = 0; this.r = A.rng(seed || 1); this.ph = this.r(); this.drift = 0; this.dTarget = 0; this.dCount = 0; this.y = 0; }
    // shape: 0 sine … 1 triangle … 2 saw … 3 square(pw)
    // run(): result in this.y (no float return — a non-inlined call returning a double allocates a heap number per sample); tick() kept for other callers
    tick(freq, shape, pw, driftCents){ this.run(freq, shape, pw, driftCents); return this.y; }
    run(freq, shape, pw, driftCents){ const sr = this.sr;
      if (driftCents){ if (--this.dCount <= 0){ this.dCount = 2048; this.dTarget = (this.r() * 2 - 1) * driftCents; } this.drift += (this.dTarget - this.drift) * .0004; freq *= 1 + this.drift * 5.78e-4; }
      const dt = clamp(freq / sr, 0, .45); let t = this.ph + dt; if (t >= 1) t -= 1; this.ph = t; let y;
      if (shape <= 1){ const s = A.sin1(t);
        let tri = 4 * t - 1; tri = t < .5 ? tri : 3 - 4 * t; tri = tri; const tr = tri + 4 * dt * (blamp(t, dt) - blamp((t + .5) % 1, dt));
        y = s + (tr - s) * shape; }
      else if (shape <= 2){ let tri = t < .5 ? 4 * t - 1 : 3 - 4 * t; tri += 4 * dt * (blamp(t, dt) - blamp((t + .5) % 1, dt));
        const saw = 2 * t - 1 - blep(t, dt); y = tri + (saw - tri) * (shape - 1); }
      else { const saw = 2 * t - 1 - blep(t, dt); const w = clamp(pw || .5, .05, .95); let sq = t < w ? 1 : -1; sq += blep(t, dt) - blep((t + 1 - w) % 1, dt); y = saw + (sq - saw) * (shape - 2); }
      this.y = y; } };

  // TPT state-variable filter (Simper). mode outputs lp/bp/hp in fields after tick.
  A.SVF = class { constructor(){ this.ic1 = 0; this.ic2 = 0; this.a1 = 1; this.a2 = 0; this.a3 = 0; this.k = 1.4; this.lp = 0; this.bp = 0; this.hp = 0; this.fc = -1; this.q = -1; }
    set(fc, q, sr){ if (fc === this.fc && q === this.q) return; this.fc = fc; this.q = q; const g = Math.tan(Math.PI * clamp(fc, 8, sr * .49) / sr), k = 1 / Math.max(.05, q); this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2; }
    tick(v0){ this.run(v0); return this.lp; }
    run(v0){ const v3 = v0 - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3; this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2; if (this.ic1 < 1e-25 && this.ic1 > -1e-25) this.ic1 = 0; if (this.ic2 < 1e-25 && this.ic2 > -1e-25) this.ic2 = 0; this.lp = v2; this.bp = v1; this.hp = v0 - this.k * v1 - v2; }
    reset(){ this.ic1 = this.ic2 = 0; } };

  // Zero-delay-feedback 4-pole transistor ladder (Zavalishin TPT), tanh on the input stage, resonance 0..1 (self-osc ≈ 1).
  // Feedback is solved for the linear system and the nonlinearity applied to the solved input — stable and warm, ~1 tanh per sample.
  A.Ladder = class { constructor(){ this.s = new Float64Array(4); this.G = 0; this.g = 0; this.fc = -1; this.k = 0; this.drive = 1; this.y = 0; }
    tick(x){ this.run(x); return this.y; }
    set(fc, res, sr){ if (fc !== this.fc){ this.fc = fc; const g = Math.tan(Math.PI * clamp(fc, 10, sr * .45) / sr); this.g = g; this.G = g / (1 + g); } this.k = 4 * clamp(res, 0, 1.05); }
    run(x){ const s = this.s, G = this.G, k = this.k, G2 = G * G, G3 = G2 * G, G4 = G3 * G, b = 1 - G;
      const S = G3 * b * s[0] + G2 * b * s[1] + G * b * s[2] + b * s[3];
      // gain compensation keeps passband level roughly constant as resonance rises
      let u = (x * (1 + k * .5) - k * S) / (1 + k * G4); u = tanh(u * this.drive) / (this.drive > 1 ? Math.min(this.drive, 2) : 1);
      let v = (u - s[0]) * G, y1 = v + s[0]; s[0] = y1 + v; v = (y1 - s[1]) * G; const y2 = v + s[1]; s[1] = y2 + v; v = (y2 - s[2]) * G; const y3 = v + s[2]; s[2] = y3 + v; v = (y3 - s[3]) * G; const y4 = v + s[3]; s[3] = y4 + v;
      this.y = y4; }
    reset(){ this.s.fill(0); } };

  // ADSR with exponential segments (RC-style curves), times in seconds. gate on/off via trigger()/release().
  // render quality (the CPU governor lowers it under load instead of dropping notes): unison voices, release-tail floor, 303 oversampling
  const Q = A.Q || (A.Q = {uni: 3, tail: 8e-4, os: 4});
  A.ADSR = class { constructor(sr){ this.sr = sr; this.v = 0; this.stage = 0; this.a = .005; this.d = .2; this.s = .7; this.r = .3; this.ka = 0; this.kd = 0; this.kr = 0; this.peak = 1; }
    setTimes(a, d, s, r){ this.a = a; this.d = d; this.s = s; this.r = r; const sr = this.sr; this.ka = 1 - Math.exp(-1 / (Math.max(.0005, a) * sr * .4)); this.kd = 1 - Math.exp(-1 / (Math.max(.001, d) * sr * .25)); this.kr = 1 - Math.exp(-1 / (Math.max(.001, r) * sr * .25)); }
    trigger(peak){ this.stage = 1; this.peak = peak === undefined ? 1 : peak; }
    release(){ if (this.stage && this.stage < 4) this.stage = 4; }
    tick(){ this.step(); return this.v; }
    step(){ switch (this.stage){
        case 1: this.v += (this.peak * 1.3 - this.v) * this.ka; if (this.v >= this.peak){ this.v = this.peak; this.stage = 2; } break;
        case 2: this.v += (this.s * this.peak - this.v) * this.kd; if (Math.abs(this.v - this.s * this.peak) < 1e-4) this.stage = 3; break;
        case 3: this.v = this.s * this.peak; break;
        case 4: this.v += (0 - this.v) * this.kr; if (this.v < Q.tail){ this.v = 0; this.stage = 0; } break; } }
    get active(){ return this.stage !== 0; } };

  // smoothed parameter (linear-in-time one pole)
  A.Smooth = class { constructor(v, sec, rate){ this.v = v; this.t = v; this.k = A.coef(sec || .02, rate || 44100); } set(t){ this.t = t; } tick(){ this.v += (this.t - this.v) * this.k; return this.v; } snap(v){ this.v = this.t = v; } };

  A.OnePole = class { constructor(){ this.z = 0; this.a = 1; } setLP(fc, sr){ this.a = 1 - Math.exp(-TAU * fc / sr); } lp(x){ this.z += (x - this.z) * this.a; if (this.z < 1e-25 && this.z > -1e-25) this.z = 0; return this.z; } hp(x){ this.z += (x - this.z) * this.a; if (this.z < 1e-25 && this.z > -1e-25) this.z = 0; return x - this.z; } };
  A.DCBlock = class { constructor(){ this.x1 = 0; this.y1 = 0; this.R = .995; } tick(x){ let y = x - this.x1 + this.R * this.y1; if (y < 1e-25 && y > -1e-25) y = 0; this.x1 = x; this.y1 = y; return y; } };

  // fractional delay line (cubic Hermite read)
  A.Delay = class { constructor(maxSamples){ let n = 1; while (n < maxSamples + 4) n <<= 1; this.buf = new Float32Array(n); this.mask = n - 1; this.w = 0; }
    write(x){ this.buf[this.w] = x; this.w = (this.w + 1) & this.mask; }
    read(d){ const p = this.w - 1 - d; let i = Math.floor(p); const f = p - i; const b = this.buf, m = this.mask;
      const xm1 = b[(i - 1) & m], x0 = b[i & m], x1 = b[(i + 1) & m], x2 = b[(i + 2) & m];
      const c1 = .5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - .5 * x2, c3 = .5 * (x2 - xm1) + 1.5 * (x0 - x1);
      return ((c3 * f + c2) * f + c1) * f + x0; }
    readInt(d){ return this.buf[(this.w - 1 - d) & this.mask]; }
    clear(){ this.buf.fill(0); } };
  // Schroeder allpass on a delay line (for diffusion)
  A.Allpass = class { constructor(len, g){ this.d = new A.Delay(len + 2); this.len = len; this.g = g; }
    tick(x, mod){ const dl = mod ? this.d.read(this.len + mod) : this.d.readInt(this.len); const v = x + this.g * dl; this.d.write(v); return dl - this.g * v; } };

  // white noise + pink (Paul Kellet economy) generators
  A.Noise = class { constructor(seed){ this.s = (seed >>> 0) || 22222; this.b0 = 0; this.b1 = 0; this.b2 = 0; }
    white(){ let s = this.s; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.s = s >>> 0; return (this.s / 4294967296) * 2 - 1; }
    pink(){ const w = this.white(); this.b0 = .99765 * this.b0 + w * .0990460; this.b1 = .96300 * this.b1 + w * .2965164; this.b2 = .57000 * this.b2 + w * 1.0526913; return (this.b0 + this.b1 + this.b2 + w * .1848) * .2; } };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_DSP;
