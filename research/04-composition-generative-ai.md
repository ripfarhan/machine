# 04 — Composition, Form, Variety and Taste-Learning for a Browser Generative Synth

**Target:** emotional, cerebral electronic music in the vein of Max Cooper, Jon Hopkins, Rival Consoles, Kiasmos, Steve Reich, Brian Eno and melodic techno. It runs in real time, it evolves over 4–8 minutes or plays as an endless stream, it has controls that audibly matter, and it has an "AI" that learns what the listener likes.

**Legend.** **[S]** means the claim comes from a source listed at the end, cited by short name. **[I]** means it's my inference or design recommendation: practitioner convention, reasoning from the sources, or genre listening. It's not a cited fact. Numbers marked [I] are starting values to tune by ear.

---

## 0. The thesis in one page

The earlier attempts (Markov harmony, CA rhythms, Euclid, L-systems, 1/f melodies, chord-tone ladders, vamps) all share one structural flaw, and the flaw explains every complaint:

| Complaint | Root cause [I] | Cure (section) |
|---|---|---|
| "Repetitive" | Each generator is *stationary*: its statistics are the same at minute 1 and minute 6, so the music repeats at the wrong time-scale. It churns note by note but never changes section by section. | A top-down **form planner** that schedules contrast (§1, §5) |
| "Every generation sounds the same" | Seeds only change *note-level* randomness. Tempo, timbre family, drum family, harmonic language and form stay constant, and those are what listeners use to tell pieces apart. | A **genome** of high-level, perceptually large genes (§6) |
| "No real controls that change anything" | Controls were mapped to probabilities whose effects average out, or to a single parameter. | **Macro controls** that each move 4–8 parameters across timbre, density and harmony, with discrete thresholds (§8) |
| "Cheesy / R&B" | Close-voiced 7th chords in the mid register, functional ii–V–I motion, and the pop minor loop i–VI–III–VII (the most common chords in Hooktheory's minor-key data: i 14%, VI 9%, VII 9% [S Hooktheory-minor]). | Open/spread voicings, sus/add9, pedal points, modal and neo-Riemannian moves, no stacked 7ths (§2) |

The architecture that follows from this is a hierarchy [I], modelled on the "conductor" idea from MusicVAE. There, a high-level RNN emits one embedding per bar and a lower RNN fills in the notes, which is what gives it long-term structure [S MusicVAE]:

```
Genome (per piece, ~25 genes)          → what kind of piece is this?
  └─ Journey / Form plan (sections)    → where is it going? energy & tension curves
       └─ Section state (8–32 bars)    → which layers, which chord loop, which motif variant
            └─ Phrase (4–8 bars)       → motif statement / answer / fill
                 └─ Bar/step events    → notes, drums, microtiming
Macro controls  → offsets applied at every level (live)
Taste model     → chooses genomes; learns from likes/skips/control moves
```

None of the old generators has to be thrown away. Euclid, Turing-machine loops and Markov steps are all fine as **leaf-level texture generators**. They failed because nothing above them planned anything.

---

## 1. Why algorithmic music sounds samey and aimless, and the known cures

### 1.1 Diagnosis

1. **No macro-form.** Without sections, listeners can't predict, anticipate or feel release. Huron's expectation theory and Gold et al. both tie pleasure to expectation being set up and then resolved. Gold et al. found people prefer *medium* complexity, where uncertain expectations end up resolved by predictable events, and where a strongly predictable context *allows more surprise* [S Gold2019]. A stationary random process is uniformly uncertain and never resolves anything.
2. **Wrong repetition time-scale.** Repetition isn't the enemy. Margulis's work on repetition describes it creating "a sense of expanded present" and engagement [S Margulis-news]. Her 2013 experiment, as I recall its published abstract and could not fetch in full here, found that listeners rated contemporary art music excerpts with repetition *added* as more enjoyable and more likely to be written by a human. **[S, abstract-level]** The trouble is repetition at the note level, where random churn sounds the same everywhere, *combined with* no repetition at the phrase level, where no motif ever comes back.
3. **No motif identity.** Music Transformer's improvement over earlier RNNs was specifically that it introduces a motif and then **repeats and varies it** across the piece, while earlier models "forget" the primer [S MusicTransformer]. A system with no persistent motif object has nothing to remember.
4. **No change in timbre.** Farbood's tension experiments found **dynamics (loudness) and pitch height** were the strongest drivers of perceived tension, ahead of onset frequency and tempo, with harmony weakest for non-musicians [S Farbood2012]. Most of the old attempts varied *pitches*, which is the least salient dimension for a non-musician listener, and kept loudness, register and timbre flat.
5. **Surprise without budget.** Eno wanted "a certain level of surprise" rather than big surprises [S Eno1996]. Witek et al. found an inverted U: *medium* syncopation maximises wanting to move and pleasure [S Witek2014]. Random generators sit at a constant surprise level instead of spending surprise at structural points.

### 1.2 The cures, as engineering rules [I unless marked]

| Rule | Implementation |
|---|---|
| **R1. Plan top-down.** | Generate the *form* first: section list, bar counts, energy curve E(t) and tension curve T(t). Then generate parts to fit them. |
| **R2. One piece = 1–2 motifs + 1 harmonic "signature move".** | Choose a motif (3–7 notes) and a characteristic chord move at piece start, and keep them for the whole piece. Variation is applied *to* them; they are never replaced. |
| **R3. Repeat at 4, 8, 16 and 32 bars.** | Exact repetition for 2–4 bars, small variation at 4 or 8, a layer change at 16, a section change at 32. Phrase-end fills only at 4/8/16 boundaries. |
| **R4. Contrast budget per section.** | Each section boundary must change at least 3 of: layer set, register, brightness, drum pattern family, harmonic rhythm, chord loop, density. Within a section, change at most one thing per 8 bars. |
| **R5. Surprise budget.** | About one "event" (unexpected chord, dropped kick, silence, new sound) per 16–32 bars, placed at phrase boundaries. Context certainty pays for surprise, so put the surprise right after a long stable stretch [S Gold2019 → I]. |
| **R6. Timbre is a compositional parameter.** | Filter cutoff, envelope decay, reverb send, saturation and unison detune follow the energy curve. Max Cooper aims for albums where "no sound appears twice" [S Cooper-Ableton]. An engine version: sound parameters drift slowly over the piece, and sections re-roll the patch within its family. |
| **R7. Gradual process.** | Reich: "a musical process should happen extremely gradually" so it can be heard [S Reich-Gradual]. Hopkins credits repetition and slow change over long spans, borrowed from hypnosis and relaxation techniques [S Hopkins-Spin]. Implementation: long linear ramps over 16–64 bars, rather than random jumps. |
| **R8. Make the process audible.** | Reich's processes "determine all the note-to-note details and the overall form simultaneously" [S Reich-Gradual]. Every piece should have one audible process: a phase drift, an additive build, a filter opening over 64 bars, or a chord-cycle walk. |

---

## 2. Harmony for this genre

### 2.1 Where the cheese comes from [I]

- **Seventh chords in close position in the mid register** (C4–C5): min7, maj7 and dom7 stacked as 1-3-5-7 read as neo-soul or R&B or lounge.
- **Functional cadences**: V→I, ii→V→I, and dominant 7ths resolving.
- **The four-chord pop loops**: I–V–vi–IV and its minor rotation i–VI–III–VII. Beatportal's melodic-techno tutorial literally suggests Am–F–C–G [S Beatportal]. It's usable, but only with recolouring (pedal bass, sus voicings, slow harmonic rhythm), otherwise it sounds like pop.
- **Every chord equally loud, equally long and in root position**, plus bright saw pads.
- **Chord changes every bar** at dance tempo, which reads as busy pop. This genre changes every 2–8 bars.

### 2.2 Modes and a "mood ladder" [I, standard modal theory]

Order the modes by brightness, from most raised scale degrees to most lowered. This becomes the **Mood** control's backbone (§8):

| Brightness | Mode (on A) | Colour note | Use |
|---|---|---|---|
| 7 (brightest) | Lydian (A B C# D# E F# G#) | #4 | wonder, film "lift"; good for climaxes |
| 6 | Ionian (major) | — | sparingly; risk of pop |
| 5 | Mixolydian | b7 | open, folk, less used |
| 4 | **Dorian** (A B C D E F# G) | natural 6 | hopeful melancholy; a staple of melodic techno and Kiasmos-like pieces |
| 3 | **Aeolian** (natural minor) | b6 | classic melancholy |
| 2 | **Phrygian** | b2 | dark, tense, techno |
| 1 | Locrian | b5 | avoid except as a passing colour |

Recommended defaults for the target style are Aeolian 35%, Dorian 30%, Phrygian 10%, Lydian 15% and Ionian/Mixolydian 10% [I]. Also allow **mode mixture inside a piece**: Aeolian verses with a Dorian iv→IV "lift" or a Lydian climax. Hooktheory's IV→iv example ("In My Life") and minor-iv-in-major colour show the same borrowing in pop [S Hooktheory-cinematic].

### 2.3 Voicings: the most important anti-cheese lever [I]

Voice every chord with explicit register slots. MIDI numbers assume A minor; transpose as needed.

```
slot      range (MIDI)   content
SUB       28–40          root (or pedal) — mono, sine/triangle
BASS      36–52          root or 5th; never the 3rd except deliberate inversion
LOW-MID   48–60          5th or octave; AVOID 3rds below ~MIDI 52 (mud)
MID       55–72          the 3rd (or 2nd/4th for sus) — the "colour" voice
HIGH      67–84          9th, 11th or upper 5th; this is where add9/maj7 colour lives
AIR       79–96          optional doubled 5th/9th, very quiet, bright pad/bell
```

Voicing vocabulary, in order of use:
1. **Power/open fifth** (1-5-8): neutral, mode-ambiguous, great for builds.
2. **sus2** (1-2-5) and **sus4** (1-4-5): ambiguous and cinematic, and avoids major/minor cheese.
3. **add9 spread**: 1-5 (low) + 3 (mid) + 9 (high). This is the core "emotional" sound.
4. **Quartal stacks** (1-4-b7-b3 …): modern and cerebral.
5. **min(add9) with the 3rd on top**: melancholic.
6. **maj7 only as a spread voicing**, with the 7th in HIGH, never next to the root. Avoid dom7 entirely except as a tension chord before a drop.

Rule: **at most one "colour" tone (7, 9, 11, #4) per voicing**, and only in the HIGH slot [I].

### 2.4 Pedal points [S EDMProd-tension lists pedal tones as a tension device; I for specifics]

A pedal is the single cheapest way to make the music sound like Kiasmos or Cooper rather than pop. Hold the bass on the tonic (or 5th) for a whole section while upper chords move:

```
bass:  A ──────────────────────────────── (16 bars)
upper: Am(add9) | Fmaj7#11/A | C(add9)/A | G6sus/A   (4 bars each)
```

The same "pop" progression becomes static, hypnotic and cinematic. Pedal-break moments (the bass finally moves to F under the F chord) become structural events that you can save for the climax.

### 2.5 Progression families for this genre

Each family is a *generator template*, not a fixed sequence. Numerals are relative to the piece's mode.

| ID | Family | Example in A minor | Feel | Default harmonic rhythm |
|---|---|---|---|---|
| H1 | **Two-chord oscillation** | i ↔ VI (Am–F); or i ↔ iv (Am–Dm) | hypnotic, Kiasmos/Hopkins | 4 or 8 bars per chord |
| H2 | **Dorian lift** | i ↔ IV (Am–D) | hopeful melancholy | 4 bars |
| H3 | **Pedal planing** | sus2 chords on i, VII, VI, VII over an A pedal | Cooper / Rival Consoles | 2–4 bars |
| H4 | **Descending tetrachord** | i – VII – VI – V(sus) | cinematic lament | 2–4 bars |
| H5 | **Cinematic VI–v–i** | VI(maj7) – v – i – v7 (Interstellar shape [S Hooktheory-cinematic]) | epic, spacious | 4 bars |
| H6 | **Chromatic mediant shift** | i → bVI of the *parallel* (Am → F#m), or I → bVI (C → Ab, *Man of Steel* [S Hooktheory-cinematic]) | sudden awe | a single event at a section boundary |
| H7 | **Neo-Riemannian walk** | chains of P, L, R (see 2.6) | Cooper-like "shifting light" | 4–8 bars per move |
| H8 | **Reich chord cycle** | 4–11 chords, each held as its own long section; *Music for 18 Musicians* builds 11 sections of about 4 min, each on one chord of an 11-chord cycle [S Reich18-wiki] | process / trance | 16–64 bars per chord |
| H9 | **Pop loop, recoloured** | i–VI–III–VII *only* with a pedal + sus voicings + 4-bar rhythm | melodic techno mainstream | 4 bars |

Selection weights by default: H1 20, H2 12, H3 15, H4 10, H5 10, H7 12, H8 8, H9 8; H6 is used as a section event [I].

### 2.6 Neo-Riemannian moves (P, L, R) [S Hooktheory-cinematic, Lehman's framework]

On triads (root, quality):
- **P (Parallel)**: C ↔ Cm. The 3rd moves by a semitone.
- **R (Relative)**: C ↔ Am. The 5th moves by a whole tone (or the root, for minor).
- **L (Leading-tone)**: C ↔ Em. The root moves down a semitone.

Each move changes **one note by 1–2 semitones** and keeps two common tones. That's why these moves sound like "light shifting" rather than a functional progression. Compound moves in film: RLP gives I→iv (Leia's theme), P-R-L gives i→IV ("Binary Sunset") and LRLR gives I→II (*E.T.*) [S Hooktheory-cinematic].

```js
// triad as {root: 0..11, minor: bool}
const P = c => ({root: c.root, minor: !c.minor});
const R = c => c.minor ? {root: (c.root+3)%12, minor:false} : {root:(c.root+9)%12, minor:true};
const L = c => c.minor ? {root: (c.root+8)%12, minor:false} : {root:(c.root+4)%12, minor:true};
// "Cooper-like" walk: mostly R and L (stay diatonic-ish), P rarely (mode flip = big emotional event)
function nrWalk(start, steps, rng){ const ops=[[R,.45],[L,.40],[P,.15]]; /* weighted pick, forbid immediate undo */ }
```

Constraints [I]: forbid undoing the previous move immediately (R then R), keep the walk within ±3 fifths of the home key, and return home at section end, either by retracing the path or by the shortest NR path.

### 2.7 Voice leading [S Tymoczko-MTO for the metric; I for the algorithm]

Tymoczko measures voice-leading size as **taxicab distance**, the total semitone motion summed across voices, minimised over assignments of voices [S Tymoczko-MTO]. Use that to choose voicings:

```js
function bestVoicing(prevVoicing, chordPCs, slots){
  // enumerate candidate voicings: each slot picks a pitch of an allowed chord tone within its range
  // cost = Σ|Δsemitones| between prev and candidate (matched by slot)
  //      + 4*(#slots where 3rd < MIDI 52) + 3*(adjacent-semitone clusters in MID) + 2*(top-voice leap > 5)
  // return argmin; keep TOP VOICE as common tone when possible ("pivot note")
}
```

A *common-tone top voice* is one held high note, such as E5 sustained over Am–F–C–Em. It's the signature of this genre's "glassy" pads [I].

### 2.8 When to change chords [I]

- **Harmonic rhythm gene**: 1, 2, 4, 8 or 16 bars per chord, weighted 0.05/0.2/0.45/0.2/0.1.
- **Builds accelerate** harmonic rhythm (8 → 4 → 2 bars in the final 8 bars before a peak), and **breakdowns decelerate** it (one chord or a pedal for 16 bars). EDMProd lists "holding the last chord (often the dominant) through a build" and "repeating the dominant under a build-up" as tension devices [S EDMProd-tension].
- Change chords **on the downbeat of a 2- or 4-bar group**, never mid-bar, except for one "anticipation" push of an 8th note before the bar at peaks.
- **Deceptive moves** at phrase ends (to VI instead of i) [S EDMProd-tension] count against the surprise budget.

---

## 3. Melody and motif

### 3.1 Making a memorable motif (3–7 notes) [I, informed by GenJam and Music Transformer]

Generate **rhythm first**, then contour, then pitches:

```
1. Length L ∈ {3,4,5,6,7}, weights {.15,.3,.25,.2,.1}
2. Rhythm: choose onsets on a 1- or 2-bar 16th grid from a "rhythm cell" library
   (e.g. dotted-8th chains 3+3+2, tresillo E(3,8), long-short-short). At least one note ≥ a quarter note.
3. Contour class: arch (↑↓), valley (↓↑), descending, ascending, zig-zag(↑↓↑). Range 4–9 semitones.
4. Pitches from a PENTATONIC subset of the mode (removes clashing half-steps), e.g. Aeolian → 1 b3 4 5 b7;
   allow ONE colour tone (2, 6 or the mode's characteristic note) per motif.
5. Exactly one leap (≥ 4th) and fill it stepwise in the opposite direction.
6. End note: "question" motifs end on 2, 4 or 5; "answer" motifs end on 1 or b3.
7. Score candidates; keep the best of ~50:
   + rhythmic distinctiveness (not all equal durations)   + one repeated pitch (anchors memory)
   + fits chord tones on strong beats                     − more than 2 consecutive equal intervals
   − range > 12                                            − ends on a non-chord tone over the final chord
```

### 3.2 Development operators [S GenJam for the operator list; I for weights]

GenJam put "most of [its] knowledge of melodic development" into its mutation operators: transposition, rotation, sorting, inversion, retrograde, retrograde-inversion, sequencing, and combining good measures [S GenJam2000]. Use them as **variation operators with a "distance" cost**:

| Operator | Cost (perceived change) | When |
|---|---|---|
| exact repeat | 0 | default within 4-bar phrase |
| change last note (answer) | 1 | 2nd half of a phrase |
| diatonic sequence (transpose by step to fit the new chord) | 1 | chord changes |
| octave displacement of one note | 1 | energy rising |
| rhythmic displacement by an 8th/16th | 2 | groove sections |
| add passing note / drop a note | 2 | density change |
| augmentation (×2 durations) | 2 | breakdowns |
| diminution (×½) | 2 | builds |
| inversion | 3 | second half of the piece |
| retrograde | 4 | rarely; climax/coda |
| fragment (first 2–3 notes only, repeated) | 2 | builds |

Variation budget per section is about E(t) × 4 cost points per 8 bars [I]. Higher energy allows more variation.

### 3.3 Phrase grammar: call and response [I]

Use 8-bar "sentence" form: **A (2 bars) A′ (2) B (4)**, or the 4+4 "period" **Q (ends on 5) / A (ends on 1)**. For a lead over a chord loop:

```
bars 1-2: motif M                (call)
bars 3-4: M with last note changed (response)
bars 5-6: sequence(M, +step)      (development)
bars 7-8: fragment(M) ×2 → cadence note (resolution) / or rest (space)
```

Rests matter. In this genre, the lead plays only about 40–60% of bars. Silence is part of the phrase [I].

### 3.4 Arpeggios as melody: the Cooper/Hopkins/Rival Consoles engine [I, with sourced examples]

The genre's "melody" is often an **arpeggiator pattern whose pitches come from the current chord**. The tune emerges as the chords change underneath a fixed rhythmic and ordinal pattern. Rival Consoles' tracks are described as "many simple elements combine to form a … complex and rhythmically propulsive end result" [S RivalConsoles-Ableton].

```
pattern  = ordinal indices into the voiced chord, e.g. [0,2,1,3,2,4]   (length 6)
rhythm   = 16ths, length 16 → a 6-note ordinal pattern over 16 steps cycles every 3 bars (lcm 48)
gates    = per-step probability mask (Turing-machine style, see 3.6)
pitch    = voicedChord[pattern[i % 6]] + octaveOffset(i)
```

Because 6 and 16 are not multiples, the accents shift each bar and the phrase lasts 3 bars. That's audible structure from one parameter. Good ordinal lengths over a 16-grid are 3, 5, 6, 7 and 12 [I].

### 3.5 Phasing and coprime loops [S for examples; I for numbers]

- **Reich *Piano Phase***: a 12-note pattern using only **5 pitch classes** (E4 F#4 B4 C#5 D5 F#4 E4 C#5 B4 F#4 D5 C#5). Two players start in unison, and one gradually speeds up until they lock again one note apart. The piece then reduces to 8-note and 4-note patterns [S PianoPhase-wiki].
- **Eno *Music for Airports***: loops of one sung note each, of lengths around 23½, 25⅞ and 29 15/16 seconds, which are "incommensurable" and "not likely to come back into sync" [S Eno1996, ReverbMachine-MfA]. *Discreet Music* used 63 s and 68 s loops [S ReverbMachine-MfA].
- **Max Cooper, "My Mind Is Slipping"**: a **six-note chord where each note repeats at a slightly different tempo**, so they drift into emergent rhythms and melodies. He built it by editing thousands of MIDI notes by hand [S Cooper-Ableton]. In code, this is ten lines.
- **Terry Riley, *In C***: 53 short cells. Each player repeats a cell as often as they like and stays within a few cells of the others [S Teropa-loop].

Implementations:

```js
// A. Cooper "drifting chord": each voice k loops one note with period p_k = base * (1 + k*δ), δ ≈ 0.004–0.02
voices.forEach((v,k)=> v.period = beat * (1 + k*0.0125));     // re-aligns after ~80 beats for k=1
// B. Eno incommensurable loops: periods in seconds from a set of non-integer-ratio values
const periods = [17.3, 19.6, 20.1, 23.5, 25.875, 29.94, 31.7]; // one note each, long attack/release
// C. Step-based coprime polymeter: lengths 5,7,9,11,13 steps over a 16-step bar
// D. Reich phase: layer B plays the same pattern at tempo*(1+ε), ε chosen so a 1-step offset accrues over N bars:
//     ε = 1/(patternLen * N)   e.g. patternLen 12, N = 8 bars of 12 → ε ≈ 0.0104; then HOLD at the new offset 4–8 bars
// E. "In C" cell queue: K voices each step through a shared list of 20–50 cells,
//     advancing with prob p per repeat, constrained |cell_i − cell_j| ≤ 3.
```

Reich's real phasing alternates **drift** sections with **locked** sections at each new offset. Implement it as drift → hold → drift. A continuous drift smears the result [I, consistent with the score structure described in S PianoPhase-wiki].

### 3.6 Controlled-mutation loops (Turing Machine / Marbles) [S]

- **Turing Machine**: a shift register of length 2–16 holds a looped sequence. A big knob sets the probability that each step is *replaced* as it comes round. Fully clockwise locks the loop, 12 o'clock is fully random, and in between the loop "slips", evolving one note at a time. Fully anticlockwise locks it at double length [S TuringMachine-SOS].
- **Marbles "Déjà vu"**: a central position replays stored random decisions, so the loop repeats. Turning away mixes in fresh values. A Length control sets 1–16 steps, and "Steps/Spread/Bias" shape the pitch distribution and quantise to a scale [S Marbles-SOS].

This is exactly the control that was missing: **one knob from "frozen motif" to "free improvisation"**, where every intermediate setting keeps *some* identity. Use it for arps, percussion and secondary melodies, but **never for the main motif**, which only changes through the operators in 3.2 [I].

```js
function turingStep(reg, pFlip, rng, newValueFn){
  const v = reg.shift();                     // oldest step
  reg.push(rng() < pFlip ? newValueFn() : v);// replace with prob pFlip, else recycle
  return reg[reg.length-1];
}
// Motion/Chaos macro → pFlip: 0 (locked) … 0.05 (slow slip) … 0.5 (random)
```

---

## 4. Rhythm

### 4.1 Swing, in exact numbers [S Attack-swing]

Under the MPC, Linn and Logic convention, **50% = straight** and **66.6% = triplet**. Logic's vintage 16th presets are 16A 50, 16B 54, 16C 58, 16D 62, 16E 66 and 16F 71%. **About 4% steps are the smallest practical audible difference.** FL/Cubase "0–100%" maps to roughly 50 + x/6. The swing delays the even-numbered 16ths.

```js
// swing s in [0.50, 0.71]; stepDur = 16th duration
const offset = (stepIndex % 2 === 1) ? (s - 0.5) * 2 * stepDur : 0;
```

Genre defaults [I]:
| Style | Swing on 16ths | Applied to |
|---|---|---|
| Melodic techno (Afterlife-style) | 50–54% | hats/perc only; kick and bass straight |
| Kiasmos / minimal | 52–56% | shakers, hats |
| Breakbeat / Bicep-style | 54–58% | hats, ghost snares |
| Broken beat / 2-step | 58–64% | everything except kick |
| Half-time cinematic | 54–60% | hats, perc |
| Ambient pulse | 50% (straight) + slow tempo drift | — |

### 4.2 Syncopation dose

Medium syncopation maximises groove and pleasure [S Witek2014]. Rule: the **main kick and clap stay on the grid** (low syncopation), **one or two layers carry syncopation** (perc, bass), and the total syncopation index should sit in a middle band. With a Longuet-Higgins-Lee-style weight per off-beat onset, target 0.25–0.5 of max for dance sections and 0.1–0.25 for ambient [I].

### 4.3 Groove templates (16-step grids, one bar of 4/4)

`x` = hit, `o` = accent, `g` = ghost (velocity 20–40%), `.` = rest. Tempos marked [S] come from the listed sources; the rest are [I].

**G1. Melodic techno, four-on-the-floor (122–125 BPM [S Beatportal])**
```
step     1 . . . 5 . . . 9 . . .13 . . .
KICK     o . . . o . . . o . . . o . . .
CLAP     . . . . o . . . . . . . o . . .     (2 & 4 [S Beatportal])
CH       . . x . . . x . . . x . . . x .     (offbeat 8ths) + 16th rolling layer at 30% vel
OH       . . o . . . . . . . o . . . . .     (every 2 bars variant [S Beatportal])
PERC     . . . g . x . . . g . . . x . g     (shuffled)
BASS     . x x . . x x . . x x . . x x .     (rolling off-beat 16ths, sidechained [S Beatportal])
```

**G2. Breakbeat / Bicep-style (128 BPM [S Bicep-Attack])**: kick on step 1 and step 7, kick removed in bar 3 of 4 for tension, layered snares with lower-velocity ghost notes, woodblock in place of hats, a two-note conga figure every bar [S Bicep-Attack].
```
KICK     o . . . . . x . . . . . . . . .   (bar 3: no kick)
SNARE    . . . . o . . g . . . . o . g .
GHOSTS   . . g . . . . . . g . . . . . g
WOOD     x . x x . x . x x . x . x x . x   (varied velocity)
CONGA    . . . . . . . . . . x . . x . .
```

**G3. Broken beat / 2-step (130–136 BPM)**
```
KICK     o . . . . . . . . . x . . . . .   (or step 1 & 11 & 14)
SNARE    . . . . o . . . . . . . o . . .
HATS     x . x . x . x . x . x . x . x .   swing 60%
GHOST SN . . . g . . . . . g . . . . . g
```

**G4. Half-time cinematic (Hopkins/Rival Consoles feel), 140–170 BPM grid felt at 70–85**
```
KICK     o . . . . . . . . . x . . . . .
SNARE    . . . . . . . . o . . . . . . .   (beat 3 only)
HATS     x x x x x x x x x x x x x x x x   16ths, velocity contour, ratchets at bar 4
SUB      long notes, glide
```

**G5. Ambient pulse (no kick, 60–90 BPM)**: a constant 8th-note pulse on a mallet, pluck or piano, as in Reich's *Music for 18 Musicians*, where an 8th-note pulse runs throughout [S Reich18-wiki]. Add a shaker on 16ths at velocity 15–30% with slow LFO amplitude, and occasional low "heartbeat" thumps on beats 1 and 3, filtered below 120 Hz.

**G6. Kiasmos minimal**: ~124–128 BPM dark minimal techno roots [S Kiasmos-MusicRadar]. Use a pitched-down, EQ'd 909-type kick [S Kiasmos-MusicRadar], a hand-played shaker loop (strong humanisation), and a muted clap at low level.

### 4.4 Ghost notes, fills, probability, ratchets [S EDMProd-tension for fills; I for numbers]

- **Ghost notes**: velocity 0.2–0.4 of the accent, placed on the 16th *before* a main hit (steps 4, 12, 15, 16) and filtered darker.
- **Phrase-end fills (≤ 1 bar)**: remove one or more kicks at the end of a phrase, add ghost kicks leading into the next phrase, use short two-hit snare rolls, and hit a crash at phrase start [S EDMProd-tension]. Schedule them at 8-bar boundaries (minor) and 16-bar boundaries (major).
- **Step probability**: every non-core step carries p ∈ [0,1]. Strudel's `?0.1` "degrade" is the same idea: a random 10% removal chance [S Strudel-mini]. Core steps (kick and clap) are fixed at p=1.
- **Ratchets**: repeat a hit 2, 3 or 4 times within its step, with decaying velocity (1, .7, .5, .35). Apply to hats and perc at bar 4 of 4 with probability 0.15 × Energy.
- **Euclidean layers**: E(3,8) tresillo, E(5,8) cinquillo, E(5,16) bossa nova, E(7,16) samba, E(7,12) West African bell, E(9,16) samba cowbell [S Toussaint]. These are excellent **secondary percussion** layers. Using Euclid for the *main* groove was one cause of "same-sounding" output, because every Euclid pattern has the same maximally even feel [I].
- **Polymeter**: perc loops of 5, 6, 7 or 12 steps against the 16-step bar (the Turing Machine offers lengths 2, 3, 4, 5, 6, 8, 12 and 16 [S TuringMachine-SOS]). Strudel/Tidal mini-notation provides `<>` alternation per cycle, `[]` subdivision, `!` replicate, `@` elongation, `(3,8)` Euclid and `|` random choice [S Strudel-mini]. That's a good *internal representation* for pattern variants.

### 4.5 Humanisation that helps vs hurts

- **Helps**: correlated (1/f-like, long-range) timing deviations. Hennig et al. found listeners **strongly prefer long-range correlated fluctuations** over the uncorrelated random jitter of DAW "humanize" features [S Hennig-CDM]. GrooVAE treats groove as **velocity + microtiming** relative to the grid, learned from 13.6 h of professional drumming [S GrooVAE].
- **Hurts** [I]: jitter on the kick and bass (it smears the sidechain pump and the low end), uncorrelated random velocity on everything, and jitter above about 15 ms at 120+ BPM.

```js
// correlated microtiming: sum of 3 random walks at different rates (Voss-McCartney 1/f-ish)
let w=[0,0,0]; function microtime(step){ if(step%1==0) w[0]+=gauss()*0.6; if(step%4==0) w[1]+=gauss()*0.4;
  if(step%16==0) w[2]+=gauss()*0.3; w=w.map(x=>x*0.97); return clamp((w[0]+w[1]+w[2]), -1, 1); }
// ms offset per instrument:   kick 0, bass 0, clap ±2, hats ±6, shaker ±10, perc ±8   [I]
// velocity: accent template (e.g. hats 1.0 .55 .8 .5 per 4 steps) × (1 + 0.08*gauss())
```

---

## 5. Form: arrangement timelines

At 124 BPM, 1 bar is about 1.94 s, so **6:12 ≈ 192 bars**. At 120 BPM, 1 bar = 2.0 s. All timelines are [I] unless noted. They synthesise Beatportal's melodic-techno structure [S Beatportal] (intro, build, drop, 16-bar pads-and-FX breakdown, climax) with EDMProd's tension devices [S EDMProd-tension] and the process/ambient practice above. E = energy 0–1; LP = master lowpass on the "music bus" (pads, arps, lead).

### 5.1 Template F1: Slow-build crescendo (Hopkins "Emerald Rush" / Cooper style), 192 bars ≈ 6:12 @124

| Bars | Section | Layers in | E | LP cutoff | Harmony |
|---|---|---|---|---|---|
| 1–16 | Seed | pad (pedal, 1 chord), texture/noise | .10 | 600 Hz | pedal only |
| 17–32 | Pulse | + arp (locked Turing, p=0), + soft kick (HP 80 Hz) | .20 | 900 Hz | 2-chord oscillation (8-bar) |
| 33–48 | Groove in | full kick, + hats, + sub (pedal) | .35 | 1.4 kHz | 4-bar chords |
| 49–64 | Motif | + lead motif M (call/response) | .45 | 2 kHz | same loop |
| 65–80 | Thicken | + perc polymeter, arp p=.04 (slip), + 2nd pad octave | .55 | 3 kHz | pedal **breaks** (bass follows chords) |
| 81–96 | Peak 1 | + clap, motif sequenced, wider stereo | .65 | 5 kHz | H6 chromatic shift at bar 81 (event) |
| 97–112 | Drift | remove kick 4 bars (97–100), reverb +6 dB, arp augments | .50 | 2.5 kHz | slow (8-bar) |
| 113–144 | **Long build** | kick returns; every 8 bars add one: ratchets → noise riser → octave lead → saturation; HP sweep on drums last 4 bars | .55→.90 | 2.5→12 kHz (exponential) | harmonic rhythm 8→4→2 |
| 145 | — | 1 beat of silence / filtered tail [S EDMProd-tension] | — | — | — |
| 145–176 | **Climax** | everything, motif inverted + octave, Lydian lift (#4 colour) | .95–1.0 | open | 4-bar loop, mode lift |
| 177–192 | Dissolve | remove drums in 4-bar steps, pad + motif fragment remain | 1.0→.15 | 12k→800 | back to pedal |

### 5.2 Template F2: Two-peak melodic techno (club form), 192 bars

| Bars | Section | Notes | E |
|---|---|---|---|
| 1–16 | DJ intro | kick + hats + perc, no harmony; LP closed | .35 |
| 17–32 | Build A | + bass (root 16ths, sidechained), + pad filtered | .45 |
| 33–48 | Groove A | + arp (main hook as arp) | .60 |
| 49–64 | Pre-break | remove kick at bar 61; riser 8 bars | .65 |
| 65–80 | **Breakdown 1** (16 bars, pads + FX only [S Beatportal]) | motif on piano/pluck, harmony shows its "signature move"; tempo-free feel | .30 |
| 81–88 | Build 1 | snare roll 16ths → 32nds, pitch riser, HP master 30→175 Hz [S EDMProd-tension] | .30→.85 |
| 89–120 | **Drop 1** | full; lead + arp + bass | .90 |
| 121–136 | Groove B | lead out, new perc pattern, arp mutates (p=.06) | .70 |
| 137–152 | **Breakdown 2** (shorter or bigger) | new chord colour (borrowed IV / P move), lead in augmentation | .35 |
| 153–160 | Build 2 | as above + harmonic rhythm acceleration | .40→.95 |
| 161–184 | **Drop 2 / Climax** | everything + extra automation [S Beatportal]; motif octave up | 1.0 |
| 185–192 | Outro | strip to kick + hats for mixability | .40 |

### 5.3 Template F3: Ambient bloom (Eno/Kiasmos-ambient), 72 BPM, ~6 min ≈ 108 bars

| Bars | Event | Detail |
|---|---|---|
| 1–12 | Ground | drone (root + 5th), noise bed, very long reverb |
| 13–24 | Loops enter | Eno-style incommensurable single-note loops, one every 3 bars (periods 17–31 s) |
| 25–48 | Bloom | piano motif (sparse, rubato ±30 ms correlated); pad gains add9 |
| 49–60 | Shift | NR move (R or L) every 6 bars; loops re-pitched to new chord tones on their *next* cycle |
| 61–84 | Swell | strings/pad crescendo (Kiasmos uses strings mainly as pads [S Kiasmos-MusicRadar]); brightness ↑; optional heartbeat pulse |
| 85–108 | Recede | layers drop on loop-ends; finish on the drone |

There are no drums. Energy is carried entirely by **loudness, register and brightness**, the strongest tension features per Farbood [S Farbood2012].

### 5.4 Template F4: Reich process piece, 132 BPM 8th pulse, ~7 min ≈ 230 bars

```
Pulse layer (marimba/pluck 8ths) constant throughout.
Chord cycle of 4–6 chords (H8). Each chord = one "section" of 32–48 bars.
Within each section:
  bars 1–8   pattern P (12-step, 5 pitch classes from chord+mode) in unison, 2 voices
  bars 9–16  voice B drifts +1 step (ε = 1/(12*8))
  bars 17–24 hold at offset 1 → resultant pattern audible; add 3rd voice doubling a "resultant" sub-pattern
  bars 25–32 drift to offset 2 / or additive process (add notes to P one per 2 bars)
  last 4 bars: bass clarinet-like swell (Reich's breath-length swells) cues next chord
Form: ABCDCBA-style return (18 Musicians is ABCDCBA [S Reich18-wiki]) — end on the opening chord.
```

### 5.5 Template F5: Half-time cinematic (Rival Consoles), 85/170 BPM, ~5 min

Intro of pulsing analogue arp with 16-bar filter opening; half-time drums at bar 17; detuned lead motif enters at 33; at 65 the drums go double-time while the harmony stays (a "same chords, new energy" contrast); 97 is a breakdown with the arp alone, stereo-panned (Auto Pan) [S RivalConsoles-Ableton tags]; 113–144 is the climax with saturation; then the outro.

### 5.6 Breakdown design checklist [I + S EDMProd-tension]

1. Remove kick and sub, *or* high-pass the kick instead of removing it.
2. Keep the motif, moved to a new timbre (piano, pluck, choir) and/or augmented.
3. Reveal the **harmonic signature**: the borrowed chord, P move or chromatic mediant. A breakdown is where harmony becomes foreground.
4. Raise reverb send 3–6 dB and widen the stereo image. Space stands in for energy.
5. Last 8 bars: riser (noise + pitched), snare roll with pitch automation, HP sweep, hold the last chord [S EDMProd-tension].
6. Optional 1 beat to 1 bar of silence before the drop [S EDMProd-tension]. Cost: 2 surprise-budget points.

### 5.7 Infinite live stream: keeping it fresh

A **journey planner** sits above the form:

```
Journey = sequence of Chapters (each 4–8 min, one genome "region")
Chapter transition (16–32 bars):
   - crossfade genomes gene-by-gene on a schedule: timbre genes first, then drums, then harmony
   - key change only via a pivot: shared common tones, an NR move (R/L), or a pedal-held transition
   - tempo change ≤ 4% per 16 bars, or switch to half/double-time feel (no tempo change)
Within a chapter: a section state machine
```

```js
const SECTION_GRAPH = {
  intro:     {groove:.7, ambient:.3},
  groove:    {motif:.5, thicken:.3, breakdown:.2},
  motif:     {thicken:.5, breakdown:.3, groove:.2},
  thicken:   {build:.6, breakdown:.4},
  breakdown: {build:.8, ambient:.2},
  build:     {peak:1},
  peak:      {release:.6, groove:.4},
  release:   {groove:.4, breakdown:.3, chapterEnd:.3},
  ambient:   {groove:.5, breakdown:.5},
};
// Transition probabilities are *biased by the target energy curve* of the journey:
// p'(s→s') ∝ p(s→s') * exp(-|E(s') - E_target(t+Δ)| / 0.15)
```

**Freshness guards:**
- **Habituation counters** per element (motif, chord loop, patch, drum pattern). Use the novelty-recovery model from the NUS bandit study, U_n = 1 − e^(−t/s), where novelty drops immediately after hearing and recovers over time [S Bandit-NUS]. An element can be reused only when U_n > 0.7 [I].
- **"No sound twice" drift**: every 32 bars, patch parameters random-walk within ±10% of their family centre (after Cooper's principle [S Cooper-Ableton]).
- **Energy macro-arc**: over a 30–60 min session, alternate higher and lower chapters, e.g. 0.4 → 0.7 → 0.5 → 0.9 → 0.3. Never more than two high chapters in a row [I].
- **Motif inheritance**: the next chapter's motif is a *mutation* of the previous one (3.2 operators with cost ≥ 4), which gives continuity like a DJ set, or a fresh motif every 2–3 chapters.

---

## 6. Making generations different: the genome

### 6.1 Which parameters matter most perceptually [I, ranked]

Two pieces sound "different" mainly through: **(1) tempo and pulse feel** (half-time/straight/no-kick), **(2) timbre family** (analogue warm / glassy digital / acoustic piano-strings / gritty distorted), **(3) drum family and groove template**, **(4) density and energy profile**, **(5) mode and harmonic language**, **(6) form template**, **(7) harmonic rhythm**, **(8) space** (reverb size, dry vs wet), **(9) motif rhythm**. Exact pitch content is almost irrelevant to perceived difference for non-musicians. That's why the old seeds all sounded the same. This ranking is consistent with Farbood's finding that loudness and pitch height dominate, while harmony matters mostly to musicians [S Farbood2012]. In DarwinTunes, measured "chordal clarity" and "rhythmic complexity" explained only about 4.2% of the increase in appeal [S DarwinTunes]: most of what listeners respond to lies outside simple note statistics.

### 6.2 Genome definition

Categorical "archetype" genes come first, because they make the big differences. Continuous genes follow.

```ts
type Genome = {
  // ── archetype (categorical; large perceptual distance)
  form:        'crescendo'|'twoPeak'|'bloom'|'reichProcess'|'halfTimeCinematic';  // §5
  pulse:       'fourFloor'|'breakbeat'|'broken'|'halfTime'|'ambientPulse'|'none';  // §4.3
  timbre:      'analogWarm'|'glassDigital'|'pianoStrings'|'gritDistort'|'bellMallet';
  harmonyFam:  'H1'|'H2'|'H3'|'H4'|'H5'|'H7'|'H8'|'H9';                             // §2.5
  mode:        'lydian'|'ionian'|'mixolydian'|'dorian'|'aeolian'|'phrygian';
  melodyRole:  'leadMotif'|'arpAsMelody'|'phasedLoops'|'noMelody';                  // Hopkins' Open Eye Signal carries 8 min with no melody [S Hopkins-Spin]
  // ── continuous (0..1 unless noted)
  tempo:       number;   // BPM 68–136 (category-constrained: ambient 60–90, halfTime 140–174 grid)
  key:         number;   // 0–11 (low perceptual weight, but use for chapter continuity)
  harmonicRhythm: 1|2|4|8|16;   // bars per chord
  density:     number;   // base events/bar scaling
  syncopation: number;   // target band (§4.2)
  swing:       number;   // 0.50–0.66
  brightness:  number;   // base LP cutoff & patch brightness
  space:       number;   // reverb size/send, stereo width
  grit:        number;   // saturation, bitcrush
  motifLen:    3|4|5|6|7;
  motifContour:'arch'|'valley'|'desc'|'asc'|'zigzag';
  phaseAmount: number;   // drift δ for phased layers
  mutationRate:number;   // Turing pFlip baseline
  peakCount:   1|2|3;
  peakPosition:number;   // 0.55–0.85 of duration
  breakdownDepth:number; // how much is removed
  surpriseBudget:number; // events per 32 bars
  pedalAmount: number;   // probability a section is pedal-based
  voicingSpread:number;  // close → very open
  humanize:    number;
  seed:        number;   // note-level randomness only
};
```

Validity constraints, tested before rendering: `pulse=='none'` requires `form ∈ {bloom, reichProcess}` or a pulse-less arp; `mode=='lydian'` forbids `harmonyFam=='H9'`; `tempo` is constrained per pulse; `timbre=='pianoStrings'` biases toward `space > .5` [I].

### 6.3 Perceptual distance and diversity

```js
const W = { form:3, pulse:4, timbre:4, harmonyFam:2, mode:2, melodyRole:2,   // categorical: 0 or W if different
            tempo:3 /*per 15% diff*/, density:2, brightness:2, space:1.5, grit:1.5,
            swing:1, harmonicRhythm:1, syncopation:1, voicingSpread:1, phaseAmount:1 };
function dist(a,b){ let d=0;
  for (k of CATEG) d += (a[k]!==b[k]) ? W[k] : 0;
  d += W.tempo * Math.min(1, Math.abs(Math.log(a.tempo/b.tempo))/Math.log(1.15));
  for (k of CONT) d += W[k] * Math.abs(a[k]-b[k]);
  return d; }
```

**Diversity guarantees:**
1. **Minimum-distance rejection**: a new genome must satisfy `dist(g, h) ≥ D_min`, with D_min ≈ 6, against each of the last N=5 played pieces. Sample up to 200 candidates and keep the one with the best (taste score + λ·novelty).
2. **Novelty search**: Lehman & Stanley score individuals by distance to their k nearest neighbours in a *behaviour space* plus an archive of past behaviours, instead of by an objective [S NoveltySearch]. Here "behaviour" = rendered audio descriptors (tempo, mean spectral centroid, onset density, low-end energy, dynamic range, chord-change rate). Novelty(g) = mean distance to its k=10 nearest neighbours in the archive of everything played.
3. **MAP-Elites map**: MAP-Elites keeps the best-performing solution in each cell of a grid over user-chosen descriptors, giving "a holistic view of how high-performing solutions are distributed" [S MAP-Elites]. Use a 2-D or 3-D grid such as **Energy (low/mid/high) × Brightness (dark/neutral/bright) × Pulse family (6)**, giving 54 cells. Keep the best-liked genome per cell. "Surprise me" samples an *under-explored* cell, and "more like this" samples near the elite of the current cell. This turns "every generation sounds the same" into a visible map of different regions.
4. **Measure it**: log descriptor vectors of rendered pieces and track the mean pairwise distance of the last 20 pieces. If it falls below a threshold, raise λ (exploration).

---

## 7. An "AI" that learns taste from few ratings

### 7.1 What the literature says

- **Interactive GAs hit a "fitness bottleneck"**: the human is the only fitness function, and evaluating music takes real time [S GenJam2000]. GenJam leaned on *knowledge-rich mutation operators* so that each human evaluation counted for more [S GenJam2000].
- **User fatigue**: typical IEC sessions last only **10–20 generations** [S NA-IEC].
- **Novelty-assisted IEC** offloads exploration. The user picks promising candidates, and novelty search generates diverse stepping stones in the background. Users made about **30 choices per run** while the system ran thousands of evaluations, and the hybrid beat both pure novelty and fitness search [S NA-IEC]. Picbreeder showed collaborative, branch-from-anyone's-favourite evolution of images [S Picbreeder].
- **DarwinTunes**: 100 loops of 8 s, rated 1–5, with about 6,931 listeners and 85,533 ratings over 2,513 generations. Appeal rose quickly for 500–600 generations, then plateaued [S DarwinTunes]. **Lesson [I]: raw evolution needs thousands of ratings, which one user will never give. You need a model with strong priors plus a structured genome.**
- **Bayesian bandits for music** (NUS): a linear taste model over content features combined with a novelty-recovery term, U = (θᵀx) × (1 − e^(−t/s)), chosen by Bayes-UCB. It beat greedy from about the 45th recommendation, with the biggest gains in the cold-start stage (first ~100) [S Bandit-NUS].
- **Gaussian process preference learning** handles pairwise "A is better than B" judgements (Chu & Ghahramani, 2005) [S ChuGhahramani]. It's implemented as `PairwiseGP` in BoTorch [S BoTorch-PairwiseGP], and preferential Bayesian optimisation builds on it [S PrefBO].

### 7.2 Recommended design: a three-layer taste model [I]

**Layer A. Thompson sampling over archetype genes** (handles the categorical genes that matter most and learns in about 10–20 ratings).

```js
// Beta posterior per (gene, value): α=1+likes, β=1+dislikes (+ implicit signals as fractional counts)
const post = { pulse: {fourFloor:[1,1], breakbeat:[1,1], ...}, timbre:{...}, form:{...}, mode:{...}, ... };
function sampleArchetype(){
  const g = {};
  for (const gene in post){
    let best=-1, arg;
    for (const v in post[gene]){ const [a,b]=post[gene][v]; const s = betaSample(a,b); if (s>best){best=s; arg=v;} }
    g[gene]=arg;
  }
  return repairConstraints(g);
}
function update(genome, reward /* 0..1 */){
  for (const gene in post){ const p = post[gene][genome[gene]]; p[0]+=reward; p[1]+=1-reward; }
  // optional decay so taste can drift: multiply all α,β by 0.98 per session, floor at 1
}
```

Independent per-gene bandits ignore interactions; for example, someone might like breakbeat *only* with pianoStrings. Add **pairwise interaction arms** for the two or three most important pairs, such as (pulse × timbre) with 30 arms, once there are more than about 30 ratings.

**Layer B. Bayesian linear / GP model over continuous genes and audio descriptors.**
- Features x = [continuous genes, rendered descriptors (centroid, onset density, low-end ratio, chord-change rate, reverb wetness), one-hot archetypes].
- Start with **Bayesian linear regression**, which is closed-form, fast in JS, and directly gives Thompson samples (sample θ ~ N(μ, Σ) and score candidates θᵀx). This is the NUS model minus MCMC [S Bandit-NUS → I].
- After about 40 ratings, optionally switch to a **GP with an RBF kernel** on the 8–12 most important dims. For "Which do you prefer?" duels, use a **pairwise GP** (Laplace approximation, as in Chu & Ghahramani [S ChuGhahramani]). Pairwise judgements are more reliable than absolute scores and less tiring.

**Layer C. Novelty and habituation multiplier** (prevents the "AI" from converging on one piece):

```
score(g) = TS_sample_taste(g) * (1 - exp(-t_since_similar(g)/s)) + λ * novelty(g)
λ starts 0.5, decays to 0.15 as ratings accumulate; never 0 ("exploration floor")
```

**Generation loop:**

```js
function nextGenome(){
  const arche = sampleArchetype();                          // Layer A
  const cands = range(150).map(()=> mutateContinuous(arche, rng));  // fill continuous genes
  for (c of cands) c.score = taste.sample(c) * habituation(c) + λ*novelty(c);  // B + C
  const pick = argmax(cands.filter(c => minDistToRecent(c) >= D_MIN));
  return pick;
}
```

### 7.3 Signals: explicit and implicit [I]

| Signal | Reward | Notes |
|---|---|---|
| ♥ Like | 1.0 | also tag the *current section* (likes during a breakdown → breakdown genes) |
| ✕ Skip within 20 s | 0.0 | strong negative on archetype genes |
| Skip after 2+ min | 0.35 | mild: "liked it but done" |
| Listened to end | 0.7 | |
| "More like this" | 0.9 + spawn neighbour | |
| Replay / save | 1.0 | |
| Macro moves | — | if the user pushes Brightness from .4 to .8 and leaves it, shift the brightness prior: μ ← 0.8μ + 0.2·0.8 |
| A/B duel | pairwise | feed the pairwise GP |

### 7.4 UI patterns [I, after Picbreeder and NA-IEC]

- **♥ / ✕** always visible, one tap.
- **More like this**: mutate the current genome with small σ (continuous genes ±0.1, at most one categorical change).
- **Surprise me**: pick an under-explored MAP-Elites cell or the highest-novelty candidate. Label it honestly ("exploring").
- **Mutate [amount]**: a slider from 0 (tiny) to 1 (re-roll archetypes), applied **live** through a 16–32 bar crossfade (§5.7), so mutation is heard as a transition rather than a restart.
- **Breed**: pick two favourites and cross over. Archetype genes come from one parent and continuous genes are blended at a random α ∈ [.3, .7]. This is Picbreeder-style branching [S Picbreeder].
- **Duel mode**: alternate 30 s of A and B, then ask "which?". It's the most information-efficient input.
- **"What I've learned" panel**: "You like: Dorian & Aeolian, 118–126 BPM, broken beats, warm analogue, long breakdowns. You skip: Phrygian, gritty." Generate it from posterior means with confidence bars. Making the model visible is what makes the "AI" credible, and lets the user correct it [I].
- **Journey presets** as priors, not hard modes: "Night drive", "Focus", "Sunrise", "Peak time". Each is a prior over archetypes and an energy arc.

---

## 8. Macro controls that audibly matter

### 8.1 Design rules [I]

1. **Every control moves 4–8 parameters across at least 2 domains** (timbre/mix plus notes/structure). That makes every turn audible.
2. **Continuous plus threshold**: each control has a continuous part (filter, levels) applied instantly with 50–200 ms smoothing, and a **zoned discrete part**, usually 5 zones, that adds or removes layers and patterns at the **next bar or phrase boundary**.
3. **Visible feedback**: show which zone you're in and what just changed ("+ hats", "+ ratchets").
4. **Controls are offsets on the form plan's curves**, not replacements: `E_eff(t) = clamp(E_plan(t) + 0.6*(Energy-0.5)*2)`. The piece still breathes when the knob is fixed.
5. Use perceptual curves: exponential for cutoff (200 Hz → 16 kHz), dB-linear for levels.

### 8.2 The controls

| # | Control | Continuous effect (instant) | Discrete zones (bar/phrase quantised) |
|---|---|---|---|
| 1 | **Energy** | master music-bus LP cutoff (exp 400 Hz→14 kHz) · drum-bus level +0→+4 dB · sidechain depth 2→8 dB · hat velocity · saturation drive | Z1 pads only · Z2 + pulse/arp · Z3 + kick, sub · Z4 + hats, perc, clap · Z5 + ratchets, 16th bass, lead octave up, fills every 4 bars |
| 2 | **Tension** | detune/chorus of pads ↑ · noise-riser level · HP on drums · dissonant top note probability · pitch-riser automation | Z1 resolved (i, add9) · Z2 sus chords · Z3 hold one chord, accelerate fills · Z4 pedal + moving upper (clash), snare roll · Z5 dominant/b2 colour, kick removed, riser → *release triggers a drop when lowered quickly* |
| 3 | **Brightness** | LP cutoff of every synth · oscillator wave mix (sine→tri→saw) · reverb HF damping · air-layer level | Z1 sub-octave voicings · Z3 standard · Z5 voicings shift up one octave + bell/air layer + higher motif register |
| 4 | **Space** | reverb send 0→−3 dB · decay 1.2→9 s · pre-delay · delay feedback .1→.55 · stereo width .6→1.4 | Z1 dry & mono-ish, tight short notes · Z3 standard · Z5 drums thinned (only kick + shaker), note durations ×2, pad swells, notes ring through |
| 5 | **Density** | step-probability scale on non-core steps (×0.3→×1.5) · arp rate | Z1 8ths / sparse motif · Z3 16ths · Z5 + polymeter perc layers (5/7-step), 32nd ratchets, extra counter-line |
| 6 | **Mood** (dark ↔ light) | pad formant/filter tilt · tape-saturation tone | moves along the **mode ladder** (§2.2): Phrygian → Aeolian → Dorian → Mixolydian → Ionian → Lydian, *applied at next chord change*, voice-led with common tones; plus chord quality P moves |
| 7 | **Motion** | LFO depth/rate on filters & pans · Auto-Pan [S RivalConsoles tags] · arp gate-length modulation | harmonic rhythm: Z1 pedal/static · Z2 8 bars · Z3 4 · Z4 2 · Z5 NR walk every 2 bars; phase drift δ ×(0→2) |
| 8 | **Chaos / Mutation** | microtiming humanise ±0→12 ms · velocity variance | Turing pFlip: 0 (locked) → .02 → .06 → .15 → .4 on arps/perc [S TuringMachine-SOS]; Z4+ allows motif variation ops with cost ≥3; Z5 glitch stutters/bitcrush [S EDMProd-tension] |
| 9 | **Groove** | swing 50→66% [S Attack-swing] · ghost-note level | template: Z1 straight 4/4 · Z2 Kiasmos shuffle · Z3 breakbeat · Z4 broken/2-step · Z5 half-time |
| 10 | **Weight** (low end) | sub level · kick pitch/decay · bass drive · low-shelf | Z1 no sub, kick HP 120 Hz · Z3 normal · Z5 sub octave doubling, longer kick tail, 808 glide |
| 11 | **Pulse** (tempo feel) | — | ½× feel · 1× · 2× feel (the drum template switches; harmony and tempo unchanged). Real tempo change ±8% via slow 16-bar ramp |
| 12 | **Journey** (evolve rate) | — | how fast the form planner advances: freeze section (hold) · normal · fast (sections ×0.5 length) · "next chapter" button |

### 8.3 Example mapping code (Energy)

```js
function applyEnergy(e /*0..1*/, now){
  const eEff = clamp(plan.E(now) + 1.2*(e-0.5), 0, 1);
  musicBusLP.frequency.setTargetAtTime(400*Math.pow(35, eEff), now, 0.1);      // 400 Hz → 14 kHz
  drumBus.gain.setTargetAtTime(dbToGain(-4 + 4*eEff), now, 0.1);
  sidechain.depthDb = 2 + 6*eEff;
  saturator.drive   = 0.1 + 0.5*eEff*eEff;
  const zone = Math.min(4, Math.floor(eEff*5));                               // 0..4
  scheduler.atNextBar(() => layers.setActive(ENERGY_LAYERS[zone]));           // discrete, audible
  scheduler.atNextPhrase(() => fills.rate = [0, 0, 1/16, 1/8, 1/4][zone]);
}
```

### 8.4 Avoiding "controls that do nothing" [I]

- **Test every control with a "blind A/B at extremes"**: render 8 bars at 0 and at 1. If a non-musician can't tell which is which, add more mappings.
- **Avoid fighting**: when the form plan pushes energy *down* (breakdown) and the user holds Energy high, the breakdown should still happen but *shorter and brighter*. The user's control scales the plan; it doesn't override it.
- **Macro moves are taste data** (§7.3).

---

## 9. Putting it together: engine skeleton [I]

```js
// ---- PIECE INIT
genome   = taste.nextGenome();                                   // §7
form     = FORM_TEMPLATES[genome.form].instantiate(genome);      // §5: sections[], E(t), T(t)
harmony  = HarmonyPlanner(genome).planPiece(form);               // §2: per-section chord loops + signature move
motif    = MotifGen(genome).best(50);                            // §3.1
patches  = TimbreFamily[genome.timbre].roll(seed);               // timbre genes + slow drift
drums    = GrooveTemplates[genome.pulse].instantiate(genome);    // §4

// ---- PER SECTION (called at section boundary)
function enterSection(s){
  layers.target = s.layers;                         // with macro offsets
  chordLoop = harmony.loopFor(s);                   // voice-led (Tymoczko cost)
  motifVariant = develop(motif, s.variationBudget); // GenJam-style operators
  drums.variant = drums.pickVariant(s.energy);      // + fill schedule
  enforceContrast(prevSection, s, 3);               // ≥3 dimensions change (§1.2 R4)
}

// ---- PER BAR / STEP (lookahead scheduler, 100 ms horizon)
function scheduleStep(step, t){
  const E = energyEff(t), T = tensionEff(t);
  drums.emit(step, t, {swing, microtime(step), probScale: density});
  bass.emit(step, chordAt(t), pedal?);
  arp.emit(step, voicedChord, turingReg, pFlip);
  lead.emit(step, phrasePlan, motifVariant);
  phasedLayers.emit(t);                              // Cooper/Eno/Reich drift layers
  automation.update(E, T, macros);                   // filters, sends, drive
}

// ---- FEEDBACK
ui.on('like'|'skip'|'more'|'surprise'|'mutate'|'duel', evt => taste.update(genome, evt, sectionAtTime()));
```

### 9.1 Priorities (biggest audible win first) [I]

1. **Form planner + energy curve driving layers, filter and loudness** (§5, §8.1 Energy). This alone fixes "aimless".
2. **Spread voicings + pedal + slow harmonic rhythm + progression families** (§2). This fixes "cheesy".
3. **Archetype genome with 5–6 timbre families and 6 groove templates** plus minimum-distance sampling (§6). This fixes "same every time".
4. **Persistent motif + development operators + call/response** (§3).
5. **Macro controls with zones** (§8).
6. **Thompson-sampling taste model + "what I learned" panel** (§7). Add pairwise GP and MAP-Elites later.
7. **Phase/process layers** (§3.5) as the "cerebral" signature: cheap to build and strongly characteristic.

### 9.2 What *not* to do [I]

- Don't let a Markov chain choose every chord. Choose a **progression family**, then vary inside it.
- Don't use Euclid or CA for the main kick/clap. Use them only for secondary percussion.
- Don't randomise all parameters every bar. Change **one dimension per 8 bars** within a section.
- Don't humanise the kick and bass.
- Don't mix reverb types. Kiasmos uses **one reverb type per track** [S Kiasmos-MusicRadar], which gives coherence.
- Don't treat neural models (MusicVAE, Music Transformer) as required. They demonstrate the *principles* used here: hierarchical conductors, latent attribute vectors (adding a "note density" vector turns melodies into arpeggios and flourishes [S MusicVAE]), and motif recall [S MusicTransformer]. MusicVAE does have a tensorflow.js browser build with pre-trained models [S MusicVAE], so it's an optional add-on later, for example interpolating between two liked motifs.

---

## Sources

Every URL below was retrieved during this research, either opened directly or seen as a search result and used for a specific claim.

- [Teropa-loop] https://teropa.info/loop/ — Tero Parviainen, "How Generative Music Works": Reich phasing, Eno's 7 loops, *In C* (53 cells), Markov, chance operations, additive rhythm grammar.
- [Eno1996] https://inmotionmagazine.com/eno1.html — Brian Eno, "Generative Music" talk (1996): seeds, probabilistic rules, 23½ s loops, "incommensurable", "a certain level of surprise".
- [Reich-Gradual] https://music.arts.uci.edu/abauer/9.3/readings/Selection_of_writings_by_Steve_Reich.pdf — Reich, "Music as a Gradual Process": perceptible, extremely gradual processes.
- [Reich-Gradual alt] https://sites.nd.edu/choral-lit/files/2018/10/Reich-Music-as-Gradual-Process-II.pdf — alternate copy of the essay (search result).
- [ReverbMachine-MfA] https://reverbmachine.com/blog/deconstructing-brian-eno-music-for-airports/ — Music for Airports 2/1 loop timings (C ≈ 20.1 s, F ≈ 19.6 s), Discreet Music 63/68 s loops.
- [PianoPhase-wiki] https://en.wikipedia.org/wiki/Piano_Phase — the 12-note pattern, 5 pitch classes, 12/8/4-note phase sections.
- [Reich18-wiki] https://en.wikipedia.org/wiki/Music_for_18_Musicians — 11-chord cycle, 11 sections of about 4 min each, ABCDCBA form, 8th-note pulse.
- [MusicVAE] https://magenta.tensorflow.org/music-vae — hierarchical "conductor" decoder, latent interpolation, attribute vectors, tensorflow.js browser models.
- [MusicVAE-paper] https://arxiv.org/pdf/1803.05428 — Roberts et al., hierarchical latent vector model (search result; supports the conductor architecture).
- [MusicTransformer] https://magenta.tensorflow.org/music-transformer — relative attention; motif repetition and variation over long spans.
- [GrooVAE] https://magenta.tensorflow.org/groovae — groove as velocity + microtiming; 13.6 h of professional drumming dataset.
- [Toussaint] https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf — "The Euclidean Algorithm Generates Traditional Musical Rhythms": table of E(k,n) with traditional names.
- [Tymoczko-MTO] https://mtosmt.org/issues/mto.10.16.1/mto.10.16.1.tymoczko.html — "Geometrical Methods in Recent Music Theory": taxicab voice-leading distance.
- [Hooktheory-cinematic] https://www.hooktheory.com/blog/cinematic-chord-progressions/ — neo-Riemannian P/L/R, film examples (Leia I→iv, Binary Sunset, E.T., Interstellar, Man of Steel I→bVI).
- [Hooktheory-minor] https://www.hooktheory.com/blog/minor-chord-progressions/ — minor-key chord frequencies (i 14%, VI 9%, VII 9%, III 6%, iv 5%, v 3%) and common pop minor loops.
- [Farbood2012] https://bpb-us-e1.wpmucdn.com/wp.nyu.edu/dist/f/11865/files/2020/08/Farbood_2012_Musical_Tension.pdf — parametric tension model: feature weights, ~3 s attentional window, trend salience, dynamics and pitch height strongest.
- [Farbood-MIT] https://www.media.mit.edu/publications/a-quantitative-parametric-model-of-musical-tension — abstract listing the tension parameters.
- [Lerdahl-TPS] https://academic.oup.com/book/32497 — Lerdahl, *Tonal Pitch Space* (search result; harmonic-tension component used inside Farbood's model).
- [GenJam2000] https://genjam.org/wp-content/uploads/2019/07/bilesgecco2000.pdf — Biles, GenJam: the fitness bottleneck, musically informed mutation operators, population sizes.
- [NA-IEC] https://arxiv.org/pdf/1207.6682 — Woolley & Stanley, novelty-assisted interactive evolution; user fatigue at 10–20 generations, ~30 user choices per run.
- [Picbreeder] https://stars.library.ucf.edu/facultybib2000/955 — Secretan et al., Picbreeder: collaborative interactive evolution (search result).
- [NoveltySearch] https://gpbib.cs.ucl.ac.uk/gp-html/Lehman_2011_EC.html — Lehman & Stanley, "Abandoning Objectives: Evolution through the Search for Novelty Alone" (search result).
- [MAP-Elites] https://arxiv.org/abs/1504.04909 — Mouret & Clune, "Illuminating search spaces by mapping elites".
- [DarwinTunes] https://pmc.ncbi.nlm.nih.gov/articles/PMC3409751 — MacCallum et al. 2012, "Evolution of music by public choice": 100 loops, 85,533 ratings, plateau after 500–600 generations.
- [Bandit-NUS] https://smcnus.comp.nus.edu.sg/archive/pdf/2014-2016/2014_bandit_mr.pdf — Wang et al., Bayesian bandit music recommendation; novelty recovery 1 − e^(−t/s); Bayes-UCB.
- [ChuGhahramani] https://mlg.eng.cam.ac.uk/zoubin/papers/icml05chuwei-pl.pdf — Chu & Ghahramani 2005, preference learning with Gaussian processes (search result).
- [BoTorch-PairwiseGP] https://botorch.readthedocs.io/en/stable/_modules/botorch/models/pairwise_gp.html — PairwiseGP implementation (search result).
- [PrefBO] https://arxiv.org/html/2302.01513v2 — "Towards Practical Preferential Bayesian Optimization" (search result).
- [GP-pref-tutorial] https://ar5iv.labs.arxiv.org/html/2403.11782 — tutorial on learning from preferences with GPs (search result).
- [Gold2019] https://m.medicalxpress.com/news/2019-10-brain-favorite-music.html — Gold et al. 2019: preference for medium complexity; certain contexts tolerate more surprise.
- [Witek2014] https://ideas.repec.org/a/plo/pone00/0094446.html — Witek et al. 2014: inverted U between syncopation and wanting to move or pleasure.
- [Hennig-CDM] https://cdm.link/what-really-makes-rhythms-human-new-research-investigates-perception-preference-tech/ — Hennig et al. 2011: listeners prefer long-range correlated timing fluctuations.
- [Margulis-news] https://sciencedaily.com/releases/2013/11/131105093118.htm — Margulis, *On Repeat*: repetition, engagement, "expanded present".
- [Margulis2013] https://collaborate.princeton.edu/en/publications/aesthetic-responses-to-repetition-in-unfamiliar-music/ — "Aesthetic responses to repetition in unfamiliar music" (search result; finding cited at abstract level).
- [Attack-swing] https://attackmagazine.com/technique/passing-notes/daw-drum-machine-swing/2 — swing conventions: 50% straight, 66.6% triplet, Logic 16A–F presets, 4% audible steps.
- [Bicep-Attack] https://www.attackmagazine.com/technique/beat-dissected/bicep-style-breakbeats/ — 128 BPM breakbeat: kick steps 1 and 7, kick dropped in bar 3, ghost snares, conga figure.
- [EDMProd-tension] https://edmprod.com/tension — 50+ tension and release techniques: risers, HP sweeps, silence before drop, pedal tones, phrase-end fills.
- [EDMProd-melodic] https://www.edmprod.com/how-to-make-melodic-techno/ — melodic techno how-to (search result; general genre context).
- [Beatportal] https://www.beatportal.com/articles/899368-step-by-step-guide-to-creating-a-melodic-house-techno-track-anyma-miss-monique-artbat-stephan-bodzin — melodic house/techno: 122–125 BPM, drum and bass patterns, intro/build/drop/16-bar breakdown/climax.
- [Cooper-Ableton] https://www.ableton.com/en/blog/max-cooper-speaking-the-unspoken — Max Cooper: harmony-first writing, six-note chord drifting at different tempos, "no sound appears twice".
- [RivalConsoles-Ableton] https://www.ableton.com/zh-cn/blog/rival-consoles/ — Rival Consoles: many simple elements combining into a complex, propulsive result.
- [Hopkins-Spin] https://www.spinmagazine.com/2013/07/jon-hopkins-immunity-interview/ — Jon Hopkins: repetition and slow change from hypnosis techniques; Open Eye Signal runs 8 min with no melody.
- [Kiasmos-MusicRadar] https://musicradar.com/news/kiasmos-talk-tape-loops-and-concert-hall-raves — Kiasmos: tape loops, strings as pads, 909 kicks pitched down, one reverb per track, ~128 BPM minimal techno roots.
- [TuringMachine-SOS] https://www.soundonsound.com/reviews/music-thing-modular-turing-machine-mkii — Turing Machine: lengths 2–16, lock/slip/random knob, pulses expander.
- [Marbles-SOS] https://www.soundonsound.com/reviews/mutable-instruments-marbles — Marbles: Déjà vu, Length, Jitter, Steps/Spread/Bias.
- [Strudel-mini] https://strudel.cc/learn/mini-notation — Strudel mini-notation operators (`<> [] ! @ ? (k,n) |`).
- [Endel] https://endel.io/technology — Endel: inputs (time, light, weather, heart rate, motion), node-based real-time generation.
- [generative.fm] https://docs.generative.fm/docs/introduction — generative.fm open-source platform docs (limited technical detail).
