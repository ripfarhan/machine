# 02: Peers and Styles. A style atlas for a Max Cooper-adjacent generative engine

**Scope:** the artists around Max Cooper (Max Cooper himself is covered in a separate report) and the genre conventions of "emotional/cerebral electronica". The aim is a set of clearly distinct sub-styles the engine can generate, so successive generations stop sounding alike, along with specific fixes for the owner's complaints: harsh bass, cheesy piano, a constant bell-like pluck, and generic kick/snare.

**Evidence labels used throughout**
- **[S]** = sourced. The fact comes from an interview, tutorial or reference page listed in Sources. Where a source gives numbers, I copy them.
- **[I]** = inference. This is my own synthesis from listening conventions, genre norms and general synthesis practice. Treat these as tunable starting values, not facts about any artist.
- I have not invented quotes. Every quoted fragment comes from a fetched page, and most are short.

---

## Part A: Why the current engine sounds the same, and the cross-cutting fixes [I]

These complaints map onto a single architectural problem: **the timbre palette, the rhythm vocabulary and the macro-form are global, not per-style.** If every generation draws from one pluck, one piano, one kick and one bass, then changing the key and tempo is not enough to tell pieces apart. The listener hears the *instrument rack*, not the notes. The artists below differ mostly in *sound sources and processing chains*, and only secondarily in harmony.

Recommendations that follow from the research:

1. **Make "style" a full preset over every layer.** Each style should own its own kick model, snare/clap model, hat model, bass model, lead/pad models, FX chain, swing, density curve and arrangement template. A style should also be able to *disable* layers. Several of the most emotional idioms have no bass synth (Xtal [S]), no kick (Eno/Reich), or no melody at all (Hopkins: a rhythm "addictive enough to justify an eight-minute track with no melody" [S]).
2. **Retire the bell pluck as a default.** In this world the pluck is one option among many: square pluck with 73 ms decay (Aphex "Ageispolis" [S]), triangle Minimoog-style lead (Tycho [S]), Juno arpeggio through tape delay (Frahm [I], from his Juno-60 and Space Echo use [S]), gated sustained saws (Hopkins-style gate [S]), string-machine pads (Jarre [S]). FM bells should be rare and quiet.
3. **Fix harsh bass by low-passing and de-emphasising it.** Rival Consoles keeps bass "heavy but never too upfront" [S]. BoC/Aphex bass is a "dark sawtooth with a high resonant filter set low, a soft attack, and little high end" [S]. Engine rule [I]: put a 24 dB/oct low-pass on bass at 200–900 Hz (style dependent), keep it mono below about 120 Hz, apply gentle tanh saturation *before* the filter rather than after, and cap the bass's level relative to the kick.
4. **Fix cheesy piano with felt and mechanics, not presets.** Frahm put felt on the *strings* and recorded with "microphones placed deep within the piano" [S]. Hopkins uses "hot miking and soft playing" [S]. Kiasmos uses a piano hit as the snare on "Blurred" [S]. Engine rules [I]: velocity 25–60 only; low-pass at 1.8–3 kHz with a velocity-to-cutoff mapping; add a hammer/key-noise transient and a pedal-noise layer; detune ±3–6 cents per voice; avoid root-position block triads (use open voicings with 2nds/9ths, and leave out the 3rd sometimes); no perfectly quantised chords (strum 8–25 ms).
5. **Fix generic drums by giving each style its own drum synthesis and processing.** Hopkins layers kicks "out of a lot of other kick drums" and puts "five or six elements on a snare drum and add[s] reverb to each" [S]. Burial's drums are built from self-recorded impacts, "off-grid and unquantised" [S]. Four Tet picks "small, characterful drum sounds with little low end", pitches them up, and turns the drum bus down "more than you normally would" [S]. Kiasmos starts from a 909 kick "morphed and changed", EQ'd and pitched down [S].
6. **Vary macro-form, not just micro-detail.** The styles below have genuinely different timelines: a 9-minute linear crescendo, AABA-less phasing, a club arc with breakdown, a drift with no sections. Picking an arrangement template per style may be the single biggest lever on perceived variety.

---

## Part B: Artist profiles

### B1. Jon Hopkins (Immunity 2013, Singularity 2018)

**Signature elements**
- *Sound first, notes second.* "It's usually a sound that dictates the notes that follow" [S, Future Music 2018]. The "Open Eye Signal" riff came from a 1979 Korg MS-20. The notes came together early, but "the gradual changes to the sound took so long", about four months of refining sound rather than notes [S, MusicRadar].
- *Repetition plus slow evolution.* He set out from "the ideas of repetition and gradual evolution over a long period of time" [S, Spin]. Singularity has "patiently built ramps that lure you to a precipice" [S, Under the Radar].
- *Destructive commitment.* "I like working destructively. So, messing with a sound a lot and then committing to it". He resamples to free CPU and to create new sounds [S, Loopcloud].
- *Tactile, room-recorded sound sources.* According to the Pitchfork review cited on Wikipedia, he drummed on desks, played salt shakers, slowed down firework recordings, and boosted the rattle of a window for use as a kick element [S, Wikipedia/Immunity].
- *Kick/snare construction.* He builds kicks from many kicks and gives the snare five or six elements, each with its own reverb. He resamples problem drum tracks "as one" and processes them heavily [S, Future Music]. He "wanted every kick to sound the same", modelled on 1980s drum-machine records [S, Computer Music 2019].
- *Gate and sidechain movement.* The well-known "Hopkins" trick: two detuned saws with long sustain, run through Ableton's Gate in flipped mode and triggered by a separate rhythm channel, plus a sidechain compressor on the synth and bass driven by the same rhythm [S, Isotonik]. The result is "a chopped, pulsing sound that feels alive" [S].
- *Piano.* An upright miked permanently, "hot miking and soft playing". Nils Frahm's Una Corda serves as his live piano [S, CM 2019]. Two Octava mics hang down into the piano [S, FM 2018]. He uses the Bubbler granular delay to build pads from sources like piano [S].
- *Space as a scene.* Treble at the top, bass low, distant elements far back [S, Loopcloud]. He uses reverb "to make things sound behind something else" and plays "with the stereo imaging as much as possible" [S, FM].
- *Arrangement by subtraction.* He makes many versions and strips them back: "I take away more notes; take away more of the beat" [S, CM].

**Tempo/key [I].** The four-on-the-floor tracks sit roughly at 100–128 BPM (half-time feel common). Keys are minor or modal, often with a drone tonic and slowly changing upper harmony. Track lengths run 5–12 minutes (Immunity lengths: "Open Eye Signal" 7:48, "Collider" 9:21, "Sun Harmonics" 11:54 [S, Wikipedia]).

**Why it moves people [I].** Tension builds through *timbre* (saturation, filter opening, transient density) over a static harmonic floor. When the release comes, it is often a cut to piano and air rather than a bigger drop.

### B2. Rival Consoles (Ryan Lee West)

**Signature elements [S unless marked]**
- He sketches on guitar and piano for an "organic, analog approach to songwriting". His gear includes an ARP Odyssey, Korg Minilogue, Matrixbrute and three Moog Mother-32s. Most tracks run a Prophet '08 sequence "played in live through pedals", which gives built-in movement [NI blog].
- A Space Echo 555 is used for "dark, reverb-like synth sounds", and a Reface CP for delay-heavy Rhodes [Stamp the Wax].
- PASSIVE EQ boost at about 2–3 kHz to bring sounds forward. Transient Master on "dark, lo-fi drums". Bass is "heavy but never too upfront". Rather than stacking layers, he gives each sound strong character, which creates the illusion of density. The mix is deliberately not over-polished [NI blog].
- His structures move through "weak and then strong movements", like a band rather than sustained dance power. Hundreds of small EQ/volume automation moves make elements build when intended [NI blog].
- "Unfolding" is built on unison: "everything starts off in union and then by the end every single part has got independent rhythm" [PopMatters]. He prefers subtlety over loudness, and each track on Persona sits at "a very different tempo" [PopMatters].
- He uses synths so that "a double bass or a cello bowed almost come together as one" [PopMatters]. On Persona, live drums included a snare played with brushes [Stamp the Wax].
- "If anything magical happens I try to slowly build around that" [Stamp the Wax].

**Sound recipe [I].** The "analog bloom" is a poly synth chord (2 saws, ±7–12 cents) whose filter opens over 4–16 bars while a slow LFO wobbles pitch slightly. It runs through tape echo with feedback close to self-oscillation in the swells. Drums are lo-fi and dark, with transients restored.

### B3. Kiasmos (Ólafur Arnalds and Janus Rasmussen)

**Signature elements [S]**
- The kick starts from a Roland 909 sample "morphed and changed", then EQ'd and pitched down. Live percussion is recorded in loops and then chopped. Shakers, snares, rimshots and clicks are performed live. **A piano hit is the snare on "Blurred."** [MusicRadar]
- Strings serve as pads: "We rarely use strings percussively or staccato" [MusicRadar].
- A Juno-60 appears on nearly every track, mostly for pads. An MS-10 handles bass on one EP. A Korg PS3100 appears on newer material [MusicRadar].
- A Space Echo (RE-201/501/555) is on nearly every track. Pads are often sent to the tape *with no repeats*, then panned out for wide, "wobbly" textures [Headphone Commute].
- EMT 240/246/250 reverbs, **one reverb type per song** [MusicRadar].
- Tape loops are made by gluing the ends and running them around the studio, with audible splice points kept. "We usually try to keep the mistakes in." [MusicRadar]
- Janus's early influence was minimal, dark techno around 128 BPM [MusicRadar]. Songs start beat-first: "We usually create some kind of a base together, often a beat." [HC]
- Live, a "Filter" channel feeds a Bass Station for live filtering. Improvisation happens in 16-bar loop sections [MusicRadar].

**Tempo/key [I].** 118–124 BPM, minor keys with suspended/added-9 piano voicings, and a subdued 4/4 with soft kick and lots of shaker/click detail.

**Related: Ólafur Arnalds' Stratus [S].** Two self-playing pianos are driven by MIDI from his playing on a PianoBar-fitted piano. The system is "semi-generated", "more like an enhancer" that expands each chord. Arnalds noted the variety problem: it can sound like "a lot of piano notes", so he used it sparingly [Electronic Sound]. *This is directly relevant to a generative engine: echo-pianos responding to a lead piano, used sparingly.*

### B4. Nils Frahm

**Signature elements [S]**
- *Felt:* felt placed on the **strings**, first to play quietly at night, then kept for the sound. The album was recorded with mics "deep within the piano" [Wikipedia: Felt].
- *Juno-60:* his first synth, used "more like an organ for jazz-rock stuff". He owns five RE-501s, and "each spring reverb sounds different". He uses a Rhodes through a DI [Roland blog].
- *Polyrhythmic arps ("Says"-style):* the Attack tutorial sustains C3 in C minor. A sequencer adds intervals +3, +7, +10, +14, +15 semitones, each channel at 1/16 with a **different step count (9, 10, 7)**, some notes chance-gated, and a second root (F3) added after four bars [Attack].

**Sound recipe [I].** For the "Says" arp: one or two oscillators (square/pulse plus a quieter saw), low-pass at around 1.2 kHz opening slowly over minutes, amp A 2 ms / D 180 ms / S 0 / R 250 ms, through a modulated tape delay (dotted 1/8, feedback 45–60%). The track's arc is one very long filter/volume crescendo over a static chord bed, with a piano/organ climax and a release.

**Why it moves people [I].** Audible mechanism (felt, pedal, hammer) creates intimacy. Polymetric arps never quite repeat, which gives the feeling of watching something breathe.

### B5. Moderat / Apparat / Modeselektor

**Signature elements [S, MusicRadar]**
- Clean synth tones are rejected: "the clean synth sound isn't the most euphoric or rewarding sound to us".
- Two T-Rex Replicator tape echoes that "sound broken in a different way", which keeps the stereo image *uneven*. An Elektron Analog Heat handles saturation. Sounds are resampled to feel "older".
- Cwejman MMF-6 filter used to "break it apart in strange ways". Layering, stretching and pitching in Ableton add grit.
- Soothe2 tames vocal resonances. Melody and vocal are written first on a neutral placeholder sound, and sound design comes later. A near-final sound is sometimes thrown away and only the melody kept.

**Sound recipe [I].** Bass is a sub sine plus a mid-bass layer (saw → band-pass 300–900 Hz → saturation), sidechained lightly. The vocal is a chopped, pitched, formant-shifted phrase. Drums are broken and half-time (kick on 1, snare on 3) at 120–130 BPM, or a 4/4 with heavy swing. Melancholic minor harmony with big reverb throws.

### B6. Four Tet, Floating Points, Bonobo (organic layering)

**Four Tet [S]**
- MIDI swing was "a revelation". He edits audio directly in the Arrange view, records to four-track tape and loops it back in. He copies a MIDI melody to a second synth and *reverses or shortens* it so the two "play off each other" [SOS].
- The "Three" technique breakdown: small, characterful drums with little low end, pitched up a step or two, Swing 8ths 54 on hats, open-hat decay automated mid-bar, start-point variation per hit, a vinyl crackle loop under the beat, RC-20/ring mod on hats, drums EQ'd thin and the drum bus turned down [MusicTech].

**Floating Points [S]**
- The Buchla 252 circular sequencer runs **three sequences with different step counts (e.g. 16, 11, 5)**. A Volca Beats goes through a Buchla delay, then a second delay, to create a different rhythm, with drones layered over it for about half an hour. A second sequencer modulates the first [MusicRadar].
- Promises is built on a "signature seven-note arpeggio that slowly circulates" while orchestral and synth textures change around it [NPR].
- "LesAlpx" is a "white-knuckle peak tune" with "delirious drums" and "luminous ambient breakdowns" [FADER].

**Bonobo [S, Ableton blog]**
- "I don't believe in quantize or groove pools." He hand-draws every part, turns the grid off in alternate bars, and makes "micro-adjustments on every hit".
- Re-pitching is "one of the biggest tools". He pitches acoustic instruments "in a way that they could never be played". He builds "layers and layers and layers", then removes what the sounds shared.

### B7. Aphex Twin (Selected Ambient Works 85–92)

**[S, MusicRadar and Reverb Machine]**
- Gear: MS-20, SH-101, DX7 (and DX100), Casio FZ-10M on about 80% of tracks, R-8 with 808 card, **Alesis Quadraverb on every track** ("dark and muddy"). Recorded to cassette, then re-recorded to DAT.
- **Ageispolis** lead: square pluck, filter fully open, **73 ms VCA decay, no sustain**. The pad is a DX7 strings patch filtered at about 1.12 kHz, sitting **about 25 cents flat**. Bass is two detuned triangles. The reverb recreation uses about 26% wet.
- **Pulsewidth** stabs: detuned saw/PWM, cutoff 100 Hz with key tracking, filter decay 350 ms, VCA decay 490 ms, 1/8 ping-pong delay at 29% wet, reverb 32%.
- **Xtal**: chords and vocal from a 1986 library record, 808 kick drenched in reverb, snare layered with an "Apache" snare pitched down about 5 semitones, *no bass synth*. Sections are marked by two hat patterns and two kick patterns.
- Hats: a signature pattern of "two closed and one open". Fast triplet hat rolls on "Ageispolis"/"Heliosphan". The 808 kick is repitched to make basslines.
- Master recreation chain: Decapitator (Drive about 3) plus RC-20 "Cassette 1st Generation".

### B8. Boards of Canada

**[S]**
- Tape machines, CS-80/CS-70M, SH-101, Akai S1000. "It's easier to affect people emotionally if you keep things simple." Recorded instruments are played into samplers, put through "destructive hardware", then resampled. Live percussion is woven in: "it's never just a drum machine or a sample." [G.A.S. newsletter]
- Soundfly emulation: high-pass at about 120 Hz plus low-pass at about 6 kHz for a "blunted, warm" sound. LFOs on pitch, cutoff and PWM at "moderate speed and depth" [Soundfly].
- Syntorial "Sundown" pad: saw, 4-voice unison at 3 cents, noise at 40%, LP cutoff 60%, res 30%, key track 60%, **amp A 1300 ms / S 100% / R 1200 ms, LFO → pitch, triangle, 56 cents, 1 bar**, reverb 80% wet [Syntorial].
- Attack "Roygbiv" bassline at **80 BPM**: wavetable, 3 cents detune, sub on, mono glide 20–30 ms, **decay 9 s, release about 3 s, LFO → pitch 0.75–1 Hz, 15–20%**, LP 1.6 kHz, 24 dB, res 25%, 8-voice unison at 20%, then Modnetic tape (noise 50%, chorus) [Attack].

**Why it moves people [I].** Pitch instability reads as *memory*: an old tape that cannot hold its pitch. Simple major/minor-7th harmony is fine as long as the pitch keeps drifting.

### B9. Burial

**[S]**
- Built in Sound Forge, a single-track waveform editor. The process was destructive ("Once I change something, I can never un-change it"), with elements placed by ear and not on a grid. Drums came from self-recorded impacts with a dusty, wooden character, "off-grid and unquantised", avoiding big drums and snares. "Tape crackle, that's a beautiful sound." Vocals are cut up and placed out of sync with the beats, aiming for a "night cry" quality [MusicRadar].
- Attack "Ghost Hardware" breakdown: kick 4/4 plus an extra hit on the last 8th (steps 1, 5, 9, 13, 15, inferred by the author). Hats pitched down four octaves, band-passed 1.2–4 kHz. Shaker pitched down 13 semitones. Vocal pitched +1 semitone with heavy sidechain to the kick. Vinyl crackle pitched down an octave with saturation at 12 dB and -10 dB compression, high-passed at 225 Hz. Group Drum Buss: drive 9%, crunch 2% [Attack].
- Related 2-step/garage specs: **120–128 BPM, swing 60–65%**. Snare on 2 and 4 plus a ghost at the end of the bar. Hats on offbeats, pitched down 4–5 steps, doubled and panned [Attack: Garage Shuffle, Rolling 2-step].

**[I]** Burial's own tracks mostly sit around 130–140 BPM in 2-step feel. Treat that tempo as inference.

### B10. Tycho

**[S, Reverb Machine]** The "Awake" lead is a single-oscillator **triangle** on a Minimoog-style synth, bright filter with fast decay, attack slightly above zero. The second lead has key tracking off, less envelope and longer decay/sustain. Chain: compression → heavy EQ (cut lows and highs, boost upper mids) → plate reverb at 15% → hall reverb at 30% with modulation → 1/4 EchoBoy "Memory Man" *after* reverb → heavy compression → boost around 1060 Hz with a low-pass above it.

**[I]** Tycho runs 95–120 BPM with live-sounding drums and bass guitar. Lydian/major-7th harmony, chorus-wide Juno-style pads, a sunlit high-mid EQ, and very little sub.

### B11. Melodic techno (Stephan Bodzin, Kölsch, Innellea, Afterlife)

**[S]**
- Bodzin: the Moog Sub 37 is "the backbone of my music and my live set". Ableton drums trigger it for basslines, and he plays leads by hand. The Matriarch is patched live, with "random results, random errors and random highlights". A Modor DR-2 adds "dirty or fragile percussion". Scenes go from ambient to full-on, and improvisation controls when drops rise and fall [DJ Mag]. Per-track gear on Boavista: Diva chords, OB-Xa/Oxium/ARP arpeggios, Sub 37 bass, "tonal 16th toms", "tonal snare" [Attack].
- Kölsch: "I believe in melodies and compositions". "You can't overproduce something into being fantastic music." He uses a 303, 909 and M1, and Ableton randomisation to find leads. He goes through 10–20 versions per arrangement and says "if an idea isn't good within 30 minutes, it wasn't good from the start" [15 Questions].
- Innellea: Minibrute sub-oscillator (sine/square) plus "brute" for fat bass. Kick low-cut at about 30 Hz, or slight sidechain instead. "Every sound needs its space in the mix." [Torture the Artist]. Signatures include stabby metallic leads, trance-gated pads in call and response with stabs, and tremolo/LFO-modulated chords [Production Music Live].
- Generic template: 122–125 BPM, A minor, Am–F–C–G or Am–Dm–Em–C, bass on chord roots in 1/8 and 1/16, sidechained. Filter cutoff automated over 16 bars. High-pass non-bass parts at about 120 Hz [Beatportal].

### B12. Eno and Reich (process music)

**[S]**
- *Music for Airports 2/1:* seven loops, each a single sung note, of different lengths. For example, C repeats about every 20.1 s and high F about every 19.6 s. The timings drift because the tapes were wound around chair legs. *1/1:* piano (Robert Wyatt) and Rhodes in D major drifting toward D Mixolydian (a C natural). Echo, then a loop played at half speed, which drops the pitch an octave [Reverb Machine]. Eno also reported loops of 79 ft and 83 ft for one piece [Wikipedia: Tape loop].
- *Piano Phase:* a 12-note figure **E4 F♯4 B4 C♯5 D5 F♯4 E4 C♯5 B4 F♯4 D5 C♯5** (five pitch classes). One player speeds up slightly until they are one note ahead, then locks back in. The figure is later reduced to 8 notes, then 4. Section 3 repeats 8–60 times [Wikipedia]. *It's Gonna Rain:* two tape loops at slightly different speeds [Wikipedia: Tape loop].

### B13. Jarre, Vangelis, Tangerine Dream / Berlin School

**[S]**
- *Jarre, Oxygène:* VCS3, Eminent 310 string machine, RMI Harmonic Synthesizer, ARP 2600, tape echo and guitar pedals, home-recorded to 8-track [MusicRadar]. Oxygène pad recipe: Eminent sample, **three choruses at 1.5 / 0.3 / 0.7 Hz, intensity about 10%, 50% wet, then a 6-stage phaser from about 100 to 6200 Hz with LFO near 0.1 Hz, then a 5 s hall at 50–60% wet**, played as slow triads [Computer Music]. ARP 2600 recreation: two saws at ±0.03 (slight detune), 32', LP at about 30 Hz with heavy envelope mod and res 16%, envelopes with A 60–65 ms and release 2400–7000 ms [MusicRadar].
- *Vangelis:* a CS-80 with velocity and polyphonic aftertouch controlling brightness and volume per note, a ribbon for descending slides, and a Lexicon 224 reverb [Reverb Machine]. Syntorial "Blade Runner Brass": two pulses at 50%, osc 2 an octave up and -6 cents, LP cutoff 75%, res 15%, **filter env A 650 ms / D 10 s, amp A 250 ms / D 1900 ms / S 40% / R 750 ms, LFO → PW triangle 80% at 1/8**, small reverb at 10% [Syntorial].
- *Tangerine Dream, Phaedra (1974):* Franke used the Moog sequencer in place of bass guitar. The analog oscillators detuned as they warmed up, which caused some of the changes near the end of the title track. A Mellotron solo was recorded in one take while Monique Froese turned the knobs on a phasing device [Wikipedia]. Berlin School patch: saw plus pulse → 24 dB LP → VCA, **envelope decay 50, release 20, sustain 0**, 8-step latched sequence, synced delay at 6 eighth notes with high feedback [Computer Music].

---

## Part C: The style atlas (14 sub-styles)

**Grid notation.** 16 steps per bar of 4/4. `X` = accent, `x` = normal, `o` = ghost (velocity at 30–50%), `-` = rest. Swing % follows the MPC convention, where 50 means straight. All ADSR values are ms unless marked as seconds. All synth values are **[I]** starting points unless tagged **[S]**. The aim is *difference between styles*, so contrast the cards when tuning.

**Global DSP primitives assumed:** subtractive voice (osc → filter → amp), FM pair, noise, sampler-free physical/karplus piano model or a felt-piano synth, tanh saturator, bit/sample-rate reducer, tape model (wow/flutter, LP, noise, saturation), chorus, phaser, ping-pong/tape delay, algorithmic/convolution reverb, sidechain ducker, gate.

---

### 1. "Hopkins Distorted Crescendo" (Immunity/Singularity-style)

- **BPM:** 104–124 (an occasional half-time feel at 120).
- **Key/mode:** Aeolian or Dorian, often with a tonic pedal. One chord can hold for 8–32 bars.
- **Harmony:** two-chord oscillation (i–VI or i–♭VII) under a drone. The upper voices change, the bass does not.
- **Drums:**
```
Kick   X---x---X---x---   (all hits identical: Hopkins "every kick to sound the same" [S])
Clap   ----X-------X---   (5 layered elements, each with own short reverb [S])
Hat    --x---x---x---x-   closed, + o ghosts on 4/12 later in track
Perc   o--o--o---o--o--   desk/knock samples, 3-against-4
Shaker xoxoxoxoxoxoxoxo   enters bar 33
```
- **Kick recipe:** a 3-layer stack (sine 160→48 Hz over 45 ms; a mid "knock" band-pass noise burst at 1.2 kHz, 8 ms; a sampled room/"window-rattle" texture at -12 dB). Sum, then tanh drive 12–18 dB, then compressor at 8:1 with 1 ms attack and 60 ms release. Amp decay 220 ms.
- **Bass:** a sustained saw pair (±9 cents) low-passed at 180 Hz with res 10%, ducked by a 4/4 sidechain at -8 dB depth and 120 ms release. Mostly root, mostly tied.
- **Main synth ("Open Eye" riff):** a mono MS-20-style voice. Saw plus pulse, 12 dB LP with res 55–70% and drive. **Cutoff automated from 300 Hz to 4 kHz over 64 bars.** Env amount rises with cutoff. A 3 / D 160 / S 30% / R 90. A 5–7 note riff in 1/16 that never changes notes; only timbre evolves [S on the process].
- **Gated pad:** 2 saws ±12 cents with long sustain, through a gate in flipped mode triggered by a hidden rhythm (for example `x-xx-x-xx-x-x-xx`) [S]. Gate attack 2 ms, hold 40 ms, release 80 ms.
- **Texture:** a granular cloud from the piano layer (Bubbler-style [S]) at grain 80 ms, density 20/s, pitch ±0/12.
- **Arrangement (bars):** 0–16 noise, room tone and filtered riff → 17–48 kick enters, riff slowly opens → 49–80 clap, shaker, drive increasing → 81–96 peak with full saturation → **97–112 sudden cut to felt piano, air and reverb tail** → 113–128 kick returns softer → fade.
- **Mix:** the kick is loud but dark. Low-pass the master bus top at 14 kHz in the intro and open it to 20 kHz at the peak. Treble at the top, bass low, "distant elements placed far back" [S].
- **Magic ingredient:** *timbre evolution over frozen notes*, followed by the piano cut.

### 2. "Felt Piano + Minimal Techno" (Kiasmos)

- **BPM:** 118–124.
- **Key/mode:** natural minor with add9/sus2 voicings. Piano melodies of 3–5 notes, often descending.
- **Harmony:** a 4-chord loop over 8 bars (i–VI–III–VII is fine *if* voiced openly: root–5th–9th–3rd up top).
- **Drums:**
```
Kick   X---x---X---x---   909 pitched down 2 st, LP 2.5 kHz [S: 909 morphed+pitched down]
Snare  ----x-------x---   = a PIANO HIT (low cluster, short) layered w/ rim [S: Blurred]
Rim    ------o-------o-   
Shaker oxoxoxoxoxoxoxox   live-feel: ±12 ms jitter, vel 40–80 random
Click  x--x--x--x--x-x-   very quiet, high-passed 6 kHz
```
- **Bass:** an MS-10-style mono saw [S], LP 400 Hz with res 20%, env decay 180 ms, in 1/8 offbeats (`--x---x---x---x-`) with a light sidechain.
- **Piano:** felt piano (LP 2.2 kHz, velocity 30–55, hammer-noise layer at -24 dB, sustain pedal on), through a Space Echo send *with no repeats* (wobble only) panned wide [S].
- **Pad:** Juno-60-style [S]. One saw plus a sub-square at -12 dB, chorus mode II (0.8 Hz, 3.5 ms), HPF 150 Hz, LP 1.8 kHz, A 900 / D 0 / S 100 / R 2500.
- **Strings:** legato pads only, never staccato [S]. Slow attack of 1500 ms.
- **Reverb:** *one plate for the whole song* [S], 2.8 s, pre-delay 25 ms.
- **Texture:** a tape loop with an audible splice click every 2.3 bars [S: splices kept], plus hiss at -40 dB.
- **Arrangement:** 1–16 piano alone → 17–32 kick and shaker → 33–64 bass, pad and "piano snare" → 65–80 breakdown with piano and strings (filter-down on drums via a Bass Station-style live filter [S]) → 81–112 full groove with strings → 113–128 drums out, piano and tape loop.
- **Magic ingredient:** *the piano doubles as percussion*, plus tape wobble on the pad.

### 3. "Frahm Polymeter Arp" (Says / All Melody)

- **BPM:** 100–120 (the pulse is 1/16 of the arp, so the tempo feels slow).
- **Key/mode:** minor with sustained root. Example: C minor, root C3 held [S].
- **Harmony:** a **static root**; the arp intervals imply chords. The root changes to the 4th (F) after 4–8 bars [S], with possibly a third root later.
- **Arp engine [S]:** independent lanes at +3, +7, +10, +14, +15 semitones over the held root. Each lane runs 1/16 with its own length (9, 10, 7, 16, 11 steps) and per-note chance of 60–100%. Lanes are added and removed over time.
- **Drums:** none, or a soft kick on 1 after the climax. Polymeters carry the rhythm.
- **Arp voice:** pulse (PW 35%) plus saw at -6 dB, ±5 cents. 24 dB LP **cutoff ramp 400 Hz → 5 kHz over about 3 minutes**, res 25%. A 2 / D 180 / S 0 / R 250. Spring/tape delay at dotted 1/8, feedback 55%, wow 0.6 Hz.
- **Pad/organ:** a Juno-as-organ [S]. Square plus sub, slow rotary-ish chorus, entering at the climax.
- **Piano:** a felt-piano climax line in long notes in the upper register, velocity 40–70.
- **Arrangement:** 0–2 min, two lanes with the filter closed → 2–4 min, lanes 3–5 enter and the filter opens → 4–5 min, organ and piano peak at full cutoff → 5–6 min, lanes drop out one by one, leaving the delay tail.
- **Magic ingredient:** *coprime lane lengths* (LCM in the thousands of steps), so the pattern never quite repeats, combined with a single very slow filter ramp.

### 4. "Rival Consoles Analog Bloom"

- **BPM:** 80–110, a different BPM every generation [S: "very different tempo" per track].
- **Key/mode:** minor, with chromatic passing chords borrowed from guitar voicings [S: guitar-informed].
- **Harmony:** a 3–5 chord progression with suspensions. Voice-led, often with a moving inner voice.
- **Drums (dark, lo-fi, transient-enhanced [S]):**
```
Kick   X-----x---X-----   soft, LP 1 kHz, + transient shaper
Snare  --------X-------   brushed snare sample [S], heavy room
Ride   x-x-x-x-x-x-x-x-   dark ride, -18 dB, enters late
Perc   ---o-----o---o--   shaker
```
- **Bass:** a Mother-32-style mono (saw → ladder LP 250 Hz, res 30%), heavy but not upfront [S]. Glide 60 ms.
- **Lead:** a Prophet-style poly (2 saws ±11 cents, PW mod on osc 2). 24 dB LP **cutoff 600 Hz → 3 kHz over each 8-bar phrase**, then back. A 400 / D 1200 / S 70 / R 1800. Pitch LFO 0.2 Hz, ±4 cents. Then "pedals": tape echo at 3/16 with 70% feedback, spiking to 95% (self-oscillation) at swell peaks [S: "waves of delayed feedback"].
- **Unison→independence trick [S: Unfolding]:** all parts play the same rhythm at first, and over the track each part's rhythm is mutated independently (rotate, thin, double).
- **Texture:** sustained, bowed-cello-like synth (saw → band-pass 600 Hz, slow vibrato 5 Hz ±8 cents).
- **EQ:** a +2 dB bell at 2.5 kHz on the lead [S].
- **Arrangement:** a *weak/strong* alternation [S]: 1–8 weak, 9–24 strong, 25–32 weak, 33–56 strongest, 57–64 dissolve. Short "effects fills" (delay throws) at section ends [S: Hopkins uses "effects fills"; Rival-style inference].
- **Magic ingredient:** *one character-rich voice* rather than many layers [S], with tape feedback blooms.

### 5. "Melodic Techno Arp Ride" (Bodzin / Afterlife)

- **BPM:** 122–126 [S].
- **Key/mode:** minor (A minor is common [S]). Phrygian colour from a ♭2 neighbour in the lead.
- **Harmony:** i–VI–III–VII or i–iv–v–III [S], 2 bars per chord, with drawn-out pads.
- **Drums:**
```
Kick   X---X---X---X---   tight 909-ish, low-cut 30 Hz [S]
Clap   ----X-------X---   [S]
CHat   --x---x---x---x-   
OHat   --------------x-   every 2 bars [S]
Tom    x--x--x-x--x--x-   tonal 16th toms tuned to scale (Bodzin "tonal 16th toms" [S])
Ride   x-x-x-x-x-x-x-x-   after drop
```
- **Bass (rolling):** Sub 37-style [S]. Saw plus sub-square, LP 600 Hz, res 35%, env decay 120 ms, roots in 1/16 with the kick step muted: `-xxx-xxx-xxx-xxx`. Sidechained to the kick at -6 dB with 80 ms release.
- **Arp:** 1/16 over the chord tones across 2 octaves, OB-style voice (2 saws ±8 cents). LP 900 Hz, res 45%, env amount 30%, **cutoff ridden by hand: 900 Hz → 7 kHz over 16 bars and back** [S: automate cutoff over 16 bars]. Delay at dotted 1/8, 35% feedback.
- **Lead:** a hand-played mono with glide 40 ms and slow attack (60 ms). Big hall reverb, 4 s, at 25%.
- **Gated pad:** a trance-gate pad answering the stabs [S: Innellea call and response]. Gate in 1/16 with pattern `x-xx-x-xx-xx-x-x`.
- **Arrangement [S, Beatportal, adapted]:** 1–16 kick, hats, atmosphere → 17–32 bass, pads, FX → 33–48 drop with lead → 49–64 breakdown (pads, arp only, cutoff low) → 65–80 climax with arp fully open → 81–96 outro DJ tools.
- **Mix:** high-pass non-bass parts at 120 Hz [S]. Light master saturation [S: Bodzin's Model1].
- **Magic ingredient:** *a single arp under one hand-ridden filter*, plus tonal percussion.

### 6. "BoC Tape Nostalgia"

- **BPM:** 78–96 (80 BPM in the Roygbiv recreation [S]).
- **Key/mode:** major/Mixolydian or minor with maj7/m7 chords. Simple progressions [S: "keep things simple"].
- **Harmony:** I–vi or Imaj7–IVmaj7 alternating every 2 bars. **The whole track is detuned -15 to -30 cents** (cf. Aphex 25 cents flat [S]).
- **Drums (hip-hop, dusty):**
```
Kick   X------x--X-----   
Snare  ----X-------X---   + layered live tambourine
Hat    x-x-x-x-x-x-x-xo   swing 58%
```
  Drums are low-passed at 6 kHz and high-passed at 40 Hz, bit-reduced to 12-bit at 26 kHz, with a slow tape wow.
- **Bass:** the Roygbiv recipe [S]. Wavetable/saw with 3 cents detune, sub on, mono glide 25 ms, decay 9 s, release 3 s, **LFO → pitch 0.8 Hz at 15–20%** (map to ±15–25 cents), LP 1.6 kHz 24 dB res 25%.
- **Pad:** the Sundown recipe [S]. Saw, 4-voice unison at 3 cents, noise 40%, LP 60%, res 30%, **A 1300 / R 1200**, **pitch LFO triangle at 1 bar, ±56 cents (applied mono, so all voices bend together)**, reverb 80% wet.
- **Lead:** a sine/triangle with a slow-attack (300 ms) "flute" quality and pitch drifting ±20 cents.
- **Texture:** a found-sound bed (children/field/VHS hiss) [S: nature, VHS sampling], HP 120 Hz / LP 6 kHz [S].
- **Master:** a tape model (wow 0.5 Hz ±8 cents, flutter 6 Hz ±2 cents, saturation, -45 dB hiss) and a gentle 12 dB LP at 9 kHz.
- **Arrangement:** 1–4 tape noise and pad → 5–20 beat and bass → 21–28 beat drops (pad and voice sample) → 29–44 beat back with lead → 45–48 the tape "slows down" (pitch -1 semitone over 2 bars) and ends.
- **Magic ingredient:** *the whole mix drifts in pitch together*, so it sounds like memory and not a mistake.

### 7. "Burial Night-Bus Shuffle"

- **BPM:** 130–140 [I] (garage specs run 120–128 [S], so this is a style choice).
- **Key/mode:** minor, often with no chord changes. A minor 2-chord pad shimmer (i–♭VI).
- **Drums (off-grid, small, wooden [S]):**
```
Kick   X-----x---x---x-   short, NO big sub; LP 800 Hz
Snare  ----X-------X--o   + end-of-bar ghost [S garage]
Rim    --o----o-o---o--   each hit ±15 ms random offset [S off-grid]
Hat    --x---x-o-x---x-   pitched down 4–5 st, BP 1.2–4 kHz [S]
Shaker --o-------o-----   pitched -13 st [S]
```
  Swing is 62–66% on hats [S range 60–65%], plus independent ±8–20 ms humanised offsets per hit.
- **Bass:** a sine sub (55–70 Hz), long notes, swelling with slow attack (200 ms) *against* the kick (sidechain at -10 dB). Optional "wobble" via LP at 120 Hz with a 1/4 LFO.
- **Vocal:** a chopped vocal phrase pitched up 3–7 semitones (formant-preserved where possible) or +1 semitone [S], heavily sidechained [S]. Long reverb at 6 s, placed **unsynced** (start offsets not on grid) [S].
- **Pad:** a detuned string pad (2 saws ±18 cents) through band-pass 400–2.5 kHz with a big reverb wash.
- **Texture:** vinyl/tape crackle *always on* [S], pitched down an octave, HP 225 Hz, saturated [S], -26 dB. Rain or field hiss at -35 dB.
- **Arrangement:** **no grid sections.** Elements fade in and out with random lengths of 3–11 bars. Drop the drums for 2–6 bars at random. Total 5–7 minutes.
- **Mix:** everything soft. No transient over -6 dBFS. Top end rolled off at 10 kHz except the crackle.
- **Magic ingredient:** *timing that refuses the grid*, and the ghost vocal.

### 8. "Reich Phasing Ensemble"

- **BPM:** 140–200 pulse in 1/16 (fast, light mallets).
- **Key/mode:** 4–6 pitch classes only [S: Piano Phase uses 5]. Example cell: E–F♯–B–C♯–D [S].
- **Harmony:** none in the functional sense. Harmony comes from the phase interference. Optional section change: shrink the figure from 12 → 8 → 4 notes [S].
- **Process:** two (or three) identical voices playing a 12-note cell. Voice B runs 0.5–1.5% faster until it is exactly one 16th ahead, then locks for N repetitions (8–24 [S: 8–60]), then drifts again. Repeat until it is 12 steps ahead (back in unison).
- **Drums:** none. Optional: a clap pattern (Clapping Music style) as voice C, phasing by discrete one-step shifts every 8 bars.
- **Voices:** marimba-like (sine plus 4th-partial sine at -14 dB, A 1 / D 350 exp / S 0) and piano-like (felt piano, LP 3 kHz). Pan A at 35% left and B at 35% right.
- **Texture:** a sustained organ/voice drone of the cell's lowest note, swelling every 32 bars [I, Music for 18-style pulses].
- **Arrangement:** about 6–12 minutes. Unison → phase → lock → phase … Introduce a "pulse swell" section where all voices crescendo and decrescendo over one breath-length (about 6–10 s).
- **Mix:** dry-ish (small room, 0.8 s). No compression.
- **Magic ingredient:** *emergent melodies from phase alignment*. The listener hears patterns no single voice plays.

### 9. "Eno Airport Loops" (incommensurable tape loops)

- **BPM:** none (free time).
- **Key/mode:** major pentatonic or a 7-note set (2/1 uses A♭, C, D♭, E♭, F … [S]). D major/Mixolydian piano for the 1/1 variant [S].
- **Process [S]:** 5–8 voices, each a single sustained note (or a 2–4 note piano phrase) on its own loop with **lengths that are near-equal but incommensurate**, e.g. 17.3, 19.6, 20.1, 21.7, 23.9, 25.4, 31.1 s. A small timing drift (±0.5%) per cycle [S: tapes drift].
- **Voices:** "choir" (formant-filtered saw: band-passes at 700/1200/2600 Hz, A 2500 / R 4000) and "Rhodes" (FM 1:1, index env 2 → 0.3 over 600 ms, tremolo 4 Hz ±1 dB). *Half-speed piano trick* [S]: generate a piano phrase, then play it an octave down at half tempo with a doubled decay.
- **Drums/bass:** none. Low notes come only from loops.
- **FX:** a long echo (1.2–2.5 s, feedback 40%) into a 9 s reverb at 45% wet. LP at 6 kHz.
- **Arrangement:** 10–20 minutes, no sections. Density stays roughly 2–4 notes sounding at any moment, which happens naturally from the loop lengths.
- **Magic ingredient:** *no composer decides the chords*. The loop arithmetic does.

### 10. "Berlin-School Sequencer Swell" (Tangerine Dream / Schulze)

- **BPM:** 110–135 (1/16 sequence). Often 3 or 6 step accents across 4/4.
- **Key/mode:** Phrygian, Aeolian or Dorian. Sequence of 8 or 16 steps [S: 8-step pattern].
- **Harmony:** the sequence is transposed every 4–8 bars by +5 or -2 semitones (I → iv → ♭VII). Mellotron-style choir/strings provide pad chords.
- **Sequencer voice [S]:** saw plus pulse → 24 dB LP → VCA. **Envelope decay "50", release "20", sustain 0**. Engine mapping: A 1 / D 120 / S 0 / R 60. Cutoff 350 Hz, res 55%, env amount 50%. **Cutoff swept by an LFO at 1/64 Hz (one sweep per about 64 s)**. Synced delay at 6/8 (dotted half) with feedback 55% [S].
- **Analog drift [S: oscillators detuned as they warmed]:** a random-walk pitch of ±0–8 cents over minutes, plus a per-step random of ±2 cents.
- **Second sequence:** a different length (e.g. 12 against 16) an octave up, via band-pass, entering after 3 minutes.
- **Drums:** none, or an electronic "pulse" (filtered noise ticks on 1/16, accents on 1 and 7 of each 16).
- **Pad:** Mellotron-like strings (sampled-sound model: saw ensemble, A 300 / R 1500, slight tape flutter) with a slowly sweeping filter/phaser [S: Mellotron with sweeping filter, phasing device].
- **Lead:** a Moog-ish solo (saw, LP 1.2 kHz, glide 90 ms, vibrato 5.5 Hz delayed 400 ms) improvising in the mode over the sequence.
- **Arrangement:** 0–2 min drone and pad → 2–6 min sequence enters with the filter closed → 6–12 min filter sweeps, transpositions, second sequence, lead solo → 12–15 min sequence stops (pad, delay tail).
- **Magic ingredient:** *a single hypnotic sequence whose cutoff breathes across minutes*, with analog drift.

### 11. "Jarre/Vangelis Cosmic Synth Anthem"

- **BPM:** 65–100. Vangelis-style ballads at 60–75, Oxygène pulse around 95.
- **Key/mode:** minor with major IV (Dorian), or Lydian for the "uplift".
- **Harmony:** slow triads [S: Oxygène pads as slow triads], with 2–4 bars per chord and suspension–resolution.
- **Drums:** Oxygène-style preset-box rhythm (rhythm-machine bossa/slow rock): `Kick X-----x-X-------`, `Hat x-x-x-x-x-x-x-x-` at -18 dB, `Snare ----x-------x---` short and noisy. Or none (Vangelis).
- **Pad (Oxygène) [S]:** string machine → 3 choruses (1.5 / 0.3 / 0.7 Hz, 10% intensity, 50% wet) → 6-stage phaser (100–6200 Hz, LFO 0.1 Hz) → 5 s hall at 55%.
- **Brass/lead (CS-80) [S]:** 2 pulses (osc 2 an octave up and -6 cents), LP 75% with res 15%, filter env A 650 ms / D 10 s, amp A 250 / D 1900 / S 40% / R 750, PW LFO at 1/8. **Map velocity and aftertouch to brightness and volume** [S]. Ribbon-style descending pitch slides of 2–12 semitones over 400–900 ms at phrase ends [S].
- **Whoosh/swoosh:** a filtered white-noise sweep (BP 200 → 6 kHz over 4 bars) at section changes, as in the Oxygène wind.
- **Bass:** ARP-2600-style [S]. Two saws slightly detuned (±3 cents), LP very low (about 30–80 Hz cutoff with heavy env mod), A 60 / R 2400.
- **Reverb:** a Lexicon-style large hall [S], 4–6 s at 35%.
- **Arrangement:** 1–8 pad and wind → 9–24 pulse and bass → 25–40 lead theme → 41–48 breakdown → 49–64 theme up a 4th with brass → fade.
- **Magic ingredient:** *expressive per-note brightness* (aftertouch) and pitch slides, which make the synth sound like it is singing.

### 12. "SAW Bedroom Ambient-Techno" (Aphex SAW 85–92)

- **BPM:** 95–125.
- **Key/mode:** minor or modal. **Detune the pad 25 cents flat** relative to the rest [S].
- **Harmony:** 2–4 dark pad chords. The pad outlines the progression [S].
- **Drums (R-8/808 [S]):**
```
Kick   X---x---X---x---   808 kick, reverb-drenched (Xtal) OR dry (Pulsewidth) [S]
Snare  ------x---o--x--   syncopated snare/rim [S]; layer: break-snare pitched -5 st [S]
Hat    x-xOx-xOx-xOx-xO   "two closed, one open" feel (O = open) [S]
Roll   ------------xxx-   triplet hat roll fills every 4th bar [S]
```
  An 808 kick repitched in a sequence acts as the bassline [S]: kick pitches follow the roots (e.g. 0, 0, -5, -2 semitones).
- **Lead (Ageispolis) [S]:** square, filter fully open, **VCA decay 73 ms, no sustain**, reverb about 26% wet (dark).
- **Stabs (Pulsewidth) [S]:** detuned saw/PWM, cutoff 100 Hz with key tracking, filter decay 350 ms, VCA decay 490 ms, 1/8 ping-pong at 29%, reverb 32%.
- **Pad [S]:** a DX-strings-like FM pad (2-op, ratio 1:1 with slight 1.003 detune, index 1.2, slow A 800 / R 2000) through LP at 800 Hz–1.12 kHz.
- **Bass (optional) [S]:** two detuned triangles. Or a "dark saw with high resonance, filter set low, soft attack".
- **Reverb:** a *dark, muddy* plate/room on everything [S: Quadraverb], 2.5 s with high damping (LP 4 kHz in the tail).
- **Master [S]:** gentle drive plus a cassette model (hiss, LP 12 kHz, slight wow).
- **Arrangement:** sections marked by switching **between two hat patterns and two kick patterns** [S]. 1–8 pad → 9–40 groove A → 41–56 groove B → 57–72 groove A with lead → fade.
- **Magic ingredient:** *naive melodies made eerie* by the flat-tuned pad and muddy reverb.

### 13. "Tycho Sunlit Chorus"

- **BPM:** 95–115.
- **Key/mode:** Lydian or Ionian with maj7/add9 chords, plus a vi to keep it wistful.
- **Harmony:** Imaj7–IVmaj7#11–vi9–V(sus), each held 2 bars.
- **Drums (live-band feel):**
```
Kick   X-----x---X--x--   
Snare  ----X-------X---   tight, room, -2 dB
Hat    xoxoxoxoxoxoxoxo   16ths, vel alternating 100/55, swing 54%
Perc   ------------x---   tambourine
```
- **Bass:** a picked electric-bass model (karplus with LP 1.2 kHz, decay 900 ms) in 8ths, following roots and 5ths. No sub synth.
- **Lead [S]:** a single triangle oscillator with a bright filter and quick filter-env decay (D 220 ms). Amp attack 3 ms (just above zero). **Chain: comp → EQ (HP 200 / LP 8k / +3 dB at 1.06 kHz) → plate at 15% → hall at 30% with modulation → 1/4 delay *after* the reverbs → heavy comp** [S].
- **Pad:** a Juno-style chorus pad (saw plus sub, chorus I+II, LP 2.5 kHz, A 600 / R 1800).
- **Guitar-like arp:** a karplus pluck in 1/8 with 1/8-dotted delay, panned 30% right.
- **Texture:** warm vinyl at -38 dB and a high shimmer (octave-up reverb at 10%).
- **Arrangement:** 1–8 pad and arp → 9–24 drums, bass, lead theme → 25–32 B-section with modulation up a whole tone → 33–48 theme and lead harmony → 49–56 outro.
- **Master:** high-mid presence; keep the sub small (HPF at 35 Hz on the master, low shelf -2 dB at 80 Hz).
- **Magic ingredient:** *the upper-mid "sunlight" EQ and chorus width*. Brightness without harshness.

### 14. "Polyrhythmic Modular Bloom" (Floating Points / Four Tet)

- **BPM:** 118–134 (LesAlpx-style peak) or 90–110 (Promises-style suite variant).
- **Key/mode:** Dorian or minor 9th chords, jazz-inflected (Floating Points), or a single circulating 7-note arpeggio [S: Promises].
- **Sequencing [S]:** three sequences at coprime lengths **16, 11, 5** steps. A second sequencer modulates the first (e.g. a 7-step lane transposes the 11-step lane by 0/+7/+12).
- **Drums (Four Tet "Three" rules [S]):**
```
Kick   X--x----X--x-o--   small, little sub, pitched up 2 st
Clap   ----x-------x---   pitched up 1–2 st [S]
CHat   xxxxxxxxxxxxxxxx   swing 54% [S], velocity random 40–90
OHat   --x-------x-----   decay automated longer mid-bar [S]
Perc   x--x--x--x--x--x   "delay-derived" rhythm: hits echoed through 2 delays [S] (3/16 and 5/16)
```
  Drum bus EQ'd thin (HP 80 Hz, LP 9 kHz) and turned down [S]. Vinyl crackle loop under the beat [S]. Optional ring mod on hats (180 Hz) [S].
- **Bass:** a simple sine/triangle at low level (ES1-style [S]), played with the 5-step lane.
- **Bloom voices:** Buchla-like "bongo" (sine → low-pass gate with A 1 / D 200 exp, i.e. both amp and LP cutoff close together), FM figure (EMS-like, ratio 1.41, index modulated by a 0.1 Hz LFO) [S: FM'd by Buchla].
- **Melodic interplay [S, Four Tet]:** duplicate the melody to a second voice that plays it reversed or shortened.
- **Texture:** a long drone layer (saw pair → LP 500 Hz) for "luminous breakdowns" [S FADER phrase], with a 6 s reverb.
- **Arrangement:** 1–16 sequences only → 17–48 drums enter at "delirious" density → 49–64 luminous breakdown (drums out, drone and 7-note arp, strings) → 65–96 full return, more polyrhythm lanes → 97–112 dissolve into the circulating arp.
- **Magic ingredient:** *coprime sequence lengths plus delay-generated rhythms*. Order emerges from systems.

---

## Part D: Making the 14 styles actually feel different [I]

A comparison matrix the engine can use to keep styles far apart:

| # | Style | BPM | Pulse feel | Drum kit model | Bass model | Hero voice | Space | Form |
|---|---|---|---|---|---|---|---|---|
| 1 | Hopkins Crescendo | 104–124 | 4/4 driving | layered distorted, room-sampled | sustained sidechained saw | MS-20 riff + gated saws | deep stage | long linear ramp, then piano cut |
| 2 | Felt + Minimal | 118–124 | 4/4 soft | 909-down + piano snare + live shakers | MS-10 offbeat | felt piano + Juno pad | one plate | intro→groove→strings break |
| 3 | Frahm Polymeter | 100–120 | arp only | none | held root | polymetric pulse arp | spring/tape | one filter ramp |
| 4 | RC Analog Bloom | 80–110 | broken, sparse | lo-fi + brushes | ladder mono | Prophet poly + tape feedback | tape echo | weak/strong waves |
| 5 | Melodic Techno | 122–126 | 4/4 club | tight 909 + tonal toms | rolling 16ths | ridden arp | big hall | club arc 96 bars |
| 6 | BoC Nostalgia | 78–96 | hip-hop swing | dusty, bitcrushed | wobbling sub-saw | detuned pad | wet, LP | short song, tape stop |
| 7 | Burial Shuffle | 130–140 | 2-step, off-grid | wooden impacts | sine sub swells | ghost vocal | huge, dark | non-sectional drift |
| 8 | Reich Phasing | 140–200 | 1/16 pulse | none or claps | none | marimba/piano cells | dry | phase cycles |
| 9 | Eno Loops | free | none | none | none | choir/Rhodes loops | 9 s reverb | endless |
| 10 | Berlin Sequencer | 110–135 | 1/16 sequence | none/ticks | the sequence | saw+pulse seq | synced delay | multi-minute sweeps |
| 11 | Cosmic Anthem | 65–100 | rhythm box / none | preset rhythm box | low ARP | CS-80 brass w/ slides | Lexicon hall | theme, key lift |
| 12 | SAW Ambient-Techno | 95–125 | 4/4 bedroom | R-8 808, tuned kick | 808 as bass | square pluck + flat FM pad | muddy | 2-pattern switching |
| 13 | Tycho Sunlit | 95–115 | live band | tight live kit | picked bass | triangle lead | plate+hall | verse/B/verse |
| 14 | Modular Bloom | 90–134 | polyrhythmic | small pitched-up + delay perc | quiet sine | Buchla bongo/FM | mixed | breakdown-centred |

**Variety rules for the generator**
1. **No two consecutive generations from the same row.** Prefer jumping across "Pulse feel" groups.
2. **Within a style, randomise inside the ranges** (BPM, key, lane lengths, cutoff ramp lengths, which optional layers appear). Do not randomise *across* style signatures. A Burial piece should never get a 909.
3. **Per-style harmony generator.** Static drone (1, 3, 10), 2-chord oscillation (1, 7, 12), 4-chord loop (2, 5, 13), voice-led progressions (4, 11), pitch-set without functional harmony (8, 9, 14).
4. **Per-style randomness.** Tight grid (5, 10), swing (6, 13, 14), humanised (2, 4), off-grid (7), drift processes (8, 9).
5. **Mutation over time, not just layering.** Every style should have at least one *process* that changes for the whole piece: a filter ramp (1, 3, 5, 10), phase offset (8), loop drift (9), unison→independence (4), pattern switching (12), tape pitch drift (6).

---

## Part E: Drop-in sound recipes for the complaint areas [I unless tagged]

**Kicks (choose per style; never one global kick)**
- *Club 909-ish (5):* sine 190 → 52 Hz with exponential pitch env τ = 35 ms; amp decay 380 ms; click layer (noise HP 3 kHz, 4 ms); light saturation at 3 dB; HPF 30 Hz [S on low-cut].
- *Kiasmos soft (2):* the same model pitched down 2 st, LP 2.5 kHz, amp decay 260 ms, no click.
- *Hopkins distorted (1):* 3 layers (see style 1), tanh drive 15 dB, then compression. All hits identical [S].
- *Burial wooden (7):* band-passed noise plus a short 90 Hz sine (decay 90 ms), LP 800 Hz, ±15 ms jitter.
- *808 bedroom (12):* sine 60 Hz with a small pitch env (+12 st → 0 over 15 ms), decay 900 ms, tuned per root [S: repitched as bassline].
- *BoC dusty (6):* the 808 model with decay 450 ms, 12-bit/26 kHz, LP 5 kHz.
- *Four Tet small (14):* sine 120 → 70 Hz, decay 140 ms, pitched up 2 st [S: pitch drums up], HP 60 Hz.

**Snares/claps**
- *Layered (1):* noise burst (BP 2 kHz, decay 140 ms) + 200 Hz sine body (decay 60 ms) + clap (3 noise bursts spaced 11 ms) + room, each with its own reverb [S on the layering principle].
- *Piano snare (2):* low piano cluster (e.g. C2+D♭2+G2) at velocity 70, decay cut at 250 ms, plus rim [S].
- *Brushed (4):* noise with slow attack (25 ms) and decay 300 ms, BP 1–5 kHz, with random amplitude modulation.

**Bass anti-harshness checklist**
- Filter before you saturate, then filter again: osc → LP (style cutoff) → tanh (2–6 dB) → LP at 2× cutoff.
- Mono below 120 Hz. Sidechain to the kick at -4 to -10 dB depending on style.
- Cap resonance at about 35% except in deliberate acid/Berlin styles.
- Per [S] Rival Consoles: heavy but never upfront. Per [S] Aphex: "little high end".

**Piano anti-cheese checklist**
- Felt model: LP 1.8–3 kHz tracking velocity; velocity range 25–65; hammer-felt thump (LP noise at 300 Hz, 15 ms) at -20 dB; mechanical noise at -30 dB; pedal down with resonance.
- Voicings: spread, 5th/9th-heavy, no root-position triads in the middle register; strum 8–25 ms.
- Space: close-mic dry (no big reverb) *or* tape echo with no repeats [S, Kiasmos]; avoid a generic bright hall.
- Rhythm: rubato ±20 ms; occasional half-speed octave-down echoes [S Eno trick].

**Pluck alternatives (to replace the bell)**
- Square 73 ms pluck (12) [S]; triangle Moog lead (13) [S]; Juno arp + spring (3); low-pass gate "bongo" (14); karplus guitar (13); gated saw slices (1) [S].

---

## Sources

1. https://musicradar.com/news/jon-hopkins-open-eye-signal-korg-ms-20: Hopkins on the MS-20 "Open Eye Signal" riff, four months of sound refinement, Immunity remaster.
2. https://www.pressreader.com/australia/computer-music/20190515/281646781575973: Computer Music 2019 Hopkins interview: identical kicks, destructive editing, hot miking piano, Bubbler, subtraction arranging.
3. https://www.pressreader.com/australia/future-music-9629/20180503/282162176825397: Future Music 2018 Hopkins Singularity interview: layered kicks and snares, sound-led writing, Octava piano mics, spatial placement.
4. https://www.loopcloud.com/cloud/blog/4469-Inspired-origins-Jon-Hopkins: Loopcloud profile of Hopkins: destructive working, spatial mixing, resampling.
5. https://www.spinmagazine.com/2013/07/jon-hopkins-immunity-interview/: Spin interview: repetition and gradual evolution, melodyless rhythm tracks.
6. https://en.wikipedia.org/wiki/Immunity_(Jon_Hopkins_album): Immunity track lengths, homemade sounds (desk, window rattle kick element).
7. https://www.undertheradarmag.com/interviews/jon_hopkins_on_singularity: Singularity's arc, "patiently built ramps".
8. https://isotonikstudios.com/jon-hopkins-sidechain-gate-trick-on-ableton-push-3/: the Hopkins-style sidechain gate technique.
9. https://isotonikstudios.com/recreate-that-john-hopkins-sound-in-ableton-live/: detuned saws plus flipped gate plus sidechain from the same rhythm.
10. https://blog.native-instruments.com/creating-atmospheres-with-rival-consoles/: Rival Consoles gear, EQ at 2–3 kHz, bass placement, weak/strong arrangement.
11. https://www.stampthewax.com/2018/05/24/talking-tech-rival-consoles/: Rival Consoles Prophet improvisation, Space Echo 555, brushed snare, "Unfolding" on unison.
12. https://www.popmatters.com/rival-consoles-interview-2557220148.html: Rival Consoles on unison-to-independent rhythm, varied tempos, subtlety.
13. https://factmag.com/2016/09/26/rival-consoles-guides-us-gear-uses-make-intricate-electronica: FACT gear-tour summary (categories only).
14. https://musicradar.com/news/kiasmos-talk-tape-loops-and-concert-hall-raves: Kiasmos 909 kick, piano-hit snare on "Blurred", Juno-60, tape loops, one reverb per song.
15. https://headphonecommute.com/2014/10/27/in-the-studio-with-kiasmos/: Kiasmos Space Echo with no repeats, beat-first workflow.
16. https://www.electronicsound.co.uk/features/long-reads/olafur-arnalds-ghost-playing-the-machines: Ólafur Arnalds' semi-generative Stratus self-playing pianos.
17. https://en.wikipedia.org/wiki/Felt_(Nils_Frahm_album): felt on strings, mics inside the piano.
18. https://www.roland.com/uk/blog/nils-frahm-on-his-favourite-vintage-music-gear/: Frahm's Juno-60 used like an organ, RE-501s, Rhodes DI.
19. https://www.attackmagazine.com/technique/tutorials/nils-frahm-style-polyrhythmic-arps/: Frahm-style polymetric arp intervals and lane lengths.
20. https://www.imaginando.pt/news/how-to-make-the-arpeggio-sound-for-nils-frahm-says-in-drc: "Says" arp recreation (tools only, no values).
21. https://musicradar.com/news/moderat-interview: Moderat's dislike of clean synths, broken tape echoes, resampling, melody-first workflow.
22. https://www.soundonsound.com/people/four-tet-kieran-hebden: Four Tet's MIDI swing, audio editing, reversed/shortened melody copies, tape loops.
23. https://musictech.com/tutorials/7-music-production-techniques-four-tet-three/: Four Tet "Three" drum techniques (swing 54, pitch-up, thin drum bus).
24. https://www.musicradar.com/news/floating-points-recording-at-96khz-is-definitely-not-cool-its-completely-pointless: Floating Points Buchla 252 sequences at 16/11/5 steps, delay-chain rhythms.
25. https://thefader.com/2019/08/28/floating-points-crush-interview: Floating Points Crush process, Buchla plus Chroma, LesAlpx description.
26. https://www.npr.org/2021/03/24/980433831/pharoah-sanders-floating-points-promises-review-new-sounds: Promises' circulating seven-note arpeggio.
27. https://www.ableton.com/en/blog/bonobo-path-to-migration/: Bonobo hand-drawn timing, no quantise, re-pitching, layer-then-subtract.
28. https://reverbmachine.com/blog/aphex-twin-selected-ambient-works-85-92/: SAW 85–92 recipes (Ageispolis 73 ms pluck, Pulsewidth values, pad 25 cents flat).
29. https://www.musicradar.com/news/how-aphex-twin-made-saw-85-92: SAW gear, cassette recording, hi-hat patterns, 808 kick as bassline.
30. https://gasnewsletter.beehiiv.com/p/boards-of-canada-deep-dive: Boards of Canada gear, tape collage, destructive resampling, "keep things simple" quote.
31. https://flypaper.soundfly.com/produce/emulating-boards-of-canadas-classic-synth-sound-without-breaking-your-bank-or-brain/: BoC emulation (HP 120 Hz / LP 6 kHz, LFO targets).
32. https://syntorial.com/preset-recipe/boards-of-canada-sundown-pad: BoC "Sundown" pad patch values.
33. https://www.attackmagazine.com/technique/synth-secrets/recreating-the-roygbiv-bassline-from-boards-of-canada/: BoC "Roygbiv" bassline recreation values (80 BPM, pitch LFO).
34. https://www.musicradar.com/artists/once-i-change-something-i-can-never-un-change-it-how-the-rigid-limitations-of-basic-audio-editing-software-were-key-to-the-magic-of-burials-greatest-album: Burial's Sound Forge workflow, off-grid drums, crackle, vocals.
35. https://www.attackmagazine.com/technique/beat-dissected/burial-ghost-hardware/: Burial "Ghost Hardware" beat dissection with processing values.
36. https://www.attackmagazine.com/technique/beat-dissected/garage-shuffle/: garage shuffle spec (120–125 BPM, 60–65% swing).
37. https://www.attackmagazine.com/technique/beat-dissected/rolling-2-step-garage/: rolling 2-step spec (122–128 BPM, 60–65% swing).
38. https://reverbmachine.com/blog/tycho-awake-synth-sound: Tycho "Awake" triangle lead and effects chain.
39. https://djmag.com/longreads/stephan-bodzin-how-i-play-live: Bodzin's Sub 37, Matriarch, DR-2, scene-based live structure.
40. https://www.attackmagazine.com/?p=100859: Bodzin Boavista per-track gear (tonal toms, arps, Sub 37 basslines).
41. https://15questions.net/interview/fifteen-questions-interview-kolsch/: Kölsch's melody-first philosophy, 303/909/M1, 30-minute rule.
42. https://torturetheartist.net/2019/04/18/in-the-studio-with-innellea/: Innellea's Minibrute sub bass, kick low-cut at 30 Hz, sidechain.
43. https://productionmusiclive.com/blogs/news/producer-notes-innellea-melodic-techno-afterlife-style-in-ableton: Innellea-style traits (metallic stabs, trance gates, call and response).
44. https://www.beatportal.com/articles/899368-step-by-step-guide-to-creating-a-melodic-house-techno-track-anyma-miss-monique-artbat-stephan-bodzin: melodic techno template (BPM, progressions, arrangement bars, HPF 120 Hz).
45. https://reverbmachine.com/blog/deconstructing-brian-eno-music-for-airports/: Music for Airports loop lengths, notes, half-speed piano.
46. https://en.wikipedia.org/wiki/Tape_loop: Eno's 79 ft/83 ft loops, Reich's It's Gonna Rain phasing.
47. https://en.wikipedia.org/wiki/Piano_Phase: the Piano Phase 12-note figure and phasing procedure.
48. https://en.wikipedia.org/wiki/Phaedra_(album): Tangerine Dream's Moog sequencer as bass, oscillator drift, Mellotron with phasing device.
49. https://www.pressreader.com/australia/computer-music/20160810/282896615001578: Berlin School sequence patch (8 steps, envelope values, 6/8 delay).
50. https://musicradar.com/news/jean-michel-jarre-best-synth-sound: Oxygène IV instruments and ARP 2600 recreation values.
51. https://www.pressreader.com/australia/computer-music/20220323/282114935057498: Oxygène-style pad (three choruses, phaser, 5 s hall values).
52. https://reverbmachine.com/blog/vangelis-blade-runner-synth-sounds: Vangelis CS-80 aftertouch/ribbon behaviour, Lexicon 224.
53. https://www.syntorial.com/preset-recipe/vangelis-blade-runner-brass/: Blade Runner brass patch values.
