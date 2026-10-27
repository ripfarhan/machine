# Maut ki Awaaz — design

A live, generative "AI" synthesizer that runs from a local `index.html`. It composes and plays endless, evolving
electronic music in the Max Cooper world in real time, and everything on screen reacts to it. Distilled from
`research/00–05`; numbers there, decisions here.

## 1. What went wrong before (and the rule that replaces it)

| Old complaint | Root cause (research) | Rule now |
|---|---|---|
| "Sounds ass / ear cancer" | Aliased or over-driven sources, bass distorted without a low-pass after, resonance in 1–4 kHz, no per-element EQ, soft-clip master | Band-limited oscillators, *filter after every distortion*, sine sub + separately filtered harmonic layer, HP/LP per element, look-ahead limiter (03 §0, §4, §7) |
| Constant bell / guitar | Karplus–Strong with loop gain ≈ 1 played as the lead arp | Subtractive Prophet/Juno-style voices; KS only as damped wood texture; modal felt piano (03 §5.3, 01 §2.4) |
| Cheesy / R&B | Close 7th chords mid-register, chords every bar, i–VI–III–VII played straight, FM piano | One held loop of 2–4 chords, 2–8 bars each, pedal bass, third-less / sus / add9 / #11 spread voicings, "bend don't resolve" (01 §1–3, 04 §2) |
| Every generation the same | One global instrument rack + note-level randomness only | Per-piece **world** = its own sound family, drum kit, groove, process, form, tempo band; genome distance check vs. recent pieces (02 §A, 04 §6) |
| Controls do nothing | Probability knobs that average out | 6 macros, each moves 4–8 parameters across timbre *and* structure, instantly audible + bar-quantised (04 §8) |
| Repetitive / aimless | Stationary generators, no form | Form planner on top: sections, energy curve, one layer in/out per 8 bars, motif identity, slow processes (04 §1, 01 §4) |

## 2. Cooper principles the whole engine obeys
1. The chord loop is the song. 2–4 chords, held for minutes, bent (top-voice suspensions linger across changes), occasionally one substitution.
2. **No sound twice**: every note/hit gets small random offsets (cutoff ±15 %, decay ±12 %, pitch ±5 c, pan ±.2, drive ±20 %); random-walk "liquid timbre" LFOs on patch parameters.
3. Warm analog polysynth (saw + pulse, 24 dB ladder, res .3–.6) → Juno chorus → light tanh → plate → tape echo. No supersaw stacks.
4. Drums quiet and clicky: soft round kick 3–6 dB under a club kick, procedural micro-clicks on prime-length loops; no stock clap-on-2-and-4 except in explicit techno/DnB worlds.
5. Bass clean and simple: sine sub on the root (+ optional low-passed saw stab an octave up); sidechain only the low band.
6. Space from Haas offsets, a plate and a dark hall, tape echo; mono below ~130 Hz.
7. Builds are swells (one layer per 8–16 bars, peak at 60–75 %, drums out 4–8 bars before the peak), not EDM drops, in the Cooper worlds.
8. Mix: chords 0 dB, melody/arp −2…−4, bass −3…−6, kick −6, micro-perc −12…−18, texture −18…−24. Master ≈ −12 LUFS, −1 dBTP.
9. Imperfection: strum 5–40 ms, humanise (correlated, never on kick/bass), tape wow, light lo-fi.

## 3. Architecture

```
index.html (file://) ── UI (Canvas2D + one WebGL2) ── taste model (main thread, localStorage)
      │  postMessage: intents (world, genome, macros, nudges)        ▲ notes (scheduled ahead), clock, sections, brain, meters
      ▼                                                               │
AudioWorklet (data: URL built from engine functions' source)
   Engine ── Composer (genome → form plan → sections → bars → events, 1 bar ahead)
          ── Tracks (instrument pools) ── Mixer (inserts, buses, sends, kick-keyed low-band ducking)
          ── FX (Dattorro plate, FDN hall, tape delay, Juno chorus, phaser, granular cloud) ── Master (LR4 mono-low, glue, tilt, tape, look-ahead limiter, LUFS auto-gain)
Same engine runs in a Worker (export WAV) and in Node (tools/: render, metrics, case studies).
```

Engine files: `00-util`, `10-dsp`, `20-drums`, `21-synth`, `22-fx`, `30-mixer`, `40-theory`, `50-parts`, `55-composer`, `60-worlds`, `80-engine`.

## 4. Worlds (per-generation modes)

Each world = tempo band, meter/feel, harmony family, drum kit + groove, bass behaviour, voice palette, FX chain, the
*process* that gives it its identity, form template. Generations never repeat the previous world; within a world
everything is drawn from ranges.

**Phase 1 (build first)**

| World | Tempo | Process / identity | Palette |
|---|---|---|---|
| EMERGENCE (Order from Chaos) | 110–124 (broken) | Poisson "rain" clicks pulled onto a grid as α ramps 0→1; the rhythm crystallises | melancholic minor loop, warm P6 pad, sub, glassy broken beat |
| PRIME TILING (Penrose) | 116–122 | several pluck/click lanes with prime loop lengths (3,5,7,11,13) — never repeats | damped kalimba/sansula KS, tight clicks, soft kick later |
| REPETITION (Repetition / Resynthesis) | 118–124 | one stab pattern (40–55 % density) under a slowly swept cutoff; repeats-within-repeats | P6 stabs, spread pedal voicings, Minitaur-ish bass stab, 4/4 soft |
| DRIFT (My Mind Is Slipping) | 60–90 | each chord tone repeats at its own slightly different tempo | lo-fi softened Juno chords, beatless, tape |
| WARM RETRO (Waves) | 108–118 | arp lanes + Rhodes-like modal EP, gentle roll | major/Lydian, chorus, plate |
| CRESCENDO (Hopkins) | 104–124 | one frozen riff whose timbre opens over 64 bars, gated pad, cut to felt piano | distorted round kick, MS-20-ish riff |
| FELT (Kiasmos) | 118–124 | felt piano motif + minimal techno, piano doubles as percussion | soft 909, shakers, Juno pad, one plate |
| INTENSE (Exotic Contents / This Is A Bridge) | 136 four or 170 half-time | distorted mid-bass over clean sub, chords "open up" at the peak | sharper drums, phaser, collapse-to-mono at phrase ends |

**Phase 2**: VOID (metallic modal impacts, drones), TREE MAP (fractal melody, blips), PROCESS TONES (rising/falling
tones), UPLIFT RIFF (Perpetual Motion), POLYMETER (Frahm), BERLIN SEQUENCER, AIRPORT (Eno loops), NIGHT BUS
(Burial), TAPE MEMORY (BoC).

## 5. Composition stack
- **Genome** (per piece): world, tempo, key, mode, harmony family, harmonic rhythm, voicing spread, density, swing,
  brightness, space, grit, motif seed, process parameters, form template, seed. Diversity: min distance to the last 5.
- **Form planner**: sections with energy E(t) and tension T(t); layers enter/leave at phrase boundaries (≤ 1 major
  change per 8 bars); contrast rule at section edges; endless mode chains pieces with a 16–32 bar crossfade
  (timbre first, then drums, then harmony; key change only via common tones).
- **Harmony**: loop families (2-chord oscillation, pedal planing, descending tetrachord, cinematic VI–v–i, NR walk,
  Resynthesis-style pedal loop, Reich cycle); register-slot voicer (SUB/BASS/LOW-MID/MID/HIGH/AIR) with voice-leading
  cost and ≤ 1 colour tone in HIGH; bends; one substitution after 2–4 cycles; peak "opening" (wider + extension).
- **Parts** (reusable): pad, stabs, arp lanes, prime pluck lanes, phase chord, motif lead (develop A A′ B A, fractal
  elaboration), felt keys, bass (sub / stab / rolling / half-time wobble), kick, backbeat, hats, micro-perc, rain
  emergence, texture/drone, process tones, metallic impacts.

## 6. Controls (big, plain words)
- **ENERGY** — music-bus LP, drum level, hat/perc density, layers (5 zones), saturation.
- **MOOD** — dark ↔ bright: mode ladder (Phrygian→Aeolian→Dorian→Mixolydian→Ionian→Lydian) at the next chord, filter tilt.
- **SPACE** — reverb sends/decay, delay feedback, Haas width; at max notes lengthen, drums thin.
- **DENSITY** — step probabilities, arp rate, extra lanes, polymeter layers.
- **CHAOS** — loop mutation (locked → slipping → free), timing jitter, glitch stutters, emergence α reversed.
- **MOTION** — harmonic rhythm, LFO depth/rate, phase-drift amount, how fast the piece evolves.
- **MORPH XY** — X: warm ↔ glass (filter, saturation vs. chorus/air); Y: clean ↔ broken (tape wow, crackle, crush).
- Nudges: **BUILD · PEAK · BREAK · HOLD** (queued to the next phrase with a countdown). **NEXT** (crossfade to a new
  piece). Per voice: mute / solo / reroll.
- Taste: **♥ / ✕ / MORE LIKE THIS / SURPRISE ME**, plus a "what I've learned" panel.

## 7. The "AI"
Three layers (04 §7): Thompson sampling over world + archetype genes (Beta posteriors), Bayesian linear model over
continuous genes, novelty/habituation term so it never converges. Signals: like, skip (early = strong negative),
listened to end, more-like-this, macro positions held. Brain panel shows what it decided and why, at audible time.

## 8. UI
One screen at 1440×900, no page scroll (05 §2): top bar; brain + harmony wheel; hero (shader + triggered scope +
spectrum + onset streaks); macros + XY; voice lanes showing *future* notes; voice strips; arc timeline with energy
curve. Motion follows the musical hierarchy (hat → kick → bar → section; only section changes glitch the whole
screen). FULL / CALM / STILL modes, flash governor, reel mode (9:16 crop guide + direct recording).

## 9. Verification
- DSP unit tests (aliasing, stability), per-instrument solo renders.
- Node renders per world: 1/3-octave balance vs the reference curve, LUFS/true-peak, harsh (2–5 kHz) and mud
  (150–400 Hz) flags, roughness of simultaneous notes, diversity between worlds and seeds.
- Macro blind test: 8 bars at 0 vs 1 must differ clearly in descriptors.
- CPU: engine ≤ 45 % of the render quantum.
- Listening rounds with the owner after every phase.
