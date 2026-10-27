# 05 — Reactive "Living" UI for the Generative Synth

Scope: interface research for a standalone, `file://`-run browser instrument that plays endless evolving electronic music (Max Cooper / Jon Hopkins territory). Audio comes from an AudioWorklet plus an AnalyserNode. Canvas2D and WebGL2 are available. There is no build step and no server. The owner is a glitch/AV artist (After Effects, TouchDesigner) who wants everything on screen to pulse with the music. He does not read music theory, so every control has to be big, named in plain words, and clearly audible.

---

## 0. Key takeaways

1. **Drive the big pulses from engine events, not audio analysis.** Max Cooper's own live rig sends MIDI from Ableton to Resolume rather than analysing audio. We have something better: the generator knows every note before it sounds. Kick flashes, bar sweeps and section transitions should come from timestamped engine events. Keep the AnalyserNode for continuous texture (scope, spectrum, spectrogram, shader input).
2. **Show the future.** The engine schedules notes ahead of time, so the note lanes can draw upcoming notes faintly to the right of the playhead. The "brain" panel can say what is about to change and when. No plugin can do this, and it is the most "AI" thing the UI can show.
3. **Make motion follow the musical hierarchy.** Hats twitch small things, kicks thump local things, bars sweep panels, and section changes are the only events allowed to glitch the whole screen.
4. **Every control moves the sound immediately**, even when the musical consequence is quantised to the next bar. Pair an instant timbral proxy with a visible "queued, lands in 3 bars" ghost state.
5. **Separate VISUAL INTENSITY control and a flash governor.** The UI enforces WCAG's three-flashes-per-second rule automatically, with FULL / CALM / STILL modes and `prefers-reduced-motion` mapped to CALM.
6. **File-protocol gotchas.** Chrome gives `file://` pages an opaque `null` origin. Workers and AudioWorklet modules must be loaded from Blob URLs, ES-module `<script src>` imports fail, `SharedArrayBuffer` is unavailable (no cross-origin isolation), and fonts are safest as base64 `@font-face`.

---

## 1. Reactive components (18)

Notation: **Shows** (what the user learns), **Data** (what drives it), **Render** (technique), **Smoothing** (constants), **Cost** (rough main-thread time at 1440×900, DPR 2, mid-range laptop).

Smoothing convention used throughout: frame-rate-independent one-pole, `a = 1 - Math.exp(-dt / tau)`, `y += (x - y) * a`. Ballistics are asymmetric, with separate `tauAttack` and `tauRelease`. This keeps 60 Hz, 120 Hz and dropped-frame cases identical. Do not rely on per-frame lerp constants like 0.1, which change behaviour on 120 Hz screens.

### 1.1 Hero stereo oscilloscope (triggered, phosphor)
- **Shows:** the real waveform. It is the most "alive" element and the anchor of the screen.
- **Data:** `ChannelSplitterNode` → two AnalyserNodes (L/R), `fftSize = 4096`, `getFloatTimeDomainData` into preallocated `Float32Array`s.
- **Render:** Canvas2D.
  - *Edge trigger (default):* use the first rising zero crossing with hysteresis (`x[i-1] < -0.01 && x[i] >= 0`) in the first half of the buffer. Interpolate the fractional crossing (`-x[i-1]/(x[i]-x[i-1])`) and draw 1024–2048 samples from it. Sub-sample placement removes the jitter zita-scope warns about.
  - *Phase-locked (pads):* the engine knows the root frequency, so use Matt Montag's method, `offset = (sampleRate * audioTime) % (sampleRate / f0)`. Fall back to the edge trigger when no single root is sounding.
  - *Phosphor:* fill `rgba(bg,0.22)` instead of clearing, then stroke twice (6 px at 0.15 alpha, then 1.5 px at full) with `'lighter'` compositing. Never use `shadowBlur` (very slow). Line width += 2 px × kick envelope. CHAOS > 0.6 adds per-segment displacement noise.
- **Smoothing:** none on samples; kick envelope 0 / 120 ms. **Cost:** ~0.4 ms.

### 1.2 Log spectrum with peak hold
- **Shows:** where energy sits (sub vs. air) and how full the mix is.
- **Data:** `fftSize = 8192` (5.9 Hz bins at 48 kHz), `getFloatFrequencyData`, `smoothingTimeConstant = 0.5` (below the 0.8 default, because we add our own ballistics), dB range −100…−20.
- **Render:** Canvas2D. Use 128 log bands, 30 Hz–16 kHz (`f(i)=30·(16000/30)^(i/127)`). Take the **max** of bins per band (the mean flattens transients) and interpolate where bands are narrower than a bin. Add a **+3 dB/oct tilt** around 1 kHz so music reads as flat, as pro analysers do. Draw one filled path with a cyan→pink→transparent gradient and a 1 px outline. Peak hold: 800 ms, then a 24 dB/s fall, drawn as 2 px dashes.
- **Smoothing:** attack 10 ms, release 180 ms. **Cost:** ~0.4 ms.

### 1.3 Spectrogram waterfall (WebGL2)
- **Shows:** recent history as texture: builds, drops, sweeps. This is the most "Max Cooper science-viz" element.
- **Render:** one `R8` texture, 512 log columns × 512–1024 rows (8–17 s at 60 fps). Each frame `texSubImage2D` writes **one row** at `head`. The shader samples `fract(uv.y + head/H)`, so nothing is ever scrolled or copied. Colour comes from a 256×1 LUT (`#07070a → #3a0a2a → #ff2e88 → #22e5ff → #fff`) with a `pow(v,1.6)` contrast curve. The 2.5D variant displaces a mesh, rendered as solid shading or horizontal ridge lines, **never a visible lattice**.
- **Cost:** ~0.1 ms CPU.

### 1.4 Lissajous goniometer + correlation
- **Shows:** stereo width.
- **Render:** Canvas2D. `x=(R−L)·0.707`, `y=(L+R)·0.707`, so mono becomes a vertical line, per the SOS definition. Plot 2048 points as 1.5 px rects, `'lighter'`, 0.25 alpha, 0.3 fade. Correlation bar: `ρ = ΣLR/√(ΣL²ΣR²)`, tau 300 ms.
- **Cost:** ~0.3 ms.

### 1.5 LED meters (master + per voice)
- **Data:** best computed **in the worklet** per 128-frame quantum (peak and sum of squares, per voice and master), posted roughly every 512 frames with timestamps. This is exact, and it gives per-voice levels the analyser can't.
- **Render:** Canvas2D, 24 segments; unlit segments at 12% alpha so it reads as hardware. Cyan up to −12 dB, white to −3, then pink. The clip LED latches for 1.5 s.
- **Ballistics:** instant peak attack, 20 dB / 1.7 s fall; RMS over 300 ms. **Cost:** <0.1 ms.

### 1.6 Heart (beat / bar rings)
- **Data:** engine clock events `{bar, beat, step, time, bpm}`, latency-compensated (§4.3). Never beat-track the audio; the engine already knows.
- **Render:** 16 dots on a ring, current step lit. Each beat an expanding ring, r→r+40 px with `easeOutExpo` over one beat. The downbeat gets a double ring in pink. BPM digits tick (scaleY 1.15→1, 90 ms). **Cost:** negligible.

### 1.7 Voice lanes: "what the machine is playing"
- **Data:** worklet note events `{time, voice, pitch, vel, dur}` posted **at schedule time**, i.e. before they are heard.
- **Render:** Canvas2D. One 20–28 px lane per voice (KICK, BASS, PADS, LEAD, ARP, TEXTURE), with the playhead at 70% width. **Future notes show on the right at 25% alpha and "ignite" (full colour plus a 150 ms white overshoot) as they cross the playhead.** Velocity sets brightness. Notes live in per-voice ring buffers; draw only the visible ones, batched by colour (one path, many rects). Give each voice its own glyph, Patatap-style: kick = full-height block, hats = ticks, pads = long soft bars, lead = capsules.
- **Cost:** ~0.5 ms.

### 1.8 Harmony wheel (mood without theory)
- **Data:** engine harmony state `{key, mode, chordPCs, tension}` plus note-ons.
- **Render:** Canvas2D, 12 wedges in **circle-of-fifths** order so key changes move short distances. Scale notes are outlined, chord tones filled, sounding notes flash (decay 250 ms). Key changes rotate the tonic to 12 o'clock over one bar. Label in words, not theory: modes sorted by brightness (Lydian…Phrygian) map to cyan→pink→deep magenta, with words like `BRIGHT / HOPEFUL / DARK / TENSE`. The mode name appears small underneath. **Cost:** ~0.1 ms.

### 1.9 Arc timeline + energy curve
- **Data:** section events `{name, start, plannedBars, targetEnergy}`, with measured master RMS (tau 2 s) overlaid on the engine's target curve.
- **Render:** Canvas2D strip. Past sections are solid. The planned next section is hatched with diagonal hairlines and shows `BREAK IN 8 BARS`. Static parts are cached offscreen and redrawn only on section change; each frame adds only the playhead and trace. **Cost:** ~0.1 ms.

### 1.10 Brain panel: the AI's decisions
- **Data:** decision messages such as `{time, target:'bass', text:'bass → octave pattern', reason:'energy .72→.80'}`, the next-section probability vector, and intention values (tension, novelty, density).
- **Render:** **DOM**, which gives crisper text more cheaply. The log keeps 14 recycled nodes. Each line enters with a ~250 ms **scramble-decode** (`▚▞█▓░/\|` → text), the UI's glitch-type signature. Probability bars update with a 400 ms tau. Lines are revealed at *audible* time so the text matches the ear. **Cost:** <0.2 ms, event-driven.

### 1.11 Macro knobs with modulation glow
- **Data:** the set value (param store) plus the engine's modulated-value echo at 30–60 Hz.
- **Render:** a Vital / Pigments / Bitwig / Massive X hybrid on one Canvas2D for the whole bank, with invisible `<input type=range>` elements over it for hit-testing, focus and ARIA. Layers: a dim 270° track, a white value arc, a **modulation arc** from set to modulated value in the source colour, and a bright live-position dot (Massive X's "saturn ring"). Glow = |mod − set| + activity of the macro's main voice, drawn as a pre-rendered radial sprite with `'lighter'` at 0.1–0.6 alpha. The centre shows a giant numeral while dragging and a mini-visual otherwise (for example an RMS sparkline inside ENERGY). **Cost:** ~0.3 ms.

### 1.12 Morph XY pad
- **Shows:** a timbre space with four named corners (`GLASS / RUST / VOID / NEON`). Ableton Learning Synths' XY pad drives about 30 params at once, which suits a beginner.
- **Render:** a scissored region of the main WebGL canvas. Corner hues are mixed bilinearly and the field ripples on kicks. The puck leaves a 1 s trail. Optional throw inertia uses a 400 ms decay. **Cost:** ~0.2 ms.

### 1.13 Onset streak field
- **Data:** engine note-ons first. Then spectral flux for anything the engine doesn't flag: `Σ max(0,|X_t|−|X_{t−1}|)` in 3 bands, with an onset when flux > `mean(0.5 s)·1.5 + floor` and a 60 ms refractory period (the Web-Onset/aubio locally averaged threshold).
- **Render:** WebGL2 instanced quads, up to 4k, CPU-updated through `bufferSubData`. Draw **velocity-aligned streaks, not round or star sprites**. Kicks push them outward; curl noise scaled by CHAOS swirls them. **Cost:** ~0.5 ms.

### 1.14 Shader background (the "TouchDesigner layer")
- **Data:** a Shadertoy-style **512×2 audio texture** (row 0 FFT, row 1 waveform); uniforms `uKick, uSnare, uBeatPhase, uBarPhase, uEnergy, uChaos, uSection, uPalette[4]`; a feedback texture.
- **Render:** a full-screen triangle at **0.5× resolution**. Candidate looks:
  - Domain-warped fBm "biology" in the spirit of Lomas' cellular forms.
  - Feedback zoom/rotate (the Feedback TOP equivalent): `mix(texture(prev, rotScale(uv)), new, 0.08)`.
  - **Digi-Cut time displacement**, after McGloughlin: the last 16 frames sit in a `TEXTURE_2D_ARRAY` at 0.25× resolution, each horizontal band samples a different past frame, and the bands jump on snares.
  - Event-only glitch passes: RGB split of 2–8 px, slice tearing, and a 300 ms datamosh smear (advect the feedback buffer by its luminance gradient) on section change.
  - **No pixelation, mosaic or lattice.**
- **Cost:** GPU ~1–2 ms on integrated graphics, with dynamic resolution (§4.5).

### 1.15 Tape overview strip (OP-1 homage)
- Shows the last ~60 s as a min/max waveform coloured by spectral centroid. Each frame writes one 1 px column into an offscreen ring canvas, and two `drawImage` blits "scroll" it. **Cost:** <0.1 ms.

### 1.16 Voice strips
- Big **MUTE / SOLO / REROLL** buttons per voice (reroll = a new pattern for that voice only), a mini meter, and a strip border that brightens on the voice's note-on (tau 150 ms). This is the cheapest way to make the *panels themselves* pulse. **Cost:** ~0.1 ms.

### 1.17 HUD
- BPM, `BAR:BEAT` (tabular figures), seed, engine CPU (render time ÷ the 2.67 ms quantum budget at 48 kHz), output latency, FPS, REC. Text updates at 10 Hz at most. The readout itself glitches when CPU or FPS degrade, an honest diegetic warning.

### 1.18 Flash governor (safety as a component)
- Every full-screen flash request goes through `requestFlash(strength, hue)`, which enforces §3.4. Rejected flashes degrade to a hue shift or vignette pulse with no luminance step.

---

## 2. Layout: one-screen live instrument (1440×900 primary)

### 2.1 Grid

The root is `height: 100vh; overflow: hidden; display: grid;`. No page scroll ever happens; any overflow lives inside drawers.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐ 48px
│ MAUT KI MACHINE ▸ ■ PLAY  ⟳ NEW SEED  ✱ MUTATE │ 124 BPM  017:3  ◉◉◉○ │ FULL/CALM/STILL │ ⚙ │
├───────────────┬──────────────────────────────────────────────────────┬───────────────────┤
│ BRAIN  (300)  │  HERO (≈780 × 420)                                   │ MACROS (340)      │
│ decision log  │  shader bg + scope + spectrum overlay + streaks      │  ENERGY  DENSITY  │
│ next-section  │  heart ring in corner                                │  MOOD    CHAOS    │
│ probabilities │                                                      │  SPACE   DRIFT    │
│               │                                                      │  (6 × 96px knobs) │
│ HARMONY WHEEL ├──────────────────────────────────────────────────────┤                   │
│ (260 × 260)   │  VOICE LANES (≈780 × 170) future notes ghosted ▸     │  MORPH XY (300²)  │
│               │                                                      │                   │
├───────────────┴──────────────────────────────────────────────────────┴───────────────────┤
│ VOICE STRIPS ×6 (mute/solo/reroll + meters)  │ BUILD  DROP  BREAK  HOLD │ GONIO │ MASTER LED│ 120px
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ARC TIMELINE: INTRO ▸ BUILD ▸ [PEAK] ▸ ░BREAK IN 8 BARS░        energy curve + tape strip │ 72px
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- `grid-template-columns: 300px 1fr 340px; grid-template-rows: 48px 1fr 170px 120px 72px;` (the hero takes the 1fr). With a 900 px height minus browser chrome (~780–800 px usable), the hero gets ~380–420 px, which is still dominant.
- **Scaling to other screens:** design at a 1440×820 logical canvas and scale with a CSS variable: `--s: min(100vw/1440px, 100vh/820px)` applied to font sizes and fixed tracks. Below 1100 px width, collapse the Brain column into a tab over the hero. A mobile layout is out of scope; show a "best on desktop" notice.
- **Background shader** is one full-viewport WebGL canvas `position: fixed; z-index: 0` behind translucent panels (`background: rgba(14,14,20,0.72); backdrop-filter: none`). Avoid backdrop-filter blur over an animating canvas, because it is expensive. The hero region lets the shader show at full strength; the panels dim it.

### 2.2 Control hierarchy (big → small)

| Tier | Controls | Size / placement | Behaviour |
|---|---|---|---|
| 0. Transport | PLAY/STOP, NEW SEED, MUTATE | Top bar, 40 px tall buttons; Space = play | NEW SEED crossfades over 1 bar, never hard-cuts |
| 1. Macros (6) | ENERGY, DENSITY, MOOD (dark↔bright), CHAOS (glitch/randomness), SPACE (reverb/width), DRIFT (how fast the AI changes things) | 96 px knobs, right column | Instant timbral proxy + quantised musical effect |
| 2. Gestures | MORPH XY; section nudges BUILD / DROP / BREAK / HOLD | 300 px pad; 64 px buttons | Nudges queue to the next bar/phrase with a countdown ring, like Output Arcade's quantised modifiers that "keep results musical" |
| 3. Voices | per-voice MUTE / SOLO / REROLL | bottom strips | Mute is instant (10 ms fade); reroll lands at the next bar |
| 4. Advanced drawer | per-voice synthesis params, scale lock, tempo range, AV sync offset, visual settings, MIDI-learn | 420 px slide-over from the right (` key or ⚙), overlays without reflow | Hidden by default; the core performance view never depends on it |

This follows Teenage Engineering's OP-1 discipline: four key parameters always visible and mapped one-to-one, shallow menus (everything at most two presses away), and one full-screen mode at a time. It also follows Arcade's "start simple, go deep later" defaults.

### 2.3 Making knob turns feel immediate

1. **Optimistic UI:** redraw the knob on `pointermove` in the same frame. Never wait for the engine's echo. The echo only drives the modulation ring.
2. **Send now, not on rAF:** post param changes to the worklet port immediately, coalescing to at most one message per 4 ms per param. In the worklet, smooth with a one-pole at 10–30 ms (or `AudioParam.setTargetAtTime(v, now, 0.015)` for native params) to avoid zipper noise.
3. **Instant audible proxy + quantised consequence.** Every macro maps to at least one *continuous* sound parameter that responds within 20 ms, alongside its structural effect:
   - ENERGY: filter cutoff, drive and hat level move instantly; pattern density and section changes follow at the next bar.
   - MOOD: filter tilt and pad brightness move instantly; the mode or key change lands on the next phrase, shown as a ghost wedge on the harmony wheel with a countdown.
   - CHAOS: glitch FX send and stutter probability are instant; mutation rate is structural.
4. **Feedback while dragging:** a giant condensed value (`72px`, scaleY 1.3) appears in the knob, the panels that depend on that macro brighten by 15%, and a short label explains the effect (for example `ENERGY 82 · drums busier next bar`).
5. **Input ergonomics:** vertical drag where 200 px covers the full range; Shift = ×0.1 fine; double-click = default (as in Massive X); wheel = ±1; arrow keys ±1 and PageUp/Down ±10. Use `setPointerCapture` plus `touch-action: none`. Pointer lock is optional (hiding the cursor feels pro but confuses some users, so keep it off by default).
6. **Feel:** stepped params (for example DRIFT presets) snap at detents and give a 60 ms flash on each detent crossing. That is visual "haptics".

---

## 3. Visual language

### 3.1 Tokens

```css
:root{
  --bg:#07070a; --panel:#0e0e14; --line:#1d1d27; --ink:#ececf4; --dim:#6b6b7a;
  --hot:#ff2e88;  /* primary accent: active, downbeat, peak, "AI decided" */
  --cyan:#22e5ff; /* secondary accent: signal, stereo R, scheduled/future */
  --hot-a:rgba(255,46,136,.18); --cyan-a:rgba(34,229,255,.16);
  --warn:#ffd23f; /* only for clip/CPU warnings; never decorative */
}
```

- **Role discipline:** pink means *now / decision / emphasis*, cyan means *signal / future / information*, and white means *values the user set*. Voice colours are interpolated across the pink→violet→cyan arc (6 stops) so the palette stays two-tone.
- **Hot pink is safe for flashes:** `#ff2e88` has R/(R+G+B) = 0.58, below WCAG's 0.8 "saturated red" threshold. Avoid pure `#ff0033`-style reds for any flashing element.

### 3.2 Typography
- Stack: `"Arial Narrow", "Roboto Condensed", "Barlow Condensed", "Helvetica Neue", Arial, sans-serif; font-stretch: condensed`. Arial Narrow is not installed everywhere (it ships with Office), and Google Fonts needs a network connection. For a guaranteed offline look, **embed one condensed face (for example Barlow Condensed, OFL) as a base64 `@font-face`** in the HTML. Loading fonts from `file://` URLs is unreliable across browsers.
- Use the "stretched condensed" display look for big numerals and section names: `transform: scaleY(1.35); transform-origin: bottom; letter-spacing: -0.02em; text-transform: uppercase`. For body or labels use 11–12 px uppercase with +0.08em tracking. Use tabular figures (`font-variant-numeric: tabular-nums`) for BPM and BAR:BEAT so the digits don't jitter.
- Text the user must read during interaction (values, the label under the cursor) is **never** glitched or scrambled. Only decorative and log text gets glitched.

### 3.3 Motion rules: what pulses on what

| Musical event | Source | Visual response | Envelope | Scope |
|---|---|---|---|---|
| Hat / tick | engine note | particle jitter, scope micro-noise | 0 / 60 ms | local, no luminance |
| Kick | engine note | hero scope thickens, bg luma +6–10%, streaks pushed outward, KICK lane ignites | 0 / 120 ms | hero + kick strip |
| Snare / clap | engine note | 1–3 slice tears + RGB split 3 px in cyan, Digi-Cut band jump | 0 / 80 ms | hero only |
| Bass note | engine note | harmony wedge flash, bass lane | 0 / 250 ms | wheel + lane |
| Beat | clock | heart ring advances, BPM digits tick | 90 ms | top bar + heart |
| Bar | clock | 1 px border sweep across all panels (left→right, 250 ms), arc playhead tick | 250 ms | all panels, thin |
| Phrase (8 bars) | clock | brain panel writes a line; wheel may rotate; palette drifts 10° | 400–1000 ms | panels |
| Section change | engine section | **the only global glitch**: datamosh smear 300–600 ms, type scramble on section label, palette swap, one governed flash | ≤ 800 ms | whole screen |
| Macro move | user | knob glow, dependent panels +15% brightness | while dragging | local |
| AI mutation | engine decision | affected lane/strip outline pulses pink twice | 2 × 150 ms | local |

Principles:
- **Magnitude follows hierarchy.** Small, frequent events produce small, local, low-luminance motion; rare structural events are allowed to be big. That is how Max Cooper's shows layer chapters, and it keeps "epileptic" energy for moments that earn it.
- **One global event at a time.** A queue prevents a section glitch and a drop flash from stacking.
- **Glitch is an event, not a state.** At rest the UI is clean and dark (the Endel lesson: thin lines and sparse light points on black read as calm and trustworthy). CHAOS scales the probability and size of glitches, not their constant presence.
- **Idle = performance mode** (Bloom's "the app takes over when you go idle"): after 20 s without input, panels fade to 35% opacity and the hero and background take over. Any pointer movement restores the UI within 200 ms. **REEL MODE** (owner-specific): hide all chrome and show a 9:16 crop guide so a screen recording becomes a reel. Optionally record directly with `canvas.captureStream(60)` plus a `MediaStreamAudioDestinationNode` into `MediaRecorder`.

### 3.4 Reduced motion and photosensitivity

- **Mode switch** in the top bar: `FULL / CALM / STILL`, persisted in `localStorage` (inside try/catch).
  - Default: `CALM` if `matchMedia('(prefers-reduced-motion: reduce)').matches`, else `FULL`. Listen for `change`.
  - **CALM:** no full-screen flashes; glitch amplitudes ×0.3; no slice tearing; shader motion at ×0.4 speed; feedback zoom off.
  - **STILL:** the shader becomes a slowly evolving gradient (≤0.1 Hz palette changes); no particles, flashes, scrambles or shake. Meters, scope and lanes stay live but with heavier smoothing (release tau ×2), because they are information, not decoration.
- **Separate VISUAL INTENSITY slider** (0–100) in the drawer, multiplying every reaction amplitude.
- **Flash governor** (implements WCAG 2.3.1):
  - Keep timestamps of granted "general flashes". A general flash is a luminance swing ≥10% where the darker state is <0.80 relative luminance. **Grant at most 3 in any 1000 ms window** (use 2 for margin). Excess requests become non-luminance hue rotations.
  - Area rule: any flashing region larger than 25% of a 10° visual field (≈341×256 CSS px at 1024×768) counts. In practice, every full-screen flash counts, so even FULL mode caps full-screen luminance swings; kick luma bumps stay under 10% so they don't count as flashes at all.
  - No saturated-red flashes.
- **Startup gate:** the AudioContext needs a user gesture anyway, so the first screen is a click-to-start card with a one-line photosensitivity note and the mode choice. This costs nothing extra.

---

## 4. Implementation notes

### 4.1 Render-loop architecture

```
AudioWorklet (audio thread)              Main thread
 ├ generator + synth                      ├ port.onmessage → EventQueues (time-sorted, per kind)
 ├ schedules notes ~100–200 ms ahead ───► │      ParamStore ◄── pointer/keyboard (optimistic)
 ├ posts batched events every ~10 ms      ├ rAF loop:
 ├ posts meters/mod values ~60 Hz         │   1 t = audioNow()  (latency-compensated, §4.3)
 └ (AnalyserNode taps the output)         │   2 drain queues where ev.time <= t → fire envelopes
                                          │   3 read analysers once → shared Float32Arrays
                                          │   4 derive features once (bands, flux, rms, ρ)
                                          │   5 update envelopes (dt-based)
                                          │   6 GL pass: bg shader, spectrogram, particles, XY
                                          │   7 2D panels: draw if visible && (dirty || animating)
                                          │   8 DOM: brain/HUD text only when changed
```

- **One rAF, one clock, one features object.** Components never call the analyser themselves; they read `F.spectrumDb`, `F.bands[3]`, `F.kickEnv`, and so on. This ensures one FFT read per frame and makes components pure functions of `(F, t, dt)`, which also makes them movable to a worker later.
- **Zero allocation per frame:** preallocate every typed array and path buffer, and avoid closures, `map` and `filter` in the loop. GC pauses are the main source of visible jank.
- **dt-based everything** (60/120/144 Hz). Clamp `dt` to 50 ms after tab switches.
- **Throttle secondary panels:** goniometer, wheel and arc can render at 30 fps on alternate frames. Brain and HUD are event-driven. Panels that are off-screen or covered by the drawer skip drawing (`IntersectionObserver` or a flag).
- **Contexts:** use **one WebGL2 context** (background, spectrogram, particles and XY field via scissor/viewport regions). Browsers cap live WebGL contexts at roughly 16 and each one has overhead. Use a handful of Canvas2D canvases for panels, `{alpha:false}` where opaque. Keep text in DOM.
- **Canvas2D perf rules:** no `shadowBlur`; use pre-rendered glow sprites with `'lighter'`. Batch paths by colour. Align 1 px lines to `x+0.5`. Never `getImageData` in the loop. Cache static layers in offscreen canvases. Avoid changing `font` per frame. `desynchronized: true` lowers latency but forbids DOM on top and can tear, so skip it except possibly for the hero scope.

### 4.2 Engine → UI messaging

- File:// constraints: `SharedArrayBuffer` requires `crossOriginIsolated`, which a `file://` page can't get, so use `postMessage`. Batch events: one message per ~10 ms (≈ every 4 render quanta at 48 kHz), not one per note. Use flat arrays (`Float32Array` with `[time, kind, voice, pitch, vel, dur]` stride 6, transferred) to keep structured-clone cost low.
- Suggested message kinds: `ev` (notes, scheduled ahead), `clk` (beat/bar), `sec` (section start, plan, energy target), `brain` (decision text + data), `mod` (modulated macro values, 30–60 Hz), `lvl` (per-voice peak/RMS), `stat` (worklet CPU time per quantum).
- **Timestamps in AudioContext seconds** (the worklet's `currentTime`, plus `frame/sampleRate` offsets). The UI never uses arrival time.
- Loading on `file://`: Chrome treats file pages as an opaque origin, so `audioWorklet.addModule('engine.js')`, `new Worker('x.js')` and `<script type="module" src>` imports fail. Keep the worklet source in a `<script type="text/plain" id="engine">` (or a JS template string), create `URL.createObjectURL(new Blob([src], {type:'application/javascript'}))`, and pass that to `addModule` or `new Worker`. Use classic scripts for the main code.

### 4.3 Latency compensation (sync visuals to what is *heard*)

```js
let tsFilt = null;
function audioNow(ctx){
  const ts = ctx.getOutputTimestamp();               // {contextTime (s), performanceTime (ms)}
  let t;
  if (ts && ts.performanceTime > 0){
    t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  } else {                                           // fallback
    t = ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0);
  }
  // getOutputTimestamp can jitter or step on some platforms: smooth and keep monotonic
  tsFilt = tsFilt == null ? t : Math.max(tsFilt, tsFilt + (t - tsFilt) * 0.2);
  return tsFilt + DISPLAY_LEAD + userAvOffset;       // DISPLAY_LEAD ≈ 1 frame (0.016 s)
}
```

- `contextTime` is the sample currently being output by the device, so it already includes output latency. `outputLatency` (Chrome/Edge 102+, Firefox 70+, Safari 18.4+) is the hardware estimate; display it in the HUD. On **Bluetooth headphones** it can be 150–250 ms, and this is exactly the case where uncompensated visuals feel broken.
- `DISPLAY_LEAD`: a frame drawn now appears on screen roughly one vsync later, so look about one frame ahead.
- **User AV offset** (±150 ms, drawer setting, rhythm-game style) covers what the APIs misreport.
- **AnalyserNode caveat:** the analyser sees audio as it is rendered, i.e. *before* output latency, so analyser-driven visuals lead the sound by `outputLatency + baseLatency`. On wired output (~10–40 ms) this is acceptable for texture. For Bluetooth, keep a ring buffer of the last ~16 analysis snapshots tagged with `ctx.currentTime` and render the snapshot closest to `audioNow()`. Prefer worklet-computed, timestamped meters for anything rhythmic.

### 4.4 DPI scaling
- Use `ResizeObserver` with `{box:'device-pixel-content-box'}` (Chrome/Edge 84+, Firefox 108+) to set `canvas.width/height` exactly. Fall back to `round(cssSize × devicePixelRatio)` (Safari).
- In Canvas2D, call `ctx.setTransform(dpr,0,0,dpr,0,0)` after resize and draw in CSS px. Convert pointer coordinates from CSS px.
- **Cap the effective DPR:** 2.0 for 2D panels, and 0.5–0.75 × DPR for the background shader (it is soft by design). The spectrogram renders at its native texture size and is upscaled.

### 4.5 Performance budget and dynamic quality
- Target ≤ 8 ms main-thread per frame (60 fps leaves 16.7 ms; the remaining headroom absorbs GC, layout and the audio thread's CPU competition on low-core machines).
- Track a rolling p95 frame time over 60 frames. If it exceeds 14 ms, step down in order: shader scale 0.75 → 0.5 → 0.35, particles 4k → 1.5k, secondary panels to 30 fps, then feedback/Digi-Cut off. Step back up after 5 s of headroom. Show the quality tier in the HUD.
- Engine CPU: the worklet reports render time per quantum. Above 70% of budget, reduce *visual* load first, since dropouts are worse than dropped frames.

### 4.6 OffscreenCanvas viability
- Supported in Chrome 69+, Edge 79+, Firefox 105+ and Safari 16.4+, and works with WebGL2 inside a worker. `requestAnimationFrame` is available in workers; the old `commit()` pattern is deprecated.
- **What to move:** only the full-screen WebGL canvas (background, spectrogram, particles). `transferControlToOffscreen()`, then post it to a Blob-URL worker. Each frame, the main thread posts a compact features packet (512 FFT bytes + 512 waveform bytes + ~16 floats, ~1 KB) because workers cannot read AnalyserNodes.
- **Benefit:** the background keeps animating smoothly when the main thread hitches on DOM layout or GC. **Costs:** a second clock to keep in sync (send `audioNow` with each packet), one extra frame of latency, and harder debugging.
- **Recommendation:** ship v1 on the main thread, but write the GL renderer as a self-contained module taking `(features, t)` so it can move to a worker if profiling shows main-thread jank. Not worth it on day one.

### 4.7 Accessibility basics beyond motion
- Every canvas control has a real focusable DOM control (`<input type=range>` / `<button>`) with `aria-label` and `aria-valuetext` ("Energy 82, drums busier").
- Keyboard map: Space play, N new seed, M mutate, 1–6 select macro then arrows, B/D/K/H section nudges, ` drawer, R reel mode, V cycles FULL/CALM/STILL.
- Contrast: text on panels ≥ 4.5:1 (`--ink` on `--panel` is fine; `--dim` only for non-essential labels).

---

## 5. Design references: what to steal from each

| Reference | Steal this |
|---|---|
| Teenage Engineering OP-1/OP-Z/EP-133 | One mode per screen; 4 always-visible params mapped 1:1 to colour-coded encoders; spinning-reel style live feedback |
| Vital | Live modulated-value dots; hear a modulation before committing it |
| Arturia Pigments / Bitwig / Massive X | Colour per mod source; unused = dark, active = animated; mod rings; knob centres as mini-visualisers; per-voice dots |
| Output Arcade / Ableton Push | Quantised gestures with countdown; "hold to peek" momentary views; simple defaults, depth behind |
| iZotope Insight | 2.5D spectrogram "topography" (no lattice); goniometer |
| Max Cooper live AV (+ Lomas, McGloughlin) | Event-driven sync (MIDI → Resolume); chapters with distinct visual languages; map musical *meaning*, not only raw FFT; cellular/annealing forms; Digi-Cut time offsets |
| Endel / Bloom / generative.fm | Calm rest state; idle → performance mode; named moods instead of settings |
| Patatap | A distinct visual signature per sound/voice |
| Chrome Music Lab / Learning Synths | XY pad driving ~30 params as the beginner's main gesture |
| TouchDesigner audioAnalysis / cables.gl | Band level + threshold/gain/smooth; FFT-area features; analyse an unheard processed copy of the signal |
| Little Workshop TRACK (Awwwards SOTD) | Endless randomised variation + tight sync is award-level web work |

---

## 6. Sources

- https://vital.audio/ — Vital feature page: GPU-accelerated 60 fps animation, drag-and-drop modulation with preview, scopes/spectrograms.
- https://www.synthtopia.com/content/2020/11/21/new-software-synthesizer-vital-designed-to-let-you-warp-waves-in-new-ways/ — Vital launch coverage: animated displays, modulation preview before dropping.
- https://musictech.com/news/matt-tytel-vital-free-synth/ — Vital overview (spectral warping, visual workflow).
- https://www.kvraudio.com/product/vital-by-matt-tytel — Vital product listing.
- https://blakecrosley.com/de/guides/design/teenage-engineering — Teenage Engineering design principles: one-mode screens, four mapped parameters, live animated feedback, constraint.
- https://en.wikipedia.org/wiki/Teenage_Engineering_OP-1 — OP-1 background.
- https://www.soundonsound.com/reviews/teenage-engineering-ep-133-ko-ii?amp — EP-133 K.O. II review (segment-display, button-first UI).
- https://www.soundonsound.com/reviews/ableton-push-3 — Push 3: pad expression, real-time parameter display, momentary mode switching.
- https://www.soundonsound.com/reviews/bitwig-studio-2?amp — Bitwig modulator icons with live traces, per-voice dots, modulation arcs.
- https://www.soundonsound.com/reviews/arturia-pigments — Pigments: colour per mod source, animated scopes, mod rings, destination overview.
- https://docs.native-instruments.com/online-guides/massive-x-manual/en/control-elements — Massive X knob types, double-click default, wavetable knob display.
- https://cdm.link/massive-x-revealed/ — Massive X "saturn ring" modulation indicators, scalable UI.
- https://www.soundonsound.com/reviews/output-arcade — Output Arcade: macro faders, quantised modifiers, simple defaults.
- https://cdn0.workingnotworking.com/projects/360743-output-portal — Output Portal UI design credits (design system, knob interactivity).
- https://izotope.com/products/insight — iZotope Insight 2 modules: 3D spectrogram, sound field, loudness.
- https://www.soundonsound.com/glossary/goniometer — Goniometer definition: diagonal L/R axes, mono = vertical line.
- https://www.resolume.com/blog/16844 — Max Cooper Emergence: visual collaborators, tools, chapter-based concept, "data maps to music poorly".
- https://www.ableton.com/en/blog/composing-infinity-max-cooper-his-new-album/ — Max Cooper live rig (Ableton → MIDI → Resolume, 8 screens) and generative process.
- https://www.maxcooper.net/yearning-for-the-infinite-barbican — Yearning for the Infinite: multi-surface projection, generative systems.
- https://andylomas.com/collaborations.html — Andy Lomas × Max Cooper projects: cellular forms, simulated annealing (Chromos).
- https://boingboing.net/2017/03/02/watch-mesmerizing-forms-comple.html — Kevin McGloughlin's "Symmetry": circles, moiré, "Digi-Cut" time offsets.
- https://vimeo.com/178612704 — Max Cooper "Waves" video by Kevin McGloughlin.
- https://derivative.ca/UserGuide/Palette:audioAnalysis — TouchDesigner audioAnalysis outputs: low/mid/high, centroid, kick/snare/rhythm.
- https://interactiveimmersive.io/blog/touchdesigner-lessons/how-to-make-anything-audio-reactive-in-touchdesigner/ — TD audio-reactive workflow: threshold, gain, smooth, Trail CHOP for tuning.
- https://cables.gl/docs/8_audio/2_realtime_visualization/realtime_visualization — cables.gl AudioAnalyzer, FFTAreaAverage, AnalyzerTexture; analysis-only effected signal.
- https://cables.gl/op/Ops.WebAudio.AnalyzerTexture — cables.gl FFT-to-texture op.
- https://synthclipse.sourceforge.net/user_guide/music.html — Shadertoy-compatible 512×2 audio texture (row 0 FFT, row 1 waveform).
- https://webgl2fundamentals.org/webgl/lessons/webgl-qna-how-to-get-audio-data-into-a-shader.html — Getting audio data into a shader as a texture.
- https://developer.mozilla.org/docs/Web/API/AnalyserNode/smoothingTimeConstant — smoothingTimeConstant default 0.8, behaviour.
- https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode — AnalyserNode properties and methods (fftSize, bins, dB range).
- https://www.oreilly.com/library/view/web-audio-api/9781449332679/ch05.html — Boris Smus, Web Audio API ch. 5: analysis and visualisation.
- https://www.mattmontag.com/?p=1943 — Phase-aligned oscilloscope for Web Audio using known note frequency and audio clock.
- https://kokkinizita.linuxaudio.org/papers/zita-scope.pdf — zita-scope design: precise sub-sample triggering, interpolation, min/max rendering.
- https://github.com/Keavon/Web-Onset — Spectral-flux onset detection in JS with a locally averaged threshold.
- https://yup.readthedocs.io/en/latest/dsp/onsets.html — Onset detection function overview.
- https://web.dev/articles/audio-output-latency — outputLatency for AV sync; browser support (Chrome 102, Firefox 70, Safari 18.4).
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp — getOutputTimestamp: contextTime / performanceTime semantics.
- https://web.dev/articles/offscreen-canvas?hl=en — OffscreenCanvas in workers, support matrix, worker rAF.
- https://hacks.mozilla.org/2016/01/webgl-off-the-main-thread/ — WebGL in workers, background.
- https://web.dev/articles/device-pixel-content-box — Pixel-perfect canvas sizing with devicePixelContentBoxSize.
- https://wikis.khronos.org/webgl/HandlingHighDPI — WebGL high-DPI handling and input scaling.
- https://developer.chrome.com/blog/desynchronized — Low-latency `desynchronized` canvas hint and its caveats.
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — prefers-reduced-motion in CSS/JS and OS settings mapping.
- https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html — WCAG 2.3.1 flash thresholds (3/s, 10% luminance, red flash, area).
- https://developer.mozilla.org/docs/Web/API/Worklet/addModule — Worklet.addModule (accepts Blob URLs; needed on file://).
- https://en.wikipedia.org/wiki/Bloom_(software) — Bloom: tap = circle + tone, idle generative takeover, moods.
- https://factmag.com/2018/11/27/brian-eno-peter-chilvers-bloom-10-worlds — Bloom: 10 Worlds coverage.
- https://blog.readymag.com/tune-in-drop-out-how-endel-helps-get-into-the-flow-via-immersive-soundscapes-5ab08d932687/ — Endel visual language: thin lines and dots on black, semi-generative visuals.
- https://docs.generative.fm/docs/introduction — Generative.fm platform overview (Alex Bainter).
- https://en.wikipedia.org/wiki/Patatap — Patatap: sound + animation per key, melodic/rhythmic balance.
- https://cdm.link/google-are-giving-away-experiments-to-teach-music-and-code/ — Chrome Music Lab tech (Web Audio, WebGL, PIXI, Tone.js), open source.
- https://www.soundonsound.com/news/ableton-update-learning-synths — Learning Synths XY pad (~30 params), Playground.
- https://www.ableton.com/en/blog/new-in-learning-synths-export-to-live-record-your-creations-and-more/ — Learning Synths update details.
- https://littleworkshop.fr/projects/track/ — TRACK: WebGL music experience, Awwwards Site of the Day.
- https://www.awwwards.com/inspiration/interactive-music-experience-this-is-spotify — Awwwards inspiration: interactive music experience.

*Note on verification:* specific numeric constants (smoothing taus, peak fall rates, band counts, thresholds) are engineering recommendations synthesised from these sources and standard metering practice, not quotes. Tune them by ear and eye with a Trail-style debug plot, as the TouchDesigner tutorial advises. The `file://` restrictions (opaque origin blocking file-URL workers, worklets and modules; no SharedArrayBuffer) reflect known Chrome behaviour and should be confirmed with a 5-minute smoke test at the start of the build.
