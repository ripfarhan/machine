# 07: Variation vocabulary. Effects, transitions, sources and theory devices to add

**Problem.** After 3–4 hours the owner hears "the same 6–8 effects cycle". This report adds a larger vocabulary *on top of* what the engine already does. It removes nothing. Everything is meant for a plain-JS AudioWorklet at 48 kHz with 128-sample blocks, with no samples (all sources synthesised).

**Builds on.** `02-peers-and-styles.md` (artist profiles and the 14-card atlas), `04-composition-generative-ai.md` (harmony, NR moves, motif operators, form, habituation) and `06-case-studies.md` (measurements of ten Max Cooper tracks). Where those files already cover something, this report points to them (as "02 §x", "04 §x") instead of repeating it.

**Labels.** `[n]` is a source in the list at the end. `[I]` is my own inference or standard DSP practice; treat its numbers as tunable starting values. CPU cost is relative to one JS core at 48 kHz: **low** is under about 0.3% (fewer than about 30 flops per sample), **med** is 0.3–2%, **high** is over 2% [I].

---

## 0. Why it repeats, and the arithmetic of freshness [I]

At 124 BPM a 16-bar section lasts 31 s, so 3 hours contains about 350 section boundaries. Suppose the engine draws two moves per boundary from a pool of 8. Each move then recurs about 90 times, roughly every 2 minutes, and the ear catches that easily. With 25 transition moves, 27 effects and parameters re-randomised on each use, the same *gesture with the same settings in the same structural slot* recurs only about once every 25–40 minutes, and pairs of moves (25C2 = 300) almost never repeat. Three rules follow, and the rest of the report is built to serve them:

1. **Pool size.** Each world needs at least 12 available transition moves and at least 8 available colour effects, not 3–4.
2. **Re-parameterise on every use.** Each item below gives *ranges*. Draw within them every time, and never reuse the last draw's value within ±15%.
3. **Plain boundaries.** 35–50% of boundaries should carry *no* move, only an arrangement change. A move works because it is rare (see §B.2 cooldowns).

---

## A. Effects and processes (27)

Format per item: **Sound / where heard** · **Recipe** · **Slot** · **CPU**.

### A1. Granular cloud / freeze
- **Sound.** Hopkins builds pads from piano with the Bubbler granular delay [34:02]. Cooper runs live granular in his set [19]. Used heavily, it gives a shimmering smear; frozen, it gives a held "photograph" of a chord.
- **Recipe.** 4 s stereo ring buffer. Poisson grain spawns at ρ = 6–60 /s. Grain: 30–250 ms (literature 1–100 ms [27]; longer for pads), 1024-point Hann table, start = write head − (50 ms…3 s) ± 0–400 ms jitter, rate from {0.5, 1, 1.5, 2} or chord-tone ratios, pan ±0.7. Cap 24 grains (steal oldest), linear interpolation, normalise by 1/√(ρ·dur). **Freeze** = stop the write head, jitter 80–300 ms so the frozen spot keeps moving.
- **Slot.** Send (return at −12 to −6 dB) for continuous use. Transition for freeze bridges (B11). Also usable as an instrument (D10).
- **CPU.** Med. At ρ·dur ≈ 6 overlapping grains it costs about 6 × (interp + window) ≈ 60 flops per sample.

### A2. Shimmer reverb
- **Sound.** The Eno/Lanois sound (U2, "4th of July"): a pitch shifter at +1 octave inside a feedback loop with a long reverb. The return was HP/LP-filtered and pushed until the loop "nearly recirculated out of control" [1]. It became the post-rock and ambient halo, and is the Afterlife breakdown signature [I].
- **Recipe.** Hall output → pitch shift +12 st (sometimes +7) → HP 400 Hz / LP 7 kHz → × g_s (0.25–0.55) → tanh → back into the hall input. Shifter: two read heads whose delay ramps at (1 − ratio) samples/sample within a 40–90 ms window, offset by half a window, triangular crossfade. g_s > 0.6 runs away.
- **Slot.** Send on pads and piano only, never drums. Raise g_s over breakdowns; cut to 0 on the drop.
- **CPU.** Med (one shifter plus the existing hall).

### A3. Reverse delay, and the "pre-verb" swell
- **Sound.** Backwards echoes that suck *into* each note. The reverse-reverb swell (a reverb tail rising into a downbeat) is everywhere in Bicep, melodic techno and Burial transitions [I]. Bicep's "Glue" puts reversed percussion at the end of every second bar [13].
- **Recipe, reverse delay.** Double buffer, L = ⅛–1 bar: record into one while the other plays backwards, Hann-windowed, with a second head at L/2 so windows sum flat. Feedback 0–45%.
- **Recipe, pre-verb [I].** The composer knows the future. 1–2 bars before a scheduled chord, start pink noise → A6 resonator bank tuned to the *upcoming* chord, rising exponentially by 30 dB, plus a hall send. Cut to 0 within 5 ms at the downbeat. It sounds like a reversed reverb of the next chord, with no lookahead rendering.
- **Slot.** Reverse delay: send. Pre-verb: transition (B7).
- **CPU.** Low for both.

### A4. Frequency shifter (Bode)
- **Sound.** Inharmonic, "detuned-in-Hz" metallic movement. Small shifts (0.2–3 Hz) give a barber-pole phaser. Inside a delay loop each repeat climbs or falls in pitch: the "spiral" echo used in IDM and dub [I].
- **Recipe.** Single-sideband modulation: analytic signal from a Hilbert all-pass pair, multiplied by a complex sinusoid, real part kept [5]. Use the classic 4+4 polyphase all-pass pair (Niemitalo's coefficients, 2nd-order sections of the form y[n] = a²(x[n] + y[n−2]) − x[n−2]; path A ≈ {0.6923878, 0.9360654, 0.9882295, 0.9987488} with one extra sample of delay, path B ≈ {0.4021921, 0.8561711, 0.9722910, 0.9952885}) [I, verify against the published table]. Output y = A·cos(ωt) − B·sin(ωt). Shift range ±0.1–40 Hz. Put it in the tape-delay feedback path with a shift of ±3–12 Hz per pass.
- **Slot.** Insert on hats or pads; delay-loop insert for spirals.
- **CPU.** Low (16 multiply-adds plus a sin/cos oscillator).

### A5. Ring modulator
- **Sound.** Four Tet runs percussion such as the open hat in "Three" through a ring mod, then chorus and phaser [11]. It also gives Moderat-style clangour on stabs.
- **Recipe.** y = x·sin(2πf_c t). f_c is either fixed at 150–900 Hz or note-tracked to the chord root × {1, 1.5, 2}. Mix 15–50%. Pre-HP the input at 200 Hz so the kick does not alias into mud.
- **Slot.** Insert on hats, perc and stabs.
- **CPU.** Low.

### A6. Tuned resonator bank: make noise sing the chord
- **Sound.** Ableton's Resonators is five parallel tuned resonators. Tuned to root, +4, +7, +12, −12, they turn speech into a chord that follows the speech's level contour, turn white noise into "an airy, choir-like chord", and turn drums into arpeggios [10]. This is the single best way to tie the existing rain, hiss and crackle textures to the harmony.
- **Recipe.** 4–6 feedback combs: y_k[n] = x[n] + g_k·LP(y_k[n − D_k]), D_k = sr/f_k (fractional delay), one-pole LP 2–8 kHz in the loop ("colour"), g_k = 10^(−3·D_k/(sr·T60)) with T60 = 0.3–6 s (e.g. 220 Hz, 2 s → g = 0.984). Tune to the voicing's root/5th/9th/octave. On a chord change, crossfade banks over 30–80 ms, or glide for a "bend". Inputs: rain/hiss, drum send, crackle. Modal variant: one 2-pole BPF per partial (no comb harmonics).
- **Slot.** Send from the textures and drums; insert on the rain layer in Cooper worlds ("rain→grid" becomes "rain→chord").
- **CPU.** Low to med (about 6 delay lines).

### A7. Formant / vowel filter
- **Sound.** "Talking" pads, choir from noise, wah-like drums. Burial's ghost vocals are formant-like smears [34:02].
- **Recipe.** 3 parallel SVF bandpasses at F1/F2/F3, bandwidth 60–120 Hz, gains 0/−8/−18 dB. Adult-male vowel centres (Peterson & Barney style) [I]: /a/ 730/1090/2440 · /e/ 530/1840/2480 · /i/ 270/2290/3010 · /o/ 570/840/2410 · /u/ 300/870/2240 Hz; × 1.15–1.25 for a female set. Morph log-frequencies along a vowel path (a→o→u) by LFO (0.05–0.5 Hz) or note events.
- **Slot.** Insert on pads, the drone and the D7 choir; occasional insert on the drum bus during breaks.
- **CPU.** Low.

### A8. Wavefolder
- **Sound.** Buchla/Serge west-coast brightness, a rubbery and vocal harmonic sweep different from filter opening. It suits Hopkins/Moderat-style "dirty bloom" leads (Moderat: "the clean synth sound isn't the most euphoric") [21].
- **Recipe.** A saturating folder runs a fold in parallel with tanh: y = tanh(g·x) + G·sin(π·k·g·x), with G = −0.5…−0.1, drive g 1–6. A feedback variant adds 0.9·tanh(y[n−1]) for resonant motion [3]. Esqueda et al. model the Buchla 259 and handle antialiasing in [4]. Practical choice: 2× oversampling with a half-band FIR (or ADAA first order), then DC-block. Modulate g with the filter envelope.
- **Slot.** Insert on lead or bass, before the filter (or after, for a harsher sound).
- **CPU.** Low to med (2× OS ≈ 40 flops per sample per voice; use it on a mono voice).

### A9. Tape stop / tape start / backspin
- **Sound.** The whole mix winds down like a reel losing power. BoC endings (02 card 6) and Burial, Ross From Friends and lo-fi house drops [I].
- **Recipe.** Capture the music bus into a 3 s ring buffer. At trigger, a read head starts at the write head with rate r(t) = (1 − t/T)^p, T = ¼–2 beats, p = 1.5–2.5. Advance the position by r per sample, read with Hermite interpolation, and apply an LP filter whose cutoff tracks 18 kHz·r^0.7. Gain ramps to 0 over the final 10% of T. **Tape start** reverses the curve (r: 0→1 over ½–1 beat). **Backspin**: r goes from 1 to −3 over 80 ms and back to 0 over 400 ms.
- **Slot.** Transition (B8), master or music bus.
- **CPU.** Low.

### A10. Audio beat-repeat / buffer stutter (on audio, not note events)
- **Sound.** Ableton Beat Repeat. It differs from the existing note-event repeat because it captures FX tails, the reverb state and filter positions. SOS gives drum settings (offset 4/16, grid 1/8, gate 6/16), pad settings (interval ½, grid ⅛, gate ⅜, Insert mode) and pitch decay down a 4th [8].
- **Recipe.** Parameters per [8]: Interval (½–4 bars), Offset (0–15/16), Grid (1/4…1/32, triplets optional), Gate (> Grid), Chance (0.1–1), Variation (±1 grid step), Decay (0–40% per repeat), Pitch (0 to −12 st, applied by resampling the slice at rate 2^{−p·i/12}), BP filter on repeats, Mode Mix/Insert/Gate. Crossfade 3–5 ms at slice boundaries. Ramp the grid 1/8 → 1/16 → 1/32 over the final beat for "build" stutters.
- **Slot.** Drum-bus or music-bus insert, mainly in transitions (B9).
- **CPU.** Low.

### A11. Gated reverb
- **Sound.** Padgham and Collins ("In the Air Tonight"): ambience gated by the close mic, hold ≈ 0.5 s, fast release [9]. Today it reads as 80s-retro or Bicep-style euphoric breakbeat snares [I].
- **Recipe.** Send the snare to a dense short room (FDN with 4 lines, T60 2–3 s). A gate keyed from the dry snare envelope sets hold = 180–500 ms (sync to ⅛ or a dotted ⅛) and release = 8–30 ms. Alternatively shape the reverb output with a "NonLin" envelope (flat, then a cliff). Pre-compress the reverb 6:1 for density.
- **Slot.** Insert on the clap/snare return; also a "full-stop" transition (B19).
- **CPU.** Low to med.

### A12. Rotary / Leslie
- **Sound.** Organ swirl (Frahm, Reich's organ pieces), and slow "chorale" movement on pads.
- **Recipe.** Crossover at 800 Hz [7]. **Horn** (highs): speed 0.83 Hz chorale / 6.67 Hz tremolo; **drum** (lows): 0.67 / 5.67 Hz [7]. The horn is a Doppler source on a circle [6]. With an assumed radius of 0.15 m, modulate a delay by ±r/c ≈ ±0.44 ms, plus AM of 3–6 dB and a stereo pan from the same phase (L/R mics 90° apart). The drum gets AM 2–4 dB and a slight LP-cutoff wobble [6]. Speed changes ramp: horn τ ≈ 0.7–1 s, drum τ ≈ 3–5 s [I]. The ramp is the expressive part.
- **Slot.** Insert on organ (D6) and pads. Move the speed at section boundaries.
- **CPU.** Low to med.

### A13. Pitch-shift delay ("crystal echo")
- **Sound.** Echoes that climb in fifths or octaves. Eno-like sparkle on plucks, and downward octave echoes for darkness [I].
- **Recipe.** Tape-delay line with the A2 shifter in its feedback path. Interval chosen from {+12, +7, −12, +5}. Delay ⅜ or ¼ beat-synced; feedback 30–60%; LP 6 kHz in the loop. Gate it so only every *n*th note is sent.
- **Slot.** Send for piano and arps.
- **CPU.** Low to med.

### A14. Doppler fly-by
- **Sound.** A riser or perc hit that whooshes past the listener. A cinematic transition that also suits Cooper's spatial approach [19].
- **Recipe [I].** Source path x(t) = v·(t − t0), passing distance d0 = 1–3 m, v = 10–40 m/s. Distance r = √(x² + d0²). Delay = r/343 s (fractional, Hermite interpolation), gain = 1/max(r, 0.5), air LP cutoff = 20 kHz/(1 + r/8), pan = x/r. Pass duration 1.5–4 s. Source: noise riser, a perc roll, or the arp bus itself.
- **Slot.** Transition (B18).
- **CPU.** Low.

### A15. Trance gate / rhythmic gate
- **Sound.** The Hopkins flipped gate on sustained saws [34:02], and Bicep's "Glue" lead gated by a copy of the marching-snare MIDI [13].
- **Recipe.** 16-step or 32-step gain pattern with per-step depth 0.6–1, attack 1–3 ms, release 15–90 ms. Draw patterns from Euclidean rotations, *or key the gate from a hidden percussion lane* so the gate and drums lock. Depth ramps 0 → 1 over a build.
- **Slot.** Insert on pads, drones and the D5 supersaw.
- **CPU.** Low.

### A16. Dub send-throws
- **Sound.** Basic Channel / dub techno: a chord stab thrown into tape delay that dissolves into the fog. The Attack recipe: send 100% into a delay with one tap at dotted ⅛ (feedback ≈ 20%) and one free tap at 264 ms (feedback ≈ 85%), with a HP shelf at 280 Hz and a 0.25 Hz LFO on the send filter [22].
- **Recipe.** A "throw" is a per-event send gate. For one hit (the last snare of a phrase, or one stab), send level goes from 0 to 0 dB, then back to 0 within 1 beat. Over the next 2 bars, ride the delay feedback from 0.85 → 0.5 and sweep the in-loop BP filter 600 Hz → 2.5 kHz.
- **Slot.** Transition and phrase end (B10). Uses the existing tape delay.
- **CPU.** None extra.

### A17. Spectral-ish blur (cheap and expensive versions)
- **Sound.** A smeared wash in which the attacks disappear (Hopkins and Cooper breakdowns) [I].
- **Recipe (cheap) [I].** "Infinite diffuser": 6–8 Schroeder allpasses (7–60 ms, g 0.6–0.7), each modulated ±0.5 ms at 0.1–0.3 Hz, end fed back to start at 20–40% through LP 5 kHz.
- **Recipe (expensive).** STFT freeze, N = 2048, hop 512: hold magnitudes, jitter phase advance ±π/8 per frame (about 3% of a core per channel in JS).
- **Slot.** Send; transition freeze (B11).
- **CPU.** Cheap version med; STFT version high.

### A18. Sub drop / 808 boom
- **Sound.** The downbeat after a break lands with a pitched sub that falls. Bicep "Glue" uses a sustained 808-style kick with a pitch drop as its sub-bass [13]. Aphex's "Vordhosbn" has a distorted 808 boom that pitches up abruptly at one point [17].
- **Recipe.** Sine (with optional 2% triangle) at f0 = root (MIDI 28–40). Pitch envelope from +12 st (or +7) to 0 over 40–120 ms, then an optional slow fall of −2 to −12 st over 1–2 beats. Amp decay 1.5–4 s. tanh drive 4–12 dB for harmonics, then LP 300 Hz. Duck the regular bass for its duration.
- **Slot.** Transition (B14); also an instrument (D8).
- **CPU.** Low.

### A19. Risers, including the endless Shepard riser
- **Sound.** Noise and pitch risers into a drop (melodic techno, Afterlife). A Shepard or "For Ann" glissando rises without arriving: Tenney's version stacks sweeps 8 octaves long over 33.6 s, a new sweep every 2.8 s, crossfaded over the bottom and top 2 octaves [24][23].
- **Recipe.** (a) **Noise riser**: white noise → SVF BP 200 Hz → 8 kHz (exponential) over 4–16 bars, Q 1 → 6, +12 dB, widening, optional ⅛ gate in the last 2 bars. (b) **Pitch riser**: saw stack gliding +12 st over the last 1–2 bars. (c) **Shepard** [I]: 8 octave-spaced partials rising 1 octave per 2–8 bars, gain = raised cosine over log-frequency (centre ~600 Hz, span 8 octaves), wrapping top → bottom. Use it for 16–64-bar Hopkins-style ramps, since it never "arrives" early.
- **Slot.** Transition (B6, B25).
- **CPU.** Low.

### A20. Impacts and downlifters
- **Sound.** The boom plus noise crash on a downbeat, and the falling noise "exhale" after a peak [I].
- **Recipe.** **Impact**: A18 boom + noise burst (HP 300 Hz, decay 400 ms) + a 6 s hall send at −6 dB + 30 ms of tanh-crushed transient. **Downlifter**: noise HP sweep 8 kHz → 150 Hz over 1–4 bars with level −18 dB → −40 dB, plus an optional pitch-down of the arp bus by −12 st over 2 bars using the A9 machinery.
- **Slot.** Transition (B6, B21).
- **CPU.** Low.

### A21. Multiband sidechain (better variant of kick-ducking)
- **Sound.** Cooper sidechains *only the low band* through a 3-band crossover, so the kick never pumps the highs [19]. The result is a cleaner pulse than whole-bus ducking.
- **Recipe.** Linkwitz-Riley crossover at 120–180 Hz on the music bus (2 cascaded Butterworth 2nd-order sections per side). Duck only the low band, depth −3 to −10 dB, release 60–180 ms. Optional *inverse* variant for "breathing" pads: duck the high band by 1–2 dB on each offbeat hat.
- **Slot.** Music-bus insert (world-selectable).
- **CPU.** Low.

### A22. Low-pass gate "plonk" (vactrol)
- **Sound.** Buchla bongo and woody, rounded hits. It replaces bell plucks while keeping a percussive pitched voice. Floating Points' Buchla world [34:02].
- **Recipe [I].** A single control signal c(t) drives *both* the VCA and LP cutoff (cutoff = 80 Hz·(1 + 200c²)). c follows a vactrol-like asymmetric response: attack 2–8 ms, decay τ 150–1200 ms with a nonlinear tail (τ grows as c falls: τ_eff = τ·(1 + 2(1 − c))). Excite with a 1–3 ms ping or a sine/triangle.
- **Slot.** Voice processor; replaces the modal "glass/kalimba" voices in some worlds.
- **CPU.** Low.

### A23. Flanger / jet sweep
- **Sound.** Aphex flanges percussion and "explosion" effects in "Vordhosbn" [17]. A jet sweep on hats through a build [I].
- **Recipe.** Delay 0.2–8 ms modulated by LFO 0.03–0.5 Hz (or a one-shot sweep over 2–8 bars), feedback ±0.4–0.8, mix 50%. A through-zero variant compares against a dry signal delayed by 4 ms.
- **Slot.** Drum-bus insert in builds; a hat insert continuously.
- **CPU.** Low.

### A24. Parallel "dirt" bus
- **Sound.** Hopkins crescendos (02 card 1). Moderat "resample to sound more worn", Analog Heat style saturation [21].
- **Recipe.** Send music and drums to a parallel bus: HP 120 Hz → drive 12–30 dB → asymmetric clip y = tanh(x + 0.15x²) → LP 3–6 kHz → compressor 4:1. Return at −24 dB (intro) → −8 dB (peak). Map the return level to the energy curve so distortion *becomes* the crescendo.
- **Slot.** Send; driven by form.
- **CPU.** Low.

### A25. Spring reverb (dispersive)
- **Sound.** The "boing" chirp of dub sends, Frahm's spring and tape world, and Kiasmos' wobbly Space Echo world [30].
- **Recipe [I] (after Välimäki/Parker/Abel parametric spring models).** 40–80 cascaded first-order allpasses (a = 0.5–0.7), which produce the dispersive chirp, inside a feedback loop with a delay of 25–60 ms, feedback 0.6–0.85, LP 4 kHz. Run 2 detuned loops for stereo. Add a "drip" by modulating loop delay ±0.2 ms at 1–3 Hz.
- **Slot.** Send for dub throws, snares and piano.
- **CPU.** Med (about 160 allpass stages per sample).

### A26. Lopsided dual tape echo
- **Sound.** Moderat run two tape echoes, "each broken in a different way", so the stereo image is lopsided [21]. Kiasmos value Space Echoes that "slow down occasionally" [30].
- **Recipe.** Split L and R into two independent tape-delay instances with different wow (0.4 vs 0.7 Hz), different flutter depth, times differing by 3–9% (e.g. 375 ms vs 395 ms), different LP (3.5 vs 5 kHz), and occasional random "slow-downs": rate dips of 1–3% for 150–600 ms with probability 0.02 per bar.
- **Slot.** Replaces the ping-pong option in Moderat, Kiasmos and dub worlds.
- **CPU.** Low (a second delay instance).

### A27. Envelope-follower cross-modulation
- **Sound.** Pads that breathe with the drums. A "web" of modulation like Cooper's random-LFO jamming within bounds [20].
- **Recipe [I].** Envelope follower on the drum bus (attack 5 ms, release 80–300 ms) → pad cutoff (±0.5–1.5 oct), delay feedback (±10%), grain density (A1) or resonator decay (A6). Also: bass envelope → arp filter (inverse). Choose 1–2 routings per section from a list of 8, with a cooldown.
- **Slot.** Modulation matrix (composition rule).
- **CPU.** Low.

---

## B. Transition and arrangement moves (25)

### B.1 The moves

Timing is given relative to a boundary at bar 0. "−2" means 2 bars before the boundary; "↓" is the downbeat. Each move draws its parameters from its range on every use.

| # | Move | Lead time | What drops | What lands on ↓ | Recipe / params | Heard in |
|---|---|---|---|---|---|---|
| B1 | **Drum filter-down** | −4…−1 | drum highs | drums snap open | Drum-bus LP 18 k → 250–600 Hz, exp curve, res 0.3 | Kiasmos live filtering (Bass Station) [30] |
| B2 | **HP build** | −8…−2 | lows, gradually | full range + kick | Music-bus HP 20 → 250–500 Hz; kick drops at −1 | club standard [I] |
| B3 | **Kick-less bar** | −1 (or bar 3 of 4) | kick (and sub) | kick returns | mute kick for 1 bar; keep hats | Bicep breaks leave bar 3 kickless [12]; "Glue" drums drop at the end of every 4th bar [13] |
| B4 | **Air gap** | last ½ beat – 1 bar | everything but reverb tails | all at once | hard mute, tails continue; once per 10+ min | 04 §5.6 |
| B5 | **Accelerating roll** | −4…−1 | — | crash/impact | clap/snare at ¼ → ⅛ → 1/16 → 1/32 per bar, velocity 0.4 → 1, pitch +0 → +7–12 st, HP 100 → 800 Hz | trance, melodic techno [I] |
| B6 | **Riser + impact** | −4…−16 | — | A20 impact | A19 riser; impact −3 dB below kick | Afterlife [I] |
| B7 | **Pre-verb swell** | −1…−2 | — | new chord, cut | A3: resonator bank tuned to the *next* chord, exp rise, cut at ↓ | Bicep reversed perc [13] |
| B8 | **Tape stop out / start in** | last ¼–2 beats | everything (mechanically) | new section via a ½-beat tape start | A9; avoid within 20 min of B4 | BoC, lo-fi house [I] |
| B9 | **Stutter** | last 1–2 beats | — | full groove | A10, grid ⅛ → 1/16 → 1/32, pitch decay −2…−12 st | Beat Repeat [8] |
| B10 | **Dub throw** | last hit of bar 8 or 16 | — | (no change; tail rides on) | A16 | Basic Channel [22] |
| B11 | **Freeze bridge** | −1 | all except freeze | new section enters *under* the freeze; freeze fades over 2–4 bars | A1/A17 freeze on the last chord | Hopkins/Cooper breaks [I] |
| B12 | **Pedal bridge** | −8…0 | upper harmony changes, pedal holds | new key or world on top of the old pedal | 04 §2.4; pedal = common tone of both keys | 04 §5.7 |
| B13 | **Half-time switch** | 0 → +4…+8 | half the kicks/snares | — | drum grid ×2 spacing, same BPM; return on next boundary | 04 §5.5 |
| B14 | **Sub drop** | 0 | — | A18 boom | only after a section with sub removed ≥ 8 bars | Bicep "Glue" sub [13] |
| B15 | **Pull-out** | −2…0 | all but 1–2 elements (hats + pad) | everything returns | elements chosen by lowest recent salience | Burial drops drums 2–6 bars (02 card 7) |
| B16 | **False downbeat** | 0 → +4/+8 | the expected drums | only pad + bass on ↓; drums arrive at +4 or +8 | max once per 30 min | [I] |
| B17 | **Master breath** | −1 | highs | snap back | master LP 20 k → 1.5–3 kHz over the bar, res 0.2, + 2 dB level dip | [I] |
| B18 | **Fly-by** | −2…0 | — | — | A14 on a noise or perc roll, L→R or R→L | [I] |
| B19 | **Gated full-stop** | last beat | everything after the hit | (½ beat silence) → ↓ | last clap through A11 with hold ⅛, then mute | 80s gated verb [9] |
| B20 | **Tonal tom fill** | last 2 beats | hats | — | toms tuned to scale degrees 5–4–3–1, 1/16s | Bodzin tonal toms (02 card 5) |
| B21 | **Downlifter exit** | 0 → +2 | drums, bass | breakdown pads | A20 downlifter from the peak into a break | [I] |
| B22 | **Filter ride** | −16…0 | — | full cutoff on ↓ (or −8 dip) | arp LP 600 Hz → 6 kHz across 16 bars | 02 card 5 [34] |
| B23 | **Pattern swap** | 0 | old hat/kick pattern | alternative pattern B | each world stores 2–3 kick and 2–3 hat patterns | Aphex SAW two-pattern switching (02 card 12) |
| B24 | **Anticipation push** | ⅛ before ↓ | — | the chord/bass arrives an 8th early | 04 §2.8; peaks only | [I] |
| B25 | **Endless build** | −16…−64 | — | anything (the build never "arrives" too early) | A19c Shepard partials under the existing crescendo | Tenney/Shepard [24][23] |

### B.2 Rotation and cooldowns [I]

```js
// One record per move. cooldownBars is the hard minimum; tau is the soft novelty recovery (04 §5.7 model).
const MOVES = {
  B1:{cat:'filter', cool:32,  tau:96,  boundary:['minor','major']},
  B4:{cat:'silence',cool:160, tau:400, boundary:['major']},
  B8:{cat:'mech',   cool:192, tau:500, boundary:['major','chapter']},
  B16:{cat:'surprise',cool:400,tau:900,boundary:['major']},
  // ...
};
function pickMoves(boundary, bar, world, rng){
  const budget = {minor:[0,1], major:[1,3], chapter:[2,3]}[boundary];      // number of moves
  if (rng() < (boundary==='minor' ? .55 : .3)) return [];                  // plain boundaries
  const cands = Object.entries(MOVES).filter(([id,m]) =>
      m.boundary.includes(boundary) && bar - (m.last ?? -1e9) >= m.cool && world.allow(id));
  const w = ([id,m]) => world.weight(id) * (1 - Math.exp(-(bar - (m.last ?? -1e9)) / m.tau));
  const out = [], usedCats = new Set();
  while (out.length < budget[1] && cands.length){
    const c = weightedPick(cands, w, rng);
    if (usedCats.has(c[1].cat)) { cands.splice(cands.indexOf(c),1); continue; } // 1 per category
    out.push(c[0]); usedCats.add(c[1].cat); c[1].last = bar;
    if (out.length >= budget[0] && rng() < .5) break;
  }
  return forbidPairsSeenRecently(out, 1800 /* bars ≈ 1 h */);
}
```

Guardrails:
1. **Categories** (filter, pitch-gesture, silence, mechanical, rhythmic, spatial, harmonic, surprise): at most one move per category per boundary. At most one "loud" move (riser, impact, sub drop) per major boundary.
2. **Silence-type moves** (B4, B8, B16, B19) never on consecutive major boundaries, and at most 3 per hour in total.
3. **Signature moves.** Each world lists 3–5 signature moves at weight ×3 and bans 3–6 that clash (Burial bans B5, B6 and B20; Eno bans all drum moves).
4. **Re-parameterise** every use: draw lead time, curve exponent, pitch interval and target cutoff within range, and reject draws within 15% of the previous use.
5. **Pair memory.** Do not repeat the same 2-move combination within about 1 hour (1,800 bars at 124 BPM).
6. **Proportion.** Over any 30-minute window, no single move should account for more than 12% of all moves used.

---

## C. Music-theory variation devices

All devices sit inside the anti-cheese rules of 04 §2.1–2.3: no close-position 7ths in the mid register, no dominant 7ths or ii–V, at most one colour tone in the HIGH slot, bass on the root or 5th. Below, each device gets an algorithm and *extra* guardrails.

### C1. Modulation types

| Type | Algorithm | When it sounds good here | Guardrail |
|---|---|---|---|
| **Common-tone (pivot-pitch)** | Find the pitch classes shared by the old tonic chord and the new one (e.g. Am → F♯m share A, C♯/E…). Sustain the common tone in the top voice or drone for 2–8 bars across the change | Chapter changes; Cooper "shifting light" | The common tone must be in the top or drone voice; change the bass last |
| **Pedal-bridge** | Hold the old tonic as a pedal; move the upper loop into the new key; release the pedal to the new root on a major ↓ | Any key change; the safest move | ≥ 8 bars of overlap; the pedal pitch must be diatonic to both keys (it can be the 5th of one) |
| **Relative (Am ↔ C)** | Keep the pitch set; move the bass/pedal from 1 to ♭3 (or the reverse) | Break → peak flip; brightening without new notes | Only by moving the *bass*; chords stay voiced as power/sus |
| **Parallel / modal (A Aeolian → A Dorian → A Lydian)** | Keep the tonic; change one scale degree per move (♭6→6, then 4→♯4); one degree per ≥ 16 bars | Brightness ladder at peaks (04 §2.2) | Introduce the new degree first in a pad inner voice, never as a lead downbeat |
| **Chromatic mediant** | Root ±3 or ±4 semitones with quality preserved (Am → C♯m, Am → Fm) | One "awe" event per piece, at the breakdown → peak boundary (04 H6) | Approach via B11 freeze or B12 pedal, never by a straight cut on a busy groove |
| **Step-up at peak (+2)** | Transpose everything +2 st for the final peak only | Hopkins/Afterlife "lift" at the last 16–32 bars | Never +1 (the "truck driver's gear change" is a ballad cliché that MusicRadar flags as frowned upon [25]); only from power-chord or pedal textures; at most 1 per 30 min; precede it with B4 or B11 so it isn't a naked shift |
| **Fifth-drift across chapters** | Chapter keys move ±1 on the circle of fifths (or relative switch), DJ-style [I] | Hours-long sessions: a slow tonal journey | Never more than 2 consecutive steps in one direction; return home every 4–6 chapters |

### C2. Modal interchange (borrowed chords)
- **Allowed in minor:** IV (Dorian lift, e.g. Am → D5/Dsus2), ♭II only as a *neighbour* over a tonic pedal (Phrygian darkness: Am/A → B♭/A → Am), ♭VII, and v as a power chord (never V major with its leading tone in the bass).
- **Allowed in major:** iv (Am in E major, the "In My Life" colour; 04 §2.2), ♭VI, ♭VII, and Lydian II over the tonic pedal.
- **Algorithm.** In a loop of n chords, replace at most 1 chord per 8 bars with its borrowed counterpart from an adjacent mode on the brightness ladder. Voice it as 5th+9th or sus, never as a full triad with the 3rd in LOW-MID.
- **Guardrail.** Borrowed chords go only on bars 4 or 8 of a phrase, or on the boundary into a break. Never two borrowed chords in a row.

### C3. Neo-Riemannian additions (beyond 04 §2.6)
- **S (Slide):** C ↔ C♯m (keep the 3rd and move root and 5th a semitone). Eerie.
- **H (Hexatonic pole, LPL):** C ↔ A♭m. Film music's "uncanny" move (Cohn's analyses) [I].
- **N (Nebenverwandt, RLP):** C ↔ Fm.
- **Hexatonic cycle walk:** PLPLPL gives 6 triads drawn from one 6-note set (C, Cm, A♭, A♭m, E, Em). This is a long, smooth, non-functional loop for ambient worlds.
- **Guardrails.** S, H and N count as "events" (cost 3 in the 04 surprise budget), at most 1 per section. Voice them with the common tone in the top voice. Allow them only at tempos ≤ 124 or in breakdowns.

### C4. Pedal and ostinato layering
- **Types:** tonic pedal; dominant pedal (5th in the bass; the "suspended" feel of builds); **inverted pedal** (a high sustained tone over moving harmony: glassy, 04 §2.7); **double pedal** (1 + 5); **rhythmic pedal** (a repeated 1/16 bass note, rolling-techno style).
- **Ostinato stack [I].** Up to 3 ostinati with lengths in {12, 16, 20, 28} 1/16 steps. Only one may change pitch per 8 bars, so the texture evolves one layer at a time.
- **Pedal-release event.** The bass finally follows the chord (04 §2.4). Save it for the peak ↓; at most once per section.

### C5. Polymeter and polyrhythm
**Polymeter** = same pulse, different loop lengths (3 vs 4 → 12 steps; 5 vs 4 → 20; 7 vs 8 → 56; 3 vs 16 → 48 = 3 bars). **Polyrhythm** = different subdivisions of one span (3:2 triplet ¼ over a half note; 5:4 quintuplet 1/16 per beat).

| Ratio | Where it sounds right | Recipe |
|---|---|---|
| 3:2 | hemiola builds, African-derived perc (Bicep congas [12]) | perc/arp on triplet ⅛ for the last 4 bars of a build |
| 3 vs 4 (dotted ⅛) | melodic techno arps, Frahm lanes | arp onset every 3 steps on a 16 grid |
| 4:3 | half-time worlds; makes 4/4 feel like a 3-pulse | hats every 4 steps over a 12-step loop |
| 5:4 | Floating Points / Four Tet bloom | a 5-step lane as a bass or bongo pattern (02 card 14) |
| 7:8 | IDM, Cooper drift | a 7-step lane on an 8-step hat; resets every 56 steps (3.5 bars) |

**Guardrails [I].** (a) The kick stays on a 4/4 anchor unless the whole world is odd-meter. (b) Only 1–2 voices carry the cross-rhythm at once. (c) Accent the cross-voice's group starts (+4–6 dB velocity) or it smears into noise. (d) Reset every lane at section boundaries, so boundaries are audible.

### C6. Metric modulation and half/double-time
- **Felt-tempo switch (same BPM).** Half-time: kick on 1, snare on 3. Double-time: snare on every beat, hats in 1/32. Switch only at boundaries and hold for ≥ 8 bars.
- **True metric modulation [I].** A subdivision of the old tempo becomes the new beat. Old dotted-⅛ → new ¼ is BPM × 4/3 (93 → 124); old triplet ¼ → new ¼ is × 3/2 (82.7 → 124). For 2–4 bars, play one voice in the target subdivision; on ↓ make it the new ¼ and move the kick onto it.
- **Where.** Cooper describes tempo changes as central to "I Exist Inside This Machine" [19]; Rival Consoles gives each track a different tempo (02 B2).
- **Guardrail.** One true metric modulation per chapter at most. It must land on a section with no lead melody for ≥ 4 bars, so listeners can re-anchor.

### C7. Additive rhythms
- **Generator.** Partition N steps into 2s and 3s. 16 → 3+3+3+3+2+2 (Bicep-ish break skip) or 3+3+2+3+3+2 (double tresillo). 7 → 2+2+3 or 3+2+2. 10 → 3+3+2+2. 5 → 3+2. Accent each group start; place kick or bass on accents.
- **Use.** (a) Inside 4/4: one voice (bass or perc) takes a 3+3+2 or 3+3+3+3+2+2 partition. (b) Whole-world odd meter (7/8 IDM in E3, 5/4 ambient): the kick follows the group starts (7/8 as 2+2+3: kicks on eighths 1, 3, 5, accents on 1 and 5).
- **Guardrail.** In odd-meter worlds, keep harmonic rhythm at multiples of 2 bars and a pedal under the first 16 bars, so the meter is the *only* new thing.

### C8. Hemiola
A 3-beat group pattern repeated across 2 bars of 4/4 (3+3+2 at the quarter level, or a 3/4 pattern over 6/8). Apply it to the arp *and* a perc lane for the last 2–4 bars before a boundary, so the ↓ "rescues" the meter. Cost: 2 surprise points. At most once per 3 boundaries [I].

### C9. Rhythmic displacement
Shift a motif or arp by +1 or +2 sixteenths (Reich-style discrete phase, 04 §3.5). Rules: displace by one step every 8 or 16 repetitions; another voice keeps the 1 (kick or pedal); cap the offset at 4 steps, then reset at a boundary. Combine with B23.

### C10. Canon / round
- **Algorithm.** Voice B = voice A delayed by Δ ∈ {1 bar, 2 bars, ⅜ bar} and transposed by {0, +12, −12, +7}, in a *different timbre and register* (≥ 7 st apart).
- **Vertical check.** At each strong beat, if A and B form a minor 2nd or a tritone in MID/LOW-MID, drop or octave-shift the B note.
- **"Delay canon".** The tape delay itself at ⅜ or ¾ bar with feedback 0 and a +12 pitch shift (A13) turns any motif into a canon for free. Four Tet's delay-derived rhythms are the drum version (02 card 14).
- **Guardrail.** At most 2 voices in canon. Exit the canon at a phrase end, not mid-motif.

### C11. Motif transformations (additions to 04 §3.2)
- **Isorhythm (talea vs. color) [I].** Decouple the rhythm loop (talea, e.g. 3 durations: ⅛, 1/16, dotted ⅛) from the pitch loop (color, e.g. 5 pitches). They realign after lcm(3, 5) = 15 notes. Cheap, and "Cooper-like": a short fixed rhythm with drifting pitches.
- **Pitch-set rotation.** Keep the rhythm; rotate the scale-degree indices by 1 each 8 bars.
- **Register rotation.** Move the motif an octave and swap the roles of lead and bass (bass plays the motif augmented ×2).
- **Guardrail.** Inversion and retrograde are allowed only when the motif has ≥ 1 repeated pitch, because the anchor keeps it recognisable. Augmentation goes in breakdowns, diminution in builds (as 04).

### C12. Harmonic-rhythm acceleration
In the last 8 bars before a peak: harmonic rhythm 8 → 4 → 2 → 1 bars per chord (04 §2.8), **taking chords only from the current loop** (fragment it: [i, VI] alternating faster), never adding new ones. Snap to a single pedal chord at the ↓ (deceleration = release). A variant for no-chord worlds accelerates the *bass-note* rhythm instead (½ → ¼ → ⅛).

### C13. Call-and-response between voices
- **Algorithm.** The call is the A voice for bars 1–2 (lead, or pad stab). The response is the B voice for bars 3–4: a different timbre and register (≥ 7 st apart), derived from the call by an operator of cost 1–2 (04 §3.2), shorter by 25–50%, ending on 1 or ♭3. The call ends on 2, 4 or 5. Bars 5–8: overlap or silence.
- **Pairings.** Lead ↔ gated pad (Innellea-style, 02 card 5), bass ↔ arp, piano ↔ resonator-bank echo (A6 rings out the call's last note as a chord), and drums ↔ dub throw (A16).
- **Guardrail.** The response never repeats the call's pitch content exactly in the same register. Use it in ≤ 50% of phrases.

### C14. "Withheld colour"
Withhold the mode's characteristic note (Dorian ♮6, Lydian ♯4, Phrygian ♭2) for the first 32–64 bars. First introduce it in a pad inner voice at a breakdown, then let it reach the lead at the peak. This works because the note *is* the event [I].

### C15. Anti-cheese master list for C (enforced by the composer) [I]
- No chord with both a 7th and a 3rd in MID (C4–C5). Never 9th + 7th together.
- No V–i cadence with a leading tone in the top voice at tempos ≥ 110. Use ♭VII–i or iv–i.
- Harmonic rhythm ≥ 1 bar (06: the Cooper data shows 1.2–2.3 bars).
- Plucked or bell timbres (modal glass, kalimba, vibes, FM bells) sound at most 25% of any 2-minute window and never as a lone hero for > 32 bars. Alternate them with A22 plonk, D1 acid, D6 organ, D7 choir and D11 stabs.
- Prefer power or sus voicings (06 finds bare fifths most common in every track measured).

---

## D. New sound sources (14)

### D1. Acid 303 (accent and slide rules)
- **Where.** Acid house, Hardfloor, and Afterlife-adjacent acid techno; Hopkins-style crescendo through resonance [I].
- **Synthesis.** Saw/square → 4-pole diode-style ZDF ladder (tanh per stage), resonance 60–92%, cutoff 150 Hz–2.5 kHz, env mod 20–80%, filter decay 30–3000 ms (default ~300). Slide is a constant-time 60 ms glide (range 1–200) on legato notes; accent (velocity ≥ 100) adds a filter sweep and volume boost [28]. The Devil Fish accent sweep "accumulates across fast accented notes" [29].
- **Engine rules [I].** Accent adds +4–6 dB VCA and +30–50% env mod, and shortens the filter decay to about 200 ms. The accent-sweep accumulator is acc += 0.35 on each accent and leaks with τ = 250 ms; add acc × 1 oct to the cutoff. Slide holds the gate and glides 60 ms exponentially.
- **Pattern generator.** 16 steps; note probability 0.55–0.8; pitches drawn from {root ×5, ♭3, 5, ♭7, octave ×2, ♭2 (Phrygian, rare)}; octave-up 15–25%; accent 25–35%, never on two consecutive steps more than twice per bar; slide 12–25%, applied only when the next step is a note. Mutate with the 04 §3.6 Turing machine at pFlip 0.03.
- **Modulation.** The cutoff is ridden by hand: 16–64-bar arcs plus an envelope-follower (A27) from the kick.
- **CPU.** Med (one oversampled ladder).

### D2. Reese bass
- **Where.** Kevin Saunderson, "Just Want Another Chance" (1988, as Reese), then jungle ("Terrorist"), garage and dnb. Attack's basic recipe is two sines at ±0.27 st, mono, release 24 ms [16]. Moderat- and Burial-adjacent darkness [I].
- **Synthesis.** 2 saws ±15–30 cents (at 55 Hz, ±27 c gives about 1.7 Hz beating), with independent slow detune drift ±3 c. Optional third saw an octave down at −9 dB. LP 350–1200 Hz (24 dB), res 15–25%; tanh 3–9 dB *after* the LP, then LP again at 2× cutoff (02 anti-harsh rule). The sub is a separate sine at the root below 120 Hz; the Reese part is HP'd at 100 Hz so the beating never hollows out the sub. Optional phaser/A4 shift (0.3 Hz) for motion.
- **CPU.** Low.

### D3. FM bass and textures (non-bell)
- **Rule.** Integer ratios only for bass (1:1, 2:1, 1:2). Index decays fast, which avoids the DX bell.
- **Recipes [I].** **FM "saw" bass**: carrier 1:1 with self-feedback β = 0.4–1.1 (feedback FM approaches a saw), index env 2.5 → 0.6 over 80–200 ms. **FM "donk/rubber"**: 1:2, index 4 → 0 over 40 ms. **FM growl**: 1:1, index modulated by an LFO of 1/8–1/16 synced, range 0.5–3. **Non-bell texture**: 1:1.003 (slow beat) at index 0.3–0.8 through LP 2 kHz (DX-strings-like, 02 card 12).
- **CPU.** Low.

### D4. Wavetable morph pad
- **Where.** Cooper's "liquid timbre" that flows and morphs [20], with Wavetable for later sound design [19].
- **Synthesis [I].** At startup, build 16 additive tables of 2048 samples (sine → triangle → saw → formant-peaked → odd-only → bright), each with 10 band-limited octave mipmaps. Each voice crossfades between adjacent tables at position p, driven by a 2–8 s envelope plus a 0.02–0.1 Hz LFO. Unison 2 at ±6 c, then the SVF.
- **CPU.** Low to med (memory about 1.3 MB of Float32).

### D5. Supersaw for melodic techno
- **Where.** The JP-8000 supersaw, used for trance and Afterlife leads and pads. The original runs 7 saws per voice with detune coefficients {0, ±128, ±408, ±704/720}, a centre oscillator at fixed gain about 0.195, a mix that rises only for the side oscillators, a HPF on the sum, and accumulators that all start at 0 [2].
- **Engine recipe.** 7 PolyBLEP saws at D × {0, ±0.18, ±0.57, ±1.0} (the normalised coefficients), outer detune D = 8–45 cents; gains centre 1 − 0.55·m, sides 0.6·m, mix m = 0.3–0.8. Random phases at note-on (modern) or all 0 ("JP"). HP at 0.8 × fundamental. No chorus. Route through A15 or A21.
- **Guardrail.** Use it in peaks only (≤ 30% of a piece), with chords voiced as 5ths and octaves; it is overwhelming otherwise.
- **CPU.** Med to high (28 oscillators for 4 notes).

### D6. Drawbar organ (Reich, Frahm)
- **Where.** Reich's *Four Organs* (1970), and Frahm's Juno-as-organ climaxes (02 card 3).
- **Synthesis.** 9 sines at footage ratios 16′ = 0.5, 5⅓′ = 1.5, 8′ = 1, 4′ = 2, 2⅔′ = 3, 2′ = 4, 1⅗′ = 5, 1⅓′ = 6, 1′ = 8 [26]. Registrations (0–8, roughly 3 dB per step): "flute" 008800000, "Reich" 888000000, "gospel-free full" 868000004. Avoid the 1⅗′ + 1⅓′ major-third/fifth pair in the bass, where it turns inharmonic in minor keys [26]. Key click: a 3 ms burst of noise HP'd at 2 kHz at −28 dB on note-on. Percussion: 4′ or 2⅔′ with decay 250–600 ms, triggered only when no other key is held. Into A12 rotary.
- **CPU.** Low to med (9 sines per voice; use a shared phase table).

### D7. Formant choir and vocal-chop synth
- **Where.** Burial's pitched ghost vocals (02 card 7), Eno choir loops (02 card 9), Bicep and Bonobo chops (Bonobo re-pitches acoustic sources past their natural range [31]).
- **Synthesis [I].** Glottal-like source (band-limited pulse, width 15–30%, LP 3 kHz) + aspiration noise at −20 dB gated by the pulse → A7 formants. Vibrato 5–6 Hz, ±15–35 c, 300 ms onset delay, ±5 c jitter. Choir = 3–5 voices at ±8 c.
- **Chops.** 80–300 ms "syllables" (A 5 / R 40 ms), vowel from {a, e, o, u}, pitched +3…+7 st over chord tones. For Burial, place them ±10–40 ms off-grid (he placed sounds by ear, without a sequencer [14]). 6 s reverb send.
- **CPU.** Low to med per voice.

### D8. 808 boom bass with glide
- **Where.** Bicep's sub [13], Aphex's 808 as bassline (02 card 12), and drill/IDM booms [17].
- **Synthesis.** Sine with click (+12 st over 15 ms), glide between notes 30–120 ms (exponential, legato only), decay 1.2–4 s, tanh 6–12 dB (2nd and 3rd harmonics make it audible on phones), LP 400 Hz. Retrigger choice per world: hard retrigger (trap-like, avoid) or legato glide (preferred). Tuned to the root or the 5th.
- **CPU.** Low.

### D9. Synthesised breakbeat and 2-step kits
- **Where.** Bicep breaks at 128 BPM: kick on 1 and on the 4th eighth, bar 3 kickless, 3 layered snare sources, woodblock with 11% chamber, ride downsampled, congas on a 2-note pattern, drum bus at ~60% "boom/transients" and 2–3 dB of glue [12]. UK 2-step at 122–128 BPM with 60–65% swing, no kick on beat 1 of bar 2, snares on 2 and 4, offbeat hats [15].
- **Break realism without samples [I].** Every hit goes through one shared short room (FDN, T60 0.35 s, 18% wet) → bus tanh 3 dB → 12-bit/32 kHz reduction at 30% mix. Ghost snares at velocity 0.25–0.45 with snare decay shortened 40%. "Timestretch grain" on tails: AM at 35–60 Hz with 15% depth.
- **Grids (16 steps, 2 bars where shown).**
```
BICEP BREAK (128)    Kick  X-----x--------- | X-----x-----o---   (kick on 1 + 4th 8th [12]; bar 3 of 4: none)
                     Snare ----X--o-o--X--o | ----X-o----oX-o-   (ghosts o = vel .25–.45) [I]
                     Wood  x-xx-x-xx-x-x-xx  (vel random .4–.9)
                     Conga --x-----x-x-----  (2 pitches, a 5th apart)
2-STEP (122–134, sw 60–65) Kick  X---------x----- | ------x---x-----   (no kick on bar-2 beat 1 [15])
                     Snare ----X-------X--- | ----X-------X-o-
                     Hat   --x---x---x---x- | --x---x---x-x-x-
                     Shaker o-o-o-o-o-o-o-o- (vel .2–.5)
```
- **CPU.** Low to med (one shared room).

### D10. Granular texture instrument
- **Synthesis.** The A1 engine with its *input* set to an internal bus (piano, pad or choir), and grain pitches quantised to the current chord tones (+0, +7, +12 or chord degrees). Density 4–30/s, duration 60–220 ms, position spray 0.2–2 s. Output: HP 200 Hz, LP 9 kHz, width 100%. It becomes the "air" layer that follows the harmony.
- **CPU.** Med.

### D11. Dub-techno chord stab
- **Recipe [22].** Noise on one oscillator (a "chuff" the delays can grab), saw + square (PW about 70) on the other, mixed to favour the saw/square. **Highpass** filter (not lowpass), cutoff low, res about 20, with an LFO on the cutoff. Amp envelope short. Phaser, then a low plate. EQ: −7 dB at 600 Hz (wide), HP 100 Hz, LP 4.5 kHz. Send 100% into the A16 dual delay (dotted ⅛ at 20% feedback, plus a free 264 ms tap at 85%) with a 280 Hz HP shelf whose LFO runs at 0.25 Hz [22].
- **Voicing [I].** Minor triad + 9 or sus2 in the 55–72 MIDI range, stabbed on offbeats at velocity 0.3–0.7. Nudge notes ±5–15 ms for looseness [22].
- **CPU.** Low.

### D12. Rolling techno "rumble" (kick-derived low end)
- **Recipe [I].** Kick → send → dark hall (T60 2–4 s) → LP 120 Hz → tanh 6 dB → sidechain duck from the kick (−12 dB, release 1/16) → mono. Result: a sustained low rumble pulsing between kicks, typical of hypnotic/Berlin techno. Pitch it by tuning the kick to the root.
- **CPU.** Low (reuses the hall algorithm at a low rate: downsample by 4 into a separate small FDN).

### D13. PWM string ensemble
- **Recipe [I].** Two pulse oscillators per voice with PW LFOs at 0.3 and 0.47 Hz (depth 10–40%) → LP 3 kHz, res 0 → three-phase chorus (0.6/0.9/1.3 Hz) → A 400–1500 / R 1500–3000 ms. BoC, Vangelis and Jarre pads differ from the Juno chorus pad by having *no* saw and constant PWM motion.
- **CPU.** Low to med.

### D14. Filter-bank "vocoder" pad
- **Recipe [I].** Carrier: chord saw pad (or D5). Modulator: a hidden rhythmic source (noise bursts on a Euclidean pattern, the drum bus, or the D7 choir). 12–16 bands (BP at log-spaced 120 Hz–8 kHz, Q 6–10); per-band envelope follower (A 2 ms, R 30–80 ms) multiplies the carrier through the same band filter. This gives the "speaking" rhythmic chords associated with the Moderat/Modeselektor world.
- **CPU.** Med (about 32 biquads).

---

## E. New world recipe cards

Eleven new worlds, then a delta table for the 02 atlas cards that are still unbuilt.

### E1. "Glue Euphoria" (Bicep breakbeat)
- **Tempo:** 126–132 ("Glue" is 130 BPM in E minor [13]).
- **Meter/feel:** 4/4 breakbeat; swing 54–58% on woodblock and conga only.
- **Harmony:** minor; 4-note pad loop over 8 bars [13] (i–VI–III–VII *recoloured*, 04 H9, as sus2 or 5ths).
- **Instruments:** D9 Bicep break kit, D8 808 sub with pitch drop [13], gated lead (A15 keyed from a hidden marching-snare lane) [13], soft pad with fast attack and release, D7 chops (+5 st), noise atmosphere that moves in level and pan [13].
- **Signature process:** a gated lead whose timbre shifts across the track [13], plus reversed perc at the end of every 2nd bar (A3).
- **FX chain:** A11 gated reverb on the snare; FDN hall send; A21 low-band duck; drum bus with transient boost and 2–3 dB glue [12].
- **Transitions:** signature B3 (every 4th bar [13]), B7, B14, B6; banned: B8, B16.
- **Form:** 16 atmos+chops → 32 break enters (no sub) → 16 break (B11 freeze) → B14 sub drop + full → 16 breakdown → 32 peak → 16 outro.

### E2. "Acid Cathedral"
- **Tempo:** 126–134.
- **Meter/feel:** straight 4/4, 16ths.
- **Harmony:** single root, Phrygian or Aeolian. The 303 line *is* the harmony; a pad drone of 1+5 arrives at a breakdown; one C1 step-up at the final peak.
- **Instruments:** D1 acid (the hero), 909-ish kick (02 E), D12 rumble, closed hats with A23 flange in builds, D6 organ chord at the break (888000000 into A12 slow → fast).
- **Signature process:** a 64-bar cutoff/resonance arc on the 303 plus the accent-sweep accumulator; Turing mutation at pFlip 0.02–0.05.
- **FX chain:** 303 → A8 folder (light) → tape delay ⅜ at 35% → dirt bus A24 rising with energy.
- **Transitions:** B22 (on the 303 cutoff), B1, B9, B17; banned: B7, B20.
- **Form:** 32 bars kick+303 closed → 32 opening → 16 break (organ + 303 alone, resonance at 90%) → 48 peak (+2 step-up optional) → 16 out.

### E3. "Drill Lattice" (IDM / Aphex, Vordhosbn-like)
- **Tempo:** 160–175 ("Vordhosbn": 170 BPM, about D♭ minor, microtonal passages [17]).
- **Meter/feel:** jungle-style breaks with tracker-precise 1/32–1/64 rolls; occasional 7/8 bars (C7).
- **Harmony:** *no chords*; all parts monophonic [17]. Bass motif plus a counter-melody; microtonal bends of ±20–60 c; contrary-motion pitch moves between bass and lead at section boundaries [17].
- **Instruments:** D9 break kit (dry rims, 808 claves/cowbell [17]), D8 boom (abrupt pitch-up event [17]), sine lead with portamento, long saw lead panned left, string-ish D13 panned right with a delayed copy on the left [17].
- **Signature process:** per-hit edits. Each bar, 1–3 hits are replaced by ratchets (2–8 repeats, rising pitch +1 st per repeat) or by A10 slices. The bitcrusher toggles per section [17].
- **FX chain:** A23 flanger on perc, a short digital delay with high feedback [17], reverb "blooms" (send spikes of +12 dB for one beat).
- **Transitions:** B9, B5 (white-noise snare fill over 4 bars [17]), B23, B19; banned: B6, B25, B16.
- **Form:** 8-bar sections with irregular turnarounds (insert a 6- or 7-bar section every 3–5 sections), 4–5 minutes.

### E4. "Void Swing" (Max Cooper "Void")
- **Tempo:** 123 [34:06].
- **Meter/feel:** 4/4, sparse (1.1 notes per beat [34:06]).
- **Harmony:** two-chord swing i ↔ iv7 in D♯ minor [34:06]. Allow the 7th *only* as an upper single tone over the iv (rule exception: spread, no 3rd in MID); chord run about 1.9 bars.
- **Instruments:** very short kick (decay to −20 dB in 32 ms [34:06]), sub sine, D4 wavetable pad (slow morph), A6 resonators on hiss (sings i/iv), low A22 plonks.
- **Signature process:** A27 cross-mod (kick envelope → pad wavetable position), "no sound twice" parameter drift (04 §5.7).
- **FX chain:** A21 low-band duck [19], A17 blur send, a long hall. Auto-EQ toward the 06 tilt.
- **Transitions:** B11, B12, B17, B15; banned: B5, B6, B20.
- **Form:** 06 shape: a quiet intro rising over 32 bars → long plateau → one 8-bar break → plateau → fade.

### E5. "Tree Map" (Max Cooper "Transcendental Tree Map")
- **Tempo:** 117.5 [34:06].
- **Meter/feel:** 4/4; 3.3 notes per beat; click kick (11 ms) [34:06].
- **Harmony:** D minor; chord run about 1.4 bars [34:06]; power-chord planing.
- **Instruments:** click kick, plucky saw (VA poly with filter env decay 80–180 ms, *not* modal bells), sub, D10 granular air.
- **Signature process [I]:** a **branching motif generator** (an L-system). The seed is a 3-note cell; each generation rewrites every note n → [n, n+step·dir] with probability p, and the tree depth tracks energy (depth 1 in the intro, 4 at the peak). Branches are assigned to 2–3 voices with different pans, so the melody visibly "branches" across the stereo field.
- **FX chain:** A13 pitch-shift delay (+7), A1 send, a short plate.
- **Transitions:** B22, B23, B9, B18.
- **Form:** depth ramp 1 → 4 over 96 bars, an 8-bar break (depth 0, pad only), then depth 4 → 2 to finish.

### E6. "Perpetual Motion" (Max Cooper)
- **Tempo:** 117.5, E major [34:06].
- **Meter/feel:** dense, 4.5 notes per beat; kick decay 107 ms [34:06]; chord run 1.3 bars.
- **Harmony:** major with power and sus (06), I5 → IVsus2 → vi5 → V5; withhold the colour note (C14).
- **Instruments:** "seemingly random synth sequencing with detailed sound design and rhythmic one-shots" [20]: 3 lanes of prime lengths (7, 11, 13) driven by random-waveform LFOs on cutoff and decay [20]; one-shot perc hits (tuned clicks, rims).
- **Signature process:** prime-multiple loop lengths "so you never have the same loop twice" [20] (extending the Penrose world), plus a constrained "web of wandering" (random LFOs within musically safe bounds [20]).
- **FX chain:** lopsided tape echo A26; A12 slow rotary on the pad; A21.
- **Transitions:** B12, B1, B22, B10.
- **Form:** an 8-bar intro, a 64-bar ramp, a 16-bar plateau, an 8-bar break, a 32-bar return, out.

### E7. "Chord Fog" (dub techno, Basic Channel lineage)
- **Tempo:** 116–124.
- **Meter/feel:** 4/4, soft kick, offbeat stabs.
- **Harmony:** a single minor 9 / sus2 stab for 64+ bars; move one inner note per 32 bars (C4 ostinato rule).
- **Instruments:** D11 stab [22], D12 rumble, soft 4/4 kick, shaker, A25 spring, vinyl crackle into A6 resonators (tuned to the stab).
- **Signature process:** a 0.25 Hz filter LFO on the delay send plus A16 throws [22]; send-feedback "weather" (feedback random-walks 0.6–0.9 every 8 bars).
- **FX chain:** stab → phaser → plate → dual delay (dotted ⅛ at 20% + 264 ms at 85%) [22] → tape sat; master HP 30 Hz, LP 12 kHz.
- **Transitions:** B10 (signature, most boundaries), B1, B15, B12; banned: B5, B6, B14, B25.
- **Form:** non-sectional drift of 6–10 min; density changes every 16–32 bars by ±1 element.

### E8. "Lopsided Bloom" (Moderat)
- **Tempo:** 100–124, often half-time.
- **Meter/feel:** heavy, broken; snare on 3 in half-time sections.
- **Harmony:** minor; slow 2-chord oscillation; P-moves (major flip) as emotional events (04 §2.6).
- **Instruments:** D2 Reese (moderate), a dirty lead through A8 and the A24 dirt bus ("clean synth isn't euphoric" [21]), D7 choir as a "voice" stand-in, D14 vocoder pad, a big but dark kick.
- **Signature process:** destructive resampling, emulated [I]: every 32 bars, capture 2 bars of the music bus and replay it as a pitched-down (−5 to −12 st) A1 layer, so the piece eats itself (Moderat bounce audio between members for destructive editing [21]).
- **FX chain:** A26 lopsided dual tape echo [21], saturation, A4 small frequency shift on the returns.
- **Transitions:** B13, B21, B11, B14.
- **Form:** 16 intro → 32 verse → 16 half-time lift → 32 peak → 16 dissolve.

### E9. "Haze House" (lo-fi house, Ross From Friends lineage)
- **Tempo:** 118–126.
- **Meter/feel:** drums move between four-on-the-floor, UK-funky and 2-step across sections, as RFF describes for one track [18].
- **Harmony:** minor or Dorian; *sus2/add9 only* (lo-fi house leans on 7th chords, which the owner dislikes, so they are banned here); 2-bar chord runs.
- **Instruments:** one Prophet-style saw voice used for chords, lead *and* bass (RFF used one Prophet saw "on every track" of *Tread* [18]); D9 kits (house, then 2-step); hiss and crackle; D7 chops kept raw with "just a raw echo" [18].
- **Signature process:** a **pattern-family walk**: the drum grid steps 4/4 → funky → 2-step at section boundaries (B23); tape-saturated master with occasional A9 stops.
- **FX chain:** music bus → tape sat (heavy) → bitcrush 12-bit at 20% mix → LP 9 kHz; glitch delay (A10 with Chance 0.2) [18].
- **Transitions:** B8 (signature), B23, B9, B3.
- **Form:** 16 / 32 / 16 break / 32 / 16, about 5 min.

### E10. "Four Organs" (Reich organ process)
- **Tempo:** 150–180 (8th-note pulse).
- **Meter/feel:** steady maracas or shaker 8ths, the only time-keeper.
- **Harmony:** a single chord sustained for the whole piece. In *Four Organs* one chord gradually lengthens [I]; a non-functional cluster from one mode (e.g. 1-4-5-♭7-9 spread).
- **Instruments:** 4 D6 organs (registrations differ per voice), shaker pulse, very low sub sine.
- **Signature process:** **augmentation process**. Each organ plays chord tones in short stabs; every 4–8 bars, note durations grow by +1 eighth, starting from the downbeat note, until the chord becomes a sustained mass. A second voice plays the C11 isorhythm.
- **FX chain:** A12 rotary per organ at different chorale speeds (de-synchronised), small room; no compression.
- **Transitions:** none in the club sense. Only B12 (pedal) and a slow A12 speed-up at "phase" boundaries.
- **Form:** 6–14 min continuous; the process itself is the form.

### E11. "Night-Bus 2-Step" (Burial, extending 02 card 7)
- **Tempo:** 130–138.
- **Meter/feel:** 2-step (D9 grid) with 60–65% swing [15], plus ±8–25 ms per-hit drift (no sequencer, placed by ear [14]).
- **Harmony:** i–♭VI shimmer; the pad never resolves.
- **Instruments:** wooden/found-sound percussion (Burial recorded twangs, clanks and impacts around the home [14]): synthesise these as A6 resonator-pinged noise bursts at random pitches; D7 chops, pitched up and off-grid; sine sub swells; crackle "always on" (Burial: "tape crackle, that's a beautiful sound" [14]).
- **Signature process:** the resonator bank sings the chord out of the crackle (A6); vocal syllables re-voiced per bar.
- **FX chain:** everything soaked in reverb [14] (6 s hall at 35%), master LP 10 kHz, A26 echo on the chops.
- **Transitions:** B15 (drums out for 2–6 bars), B7, B11; banned: B5, B6, B20, B14, B25.
- **Form:** non-sectional; elements enter and exit after random 3–11 bars (02 card 7).

### E.12 Delta table: what to add to the unbuilt 02 atlas cards
| 02 card | Add from this report |
|---|---|
| 3 Frahm Polymeter | D6 organ with A12 for the climax; C11 isorhythm on lanes; A25 spring instead of the plate; B12 and B22 as the only transitions |
| 4 Rival Consoles Bloom | A8 folder on the Prophet voice; A24 dirt bus rising in "strong" sections; C13 call/response lead ↔ bowed; B21, B11 |
| 5 Melodic Techno Arp Ride | D5 supersaw for peaks only; A2 shimmer in breakdowns; A19 and B25 Shepard riser; A13 +7 delay; C1 step-up +2 (at most once) |
| 6 BoC Tape Memory | D13 PWM pad; A9 tape stop as the ending; A26 echo; HP 120 / LP 6 kHz on textures [33]; C10 canon at ¾ bar |
| 8 Reich Phasing | C9 discrete displacement as the "lock" step; D6 organ swells; E10 as a sister world |
| 9 Eno Airport | A2 shimmer at g_s 0.3; A1 freeze for 30–90 s "stills"; D7 choir as the loop voice |
| 10 Berlin-School | D1 acid filter model for the sequencer (low resonance); A12 on the Mellotron pad; C4 transposition by pedal bridge |
| 14 Modular Bloom | A22 LPG bongo; A5 ring mod on hats [11]; C5 5:4 and 7:8 lanes; A27 cross-mod |

---

## Implementation priority (biggest audible win per hour of work) [I]
1. **A6 resonator bank + A1 granular** (both feed every existing world's texture layer, so 8 worlds become audibly new).
2. **B.2 rotation/cooldown scheduler** with the 25 moves (most need only A9, A10, A19, A20 and existing FX).
3. **D1 acid, D2 Reese, D6 organ, D7 choir, D11 dub stab** (five new hero timbres that are not bell plucks).
4. **E1, E2, E4, E7, E11** (worlds that reuse the above).
5. Then A2, A4, A8, A12, A26, the C5–C11 rhythm devices, and the remaining worlds.

---

## Sources
1. Valhalla DSP, "Eno/Lanois Shimmer Sound: How it is made" (2010). https://valhalladsp.com/2010/05/11/enolanois-shimmer-sound-how-it-is-made/
2. atosynth blog, "The super saw code" (Feb 2026), JP-8000 supersaw coefficients and mix/detune curves; cites Szabo's thesis. https://atosynth.blogspot.com/2026/02/the-super-saw-code.html
3. J. Chowdhury, "Complex Nonlinearities: Wavefolder" (CCRMA). https://ccrma.stanford.edu/~jatin/ComplexNonlinearities/Wavefolder.html
4. F. Esqueda, H. Pöntynen, V. Välimäki, J. Parker, "Virtual Analog Buchla 259 Wavefolder", DAFx-17. https://dafx.de/paper-archive/details/zmNQ8s5sZVhM_ObMB_D8tg
5. M. Puckette, *Theory and Technique of Electronic Music*, §8 single-sideband modulation via Hilbert all-pass pair. https://msp.ucsd.edu/techniques/latest/book-html/node159.html
6. J. O. Smith, S. Serafin, J. Abel, D. Berners, "Doppler Simulation and the Leslie", DAFx-02. https://ccrma.stanford.edu/~jos/doppler/dafx02.pdf
7. Wikipedia, "Leslie speaker" (rotor speeds, 800 Hz crossover). https://en.wikipedia.org/wiki/Leslie_speaker
8. Sound On Sound, "Ableton Beat Repeat" technique article. https://www.soundonsound.com/techniques/ableton-beat-repeat-plugin
9. Wikipedia, "Gated reverb" (Padgham/Collins, hold ≈ 0.5 s). https://en.wikipedia.org/wiki/Gated_reverb
10. Sound On Sound (L. Sasso), "Resonant Frequencies" (Ableton Resonators). https://www.soundonsound.com/techniques/resonant-frequencies
11. MusicTech, "7 music production techniques you can learn from Four Tet's 'Three'". https://musictech.com/tutorials/7-music-production-techniques-four-tet-three/
12. Attack Magazine, "Bicep-style breakbeats" (Beat Dissected). https://www.attackmagazine.com/technique/beat-dissected/bicep-style-breakbeats/
13. Loopcloud, "Unpacked: Bicep 'Glue' recreated". https://www.loopcloud.com/cloud/blog/5191-Unpacked-Bicep-Glue-Recreated-with-Loopcloud
14. MusicRadar, "'Once I change something I can never un-change it': … Burial's greatest album". https://www.musicradar.com/artists/once-i-change-something-i-can-never-un-change-it-how-the-rigid-limitations-of-basic-audio-editing-software-were-key-to-the-magic-of-burials-greatest-album
15. Attack Magazine, "Rolling 2-step garage" (Beat Dissected). https://www.attackmagazine.com/technique/beat-dissected/rolling-2-step-garage/
16. Attack Magazine, "Reese bass redux". https://www.attackmagazine.com/technique/tutorials/reese-bass-redux/
17. Attack Magazine, "Aphex Twin – Vordhosbn" (Deconstructed). https://www.attackmagazine.com/technique/deconstructed/aphex-twin-vordhosbn/
18. Output, "Talkback: Ross From Friends". https://output.com/blog/talkback-with-ross-from-friends
19. Ableton, "Max Cooper: Speaking the Unspoken". https://ableton.com/en/blog/max-cooper-speaking-the-unspoken
20. Ableton, "Composing Infinity: Max Cooper on his New Album" (*Yearning for the Infinite*). https://www.ableton.com/zh-cn/blog/composing-infinity-max-cooper-his-new-album/
21. MusicRadar, Moderat interview ("the clean synth sound isn't the most euphoric…"). https://musicradar.com/news/moderat-interview
22. Attack Magazine, "Dub techno synth chords" (Synth Secrets, Diva). https://www.attackmagazine.com/technique/synth-secrets/dub-techno-synth-chords/
23. Wikipedia, "Shepard tone". https://en.wikipedia.org/wiki/Shepard_tone
24. SMC 2014 paper on Tenney's *For Ann (rising)* glissandi (sweep 33.6 s / 8 octaves, entries every 2.8 s). https://zenodo.org/records/850475/files/smc_2014_018.pdf
25. MusicRadar, "Master modulation, or how to use key changes … (without resorting to cliché)". https://www.musicradar.com/news/how-to-use-key-changes-songwriting-music-theory
26. Apple Logic Pro manual, "Additive synthesis with drawbars". https://help.apple.com/logicpro/mac/10.4/en.lproj/lgsia12e1ef.html
27. Wikipedia, "Granular synthesis" (grain 1–100 ms; Roads 1974, Truax 1986). https://en.wikipedia.org/wiki/Granular_synthesis
28. nt_303 (Open303-based TB-303 model): slide default 60 ms (1–200), accent at vel ≥ 100, filter decay 30–3000 ms. https://github.com/thorinside/nt_303
29. Sound On Sound, Behringer TD-3-MO review (Devil Fish accent sweep "accumulates across fast accented notes"). https://www.soundonsound.com/reviews/behringer-td-3-mo
30. MusicRadar, "Kiasmos talk tape loops and concert hall raves". https://musicradar.com/news/kiasmos-talk-tape-loops-and-concert-hall-raves
31. Ableton, "Bonobo: The Path to Migration". https://www.ableton.com/en/blog/bonobo-path-to-migration/
32. Under the Radar, "Jon Hopkins on Singularity" (patient ramps, bursts and quells). https://www.undertheradarmag.com/interviews/jon_hopkins_on_singularity
33. Soundfly Flypaper, "Emulating Boards of Canada's classic synth sound" (HP 120 Hz / LP ~6 kHz). https://flypaper.soundfly.com/produce/emulating-boards-of-canadas-classic-synth-sound-without-breaking-your-bank-or-brain/
34. Local project research: `research/02-peers-and-styles.md` (cited [34:02]), `research/04-composition-generative-ai.md`, `research/06-case-studies.md` (cited [34:06]).

**Not verified (could not be fetched in this session):** the Devil Fish manual (firstpr.com.au) and Wikipedia's TB-303 page, so the 303 accent numbers marked [I] in D1 are conventional values. Niemitalo's Hilbert coefficients in A4 come from memory; check them against his published table before shipping.
