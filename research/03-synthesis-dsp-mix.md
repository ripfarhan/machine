# 03 — Synthesis, DSP and Mix Engineering for a Browser Generative Synth

Target: real-time generative engine in plain JavaScript (AudioWorklet in the browser, the same DSP code run in Node for offline renders). Sonic reference: Max Cooper, Jon Hopkins, Rival Consoles, melodic techno. That means lush analog-style pads, warm plucks and arps, deep round sub, punchy but restrained drums, big reverb spaces and tape warmth.

How to read this: every section gives drop-in numbers and JS-style pseudo-code. Values marked **[verified]** were checked against a primary or near-primary source during this research (see Sources). Unmarked values are standard engineering practice or starting points I chose, meant to be tuned by ear. The sample rate `fs` is 48000 unless stated, and `dt = f / fs` is the phase increment per sample.

---

## 0. Diagnosis: why the previous version sounded amateur

| Symptom | Most likely cause | Fix (section) |
|---|---|---|
| "Ear cancer" bass | Naive (aliasing) saws or squares, hard clipping without oversampling, a resonant peak landing at 1–4 kHz, too much 2–5 kHz content on a sustained sound, DC offset, stereo content in the sub | PolyBLEP oscillators (1), sine sub plus a *filtered* harmonic layer (4), saturate and then low-pass (4), mono below 120 Hz (7) |
| Thin, generic kick/snare/hats | Single sine with a linear pitch ramp, no click/body/tail layering, hats made of raw white noise, no saturation, no space | Exponential pitch envelopes, 3-layer kick, metallic 6-square hat bank, short room plus saturation (3) |
| Cheesy FM piano | DX7-style 1:1 + 14:1 tine ratios, static timbre, bright attack, no felt or hammer noise | Modal "felt piano" resonator bank with inharmonicity and per-partial decay (5.6) |
| Karplus-Strong pluck reads as a constant bell | Loop gain too close to 1, so the high harmonics die fast and leave a near-sine fundamental that rings for seconds, which the ear hears as a bell or glock. Excitation too bright. No amp envelope | Use a subtractive pluck with filter env for melodic plucks. If KS is used, set the T60 explicitly, darken the excitation, and gate with an amp envelope (5.3) |
| Muddy *or* fizzy mixes | No per-element high-pass, reverb returns not EQ'd (mud), exciters, distortion or unbandlimited oscillators adding 8–16 kHz fizz, and no tilt reference | HP/LP table, reverb return EQ, spectral tilt target, gentle glue and a true-peak limiter (7) |

The one change that matters most: **filter everything after it is distorted, and bandlimit every oscillator.** Warm analog character comes from soft nonlinearity followed by low-pass filtering, with slow random modulation on top. Bright, static, aliased signals push the other way.

---

## 1. Oscillators

### 1.1 Choosing an antialiasing method

| Method | Alias suppression (typical) | JS cost per sample | Notes |
|---|---|---|---|
| Naive | none, audibly bad above ~500 Hz | ~3 ops | Never use for audible saws or squares |
| **PolyBLEP (2-point)** | ~-40 to -60 dB at mid notes, worse at the top octave | ~8–15 flops, one or two branches | Best cost/quality for JS. No tables. Supports PWM and sync (sync needs extra BLEPs) |
| PolyBLEP + PolyBLAMP | same, for triangle and corners | +5 flops | For triangle and for clipped waveforms |
| minBLEP (table) | -80 dB or better | table lookup and accumulate (~30–60 ops) | Minimum-phase, so no pre-ringing. Overkill here |
| DPW (differentiated polynomial waveforms, Välimäki) | 2nd order ≈ PolyBLEP quality | ~6 ops + 1 state | Breaks under fast FM. Needs scaling by `1/(4·dt·(1-dt))` for saw |
| Wavetable mipmaps (1 table/octave, 2048 samples) | -90 dB or better if tables are band-limited per octave | 2 lookups + lerp + crossfade between mips ≈ 10 ops; memory ~10 tables × 2048 × 4 B per waveform | Best for arbitrary or morphing waves (Vital/Surge style). Needs an offline FFT build step at startup |

**Recommendation:** PolyBLEP saw, square and pulse plus PolyBLAMP triangle for every subtractive voice. Use wavetables only if you add morphing timbres later. Saws feeding a 24 dB low-pass at less than 3 kHz hide nearly all residual aliasing, which suits this genre. No oversampling is needed for the oscillators themselves.

### 1.2 Drop-in code

```js
// t: phase in [0,1), dt: phase increment per sample (f/fs)
function polyBlep(t, dt) {
  if (t < dt)       { t /= dt;           return t + t - t * t - 1; }   // just after the jump
  if (t > 1 - dt)   { t = (t - 1) / dt;  return t * t + t + t + 1; }   // just before the jump
  return 0;
}
// BLAMP residual (integrated 2-point BLEP), derived from the same triangular kernel:
// the residual is (1-|d|)^3/6 at distance d samples from the corner
function polyBlamp(t, dt) {
  if (t < dt)     { const d = 1 - t / dt;        return d * d * d / 6; }
  if (t > 1 - dt) { const d = 1 - (1 - t) / dt;  return d * d * d / 6; }
  return 0;
}

// SAW (falling-edge-at-wrap convention, range -1..1)
let y = 2 * t - 1;          y -= polyBlep(t, dt);
// SQUARE / PULSE (pw in 0.05..0.95)
let s = t < pw ? 1 : -1;
s += polyBlep(t, dt);
s -= polyBlep((t + 1 - pw) % 1, dt);
// TRIANGLE: min at t=0, max at t=0.5. Slope change is +-8*dt per sample at the corners
let tri = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
tri += 8 * dt * (polyBlamp(t, dt) - polyBlamp((t + 0.5) % 1, dt));

t += dt; if (t >= 1) t -= 1;
```

Validate with a unit test, not only by ear: render a 3,520 Hz saw at 48 kHz for 1 s in Node, take an FFT, and confirm that bins between the harmonics sit below -45 dB relative to the fundamental. Run the same test for the triangle sign convention.

**Cost in JS:** a PolyBLEP saw is roughly 3–6 ns per sample in V8 on a modern laptop. 96 oscillators (16 voices × 2 osc × 3 unison) is around 0.5 µs per sample, about 70 µs per 128-frame block, which is less than 3% of the 2.67 ms quantum. Oscillators are not your bottleneck. Filters with `Math.tan`/`Math.tanh` and reverbs are.

### 1.3 Analog drift: the single biggest "warmth" factor after filtering

Per voice, at note-on:
- **Static detune:** `cents = (rand()*2-1) * 3` (±3 cents) for pads and plucks, ±1.5 for bass.
- **Slow pitch wander:** a smoothed random walk. Each voice has `w += (rand()*2-1) * 0.02` per control tick (every 32 samples), then `w *= 0.999`, then a one-pole low-pass at about 0.3 Hz. Scale to ±2–4 cents. Cost is negligible at control rate.
- **Phase:** *free-running with a random start phase* for pads, strings and supersaws, because the Szabo/JP-8000 analysis says random phase is one of the most important factors **[verified: KVR thread]**. Use *phase reset to 0* for bass, kick and short plucks so every hit has the same transient and sub phase.
- **Per-voice cutoff offset:** ±3–6% (multiplicative). Envelope times ±5–8%. Amplitude ±0.5 dB.
- **Oscillator-to-oscillator drift** within a voice: the second oscillator gets an independent wander of ±1–2 cents. This produces the slow "beating breath" of a Juno or Prophet pad.

Use a seeded PRNG so offline (Node) and realtime renders match:
```js
// mulberry32: fast, allocation-free
let seed = 0x9E3779B9;
function rand() { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296; }
```

### 1.4 Unison and supersaw

JP-8000 relative detune ratios for the 7 saws at maximum: **0.893, 0.939, 0.980, 1.0, 1.020, 1.064, 1.110** **[verified: KVR thread]**. The max spread is about ±2 semitones, which is far too much for this genre. Musically useful settings run about 40–90 cents total spread **[verified: same thread]**. The thread also says the end of the chain has a high-pass filter that tracks the key at about the fundamental **[verified]**. That HPF is why supersaws sound airy rather than muddy.

Adam Szabo's thesis ("How to Emulate the Super Saw", 2010) fits the detune knob response with an 11th-order polynomial **[verified that it exists. The coefficients below are the widely circulated values; spot-check against the thesis]**:

```js
// x = detune knob 0..1 -> detune amount 0..~1
function szaboDetune(x) {
  return 10028.7312891634*x**11 - 50818.8652045924*x**10 + 111363.4808729368*x**9
       - 138150.6761080548*x**8 + 106649.6679158292*x**7 - 53046.9642751875*x**6
       + 17019.9518580080*x**5 - 3425.0836591318*x**4 + 404.2703938388*x**3
       - 24.1878824391*x**2 + 0.6717417634*x + 0.0030115596;
}
const SZABO_OFFSETS = [-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242];
// freq_i = f0 * (1 + SZABO_OFFSETS[i] * szaboDetune(x))
// Mix (y = mix knob 0..1):
const centerGain = -0.55366 * y + 0.99785;
const sideGain   = -0.73764 * y * y + 1.2841 * y + 0.044372;
```

The polynomial is a near-flat curve at small knob values followed by a steep rise. Add a cheap safety check: if the curve misbehaves, replace it with `detune = 0.0035 + 0.3*x**3 + 0.7*x**8` (close in spirit).

**Unison voice counts for this genre:**
| Sound | Voices | Spread | Notes |
|---|---|---|---|
| Warm pad (Juno/Prophet style) | 2 osc × 1–2 voices | 6–12 cents | Then chorus. Less is warmer |
| Lush/huge pad | 2 osc × 3 voices | 10–18 cents | Pan the unison voices ±40–70% |
| Supersaw stab/lead | 5–7 | knob 0.15–0.3 (≈20–40 cents) | Key-tracked HPF at about f0, then LPF |
| Pluck | 1–2 | 4–8 cents | Unison smears transients. Keep it tight |
| Bass | 1 (+ sub) | 0 | Unison in bass causes phase cancellation, so mono |
| Reese | 2–3 | 10–25 cents (0.5–3 Hz beat at 50 Hz) | Slow beating is the sound |

Gain normalization: `g = 1/Math.sqrt(N)` (equal-power for uncorrelated voices).

---

## 2. Filters

### 2.1 Which filter gives "warm"

- **4-pole transistor ladder (Moog, Minimoog, Prophet-5 Curtis-ish):** the canonical warm low-pass. Resonance thins the bass (passband loss), which is part of the character but needs compensation for bass patches. Use it for pads, basses and plucks.
- **2-pole SVF (Oberheim SEM, Simper):** smoother and more open, with a usable band-pass and notch. Juno-style pads are actually 4-pole OTA (IR3109), which sits between the two. Use the SVF for strings, choirs, formants, EQ and the drum filters.
- **Diode ladder (TB-303, EMS):** squelchy and acid. Not "warm". Skip unless you want acid lines.
- **MS-20 (Sallen-Key with diode clipping in the feedback path):** aggressive and screaming. Good for Hopkins-style distorted leads in small doses.

Topology matters less than (a) a zero-delay-feedback discretization so cutoff and resonance behave like analog at high cutoffs, (b) a soft saturator *inside the feedback loop*, so resonance compresses instead of whistling, and (c) slow drift on cutoff.

### 2.2 TPT one-pole (Zavalishin), the building block

```js
// g = tan(PI*fc/fs) (prewarped); G = g/(1+g)
// per sample:
const v = (x - s) * G;  const lp = v + s;  s = lp + v;  const hp = x - lp;
```

### 2.3 ZDF 4-pole ladder with saturation (drop-in)

This is the linear zero-delay solve with the nonlinearity applied at the loop input, which gives most of the analog behavior at about a quarter of the cost of full per-stage Newton iteration (Zavalishin, "The Art of VA Filter Design", ch. 5–6).

```js
// state: s1..s4 (Float64 locals copied from Float32Array per block)
// k: resonance 0..4 (4 = self-oscillation). drive: 1..4
function ladderTick(x) {
  const G = g / (1 + g), G2 = G*G, G4 = G2*G2;
  const inv = 1 / (1 + g);
  const S = G2*G*s1*inv + G2*s2*inv + G*s3*inv + s4*inv;   // sum of stage "memory" contributions
  // passband-loss compensation: 0 = authentic Moog, 0.5 = most bass restored
  let u = (x * (1 + comp * k) - k * S) / (1 + k * G4);
  u = fastTanh(u * drive) / drive;                         // saturation in the loop
  let v, y;
  v = (u - s1) * G; y = v + s1; s1 = y + v; u = y;
  v = (u - s2) * G; y = v + s2; s2 = y + v; u = y;
  v = (u - s3) * G; y = v + s3; s3 = y + v; u = y;
  v = (u - s4) * G; y = v + s4; s4 = y + v;
  return y;            // 24 dB LP. 12 dB LP = output of stage 2
}
// Rational tanh, error < 2% inside +-3, clamped outside
function fastTanh(x) { if (x > 3) return 1; if (x < -3) return -1;
  const x2 = x*x; return x * (27 + x2) / (27 + 9 * x2); }
```

Notes:
- **Huovilainen's alternative** puts `tanh` on every stage (5 tanh per sample by reusing stored values), uses the coefficient `g = 1 - exp(-2π fc/fs)`, and requires **2× oversampling** plus a half-sample delay in feedback for correct tuning up to fs/4 **[verified: DAFx-04 paper]**. It sounds richer at high drive but costs about 3× more in JS. Keep the ZDF version above as the default.
- **Oversampling:** not needed for pads or plucks with cutoff below 6 kHz and drive at 2 or less. Use 2× (halfband polyphase FIR, 31 taps, or 2× IIR halfband) only for screaming high-resonance leads or heavy drive on bass.
- **Resonance ranges** (k on the 0–4 ladder scale): pads 0.4–1.2, plucks 1.0–2.0, acid/arp 2.5–3.4, bass 0.3–1.5 with `comp = 0.5`. Above 3.6 it whistles, which is the "cheap synth" giveaway.
- **Cutoff modulation:** compute `g` at control rate (every 16–32 samples) and linearly interpolate `g` per sample, or smooth `fc` per sample and call `Math.tan` per sample only on the mono bass voice. `Math.tan` costs about 15–30 ns, so 16 voices × 48k is about 20 ms/s, roughly 2% of a core. That is affordable, but interpolation is free.
- **Clamp** `fc` to `[20, 0.45*fs]` before `tan`.

### 2.4 Simper/Cytomic linear trapezoidal SVF (drop-in)

The node equations and solved structure were verified against Cytomic's SvfLinearTrapOptimised2. The mix table below is the standard set from that paper.

```js
// setup: g = tan(PI*fc/fs); k = 1/Q  (Q 0.5..20). For "res 0..1": k = 2 - 2*res
const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
// tick
const v3 = v0 - ic2eq;
const v1 = a1 * ic1eq + a2 * v3;          // band
const v2 = ic2eq + a2 * ic1eq + a3 * v3;  // low
ic1eq = 2 * v1 - ic1eq;  ic2eq = 2 * v2 - ic2eq;
// outputs: out = m0*v0 + m1*v1 + m2*v2
// low (0,0,1)  band (0,1,0)  high (1,-k,-1)  notch (1,-k,0)  peak (1,-k,-2)  allpass (1,-2k,0)
// bell:       A = 10**(dB/40); k = 1/(Q*A);         m = (1, k*(A*A-1), 0)
// low shelf:  A as above; g = tan(PI*fc/fs)/Math.sqrt(A); k = 1/Q;  m = (1, k*(A-1), A*A-1)
// high shelf: g = tan(PI*fc/fs)*Math.sqrt(A);  m = (A*A, k*(1-A)*A, 1-A*A)
```

Use this one SVF for drum filters, EQ bands, formant filters, crossovers and the "SEM" voice filter. It stays stable under audio-rate modulation, which is why Surge, Vital and most modern synths use some form of it.

### 2.5 Key tracking and filter envelope amounts

Cutoff in Hz: `fc = base * 2**((note-60)/12 * keytrack) * 2**(envAmtOct * env + lfoOct * lfo)`. Work in octaves. Linear-Hz envelope amounts sound wrong.

| Patch | Base cutoff | Key track | Env amount | Filter env A/D/S/R (ms / level) | Res (k/4) |
|---|---|---|---|---|---|
| Warm pad | 900–2000 Hz | 30–50% | +0.5–1.5 oct | 1500 / 3000 / 0.6 / 4000 | 0.15–0.3 |
| Evolving pad | 400–900 Hz | 30% | +2 oct, slow LFO ±0.7 oct @ 0.05–0.15 Hz | 4000 / 6000 / 0.5 / 6000 | 0.2–0.35 |
| Pluck | 250–600 Hz | 60–100% | +3–4.5 oct | 0 / 180–350 / 0 / 300 | 0.25–0.45 |
| Arp | 400–800 Hz | 70% | +2.5–3.5 oct | 0 / 120–220 / 0.05 / 200 | 0.3–0.6 |
| Rolling bass | 150–300 Hz | 50% | +2–3 oct | 0 / 90–180 / 0 / 120 | 0.2–0.35 |
| Sub-ish deep bass | 120–250 Hz | 100% | +0.5–1 oct | 2 / 250 / 0.3 / 150 | 0.1 |
| Lead | 1200–2500 Hz | 80% | +1 oct | 10 / 400 / 0.4 / 300 | 0.2–0.4 |

Envelope shapes: use exponential segments (RC-like), not linear. Attack curve: target overshoot 1.2 and clamp at 1 (the analog "attack aims past 1" trick, which gives a punchy, quick-rounding attack). Decay and release: `level += (target - level) * coef` with `coef = 1 - Math.exp(-1 / (tau * fs))` and `tau = time / 4.6` (reaches -40 dB in `time`). Retrigger from the current level, not from zero, to avoid clicks.

---

## 3. Drum synthesis recipes

General rules:
- Reset all drum oscillators to phase 0 at each hit.
- Drum pitch envelopes are **exponential in frequency**: `f(t) = fEnd + (fStart - fEnd) * Math.exp(-t / tau)`.
- Integrate frequency into phase. Never compute `sin(2π f(t) t)`, because that causes chirp errors.
- Every drum gets: a body (tuned), a transient (click or noise burst), a nonlinearity (soft saturation), then post-EQ, then optionally a short room.
- Per-hit micro-variation ("round robin"): pitch ±1–2%, decay ±5%, level ±0.7 dB, click level ±2 dB, timing ±2–4 ms on hats and percussion only (never the kick).

### 3.1 909-style kick
```
body:    sine, phase reset
pitch:   fStart 230 Hz -> fEnd 52 Hz (tune fEnd to key: G1=49.0, A1=55.0, F1=43.65)
         two-stage: tau1 = 4 ms from 900 Hz (click sweep) mixed into tau2 = 28 ms main sweep
         f(t) = fEnd + (fStart-fEnd)*exp(-t/0.028) + 700*exp(-t/0.004)
amp:     attack 0.5 ms, hold 15 ms, exp decay tau 120 ms (total ~450 ms). Long: tau 200 ms
click:   2.5 ms of white noise -> HP 3 kHz -> exp decay tau 1.2 ms, level -16 dB
         (909 used noise -> LPF + a short pulse through its own envelope [verified: SOS article])
drive:   y = tanh(1.8*x)/tanh(1.8)   (909 waveshapes a saw toward a near-sine [verified])
post:    LP 9 kHz (12 dB), HP 25 Hz, optional +2 dB bell at 60 Hz Q 1.2, -3 dB at 300 Hz
```

### 3.2 808-style boom
Werner, Abel and Smith (DAFx-14) measured the 808 bridged-T resonance at **~49.5 Hz**. At the attack the frequency briefly rises **more than an octave for about 6 ms**, and there is a later subtle downward "pitch sigh" **[verified]**. So:
```
f(t) = fEnd*(1 + 1.1*exp(-t/0.0025)) * (1 + 0.04*exp(-t/0.12))   // fast octave blip + slight sigh
fEnd = 49.5 (or the key root)
amp: hold 5 ms, exp decay tau 300-900 ms (808 decays are multi-second at max)
click: 1 ms raised-cosine pulse, level -10 dB, through LP 2-5 kHz ("tone" control)
saturation for small-speaker audibility: tanh(2.5*x), then LP 4 kHz on the harmonics
```

### 3.3 Deep techno "rumble" kick (Hopkins / Rival Consoles territory)
Signal chain, applied to a send of the kick (not the dry kick):
1. Kick (3.1) → send 100% to bus **[Attack Magazine recipe: full send, dark hall reverb, sidechained bus, verified]**.
2. Reverb: dark hall or Dattorro with decay 0.85, damping 0.6, bandwidth 0.5, predelay 0–10 ms, 100% wet.
3. Distortion: `tanh(6*x)` (drive 4–10). Optional second stage: wavefold lightly.
4. Filter: HP 35 Hz, LP 180–260 Hz (24 dB). Optional resonant bell at the key root, +4 dB, Q 3, so the rumble is tuned.
5. Sidechain/duck: gain → -18 dB at each kick, attack 0.5 ms, hold 40 ms, release 180–260 ms (ease-in curve, see 6.11).
6. Mono. Level about 8–12 dB below the kick peak.
7. Attack Magazine's kick-group processing **[verified]**: glue compression about 5 dB GR, EQ cut around 120 Hz and around 800 Hz, low-shelf boost around 80 Hz, overdrive, then a clipping limiter on the transient.

### 3.4 Jon Hopkins-style distorted kick
Short and heavily saturated, with the high end band-limited so it is "crunchy, not fizzy":
```
sine, fStart 160 Hz -> fEnd 48 Hz, tau 35 ms; amp tau 90 ms
pre-gain +12 dB -> asymmetric soft clip: y = tanh(x + 0.15) - tanh(0.15)
-> bitcrush-free "tape" stage (6.9) -> LP 3.5-5 kHz (12 dB) -> HP 30 Hz
-> parallel: 30% mix of the dry sine for clean sub
-> compressor: 4:1, attack 10 ms (lets the click through), release 80 ms
```
The trick is that the distortion creates midrange harmonics that read on laptop speakers, and the LP after it removes the aliasing "fizz".

### 3.5 Snare (909-ish, tasteful)
```
body: two sines (or PolyBLEP triangles) at 185 Hz and 330 Hz (ratio ~1.78), phase reset
      pitch drop: f*(1 + 0.25*exp(-t/0.008)); amp tau 55 ms (low mode), 35 ms (high mode); levels 0 dB / -5 dB
noise: white -> SVF BP 4.5 kHz Q 0.8 -> HP 1.2 kHz; amp attack 0.5 ms, tau 110 ms (tight) - 200 ms (open); level -2 dB vs body
snap: 3 ms noise burst HP 6 kHz at -10 dB
drive: tanh(1.5x); post EQ: HP 120 Hz, -3 dB at 600 Hz Q 1, LP 12 kHz
room: Dattorro decay 0.4, damping 0.4, 12-18% wet, or a 6-tap early-reflection FDN (6.3) at 35 ms size
```

### 3.6 Clap
```
noise -> SVF BP 1.6 kHz Q 1.2 (+ parallel BP 3.2 kHz Q 1.5 at -6 dB)
envelope = sum of 4 bursts at t = 0, 9, 18, 29 ms (randomise each +-1.5 ms per hit),
           each burst: attack 0.2 ms, exp decay tau 2.5 ms
         + tail starting at 29 ms: tau 90-160 ms
HP 400 Hz; saturation tanh(1.3x); plate send 20-30% (decay 0.6, predelay 15 ms)
```

### 3.7 808 metallic hats and cymbals (verified constants)
TR-808 cymbal/hat oscillator bank: six square-wave oscillators at **205.3, 304.4, 369.6, 522.7, 540, 800 Hz** (the last two trimmed at the factory). The sum feeds two band-passes at about **3440 Hz** and **7100 Hz**, with high-pass stages around **10.5 kHz** in the buffered path. There are three VCA bands with separate envelopes **[verified: Werner/Abel/Smith ICMC-14]**.

```js
const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800];
// metal = sum of 6 PolyBLEP squares (bandlimit them: their harmonics reach Nyquist)
// closed hat: metal -> BP 7100 Q 1.2 -> HP 7000 (2-pole); amp: attack 0.3 ms, tau 12-25 ms (closed), 90-250 ms (open)
// open hat:   add 25% of BP 3440 band with tau x1.5 for body
// cymbal:     low band (BP 3440) tau 300-900 ms, high band (BP 7100 -> HP 10.5k) tau 120 ms + shortest band tau 15 ms
// blend 10-25% white noise through HP 8 kHz for "air"; choke open hat on closed hit (fade 3 ms)
// pitch the whole bank x0.9-1.15 per kit for variation
```
Make it expensive: HP at 6–8 kHz in the mix, LP at 15–16 kHz to remove the top fizz, ±1 dB velocity variation, 16th swing of 52–58%, and a slow LFO (0.1 Hz) on decay ±15% over 8 bars. Attack Magazine's "Rolling Techno" uses 131 BPM, 20% swing, and an open hat with the second quarter-beat hit pushed late at about 50% velocity **[verified]**.

909 hats were 6-bit samples, so the 808 bank above, made brighter (BP 9 kHz, shorter tau), is the right synthetic stand-in.

### 3.8 Shaker
```
noise -> SVF BP 6.5 kHz Q 0.9 -> HP 4 kHz
amp: attack 6-12 ms (NOT instant: shakers have a soft onset), tau 35-60 ms
accent pattern: 16ths with velocities [1.0, 0.55, 0.75, 0.5], humanise +-4 ms
stereo: pan +25%, Haas 8 ms copy at -9 dB on the other side
```

### 3.9 Rimshot / clave / perc
- **808 rim:** two resonators at about 455 Hz and 1667 Hz (bridged-T style). Implement as SVF band-passes with Q 25–40 excited by a 0.5 ms impulse, decay tau 8–15 ms. Then HP 300 Hz and `tanh(2x)`.
- **Clave:** single resonator at 2.5 kHz, Q 60, tau 25 ms.
- **Toms:** sine `fEnd` 80–200 Hz, `fStart = 1.6×fEnd`, tau_pitch 45 ms, amp tau 180–350 ms, plus 15% noise BP at 2× fEnd and tau 30 ms. Tune toms to scale degrees (root, fifth, octave). Attack Magazine's rolling-techno groove uses three toms on alternating 16ths, low-passed with resonance by ear, as the "bass" element **[verified]**.

### 3.10 Making drums sound expensive
1. **Transient shaper** on kick and snare (6.10): attack +3 to +6 dB, sustain -2 dB.
2. **Parallel saturation:** drum bus → `tanh(3x)` → LP 7 kHz → mix 20–30% under the dry.
3. **Short room:** one shared room (FDN 8×, RT60 0.35–0.6 s, predelay 5 ms, HP 300 Hz, LP 7 kHz on the return) at 8–15% for snare, clap, hats and perc. Kick dry.
4. **Glue:** drum bus compressor 2:1–4:1, attack 10–30 ms, release 100–150 ms (or tempo-synced to a 1/16 note at 125 BPM, 120 ms), 2–4 dB GR.
5. **Tuning:** kick body and toms to the key, snare body to a scale tone.
6. **Velocity and timing humanization** on everything except the kick.

---

## 4. Bass

### 4.1 Architecture: two layers, clearly separated
```
SUB:   sine (or triangle -> LP 120 Hz), phase reset at note-on, mono, 1 octave below or at note
       amp env: A 2-5 ms (avoids click), D/S as patch, R 30-60 ms
       optional soft drive tanh(1.2x) for 2nd/3rd harmonic warmth (still under 200 Hz)
       -> LP 100-140 Hz (24 dB) -> HP 28 Hz
HARM:  saw or pulse (PolyBLEP) -> ladder LP (table 2.5) -> asymmetric saturation
       -> HP 90-120 Hz (removes overlap with sub) -> LP 3-5 kHz (kills fizz)
       may be stereo above 150 Hz (chorus/unison), but keep it modest
```
Crossover point: 100–130 Hz. The sub should carry about 60–70% of the bass bus RMS on a spectrum analyser.

**Small-speaker audibility:** the ear reconstructs the missing fundamental from harmonics 2–5. Generate them with *soft, asymmetric* saturation on the sub (`y = tanh(1.6x + 0.1) - tanh(0.1)`, which adds even and odd harmonics) and band-limit the result to under 800 Hz. That is a "MaxxBass"-style psychoacoustic boost and does not sound harsh.

### 4.2 What makes bass harsh, and the fixes
1. **Aliased oscillators**: fold-back content at 2–10 kHz that does not track pitch. Fix with PolyBLEP.
2. **Hard clipping or high-drive `tanh` without oversampling**: inharmonic aliasing. Use 2× oversampling for drive above 3, or lower the drive, and always LP afterward.
3. **Resonance peak in the presence band (1–4 kHz)** from a high-cutoff, high-resonance filter. Keep the bass cutoff peak under 1.5 kHz, or lower the resonance.
4. **Sustained bright saw energy at 2–5 kHz.** The ear is most sensitive there (equal-loudness curves). Use LP 3–5 kHz on the bass bus, or a dynamic EQ.
5. **DC offset** from asymmetric saturation. Add a DC blocker after it: `y = x - x1 + 0.9995*y1`.
6. **Phase cancellation** between sub and harmonic layer causes thin, hollow notes. Reset both phases together and HP the harmonic layer.
7. **Wide stereo bass**: mono below 120–150 Hz.
8. **Too much level.** Bass is perceived as quieter than it is on small speakers, so people turn it up until the harmonics scream.

### 4.3 Reese
```
2 saws, detune +-12 cents (or 3 saws at -15/0/+15), free-running random phase
-> ladder LP 24 dB at 350-700 Hz, k=1.0, slow LFO on cutoff +-0.5 oct @ 0.1-0.25 Hz (or sync 2 bars)
-> phaser (6.7) 4 stages, 0.08 Hz, depth 0.5 (the classic movement)
-> tanh(2x) -> LP 2.5 kHz -> HP 110 Hz, + separate sine sub
```

### 4.4 Rolling melodic-techno bass (Rival Consoles / Afterlife-style 16ths)
```
osc: saw + square at -6 dB (or saw alone), 1 voice, phase reset; sub sine at -3 dB
filter: ladder, base 180 Hz, k 1.2, keytrack 50%, env +2.7 oct, filter env D 140 ms S 0
amp: A 1 ms, D 180 ms, S 0.15, R 80 ms   (notes on 16th offbeats: x-xx x-xx pattern or off-16ths)
accent: velocity -> env amount +-0.5 oct and decay +-40 ms (makes it "roll")
drive: tanh(1.6x) post-filter -> LP 4 kHz
sidechain: -6 to -10 dB, attack 0.5 ms, hold 10 ms, release 110-140 ms at 124-128 BPM
modulate base cutoff slowly over 16-32 bars (+-0.8 oct) for the build
```

---

## 5. Pads, plucks, arps, leads, keys

### 5.1 Warm analog pad (Juno/Prophet hybrid)
```
OSC1: saw; OSC2: pulse pw 0.45 with PWM LFO 0.3 Hz +-0.15 (or saw at +7 cents); sub square -1 oct at -12 dB
unison: 2 per osc, spread 10 cents, random phase, drift (1.3)
mix: noise -30 dB (adds "air" that the filter shapes)
filter: ladder 24 dB, base 1400 Hz, k 0.8, keytrack 40%
fenv: A 1200 / D 2500 / S 0.55 / R 4000 ms, amt +1 oct
aenv: A 900-2500 / D 1000 / S 0.9 / R 3500-6000 ms
LFO1: cutoff +-0.25 oct, 0.07 Hz triangle, per-voice random phase
HP 180 Hz in the mix; Juno chorus mode I (6.6) mix 50%; reverb send 35-50% (Dattorro decay 0.88)
```

### 5.2 Evolving "Max Cooper" pad
Same as 5.1 plus: OSC2 a slow wavetable-ish morph (crossfade saw→triangle with a 0.03 Hz LFO), a formant band-pass bank at 15% wet (5.8) moving between vowels every 8 bars, granular cloud send (6.8) at 20%, and a shimmer send at 10%. Add an amplitude LFO of ±1.5 dB at 0.13 Hz with a different phase per voice.

### 5.3 Pluck that does NOT ring like a bell
**Why KS rings like a bell:** with loop gain ≈ 0.996–0.999 and a 2-tap averaging loop filter, the high partials die in milliseconds but the fundamental lasts seconds. After about 200 ms what remains is close to a pure sine, which the ear hears as a mallet/bell/glock tone. The excitation (full-band white noise) adds a bright "ping".

**Primary recommendation: subtractive pluck**, which is the sound of this genre:
```
osc: saw + saw(+5 cents) (or saw + square 50%), phase reset, 1-2 voices
filter: ladder k 1.4, base 300 Hz, keytrack 80%, env +3.5 oct
fenv: A 0 / D 220 ms / S 0 / R 220 ms   (exponential)
aenv: A 1 ms / D 450 ms / S 0 / R 350 ms     <- amp decays slower than filter: "warm" tail
velocity -> env amount +-0.7 oct
post: tanh(1.3x) -> HP 200 Hz -> chorus 30% -> tape delay dotted 1/8 (fb 35%) -> plate 25%
```
Variants: "Hopkins felt pluck": base 180 Hz, D 160 ms, add 5% noise, LP the delay returns at 2.5 kHz. "Glassy pluck": square wave and k 2.2.

**If KS is used** (it suits muted guitar or kalimba textures), fix it explicitly:
```js
// delay N = fs/f0 - 0.5 (compensate filter delay), fractional via 1st-order allpass
// Set decay time explicitly instead of a magic 0.996:
const loopGain = Math.pow(10, -3 / (f0 * T60));   // T60 in s, e.g. 0.6-1.2 s for plucks
// Loop LP: one-pole with brightness b in 0..1: y = b*x + (1-b)*y1  (b 0.3-0.6 = darker)
// Excitation: noise burst of length N, pre-filtered with LP 1.5-4 kHz (velocity-controlled)
//            + pick-position comb: exc[n] - exc[n - round(beta*N)], beta 0.1-0.25
// Gate: multiply output by amp env (D = T60*0.6, S 0) so notes never ring unattended
// Body: two broad BP resonances (180 Hz Q2, 520 Hz Q2) at 20% for wood instead of bell
```

### 5.4 Arp
```
osc: saw + pulse 0.3 at -4 dB; 1 voice; filter ladder base 650 Hz k 1.8 kt 70% env +3 oct D 160 ms
aenv: A 1 / D 260 / S 0.1 / R 180; 16th or 1/16-triplet; gate 50-70%
mod: filter base slowly +-1 oct over 16 bars; per-note random +-0.15 oct
fx: ping-pong delay 3/16 (dotted 1/8) fb 40%, delay LP 3 kHz HP 300 Hz; plate 20%
```

### 5.5 Lead
```
mono, legato glide 60 ms (exponential in pitch), 2 saws +-6 cents
ladder base 1800 Hz k 1.0; fenv D 500 ms S 0.4 amt +1 oct
vibrato: delayed 350 ms, fade-in 400 ms, 5.2 Hz, +-12 cents; plus drift
fx: MS-20-ish drive optional: SVF LP with tanh(1.8x) in the band feedback; tape delay 1/4 fb 30%; hall 25%
```

### 5.6 Felt piano / electric piano without the cheese: modal synthesis
Sampling is out (no assets), and FM tends toward the DX7 cliché. Use **modal synthesis**: a bank of damped resonators struck by a soft hammer pulse. It is cheap (about 3 mul-adds per partial per sample) and very natural.

**Felt piano (Ólafur Arnalds/Hopkins-style "Una Corda"):**
```js
// partials n = 1..P (P = 10-14 for low notes, 6-8 high notes; skip any partial with f >= 0.45*fs)
// stiff-string inharmonicity: f_n = n*f0*Math.sqrt(1 + B*n*n), B = 0.0002 (mid), 0.0005 (high), 0.0001 (bass)
// amplitude: a_n = 1/n^1.2 * hammerSpectrum(n*f0); hammerSpectrum = LP at fc = 800 + 1800*vel Hz (felt!)
// decay: T60_n = T60_1 / (1 + 0.35*(n-1)),  T60_1 = 4-8 s (low) .. 1.5 s (high)  (damper up: x3)
// two "strings" per partial detuned +-0.6 cents -> natural beating & double decay
// resonator (2-pole, impulse-invariant):
//   r = Math.pow(10, -3 / (T60_n * fs));  w = 2*PI*f_n/fs
//   y = 2*r*Math.cos(w)*y1 - r*r*y2 + gain_n * x;   y2 = y1; y1 = y;
// excitation x: raised-cosine pulse, width 2.5 ms (soft) .. 0.8 ms (hard) + 2% noise
// add "mechanics": 25 ms band-passed (BP 1.2 kHz Q 1) noise thump at -24 dB on note-on and note-off
// release: on note-off multiply r by 0.9985 per-sample-equivalent (damper), i.e. T60 -> 0.15 s
// post: LP 5-7 kHz, tape saturation, Dattorro decay 0.8 at 30%, gentle compression
```
Cost: 16 voices × 12 partials × 2 strings ≈ 384 resonators × 48k ≈ 18.4 M mul-adds/s. That is fine in JS (about 15–30 ms/s), but cap polyphony and drop partials above 8 kHz.

**Rhodes-like EP** (modal, not FM): partials at 1×, 2× (−10 dB), 3× (−22 dB) with T60 4 s, 3 s, 1.5 s, plus a "tine" partial near 6.9× to 7.2× f0 at −14 dB with T60 60 ms (this is the bell, kept brief). Then a pickup nonlinearity `y = x + 0.35*x*x - 0.1*x*x*x` (asymmetric "bark" that grows with velocity) and DC block. Tremolo 4.5 Hz ±2 dB with an autopan variant. Chorus mode I. The tine ratio being *short* is what avoids the cheese.

### 5.7 String ensemble (Solina-style)
```
osc: saw (or two saws +-4 cents), paraphonic feel: fixed amp env per voice A 400 ms R 1200 ms
filter: SVF LP 5 kHz Q 0.6, HP 220 Hz, gentle bell -3 dB at 1 kHz
ENSEMBLE (the Solina sound): 3 modulated delay lines, base delay 6 ms each,
   each modulated by slow + fast sine:  d_i(t) = 6ms + 1.8ms*sin(2PI*0.63*t + phi_i) + 0.25ms*sin(2PI*6.3*t + phi_i)
   phi_i = 0, 2PI/3, 4PI/3; outputs mixed L = d1+0.6*d2, R = d3+0.6*d2; wet 100% (dry 0-30%)
-> plate 35% -> optional tape
```

### 5.8 Choir / vox pad
Source: saw + pulse (0.3), slight vibrato 5 Hz ±8 cents, noise −24 dB (breath). Formant bank of 4 SVF band-passes in parallel. Interpolate formant frequencies between vowels over 2–8 s.

| Vowel (male-ish) | F1 | F2 | F3 | F4 | Gains (dB) |
|---|---|---|---|---|---|
| "ah" /a/ | 730 | 1090 | 2440 | 3400 | 0, −4, −14, −20 |
| "oh" /o/ | 570 | 840 | 2410 | 3400 | 0, −5, −20, −25 |
| "oo" /u/ | 300 | 870 | 2240 | 3300 | 0, −8, −22, −30 |
| "eh" /e/ | 530 | 1840 | 2480 | 3500 | 0, −8, −12, −20 |
| "ee" /i/ | 270 | 2290 | 3010 | 3700 | 0, −14, −16, −24 |

Bandwidths of about 80, 90, 120 and 150 Hz (Q = f/BW). Shift all formants ×1.15 for a female choir. Then ensemble (5.7) and a long reverb at 50%. These are the classic Peterson–Barney-style averages.

---

## 6. Effects

### 6.1 Dattorro plate (complete topology, verified constants)
All lengths are in samples at Dattorro's **29761 Hz**. Scale: `len = Math.round(n * fs / 29761)` **[verified: Dattorro 1997, cross-checked with khoin/DattorroReverbNode where the second-based constants map to these sample counts]**.

```
INPUT (mono = 0.5*(L+R)):
  predelay (0-100 ms)
  bandwidth LP:     lp1 += bandwidth*(x - lp1)            bandwidth default 0.9995
  4 input allpasses: 142, 107  (g = inputDiffusion1 = 0.75)
                     379, 277  (g = inputDiffusion2 = 0.625)
TANK (figure-8; "split" = diffused input fed to both halves):
  LEFT:  AP_mod 672 (g = -decayDiffusion1 = -0.70, excursion +-16 samples)
         delay 4453
         damping LP:  lp2 = (1-damping)*x + damping*lp2     damping default 0.0005
         * decay
         AP 1800 (g = decayDiffusion2 = 0.50)
         delay 3720 -> * decay -> into RIGHT input
  RIGHT: AP_mod 908 (g = -0.70, excursion +-16, LFO in quadrature)
         delay 4217 -> damping LP -> * decay -> AP 2656 (g = 0.50) -> delay 3163 -> * decay -> into LEFT input
  decay default 0.5;  decayDiffusion2 = clamp(decay + 0.15, 0.25, 0.50)
OUTPUT taps (read offsets from each line's write head), x0.6:
  yL = +d4217[266] +d4217[2974] -ap2656[1913] +d3163[1996] -d4453[1990] -ap1800[187] -d3720[1066]
  yR = +d4453[353] +d4453[3627] -ap1800[1228] +d3720[2673] -d4217[2111] -ap2656[335] -d3163[121]
```

```js
// Allpass (lattice), delay buffer buf with length N:
//  d = buf[r]; w = x - g*d; buf[w_idx] = w; y = d + g*w;
// Modulated AP: read at fractional position N + exc*sin(phase) with linear or (better) allpass interpolation.
// LFO ~0.5-1.0 Hz; excursion 16 samples @29761 -> ~26 samples @48k.
// All buffers: one big Float32Array with offsets, power-of-two masks for wrap-around (no modulo cost).
```

Settings for this genre:
| Space | decay | damping | bandwidth | predelay | exc. rate | wet send |
|---|---|---|---|---|---|---|
| Tight drum plate | 0.45 | 0.35 | 0.85 | 5 ms | 0.7 Hz | 10–15% |
| Vocal/pluck plate | 0.7 | 0.25 | 0.8 | 20 ms | 0.6 Hz | 20–30% |
| Huge pad space | 0.88–0.93 | 0.4–0.6 | 0.6–0.75 | 40–60 ms | 0.3–0.5 Hz | 35–60% |
| "Infinite" freeze | 0.97–0.99 (input muted) | 0.5 | — | — | 0.25 Hz | — |

Always HP the reverb *input* at 150–250 Hz and LP the *return* at 6–9 kHz (7.5). The khoin worklet implementation uses defaults bandwidth 0.9999, decay 0.5, damping 0.005, excursion rate 0.5, excursion depth 0.7, wet 0.3, dry 0.6 **[verified]** and is a good JS reference. Note that its `damping` is the LP *coefficient* `(1-d)` convention.

### 6.2 Large FDN hall (alternative or second reverb for "huge spaces")
Signalsmith's design **[verified]**: diffuser of **4 steps × 8 channels**. Each step has random delays within equal sub-ranges, a shuffle plus polarity flips that differ per step, and a **Hadamard** mix. Step lengths are 20, 40, 80, 160 ms (or a 0–60 ms range for small rooms). Then an 8-channel feedback loop with delays of **100–200 ms** and a **Householder** matrix. Diffuser cost: Hadamard is N·log2(N) adds.

```js
// Householder 8x8 in-place (cost: 8 adds + 8 mul-adds):
function householder8(v) { let s = 0; for (let i=0;i<8;i++) s += v[i]; s *= -2/8; for (let i=0;i<8;i++) v[i] += s; }
// Hadamard 8 in-place (recursive butterflies, then scale 1/sqrt(8)):
function hadamard8(v){ for(let h=1;h<8;h*=2) for(let i=0;i<8;i+=2*h) for(let j=i;j<i+h;j++){
  const a=v[j], b=v[j+h]; v[j]=a+b; v[j+h]=a-b; } for(let i=0;i<8;i++) v[i]*=0.35355339; }
// Per-line feedback gain for a target RT60 (seconds): g_i = 10 ** (-3 * delaySamples_i / (RT60 * fs))
// HF damping per line: one-pole LP, with a lower RT60 at high frequency (RT60_HF = RT60 * 0.4..0.6):
//   choose the LP so the gain at ~5 kHz equals 10 ** (-3 * d_i / (RT60_HF * fs)) / g_i
// Modulate 2-4 of the 8 feedback delays by +-0.3-1.0 ms at 0.1-0.7 Hz (decorrelates, removes metallic ring)
// Output: L = sum of even channels, R = sum of odd channels (or orthogonal taps)
```
For a 6–12 s pad hall, RT60 is 6–12 s, HF RT60 ratio 0.45, predelay 30 ms, and modulation ±0.8 ms. Use the Dattorro plate for drums and plucks and the FDN for pads. Two reverb buses is normal practice.

### 6.3 Short room / early reflections
FDN with 4–8 lines of 7–37 ms and RT60 0.3–0.6 s, or a 6–8 tap delay (taps at 7, 11, 17, 23, 29, 37 ms with gains 0.7 down to 0.25, alternating L/R) followed by 2 allpasses (g 0.6). It is cheap and adds "expensive" glue to drums.

### 6.4 Shimmer
Valhalla's practical advice **[verified]**: pitch +12 semitones. Use large stereo modes for the smoothest result. Keep modulation depth low because the pitch shifter already adds random modulation. Diffusion around 0.9 for reverberant results (below 0.5 sounds like a pitched echo). Use a dark color mode to roll off the highs and the aliasing in the feedback path.

Topology: reverb tank output → pitch shifter (+12) → HP 300 Hz → LP 5–7 kHz → × feedback (0.25–0.55) → back into the reverb input. Pitch shifter: two delay taps whose delay ramps by a sawtooth (window 60–100 ms), crossfaded with a Hann (`sin²`) window offset by half a period:
```js
// ratio r = 2 (octave up): delay changes at rate (1 - r) = -1 sample per sample
ph += (1 - r) / winSamples; ph -= Math.floor(ph);          // 0..1 sawtooth
const d1 = ph * winSamples, d2 = ((ph + 0.5) % 1) * winSamples;
const w1 = Math.sin(Math.PI * ph) ** 2, w2 = 1 - w1;
y = w1 * readFrac(d1) + w2 * readFrac(d2);
```
Keep the shimmer send at 5–15%. More than that turns into "cathedral cheese".

### 6.5 Tape delay with wow, flutter, saturation and ping-pong
```
delay time: tempo-synced, smoothed with a one-pole (tau 150-400 ms) so time changes glide like a tape motor
modulation of delay time (ms):
   wow:     +-(0.6..1.5) ms  sine/smoothed random at 0.4-1.2 Hz   (drift: add slow random, 0.05 Hz)
   flutter: +-(0.03..0.1) ms at 6-12 Hz (sum of 2 sines at irrational ratio, e.g. 7.1 and 11.3 Hz)
read: cubic Hermite or Lagrange-3 interpolation (linear interpolation dulls and adds zipper at mod rates)
feedback path: HP 180-300 Hz -> LP 2.5-4.5 kHz (lower each repeat: "darkening repeats")
               -> tanh(1.4*x)/1.4 -> * feedback (0.3-0.6, never > 0.9 without the tanh)
ping-pong: L-in only, feedback cross-wired L->R->L; or input mono to L, feedback swaps channels
mix: wet 15-30% (send), delay returns HP 300 Hz
noise: tape hiss -72 dBFS pink, optional
```
ChowTape's controls are a good reference set: wow (depth, rate, variance, drift), flutter (depth, rate), tape speed 3.75–30 ips with speed-dependent loss filters, hysteresis drive, saturation and bias **[verified: ChowTape manual]**.

### 6.6 Juno chorus (verified constants)
From pendragon-andyh's Juno-60 analysis **[verified]**: one **triangle** LFO drives two 256-stage BBD lines, with the **right channel's modulation inverted** (180° apart).
- **Mode I:** 0.513 Hz, delay 1.66–5.35 ms
- **Mode II:** 0.863 Hz, delay 1.66–5.35 ms
- **Mode I+II:** 9.75 Hz, delay 3.3–3.7 ms (mono output, a fast vibrato-like shimmer)
- A 12 dB low-pass before the BBD. Effective BBD rate is about 70 kHz, so bit-crush artefacts are minimal. No compander.
- Service-note values: Juno-60 0.5 / 0.83 Hz, Juno-6 0.4 / 0.67 / 8.06 Hz.

```js
// lfo: triangle in [0,1]; center c = (dmin+dmax)/2, depth h = (dmax-dmin)/2
const tri = 1 - 2 * Math.abs(phase - 0.5) * 2;   // -1..1
const dL = c + h * tri, dR = c - h * tri;         // inverted for right
// input mono (sum of L+R)*0.5 -> LP 10 kHz (2-pole) -> two delay reads (Hermite) -> LP 8 kHz
// out L = dry + wetL, R = dry + wetR   (the Juno mixes 1:1, which gives the stereo spread)
// optional analog: add -70 dB hiss, tanh(1.1x) on the BBD input
```
Use mode I on pads and plucks and mode II on strings. Mode I+II is a special effect.

### 6.7 Phaser
4 stages (gentle) or 6 stages (classic), first-order allpasses `a = (tan(πf/fs) - 1)/(tan(πf/fs) + 1)`, `y = a*x + x1 - a*y1`. Sweep 250–2200 Hz exponentially, LFO 0.05–0.4 Hz, feedback 0.3–0.6, mix 50%. Use stereo by offsetting the LFO phase 90°. Excellent on reese bass and pads.

### 6.8 Granular cloud / granular delay
```
buffer: 4 s circular (record input continuously; freeze = stop writing)
grain rate: 8-30 grains/s (density), Poisson-ish: next = mean*(-Math.log(1-rand()))
grain length: 60-250 ms, window Hann (or Tukey 0.5 for denser texture)
position: now - (0.1..2.0 s) + jitter +-300 ms
pitch: choose from [0, 0, +12, -12, +7] semitones (scale-aware); +-8 cents spray
pan: random +-0.8; reverse probability 15%
pool: preallocate 32 grain slots in Float32Arrays (start, pos, inc, len, age, gainL, gainR) - no objects
feedback: 0-40% back into the buffer -> LP 6 kHz
send into the FDN hall afterwards: the Max Cooper "cloud" texture
```

### 6.9 Tape saturation model (cheap, musical)
```
pre-emphasis: high shelf +4 dB @ 3 kHz (SVF)
nonlinearity: y = tanh(drive*x + bias) - tanh(bias), drive 1.2-2.5, bias 0.05-0.15 (2nd harmonic)
"hysteresis-lite": y_out = y_prev + (y - y_prev) * slewCoef   (slewCoef ~0.6-0.9, gentle HF compression)
de-emphasis: high shelf -4 dB @ 3 kHz; head bump: bell +1.5 dB @ 70 Hz Q 1.0, dip -1 dB @ 140 Hz
HF loss: LP 14-16 kHz (15 ips), 10 kHz (7.5 ips lo-fi)
DC blocker after
oversample 2x if drive > 2 on full mixes (polyphase halfband)
```

### 6.10 Transient shaper
```js
// two envelope followers on |x| (or x^2 for RMS-ish)
const af = 1 - Math.exp(-1/(0.0005*fs)), rf = 1 - Math.exp(-1/(0.020*fs));   // fast: 0.5 ms / 20 ms
const as = 1 - Math.exp(-1/(0.015*fs)), rs = 1 - Math.exp(-1/(0.120*fs));   // slow: 15 ms / 120 ms
// e += (a > e ? atk : rel) * (a - e)
const diff = 20*Math.log10((eFast + 1e-9) / (eSlow + 1e-9));   // >0 during transients
const gainDb = attackAmt * Math.max(0, diff) - sustainAmt * Math.max(0, -diff);
y = x * 10 ** (Math.min(12, Math.max(-12, gainDb)) / 20);     // compute gain at control rate (every 8 samples) to save log/pow
```

### 6.11 Sidechain ducking: use a deterministic envelope, not a detector
The engine knows when the kick fires, so generate the duck curve directly. It is sample-accurate and pumps identically every time. At 120 BPM a beat is 500 ms. At 125 BPM it is 480 ms. At 130 BPM it is 461.5 ms.

```js
// on each kick at time t0, for t = now - t0:
function duck(t, depthDb, atk, hold, rel) {      // seconds
  if (t < atk) return dbToGain(-depthDb * (t / atk));
  if (t < atk + hold) return dbToGain(-depthDb);
  const x = Math.min(1, (t - atk - hold) / rel);
  const shape = 1 - (1 - x) ** 2.2;             // ease-out: fast early recovery, smooth landing
  return dbToGain(-depthDb * (1 - shape));
}
```
| Bus | Depth | Attack | Hold | Release (125 BPM) |
|---|---|---|---|---|
| Sub/bass | 8–14 dB | 0.3–1 ms | 15–40 ms | 120–180 ms |
| Pads | 4–8 dB | 2–5 ms | 20 ms | 250–380 ms (clear pumping) |
| Reverb returns | 3–6 dB | 5 ms | 30 ms | 300–420 ms |
| Rumble bus | 15–24 dB | 0.5 ms | 40 ms | 180–260 ms |
| Arp/pluck | 2–4 dB | 2 ms | 10 ms | 150 ms |

The release must finish before the next kick: `atk + hold + rel < 0.9 × beat`. Multiple bus curves can share a single precomputed lookup table per tempo.

### 6.12 Bitcrush (sparingly)
Sample-and-hold at `fs / factor` (factor 2–8) plus quantization to `bits` (6–12) with TPDF dither. Mix 10–25% in parallel, then LP 8 kHz. On a whole mix it becomes the "fizz" problem again, so use it only on percussion or a send.

### 6.13 Multiband (two- or three-band) compression and crossovers
Linkwitz-Riley 4th order (LR4) = two cascaded Butterworth 2nd-order sections (SVF with `k = Math.SQRT2`, i.e. Q = 0.7071) for LP and HP at the same fc. LP + HP sums to an allpass, which gives flat magnitude. Crossovers at 120 Hz and 2.5 kHz. Use it to (a) mono the low band, (b) apply a gentle 2:1 on the low band with attack 30 ms and release 150 ms, and (c) de-harsh the high band with a 3:1 compressor with fast attack (1 ms) and release 60 ms, threshold set so it engages only on peaks.

---

## 7. Mixing and mastering targets for this genre

### 7.1 Loudness
- **Streaming normalization:** Spotify normalizes to **-14 LUFS integrated** (ITU-R BS.1770). It recommends **true peak below -1 dBTP**, or **below -2 dBTP if the master is louder than -14 LUFS**. Spotify's "Loud" setting targets -11 LUFS with a limiter at -1 dB, 5 ms attack and 100 ms decay **[verified: Spotify artist docs]**. Apple Music is about -16. YouTube is about -14.
- **Club techno masters** commonly sit around -9 to -6 LUFS integrated. Melodic and "listening" techno (Cooper, Hopkins albums) is usually in the -11 to -8 range with more dynamics.
- **Recommendation for this browser engine:** auto-gain the master to **-11 LUFS short-term (3 s window) ±1**, with a hard **-1.0 dBTP ceiling**. That is loud enough to compete in a tab, avoids limiter pumping, and leaves room for the generative dynamics. Expose a "loud" mode at -9 LUFS for club playback. Going louder than -8 in real time with a simple limiter is what produces fizz and pumping.

**LUFS meter (BS.1770 K-weighting at 48 kHz)** for monitoring and auto-gain:
```js
// Stage 1 (high shelf ~+4 dB above 1.5 kHz): b = [1.53512485958697, -2.69169618940638, 1.19839281085285]
//                                            a = [1, -1.69065929318241, 0.73248077421585]
// Stage 2 (RLB high-pass ~38 Hz):            b = [1, -2, 1]
//                                            a = [1, -1.99004745483398, 0.99007225036621]
// For other sample rates, derive via bilinear transform (see pyloudnorm) or resample the meter path.
// momentary (400 ms) / short-term (3 s) loudness: L = -0.691 + 10*log10(meanSquare_L + meanSquare_R)
// integrated: 400 ms blocks with 75% overlap, absolute gate -70 LUFS, relative gate -10 LU below ungated mean
```
Use running sums over ring buffers of per-block mean squares. That is O(1) per block and has no allocation.

### 7.2 Spectral balance
- Overall long-term spectrum tilt of a modern electronic mix is close to **pink plus a slight downward slope**, about -4 to -5 dB/octave above 200 Hz on a 1/3-octave RTA. Melodic techno has a strong 40–70 Hz sub plateau, a dip around 200–400 Hz (mud zone), a smooth 1–4 kHz, and a gently falling top with no hump at 8–12 kHz.
- **Self-check:** compute 1/3-octave band energy in Node renders and compare it to a stored reference curve. Flag mixes where 2–5 kHz exceeds the reference by more than 3 dB ("harsh") or 150–400 Hz exceeds it by more than 3 dB ("muddy").
- **Kick vs. bass:** kick fundamental and sub note should not fight. Either tune both to the key with the duck, or put the kick at 50–60 Hz and the sub at 40–50 Hz.

### 7.3 Per-element HP/LP habits
| Element | HP | LP | Notes |
|---|---|---|---|
| Kick | 25–30 Hz | 10–12 kHz | Mono |
| Sub | 25–30 Hz | 120–140 Hz | Mono |
| Bass harmonics | 90–120 Hz | 3–5 kHz | Width ≤ 30% above 150 Hz |
| Snare/clap | 120–200 Hz | 12–14 kHz | |
| Hats/shaker | 5–8 kHz (closed), 3 kHz (open) | 15–16 kHz | |
| Pads | 150–250 Hz | 8–12 kHz | Wide |
| Plucks/arps | 180–300 Hz | 9–12 kHz | |
| Lead | 200 Hz | 12 kHz | Center-ish |
| Keys/felt piano | 80–120 Hz | 7–9 kHz | |
| Reverb returns | 200–400 Hz | 6–9 kHz | See 7.5 |
| Delay returns | 250–400 Hz | 3–5 kHz | |

### 7.4 Stereo width by band
- **Below 120 Hz:** mono (M/S, side HP at 120–150 Hz with LR4, or simply sum to mono under the crossover).
- **120 Hz to 1 kHz:** moderate (side about -6 dB relative to mid).
- **Above 1 kHz:** wide is fine (pads, reverbs, hats).
- Never use Haas-delay widening on bass or kick. Check mono compatibility: summing the master to mono should lose under 1.5 dB of level on pads.

### 7.5 Reverb return EQ
HP 200–400 Hz (keeps the low end clean, which is the main cure for mud). LP 6–9 kHz (removes fizz, makes it sound "expensive"). Cut 2–3 dB around 2–3 kHz on big halls. Duck the return by 3–6 dB with the kick (6.11). Predelay 20–60 ms on pads so the source stays distinct.

### 7.6 Glue bus compressor (master or drum bus)
SSL-style feed-forward RMS compressor: ratio 2:1, attack 10–30 ms, release 100–300 ms (auto or tempo-synced), threshold for **1–3 dB GR** on the master (2–4 on drums), soft knee 6 dB, sidechain HP at 80–100 Hz so the kick does not pump the whole mix. Gain computer in dB, with the attack and release smoothing in the dB domain.

### 7.7 True-peak lookahead limiter (Signalsmith design, verified)
Pipeline **[verified: Signalsmith limiter article]**:
1. `need[n] = min(1, T/|x[n]|)`
2. Moving minimum over `A + H` samples (attack plus hold)
3. Release stage: drop immediately and recover with exponential or constant-time slew
4. Smooth with a finite moving average (cascaded box filters) of length ≤ A, so the gain is guaranteed to be reached
5. Output `x` delayed by A samples × gain

Article settings: 5 ms attack, 15 ms hold, 40 ms release. For inter-sample peaks, compute `need` from a 4× upsampled peak estimate.

```js
// Settings for this engine: A = 2 ms (96 samples), H = 3 ms, release 60-120 ms, ceiling -1.0 dBTP
// Moving min in O(1) amortised: monotonic deque in preallocated Int32Array (indices) + Float32Array (values)
// Box smoothing: two cascaded moving averages of length A/2 each (running sums - O(1))
// True peak: 4x polyphase FIR (e.g. 12 taps per phase, Kaiser beta ~7) on the sidechain only;
//   take max |x| of the 4 interpolated points per sample as the detector input.
// Safety: final hard clip at the ceiling (never reached if the above is correct).
```
Latency: about 2–5 ms. That is fine for a generative engine. Keep the delay compensation consistent between the browser and Node.

---

## 8. Real-time performance in AudioWorklet

### 8.1 Budget
- Render quantum is **128 frames**: 2.67 ms at 48 kHz, 2.9 ms at 44.1 kHz **[verified: Chrome AudioWorklet design-pattern article, ~3 ms per quantum]**.
- Target **≤ 40–50%** of that on a mid-range laptop (≤ 1.3 ms per block). That leaves headroom for GC in *other* realms, thermal throttling, and low-end machines. Chrome shows render capacity in the DevTools Web Audio panel. Newer Chromium builds have an experimental `AudioContext.renderCapacity`. Use it if present, guarded.
- Rough costs (V8, per sample): PolyBLEP osc 3–6 ns. ZDF ladder with fastTanh 8–15 ns. SVF 3–5 ns. Env 1–2 ns. Dattorro plate 40–80 ns. 8×8 FDN 60–120 ns. Modal resonator ~1 ns. Granular grain 5–10 ns.
- **Voice-count guidance:** pads 8 voices × 4 osc (unison included), plucks/arp 8 voices × 2 osc, bass mono, felt piano 10 voices × 10 partials × 2, drums about 6 simultaneous hits. Two reverbs, one delay, chorus, master chain. That should land around 25–45% of budget. Add **voice stealing** (oldest released voice first, then quietest) with a 5 ms fade, and a **CPU governor**: if an EMA of block time measured in Node benchmarks or via renderCapacity exceeds 70%, reduce pad unison and piano partials.

### 8.2 Allocation-free processing (no GC in `process`)
- Preallocate everything in the constructor: voices as Structure-of-Arrays (`Float32Array`/`Float64Array` per parameter, indexed by voice), delay lines as one big `Float32Array` with power-of-two sizes and masks, grain pools, and event queues.
- In `process()`: no `new`, no array or object literals, no closures, no `.map`/`.forEach`/`for...of`, no destructuring, no string building, no `arguments`, and no `try/catch` in hot loops. Use plain indexed `for` loops.
- Copy hot state into local variables at block start and write back at block end. V8 optimizes locals much better than property access. Float64 locals are fine. Use `Float32Array` for buffers and `Float64Array` for filter and integrator state, which reduces precision drift in long-running IIRs and phases.
- Keep functions monomorphic (always pass the same types) and keep object shapes fixed.
- Do not grow arrays. Check `outputs[0].length` (channel count can change) without allocating.
- `process()` must `return true` to stay alive.

### 8.3 Denormals
JS math is float64. Decaying IIR states (reverb tails, resonators, envelopes) approach subnormal values (below about 1e-308 in doubles, 1e-38 when stored into Float32Array), and on x86 subnormal arithmetic can be 10–100× slower. Mitigations:
- Add a tiny alternating offset to filter inputs: `x += dn; dn = -dn;` with `dn = 1e-18`.
- Or flush per block: `if (Math.abs(s) < 1e-15) s = 0;` for each state variable.
- Kill voices when the amp env is below -100 dB and zero their state.

### 8.4 Parameter smoothing
One-pole per parameter: `p += (target - p) * c`, `c = 1 - Math.exp(-1 / (tau * fs))`, tau 5–20 ms for gains and cutoff (30–80 ms for "knob" moves on filter cutoff, 1–3 ms for gate-like changes). For expensive-to-map parameters (cutoff → `tan`), smooth in the parameter domain at control rate (every 16–32 samples) and linearly interpolate the derived coefficient per sample. Prefer custom smoothed fields set via messages over `AudioParam` for synth-internal parameters. AudioParams are good for a few master-level controls (they give sample-accurate automation for free, and k-rate parameters cost nothing per sample **[verified: Adenot]**).

### 8.5 Message passing patterns
- **Main → worklet:** `node.port.postMessage({type, ...})` for patch changes and note or pattern data. In `port.onmessage` (which runs outside `process`), *copy* into preallocated structures. Never hold references to message objects in the render path.
- **Sample-accurate events:** send events tagged with a target frame (`when` in `currentFrame` units, or seconds × sampleRate) a little ahead (50–100 ms lookahead), and keep them in a preallocated ring buffer sorted by time. In `process`, split the block at event boundaries. Better still, put the generative sequencer **inside the worklet** so timing is perfect and identical in Node offline renders. The main thread then only sends high-level intents (scene, density, seed).
- **Worklet → main (meters, scope, now-playing):** post at 20–30 Hz (every 12–16 blocks at 48 kHz). Reuse a small payload (a few numbers). Accept that structured clone allocates a little, which is fine at that rate.
- **Why not SharedArrayBuffer:** SAB requires the page to be in a secure context **and cross-origin isolated** (COOP + COEP headers) **[verified: MDN]**. A page opened from `file://` cannot send those headers, so `crossOriginIsolated === false` and SAB is unavailable (and `postMessage` of SAB throws). Design for `postMessage` only. Feature-detect SAB and use it opportunistically if the app is later served over HTTPS with the headers.

### 8.6 Loading the worklet from file://
- `file://` pages *are* secure contexts (MDN lists the `file` scheme as potentially trustworthy) **[verified]**, so `AudioWorklet` exists. But `addModule('./proc.js')` of a separate file can fail on `file://` because the file origin is opaque or unique (Firefox in particular blocks file fetches).
- **Robust pattern:** embed the processor source as a string (or `<script type="text/plain" id="worklet-src">`) and load it via a Blob URL:
```js
const src = document.getElementById('worklet-src').textContent;   // or a template string / fn.toString()
const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
await ctx.audioWorklet.addModule(url);
URL.revokeObjectURL(url);
const node = new AudioWorkletNode(ctx, 'engine', { numberOfInputs: 0, numberOfOutputs: 1,
  outputChannelCount: [2], processorOptions: { seed, sampleRate: ctx.sampleRate } });
```
- A `data:` URL is an alternative (WebKit fixed data-URL worklet modules in r270046, 2020) **[verified]**.
- Worklet scope has no `import` of other blob modules without extra Blob URLs, so **concatenate all DSP source into one string** (DSP core + processor wrapper).
- Resume the context on a user gesture (`ctx.resume()` in a click handler). Autoplay policy blocks otherwise.

### 8.7 Sharing DSP between the worklet and Node
Structure the code as:
```
dsp-core.js     // pure classes: Engine { constructor(fs, seed); render(outL, outR, n) }  no Web Audio APIs
worklet.js      // class P extends AudioWorkletProcessor { process(i, o) { engine.render(o[0][0], o[0][1], 128); return true; } }
                // registerProcessor('engine', P)
node-render.js  // import dsp-core; loop render(…, 128) into big Float32Arrays; write WAV
```
- In the browser, build the worklet string as `coreSource + workletSource` (fetching is not possible from file://, so keep the core inline in the HTML, or generate a single-file bundle with a tiny build script that inlines it).
- In Node, `dsp-core.js` should be a plain script or ESM with no DOM dependencies. Avoid `globalThis.sampleRate` (a worklet global) inside the core and pass `fs` explicitly.
- Optional: the `node-web-audio-api` package (IRCAM, Rust-backed) implements Web Audio including `OfflineAudioContext` and AudioWorklet in Node. It is not needed if the core is pure JS, and the direct-render path is faster and fully deterministic.
- Determinism: seeded PRNG (1.3), no `Math.random()`, no wall-clock reads in the core, and identical block size (128) in both environments so control-rate updates align.

### 8.8 Offline rendering in the browser (OfflineAudioContext)
`const off = new OfflineAudioContext(2, fs * seconds, fs); await off.audioWorklet.addModule(url); new AudioWorkletNode(off, 'engine', …).connect(off.destination); const buf = await off.startRendering();` This renders faster than real time with the same worklet, and it is useful for "export 3 minutes" in the browser. Adenot also recommends "baking" expensive effects offline where possible **[verified]**.

### 8.9 Recording output to WAV
- **Real-time capture:** in the worklet, copy each block into a preallocated chunk (e.g. 1 s `Float32Array`s) and, when one fills, `port.postMessage(chunk, [chunk.buffer])` (transfer, zero-copy) and allocate the next one *outside the hot path* (or recycle chunks returned from the main thread). The main thread accumulates the chunks and encodes them on stop.
- **WAV encoder** (32-bit float or 16-bit PCM with TPDF dither):
```js
function encodeWav(L, R, fs, float = true) {
  const n = L.length, ch = 2, bps = float ? 4 : 2, dataLen = n * ch * bps;
  const buf = new ArrayBuffer(44 + dataLen), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, float ? 3 : 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, fs, true); v.setUint32(28, fs * ch * bps, true); v.setUint16(32, ch * bps, true);
  v.setUint16(34, bps * 8, true); w(36, 'data'); v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const s = (c ? R : L)[i];
    if (float) { v.setFloat32(o, s, true); o += 4; }
    else { const d = (Math.random() - Math.random()) / 32768;            // TPDF dither (ok outside the core)
           v.setInt16(o, Math.max(-1, Math.min(1, s + d)) * 32767, true); o += 2; }
  }
  return new Blob([buf], { type: 'audio/wav' });   // in Node: Buffer.from(buf) -> fs.writeFileSync
}
```
- MediaRecorder on a `MediaStreamAudioDestinationNode` is simpler but produces lossy WebM/Opus. Use WAV for quality.

---

## 9. Implementation checklist (priority order)

1. PolyBLEP/BLAMP oscillators with an FFT alias unit test in Node.
2. ZDF ladder + Simper SVF with control-rate coefficient interpolation and fastTanh.
3. Exponential envelopes with overshoot attack and retrigger-from-current-level.
4. Per-voice drift and seeded PRNG.
5. Drum voices from section 3 with per-hit variation, and the rumble bus.
6. Bass as two layers (sub + harmonics) with HP/LP split and mono.
7. Subtractive pluck replacing KS. Felt-piano modal voice replacing FM EP.
8. Juno chorus, tape delay, Dattorro plate, FDN hall, deterministic sidechain curves.
9. Master: LR4 mono-below-120 Hz, glue compressor, lookahead true-peak limiter, LUFS auto-gain to -11 LUFS short-term, -1 dBTP.
10. Node offline renderer sharing `dsp-core.js`. Spectral-balance self-test (1/3-octave tilt vs reference, harshness and mud flags) and LUFS report per render.

---

## Sources

URLs fetched or consulted during this research (one line each):

- https://ccrma.stanford.edu/~dattorro/EffectDesignPart1.pdf — Jon Dattorro, "Effect Design Part 1: Reverberator and Other Filters" (JAES 1997). Plate topology and constants.
- https://raw.githubusercontent.com/khoin/DattorroReverbNode/master/dattorroReverb.js — public-domain AudioWorklet Dattorro implementation. Verified delay lengths, taps and defaults.
- https://github.com/el-visio/dattorro-verb — C Dattorro implementation (structure reference).
- https://www.kvraudio.com/forum/viewtopic.php?p=4644620 — KVR "Roland Supersaw" thread: JP-8000 detune ratios, random phase, key-tracked HPF, Szabo 11th-order fit.
- https://schollz.com/til/221103 — Zack Scholl note on the Szabo supersaw detune curve and SuperCollider port.
- https://ccrma.stanford.edu/wiki/Supersaw — CCRMA supersaw instrument page (general context).
- https://cytomic.com/files/dsp/SvfLinearTrapOptimised2.pdf — Andrew Simper, "Linear Trapezoidal Integrated SVF". Node equations and solved structure.
- https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf — Vadim Zavalishin, "The Art of VA Filter Design" (TPT/ZDF background).
- https://dafx.de/paper-archive/2004/P_061.PDF — Antti Huovilainen, "Non-Linear Digital Implementation of the Moog Ladder Filter" (DAFx-04). Per-stage tanh, 2× oversampling, half-sample delay.
- https://github.com/pendragon-andyh/Juno60/blob/master/Chorus/README.md — Juno-60 chorus analysis: LFO rates, delay ranges, inverted stereo LFO.
- https://groupdiy.com/threads/juno-60-chorus-lfo-frequency-too-fast.53861/ — measured Juno-60 chorus LFO periods (cross-check).
- https://speech.di.uoa.gr/ICMC-SMC-2014/images/VOL_2/1453.pdf — Werner, Abel, Smith, "The TR-808 Cymbal: a Physically-Informed, Circuit-Bendable, Digital Model" (ICMC-14). Oscillator frequencies and BP/HP values.
- https://dafx14.fau.de/papers/dafx14_kurt_james_werner_a_physically_informed,_ci.pdf — Werner, Abel, Smith, TR-808 bass drum model (DAFx-14). 49.5 Hz resonance, >1 octave 6 ms attack glide.
- https://www.soundonsound.com/node/4918183 — Gordon Reid, Synth Secrets "Practical Cymbal Synthesis" (SOS July 2002).
- https://csclub.uwaterloo.ca/~pbarfuss/bassdrumsynth.html — mirror of Synth Secrets "Synthesizing Bass Drums" (808/909 architectures).
- https://www.attackmagazine.com/technique/tutorials/adding-reverb-techno-kick/ — Attack Magazine techno kick reverb/rumble recipe.
- https://www.attackmagazine.com/technique/beat-dissected/rolling-techno/ — Attack Magazine "Rolling Techno" beat breakdown (131 BPM, swing, toms).
- https://signalsmith-audio.co.uk/writing/2021/lets-write-a-reverb/ — Signalsmith "Let's Write a Reverb": Hadamard diffuser, Householder FDN.
- https://signalsmith-audio.co.uk/writing/2022/limiter/ — Signalsmith lookahead limiter design.
- https://valhalladsp.com/?p=592074 — Valhalla DSP "Getting Started With Reverb Design, Part 3" (resource list).
- https://valhalladsp.com/?p=607 — Valhalla "ValhallaShimmer Tips and Tricks: Shimmering".
- https://ccrma.stanford.edu/~jatin/chowdsp/Products/ChowTapeManual.pdf — ChowTape manual (wow/flutter/hysteresis control set).
- https://dafx.de/paper-archive/details/Z5Ow_E5YHVxvndTAyeEuzA — Chowdhury, "Real-Time Physical Modelling for Analog Tape Machines" (DAFx-19), background.
- https://www.martin-finke.de/articles/audio-plugins-018-polyblep-oscillator/ — Martin Finke PolyBLEP oscillator tutorial (code verified).
- https://metafunction.co.uk/post/all-about-digital-oscillators-part-2-blits-bleps — overview of BLIT, BLEP, minBLEP and PolyBLEP trade-offs.
- https://mac.kaist.ac.kr/pubs/jnam-dafx09.pdf — DPW / alias-suppressed oscillator literature (DAFx-09), background.
- https://ccrma.stanford.edu/papers/alias-suppressed-oscillators-based-differentiated-polynomial-waveforms — Välimäki et al., DPW oscillators (paper page).
- https://developer.chrome.com/blog/audio-worklet-design-pattern — Hongchan Choi, AudioWorklet design patterns (128-frame quantum, ~3 ms budget, ring buffers, SAB/worker).
- https://padenot.github.io/web-audio-perf/ — Paul Adenot, "Web Audio API performance and debugging notes".
- https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts — MDN secure contexts (file: scheme is potentially trustworthy).
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer — MDN SharedArrayBuffer cross-origin isolation requirement.
- https://developer.mozilla.org/docs/Web/API/Worklet/addModule — MDN Worklet.addModule.
- https://bugs.webkit.org/show_bug.cgi?id=219166 — WebKit bug: audio worklet module from data: URL (fixed r270046).
- https://support.spotify.com/au/artists/article/loudness-normalization/ — Spotify loudness normalization (-14 LUFS, true-peak advice, Loud mode limiter).

Background references used from domain knowledge, not re-fetched this session: ITU-R BS.1770-4 (K-weighting coefficients and gating), Peterson & Barney vowel formant averages, Adam Szabo "How to Emulate the Super Saw" (2010, polynomial coefficients as widely circulated; spot-check them), Esqueda/Välimäki/Bilbao "Rounding Corners with BLAMP" (DAFx-16), Stilson & Smith "Analyzing the Moog VCF" (ICMC 1996), Will Pirkle "Designing Software Synthesizer Plug-ins in C++" (2nd ed.), and the Surge XT, Vital and Odin2 source trees (SVF and ladder practice).
