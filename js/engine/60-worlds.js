/* Maut ki Awaaz — engine module: sound palette (patches) + worlds + genome.
   A world is a whole sound family: tempo band, harmony, its own instruments, drum kit, groove, process, form and FX.
   A genome is one piece drawn from a world: every range sampled, every patch jittered, so two pieces of one world differ
   and two worlds never sound alike. Mix levels follow research/01 §6 (chords 0, melody −2…−4, bass −3…−6, kick −6,
   micro-perc −12…−18, texture −18…−24) on top of per-patch loudness normalisation (A.PATCH_NORM, tools/calibrate.js). */
'use strict';
function AWZ_WORLDS(A){
  const clamp = A.clamp;
  // ---------------------------------------------------------------- patches
  // inst: va (poly VAVoice) · mono (mono VAVoice) · bass (BassVoice) · modal (ModalVoice) · kick/snare/hat/shaker/tom/perc · tex
  const P = A.PATCH = {
    // pads / chords — Prophet-6 / Juno style; ladder after detuned saw+pulse, slow envelopes, LFO on cutoff
    pad_warm:   {inst: 'va', p: {shape1: 2, shape2: 3, pw: .45, pwm: .12, osc2Level: .6, detune2: 8, unison: 2, spread: 12, uniPan: .7, drift: 4, cutoff: 820, res: .22, keytrack: .4, envAmt: 1.1, fa: .9, fd: 2.6, fs: .35, fr: 2.4, aa: 1.1, ad: 2, as: .85, ar: 2.6, lfoRate: .13, lfoCut: .22, gain: .5}},
    pad_dark:   {inst: 'va', p: {shape1: 2, shape2: 2, semi2: -12, osc2Level: .5, detune2: 5, unison: 2, spread: 9, drift: 3, cutoff: 480, res: .32, keytrack: .3, envAmt: .8, fa: 2.5, fd: 4, fs: .5, fr: 3, aa: 1.6, ad: 3, as: .9, ar: 3, lfoRate: .07, lfoCut: .3, gain: .55}},
    pad_string: {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .7, detune2: 11, unison: 3, spread: 16, uniPan: .8, drift: 5, cutoff: 1500, res: .08, keytrack: .5, envAmt: .4, fa: 1.5, fd: 3, fs: .6, fr: 3, aa: 1.6, ad: 2, as: .9, ar: 3.2, lfoRate: .2, lfoCut: .12, lfoPitch: 3, vib: 6, vibDelay: 1, vibRate: 4.6, gain: .42}},
    pad_glass:  {inst: 'va', p: {shape1: 1, shape2: 2, semi2: 12, osc2Level: .3, detune2: 4, unison: 2, spread: 7, drift: 2, filter: 'svf', cutoff: 2600, res: .08, keytrack: .6, envAmt: .5, fa: .4, fd: 2, fs: .5, fr: 2, aa: .7, ad: 2.5, as: .75, ar: 3, lfoRate: .25, lfoCut: .15, gain: .55}},
    pad_breath: {inst: 'va', p: {shape1: 1, shape2: 0, osc2Level: .5, detune2: 3, unison: 2, spread: 6, drift: 2, noise: .05, filter: 'svf', cutoff: 1300, res: .15, keytrack: .5, envAmt: .6, fa: 1.2, fd: 2, fs: .4, fr: 2, aa: 1.4, ad: 2, as: .85, ar: 3, lfoRate: .11, lfoCut: .2, gain: .7}},
    // stabs — short chord hits, envelope does the work
    stab_p6:    {inst: 'va', p: {shape1: 2, shape2: 3, pw: .42, osc2Level: .55, detune2: 9, unison: 2, spread: 10, drift: 3, cutoff: 520, res: .42, keytrack: .4, envAmt: 3.4, velEnv: 1.2, fa: .001, fd: .2, fs: 0, fr: .22, aa: .002, ad: .32, as: .0, ar: .22, gain: .62}},
    stab_juno:  {inst: 'va', p: {shape1: 3, shape2: 2, pw: .33, pwm: .16, osc2Level: .45, detune2: 6, unison: 1, drift: 3, sub: .25, cutoff: 900, res: .3, keytrack: .4, envAmt: 2.4, velEnv: 1, fa: .001, fd: .14, fs: .05, fr: .2, aa: .002, ad: .24, as: .08, ar: .2, gain: .62}},
    stab_soft:  {inst: 'va', p: {shape1: 1, shape2: 2, osc2Level: .4, detune2: 6, unison: 2, spread: 8, drift: 3, cutoff: 1100, res: .2, keytrack: .5, envAmt: 1.6, fa: .002, fd: .3, fs: .1, fr: .3, aa: .004, ad: .45, as: .1, ar: .35, gain: .62}},
    // arps / plucks (subtractive — no Karplus bell)
    arp_pulse:  {inst: 'va', p: {shape1: 3, pw: .3, pwm: .2, osc2Level: 0, drift: 3, cutoff: 1300, res: .34, keytrack: .5, envAmt: 2.2, velEnv: 1, fa: .001, fd: .16, fs: .12, fr: .25, aa: .002, ad: .22, as: .25, ar: .25, lfoRate: .09, lfoCut: .25, gain: .62}},
    arp_saw:    {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .5, detune2: 5, drift: 3, cutoff: 900, res: .48, keytrack: .5, envAmt: 2.6, velEnv: 1, fa: .001, fd: .11, fs: .08, fr: .2, aa: .002, ad: .16, as: .18, ar: .2, lfoRate: .06, lfoCut: .2, gain: .55}},
    arp_round:  {inst: 'va', p: {shape1: 1, shape2: 3, pw: .5, osc2Level: .3, detune2: 3, drift: 2, filter: 'svf', cutoff: 1700, res: .12, keytrack: .6, envAmt: 1.4, fa: .001, fd: .12, fs: .1, fr: .2, aa: .002, ad: .25, as: .2, ar: .3, gain: .7}},
    pluck_soft: {inst: 'va', p: {shape1: 1, shape2: 2, osc2Level: .28, detune2: 4, drift: 2, filter: 'svf', cutoff: 1500, res: .1, keytrack: .7, envAmt: 1.8, fa: .001, fd: .08, fs: 0, fr: .2, aa: .001, ad: .55, as: 0, ar: .4, gain: .75}},
    // leads
    lead_soft:  {inst: 'mono', p: {shape1: 1.6, shape2: 2, osc2Level: .35, detune2: 6, drift: 3, cutoff: 1500, res: .18, keytrack: .6, envAmt: .9, fa: .01, fd: .5, fs: .4, fr: .5, aa: .025, ad: .5, as: .7, ar: .5, vib: 10, vibDelay: .45, vibRate: 5, glide: .07, legato: true, gain: .55}},
    lead_square:{inst: 'mono', p: {shape1: 3, pw: .5, pwm: .08, osc2Level: 0, drift: 2, filter: 'svf', cutoff: 1300, res: .15, keytrack: .6, envAmt: .8, fa: .005, fd: .4, fs: .5, fr: .4, aa: .015, ad: .4, as: .75, ar: .45, vib: 14, vibDelay: .35, vibRate: 5.4, glide: .05, legato: true, gain: .5}},
    lead_glass: {inst: 'mono', p: {shape1: 0.6, shape2: 1, semi2: 12, osc2Level: .25, detune2: 3, drift: 1.5, filter: 'svf', cutoff: 3000, res: .05, keytrack: .5, envAmt: .4, fa: .01, fd: .5, fs: .5, fr: .6, aa: .03, ad: .6, as: .6, ar: .8, vib: 8, vibDelay: .5, vibRate: 4.8, glide: .09, legato: true, gain: .7}},
    // bass — sine sub + low-passed harmonic layer
    bass_sub:   {inst: 'bass', p: {sub: 1, subOct: -1, harm: .32, shape: 2, cutoff: 190, res: .12, keytrack: .4, envAmt: 1.1, fd: .2, fs: .1, aa: .01, ad: .3, as: .9, ar: .09, drive: 1.2, asym: .08, harmHP: 70, harmLP: 800, subLP: 140, glide: .06, gain: .9}},
    bass_round: {inst: 'bass', p: {sub: .55, subOct: -1, harm: .6, shape: 3, cutoff: 300, res: .3, keytrack: .5, envAmt: 2.4, fd: .13, fs: .08, aa: .003, ad: .22, as: .45, ar: .07, drive: 1.6, asym: .1, harmHP: 120, harmLP: 2000, subLP: 130, glide: .03, gain: .85}},
    bass_rolling:{inst: 'bass', p: {sub: .85, subOct: -1, harm: .42, shape: 2, cutoff: 230, res: .34, keytrack: .4, envAmt: 2.2, fd: .09, fs: .05, aa: .003, ad: .12, as: .3, ar: .05, drive: 1.5, asym: .1, harmHP: 110, harmLP: 1600, subLP: 130, glide: .02, gain: .9}},
    bass_dist:  {inst: 'bass', p: {sub: .8, subOct: -1, harm: .75, shape: 2, osc2: 3, cutoff: 360, res: .4, keytrack: .4, envAmt: 2.6, fd: .16, fs: .1, aa: .003, ad: .25, as: .5, ar: .08, drive: 3.2, asym: .2, harmHP: 160, harmLP: 2400, subLP: 120, glide: .04, gain: .75}},
    // modal (struck) instruments
    felt:       {inst: 'modal', p: {kind: 'felt', sustain: 1, bright: .9, thump: .07, release: .35, gain: 1}},
    piano:      {inst: 'modal', p: {kind: 'piano', sustain: .9, bright: .8, thump: .04, release: .3, gain: .9}},
    ep:         {inst: 'modal', p: {kind: 'ep', sustain: 1, release: .3, lp: 6000, gain: .9}},
    marimba:    {inst: 'modal', p: {kind: 'marimba', sustain: 1, release: .2, lp: 7000, gain: 1}},
    kalimba:    {inst: 'modal', p: {kind: 'kalimba', sustain: .8, release: .2, lp: 6000, gain: 1}},
    vibes:      {inst: 'modal', p: {kind: 'vibes', sustain: .7, release: .4, lp: 7000, gain: .8}},
    glass:      {inst: 'modal', p: {kind: 'glass', sustain: .6, release: .3, lp: 8000, gain: .8}},
    // drums
    kick_round: {inst: 'kick', p: {fStart: 150, fEnd: 50, tau: .032, ampHold: .02, ampTau: .15, click: .12, clickTau: .0012, drive: 1.2, asym: .05, lp: 6000, hp: 30, knock: .05, knockF: 900, sub: .25}},
    kick_909:   {inst: 'kick', p: {fStart: 230, fEnd: 53, tau: .022, sweep2: 280, ampHold: .014, ampTau: .14, click: .3, clickTau: .001, drive: 1.6, asym: .06, lp: 9000, hp: 30, sub: .1}},
    kick_deep:  {inst: 'kick', p: {fStart: 175, fEnd: 46, tau: .04, ampHold: .03, ampTau: .24, click: .18, drive: 1.4, asym: .05, lp: 5000, hp: 26, sub: .35}},
    kick_dist:  {inst: 'kick', p: {fStart: 200, fEnd: 48, tau: .034, ampHold: .02, ampTau: .2, click: .28, drive: 3, asym: .15, lp: 4500, hp: 30, knock: .14, knockF: 1100, sub: .2}},
    kick_soft:  {inst: 'kick', p: {fStart: 120, fEnd: 52, tau: .03, ampHold: .015, ampTau: .12, click: .05, drive: 1.05, lp: 3500, hp: 32, sub: .4}},
    snare_rim:  {inst: 'snare', p: {mode: 'rim', f1: 455, f2: 1667, hp: 300, lp: 9000}},
    snare_clap: {inst: 'snare', p: {mode: 'clap', noiseF: 1300, noiseQ: 1.1, noiseTau: .09, hp: 500, lp: 9000}},
    snare_brush:{inst: 'snare', p: {mode: 'brush', noiseF: 3500, noiseQ: .6, noiseTau: .12, hp: 900, lp: 8000}},
    snare_909:  {inst: 'snare', p: {mode: 'snare', f1: 190, f2: 340, bodyTau: .05, noiseF: 5000, noiseQ: .7, noiseTau: .13, snap: .3, body: .8, noise: .75, drive: 1.3, hp: 160, lp: 11000}},
    snare_soft: {inst: 'snare', p: {mode: 'snare', f1: 210, f2: 360, bodyTau: .04, noiseF: 4200, noiseQ: .6, noiseTau: .09, snap: .15, body: .5, noise: .5, hp: 200, lp: 7000}},
    hat_808:    {inst: 'hat', p: {tune: 1, closedTau: .016, openTau: .17, bpF: 7100, hpF: 7000, air: .2}},
    hat_tight:  {inst: 'hat', p: {tune: 1.15, closedTau: .009, openTau: .12, bpF: 8000, hpF: 8500, air: .35, lp: 14000}},
    hat_dark:   {inst: 'hat', p: {tune: .85, closedTau: .022, openTau: .2, bpF: 6000, hpF: 5500, air: .15, lp: 11000}},
    shaker:     {inst: 'shaker', p: {f: 6500, tau: .045, atk: .008, hp: 4000}},
    perc_click: {inst: 'perc', p: {ratios: [1, 2.57, 4.42], q: 30, tau: .02, gains: [1, .4, .2], noise: .3, hp: 600}},
    perc_wood:  {inst: 'perc', p: {ratios: [1, 2.76, 5.4], q: 22, tau: .035, gains: [1, .35, .12], noise: .2, hp: 300}},
    tom:        {inst: 'tom', p: {ratio: 1.6, pTau: .045, ampTau: .25, noise: .15, noiseTau: .03, lp: 5000}},
    tex_rain:   {inst: 'tex', p: {kind: 'rain', rate: 26}},
    tex_hiss:   {inst: 'tex', p: {kind: 'hiss'}},
    tex_wind:   {inst: 'tex', p: {kind: 'wind'}},
    tex_crackle:{inst: 'tex', p: {kind: 'crackle'}},
    tex_drone:  {inst: 'tex', p: {kind: 'drone'}}};
  // which numeric fields a genome may jitter (relative amounts)
  A.JITTER = {va: {cutoff: .3, res: .35, envAmt: .25, fd: .3, ad: .25, ar: .3, aa: .3, detune2: .4, spread: .4, drift: .4, lfoRate: .5, lfoCut: .5, pw: .15},
    mono: {cutoff: .25, res: .3, envAmt: .25, fd: .3, ad: .2, vib: .5, glide: .4}, bass: {cutoff: .2, res: .3, envAmt: .2, fd: .3, harm: .3, drive: .15},
    modal: {sustain: .3, bright: .3, thump: .5}, kick: {fStart: .15, fEnd: .07, tau: .2, ampTau: .2, click: .4}, snare: {f1: .1, noiseF: .2, noiseTau: .2},
    hat: {tune: .08, closedTau: .25, openTau: .2}, shaker: {f: .15, tau: .25}, perc: {q: .3, tau: .3}, tom: {ampTau: .2}, tex: {}};
  A.PATCH_NORM = A.PATCH_NORM || {};

  // ---------------------------------------------------------------- worlds
  const W = A.WORLDS = {};
  const drumBus = o => Object.assign({bus: 'drums'}, o);
  W.EMERGENCE = {name: 'EMERGENCE', desc: 'rain becomes rhythm', ref: 'Order from Chaos',
    tempo: [112, 122], swing: [0, .06], modes: {aeolian: 3, dorian: 2, phrygian: 1}, families: {pedal: 1.5, oscillate: 1.5, three: 1, resyn: 1, planing: 2, flip: 2}, colour: [.3, .7], spread: [.5, .8], form: ['emergence'],
    alpha: (prog, S, sp) => S.tag === 'outro' ? 1 - sp : clamp((prog - .04) / .5, 0, 1),
    tracks: {
      perc:  drumBus({patch: ['perc_click', 'perc_wood'], db: -13, hp: 400, plate: .25, hall: .2, delay: .12}),
      tex:   {patch: ['tex_rain'], db: -20, plate: 0, hall: .25},
      pad:   {patch: ['pad_warm', 'pad_dark', 'pad_breath'], voices: 14, db: -1, hp: 120, chorus: {mode: 1, mix: .45}, haas: {ms: 11, amount: .5}, plate: .22, hall: .35, delay: .08, duck: 1},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -5},
      kick:  drumBus({patch: ['kick_deep', 'kick_round'], db: -6}),
      hat:   drumBus({patch: ['hat_808', 'hat_dark'], db: -15, hp: 3000, plate: .08, pan: .15}),
      snare: drumBus({patch: ['snare_rim', 'snare_clap'], db: -13, plate: .18, hall: .1}),
      lead:  {patch: ['lead_glass', 'lead_soft'], db: -6, hp: 200, plate: .2, hall: .3, delay: .25},
      pluck: {patch: ['glass', 'kalimba', 'vibes'], voices: 8, db: -11, hp: 300, plate: .25, hall: .3, delay: .2},
      click: drumBus({patch: ['perc_click'], db: -17, hp: 900, plate: .1, delay: .15})},
    parts: [
      {part: 'rain', slot: 'perc', opts: {pitchSlot: 'pluck'}, on: 0, core: true, tight: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'rain', level: .55, follow: 'inverse'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'swell'}, on: .14},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .3},
      {part: 'kick', slot: 'kick', opts: {mode: 'broken'}, on: .55, drum: true},
      {part: 'motif', slot: 'lead', opts: {}, on: .45},
      {part: 'hats', slot: 'hat', opts: {}, on: .64, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {mode: 'broken', vel: .6}, on: .72, drum: true},
      {part: 'clicks', slot: 'click', opts: {count: 3}, on: .78, drum: true}],
    fx: {plate: {decay: .72, damping: .4, predelay: .012}, hall: {rt60: 6, damp: 3200, predelay: .03}, delay: {beats: .75, feedback: .42, lp: 3200, hp: 300, pingpong: 1}, duck: {bass: 9, ret: 3}, master: {tiltHigh: 0}},
    macros: {chaos: .15}};

  W.PRIME = {name: 'PRIME TILING', desc: 'interlocking prime loops that never repeat', ref: 'Penrose Tiling', aeqFrom: .2,
    tempo: [114, 122], swing: [0, .03], modes: {lydian: 2, ionian: 1.5, dorian: 2, mixolydian: 1}, families: {drone: 1, oscillate: 2, three: 1, pedal: 1.5, sus: 2}, colour: [.4, .85], spread: [.55, .9], form: ['swell', 'ambient'],
    tracks: {
      pluck: {patch: ['marimba', 'kalimba'], voices: 12, db: -4, hp: 160, plate: .25, hall: .22, delay: .1, haas: {ms: 7, amount: .3}},
      pluck2:{patch: ['pluck_soft', 'arp_round', 'vibes'], voices: 10, db: -7, hp: 220, chorus: {mode: 2, mix: .4}, plate: .3, hall: .3, delay: .25},
      pad:   {patch: ['pad_glass', 'pad_breath', 'pad_string'], voices: 12, db: -5, hp: 150, chorus: {mode: 1, mix: .5}, plate: .25, hall: .45},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -3},
      click: drumBus({patch: ['perc_click', 'perc_wood'], db: -14, hp: 700, plate: .15, delay: .12}),
      kick:  drumBus({patch: ['kick_round', 'kick_soft'], db: -8}),
      hat:   drumBus({patch: ['hat_tight', 'hat_808'], db: -17, hp: 4000, pan: -.2}),
      shaker:drumBus({patch: ['shaker'], db: -19, pan: .3, plate: .1})},
    parts: [
      {part: 'lanes', slot: 'pluck', opts: {count: 4}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', bend: .3, vel: .5}, on: .2},
      {part: 'clicks', slot: 'click', opts: {count: 4}, on: .3, drum: true, dropBeforePeak: false},
      {part: 'lanes', slot: 'pluck2', opts: {count: 3, primes: [7, 11, 5], rate: 2}, on: .4},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .3},
      {part: 'kick', slot: 'kick', opts: {mode: 'sparse'}, on: .58, off: .8, drum: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .8, drum: true},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .5, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .2}, on: .72, drum: true}],
    fx: {plate: {decay: .65, damping: .3, predelay: .008}, hall: {rt60: 5, damp: 4500, predelay: .02}, delay: {beats: .5, feedback: .35, lp: 4000, hp: 400, pingpong: 1}, duck: {bass: 7, ret: 2}, master: {tiltHigh: .5}},
    macros: {chaos: .1, motion: .35}};

  W.REPETITION = {name: 'REPETITION', desc: 'one stab pattern, slowly swept', ref: 'Resynthesis',
    tempo: [118, 124], swing: [0, .05], modes: {aeolian: 2, dorian: 3, phrygian: 1}, families: {resyn: 2.5, pedal: 1.5, oscillate: 1, flip: 1.5, swing2: 1}, colour: [.3, .65], spread: [.55, .85], form: ['club', 'swell'],
    tracks: {
      stab:  {patch: ['stab_p6', 'stab_juno'], voices: 16, db: -2, hp: 150, chorus: {mode: 1, mix: .35}, haas: {ms: 9, amount: .4}, plate: .2, hall: .15, delay: .3},
      pad:   {patch: ['pad_dark', 'pad_string'], voices: 12, db: -9, hp: 160, plate: .1, hall: .4},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -5},
      bstab: {patch: ['bass_round'], bus: 'bass', db: -10, hp: 70},
      kick:  drumBus({patch: ['kick_909', 'kick_round', 'kick_deep'], db: -6}),
      hat:   drumBus({patch: ['hat_808', 'hat_tight'], db: -14, hp: 3500, pan: .12, plate: .05}),
      snare: drumBus({patch: ['snare_clap', 'snare_rim'], db: -12, plate: .25, hall: .1}),
      shaker:drumBus({patch: ['shaker'], db: -18, pan: -.25}),
      click: drumBus({patch: ['perc_click'], db: -16, hp: 900, delay: .15}),
      arp:   {patch: ['arp_pulse', 'arp_saw'], voices: 8, db: -8, hp: 250, chorus: {mode: 2, mix: .4}, plate: .2, delay: .3}},
    parts: [
      {part: 'stab', slot: 'stab', opts: {}, on: .15, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .25},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .36, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .6}, on: .45, drum: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .45}, on: .5},
      {part: 'clicks', slot: 'click', opts: {count: 3}, on: .52, drum: true},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .58, drum: true},
      {part: 'bass', slot: 'bstab', opts: {mode: 'stab'}, on: .64},
      {part: 'backbeat', slot: 'snare', opts: {}, on: .76, drum: true},
      {part: 'arp', slot: 'arp', opts: {lanes: 1, density: .6}, on: .86}],
    fx: {plate: {decay: .6, damping: .45, predelay: .01}, hall: {rt60: 4.5, damp: 3000, predelay: .025}, delay: {beats: .75, feedback: .5, lp: 2600, hp: 450, pingpong: 1, wow: .0012}, duck: {bass: 10, ret: 4}, master: {tiltHigh: .3}},
    macros: {chaos: .2}};

  W.DRIFT = {name: 'DRIFT', desc: 'every note at its own tempo', ref: 'My Mind Is Slipping', aeqFrom: .15,
    tempo: [64, 86], swing: [0, 0], modes: {aeolian: 2, dorian: 2, ionian: 1, lydian: 1.5}, families: {oscillate: 2, drone: 1.5, three: 1, pedal: 1, sus: 1}, colour: [.4, .8], spread: [.6, .95], form: ['ambient'],
    tracks: {
      phase: {patch: ['felt', 'ep', 'pluck_soft', 'kalimba'], voices: 16, db: -3, hp: 120, plate: .3, hall: .45, delay: .15, haas: {ms: 8, amount: .3}},
      pad:   {patch: ['pad_string', 'pad_glass', 'pad_breath'], voices: 12, db: -7, hp: 140, chorus: {mode: 1, mix: .55}, plate: .2, hall: .55},
      tex:   {patch: ['tex_hiss', 'tex_crackle'], db: -24},
      drone: {patch: ['tex_drone'], db: -16, hall: .4},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -3},
      keys:  {patch: ['felt', 'piano'], voices: 10, db: -8, hp: 150, plate: .3, hall: .5},
      kick:  drumBus({patch: ['kick_soft', 'kick_round'], db: -11}),
      click: drumBus({patch: ['perc_wood', 'perc_click'], db: -18, hp: 600, plate: .3, delay: .2})},
    parts: [
      {part: 'phase', slot: 'phase', opts: {}, on: 0, core: true, tight: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .4, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'swell', vel: .5}, on: .18},
      {part: 'texture', slot: 'drone', opts: {kind: 'drone', level: .5, follow: 'energy'}, on: .26},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub', vel: .8}, on: .24},
      {part: 'keys', slot: 'keys', opts: {density: .35}, on: .42},
      {part: 'clicks', slot: 'click', opts: {count: 2, primes: [7, 11]}, on: .48, drum: true, dropBeforePeak: false},
      {part: 'kick', slot: 'kick', opts: {mode: 'sparse', vel: .7}, on: .5, drum: true, dropBeforePeak: false}],
    fx: {plate: {decay: .8, damping: .5, predelay: .02}, hall: {rt60: 9, damp: 2600, predelay: .04}, delay: {beats: 1.5, feedback: .45, lp: 2200, hp: 300, pingpong: 1, wow: .002}, duck: {bass: 3, ret: 1}, master: {tiltHigh: -1}},
    macros: {chaos: .1, motion: .5, space: .65}};

  W.RETRO = {name: 'WARM RETRO', desc: 'arps, tape and old electric piano', ref: 'Waves',
    tempo: [104, 116], swing: [.05, .14], modes: {mixolydian: 2, ionian: 1.5, lydian: 2, dorian: 2}, families: {poploop: 2, three: 1.5, cinematic: 1, tetra: 1, sus: 1}, colour: [.45, .85], spread: [.5, .8], form: ['swell'],
    tracks: {
      arp:   {patch: ['arp_pulse', 'arp_round', 'arp_saw'], voices: 10, db: -4, hp: 200, chorus: {mode: 2, mix: .55}, plate: .2, hall: .15, delay: .32},
      keys:  {patch: ['ep'], voices: 12, db: -5, hp: 130, chorus: {mode: 1, mix: .5}, plate: .25, hall: .2},
      pad:   {patch: ['pad_warm', 'pad_string'], voices: 12, db: -6, hp: 140, chorus: {mode: 1, mix: .6}, plate: .2, hall: .35},
      bass:  {patch: ['bass_sub', 'bass_round'], bus: 'bass', db: -5},
      kick:  drumBus({patch: ['kick_round', 'kick_soft'], db: -7}),
      snare: drumBus({patch: ['snare_rim', 'snare_brush', 'snare_soft'], db: -12, plate: .25}),
      hat:   drumBus({patch: ['hat_dark', 'hat_808'], db: -16, hp: 3000, pan: .2}),
      shaker:drumBus({patch: ['shaker'], db: -18, pan: -.3}),
      lead:  {patch: ['lead_square', 'lead_soft'], db: -7, hp: 250, chorus: {mode: 2, mix: .4}, plate: .2, delay: .3},
      tex:   {patch: ['tex_crackle'], db: -26}},
    parts: [
      {part: 'arp', slot: 'arp', opts: {}, on: .08, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'crackle', level: .35, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .5}, on: .2},
      {part: 'keys', slot: 'keys', opts: {density: .6, vel: .55}, on: .3},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .32},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .4, drum: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'broken'}, on: .46, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {vel: .6}, on: .54, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .3}, on: .62, drum: true},
      {part: 'motif', slot: 'lead', opts: {}, on: .66}],
    fx: {plate: {decay: .6, damping: .5, predelay: .01}, hall: {rt60: 3.5, damp: 3000, predelay: .02}, delay: {beats: .75, feedback: .45, lp: 2400, hp: 350, pingpong: 1, wow: .0025, flutter: .0002}, duck: {bass: 7, ret: 2}, master: {tiltHigh: -1.5}},
    macros: {chaos: .15, y: .35}};

  W.CRESCENDO = {name: 'CRESCENDO', desc: 'one frozen riff that opens for minutes', ref: 'Open Eye Signal',
    tempo: [118, 126], swing: [0, .03], modes: {aeolian: 2, dorian: 2, phrygian: 1.5, mixolydian: 1}, families: {drone: 1, pedal: 2, oscillate: 2, riff: 1, planing: 1.5, flip: 1}, colour: [.2, .6], spread: [.5, .8], form: ['crescendo'],
    openWithE: ['arp', 'bass', 'pad'],
    tracks: {
      bass:  {patch: ['bass_rolling', 'bass_round'], bus: 'bass', db: -4},
      arp:   {patch: ['arp_saw', 'arp_pulse'], voices: 8, db: -5, hp: 200, plate: .15, delay: .25, drive: .25},
      click: drumBus({patch: ['perc_click'], db: -15, hp: 800, plate: .1, delay: .12}),
      kick:  drumBus({patch: ['kick_dist', 'kick_909'], db: -5}),
      pad:   {patch: ['pad_dark', 'pad_warm'], voices: 14, db: -6, hp: 150, chorus: {mode: 1, mix: .4}, plate: .2, hall: .4},
      hat:   drumBus({patch: ['hat_808', 'hat_tight'], db: -14, hp: 3500, pan: .1}),
      snare: drumBus({patch: ['snare_clap', 'snare_909'], db: -12, plate: .2, hall: .15}),
      keys:  {patch: ['felt', 'piano'], voices: 10, db: -6, hp: 120, plate: .3, hall: .45},
      lead:  {patch: ['lead_soft', 'lead_glass'], db: -7, hp: 250, plate: .2, hall: .3, delay: .25},
      tex:   {patch: ['tex_hiss'], db: -24}},
    parts: [
      {part: 'keys', slot: 'keys', opts: {density: .5, vel: .5}, on: 0, off: .3},
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .4, follow: 'energy'}, on: 0, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'rolling'}, on: .16},
      {part: 'clicks', slot: 'click', opts: {count: 4}, on: .24, drum: true},
      {part: 'arp', slot: 'arp', opts: {lanes: 1, density: .75, rate: 1}, on: .32},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .46, drum: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'gated'}, on: .56},
      {part: 'hats', slot: 'hat', opts: {open: .5}, on: .62, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {}, on: .8, drum: true},
      {part: 'motif', slot: 'lead', opts: {fractal: true}, on: .88}],
    fx: {plate: {decay: .55, damping: .45, predelay: .008}, hall: {rt60: 5.5, damp: 3000, predelay: .025}, delay: {beats: .375, feedback: .38, lp: 3000, hp: 400, pingpong: 1}, duck: {bass: 11, ret: 4}, master: {tiltHigh: .5}},
    macros: {chaos: .2}};

  W.FELT = {name: 'FELT', desc: 'felt piano over minimal techno', ref: 'Kiasmos',
    tempo: [118, 124], swing: [.02, .08], modes: {aeolian: 3, dorian: 2, ionian: 1}, families: {three: 2, oscillate: 2, pedal: 1, cinematic: 1, flip: 1.5, swing2: 1}, colour: [.35, .7], spread: [.5, .8], form: ['swell'],
    tracks: {
      lead:  {patch: ['felt', 'piano'], inst: 'modal', voices: 10, db: -3, hp: 110, plate: .3, hall: .35, delay: .12},
      keys:  {patch: ['felt'], voices: 12, db: -8, hp: 100, plate: .25, hall: .3},
      pad:   {patch: ['pad_string', 'pad_warm', 'pad_breath'], voices: 12, db: -6, hp: 150, chorus: {mode: 1, mix: .5}, plate: .2, hall: .4},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -5},
      kick:  drumBus({patch: ['kick_round', 'kick_909'], db: -7}),
      shaker:drumBus({patch: ['shaker'], db: -17, pan: .25, plate: .1}),
      hat:   drumBus({patch: ['hat_dark', 'hat_808'], db: -16, hp: 3000, pan: -.15}),
      click: drumBus({patch: ['perc_wood', 'perc_click'], db: -16, hp: 500, plate: .15}),
      tex:   {patch: ['tex_crackle', 'tex_hiss'], db: -26}},
    parts: [
      {part: 'motif', slot: 'lead', opts: {lo: 60, hi: 84, vel: .6}, on: .06, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'crackle', level: .3, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'swell', vel: .5}, on: .2},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .34},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .4, drum: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four', vel: .85}, on: .46, drum: true},
      {part: 'keys', slot: 'keys', opts: {snare: true, density: .4}, on: .5},
      {part: 'clicks', slot: 'click', opts: {count: 3}, on: .56, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .35}, on: .64, drum: true}],
    fx: {plate: {decay: .7, damping: .45, predelay: .012}, hall: {rt60: 5, damp: 3000, predelay: .03}, delay: {beats: .75, feedback: .35, lp: 2800, hp: 400, pingpong: 1}, duck: {bass: 8, ret: 3}, master: {tiltHigh: -.5}},
    macros: {chaos: .12}};

  W.INTENSE = {name: 'INTENSE', desc: 'half-time weight, glitch and grit', ref: 'Exotic Contents',
    tempo: [134, 140], swing: [0, .02], modes: {phrygian: 2, aeolian: 3}, families: {oscillate: 1.5, riff: 1.5, pedal: 1, three: 1, planing: 2.5, flip: 1.5}, colour: [.15, .55], spread: [.45, .75], form: ['club', 'swell'],
    tracks: {
      pad:   {patch: ['pad_dark', 'pad_warm'], voices: 14, db: -4, hp: 160, chorus: {mode: 3, mix: .3}, plate: .15, hall: .45, drive: .2},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -4},
      bstab: {patch: ['bass_dist'], bus: 'bass', db: -9, hp: 90},
      kick:  drumBus({patch: ['kick_dist', 'kick_deep'], db: -5}),
      snare: drumBus({patch: ['snare_909', 'snare_clap'], db: -9, plate: .3, hall: .2}),
      hat:   drumBus({patch: ['hat_tight', 'hat_808'], db: -15, hp: 4500, pan: .15}),
      click: drumBus({patch: ['perc_click'], db: -14, hp: 900, plate: .1, delay: .2}),
      stab:  {patch: ['stab_p6', 'stab_soft'], voices: 12, db: -7, hp: 200, plate: .2, delay: .3, drive: .2},
      tex:   {patch: ['tex_wind'], db: -24, hall: .3}},
    parts: [
      {part: 'pad', slot: 'pad', opts: {mode: 'swell', vel: .55}, on: .1, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'wind', level: .45, follow: 'inverse'}, on: 0, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'halftime'}, on: .26},
      {part: 'kick', slot: 'kick', opts: {mode: 'halftime'}, on: .32, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .25}, on: .36, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {mode: 'halftime', vel: .8}, on: .42, drum: true},
      {part: 'clicks', slot: 'click', opts: {count: 4}, on: .46, drum: true},
      {part: 'bass', slot: 'bstab', opts: {mode: 'stab'}, on: .58},
      {part: 'stab', slot: 'stab', opts: {hits: 9}, on: .8}],
    fx: {plate: {decay: .5, damping: .5, predelay: .006}, hall: {rt60: 7, damp: 2500, predelay: .02}, delay: {beats: .75, feedback: .4, lp: 2500, hp: 500, pingpong: 1}, duck: {bass: 10, ret: 4}, master: {tiltHigh: .6}},
    macros: {chaos: .35, y: .4}};

  A.WORLD_LIST = Object.keys(W);

  // shaker part (simple: 16ths with accent curve, swing via composer) — kept here since only worlds use it
  A.PARTS.shaker = class { constructor(P, o){ this.slot = o.slot || 'shaker'; this.r = P.rng('shaker'); this.acc = [.55, .3, 1, .35]; }
    bar(c){ for (let s = 0; s < 16; s++){ if (c.density < .45 && s % 2) continue; c.emit(this.slot, s, {vel: this.acc[s % 4] * (.75 + .3 * this.r())}); } } };

  // ---------------------------------------------------------------- genome
  const pickW = (r, o) => r.weighted(o);
  A.makeGenome = function(worldName, seed, bias){ const w = W[worldName] || W.EMERGENCE; seed = (seed >>> 0) || 1; const r = A.rng(A.hash(seed, 'genome', worldName)); bias = bias || {};
    const g = {world: w === W[worldName] ? worldName : 'EMERGENCE', seed, bpm: Math.round(r.range(w.tempo[0], w.tempo[1])), tonic: r.int(0, 11), mode: pickW(r, w.modes), family: pickW(r, w.families),
      colour: r.range(w.colour[0], w.colour[1]), spread: r.range(w.spread[0], w.spread[1]), swing: r.range(w.swing[0], w.swing[1]), form: r.pick(w.form), patches: {}, jitter: r.range(.6, 1.2), macros: Object.assign({}, w.macros || {})};
    for (const k in bias) if (g[k] !== undefined && typeof bias[k] === typeof g[k]) g[k] = bias[k];
    for (const slot in w.tracks) g.patches[slot] = r.pick(w.tracks[slot].patch);
    return g; };
  // patch for a slot in a genome, jittered deterministically
  A.genomePatch = function(g, slot, reroll){ const w = W[g.world], name = g.patches[slot], base = P[name]; const r = A.rng(A.hash(g.seed, 'patch', slot, reroll || 0));
    const inst = base.inst, j = A.JITTER[inst] || {}, p = Object.assign({}, base.p);
    for (const f in j) if (typeof p[f] === 'number') p[f] *= 1 + (r() * 2 - 1) * j[f] * g.jitter;
    if (p.res !== undefined) p.res = clamp(p.res, 0, .9);
    return {name, inst, p}; };
  // simple genome distance (for diversity: never serve something too close to the last few)
  A.genomeDistance = (a, b) => (a.world !== b.world ? 3 : 0) + (a.mode !== b.mode ? .7 : 0) + (a.family !== b.family ? .6 : 0) + Math.abs(a.bpm - b.bpm) / 20 + Math.abs(a.colour - b.colour) + ((a.tonic - b.tonic + 12) % 12 ? .3 : 0)
    + Object.keys(a.patches).filter(k => b.patches[k] !== undefined && a.patches[k] !== b.patches[k]).length * .15;
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_WORLDS;
