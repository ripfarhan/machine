# MAUT KI AWAAZ

A live, generative electronic-music machine in the Max Cooper universe. It writes and plays its own music in real time,
never the same twice, and everything on screen reacts to it. Runs offline: just open `index.html` in Chrome or Edge.

## Start
1. Double-click `index.html` (Chrome / Edge). 2. Pick a world or let the AI pick → **START**.
Headphones or real speakers: there is sub-bass.

## The eight worlds
| World | After | What it is |
|---|---|---|
| EMERGENCE | Order from Chaos | random rain clicks slowly snap onto a grid and become the rhythm |
| PRIME TILING | Penrose Tiling | marimba/kalimba lanes looping in prime lengths (3,5,7,11,13) — never repeats |
| REPETITION | Resynthesis | one chord-stab pattern under a slowly sweeping filter, dub delays, 4/4 |
| DRIFT | My Mind Is Slipping | every chord note repeats at its own slightly different tempo; beatless, tape hiss |
| WARM RETRO | Waves | arpeggios, old electric piano, swing, crackle |
| CRESCENDO | Open Eye Signal | one frozen riff that opens up for minutes, distorted kick |
| FELT | Kiasmos | felt piano motif over minimal techno |
| INTENSE | Exotic Contents | half-time weight, distorted bass stabs, glitch |

## Controls
- **ENERGY** layers, drums and brightness · **MOOD** dark ↔ bright (changes the mode at the next chord loop) ·
  **SPACE** reverb/delay size · **DENSITY** notes per bar · **CHAOS** glitch: stutters, drop-outs, filter jumps, timing ·
  **MOTION** filter movement, auto-pan, phaser
- **MORPH pad**: left/right = warm ↔ glass, down/up = clean ↔ broken (tape, crush)
- **BUILD / PEAK / BREAK / HOLD** — steer the song; lands at the next 4-bar phrase
- Voice strips: **M**ute, **S**olo, **↻** new sound + new pattern, **AUTO/ON/OFF** force a part
- **♥** like (the AI makes more like it and remembers your knob settings) · **✕** skip · **MORE** like this · **SURPRISE**
- **● REC** records exactly what you hear to a lossless WAV · **⤓ EXPORT** renders the whole current piece to WAV (fast)
- **REEL** 9:16 visual for Instagram/YouTube Shorts → **● RECORD VIDEO** saves video + audio (.webm)
- Keys: Space play · N next · L like · X skip · B/P/K/H nudges · R reel · V visuals FULL/CALM/STILL

Everything it makes is generated from scratch by this code (no samples), so it is yours to post.

## For developers
- `js/engine/` the engine (runs in an AudioWorklet, in an OfflineAudioContext for export, and in Node)
- `tools/render.js WORLD seed seconds out.wav [macro=v] [--from=s] [--solo=slot]` offline render ·
  `tools/test-all.js` regression · `tools/metrics.py` balance vs the reference · `tools/calibrate.js` patch loudness ·
  `tools/target.js` auto-EQ target from reference audio
- `research/` the research and case studies the design is based on; `DESIGN.md` the design.
Fonts: Barlow Condensed and Space Mono (SIL OFL, embedded).
