# Maut ki machine

A browser-based engine for audio-reactive, experimental 9:16 video reels.
Drop in photos, GIFs and clips plus a song; the song is analyzed into signals
(kick, snare, hat, bass, hype, drops, beat grid) and every cut, flicker and
effect is wired to those signals through a modulation matrix. Exports MP4
frame by frame with the GPU, at 720×1280 or 1080×1920.

No build step, no server, no dependencies. Open `index.html` in Chrome or Edge.

## How it works

1. **Analysis** (`js/analysis.js`): offline FFT at 100 frames/s → band energies,
   per-band onsets (kick/snare/hat), punch, loudness, a long-window *hype* curve,
   drop detection, build-ups, tempo, phase and downbeats.
2. **Modulation matrix** (`js/presets.js` → `PARAMS`): every dial is
   `base + depth × signal`. Pick any signal as the source of any dial.
3. **Sequencer** (`js/app.js` → `buildScore`): cut probability follows hype²,
   with beat and kick triggers, flash cuts on punches, min-hold, overlap layers,
   motif decorations and word events, all deterministic from a seed.
4. **Renderer** (`js/shader.js`): 2D layers (footage, overlaps with blend modes,
   clones, PiP, shards, bands, text, motifs) → one WebGL2 pass with the effect
   chain (looks, tears, pixel sort, melt, liquid, displace, kaleido, edges,
   halftone, dither, feedback, rings, light leaks) → flicker pass (invert
   patterns, white flash, black blink, strobe). *Clean hits* drop the whole stack
   for a few frames after each kick so the footage keeps punching through.
5. **Export** (`js/mp4.js`): WebCodecs H.264 + AAC (PCM fallback), muxed into a
   flat MP4 in-page.

## Files

| file | holds |
|---|---|
| `index.html` | the page |
| `css/app.css` | the tool's own look |
| `js/util.js` | shared helpers |
| `js/fonts.js` | font library and font sets |
| `js/motifs.js` | symbol library and arrangements (scatter, mandala, frame, column, giant, trail, wallpaper) |
| `js/presets.js` | palettes, dial definitions, the 58 styles |
| `js/analysis.js` | audio analysis |
| `js/shader.js` | GLSL effect chain |
| `js/mp4.js` | MP4 muxer and codec picker |
| `js/samples.js` | sample footage, inlined so the app runs from a local file |
| `js/app.js` | state, media (GIF decoder, clip bursts), sequencer, renderer, export, UI, recipes, local library, timed lyrics |
| `js/synth.js` | Studio: the math synthesiser — DSP + composition, runs in a Worker and in Node |
| `js/studio-ui.js` | Studio panel: controls, background rendering, playback, export |
| `music/analyze.py` | music reverse-engineering pipeline (numpy/scipy, no librosa) |
| `music/analysis/` | per-track JSON, `profile.json` (cross-track medians the generator is parameterised from), charts |
| `music/REPORT.html` | the readable analysis report |

## Adding things

- **A style**: add an entry to `PRESETS` in `js/presets.js` (looks, palettes,
  layouts, text styles, decorations, fonts, dial overrides).
- **A font**: add a face to `FONTS` in `js/fonts.js` and its family to `FONT_LINK`.
- **A motif**: add a draw function to `MOTIFS` in `js/motifs.js`.
- **An effect**: add a uniform and a block to the fragment shader in
  `js/shader.js`, a dial row in `PARAMS`, and set the uniform in `renderAt`.

## Variation

Every effect draws its character from a per-cut value (`uVar`), not from the
reel seed, so the same dial looks different at each cut instead of once per
video. Several effects also carry alternate forms chosen the same way:

| effect | forms |
|---|---|
| tear | noise bands · vertical rips · chunk displacement |
| melt | drip down · sideways · upward |
| ghost | difference · echo trail · double exposure |
| pixel sort | four run directions |
| halftone | dots · line screen · cross-hatch, rolling angle |
| rings | concentric · spiral · moiré |
| light leak | corner bloom · edge bar · lens flare |
| glow | bloom · anamorphic streak · vertical bleed |
| edges | colour sobel · ink outline · glow in the dark |
| pixelate | square · wide scan blocks · tall mosaic |
| slice | horizontal · vertical |

Scanlines model tape rather than stripes: chroma lags luma and the torn
head-switch strip sits at the bottom of the frame.

## Timed lyrics

In the Words panel, *Timed lyrics* turns the textarea into one line per row
and gives every line a time. *Spread* distributes lines across a range,
snapped to beats. Play the reel and press **L** when each line is sung to
stamp the next line at the playhead; nudge any line ±¼ s, type a time, or
hit ● to set it to the playhead. *Shift everything* moves all lines at once.
Each line either flashes word by word across its window or shows whole, up
to *Max hold*. Cues save into recipes.

## Studio

A math-based synthesiser. Every sample is computed, nothing is sampled, and
nothing is a loop: the music comes from systems that evolve.

**Sounds** — FM operators (bells, e-piano, bass, pads, leads), a two-pair FM
piano with key-tracked decay and three detuned strings per note (felt, e-piano,
glass), Karplus–Strong strings with fractional-delay tuning and a body
resonance, modal resonator banks using physical mode ratios (circular membrane,
marimba bar, glass, metal plate), PolyBLEP saw/square oscillators through TPT
state-variable filters, a 5-voice unison pad with a 24 dB filter and stereo
chorus, additive pads whose partials drift independently, granular clouds on
the chord tones, Lorenz-driven FM drones, just-intonation drones, Shepard-tone
risers that climb forever.

**Space and master** — an 8-line feedback-delay-network reverb (Hadamard
matrix, damped lines, high-passed send, low-passed return), a ping-pong delay,
sidechain from the actual kick times, a separate mono bass bus with tape-style
warmth, a high-passed music bus, a low shelf and an air shelf, a glue
compressor and a look-ahead limiter at −1 dBFS. No soft clipping anywhere.
The role levels were solved numerically so that the median spectral balance of
a piece lands on the balance measured across the reference tracks in
`music/analysis/profile.json`.

**Composition (the evolving engine)** —
- harmony from a progression grammar per mode (the loops people have loved for
  decades: i–VI–III–VII, i–VII–VI–VII, I–V–vi–IV, dorian i–IV…), one chord-colour
  palette per piece (triads → 7ths/add9 → 9ths/11ths/quartal), voice leading by
  search, and a voicing rule that puts a 9th a major seventh above the third,
  never a semitone;
- a motif that lives on chord-tone *rungs*, so the same shape re-harmonises
  itself under every chord, with passing tones on weak sixteenths;
- motif rhythm from Euclidean patterns, a Fibonacci word (the L-system A→AB,
  B→A) or a rule-90 cellular automaton; pitch from a 1/f (Voss) walk, an
  L-system, a Lorenz slice or a weighted random walk — the *Melody math* dial;
- development as A A′ B A phrase schemes (tail change, inversion, lift,
  retrograde, thinning, augmentation) rather than scrambling: the theme stays
  recognisable, and from the second peak on it has moved;
- two polymetric percussion lines on chord tones, a polymetric arpeggio cycle
  (3, 5, 6 or 7 against the bar) with 1/f accents and chaos-driven ratchets,
  a felt piano that plays broken chords in the breakdown and the intro;
- the arpeggio is a soft synth pluck (two detuned saws and a sub square through a 4-pole low-pass with a falling cutoff, no resonance) or a round FM blip; it plays in 2-bar phrases with rests and runs continuously only in the peaks. String, bell, glass and mallet voices are never picked automatically, only by hand;
- roles enter one at a time (every few bars in the intro, faster in the second
  build), the break keeps pad + keys (+ one or two others), the outro removes
  them in reverse;
- chaos (logistic map) drives velocities, ghosts, ratchets and timbre, not the
  grid; Lorenz attractors drive filters and textures.

Harmony in the emergence and techno styles follows the vamp grammar measured off the reference tracks: two or three chords trading places for bars at a time (i↔VI, i↔iv, i↔III, I↔vi), the home chord lingering, chord changes every 1–4 bars. Forms: emergence (intro, low, long groove in steps, peak, dip, peak), steps, arc, rise (chaos decays into order), twin peaks, ambient. Drops are every energy step up, not only the peaks: impact, filter sweep, a Shepard riser into them. When polymeter is high a second arpeggio runs an octave up in a different cycle length against the first. A glitch texture scatters micro-blips and 1/32 ratchet bursts on chord tones. Styles for
*New piece* / *Randomize*: emergence (Max Cooper-leaning), cinematic, broken
beat / IDM, deep house, techno, downtempo, ambient — all on the evolving
engine. The genre loop styles (house, dub techno, acid, electro, garage, D&B,
lo-fi, trap, synthwave, amapiano) remain in the dropdown as a pattern engine.

*New piece* changes everything; *Variation* keeps harmony, sounds and form and
rewrites the parts. Rendering runs in a background thread; changing a dial
re-renders while the current audio keeps playing. A 4-minute track takes
roughly 15–25 s. The same engine runs in Node:

    const S = require('./js/synth.js')();
    const {L, R, sr, meta} = S.render({seed: 7, bars: 112, style: 'cooper'});

Re-run the analysis on new material:

    ffmpeg -i track.mp3 -ac 1 -ar 22050 wav/track.wav
    ffmpeg -i track.mp3 -ac 2 -ar 22050 wav/track_st.wav
    python3 music/analyze.py wav music/analysis

## Drop handling

Two independent toggles under the analysis panel, both keyed to the same
moment (the cyan line on the timeline):

- **Flashes only after the drop** — before it, clean media cuts only: no
  invert bursts, white/black flashes, strobe, band-inverts or flash cuts.
- **Build-up mode** — goes further: the whole effect stack is damped by the
  *calm* amount (and flashes are held) until the drop, then slams back to
  full power with nothing changed after it.

**Drop at** overrides the detected moment: leave it empty for the auto-detected
drop, type a time in reel seconds, or hit *Drop at playhead*. Both toggles, the
calm amount and the manual time are saved in recipes.

## Recipes

*Save recipe file* writes the style, seed, every dial (base, source, depth),
words and font set as JSON. *Load* brings it back; *Copy code* gives a
paste-able string. Footage and song are not part of a recipe; they are kept in
the browser's local database and restored on reload.

## Notes

- Export records nothing in real time: each frame is rendered at its exact
  timestamp and encoded, so output is always a full 60 fps.
- Same seed + same dials + same footage = the same reel.
- Fonts come from Google Fonts; without a connection the system fallbacks are used.
