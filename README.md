# Glitch Reel Machine

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
| `js/app.js` | state, media (GIF decoder, clip bursts), sequencer, renderer, export, UI, recipes, local library |

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
