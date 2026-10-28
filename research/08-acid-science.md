# 08: Acid science (TB-303 voice, sequencing, processing, perception)

**Purpose.** This brief has two jobs. The first is to give a DSP-ready description of the TB-303 voice and sequencer. The second is to explain why acid works on the ear, so the composition rules can be grounded in it. It **replaces the "[I]" conventional values in 07 §D1** wherever the two differ. The main corrections are the cutoff range, the env-mod mapping, how the accent sweep works, the slide time constant and the gate length.

**Tags.**
- `[n]` = numbered source at the end.
- `[calc]` = my own computation from a cited equation or component value. The method is given inline, so you can re-derive it.
- `[practice]` = a production convention, not a measurement.
- `[I]` = inference or design judgement.

Where sources disagree, the disagreement is stated in the text.

---

## 0. The ten numbers that matter most

1. **Filter.** A 4-pole diode ladder that oscillates at **k = 17**, not 4. The resonant peak sits at **√2 × the per-stage frequency**. With no feedback, the −3 dB point is **~1/9.5 of the resonant frequency** `[1][8][calc]`.
2. **Bass loss.** Passband gain is **1/(1+k)**: −14 dB at k = 4, −22 dB at k = 12, −24 dB at k = 15. A **150 Hz high-pass in the feedback path** removes resonance at low cutoffs `[4][calc]`.
3. **Cutoff knob.** It sweeps the nominal resonant frequency from **~314 Hz to ~2.4 kHz** (exponential, ~2.9 octaves) `[4]`. The Devil Fish notes put the stock maximum around 2.5 kHz `[3]`.
4. **Env mod.** The modulation is **bipolar** around the knob value. The envelope peak reaches up to ~+3.2 octaves above it, and the decayed tail sits up to ~−1.3 octaves below it. The modulation **never reaches zero** on a stock 303 `[2][4]`.
5. **Filter envelope (MEG) decay.** **200 ms to 2 s** on normal notes, and **fixed at about 200 ms on accented notes** `[3]`.
6. **Amp envelope (VEG).** A fixed decay of about **3–4 s** that the gate cuts off. The end of a note takes about **16 ms** (8 ms hold, then 8 ms linear fall) `[3][5]`.
7. **Accent sweep.** A **1 µF capacitor charged through a diode and 47k–147k**, discharged through about 100k. The sweep peaks **~100 ms after the note starts**, and consecutive accents ratchet the cutoff higher. The amount of this smoothing is set by the **second gang of the resonance pot** `[2][5][calc]`.
8. **Slide.** An RC of **100 kΩ × 0.22 µF (τ = 22 ms)** on the pitch CV, which settles in about 60 ms. It works in the **log-frequency domain** and does not depend on tempo `[3][7][calc]`.
9. **Gate.** About **50–58 % of a 16th step**. A slide holds the gate across the whole step `[4][12]`.
10. **Rendering.** Run the oscillator, filter and distortion at **4× oversampling** (Open303 does this `[4]`). Use **polyBLEP** on the saw `[26]` and **antiderivative anti-aliasing (ADAA)** on the clipper `[27]`. Keep the resonant peak from sitting **static in 2.5–4 kHz**, where the ear canal adds 10–15 dB of gain `[29]`.

---

## 1. The TB-303 voice, stage by stage

### 1.1 Signal flow

The audio path runs:

> VCO (saw, or square shaped from the saw) → coupling and high-pass → 4-pole diode-ladder VCF with high-passed resonance feedback → VCA → output coupling and headphone amp

The control path has three parts:

- The **MEG** (main envelope generator) drives the VCF through **Env Mod**. On accented notes it also drives the VCA and the VCF through **Accent**.
- The **VEG** (volume envelope generator) drives the VCA.
- **Slide** is an RC on the pitch CV.

There is no LFO, no velocity and no self-oscillation `[15]`.

### 1.2 Oscillator

- **Saw.** It is made by an integrator with a reset. The reset edge is fast. None of our sources has published curvature measurements of the ramp. Open303 uses a plain saw ("SAW303") from mip-mapped wavetables `[4]`. Treat the saw as ideal, plus the high-pass coupling in §1.3. The coupling is what makes the scope trace tilt.
- **Square.** It is **not** a separate oscillator. A single transistor (Q8) fed by the saw acts as a threshold detector, followed by a level shifter `[6]`. Its non-ideal features are:
  - **The two edges differ.** The edge at the saw reset is sharp. The mid-cycle edge is slower because the shaper's gain is finite. The result is an S-curve in the middle of the cycle with squarer ends `[6]`.
  - **Even harmonics leak through** from the saw, most audibly at higher pitches `[6]`.
  - **The duty cycle varies from unit to unit.** Transistor mismatch means each unit switches at a slightly different point. Forum estimates range from "near-perfect" to clearly off-square `[6]`.
  - **Open303's model** is `square = −tanh(69.98·saw + 4.37)`. The gain is 36.9 dB and the offset is 4.37, and the result is circularly shifted by 180° relative to the saw `[4]`.
  - **What that model implies** `[calc]`:
    - The switching threshold is at saw = −0.062, so the **duty cycle is ≈ 47/53 %**.
    - The tanh passes from −0.96 to +0.96 over Δsaw ≈ 0.057. With the saw spanning 2.0 per period, the **mid-cycle edge is ~2.9 % of the period wide**, while the reset edge is instantaneous.
  - **For implementation:** use a shaped saw, then a one-pole high-pass. This is better than a band-limited ideal pulse.
- **Pitch range.** The sequencer covers one octave of keys (C to C) plus per-step UP and DOWN. Its CV output spans 1–5 V at 1 V/oct `[3]`. In practice bass lines live around **E1–C3 (41–131 Hz)** `[practice]`.
- **Note-on latency.** A stock 303 starts the note **1–5 ms (typically 4 ms) after the step**. The Devil Fish does it in under 0.5 ms `[3]`. This adds a little "lazy" feel. It is optional to emulate (0–4 ms).

### 1.3 Fixed coupling filters

These are fitted to measurements in Open303 `[4]`:

| Filter | Where | Value |
|---|---|---|
| One-pole high-pass | Before the VCF (runs oversampled) | **44.5 Hz** |
| One-pole high-pass | In the resonance feedback loop | **150 Hz** |
| One-pole high-pass | After the VCF | **24.2 Hz** |
| One-pole all-pass | After the VCF | **14.0 Hz** |
| Band-reject (notch) | After the VCF | **7.5 Hz**, bandwidth 4.7 octaves |

- **Stinchcombe** shows that including the real coupling capacitors gives a 10-pole, 6-zero transfer function. The extra poles cluster around **~10 Hz**. They make the main resonant peak frequency-dependent and create a second, low-frequency resonance `[1]`.
- **Devil Fish** gives the stock output as **−5 dB at 32 Hz** (−1 dB after the mod) `[3]`.

**Consequence:** the 303 is not a sub-bass instrument. Its lowest octave is already rolled off, before the resonance bass loss in §1.4 is applied.

### 1.4 The VCF: diode ladder

**Structure.** Four RC sections built from transistors wired as diodes, so the sections are **not buffered** from one another. Global negative feedback through the resonance pot provides the resonance `[1][10]`.

**Linear core.** Stinchcombe's analysis has one diode per arm and the bottom capacitor halved, as in the 303 `[1]`:

```
H(s) = −1 / (s⁴ + 6.727 s³ + 14.142 s² + 9.514 s + 1)     (ωc-normalised)
poles: −0.13, −1.04, −2.33, −3.24   (all real)
```

- **Halving the bottom capacitor** raises the cutoff by 2^0.25 ≈ 1.19 compared with equal capacitors. It is close to a pure frequency shift `[1]`.
- **The equal-capacitor diode ladder** has the open-loop form `1/(s⁴+7s³+15s²+10s+1)` `[10]`.

**Why it oscillates at k = 17.** Closing the loop gives 1 + k·H = 0 `[calc]`:

- The imaginary part of the denominator vanishes where −6.727ω³ + 9.514ω = 0, so ω = **1.189**.
- There the real part is ω⁴ − 14.142ω² + 1 = **−17.00**.
- So **k_osc = 17**, with oscillation at **ω = 1.19** in these units. For the equal-capacitor version, k_osc ≈ 18.4.
- The Pirkle/Zavalishin diode ladder in Csound uses **k ∈ [0, 17], with self-oscillation at 17** `[8]`.
- Open303's TB-303 mode scales k by 17/4 relative to its Moog mode `[4]`.
- A Moog ladder oscillates at k = 4 `[9]`.

> **Practical:** do not put a diode ladder on a "Moog k = 0–4" scale. 07's resonance ranges (k 2.5–3.4 "acid") apply to a Moog-style ladder only.

**"18 dB or 24 dB per octave?" Both are right.** Roland and many guides call it an 18 dB/oct filter `[11][13]`. Stinchcombe shows it is 4th-order, with an asymptotic slope of −24 dB/oct (−23.9 dB/oct measured on the plot) `[1]`. The poles are spread over a ratio of about 25:1, so the slope is shallow near the cutoff and only reaches −24 dB/oct far above it. Local slopes of the k = 0 response `[calc]`:

| Octave (ω, ×1.19 = resonant freq) | 0.15→0.3 | 0.3→0.6 | 0.6→1.2 | 1.19→2.4 | 2.4→4.8 | 4.8→9.5 | >9.5 |
|---|---|---|---|---|---|---|---|
| dB/oct | −4.7 | −6.7 | −9.5 | −13.7 | **−18.6** | −22.1 | −23.5 to −24 |

So **in the 1–3 octaves above the resonant frequency, which is where the audible harmonics are, it behaves like an 18 dB/oct filter.** This explains the 303's "rubbery" timbre at low resonance, compared with a Moog's darker 24 dB/oct.

**Resonance against bass loss** (linear model, ω normalised so that the resonant peak at k → 17 is at 1.19) `[calc]`:

| k | DC (passband) gain | Peak frequency ω | Peak height above passband |
|---|---|---|---|
| 0 | 0 dB | — (−3 dB at 0.125) | — |
| ~2.4 | −10.5 dB | bump first appears | ~0 dB |
| 4 | −14.0 dB | 0.53 | +1.5 dB |
| 8 | −19.1 dB | 0.86 | +7.0 dB |
| 12 | −22.3 dB | 1.04 | +14.0 dB |
| 15 | −24.1 dB | 1.14 | +23.2 dB |
| 16 | −24.6 dB | 1.16 | +29.5 dB |

What the table shows:

1. **Bass loss is severe.** At high resonance the passband is **20–25 dB down**, so the line becomes "all peak". This is the root of the "squelch".
2. **The peak frequency rises by about 1.2 octaves** (0.53 → 1.19) as resonance goes from low to maximum, even with the cutoff knob untouched. Turning up resonance therefore also brightens the sound.
3. **The 150 Hz feedback high-pass** cuts the loop gain at low frequencies, so at low cutoff settings the resonance weakens and the filter cannot ring in the bass `[4]`.

**No clean self-oscillation.** The stock 303 is documented as non-self-oscillating `[15]`. One reason is that the maximum loop gain sits below k_osc. Another is the feedback high-pass and coupling capacitors, which Stinchcombe shows make the resonance frequency-dependent `[1]`. The ladder's nonlinearity also limits the peak.

- **Open303** uses 100 % resonance as the edge of self-oscillation. Its resonance knob is skewed: `r = (1−e^(−3·knob))/(1−e^(−3))`. It also compensates the output gain only partly: `g = (1+r)·(1 + r(k/17 − 1))`, which is about +6 dB at full resonance against the −25 dB loss `[4]`.
- **Recommendation:** cap the effective k at **≈ 15.5–16 (91–94 % of 17)**.

**Nonlinearity.** Open303 puts a single soft clipper on the feedback tap: `x − x³/6`, with x clipped to ±√2 `[4]`. A Moog-ladder study (DAFx 2026) found that nonlinearities in the early stages matter more than late ones for matching SPICE. It also found that applying tanh only at the input and feedback diverges strongly under drive `[42]`. The study is not about the 303.

- **Recommended:** a tanh at the ladder input (x − k·y4), plus the cubic on the feedback.
- **Optional:** a gentle per-stage tanh on stages 1–2.

**Cutoff knob mapping (measured fit)** `[4]`:

```
f_nom(c) = 313.8 · (2394.4/313.8)^c   Hz,   c = knob 0…1   (≈ 314 Hz → 2.39 kHz, ×7.63, 2.93 oct)
```

This is the frequency of the *resonant peak*. The non-resonant −3 dB point is about 3.3 octaves lower `[calc]`. Devil Fish lists the stock maximum resonant frequency at around 2.5 kHz with no env mod (the Devil Fish itself reaches ~5 kHz) `[3]`. These figures agree with each other. The older 07 range of "150 Hz–2.5 kHz" was too low at the bottom end.

**Env mod mapping (measured fit)** `[4]`. With m = env-mod knob (0…1) and e(t) = MEG output (0…1):

```
S  = (1−c)·(3.774·m + 0.737) + c·(4.195·m + 0.864)     [octaves of swing]
O  = 0.0483·c + 0.294                                   [bipolar offset]
f(t) = f_nom(c) · 2^( S·(e(t) − O) + accentTerm(t) )
```

What the fit means:

- **The swing never reaches zero.** At m = 0, S is still 0.74–0.86 octaves. Whittle confirms that the stock Env Mod cannot reach zero `[2]`.
- **The swing is bipolar.** The envelope peak is S·(1−O) above f_nom, and the decayed tail is S·O below it.

Worked examples `[calc]`:

| Setting | Peak above f_nom | Tail below f_nom |
|---|---|---|
| c = 0, m = 1 | +3.18 oct (314 Hz → 2.84 kHz) | −1.33 oct (≈ 125 Hz; Open303 floors the filter at 200 Hz) |
| c = 1, m = 1 | +3.32 oct (would exceed 20 kHz; clamp it) | — |
| c = 0.5, m = 0.5 | +1.9 oct | −0.9 oct |

The x0xb0x env-mod resistor is R63 = 220k. Paralleling it with 100k gives about 1/3 of the range, and removing R61 lets the modulation reach zero `[5]`. Devil Fish triples the maximum and allows zero `[3]`.

### 1.5 MEG (filter envelope)

- **Shape.** A sharp attack and an exponential decay `[2]`.
- **Attack smoothing.** Open303 models the attack as a one-pole of about **3 ms** on the envelope (rc1). Devil Fish offers a 0.3–30 ms adjustable attack, and fixes accented attacks at 3 ms `[4]`.
- **Decay knob.** **200 ms to 2 s** on a stock 303. Devil Fish extends it to 30 ms–3 s `[3][4]`.
  - Open303 treats the knob value as the **exponential time constant τ** (c = e^(−1/(τ·fs))) `[4]`.
  - No source says whether "200 ms–2 s" means τ or the audible time-to-floor. **This is a disagreement or ambiguity.** Use τ, which sounds right with the bipolar offset in §1.4.
  - Map the knob as `τ = 200·10^knob` ms. This assumes a log taper `[I]`. The x0xb0x accent-decay mod uses a 1M audio-taper pot `[5]`.
- **Accented notes.** The decay pot is shorted out and the MEG runs at the pot's minimum time, **≈ 200 ms** `[2][3]`.
  - Every accent therefore produces a short, sharp filter spike, whatever the decay knob says.
  - This also means **the decay knob only affects unaccented notes.** That is a big part of why accents "pop" out of long-decay lines.

### 1.6 VEG / VCA (amplitude)

- **VEG.** A sharp attack and a **fixed, long exponential decay** `[2]`. Sources give "about 3–4 s" `[3]` and "about 3 s" (R123 = 1.5 MΩ) `[5]`. Open303 uses `ampEnv decay = 1230 ms` `[4]`.
- **The gate truncates it.** The 303 sounds like it has a short decay because notes are only ~60 ms long at 125 bpm, so the gate closes long before the VEG decays.
  - Stock end of note: about **16 ms** in total, roughly 8 ms at normal volume and then 8 ms of linear fall `[3]`.
  - Open303 uses an amp release of **1 ms on normal notes and 50 ms on accented notes** `[4]`.
- **The MEG also feeds the VCA.** On *every* note, Open303 adds `(0.45 + 4·accent)·MEG` to the amp envelope, then smooths the result with a 200 Hz 2-pole de-clicker `[4]`.
  - Normal notes therefore get a decaying loudness bump that follows the filter envelope.
  - Accents get much more: at full Accent, the peak gain is 5.45 against 1.45, about **+11.5 dB** `[calc from 4]`.
  - In hardware, the accented MEG reaches the VCA through **47k and 0.033 µF** (τ ≈ 1.6 ms) `[calc]`. This softens the accent attack, and Whittle calls it the main reason accented notes are louder `[2]`.
  - Real units probably sit at the lower end of that range. A **+6 to +10 dB** accent ceiling is a safe target `[I]`.

### 1.7 Accent

On accented steps, a switch routes the MEG, scaled by the Accent pot, to two places `[2]`:

1. **The VCA** (louder, with a slightly softened attack), as described in §1.6.
2. **The VCF summing node, through the accent sweep circuit** (§1.8).

The accented MEG also uses the fixed ~200 ms decay. Resonance is the same on accented and unaccented notes; only the cutoff path changes `[7]`.

### 1.8 Accent sweep: the "wow"

The circuit, from Whittle `[2]`:

- **Charge path.** A diode and a 47k resistor drive the counter-clockwise end of a 100k pot. A **1 µF** capacitor to ground hangs off the clockwise end.
- **Output.** The pot wiper feeds the filter summing node through a 100k mixing resistor.
- **The sweep pot is the second gang of the resonance pot.** This is the key point.
  - **Low resonance** (wiper toward the diode end): the filter gets a sharp, near-direct copy of the MEG, roughly 100/147 × (MEG − V_cap).
  - **High resonance** (wiper toward the capacitor): the pulse is smoothed by the 1 µF capacitor, charged through the diode and up to 147k.
- **Accumulation.** The diode blocks the discharge back through the charge path, so the capacitor does not fully empty between notes. **Each successive accent peaks higher, and the effect grows with resonance** `[2]`.
- **Not tempo-locked.** The sweep depends on time, not on bpm `[7]`.
- **Capacitor swaps.** The x0xb0x C13 capacitor sets the sweep speed. Stock is 1 µF (sweep peaks near 6 V); 0.47 µF is fast; 100 µF builds over about 10 s. Changing C13 also changes the sweep amplitude unless you compensate `[5]`.

**Simplified numeric model** `[calc]`. Assumptions:

- Ideal diode with a 0.1 (normalised) drop.
- MEG: instant attack to 1.0, then exponential decay with τ = 200 ms.
- Capacitor charges through τ_c = 147 kΩ·1 µF = 147 ms and leaks through τ_d ≈ 100 kΩ·1 µF = 100 ms.

```
dVc/dt = max(0, MEG − Vd − Vc)/τc − Vc/τd
```

Results:

- **A single accent:** the capacitor peaks at **0.21 of the MEG peak, ~96 ms after the note starts**. It is a smooth rise and fall, not an angular envelope, which matches Whittle's description `[2]`.
- **Consecutive accented 16ths at 125 bpm:** the peaks run 0.21 → 0.27 → 0.28 → 0.28 (saturating). That is **+33 % after three accents**.
- **Accents every 8th note:** 0.21 / 0.24 alternating.
- **Accents every quarter note:** no build-up.

How this maps to code:

- Model the sweep as an exponent term: `accentTerm = A·Vc/Vc_ref·(octaves)`.
- Open303 instead uses a plain 15 ms one-pole on the MEG for the accent path. It has **no diode and no accumulation**, which is a known simplification `[4]`. A good emulation should add both.
- Scale the smoothing time with resonance: τ_c ≈ 47 ms + 100 ms·R, with R = resonance 0…1 `[I from 2]`.

**Why it matters musically.** Runs of 3–4 accents in a fill make the cutoff "climb" over about half a beat and then relax. Together with the ~100 ms lag, this gives the vowel-like "wow" or "yow" that a plain ADSR cannot produce.

### 1.9 Slide (portamento) and tie

- **Slide circuit.** A **100k resistor (from the DAC) into 0.22 µF**, i.e. **τ = 22 ms** `[3][calc]`.
  - The CV is 1 V/oct, so the slide is a **one-pole lag in pitch (log-frequency)**: the approach is exponential in semitones.
  - It reaches 95 % at 3τ = 66 ms, which matches the commonly quoted "60 ms" `[3][4]`.
  - It is a fixed one-pole and **does not change with tempo** `[7]`.
- **Devil Fish** extends the slide to 60–360 ms on the internal sequencer `[3]`.
- **Open303** uses a slew-limiter τ of 0.2 × 60 ms = 12 ms ("tweak the scaling constant"), which is faster than the RC suggests `[4]`. **Use τ = 22 ms (range 12–40 ms) for authenticity** `[I]`.
- **Gate and envelopes on a slid note.**
  - A slide holds the gate across the whole step (12 of 12 ticks) `[12]`.
  - Open303's `slideToNote()` changes pitch, accent gain and the MEG decay setting, but does **not** retrigger the MEG or the VEG `[4]`.
  - So a slid note continues the previous note's decaying filter envelope. A string of slides forms one long, legato "word".
  - An accent on a slid-into note mainly changes the gain path, not the filter spike. Open303 still raises the cutoff through the accent term using the ongoing MEG `[4]`.
- **Tie.** It extends the previous note's gate into the next step with no new pitch and no retrigger `[13]`.

### 1.10 Output and timing

- **Headphone amp output:** about 5–6 Vpp `[3]`. Treat the internal level as arbitrary, then normalise.
- **Gate length** (normal notes):
  - **7 of 12 ticks (~58 %)** of a 16th, from Zoe Blade's analysis of the 48-tick timebase `[12]`.
  - **50 %** in Open303's default `stepLength = 0.5` `[4]`.
  - **This is a disagreement.** 50 % vs 58 % is audible as "tight" vs "slightly legato". Default to **55 %**.

### 1.11 Summary of disagreements in part 1

| Topic | Position A | Position B | Resolution |
|---|---|---|---|
| Filter slope | 18 dB/oct (Roland marketing, MusicRadar) `[11][13]` | 24 dB/oct, 4-pole (Stinchcombe) `[1]` | Both: ≈18 dB/oct locally, 24 dB/oct asymptotically `[calc]` |
| Gate length | 50 % `[4]` | 58 % `[12]` | Default 55 % |
| Slide time | 12 ms τ (Open303) `[4]` | 22 ms τ, "60 ms" settle (hardware RC) `[3]` | Use 22 ms τ |
| Decay figures | Read as time constants (Open303) `[4]` | Nominal times; unclear whether τ or T60 `[3]` | Treat as τ |
| VEG decay | 3–4 s `[3]` | ~3 s `[5]` | 1.23 s τ in Open303 `[4]` |

---

## 2. Sequencer semantics and acid grammar

### 2.1 What the 303 sequencer actually does

- **Steps and length.** Patterns are 16 steps by default. A shorter pattern length (1–16) can be set `[13][14]`.
- **Memory.** 64 patterns, 7 songs, 1 track `[15]`.
- **Two-pass entry** `[13]`:
  - **Pitch mode** stores a list of pitches, each with accent, slide and up/down octave flags.
  - **Time mode** stores a rhythm string of **Note / Tie / Rest**.
  - **The pitch list advances only on Note steps.** Rests and ties don't consume a pitch. For example, pitches C, D, E, F with the rhythm N N R N play as C, D, rest, E.
- **Why that matters.** If the pitch list has more or fewer entries than there are Note steps, the pitch and rhythm drift against each other. This is one source of "happy accidents" in acid lines `[I]`. **Emulate it**: keep a pitch list and a rhythm list separately, with independent lengths.
- **Timing.** A 48-tick-per-quarter timebase (24 PPQN counting both edges), so 12 ticks per 16th.
  - Normal note: 7 ticks on, 5 off.
  - Slid note: 12 ticks on.
  - Rest: 12 ticks of silence.
  - Sync is via DIN sync `[12]`.
- **Flags.** Accent and slide are Boolean flags per pitch `[12][13]`.

### 2.2 What makes a classic acid line

Composition grammar, drawn from the sources plus `[practice]`:

- **Root-heavy.** About 40–55 % of the notes are the root, in two octaves. The 303 line works as both bass and lead, and the harmony is implied by the root drone `[practice]`. Da Funk's acid line is in **G minor at 111 bpm** `[17]`.
- **Octave jumps plus slide give the bends.** Combining a slide with an octave jump on the next note produces the characteristic acid "bends" `[13]`. Use ties, slides and octave jumps sparingly: one or two flourishes on a simple pattern beat a busy one `[13]`.
- **Chromatic neighbours.** A ♭2 or a semitone below the target, slid into it, sounds like a "whine" `[practice]`. Phrygian ♭2 and minor ♭3/♭7 are the usual palette `[practice]`.
- **Rests carry the groove.** About 20–35 % of steps are rests. They re-arm the envelopes, and each re-attack after a rest is an envelope onset `[I]`. They also create syncopation against the kick (see §4.6).
- **Odd lengths (polymeter).** "A 12-step pattern over a 4/4 kick is a classic acid techno trick" `[13]`. MusicTech recommends cutting a 16-step pattern to 15 or 13 so it cycles against the bar `[22]`.
  - A 12-step pattern re-aligns every 3 bars.
  - A 13-step pattern takes 13 bars to re-align, so in practice it never repeats within a phrase.
- **Randomise, then curate.** Guides recommend scattering slides and accents, erasing the ones you don't like, and using partial randomisation `[22]`. Bangalter programmed several patterns and picked the best one for Da Funk `[17]`. A generator that over-produces and filters is faithful to how these lines were actually made.

### 2.3 How tracks evolve the line

- **Phuture, "Acid Tracks" (recorded mid-80s, Trax 1987).**
  - Spanky bought the 303 second-hand for **$40**. Pierre "got on the knobs" while the pattern ran, in a jam that lasted over an hour `[16]`.
  - The squelch enters around **1:20** `[16]`.
  - Ron Hardy played it four times in one night at the Music Box. The first two plays cleared the floor; by the fourth the crowd was "going wild" `[16]`. The name comes from "Ron Hardy's Acid Tracks" `[16]`.
  - **Lesson:** the composition *is* the knob performance over a static pattern, and repetition builds acceptance.
- **Plastikman, *Sheet One* (1993).** Sparse, precise rhythms support acid lines processed through echo, and the lines build in intensity across long tracks `[20]`.
- **Hardfloor.** Their sound relies on up to six TB-303s at once `[21]`. "Hardtrance Acperience" was released in 1992 on Harthouse `[21]`. The approach is layered 303s, each with its own knob arc.
- **Josh Wink, "Higher State of Consciousness."**
  - First released in 1994 on Strictly Rhythm's *The Deep And Slow* compilation. The "Tweekin' Acid Funk" remix is the famous version `[19]`.
  - Gear: live 303, 808, 909 and an S950 sampler `[19]`.
  - Wink describes it as built on tension ("When is it going to climax?"), and admits it "does it too much" `[19]`.
  - The cutting plant asked him to recut it because the highs were too high. It was notorious for blowing out 90s rave sound systems `[19]`. **This is a real-world example of 2–5 kHz energy getting out of hand** (see §4).
- **Daft Punk, "Da Funk" (1995).**
  - Its TB-303 was bought in 1993 `[17]`. Music Week praised the "huge distorted synth riffs" `[17]`.
  - The track is built from mostly 8-bar loops. The 303's cutoff and resonance are "constantly moving", starting with the cutoff dialled low `[18]`.
  - The 303's delays are scattered within a strictly defined pan range `[18]`.

**Knob-ride timescales** `[practice/I]`. These are calibrated to an 8-bar loop architecture `[18]`, at 120–135 bpm, where one bar ≈ 1.8–2.0 s.

| Gesture | Duration | Typical range | Notes |
|---|---|---|---|
| Micro-ride ("breathing") | 1–2 bars | ±0.05–0.1 of cutoff knob | Hand wobble; the knob is never fully still |
| Phrase ride | 8–16 bars | Cutoff 0.15 → 0.55; env mod inversely | One move per loop repeat |
| Arc / build | 32–64 bars (1–2 min) | Cutoff 0.1 → 0.8; resonance 0.6 → 0.9 | Wink-style tension; the decay knob opens with it |
| Section reset | 1 beat to 1 bar | Snap back to dark | At a drop or breakdown, for contrast |

---

## 3. The processing chain

### 3.1 Distortion pedals (clipping character)

All figures below are from ElectroSmash circuit analyses.

| Pedal | Gain structure | Clipper | Tone shaping | Character |
|---|---|---|---|---|
| **Boss DS-1** `[24]` | Transistor booster ~35 dB, then op-amp 0–26.5 dB | 1N4148 back-to-back diodes to AC ground: **hard clip at ±0.7 V** | Low-pass 234 Hz plus high-pass 1063 Hz blend gives a **~500 Hz mid scoop, up to −20 dB**. Overall loss ~−12 dB. Input high-pass 7.2 Hz | Bright, scooped, fizzy |
| **ProCo RAT** `[23]` | LM308 op-amp, 0 to ~67 dB nominal (less in practice). Gain is frequency-dependent: high-pass corners at **60 Hz (40 dB/dec) and 1.5 kHz (20 dB/dec)**. Gain-bandwidth limit: full gain below ~500 Hz, ~30 dB max at 10 kHz. Slew limit ~5.3 kHz | 1N914 to ground: **symmetric hard clip** | "Filter" is a passive low-pass, **475 Hz–32 kHz** | Aggressive mids. The op-amp's slew and gain-bandwidth limits round off the top end |
| **Big Muff** `[25]` | 4 stages; **two cascaded clipping stages of ~23–25 dB each** | Diodes in the collector-base feedback loops: **soft, then harder; symmetric** | Miller-capacitor low-passes around 1.2–1.8 kHz. Tone stack with a **~1 kHz notch, ~6.5 dB deep** at centre | Narrow-band, bass-heavy, sustained |

A Tube Screamer-style overdrive (soft clipping, mid hump) is also a common choice `[13]`.

**Implementation templates** `[I]`:

- **DS-1-ish:** pre-gain 20–40 dB → hard-knee clip → low-pass 6 kHz → peaking EQ −8 dB at 500 Hz, Q 0.7.
- **RAT-ish:** a pre-emphasis high-shelf (+6–10 dB above 1.5 kHz) *inside* the gain → hard clip → one-pole low-pass 1.5–8 kHz ("filter" knob).
- **Muff-ish:** two cascaded tanh stages, each followed by a one-pole low-pass at ~1.5 kHz → notch −6 dB at 1 kHz.

### 3.2 Why distortion after a resonant filter "screams"

The reasoning here is `[I, from the numbers in §1.4]`.

1. **The peak dominates the waveform.** At k = 12–16 the resonant component is **14–30 dB above the passband** (§1.4). The waveform entering the clipper is mostly a decaying, sine-like ring at f_res riding on a weak note.
2. **Clipping turns the peak into harmonics.** The clipping threshold is reached mainly by the peak, so the clipper creates harmonics of **f_res** (odd ones for symmetric clipping; add a DC bias for even ones). This stacks partials at 3f_res and 5f_res.
   - When f_res sweeps from 500 Hz to 1.5 kHz, those harmonics sweep from 1.5 to 4.5 kHz and from 2.5 to 7.5 kHz.
   - That is **straight through the ear's 2–5 kHz sensitivity peak** (§4.2).
3. **Intermodulation.** The peak mixes with the note's harmonics, giving sidebands at f_res ± n·f0. They fill the spectrum around the peak with partials spaced at f0, which produces a dense, buzzy, rough band (see §4.4).
4. **Compression.** A clipper flattens the crest factor, so the loud resonant notes and the quiet low-resonance notes end up at similar RMS. The knob ride is then heard as **timbre** (vowel or brightness) movement at near-constant loudness, not as volume swells. That is what makes a resonance ride sound like a voice getting more strained, rather than louder.
5. **Order matters.** Distortion *before* the filter is a different sound. The filter then removes the clipper's high harmonics, and the result is fat but polite.
   - **Classic acid: filter → distortion.**
   - **Modern acid techno** often uses a second distortion, or a bit of pre-filter drive, as well (Devil Fish adds up to 66.6× oscillator overdrive into the filter `[3]`).

### 3.3 Delay, reverb, EQ, sidechain, layering

- **Delay.**
  - The classic setting is **dotted 8th (3/16)**: t = 0.75 × 60000/bpm, which gives 375 ms at 120, 360 ms at 125, 346 ms at 130 and 326 ms at 138 bpm.
  - Alternatives: 1/8 or 3/8 (07 uses tape 3/8 at 35 %).
  - Settings: ping-pong, feedback 25–45 %, wet −12 to −18 dB relative to dry, high-pass on returns at 200–300 Hz, low-pass at 3–5 kHz `[practice]`.
  - Delay "is a tried-and-tested choice" `[13]`. Plastikman's acid lines are processed through echo `[20]`. Da Funk scatters the 303 delays within a defined pan range `[18]`.
- **Reverb.**
  - "A small amount of reverb helps" `[13]`. MusicTech's recipe uses short pre-delay and short early/late settings `[22]`.
  - Starting point: decay 0.8–1.5 s, pre-delay 10–25 ms, wet −18 to −24 dB, high-pass at 300 Hz.
  - Breakdowns can open to 2.5–4 s at −12 dB `[practice]`.
- **EQ.**
  - Because of the bass loss (§1.4) and the 32 Hz roll-off (§1.3), a resonant 303 has little real energy below ~80 Hz. The low notes' fundamentals (41–65 Hz) are weak, and the "body" is in **100–400 Hz**, with the peak above that.
  - Cut "boxy low-mids" (≈ 250–500 Hz) and lift lows and highs gently `[22]`.
  - High-pass the 303 bus at **30–45 Hz** (12 dB/oct) so it does not fight the kick's fundamental (909-style ≈ 45–60 Hz) `[practice]`.
- **Sidechain.** Duck the 303 by **2–4 dB**, attack 1–5 ms, release 80–150 ms, triggered by the kick. Or duck only below 150 Hz using a multiband split. Bus compression is used in Da Funk's final section `[18]`.
- **Layering with 909.**
  - Kick on quarters. Closed hats on 8th offbeats or 16ths. Open hat on the "and". Clap or snare on 2 and 4.
  - Da Funk: a 909 clap layered with white noise or a randomly panned slap-back, and a closed 909 hat that takes a solo role from bar 65 `[18]`. Its beat stereo field is kept narrow `[18]`.
  - Wink's "Higher State" uses a live 303 with 808 and 909 `[19]`.

---

## 4. Psychoacoustics: why acid grabs the ear

### 4.1 The resonant peak as a "voice"

- **Male vowel formants** (Peterson and Barney):
  - **F1:** 270 Hz (/i/) to 730 Hz (/a/).
  - **F2:** 840 Hz (/ɔ/) to 2290 Hz (/i/).
  - **F3:** about 1.7–3.0 kHz.
  - For example, /a/ is 730/1090/2440 Hz, /u/ is 300/870/2240, and /i/ is 270/2290/3010 `[30]`.
- **A sweeping resonant peak traces a vowel path.** The 303 peak spans ~314 Hz–2.4 kHz from the knob (§1.4), plus up to +3 octaves of envelope. It therefore travels **exactly through F1–F2 vowel space**.
- **The ear reads it as speech-like.** A single swept peak over a harmonic-rich buzz source (the saw) is, acoustically, a crude source-filter vowel. It is the same principle as a wah pedal. Peak motion from ~400 Hz to ~2 kHz in ~100–300 ms resembles F2 transitions in diphthongs, such as "wow" or "yeah" `[I]`.
- **Distortion adds a "second formant."** The 3f_res harmonic (§3.2) acts like one, which increases the vowel illusion `[I]`.
- **Design rule:** let the peak *travel*. Peak motion through 300 Hz–2.5 kHz reads as talking. A static peak reads as a whistle.

### 4.2 The ear's 2–5 kHz sensitivity peak

- **Equal-loudness contours** (ISO 226:2003) show peak sensitivity at about **2–5 kHz**, largely because of ear-canal resonance and the middle ear `[28]`. Below ~100 Hz, loudness grows very steeply with level, up to 24 dB per octave `[28]`.
- **Ear canal.** It behaves as a quarter-wave resonator, with **~3.5 kHz resonance for a 2.5 cm canal**. The concha adds a resonance around 5 kHz. Together the outer ear gives about **10–15 dB of gain at 3–5 kHz** `[29]`.
- **Implication.** A resonant peak (or its distortion harmonics) parked at 2.5–4 kHz gets about 10–15 dB of "free" loudness. It cuts through, but it also fatigues fast.

### 4.3 Harmonic distortion, loudness and brightness

- **Clipping raises loudness at the same peak level.** It lowers the crest factor and adds upper partials, which also raises the spectral centroid (perceived brightness).
- **Sharpness rises with it.** Zwicker's "sharpness" metric (acum) grows with energy weighted above ~3 kHz. It is a well-established correlate of the harsh or shrill quality `[41]`.
- **Practical consequence:** after a distortion stage, the 303 can sound 3–6 dB louder at the same peak level, so gain-compensate the drive `[I]`.

### 4.4 Roughness, beating and critical bands

- **Roughness** comes from amplitude fluctuation in about the 15–300 Hz range. It is weighted most heavily around **~70 Hz modulation** (Zwicker model, 25 Bark bands) `[31]`.
- **Sensory dissonance** between two partials peaks when they are about **a quarter of a critical bandwidth** apart (Plomp and Levelt 1965) `[31][41]`.
- **ERB.** The equivalent rectangular bandwidth is ERB(f) = 24.7·(4.37·f/1000 + 1) (Glasberg and Moore 1990) `[41]`. That gives ≈ 133 Hz at 1 kHz, 241 Hz at 2 kHz and 349 Hz at 3 kHz `[calc]`.
- **The 303 mechanism** `[I/calc]`:
  - For a low note (f0 = 41–65 Hz), a 1–3 kHz resonant peak sits inside an auditory filter that holds **2–8 unresolved harmonics** spaced by f0.
  - Those harmonics beat at f0 itself. **41–65 Hz is right in the roughness maximum**, so the peak "growls".
  - Jump an octave (f0 = 82–131 Hz) and fewer harmonics share a filter. The beat rate also leaves the roughness peak, so the same peak sounds smoother, more "whistly" and vowel-like.
  - **Octave jumps are therefore also roughness jumps.** This is one reason root/octave alternation is so effective.

### 4.5 Spectral flux, salience and attention

- **What drives salience.** In natural scenes, **change in loudness** was the strongest predictor of salient events. It accounted for ~66 % of events on its own, and 82 % in sparse scenes `[32]`.
  - **Harmonicity** came second (~59 %).
  - **Brightness** increased after salient events (ρ = 0.17 with salience strength) `[32]`.
- **Every accent is a salience event.** It jumps loudness (+6–11 dB), brightness (the cutoff spike) and roughness (more harmonics in the peak band) at the same moment.
- **Accent density sets attention density.**
  - Too many accents (>50 % of steps): the contrast collapses.
  - Too few (<15 %): the line recedes into the background `[I]`.
- **Continuous spectral flux** from the knob ride keeps the timbre always "new", even though the notes repeat.

### 4.6 Expectation, repetition and groove

- **Repetition with timbral change creates tension.**
  - Repetition makes the pitch content predictable, so prediction errors move to the timbral domain. Expectation theory (Huron's ITPRA) predicts arousal from timed, resolved or deferred expectation `[43]`.
  - The 303's fixed 16-step loop with a continuously moving cutoff is a near-pure case of it. Pitch is fully predicted, while timbre stays uncertain.
  - Wink's own account of the track ("When is it going to climax?") describes deliberately deferred resolution `[19]`.
- **Syncopation and groove.** Ratings of wanting to move and of pleasure follow an **inverted U against syncopation**. Medium syncopation maximises both, and the effect is strongest in dance enthusiasts `[33]`.
  - The 303's rests, ties and off-beat accents against a four-on-the-floor kick are a syncopation-density control.
  - Target **medium**: about 3–6 off-beat onsets or accents per 16 steps `[I]`.
- **The 16th grid as a perceptual carrier.**
  - At 125 bpm a 16th is 120 ms.
  - Gate (~55 %) plus release (~16 ms) leaves ~50 ms of silence between non-slid notes. Each note is a fresh onset, so there are 8 onsets per second, near the upper end of comfortable tapping and subdividing rates `[I]`.
  - Slides remove those onsets locally, which creates phrasing.

### 4.7 Harsh and fatiguing vs exciting

| Harsh / cheap | Exciting |
|---|---|
| A static peak parked at 2.5–4 kHz for many bars (ear-canal gain) `[29]` | A peak *moving* through 0.3–3 kHz; it reaches >3 kHz only at accents and peaks |
| Aliasing: inharmonic fold-down from a naive saw, hard clipper or high-Q filter at 1×. At f_res = 3 kHz, the 5th harmonic is 15 kHz and the 7th is 21 kHz; harmonics past Nyquist fold back as non-harmonic tones `[26][27]` | Oversampled ladder and clipper (4× minimum; Open303 uses 4× with an elliptic quarter-band anti-alias filter `[4]`), BLEP saw `[26]`, ADAA clipper `[27]` |
| Resonance that self-oscillates or whistles as a sine (k ≥ 17) | k capped near 15.5–16, with a nonlinear limit and the feedback high-pass |
| Constant accent level | Accent sweep accumulation varies the peaks |
| Wide-band high-frequency boost after distortion | Post-clip low-pass at 4–7 kHz, like a pedal's tone control |
| Wink-style highs that blow out systems `[19]` | Dynamic de-essing or "dynamic EQ" at 2.5–4.5 kHz on peaks, −2 to −4 dB |

---

## 5. Psychedelic perception research, and what it implies for acid production

The facts first; the inferences are marked.

**Note on the name.** The genre name traces to "Ron Hardy's Acid Tracks" `[16]`. A link to LSD is popular lore, not documented in our sources.

### 5.1 Key studies

- **Kaelen et al. 2015** (*Psychopharmacology*) `[34]`.
  - Design: 10 healthy volunteers, a placebo day and an LSD day 5–7 days apart, five instrumental tracks each day.
  - Measures: a visual analogue scale and the 9-item Geneva Emotional Music Scale (GEMS-9).
  - Result: LSD enhanced the emotional response to music, especially **"wonder", "transcendence", "power" and "tenderness"**. The authors describe this as tentative pilot evidence.
- **Terhune et al. 2016** (*Neuropsychologia*) `[39]`.
  - Design: 10 adults, 40–80 µg LSD against saline, 5–7 days apart. (Same N and spacing as Kaelen 2015, likely the same cohort.)
  - Method: grapheme-colour and sound-colour consistency tests.
  - Result: synaesthesia-like experiences under LSD **did not meet the consistency criteria** for genuine synaesthesia. Consistency did not improve (it was non-significantly worse). The authors suggest the effect is "qualitatively different", or that the study was underpowered.
  - **Takeaway:** "acid synaesthesia" is real as an experience, but it is not reliable colour-to-sound mapping.
- **Kaelen et al. 2016** `[35]`.
  - Design: 12 people, **75 µg LSD intravenous** against placebo, with fMRI at rest and while listening to music.
  - Result: LSD plus music increased connectivity **from the parahippocampal cortex to the visual cortex**. This correlated with eyes-closed visions, including complex scenes and autobiographical imagery.
- **Kaelen et al. 2017** (bioRxiv) `[36]`.
  - Design: N = 16, LSD 75 µg against placebo, one 7-minute piece of music, with acoustic feature time courses used as fMRI regressors.
  - Result: the most notable LSD changes were tied to **timbral complexity**, i.e. the complexity of the spectral distribution. They tracked enhanced music-evoked **wonder** `[36][38]`.
- **Preller et al. 2017** (*Current Biology*) `[37]`.
  - Design: N = 22, three sessions: placebo, LSD, and LSD after ketanserin (a 5-HT2A blocker).
  - Result: LSD raised the **personal meaning** attributed to music, most for excerpts that were previously **meaningless or neutral**. Ketanserin normalised this, implicating 5-HT2A. The effect was associated with cortical midline structures, which are linked to the sense of self.
- **Barrett, Preller and Kaelen 2018 review** `[38]`.
  - LSD enhanced how music- and speech-responsive areas, and the amygdala, track tonal structure (Barrett 2017a).
  - Psilocybin increased absorption in music, and its perceived beauty and significance, compared with placebo and dextromethorphan (Carbonaro 2018).
  - Psilocybin reduced the auditory N1 brain response (Umbricht 2003). LSD altered auditory sensitivity measured with MEG (Timmermann 2017).
  - Older reports describe altered sensitivity and tolerance to sound.
  - In therapy, music experience correlated with mystical-type experience and with clinical improvement (Kaelen 2018).
- **Wittmann et al. 2007** `[40]`.
  - Design: 12 volunteers, psilocybin at 115 and 250 µg/kg.
  - Results: reproduction of intervals **longer than ~2.5 s** was impaired. Synchronising to beats with intervals **longer than ~2 s** was harder. Preferred tapping tempo became **slower**.

### 5.2 How acid production choices map onto these findings

All of this is `[I]`: hypotheses consistent with the data, not tested on acid house.

| Finding | Production mapping |
|---|---|
| **Timbral complexity drives the altered response** `[36]` | The 303's defining move is continuous spectral change at fixed pitch: cutoff rides, the accent "wow", rising resonance. Acid concentrates its information into the feature that LSD most amplified. |
| **Meaning increases most for neutral, repetitive material** `[37]` | Minimal, looped, root-heavy 303 patterns are exactly such "neutral" material. Extreme repetition, which is boring sober, can become highly salient. This fits Hardy's four plays (§2.3) and Plastikman's minimalism. |
| **Visual imagery is coupled to music** `[35]` | Slow evolution plus space (echo, reverb) gives room for imagery. Plastikman's echo-processed lines building over long tracks `[20]` fit this. |
| **Time perception beyond ~2–2.5 s degrades** `[40]` | At 120–135 bpm, a beat (0.44–0.5 s) and a bar (1.8–2 s) stay within the robust window, so the 16th grid and the kick stay "graspable". Phrase-level structure (8–64 bars, 15 s–2 min) falls outside it. Slow knob arcs are then felt as drift or "timelessness" rather than counted form. Keep the micro-grid rock-solid and make the macro-form continuous rather than sectional. |
| **Synaesthesia-like effects are inconsistent** `[39]` | Don't build "colour-to-note" mappings and claim they are psychedelic. Visual reactivity to the audio should follow continuous features (cutoff, roughness, flux), not fixed associations. |
| **Stereo motion, phasing, swirl** | **No controlled study in our sources tests these under psychedelics.** Their use in psychedelic music is cultural practice. Da Funk keeps the beat narrow and moves the 303 delays within a defined range `[18]`. Use motion on the effect returns, not on the dry 303 or the kick. |

---

## 6. Implementation spec

### 6.1 Oscillator

- **Saw:** naive phase ramp plus a **polyBLEP** correction at the reset `[26]`. Run it at 4× oversampling, together with the filter.
- **Square:** `sq = −tanh(70·saw + 4.37)` from the same phase, shifted 180°, giving ~47 % duty `[4]`. Add a per-instance duty jitter of ±2 % to mimic unit variance `[6]`. Then apply a one-pole high-pass at 44.5 Hz.
- **Tuning:** A4 = 440 Hz. Optional analogue drift: ±3 cents with a 0.05 Hz random walk `[I]`.
- **Note-on latency:** 0–4 ms (default 1 ms) `[3]`.

### 6.2 Filter: TB-303 diode ladder

- **Linear core.** Open303 "TB_303" mode, at 4× oversampling `[4]`:
  ```
  u  = x − HP150( k · sat(y4) );     sat(v)=v−v³/6, v clipped ±√2
  y1 += 2·b0·(u − y1 + y2)
  y2 +=   b0·(y1 − 2·y2 + y3)
  y3 +=   b0·(y2 − 2·y3 + y4)
  y4 +=   b0·(y3 − 2·y4)
  out = 2·g·y4
  fx = f_res / (√2 · fs_os)
  b0 = (0.00045522346 + 6.1922189·fx) / (1 + 12.358354·fx + 4.4156345·fx²)
  k  = r · (16.998792 + 213.87126·fx + 614.95611·fx² − 476.47308·fx³ − 5837.7917·fx⁴ + 7198.6997·fx⁵ + fx⁶)
  g  = (1 + r)·(1 + r·(k/r/17 − 1))
  ```
  - Here r = (1−e^(−3·res))/(1−e^(−3)), and res = knob 0…1 times **0.93**. That cap keeps the effective k ≲ 16, so the filter never self-oscillates.
  - The resonant peak lands at about f_res. In the continuous-time version of these equations, the eigenvalues sit at ±j√2·ω exactly at k = 17 `[calc]`.
- **Alternative.** A ZDF/TPT diode ladder (Zavalishin `[9]`, Pirkle; Csound `diode_ladder`, k 0–17 `[8]`) at 2× oversampling. Add tanh at the input, saturation 1–2 `[8]`.
- **Floor and ceiling:** clamp f_res to **200 Hz–18 kHz** `[4]`.
- **Fixed filters after the VCF:** high-pass at 24.2 Hz, all-pass at 14 Hz, notch at 7.5 Hz with a 4.7-octave bandwidth `[4]`. These can run at 1×.

### 6.3 Cutoff, env mod and accent

- **Cutoff knob:** f_nom = 313.8·7.6305^c Hz `[4]`.
- **Instantaneous cutoff:** f = f_nom·2^(S·(e − O) + A_acc·Vc/0.28), using the S and O formulas in §1.4 `[4]`. A_acc = accent knob × 1.0 octave `[I]`. Vc is the accent-sweep capacitor voltage (0.28 is its asymptotic peak, from §1.8).
- **Accent sweep capacitor:**
  - `dVc/dt = max(0, MEG_acc − 0.1 − Vc)/τc − Vc/τd`
  - τc = 47 + 100·res ms; τd = 100 ms (range 80–200).
  - At low resonance, bypass the smoothing: blend `(1−res)·MEG_acc + res·Vc_normalised` `[2][calc]`.
  - Only accented notes charge the capacitor.
- **Smoothing on the envelope paths:** 3 ms one-pole on the MEG feed to the VCF (rc1), and 3–15 ms on the accent path (rc2) `[4]`.

### 6.4 Envelopes and VCA

- **MEG:** instant attack, then exponential decay with τ = 200·10^decayKnob ms (200–2000). Accented notes are fixed at **τ = 200 ms** `[3][4]`. Do **not** retrigger on slid notes.
- **VEG:** instant attack, exponential decay with **τ = 1.23 s** (≈ 3–4 s audible) `[4][3]`. At gate end, hold for 8 ms and then fall linearly over 8 ms, about 16 ms in total. A 1–2 ms release is also acceptable for unaccented notes and 50 ms for accented ones `[3][4]`.
- **VCA gain:** `VEG + (0.45 + 3·accentKnob)·MEG`. The factor is 3 rather than Open303's 4, which puts the accent ceiling at ≈ +9.6 dB instead of +11.5 dB `[4][I]`. Then apply a 2-pole low-pass at 200 Hz to the gain signal, as a de-clicker `[4]`.

### 6.5 Slide and gate

- **Slide:** a one-pole on **log₂(frequency)** with **τ = 22 ms** (user range 12–60 ms). It does not change with tempo `[3][7]`.
- **Gate:** **55 %** of a step (range 50–58 %). On a slide, the gate is held through the whole step into the next note, with no envelope retrigger `[4][12]`. A tie extends the gate with no retrigger.

### 6.6 Distortion

- **Order:** **post-filter** `[I]`.
- **Default curve:** `y = tanh(d·x + b) − tanh(b)`, with d = 10^(drive_dB/20). Drive 6–30 dB, default 18 dB. Bias b = 0.15 adds even harmonics.
- **Hard mode** (DS-1/RAT style): `y = clamp(d·x, −1, 1)` with a 2-sample-wide polynomial knee `[23][24]`.
- **Anti-aliasing:** **4× oversampling plus first-order ADAA** on the tanh or clamp `[27]`. If drive exceeds 24 dB and f_res > 2 kHz, use 8× (or 4× with ADAA) `[I]`.
- **Tone:** a one-pole low-pass after the clipper at 3.5–7 kHz. Optional pedal voicings:
  - "DS-1": peaking EQ −8 dB at 500 Hz, Q 0.7 `[24]`.
  - "RAT": +8 dB high-shelf at 1.5 kHz before the clipper `[23]`.
  - "Muff": two tanh stages with a 1.5 kHz low-pass each, then a −6 dB notch at 1 kHz `[25]`.
- **Gain compensation:** make up −0.5 dB per dB of drive above 6 dB, then trim the remainder by RMS measurement `[I]`.

### 6.7 Delay and reverb

- **Delay:** **3/16** (= 0.75 × 60000/bpm ms), ping-pong. Feedback 0.35 (range 0.25–0.45). Wet −14 dB. Feedback-path filters: high-pass 250 Hz, low-pass 4 kHz. Optional tape wobble of 0.3 Hz at ±1.5 ms `[practice]`.
- **Reverb:** 1.2 s decay, 15 ms pre-delay, wet −20 dB, high-pass 300 Hz on the send. In breakdowns, ramp to 3 s at −12 dB over 4 bars `[practice]`.

### 6.8 Mix against a 909-style kick

All of these are `[practice/I]`.

- **303 bus high-pass:** 35 Hz, 12 dB/oct.
- **Kick:** owns <80 Hz.
- **Sidechain:** duck the 303 by 3 dB, attack 2 ms, release 120 ms.
- **Level:** 303 bus short-term RMS at **−6 to −9 dB relative to kick short-term RMS** while the 303 is the hero, and −10 to −14 dB in intros.
- **Peaks:** the resonant peak should not exceed the kick's peak.
- **Dynamic EQ on the 303 bus:** −3 dB max at 3.2 kHz, Q 1.5, triggered when the 2.5–4.5 kHz band's short-term level is >6 dB above the 0.3–2.5 kHz band.
- **Master:** follow 03 (−11 LUFS short-term, −1 dBTP).

### 6.9 Knob-ride automation

All of these are `[I]`, calibrated to §2.3.

- **Representation:** every knob is the sum of an **arc**, a **phrase ride** and a **wobble**.
  - **Arc:** 32 or 64 bars, raised-cosine ease-in-out.
  - **Phrase ride:** 8 or 16 bars, random target, ease time 1–4 bars, hold 2–6 bars.
  - **Wobble:** 1/f noise with period ≈ 1–2 bars, ±0.04.
- **Rule:** never hold a knob completely still for more than 8 bars.
- **Cutoff:**
  - Arc from 0.08 → 0.70 over 64 bars. Phrase rides ±0.15.
  - In a breakdown, drop to 0.05–0.15 within 1 bar.
  - Peak plateau ≤ 8 bars when the resulting peak is >2.5 kHz.
- **Resonance:** 0.55 → 0.88 over 32 bars, correlated with the cutoff arc (ρ ≈ +0.6). Snap down to 0.5 at section resets.
- **Env mod:** **anti-correlated** with cutoff (ρ ≈ −0.5), range 0.25–0.85. With cutoff low, the env mod produces the "quack"; with cutoff high, it is reduced.
- **Decay:** a 16-bar triangle between 0.15 and 0.6. It goes longer in builds.
- **Accent:** 0.5 baseline, rising to 0.9 at peaks.
- **Drive:** follows the energy curve, 12 → 24 dB.
- **Human gesture limit:** maximum knob speed ≈ 1.0 of full travel per bar at 125 bpm. That is a fast "Pierre twist" `[16]`. Typical is 0.1–0.3 per bar.

### 6.10 Pattern generator (per 16-step pattern)

- **Length:** 16 with p = 0.75, 12 with p = 0.10, 15 or 13 with p = 0.15 combined `[13][22]`.
- **Pitch list and rhythm list:** separate, so they can drift (§2.1). The pitch list length can differ from the number of Note steps with p = 0.25 `[13]`.
- **Rhythm:**
  - Note 0.68, Rest 0.22, Tie 0.10.
  - Step 1 is a Note with p = 0.95.
  - At most 3 consecutive rests.
  - Rests are biased onto the "e" and "a" 16ths of each beat: weight 1.4× there, 0.6× on downbeats.
- **Pitch degrees** (minor or Phrygian, relative to root):
  - Root 0.45, root +12 0.15, ♭3 0.08, 5 0.08, ♭7 0.08, 4 0.04, ♭2 0.04.
  - Chromatic neighbour (±1 semitone to the next note, forced slide) 0.08.
- **Octave flags:** up 0.18, down 0.05. Never two octave-downs in a row.
- **Accent:** p = 0.28 (range 0.2–0.35). Bias accents onto off-beat 16ths (1.5× weight).
  - Allow one run of 2–4 consecutive accents per pattern with p = 0.3. This deliberately triggers the sweep ratchet in §1.8.
  - Accented steps per pattern: at least 2, at most 7.
- **Slide:** p = 0.18 (range 0.12–0.25), only where the next step is a Note.
  - Raise it to p = 0.5 when the next note is an octave jump or a semitone neighbour `[13]`.
  - At most 3 consecutive slides.
- **Syncopation target:** 3–6 off-beat onsets or accents per 16 steps. Reject or regenerate outside 2–8 `[33]`.
- **Curate:** generate 8 candidates and score them. Prefer a root ratio of 0.4–0.6, 1–2 "flourishes" (a slide+octave or a chromatic slide), and syncopation in the target band. Keep the best `[13][17][22]`.
- **Evolution:**
  - Every 8 bars, mutate 1 step with p = 0.5. A mutation can flip an accent, slide or octave, or rotate the rhythm by 1.
  - Every 32 bars, either regenerate 25 % of the steps or swap to a sister pattern (same root, ≥ 60 % shared steps).
  - **The knob arcs, not the note changes, carry the form.** Keep note mutations rare: no more than 1 per 4 bars on average `[16][20]`.
- **Tempo:**
  - Acid house 118–126 bpm (Da Funk is 111 `[17]`).
  - Acid techno 130–145; hard acid 145–155 `[practice]`.

### 6.11 Things to avoid (what makes emulations sound cheap)

1. **A Moog ladder (k ≤ 4), or a clean 24 dB/oct state-variable filter, called "303".** It lacks the 18 dB/oct local slope, the 20–25 dB bass loss and the rising peak frequency (§1.4).
2. **Resonance that self-oscillates or whistles.** Cap k at ≲ 16 and keep the 150 Hz feedback high-pass.
3. **A linear-in-Hz cutoff envelope, or unipolar env mod that can reach zero.** Use the exponential, bipolar mapping that never reaches zero (§1.4).
4. **A decay knob that also changes accented notes.** Accents must use a fixed ~200 ms decay.
5. **Accents that are only "louder".** They need the cutoff spike, the ~100 ms-lagged sweep and the accumulation across consecutive accents.
6. **Retriggering envelopes on slides or ties.** Also: linear-in-Hz glides, or glide times that scale with tempo.
7. **Naive saws, 1× clippers and 1× ladders.** These produce aliasing that is very audible at high resonance (§4.7). Also avoid wavetable saws with no mip-mapping.
8. **Perfectly square, sharp-edged 50 % squares.** The 303 square has one sharp edge and one rounded edge, ~47 % duty, and a high-pass tilt.
9. **A static peak at 2.5–4 kHz for many bars,** and high-frequency boosts after distortion (§4.2, §4.7).
10. **Static knobs, or note-driven variation instead of timbre-driven variation.** The genre's form lives in the knob rides (§2.3, §5).
11. **Over-busy patterns.** Too many slides, octaves or accents (>50 %) removes contrast and salience (§4.5).
12. **Reverb and delay on the full-range 303.** High-pass the sends, or the low end of the mix turns to mud.

---

## Sources

1. Tim Stinchcombe, "Diode ladder filters" (TB-303 analysis: core transfer function, poles, halved bottom capacitor, slope, coupling-capacitor 10-pole/6-zero form). https://www.timstinchcombe.co.uk/index.php?pge=diode
2. Robin Whittle, "What makes the TB-303 unique" (MEG/VEG, accent routing, accent sweep circuit: 47k, 100k pot, 1 µF; ganged with resonance). http://www.firstpr.com.au/rwi/dfish/303-unique.html
3. Robin Whittle, *Devil Fish Manual* (stock vs DF figures: MEG 200 ms–2 s, accent decay 200 ms, VEG 3–4 s, slide 100k/0.22 µF "60 ms", note-start delay 1–5 ms, end-of-note 16 ms, 32 Hz −5 dB, resonant max). http://www.firstpr.com.au/rwi/dfish/Devil-Fish-Manual.pdf
4. Robin Schmidt (RS-MET), Open303 source code: `rosic_Open303.cpp/.h`, `rosic_TeeBeeFilter.h/.cpp`, `rosic_MipMappedWaveTable.cpp`, `rosic_AcidSequencer.h`, `rosic_AcidPattern.cpp` (mirror). https://github.com/maddanio/open303
5. Ladyada x0xb0x wiki, "Envelope mods" (R123 1.5M → ~3 s VCA decay; C13 accent sweep 1 µF / 0.47 µF / 100 µF; R63, R61 env-mod range). https://ladyada.net/wiki/x0x/envelopemods
6. KVR Audio forum, "Strange comment in wikipedia about TB303's square waves" (Q8 waveshaper, asymmetric edges, duty variance). https://www.kvraudio.com/forum/viewtopic.php?p=3732152
7. KVR Audio forum, Open303 thread (antto: accent sweep is time-dependent, not tempo-dependent; slide is a fixed one-pole; accented resonance equals normal). https://www.kvraudio.com/forum/viewtopic.php?p=3761614
8. Csound manual, `diode_ladder` opcode (Pirkle/Zavalishin ZDF diode ladder; k 0–17, self-oscillation at 17; tanh saturation modes). https://csound.com/manual/opcodes/diode_ladder/
9. Vadim Zavalishin, *The Art of VA Filter Design*, rev. 2.1.0 (Native Instruments), incl. §5.10 Diode ladder; TPT/ZDF method. https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf
10. A. Lanterman, Georgia Tech ECE4803B Homework 4 (diode-C ladder open-loop 1/(s⁴+7s³+15s²+10s+1)). https://lanterman.ece.gatech.edu/?p=109
11. linux-audio-dev list, Aug 2014 (the "18 dB/oct" TB-303 ladder has four stages). https://lists.linuxaudio.org/archives/linux-audio-dev/2014-August/035262.html
12. Zoe Blade, "TB-303" notebook (48-tick timebase; 7/12-tick gate, slide 12/12). https://notebook.zoeblade.com/TB-303.html
13. MusicRadar, "The producer's guide to the Roland TB-303 (and its clones)" (pitch and time modes, note/tie/rest semantics, 12-step trick, slide+octave bends, distortion/delay/reverb). https://www.musicradar.com/news/producers-guide-roland-tb-303
14. Roland, TB-303 (Roland Cloud) owner's manual (16-step patterns, accent/slide rows). https://rolandcloud.com/getmedia/b3e2da28-1951-467e-bd79-7aae34481570/TB-303-Manual-E.pdf?ext=.pdf
15. Wikipedia, "Roland TB-303" (1981–84, $395, Kikumoto, 64 patterns / 7 songs, non-self-oscillating filter). https://en.wikipedia.org/wiki/Roland_TB-303
16. DJ Mag, "Game Changers: Phuture 'Acid Tracks'" ($40 303, hour-long knob jam, Hardy's four plays, naming). https://djmag.com/content/game-changers-phuture-acid-tracks
17. Wikipedia, "Da Funk" (TB-303 bought 1993; 111 bpm, G minor; 1995 release; "huge distorted synth riffs"). https://en.wikipedia.org/wiki/Da_Funk
18. Attack Magazine, "Deconstructed: Daft Punk – Da Funk" (constantly moving cutoff/resonance; delay panning; 8-bar loops; 909 clap/hat; bus compression). https://www.attackmagazine.com/technique/deconstructed/daft-punk-da-funk/
19. Electronic Sound, "Josh Wink 'Higher State Of Consciousness'" (1994/95; live 303, 808, 909, S950; tension; highs too hot for cutting). https://www.electronicsound.co.uk/?p=6987
20. Mute, Plastikman *Sheet One* 30th anniversary product notes (1993; acid lines through echo building across long tracks). https://store.mute.com/products/plastikman-sheet-one-30th-anniversary-edition
21. Wikipedia, "Hardfloor" (up to six TB-303s; "Hardtrance Acperience", 1992, Harthouse). https://en.wikipedia.org/wiki/Hardfloor
22. MusicTech, "How to create a Chicago-style 303 acid house bassline" (odd lengths 15/13, scatter-and-erase, reverb and EQ recipe). https://musictech.com/guides/essential-guide/how-to-create-a-chicago-style-acid-house-bassline
23. ElectroSmash, "ProCo RAT analysis". https://www.electrosmash.com/proco-rat
24. ElectroSmash, "Boss DS-1 analysis". https://www.electrosmash.com/boss-ds1-analysis
25. ElectroSmash, "Big Muff Pi analysis". https://www.electrosmash.com/big-muff-pi-analysis
26. V. Välimäki and A. Huovilainen, "Antialiasing oscillators in subtractive synthesis," *IEEE Signal Processing Magazine* 24(2), 2007 (BLIT/BLEP and polyBLEP-family methods).
27. J. Parker, V. Zavalishin and E. Le Bivic, "Reducing the aliasing of nonlinear waveshaping using continuous-time convolution," DAFx-16 (ADAA). https://dafx.de/paper-archive/details/vem_XXF5qBbfiWOH2RVVAA
28. Wikipedia, "Equal-loudness contour" (ISO 226:2003; peak sensitivity 2–5 kHz due to ear-canal resonance). https://en.wikipedia.org/wiki/Equal-loudness_contour
29. Entokey, "Anatomy and physiology of hearing" (ear canal quarter-wave ~3.5 kHz for 2.5 cm; concha ~5 kHz; 10–15 dB gain at 3–5 kHz). https://entokey.com/anatomy-and-physiology-of-hearing/
30. Peterson and Barney (1952) male formant table, via Cook (1999), Princeton CS325. https://www.cs.princeton.edu/courses/archive/spr99/cs325/formants.html
31. SinesTools (Univ. Vienna), "Roughness estimator" (Zwicker model, 25 Bark, peak weighting ~70 Hz modulation; Plomp-Levelt / Sethares models). https://sinestools.univie.ac.at/roughness_estimator.htm
32. N. Huang and M. Elhilali, "Auditory salience using natural soundscapes," *JASA* 141(3), 2017. https://engineering.jhu.edu/lcap/data/uploads/pdfs/jasa2017_huang.pdf
33. M. Witek et al., "Syncopation, body-movement and pleasure in groove music," *PLoS ONE* 9(4), 2014. https://doaj.org/article/743d9013fbde436999b78a244c718d37
34. M. Kaelen et al., "LSD enhances the emotional response to music," *Psychopharmacology* 232, 2015. https://pubmed.ncbi.nlm.nih.gov/26257162/
35. M. Kaelen et al., "LSD modulates music-induced imagery via changes in parahippocampal connectivity," *Eur. Neuropsychopharmacology*, 2016. https://www.beckleyfoundation.org/wp-content/uploads/2016/04/LSD-music-parahipp-connectivity.pdf
36. M. Kaelen et al., "Effects of LSD on music-evoked brain activity," bioRxiv 153031, 2017. https://www.biorxiv.org/content/10.1101/153031v1
37. K. Preller et al., "The fabric of meaning and subjective effects in LSD-induced states depend on serotonin 2A receptor activation," *Current Biology* 27, 2017 (summary). https://www.moreblossom.com/papers/the-fabric-of-meaning-and-subjective-effects-in-lsd-induced-states-depend-on-ser ; press: https://www.sciencedaily.com/releases/2017/01/170126132544.htm
38. F. Barrett, K. Preller and M. Kaelen, "Psychedelics and music: neuroscience and therapeutic implications," *Int. Rev. Psychiatry* 30(4), 2018. https://mindmedicineaustralia.org.au/wp-content/uploads/3_Psychedelics-and-music.pdf
39. D. Terhune et al., "A placebo-controlled investigation of synaesthesia-like experiences under LSD," *Neuropsychologia* 88, 2016 (summary). https://www.psypost.org/lsd-induce-genuine-synesthesia-something-different ; record: https://research.gold.ac.uk/id/eprint/17844
40. M. Wittmann et al., "Effects of psilocybin on time perception and temporal control of behaviour in humans," *J. Psychopharmacology* 21(1), 2007. https://www.pubmed.gov/16714323/
41. Standard psychoacoustics references, not fetched this session: E. Zwicker and H. Fastl, *Psychoacoustics: Facts and Models* (sharpness, roughness); R. Plomp and W. Levelt, "Tonal consonance and critical bandwidth," *JASA* 38, 1965; B. Glasberg and B. Moore, "Derivation of auditory filter shapes from notched-noise data," *Hearing Research* 47, 1990 (ERB formula).
42. DAFx-26 paper 29, SPICE-referenced evaluation of digital Moog ladder models (early-stage nonlinearities matter most; boundary-only tanh diverges). https://www.dafx.de/paper-archive/2026/papers/DAFx26_paper_29.pdf
43. D. Huron, *Sweet Anticipation: Music and the Psychology of Expectation*, MIT Press, 2006 (ITPRA). Standard reference, not fetched.

**Not verified this session.** Tempo range of the stock 303 tempo knob. Exact taper of the decay and cutoff pots (exponential mappings assumed, fitted from Open303). Whether "200 ms–2 s" means τ or audible length. The real accent-sweep discharge path impedance (τd ≈ 100 ms is an estimate from component values). Exact 909 kick fundamental. Mix-level targets are practice, not measurements.
