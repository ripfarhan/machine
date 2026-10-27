# 06 — Case studies: ten Max Cooper tracks, measured

Source: the owner's reference set (10 tracks, "music data to train"). Each track was transcribed (basic-pitch ONNX) and
measured with `tools/casestudy.py` (key from Krumhansl on the notes, chord runs per bar, kick profile, ⅓-octave LTAS,
8-bar trajectories). Raw JSON lives in `research/cases/`. The auto-EQ target (`js/engine/58-target.js`) was measured on the
same audio with the mixer's own band filters (`tools/target.js`).

| Track | BPM | Key (notes) | Notes/beat | Mean chord run | Kick decay to −20 dB |
|---|---|---|---|---|---|
| Becoming | 123 | G♯ minor | 2.2 | 1.6 bars | 210 ms |
| Four Tones Reflected | 117.5 | D major | 3.6 | 2.3 | 170 ms |
| Order From Chaos | 152 (76 felt) | F major | 1.9 | 2.0 | 64 ms |
| Perpetual Motion | 117.5 | E major | 4.5 | 1.3 | 107 ms |
| Solace In Structure | 117.5 | E minor | 1.0 | 1.8 | 42 ms |
| This Is A Bridge | 136 | C♯ major | 1.0 | 2.0 | 90 ms |
| Transcendental Tree Map | 117.5 | D minor | 3.3 | 1.4 | 11 ms (click) |
| Void | 123 | D♯ minor | 1.1 | 1.9 | 32 ms |
| When I Sit Alone… (w/ Aho Ssan) | 95.7 | D major | 2.4 | 2.1 | 64 ms |
| 8 Billion Realities (w/ Rob Clouth) | 136 | F♯ minor | 1.3 | 1.2 | 100 ms |

## What the numbers say (and what changed in the engine)

1. **Tempo is a narrow band.** Four of ten sit at 117.5 BPM, two at 123, two at 136. Worlds keep 112–126 as the core and
   134–140 for INTENSE.
2. **Power chords rule.** In every track the most common "chord" is a bare fifth (I5, ♭III5, ♭VI5, IV5, V5); sus4 is next.
   Real triads are a minority. The same root often **flips between open fifth and minor/major** (I5 ↔ i: Becoming,
   Solace, 8 Billion), and Four Tones Reflected is almost entirely I5 → Isus4 → IV5. Void is a two-chord i ↔ iv7 swing.
   → New progression families `planing`, `flip`, `sus`, `swing2`; chord colour weights now favour `open` and `sus4`.
3. **Chords move every 1–2 bars**, not every 4–8. → families use 1–2 bar runs; long pads still sustain across bars.
4. **The music lives low.** Transcribed notes cluster in octaves 1–3; main sections have spectral centroids of
   110–400 Hz. Intros and breaks are where the brightness is (centroid 600–1600 Hz, no bass yet).
5. **Spectral balance** (median of loud parts, dB per band, mean removed; 45/110/300/1k/3.2k/9k Hz):
   `10.0 / 6.5 / 2.8 / 0.1 / −5.8 / −11.3` — a steep, consistent downward tilt across all ten tracks.
   First renders of this engine were +6…+11 dB too strong in 200–500 Hz and 2–5 kHz.
   → chord/key tracks now high-pass at 160–200 Hz with a −3 dB bell near 300–340 Hz; the bass carries the low end
   (+3 dB, more 80–160 Hz harmonic); and a slow, bounded **auto-EQ** on the master steers each piece toward this
   curve during its loud sections (±6 dB, 20 s time constant, gated by energy so intros keep their colour).
6. **Form:** quiet intro (−20 to −44 dB) rising over 16–48 bars, then long plateaus near −8 dB with one or two
   8-bar breaks (−15 dB), then a fade. Normalising loudness continuously would erase that, so the master now
   references a slow peak-hold of loudness instead of the instantaneous level.
7. **Kicks** are short to medium (30–210 ms to −20 dB) and land around 50–70 Hz; Tree Map uses a pure click.
   This matches the kick patches (round 150→50 Hz, 909, deep, distorted, soft).

## Renders vs reference after the changes (seed 11, 5 min each)

Region deviation from the reference median (dB): all eight worlds within about ±4 dB in every region except DRIFT's air
band (hiss texture, intentional) — previously up to +11 dB in the low-mids. Trajectories (intro rise → plateau around
−10 dB → break dips → outro) now resemble the reference shapes.
