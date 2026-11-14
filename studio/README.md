# Machine Studio — Vocal Tune

A browser vocal tuner and mini-DAW. Drop in a vocal (or record one), and it reads the pitch, finds the
key, pulls every note into tune, and sets up a vocal chain. Then everything is editable: the notes on a
piano roll, the tuning feel, the mix, and stacked doubles and harmonies.

No build step, no server, no dependencies, nothing uploaded. Open `studio/index.html` in Chrome or Edge.

## Using it

1. **Load vocal** (wav, mp3, m4a, flac, ogg), **● Rec** to record with the mic, or *Try the demo take*.
2. The key is detected (change it in the top bar, or click the piano keys in **Tune** to allow or forbid
   single notes). Pick a **Style** for a starting point: Natural, Pop polish, Hard tune, Melodic trap,
   R&B silk, Dark, Choir stack, Tune only.
3. **Load beat** to hear the vocal in context. Its tempo and key are read too; the key guess uses both.
   If a beat is loaded, recording plays it while you sing (use headphones) and lines the take up.
4. Edit, then **Export**: full mix, vocal with effects, or the dry tuned vocal for another DAW (24-bit WAV).

The session (take, beat, every setting and edit) is kept in the browser and restored on reload.

### The editor

| do | how |
|---|---|
| play / pause | Space |
| move the playhead | click empty space or the ruler |
| loop | drag on the ruler, or select notes and press L |
| re-pitch a note | drag it up or down (snaps to the scale; hold Alt for free pitch) |
| move by scale step / octave / 10 cents | ↑ ↓ / Shift+↑↓ / Alt+↑↓ |
| move the cut between two notes | drag the line where they touch |
| split / merge | double-click the note (or S at the playhead) / M |
| leave a note as sung | Delete |
| back to automatic | R |
| select several | Shift-click, or drag a box |
| zoom time / pitch | Ctrl+wheel / Alt+wheel |
| hear the untouched take | B |
| undo / redo | Ctrl+Z / Ctrl+Shift+Z |

Grey line = what was sung. Green line = what you will hear. Pink blobs = the notes.

### Tune

- **Retune speed** — how fast pitch is pulled to the note. 0 is the hard-tune snap, 20–60 ms is modern
  pop, 100+ is invisible.
- **Humanize** — relaxes the pull on the held part of long notes; short notes stay tight.
- **Amount** — how much of the correction is applied.
- **Flex** — leaves big bends and slides alone, tunes only what is already near a note.
- **Note glide** — slide time between joined notes (0 = stepped).
- **Vibrato** — scale the singer's own (0–200%), or add a made one (depth, rate, delay).
- **Transpose / Formant / Tuning ref** — move the whole vocal, change throat size, shift the grid off A=440.

Every note can also have its own fine pitch, retune speed, vibrato, formant and volume (**Notes** tab).

### Mix

Auto level → gate → level rider → low cut → de-esser → 4-band EQ → compressor → saturation → delay
(free or tempo-locked) → reverb (room / plate / hall) → limiter. Double-click any control to reset it.

### Stack

Extra voices made from the take: doubles (detuned, late, panned) and harmonies that follow the key
(3rd above is always a note of the scale) or sit at fixed semitones. Up to eight.

## How it works

| stage | file | what |
|---|---|---|
| pitch tracking | `js/dsp/pitch.js` | YIN difference function by FFT, up to 5 period candidates per 5.8 ms frame, Viterbi path with an unvoiced state (the pYIN idea) |
| notes | `js/dsp/pitch.js` | dynamic program fitting a staircase of scale notes to the pitch line; scoops and slides fold into the note they arrive at |
| key | `js/dsp/core.js` | pitch-class histogram against Krumhansl-Kessler profiles; chroma + onset autocorrelation for the beat's key and tempo |
| correction | `js/dsp/tune.js` | `out = sung + amount × (noteOffset − tracker)`: the offset centres the note, a one-pole tracker removes what is still off at the retune speed |
| resynthesis | `js/dsp/psola.js` | TD-PSOLA: pitch marks placed by period-to-period cross-correlation, two-period grains re-spaced (pitch) and resampled (formant), neighbouring grains blended; unvoiced audio is copied through untouched |
| mix | `js/mix.js` | stock Web Audio nodes, same graph live and offline; compressor look-ahead is measured so bands, beat and exports line up to the sample |
| editor | `js/editor.js` | canvas piano roll |
| app | `js/app.js` | state, render worker, playback, panels, undo, export, recording, session |

Resynthesis runs in a worker and is cached per voiced phrase, so moving one note re-renders only that
phrase (tens of milliseconds); a global change on a three-minute take takes a second or two per voice.
With the correction off the output is bit-identical to the input.

## Tests

```bash
node studio/test/dsp.test.js
```

Sings a synthetic out-of-tune phrase and checks the tracker against the true pitch, the note and key
detection, transparency at zero correction, and that the resynthesized audio lands on the requested
pitch (re-measured) for natural and hard tuning, ±7 semitone shifts and formant moves.

## Next

Beat maker, multi-track timeline (several takes, comping), note timing edits, live monitoring with
low-latency tuning while recording.
