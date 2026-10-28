# 01 — What makes Max Cooper sound like Max Cooper

Research report for a browser-based, real-time generative synth that aims for the Max Cooper aesthetic.
Compiled 2026-10-28 from interviews, his own project notes (maxcooper.net, yearningfortheinfinite.net, emergence.maxcooper.net, unspokenwords.net), Ableton.com features, MusicRadar, Future Music, XLR8R, RBMA and reviews. Every URL is listed in section 8.

**Legend**
- **[S]**: sourced. Stated by Cooper or in his own project notes. Quotes are verbatim, as returned by the source.
- **[3P]**: sourced from a third party (a reviewer, a tutorial maker, or Spotify-derived BPM/key data). Treat these as approximate.
- **[I]**: my inference or engineering translation. Not stated by any source. This includes listening impressions and suggested numbers for the engine.

**Corrections to the brief**
- *On Being* came out in February 2025, not 2024.
- *Seme* (2023) is an EP.
- "Four Tones Reflected", "Becoming" and "This Is A Bridge" are on the 2026 album *Feeling Is Structure* (Mesh, May 2026).
- "Repetition" is on *Yearning for the Infinite* (2019). Its video is by Kevin McGloughlin; no Kevin Cooper is credited.
- "Waves" is on *Emergence* (2016/17), with Tom Hodge on Fender Rhodes.
- "Solace in Structure" and "Exotic Contents" are on *Unspoken Words* (2022).
- "Swarm" is on the *Earth* EP, written during the 2020 lockdown.
- "8 Billion Realities" is the title track of an EP with Rob Clouth, featuring FLOHIO.
- "Resynthesis" is on *One Hundred Billion Sparks* (2018).
- "Origins" is from the *Kindred* EP (2014) and also appears as an *Emergence* chapter.

---

## 1. Executive summary: 15 traits the engine must reproduce

1. **The chord progression is the song. Everything else decorates it.** [S]
   - Cooper calls chord progressions "the one connecting factor between all my music". The feeling of the progression is "often the starting point".
   - On "The Shape of Memory": "it's all about the feeling of the chord progression really".
   - Many pieces are deliberately "mainly just a single chord sequence" (Unspoken Words, ch. 4). "Gödel's Incompleteness" uses only three synth chords.
   - **Engine [I]:** use 3–4 chords per piece, each held 2–8 bars (8–32 beats). Build the generator around one strong loop of chords. Do not use a Markov chain that changes chords every bar.

2. **Harmony is ambiguous and bent, not resolved.** [S/3P]
   - He sets up familiar progressions "and then bends them rather than resolving them" (Unspoken Words, ch. 4). "Spectrum" was written to hold "hope, happiness, sadness, and reflection at once".
   - A third-party transcription of "Resynthesis" [3P] shows these voicings:
     - Ab7 (G#2-C3-D#3-F#4)
     - E/G# add9 (G#2-B2-E3-G#3-B3-F#4-F#5)
     - a third-less sus voicing (G#2-C#3-F#3-G#4)
     - E with #11 and add9, no third (E2-A#3-B3-F#4)
   - Spotify key estimates [3P] are split between major and minor: A minor, C#/Db major, B major, D major.
   - **Engine [I]:** favour sus2, sus4, add9, maj7#11 (Lydian), m9, and bare fifths or fourths. Prefer pedal tones or a static bass under moving upper voices. Never use V→I cadences. Avoid plain triads in root position.

3. **Warm analogue polysynth chords, not supersaws or FM bells.** [S]
   - Prophet-6 is "my most used synth". Ebb and Flow has a "P6 vibe with those magic resonant overtones". The Juno-6's chorus and filter modulation are central to his sound.
   - The Prophet '08/'8 handled chords and pads earlier.
   - **Engine [I]:** 2 oscillators (saw plus pulse) per voice, detuned ±3–8 cents. Use a 4-pole resonant low-pass with cutoff around 600 Hz–3 kHz and resonance around 0.3–0.6, so overtones sing.
   - Juno-style chorus: 2 delay lines of about 3–7 ms, LFO about 0.5–0.9 Hz, panned opposite.
   - Attack 5–80 ms, release 0.5–3 s.

4. **"No sound that happens twice."** [S]
   - "to make a whole album where there's no sound that happens twice". Repeated drum hits are slightly modulated each time (RBMA).
   - **Engine [I]:** every note or hit takes small random offsets (S&H per event):
     - filter cutoff ±10–25%
     - decay ±15%
     - pitch ±3–10 cents
     - pan ±0.2
     - drive ±20%
     - sample-start jitter
     - occasional swap to another sample variant

5. **Random-waveform LFOs on everything: the "liquid timbre".** [S]
   - He assigns random-waveform LFOs to synth parameters. He calls the LFO "a very underrated tool" and wants timbres that flow and morph.
   - Max for Live devices make parameters wander within bounds and link one parameter to another.
   - He keeps a filter partly open with a slow LFO.
   - **Engine [I]:** give each voice and FX parameter a smoothed random walk (0.02–0.3 Hz) clamped to a range. Link some walks (for example, drive up means cutoff down).

6. **Micro-detail percussion instead of a "kit".** [S]
   - Percussion comes from "field recordings and his own sample library". He prefers "single hits" for "detailed, clicky percussion".
   - Reviewers describe "very small drum patterns" set against expansive textures.
   - "I mix my melodies louder and drums quieter than normal club music."
   - **Engine [I]:**
     - Synthesise clicks, ticks and noise grains from 1–15 ms bursts, band-passed at 2–12 kHz.
     - Add tiny pitched blips and filtered noise.
     - Sit drums 6–10 dB below the chord bed.
     - Do not use a stock 909 snare.

7. **Bass: simple, clean, separate.** [S]
   - Operator is used "for basslines when he needs a clean sub". The Minitaur provides "nice Moogy bass stabs" on all the *Yearning* tracks. The Moog One is now his main bass synth.
   - His XLR8R advice: keep bass "clean and simple"; cover 30/40 Hz up to about 200 Hz. Character comes from the upper bass and mids. High-pass everything else. Separate bass hits in time or frequency.
   - **Engine [I]:** use a sine or triangle sub, plus an optional low-pass-filtered saw stab one octave up (cutoff 200–600 Hz, short decay 150–400 ms). Use one bass voice at a time and keep it monophonic.

8. **Sidechain only the low band.** [S]
   - "I'll side chain only onto the low so that the higher frequencies don't get pumped around the kick." He also uses "fast-release sidechaining between bass elements … without obvious pumping".
   - **Engine [I]:** use a crossover at about 150 Hz. Duck only the lows by 3–6 dB, with release 60–120 ms. Never pump the pads.

9. **Prime-number loop lengths, so nothing repeats.** [S]
   - "Penrose Tiling" uses "many loops of prime number lengths, so that their combined structure would not repeat for the length of the track". Every loop length is "a prime-number multiple of the same value", creating "non-repetitive syncopation".
   - **Engine [I]:** run several layers with loop lengths of 3, 5, 7, 11, 13, 17 or 19 steps. With 16th steps, 7×11×13 = 1001 steps before the pattern repeats.

10. **Phase drift and slow emergence of rhythm.** [S]
    - "My Mind Is Slipping": "I had six notes in a chord … every note repeats at a very slightly different tempo".
    - "Order from Chaos": random binaural raindrops are pushed toward the nearest grid positions, so a rhythm emerges that he never composed directly.
    - **Engine [I]:**
      - Phase mode: give each chord tone its own period, 1.000×, 1.003×, 1.007× and so on.
      - Emergence mode: give each event a timing jitter that decays from 100% random to 0% over 1–3 minutes.

11. **Interlocking polyrhythmic arpeggiators and pulsing riffs.** [S]
    - "Anatomic" uses multiple polyrhythmic arpeggiators playing interlocking patterns.
    - "Distant Light" is a repetitive, syncopated two-note motif under a gradually layered chord structure.
    - "Cyclic" is an arpeggiated riff in a looped structure that only builds.
    - **Engine [I]:** run 2–3 arps on chord tones at 3-, 4- and 5-step periods, with a soft sine/triangle or filtered pulse timbre. One plays a 2-note motif.

12. **Additive long builds; sculpted, not structured.** [S]
    - "I often think the way I work is more like a sculptor than a musician." He puts in "more layers than I should do" (200+ layers on some *Yearning* tracks), then removes material.
    - "A Sense of Getting Closer" uses a "long build format".
    - Fuck Buttons' "Stalker" taught him about gradual pacing.
    - **Engine [I]:**
      - Start sparse (one chord voice plus texture).
      - Add one layer every 8–32 bars.
      - Reach the peak at about 60–75% of the piece, then thin out.
      - Tracks run 4–8 minutes.

13. **Space: binaural, haas-widening, plate reverb, tape echo.** [S]
    - Binaural in-ear recordings appear throughout.
    - He uses "a short delay of a few milliseconds between left and right channels" for width.
    - Strymon BlueSky plate, ValhallaRoom, Roland Space Echo and El Capistan tape echo.
    - Each layer gets its own position via a "binaural panner or spatial audio system".
    - **Engine [I]:**
      - Haas offsets of 3–15 ms on some layers.
      - A plate reverb (decay 2–5 s, high damping) on chord voices, plus a large dark hall for drones.
      - Tape-style feedback delay with wow/flutter and a saturated, filtered feedback path.
      - Slowly moving pans on micro-percussion.

14. **Saturation and lo-fi degradation everywhere, applied lightly.** [S]
    - Moogerfooger distortion for "subtle saturation" on many sounds. Geiger Counter "used quietly for crackle and fuzz". Meet Maude for "rich, lo-fi saturation". Generation Loss for lo-fi effects.
    - "My Mind Is Slipping" went through "multiple passes of pedals to give it a lo-fi, softened feel".
    - **Engine [I]:**
      - Soft-clip (tanh) on every bus, drive 1.2–3×.
      - Optional wavefold or bitcrush at low mix (10–25%).
      - Tape wow (0.3–1 Hz, ±5–15 cents).
      - Vinyl/crackle noise at -40 to -30 dB.
      - Darkening low-pass (8–12 kHz) on "softened" layers.

15. **Imperfection is a design goal.** [S]
    - "Music without imperfection is sterile."
    - Feeding clean MIDI chords into hardware and playing over them introduces "errors … more humanized, less rigid".
    - He loves "the sound of broken machines". Old gear "often misbehaves in a really beautiful way".
    - **Engine [I]:**
      - Humanise timing ±5–20 ms on chords and strum chord notes 5–40 ms apart.
      - Vary velocity.
      - Add occasional dropouts, stutters (Microcosm-like), or a bent note (±20–50 cents glide).

**Tempo [3P, Spotify-derived, treat as approximate]:**
- Unspoken Words (ambient): 65
- Swarm: 102
- Waves: 111
- Origins: 118
- Aleph 2: 118
- Perpetual Motion: 119
- Transcendental Tree Map: 119
- Resynthesis: 120
- Repetition: 121
- Void: 123
- A Fleeting Life: 128
- Adrift: 136
- 8 Billion Realities: 137
- Order from Chaos: listed at 152, probably a broken-beat feel at about 76 or 152 half-time

A sensible default band is **110–124 BPM**. Use 60–80 for ambient pieces and 136–140 or 170 half-time ("Exotic Contents" is "half time drum and bass") for intense pieces.

---

## 2. Gear and sound design, per element

### 2.1 Gear timeline [S]

**2005–~2014: laptop era.** [S]
- Laptop, Ableton, KRK monitors. He couldn't afford hardware.
- Native Instruments Absynth, Reaktor, Massive and Kontakt; Synplant ("unusual noises"); Arturia Moog Modular V; ValhallaRoom (go-to reverb); Operator.
- *Human* was "almost entirely" made in Ableton, with sampled strings and piano composed by him. The Minitaur appears on one track.
- iPad: Animoog, and Lemur with "bouncing balls" controlling many parameters, which gives semi-generative results.

**~2014–2016: first hardware.** [S]
- Moog Minitaur (bass), Moog Sub 37 ("super fat", bass and leads), Prophet '08 (chords and pads, "a lot of routing").
- Yamaha DX7 and Korg Poly-800, both "for experimenting".
- WMD Geiger Counter, Watkins Copicat tape echo.
- On *Emergence* (Future Music 2016): Juno-6 into a Space Echo and pedals, Prophet-8 chords, Minitaur bass stabs on "Waves".
- Sub 37 driven by Sugar Bytes Obscurium MIDI; DtBlkFx (FFT spectral plugin) for "weird noises and percussion".

**2018–2019** (*One Hundred Billion Sparks*, *Yearning*): [S]
- Prophet-6 is the main synth. Moog One is used less. The Minitaur provides bass stabs "on all of the tracks".
- Pedals: Meet Maude, MIDI MuRF, Geiger Counter, Industrialectric RM-1N ("extreme feeding back chaos"), Strymon BlueSky (plate), Space Echo, El Capistan, Metasonix F1.

**2020–2024:** [S]
- Arturia PolyBrute: "adventurous modulations and morphing timbres" (*Earth* EP), and "big, aggressive, distorted sounds" on "Exotic Contents".
- Novation Summit ("aggressive, digital-sounding", on "Spike" and "Vertebrae"), Trigon-6, Moog Taurus (bass stabs).
- Pedals: Chase Bliss Dark World (pads), Generation Loss, Hologram Microcosm (glitchy staccato), Chroma Console, Bastl Thyme (glitchy tape delay with an LFO per parameter).
- He estimates "95% hardware synths and pedals for all the melodic elements". Digital processing comes later in Ableton.

**On Being / Feeling Is Structure (2025–26):** [S]
- Operator default patch to sketch chords, then Prophet-6.
- Wavetable for later sound design.
- Robert Henke's three-band crossover and multiband tool.
- Atmos mixes throughout.

**Takeaway [S/I]:** the palette is restricted ("It's all about keeping the palette restricted for me"). It is mostly analogue subtractive polysynth through saturating and lo-fi pedals, with a few digital oddities (FFT, granular, wavetable). This is the opposite of a preset-hopping FM, Karplus-Strong and supersaw palette.

### 2.2 Pads and chords

- **[S]** Prophet-6/8 and Juno-6 chords.
  - "The Shape of Memory": "classic retro synth timbre with lots of irregular detailing".
  - "Ebb and Flow": soft, flowing synths with "magic resonant overtones".
  - "Let There Be": "sparse, drawn-out chords with many layers of pedal saturation".
  - Pads get their ethereal character from the Dark World reverb.
  - He uses "constant chords and constant notes" (sustained harmonic material) to create immersion.
  - Layering long-release notes with a slow LFO on a partly open filter produces "gritty, evolving textures".
- **Recipe [I]:**
  - **Oscillators:** saw + pulse (PW 30–45%, slow PWM 0.1–0.3 Hz), detune ±5 cents, sub-oscillator -1 octave at -12 dB.
  - **Filter:** 24 dB/oct low-pass. Cutoff around 800 Hz–2.5 kHz, resonance 0.35–0.55, envelope amount small and positive. Random-walk LFO on cutoff (±30%, 0.05 Hz).
  - **Amplitude:** attack 20–400 ms, decay 1–2 s, sustain 0.7, release 1.5–4 s.
  - **Chain:** chorus (Juno-style), then tanh saturation (drive 1.5–2), then plate reverb (decay 3–4 s, pre-delay 20 ms, mix 25–35%), then tape delay (3/16 or dotted 1/8, feedback 25–40%, low-pass 3 kHz in the loop, mix 10–20%).
  - **Voicing:** spread over 2.5–3 octaves with root or fifth in the bass. Avoid close-position triads.
  - **Behaviour:** the per-note strum and per-chord cutoff randomisation in trait 4 remove the "preset" feel.

### 2.3 Stabs, arps and sequences

- **[S]**
  - "Repetition" is "built on simple repeated Prophet 6 stabs, with pads and a Minitaur bass line".
  - "Resynthesis" keys have been recreated by Imaginando and in Sonic Pi [3P]. The Sonic Pi version uses saw/dsaw/square voices, a filter sweep from cutoff 60 to 100 (MIDI-note scale) and back over 32 steps, and an amplitude LFO.
  - "Waves": a "classic synth approach", with Sub 37 lines driven by Obscurium-generated MIDI.
  - "Cyclic": an arpeggiated riff. "Anatomic": polyrhythmic interlocking arps. "Distant Light": a syncopated two-note motif.
  - "Pattern Index": "Hardware-driven sequences" and a "large set of melodic pattern building blocks".
  - Transcendental Tree Map has "rich blip sounds" from the Moog One.
- **Recipe [I]:**
  - **Stabs:** same oscillators as the pad, but with a filter envelope: attack 0, decay 120–300 ms, envelope amount high, sustain 0, amp decay 200–500 ms, resonance 0.4–0.6. Play a 16- or 32-step boolean pattern with about 40–55% density (the "Resynthesis" transcription has 17 of 32 steps). Sweep cutoff across the pattern with a triangle over 2 bars. Send to the delay.
  - **Blips:** a sine or triangle with a fast pitch envelope (+12 to +24 semitones dropping to 0 in 5–15 ms) and a 30–120 ms decay, at high register (C5–C7). Scatter them across the stereo field.
  - **Arps:** pick chord tones by random choice ("pick 3 chord tones" in the Sonic Pi model), or step through them with a prime-length pattern. The rate is a 16th or triplet 16th.

### 2.4 Plucks

- **[S]** Plucks appear, but as texture rather than lead.
  - In "Woven Ancestry", ancient stringed instruments play separate melodies and rhythms that layer together, described as "plucked noises playing different rhythms". In 4D Sound he mapped the plucks to falling drops, "like rain falling".
  - "Origins" and "Penrose Tiling" start with a live **sansula** (a kalimba-like thumb piano).
  - *Traum*-era "Compact Yourself" has "ping-pong-style bells" [3P]. This is the one documented case of bell-like tone, from the early era.
- **[I]** The brief's "constant bell-like pluck" is un-Cooper-like when it is the lead. Use plucks sparsely and in many simultaneous rhythms:
  - many quiet plucks, each with its own prime-length loop
  - wide random pan
  - short reverb
  - a woody or kalimba timbre: Karplus-Strong with heavy damping (low-pass in the loop around 1.5–3 kHz, decay 0.3–1 s) plus a soft attack transient, not a bright FM bell

### 2.5 Bass

- **[S]**
  - Operator sine for a clean sub. Minitaur, Taurus and Moog One for stabs and "full, simple sounds".
  - "Obsessive Compulsive Order" came from "many months fiddling with bass sounds".
  - The *Earth* EP has "constant low-end harmonies".
  - "Void" has "heavy low resonances". "When I Sit Alone…" uses heavy compression to make a sub "overwhelm the other elements". These are exceptions, used for intensity.
- **Recipe [I]:**
  - **Default:** a sine sub following the chord root, with glide 0–30 ms and soft saturation (tanh, drive 1.3) to add a 2nd/3rd harmonic so it reads on small speakers. Low-pass at 120 Hz.
  - **Optional stab layer:** a saw one octave up, 24 dB low-pass at 250–500 Hz, filter-envelope decay 150 ms, on syncopated off-beats.
  - Do not run multiple bass voices at once.
  - Keep the bass lower in level than you'd think, because his mixes put melody first.
  - Avoid the harsh-bass failure mode: don't push raw saws through distortion into the sub range. Distort the stab layer only after low-passing, or distort and then low-pass.

### 2.6 Kick

- **[S]**
  - *Human* has "hardly an evenly-spaced kick in my whole album". Live club sets do keep a groove.
  - Kicks get sidechain priority but only the low band ducks.
  - Penrose has "layers of tight percussion". Drums by Adam Betts (live drummer) appear on *Yearning* and "Pattern Index".
- **Recipe [I]:**
  - Short, round kick: sine with a pitch sweep from 120–160 Hz down to 45–55 Hz over 30–60 ms, amp decay 180–350 ms, a 1–3 ms click transient (filtered noise) at -12 dB.
  - In the beat-driven section, place it four-on-the-floor or broken (positions 0, 7, 10 of 16).
  - In ambient sections, use no kick, or a muffled kick low-passed at 200 Hz.
  - Vary decay per hit.
  - Mix it about 3–6 dB lower than a typical techno kick.

### 2.7 Hats, percussion and clicks

- **[S]**
  - Clicky one-shots from field recordings: "a broken twig", a nail scraping a surface, workmen driving metal poles ("Cyclic").
  - "Seething clicks" sit behind the main parts.
  - He layers "short, high-octave click versions of synths" to make them cut through.
  - "Peace Exists Here" has "clicky details and micro-jams".
  - "Solace in Structure" has "many layers of sounds constrained to a precise rhythmical grid".
- **Recipe [I]:**
  - Build a library of procedural micro-hits:
    - noise bursts of 1–8 ms through a resonant band-pass (2–10 kHz, Q 5–15)
    - metallic hits from 3–6 inharmonic sine partials with 20–80 ms decay
    - "wood" from a short Karplus-Strong burst
    - granular snippets of a recorded or noise buffer, 5–30 ms grains
  - Trigger them from several prime-length patterns at 16th or 32nd resolution with probability 0.2–0.6.
  - Randomise pitch, pan and filter per hit. Ratchet occasionally (2–4 repeats at 1/64).
  - Keep them at -18 to -28 dBFS.

### 2.8 Textures, glitch and field recordings

- **[S]**
  - Binaural rain ("Order from Chaos"), a struck large metal structure ("Void"), a Taichung night market ("When I Sit Alone"), a forest walk, a building site.
  - FFT effects and granular synthesis are the jobs he gives to software.
  - Feedback matrices route audio through looping effect chains to create generative audio ("Inside the Black Hole").
  - "Broken Machines Broken Dreams": "more than 200 layers of warblings", searching for "machine artefacts".
  - Microcosm and Bastl Thyme for staccato and glitch variations.
- **Recipe [I]:**
  - A constant low "bed" layer at -30 to -24 dB: filtered noise or a looped field recording, slowly panned.
  - A rain-like stochastic click source (Poisson process, 5–40 events/s) that can be gradually quantised (see 3.4).
  - A glitch bus: buffer stutter (repeat 1/16–1/64 slices), random reverse, and bit/sample-rate reduction. Trigger it with low probability (one event every 4–16 bars), short and quiet.
  - A feedback-delay network with a band-pass and saturation in the loop for evolving drones, with feedback held around 0.85–0.95 by a limiter.

### 2.9 Piano, strings, vocals

- **[S]**
  - "Sparse, human-sounding piano" is set against "glitchy, 'broken machine' textures".
  - On *Human*, piano stands for the emotional side and beats for the technical side.
  - Tom Hodge plays piano and Rhodes on many pieces ("Waves", "Remnants", "Trust", "Teotihuacan").
  - *Emergence* began from "single piano notes and sparse melodies".
  - Minimalist influences: Glass, Pärt, Reich, Richter, Frahm. "Those simple melodies really need to be strong."
  - Vocals are used as an instrument, without lyrics: "Seed" (layered takes "over a tremolo chord progression"), Kotomi on *Unspoken Words*.
- **[I]** The previous "cheesy piano" was probably a bright, sampled-sounding or FM piano playing busy figures. For Cooper:
  - Play a few notes at a time (single notes or dyads), widely spaced, with long gaps.
  - Use a soft, felt-like timbre: a low-passed sine/triangle additive voice with fast attack, 2–6 s exponential decay, a little inharmonicity and hammer noise.
  - Use a heavy, dark plate reverb.
  - Keep a few dB of sustain-pedal "bloom".
  - Treat it as optional. Most of his catalogue is synth-led, and piano mostly comes in through collaborators.
  - For strings or "voice-as-instrument": a slow-attack (300 ms–1 s) formant-filtered saw or noise pad with tremolo (5–7 Hz, 20–40% depth), stacked in 3–6 slightly detuned layers.

---

## 3. Composition

### 3.1 Harmony [S + 3P + I]

- **[S]** "The harmonic structure carries most of a track's feeling."
  - He usually starts from a feeling and a chord progression, sketched with the Operator default patch.
  - Pieces are often "a simple chord progression" ("Reflect", "Everything", "Perpetual Motion": "a simple chord riff").
  - He holds mixed emotions ("Spectrum"). Mixed feelings are also the brief for "Broken Machines" ("playful creation and a touch of sadness").
  - He bends rather than resolves. "Ebb and Flow" uses rising and falling tones sounding at once to build harmonies.
- **[3P] "Resynthesis" voicings** (Sonic Pi transcription from a tutorial):

  | Chord | Notes | Reading |
  |---|---|---|
  | 1 | G#2 C3 D#3 F#4 | Ab7, spread voicing |
  | 2 | G#2 B2 E3 G#3 B3 F#4 F#5 | E add9 over G# |
  | 3 | G#2 C#3 F#3 G#4 | open sus voicing over a G# pedal |
  | 4 | E2 A#3 B3 F#4 | E(add9, #11), no third |

  - Each chord lasts 8 beats, so the cycle is 32 beats.
  - Note the G# pedal for 3 of 4 chords, the wide spacing, and the frequent absence of thirds.
- **[I] Engine harmony rules:**
  1. Pick a tonal centre and a mode. Weight the choice toward Aeolian, Dorian or Lydian, with Mixolydian occasionally, and allow major/minor ambiguity.
  2. Build progressions of 3–4 chords from the mode, using chord extensions (add9, sus2/4, maj7, m7, m9, 6/9, #11).
  3. Keep a pedal note (root or fifth) under at least half the progression.
  4. Voice-lead by minimal motion (each voice moves ≤ 2 semitones where possible). Let top-voice suspensions linger across chord changes; this is the "bend".
  5. Keep the loop fixed for long stretches. Vary it by:
     - inversion and voicing changes
     - adding or removing a tension note
     - substituting one chord after 2–4 cycles, typically a borrowed chord (bVI, bVII, iv in major, IV in minor)
  6. Common, plausible progressions [I]:
     - i – bVI – bIII – bVII (minor)
     - I – iii – vi – IV with sus colouring
     - I(add9) – IVmaj7#11 over a I pedal
     - vi – IV – I – V(sus4) with the sus4 never resolving
  7. Avoid chord changes faster than once per bar except in "riff" pieces.

### 3.2 Melody [S + I]

- **[S]**
  - Simple, strong, repeated melodies are the bridge between minimalism and techno.
  - *Emergence* began from sparse single notes.
  - Transcendental Tree Map used a tool (built with Alexander Randon) that breaks "an initially simple melody into increasingly complex sub-structures", following the branching pi tree.
  - "A Fleeting Life" develops "into a single short musical phrase".
  - "Distant Light" uses a two-note motif.
- **[I] Melody generator:**
  - **Seed:** a 3–5 note motif drawn from chord tones plus one passing tone, using mostly stepwise motion and fourths or fifths.
  - **Fractal elaboration** (Tree Map): each iteration (every 8–16 bars), replace a note with a short sub-figure (neighbour tones, arpeggiated chord tones) at twice the rhythmic density, up to a depth of 3 levels.
  - **Rests** take 30–50% of steps.
  - **Register:** stay mid-high (C4–C6) and well below the brightness of an FM bell.
  - Melodies mix *louder* than drums [S].

### 3.3 Rhythm, polyrhythm and phasing [S + I]

- **[S]** The documented methods:
  - prime-length loops (Penrose)
  - per-note tempo drift (My Mind Is Slipping, built "manually from thousands of MIDI notes")
  - polyrhythmic interlocking arps (Anatomic)
  - leaving 16/32-bar structures and time signatures behind in improvisations ("Parting Ways", "circular morphosis")
  - a Fibonacci-mapped drum rhythm ("Fibonacci Sequence" on *Seme*)
  - "micro-rhythms and micro-structures" from editing hundreds of renders into one-hit sounds
  - tempo changes ("I Exist Inside This Machine")
  - a strict grid in "Solace in Structure"
- **[I] Engine rhythm toolkit:**
  - A **polymeter scheduler**: each layer has a period (in 16ths) from {3, 5, 7, 11, 13, 16, 17, 19, 23} and a Euclidean or boolean pattern. Use 16 or 32 only for the anchor (kick or bass).
  - **Phase-drift mode:** each repeated element gets a tempo ratio of 1 + k·ε (ε about 0.001–0.005), so patterns slide in and out of alignment over minutes (Reich, Glass).
  - **Fibonacci or Euclidean** accent maps for drum layers.
  - **Swing:** mostly straight, with light swing (52–56%) on hats only, if any.

### 3.4 Emergence and order-from-chaos processes [S + I]

- **[S]** Raindrop transients are "pushed toward the nearest positions on a drum grid", so "the rhythm of the track is created by the raindrops in an emergent manner".
- **[I] Implementation:**
  1. Generate a Poisson stream of click events.
  2. For each event, compute its nearest 16th or 32nd grid position *g*.
  3. Play it at t' = t + α(g − t), where α ramps from 0 to 1 over the build.
  4. Optionally thin the events as α rises, so that a recognisable pattern of about 6–10 hits per bar crystallises. Bias survival toward the hits nearest a hidden target pattern.
  5. Reverse the process at the end for dissolution.
- This is the single most "Max Cooper" generative gesture and maps naturally onto a visual artist's "emergence" visuals.

### 3.5 Generative philosophy [S]

- "I use a lot of partially generative processes but I wouldn't say algorithms."
- His systems are "partly controlled and partly randomised", and the aim is "finding the right box": constrained randomness inside small boundaries.
- He renders long jams (about 1 hour of recording per finished minute; 60–70 tracks of ideas; up to about 200 tracks in "Sun In A Box"), then sculpts.
- *Feeling Is Structure* (2026) swings back to "procedural pieces where I was making music by following some iterative process or other", described as "carefully designed systems … precise at the micro level, but deeply emotive".
- "Pattern Index" kept "stacking layers of pattern until the piece came together".
- He rejects "data sonification music that's just structurally interesting". The mapping must serve feeling.
- **[I]** For a real-time engine, emulate the sculpting by generating more candidate layers than you play and continuously muting or unmuting them on the arrangement curve. A curator judges density and spectral balance. Every generation can then be a different *selection* from a large space.

---

## 4. Arrangement and form

**[S] Documented facts**
- Tracks are written as scores to visual stories. Intros and outros don't follow DJ conventions (*Human*).
- There is a "long build format" ("A Sense of Getting Closer"). "Cyclic" is "a looped structure that only builds".
- "Pattern Index" asks for patience: patterns "gradually lock together into a sweeping, expansive sound".
- "Let There Be" has sparse, drawn-out chords. "This Is A Bridge": "the chords open up into the most intense part of the record".
- "A Fleeting Life" opens with a long drone under spoken word.
- "Pulse at the Centre of Being" puts "a lot of space around the core pulse".
- "Ebb and Flow" is "stripped back and focused on that idea".
- Durations: 2:12 to 7:41. Several are 7+ minutes (Order from Chaos 7:41, Transcendental Tree Map 7:30, Void 7:26, Adrift 7:07). Most are 4–6 minutes [3P].
- He says himself, "I need to improve my use of soft and loud". His dynamics tend toward gradual swells rather than EDM drops [S, with my reading].

**[I] Default form template for the engine** (about 6 minutes at 118 BPM, about 177 bars):

| Section | Bars | What happens |
|---|---|---|
| A. Emergence | 0–16 | Texture bed (noise or field), one sustained chord voice with filter almost closed, stochastic clicks unquantised. No bass, no kick. |
| B. Statement | 16–48 | Chord loop at full length. Filter opens slowly over 32 bars. Sparse melody seed. Sub bass enters at bar 24–32. Clicks begin quantising (α 0→0.5). |
| C. Development | 48–96 | Arp layers with prime periods enter one at a time every 8–16 bars. Melody elaborates (Tree Map). Kick may enter at about bar 64, often soft or broken. Bass stabs. α reaches 1, so the rhythm has "crystallised". |
| D. Peak | 96–128 | Densest layer count. Open filter, more saturation. The chord progression "opens up" (wider voicing, octave doubling, one substituted chord). Extra micro-percussion. Still no "drop": a swell. |
| E. Release | 128–160 | Remove drums first, then arps. Melody returns to the seed. Reverb tails lengthen. |
| F. Dissolve | 160–177 | Chords filter down; the field recording returns; α reverses (rhythm de-quantises) or a phase drift pulls the parts apart. |

**[I] Rules**
- Introduce or remove at most one major layer per 8 bars.
- Use filter and reverb sends as the main "automation" moves.
- Mute drums for 4–8 bars before the peak for contrast. Do not use risers or snare rolls.
- About one track in four should be fully beatless (65–80 BPM feel, drones and chords only), like "Small Window on the Cosmos" ("drone upon drone") or "Stream of Thought".

---

## 5. Mix and space

- **Space [S]:**
  - Binaural recordings and binaural panning. Haas-style "short delay of a few milliseconds between left and right channels, plus stereo widening".
  - Psychoacoustic cues that "make your brain think things are really wide". Headphone-first.
  - The aim is to "wrap the listener up inside the music like a warm bath".
  - Reverbs and panning are modulated to create rhythmic change.
  - Per-layer spatial placement. Atmos mixes since *Emergence*.
- **Reverb and delay [S]:**
  - ValhallaRoom (go-to), BlueSky plate ("especially its plate reverb"), Dark World for ethereal pads, large plate on distorted hits ("Let There Be").
  - Space Echo, El Capistan, Copicat for tape echo with "that saturated quality".
- **Low end [S]:**
  - 30/40 Hz to about 200 Hz peaks for kick and bass. Clean, simple bass. High-pass all non-bass parts.
  - Fast-release sidechain between bass elements. Sidechain only the low band to the kick (Henke three-band crossover).
  - Uses a Subpac to check club feel.
- **Dynamics and loudness [S]:**
  - Older tracks used little compression and only "a small amount of limiting" on the master.
  - He now compresses the drum/hat bus and "rogue elements like field recordings".
  - Processing is "compression, EQ, multiband processing, and saturation, applied lightly".
  - Melodies louder and drums quieter than club norms, so tracks can "sound flat in clubs but better at home".
  - He was cautious about volume (RBMA). Spotify's loudness field for "Unspoken Words" is -15 dB [3P].
  - Fill the 30 Hz–20 kHz range by adding high "click" layers and light saturation for overtones.
- **[I] Engine mix defaults:**
  - Master: gentle glue compression (2:1, slow attack 30 ms, auto release, ≤ 2 dB gain reduction), then soft limiter at -1 dBTP. Target roughly -14 to -12 LUFS-equivalent; don't push louder.
  - Bus levels relative to the chord bus at 0 dB: melody/arp -2 to -4, bass -3 to -6, kick -6, micro-percussion -12 to -18, texture bed -18 to -24.
  - Reverb: one plate (2.5–4 s, damping above 5 kHz) and one dark hall (6–10 s, low-pass 4 kHz) as sends. Never put reverb on the sub. High-pass reverb returns at 200 Hz.
  - Tape delay send: about 3/16 (dotted eighth) with saturation and low-pass in the feedback loop, and slight wow.
  - Haas widening on pads (8–12 ms, one side), mono below 150 Hz.
  - Every bus gets a mild tanh saturator; saturation is part of the timbre.

---

## 6. Track case studies

Time-course details are **[S]** where attributed. Otherwise they are **[I/listening]**: my recollection of the recordings, to be verified by ear.

### 6.1 "Order from Chaos" (*Emergence*, 2016). About 7:41, Spotify 152 BPM (feel likely 76/152), A minor [3P]

- **[S]** He recorded heavy rain on a roof window of his old flat with binaural mics close to the glass. He mapped each drop's transient and "gradually pushed the random hits onto the nearest positions of a live-drum grid". The emergent rhythm becomes the track's percussion and "the foundation the rest of the track is built around". The video maps this to raindrops, then cells, cooperation and endosymbiosis.
- **[3P]** "Glassy broken beats" in the style of early Four Tet (XLR8R). It opens with rain-like sounds and becomes "a smooth, graceful sequence of movement".
- **[I/listening]** It begins as pure binaural rain. Clicks gradually cohere into a skittering pattern. A soft, melancholic synth chord progression and sustained pads enter. Bass and fuller percussion follow, and the piece swells rather than drops.
- **Engine lesson:** this is the template for the emergence mode (3.4).

### 6.2 "Waves" (with Tom Hodge, *Emergence*). 5:31, 111 BPM, C#/Db major [3P]

- **[S]** A "classic synth approach", with Tom Hodge adding Fender Rhodes. Gear: Prophet-8 for chords, Minitaur bass stabs, Sub 37 lines driven by Obscurium-generated MIDI, DtBlkFx spectral processing for "weird noises and percussion". The visuals are retro moving lines (Kevin McGloughlin). A reviewer calls it "a gentle, rolling track" [3P].
- **Engine lesson:** this is the "warm retro" preset. Use Rhodes-like electric-piano voicings (sine/FM with a *soft* index and fast decay, not bell ratios), generated arp MIDI, and FFT-smeared noise as percussion.

### 6.3 "Repetition" (*Yearning for the Infinite*, 2019). 5:50, 121 BPM, D major [3P]

- **[S]** "Simple, repeated structures" suggest endless growth. It is "stripped back, built mainly on Prophet 6 stabs" with pads and a Minitaur bass line. It was "first written as ominous, then reworked". It explores "boring repeats within repeats" while aiming for repetition that stays engaging.
- **Engine lesson:** repetition is fine and even central, *if* each repeat differs microscopically (trait 4). A single stab pattern with a cutoff random walk and nested pattern-lengths ("repeats within repeats", e.g. a 2-bar figure inside a 3-bar phrase inside a 5-bar cycle) is enough.

### 6.4 "Penrose Tiling" (*Yearning*)

- **[S]** Every loop length is a prime-number multiple of the same unit, so "no bar repeats within the track's length". It starts with live sansula and adds layers of tight percussion. The visuals tile the room aperiodically.
- **Engine lesson:** use the polymeter scheduler with primes (3.3). Start with a single kalimba-like pluck line, then add tight clicky percussion layers one by one.

### 6.5 "Transcendental Tree Map" (*Yearning*). 7:30, 119 BPM, A minor [3P]

- **[S]** It maps Martin Krzywinski's pi-digit tree map to music. A tool built with Alexander Randon breaks "an initially simple melody into increasingly complex sub-structures". The Moog One is used for "rich blip sounds".
- **Engine lesson:** use fractal melodic elaboration (3.2). A good seed is pi's digits mapped to scale degrees, which is conceptually on-brand. Use blip timbres for the deeper subdivisions.

### 6.6 "Perpetual Motion" (*Yearning*). 4:59, 119 BPM, B major [3P]

- **[S]** It was written as a catchy closing track around "a simple chord riff", to ease the audience out after an intense set. "Deceptively simple melodies and beats, with detailed sound design and rhythmic one-shots."
- **Engine lesson:** this is the "uplifting" mode. Use a major-mode riff, a steady beat, and complexity hidden in the one-shots, not in the harmony.

### 6.7 "Resynthesis" (*One Hundred Billion Sparks*, 2018). 5:23, 120 BPM, C#/Db major [3P]

- **[3P]** The Sonic Pi transcription gives a four-chord loop over a G# pedal: Ab7, E/G# add9, a sus voicing, then E add9 #11. Each chord lasts 8 beats. There is a 32-step stab pattern (17 hits), a filter sweep and amplitude LFO over 32 steps, random 3-of-chord-tone arps, and kick, glitch-percussion and snare layers rotating on their own schedules.
- **Engine lesson:** this is a near-direct recipe for a playable "Cooper-like" loop. Its third-less and #11 voicings are the antidote to cheesy triads.

### 6.8 "My Mind Is Slipping" (*On Being*, 2025)

- **[S]** A six-note chord whose notes each repeat "at a very slightly different tempo", so they drift and form emergent rhythms. It was built manually from thousands of MIDI notes. The material went through "multiple passes of pedals" for a lo-fi, softened feel. In the Atmos mix, the drifting rhythms become moving paths in space.
- **Engine lesson:** this is the phase-drift mode. Per-note independent periods are trivial in code but impossible for him to automate at the time, so a generator can deliver this "for free".

### 6.9 "Exotic Contents" (*Unspoken Words*, 2022)

- **[S]** "A half time drum and bass format with more aggression and sharpness of sound design", "an exotic form of club track". Its "big, aggressive, distorted sounds" come from the PolyBrute. The Atmos mix has extreme percussion separation, periodic 90-degree rotations, and everything collapsing to single positions at phrase endings. Reviewers note bass wobbles and skittering beats [3P].
- **Engine lesson:** this is the "intense" mode, about 170 BPM half-time with a backbeat at 85. Use a distorted, modulated mid-bass (the distortion goes *after* the low-pass, with the sub kept clean and separate) and spatial "collapse to mono" at phrase ends.

### 6.10 "Ebb and Flow" and "Four Tones Reflected" (*Feeling Is Structure*, 2026)

- **[S]** "Ebb and Flow" used "construction techniques to make music from processes" with "rising and falling tones sounding at once to build harmonies". The timbre is soft, flowing synths with a "P6 vibe with those magic resonant overtones". The arrangement is deliberately sparse.
- **[S]** For "Four Tones Reflected", MusicRadar (July 2024) quotes the Juno-6 as the primary voice on a track it calls "Four Tone Reflections", probably the working title. No public notes describe its process. **[I]** The title suggests a four-pitch cell mirrored (inverted or retrograded), but this is speculation.
- **Engine lesson:** this is the "process" mode. Use a small pitch set (e.g., 4 tones) with simultaneous ascending and descending glissandi or step patterns that form harmony through overlap. Use a resonant P6/Juno-style tone with chorus.

### 6.11 "This Is A Bridge" (with Sorcery, *Feeling Is Structure*)

- **[S]** It took four years. It was designed as a seamless transition between techno and drum & bass for live sets, using the bridging structure of an earlier Sorcery track. Its "industrial power" shaped the music, and "the chords open up into the most intense part of the record".
- **Engine lesson:** the engine could support a tempo or feel bridge: 4/4 at about 128–135, then halftime/DnB at about 170 (with 85 as the halftime pulse), via a shared subdivision. The harmonic "opening" (wider voicing and added extensions) is a peak device.

### 6.12 "Void" (*Yearning*). 7:26, 123 BPM [3P]

- **[S]** Built from binaural recordings of a large metal structure being struck, plus cosmic collision sounds. Dark industrial sounds and heavy low resonances aim to render emptiness.
- **Engine lesson:** this is the dark mode. Use inharmonic metallic impacts (modal synthesis with 4–8 partials and long decays) through a large reverb, plus low resonant drones. Keep harmony minimal.

### 6.13 Others in brief

- **"Distant Light"** [S]: a repetitive, syncopated two-note motif under a gradually layered chord structure.
- **"Cyclic"** [S]: an arpeggiated riff that only builds, with metal-pole field recordings as the percussion.
- **"Gödel's Incompleteness"** [S]: three synth chords only.
- **"Solace in Structure"** [S]: many layers on a precise grid, "pure architecture, bordering on IDM" [3P].
- **"Swarm"** [3P]: about 102 BPM, A minor, 3/4 per Spotify. Its EP is "layer after layer of otherworldly synthesis, harmony, clicks, fuzz and micro-rhythm" with "constant low-end harmonies" [S].
- **"When I Sit Alone…"** (with Aho Ssan) [S]: improvisation, then Aho Ssan's mangling; night-market field recordings; heavy compression so the sub "overwhelms the other elements".
- **"Origins"** [S/3P]: sansula recorded binaurally, Kathrin deBoer vocals, about 118 BPM. "Almost too sad to play to a dance floor".

### 6.14 Eras

| Era | Sound |
|---|---|
| **Traum Schallplatten EPs, 2009–2012** (*Harmonisch Serie*, *Expressions*, etc.) [3P] | Melodic minimal techno and tech-house swing. Warbling, "gently corroded noises", whispered vocal fragments, "ping-pong-style bells", slow builds. The most "techno" period. He was steeped in club techno through Nottingham's Firefly (1999–2011). |
| ***Human*** (2014) [S] | Almost all in-the-box (Ableton + NI). Sampled piano and strings, binaural field recordings, an "industrial core" ("Automaton", "Supine", "Seething", "Numb"), and "hardly an evenly-spaced kick". |
| ***Emergence*** (2016) [S] | Semi-generative systems, field-recording rhythms, Tom Hodge piano and Rhodes, first serious hardware (Juno, Prophet, Minitaur). |
| ***One Hundred Billion Sparks*** (2018) / ***Yearning for the Infinite*** (2019) [S] | Prophet-6 plus pedal saturation. 200–240 layers, live improvisation, and maths-driven forms (primes, pi, Cantor). |
| ***Unspoken Words*** (2022) [S] | Stripped "down to its fundamentals". Mostly a chord sequence and improvisation. Ranges from drone ambient to half-time DnB. Atmos. |
| ***On Being*** (2025) [S] | Built from listener quotes. "Everything got more extreme" later in the record: noise, sub pressure, more collaborators. |
| ***Feeling Is Structure*** (2026) [S] | Procedural, process-built pieces. Precise micro-detail, retro synth timbres, a Royal Albert Hall scale. |

---

## 7. What to avoid

1. **Supersaws and trance-style unison stacks.** [I] Nothing in his documented gear or recipes points there. His width comes from Haas, binaural and chorus, not from 7-voice unison.
2. **A constant bright FM or bell pluck as the lead.** [I] Bells appear only in early Traum work [3P]. Plucks are textural and multi-rhythmic (sansula, ancient strings), not a featured hook.
3. **Bright, sampled-sounding "cheesy" piano playing busy arpeggios.** [S/I] Piano in his work is sparse, few notes, minimalist, mostly from collaborators, set against broken textures.
4. **Generic loud kick/snare backbeats.** [S] "Hardly an evenly-spaced kick." Drums are "small", quiet relative to melody, and made from clicky one-shots and field recordings. Avoid stock 909 snare and clap on 2 and 4 unless in an explicit DnB or techno mode.
5. **Harsh bass.** [S] Bass must be "clean and simple". Avoid stacking multiple bass sources, distorting the sub, or leaving low-end in pads (high-pass them).
6. **Exact loop repetition.** [S] "No sound that ever plays twice". Every repeat needs micro-variation, and loop lengths should be co-prime.
7. **Markov harmony that wanders.** [S/I] He uses one strong progression held for minutes, bent rather than resolved. Constant chord changes kill the hypnotic feeling.
8. **Functional V→I cadences and plain major/minor triads in root position.** [3P/I] They sound like stock "cinematic" music. Use extensions, suspensions and pedals.
9. **Sterile perfection.** [S] "Music without imperfection is sterile." Humanise, add saturation, add lo-fi.
10. **EDM drops, risers, snare rolls, pumping sidechain on the whole mix.** [S/I] Builds are gradual swells. Sidechain only the lows.
11. **Every generation sounding the same.** [I] He varies concept, tempo band, palette and process per piece. The engine should pick a **mode per generation** (see below) with different BPM band, density, timbre set and generative process. It should not only randomise notes inside one fixed template.
12. **Over-wide preset hopping.** [S] He restricts his palette: "you can't operate creatively within an infinite parameter space". Fewer, better voices with deep modulation beat many shallow ones.

**[I] Suggested per-generation "modes"** (to fix repetitiveness):

| Mode | Tempo | Process | Character |
|---|---|---|---|
| Emergence | 110–124 | rain-to-grid quantise | melancholic minor, broken beat |
| Prime tiling | 116–122 | co-prime loops | sansula-like plucks, tight clicks |
| Tree map | 118–120 | fractal melody | blips, A minor feel |
| Drift | 60–90 | per-note phase drift | lo-fi softened chords, beatless or near-beatless |
| Warm retro | 108–118 | arp + Rhodes | major/Lydian, "Waves" feel |
| Uplift riff | 118–124 | simple chord riff | major, steady beat, rich one-shots ("Perpetual Motion") |
| Intense | 136–140 4/4, or 170 half-time | distorted mid-bass, collapsing space | "Exotic Contents" feel |
| Void | 60–123 | metallic modal impacts, drones | minimal harmony |
| Process tones | any | rising/falling simultaneous tones | resonant P6/Juno pad ("Ebb and Flow", "Four Tones Reflected") |

---

## 8. Sources

- https://www.musicradar.com/news/max-cooper-in-the-studio: MusicRadar, 29 July 2024. Current hardware: Prophet-6 most used, Juno-6 on "Four Tone Reflections", Moog One bass and blips (Transcendental Tree Map), PolyBrute (Exotic Contents), Summit, Taurus. Pedal list; "sculptor" quote; more layers than he should, placed with a binaural panner.
- https://musicradar.com/news/tech/in-pictures-max-coopers-london-studio-599770: MusicRadar, 2014 studio. Prophet '08, Minitaur, APC40, Sansula, NI plugins, Synplant, ValhallaRoom, Moog Modular V, Animoog, Lemur generative balls.
- https://www.stampthewax.com/2015/11/11/talking-tech-max-cooper/: 2015 gear (DX7, Poly-800, Sub 37, Prophet '08, Minitaur, Geiger Counter, Copicat). Binaural recording; few-ms L/R delay widening; headphone psychoacoustics.
- https://15questions.net/interview/fifteen-questions-interview-max-cooper/: self-taught, DJ background. Gear list; software only for granular, FFT and modulation systems; "My sound is defined by my tools"; "finding the right box".
- https://daily.redbullmusicacademy.com/2016/11/max-cooper-interview: RBMA 2016. Order from Chaos rain-to-grid; semi-generative Ableton systems; "no one sound that ever plays twice"; "Music without imperfection is sterile"; sparse piano starts; caution on volume.
- https://ableton.com/en/blog/max-cooper-speaking-the-unspoken: Ableton, On Being era. Chord progressions as the connecting factor; Operator default patch; Prophet-6 "errors"; low-band-only sidechain; Henke crossover; ~200 tracks; six-note drifting chord; light processing.
- https://www.ableton.com/en/blog/composing-infinity-max-cooper-his-new-album/: Ableton, Yearning era. Prophet 6, Moog One, Minitaur bass stabs, pedal list; random LFOs ("liquid timbre"); 1 hr per finished minute; prime-length loops; "repeats within repeats".
- https://www.yearningfortheinfinite.net/: official track notes. Repetition, Penrose Tiling, Transcendental Tree Map, Void, Let There Be, Nanotech (240+ layers), Circular, Aleph 2, Parting Ways, Perpetual Motion.
- https://emergence.maxcooper.net/: official Emergence chapter notes. Waves (classic synth + Rhodes), Order from Chaos, Distant Light, Cyclic, Anatomic, Seed, feedback matrix.
- https://www.pressreader.com/australia/future-music-9629/20161215/283549450282237: Future Music "In The Studio", Dec 2016. Juno-6 + Space Echo; "Waves" gear (Minitaur, Sub 37 + Obscurium, Prophet-8, DtBlkFx); Cyclic field recordings; workflow; "broken machines" quote.
- https://www.loopcloud.com/cloud/blog/4541-Max-Cooper-Inspiration-and-Evolution: 95% hardware for melodic elements; clicky one-shot percussion from field recordings; restricted palette; Penrose prime loops.
- https://xlr8r.com/?p=68860: XLR8R artist tips. Mixing and bass advice: 30/40 Hz–200 Hz, clean bass, high-pass the rest, light limiting, fast sidechain, high click layers, saturation.
- https://thethinair.net/?p=69625: The Thin Air, OHBS era. "Seething clicks"; "melodies louder and drums quieter"; Gödel's Incompleteness = three chords.
- https://www.maxcooper.net/pattern-index: Pattern Index process (stacked pattern layers, patience).
- https://www.maxcooper.net/this-is-a-bridge: This Is A Bridge, techno↔DnB bridge, chords open up.
- https://www.maxcooper.net/obsessive-compulsive-order: months on bass sounds, obsessive process.
- https://www.maxcooper.net/ebb-flow: process construction; rising and falling tones; P6 resonant overtones; sparse.
- https://www.maxcooper.net/the-shape-of-memory: retro synth timbre with irregular detailing; "all about the feeling of the chord progression".
- https://www.maxcooper.net/my-mind-is-slipping: drifting chords; multiple pedal passes for a lo-fi feel.
- https://www.maxcooper.net/when-i-sit-alone-in-my-thoughts-i-am-crushed: improvisation, night-market field recordings, sub overwhelmed by compression.
- https://www.maxcooper.net/peace-exists-here: Prophet 6 resonant chords; slow-tempo techno; clicky details.
- https://www.maxcooper.net/a-sense-of-getting-closer: "long build format".
- https://www.maxcooper.net/a-moment-set-aside: improvised session with Rob Clouth.
- https://www.maxcooper.net/swarm-earth-reflect: Earth EP; "simple chord progression"; clicks, fuzz, micro-rhythm, constant low-end harmonies.
- https://www.maxcooper.net/seme: Seme EP; Palestrina; Fibonacci drum rhythm.
- https://www.maxcooper.net/on-being and https://www.maxcooper.net/yearning-for-the-infinite-album and https://www.maxcooper.net/one-hundred-billion-sparks: album concept pages (200+ layers, improvisation, scoring to visual stories).
- https://maxcooper.net/glassforms: Glassforms live piano-to-synth system with Alexander Randon.
- https://unspokenwords.net/ (chapters /foundations, /self-organisation, /awakening, /expression, /abstraction, /limits, /quantisation, /mechanisation, /exploration, /growth, /realisation): official per-track notes for Unspoken Words (Spectrum, Exotic Contents, Solace in Structure, Broken Machines, Everything, etc.).
- https://lbbonline.com/news/unspoken-words-audio-algorithms-and-art-for-max: "partially generative … not algorithms"; sculpting; LFOs on unusual parameters; 70+ stems.
- https://whynow.co.uk/read/max-cooper-feeling-is-structure-album, https://electronicgroove.com/max-cooper-shares-pattern-index-ahead-of-new-album/, https://www.piccadillyrecords.com/168286/Max-Cooper-Feeling-Is-Structure-Mesh, https://www.clashmusic.com/news/max-cooper-announces-new-album-feeling-is-structure/, https://arcana.fm/2026/05/15/max-cooper-2/: Feeling Is Structure tracklist, procedural concept, reviewer descriptions.
- https://www.stereofox.com/interviews/interview-max-cooper/: May 2026. Procedural pieces; This Is A Bridge; influences; "I need to improve my use of soft and loud".
- https://www.juno.co.uk/junodaily/2025/02/28/max-cooper-interview-i-wanted-mesh-to-be-at-the-intersection-of-music-science-and-art: hardware-first, commit early; On Being track notes.
- https://metalmagazine.eu/en/post/max-cooper: ~90% hardware sources; shift from MIDI control to improvisation.
- https://fourfourmag.com/interview-max-coopers-story-of-transitioning-to-music-full-time-wider-musical-influences-thoughts-on-the-current-state-of-techno/: Firefly techno background; Order from Chaos recap.
- https://musictech.com/news/music/max-cooper-ade-technical-expressive/: separate technique from expression.
- https://theplayground.co.uk/in-conversation-with-max-cooper/: workflow stages (chords, melody, rhythm, palette, then mess, then sculpting); Max for Live "modulation and chaos".
- https://electronicgroove.com/interview-max-cooper-earth/: PolyBrute; spatial "warm bath"; modulated reverbs and panning.
- https://electronicgroove.com/max-cooper-and-rob-clouth-collaborate-on-8-billion-realities/: 8 Billion Realities EP, improvised, ambient-to-techno.
- https://www.insomniac.com/?p=3542: "constant chords and constant notes"; psychoacoustic width; Woven Ancestry plucks as rain in 4D.
- https://www.vice.com/de/article/interview-max-cooper/: *Human* made in Ableton/NI; self-composed sampled strings and piano; binaural on 3+ tracks.
- https://astrangelyisolatedplace.com/blog/2014/01/21/interview-max-cooper: piano = emotion vs beats = technique; minimalist influences; "simple melodies really need to be strong".
- https://dancingastronaut.com/2014/03/max-cooper-explores-consciousness-anthropology-and-more-on-debut-album-human-review/: *Human* track descriptions (industrial core, pads, strings).
- https://djmag.com/content/max-cooper-blinds-us-science: "hardly an evenly-spaced kick"; Woven Ancestry method.
- https://djmag.com/content/take-10-max-cooper-shares-10-tracks-inspire-him: influences (Glass, Lusine, Vaetxh, Flashbulb, Fuck Buttons "Stalker" for builds, Autechre, Trentemøller).
- https://ra.co/reviews/5756: RA review of Harmonisch Serie, Traum-era sound.
- https://en.wikipedia.org/wiki/Max_Cooper_(music_producer): discography and timeline, Traum/Fields/Mesh labels.
- https://www.blackplastic.co.uk/alternative-electronic-music-b/2014/11/26/ep-review-kindred-max-cooper: Kindred EP / Origins description.
- https://acloserlisten.com/2017/02/11/max-cooper-emergence/ and https://xlr8r.com/reviews/2016/11/max-cooper-emergence/: Emergence reviews ("glassy broken beats", "frosted pads").
- https://acloserlisten.com/2022/03/25/max-cooper-unspoken-words/ and https://www.clashmusic.com/reviews/max-cooper-unspoken-words/: Unspoken Words reviews (drones, Solace in Structure, Exotic Contents).
- https://vimeo.com/196269431 and https://www.thisiscolossal.com/2016/12/order-from-chaos-video-maxime-causeret/: Order from Chaos video notes (transient mapping, grid quantisation).
- https://in-thread.sonic-pi.net/t/jumping-off-point-resynthesis-by-max-cooper/7863: third-party Sonic Pi transcription of "Resynthesis" (chord voicings, 32-step pattern, filter sweep).
- https://songbpm.com/@max-cooper (and track pages /order-from-chaos, /waves, /repetition, /perpetual-motion, /transcendental-tree-map, /void, /resynthesis, /swarm, /origins): Spotify-derived BPM, key and duration (approximate).
- https://www.mixgraph.io/tracks/max-cooper-unspoken-words: "Unspoken Words" 65 BPM, Db major, loudness -15 dB; catalogue median 120 BPM.
- https://equipboard.com/pros/max-cooper: aggregated gear list (cross-check).
- https://www.barbican.org.uk/sites/default/files/documents/2019-09/280919_Max%20Cooper_programme.pdf: Barbican programme ("Reductionism is my usual tool"; "I also love micro-structure").
- https://www.sonicstate.com/news/2026/06/10/max-cooper-live-masterclass-/ and https://sonicstate.com/news/2024/11/22/behind-max-coopers-amazing-3d-av-show/: live AV setup (Ableton, Resolume, OSC, M4L).
