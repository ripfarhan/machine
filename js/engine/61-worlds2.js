/* Maut ki Awaaz — engine module: v2 sound palette + 14 new worlds (additive: the 8 v1 worlds are untouched, they only
   gain an `fx` track for transition sounds). Recipes: research/02 §C style atlas, research/07, research/06 measurements. */
'use strict';
function AWZ_WORLDS2(A){
  const P = A.PATCH, W = A.WORLDS, drumBus = o => Object.assign({bus: 'drums'}, o);
  Object.assign(P, {
    // synth voices built from the v1 VA engine
    acid303:    {inst: 'mono', p: {shape1: 2, osc2Level: 0, drift: 1, cutoff: 260, res: .86, keytrack: .3, envAmt: 3.2, fa: .001, fd: .22, fs: 0, fr: .1, aa: .002, ad: .3, as: .85, ar: .06, glide: .06, drive: 1.6, gain: .55}},
    acid_sq:    {inst: 'mono', p: {shape1: 3, pw: .5, osc2Level: 0, drift: 1, cutoff: 300, res: .82, keytrack: .3, envAmt: 3, fa: .001, fd: .2, fs: 0, fr: .1, aa: .002, ad: .3, as: .85, ar: .06, glide: .06, drive: 1.5, gain: .5}},
    reese:      {inst: 'mono', p: {shape1: 2, shape2: 2, osc2Level: .9, detune2: 22, unison: 3, spread: 26, uniPan: .3, drift: 3, cutoff: 420, res: .25, keytrack: .3, envAmt: .4, fa: .01, fd: .5, fs: .8, fr: .3, aa: .01, ad: .5, as: 1, ar: .2, lfoRate: .25, lfoCut: .45, glide: .08, legato: true, sub: .5, gain: .45}},
    supersaw:   {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .9, detune2: 13, unison: 3, spread: 32, uniPan: .8, drift: 3, cutoff: 2600, res: .12, keytrack: .4, envAmt: .8, fa: .005, fd: .6, fs: .5, fr: .8, aa: .01, ad: 1, as: .75, ar: .9, gain: .38}},
    // same sound, short envelope: for stabs and arps (notes end instead of piling up — supersaw is the most expensive voice)
    supersaw_stab: {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .9, detune2: 13, unison: 3, spread: 32, uniPan: .8, drift: 3, cutoff: 2600, res: .12, keytrack: .4, envAmt: 1.1, fa: .002, fd: .28, fs: .25, fr: .3, aa: .004, ad: .32, as: .3, ar: .3, gain: .42}},
    seq_saw:    {inst: 'va', p: {shape1: 2, shape2: 3, pw: .4, osc2Level: .6, detune2: 5, drift: 6, cutoff: 350, res: .55, keytrack: .4, envAmt: 2.2, fa: .001, fd: .12, fs: 0, fr: .06, aa: .001, ad: .12, as: 0, ar: .06, gain: .7}},
    moog_lead:  {inst: 'mono', p: {shape1: 2, shape2: 2, osc2Level: .5, detune2: 5, drift: 3, cutoff: 1200, res: .3, keytrack: .5, envAmt: 1.4, fa: .01, fd: .5, fs: .4, fr: .4, aa: .01, ad: .6, as: .8, ar: .4, vib: 18, vibDelay: .4, vibRate: 5.5, glide: .09, legato: true, gain: .5}},
    cs80_brass: {inst: 'va', p: {shape1: 3, pw: .4, pwm: .15, shape2: 3, semi2: 12, detune2: -6, osc2Level: .5, drift: 3, cutoff: 700, res: .15, keytrack: .5, envAmt: 1.6, fa: .65, fd: 4, fs: .6, fr: 1, aa: .25, ad: 1.9, as: .5, ar: .75, vib: 8, vibDelay: .6, gain: .45}},
    mellotron:  {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .4, detune2: 9, unison: 3, spread: 14, uniPan: .7, drift: 4, filter: 'svf', cutoff: 2200, res: .05, keytrack: .4, envAmt: .3, fa: .2, fd: 1, fs: .8, fr: 1, aa: .3, ad: 2, as: .9, ar: 1.5, lfoRate: 5.5, lfoPitch: 4, gain: .42}},
    cello:      {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .5, detune2: 6, unison: 2, spread: 8, drift: 3, filter: 'svf', filterMode: 'bp', cutoff: 600, res: .2, keytrack: .6, envAmt: .2, aa: .5, ad: 1, as: .9, ar: 1.2, vib: 8, vibRate: 5, vibDelay: .3, gain: .9}},
    string_bp:  {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .8, detune2: 18, unison: 2, spread: 10, drift: 4, filter: 'svf', filterMode: 'bp', cutoff: 1200, res: .1, keytrack: .3, aa: 1, ad: 2, as: .9, ar: 3, gain: .8}},
    wobble_pad: {inst: 'va', p: {shape1: 2, shape2: 2, osc2Level: .6, detune2: 3, unison: 3, spread: 6, drift: 5, noise: .05, cutoff: 1400, res: .3, keytrack: .4, envAmt: .5, fa: 1, fd: 2, fs: .5, fr: 1.5, aa: 1.3, ad: 2, as: .85, ar: 1.2, lfoRate: .25, lfoPitch: 30, gain: .42}},
    flute_lead: {inst: 'mono', p: {shape1: .5, shape2: 1, osc2Level: .2, detune2: 4, drift: 4, noise: .03, filter: 'svf', cutoff: 2500, res: .05, keytrack: .5, aa: .3, ad: .5, as: .9, ar: .5, vib: 10, vibDelay: .5, lfoRate: .3, lfoPitch: 12, glide: .05, legato: true, gain: .65}},
    sq_lead:    {inst: 'va', p: {shape1: 3, pw: .5, osc2Level: 0, drift: 2, cutoff: 6000, res: 0, keytrack: .3, aa: .001, ad: .073, as: 0, ar: .1, gain: .5}},
    // v2 voices
    fm_bass:    {inst: 'fmmono', p: {ratio: 1, index: 3, id: .25, is: .25, ir: .1, lp: 1200, aa: .003, ad: .4, as: .7, ar: .1, glide: .05, feedback: .2, gain: .7}},
    fm_rhodes:  {inst: 'fm', p: {ratio: 1, index: 2, id: .6, is: .15, ir: .4, lp: 5000, aa: .002, ad: 1.5, as: .3, ar: .5, gain: .7}},
    fm_metal:   {inst: 'fm', p: {ratio: 1.414, index: 1.4, id: .15, is: 0, ir: .1, lp: 7000, aa: .001, ad: .35, as: 0, ar: .3, feedback: .3, gain: .45}},
    fm_bongo:   {inst: 'fm', p: {ratio: 1.5, index: .8, id: .08, is: 0, ir: .1, lp: 3000, aa: .001, ad: .2, as: 0, ar: .15, gain: .8}},
    fm_strings: {inst: 'fm', p: {ratio: 1.003, index: 1.2, id: 1, is: 1, ir: 2, lp: 1100, aa: .8, ad: 1, as: .9, ar: 2, tune: -25, gain: .55}},
    organ:      {inst: 'organ', p: {drawbars: [.6, 1, .8, .4, .5, 0, .3], perc: .5, aa: .006, ar: .08, gain: .8}},
    organ_soft: {inst: 'organ', p: {drawbars: [.3, 1, .4, 0, .2, 0, 0], perc: 0, aa: .3, ar: 1.2, gain: .9}},
    choir:      {inst: 'choir', p: {aa: .9, ad: 1, as: .85, ar: 2, detune: 10, breath: .06, vdrift: .4, q: 7, gain: .8}},
    vox_chop:   {inst: 'choir', p: {aa: .005, ad: .15, as: .4, ar: .12, detune: 6, breath: .02, bend: 2, bendTime: .06, vdrift: 1.2, q: 9, gain: .9}},
    boom808:    {inst: 'boom', p: {decay: 1.1, ptau: .03, pitch: 1.3, glide: .07, drive: 2, lp: 700, gain: .9}},
    kick_click: {inst: 'kick', p: {fStart: 300, fEnd: 85, tau: .008, ampHold: .004, ampTau: .03, click: .5, clickTau: .0008, drive: 1.2, lp: 9000, hp: 60}},
    kick_lofi:  {inst: 'kick', p: {fStart: 140, fEnd: 52, tau: .03, ampHold: .015, ampTau: .18, click: .05, drive: 1.3, lp: 1000, hp: 30, sub: .3}},
    hat_ride:   {inst: 'hat', p: {tune: .7, closedTau: .09, openTau: .5, bpF: 5000, hpF: 4500, air: .4, lp: 9000}},
    hat_lofi:   {inst: 'hat', p: {tune: .8, closedTau: .02, openTau: .14, bpF: 4000, hpF: 3000, air: .1, lp: 7000}},
    dub_stab:   {inst: 'va', p: {shape1: 3, pw: .7, shape2: 2, osc2Level: .7, detune2: 6, drift: 3, noise: .12, filter: 'svf', filterMode: 'hp', cutoff: 320, res: .25, keytrack: .3, lfoRate: .25, lfoCut: .6, aa: .002, ad: .18, as: 0, ar: .2, gain: .8}},
    perc_plonk: {inst: 'perc', p: {ratios: [1, 2.02, 3.1], q: 18, tau: .06, gains: [1, .3, .1], noise: .1, hp: 200}},
    fx:         {inst: 'fx', p: {}}});
  // v2 progression families (research/07 E6: Perpetual Motion; withheld colour, power + sus)
  A.FAM.perpetual = r => ({loop: [{deg: 0, bars: r.pick([1, 2]), type: 'open'}, {deg: 3, bars: 1, type: 'sus2'}, {deg: 5, bars: 1, type: 'open'}, {deg: 4, bars: r.pick([1, 2]), type: 'open'}], pedal: null});
  A.FAM.fog = r => ({loop: [{deg: 0, bars: 32, type: r.pick(['sus2', 'add9', 'no3add9'])}], pedal: 0});
  A.FAMILIES = Object.keys(A.FAM);
  Object.assign(A.JITTER, {fm: {index: .2, id: .3, lp: .2}, fmmono: {index: .2, id: .3, lp: .2}, organ: {perc: .3}, choir: {vdrift: .4, detune: .3}, boom: {decay: .2, pitch: .2}, fx: {}});

  Object.assign(A.FORMS, {
    process:  [['unison', 16, .15, .3], ['phase', 32, .3, .5], ['bloom', 32, .5, .7], ['pulse', 16, .7, .62], ['phase', 32, .5, .35], ['fade', 16, .3, .03, 'outro']],
    longform: [['drone', 16, .05, .15], ['enter', 24, .2, .4], ['sweep', 32, .45, .7], ['solo', 32, .7, .86, 'peak'], ['return', 16, .5, .4], ['tail', 16, .3, .03, 'outro']],
    nightbus: [['haze', 8, .15, .25], ['bus', 24, .45, .55], ['drift', 16, .3, .35, 'break'], ['bus', 32, .55, .66], ['rain', 8, .25, .25, 'break'], ['bus', 24, .6, .72, 'peak'], ['fade', 16, .3, .03, 'outro']],
    techno:   [['intro', 16, .3, .42], ['groove', 32, .55, .66], ['break', 16, .3, .36, 'break'], ['build', 16, .5, .82, 'build'], ['drop', 32, .88, .95, 'peak'], ['groove', 16, .66, .6], ['break', 8, .3, .3, 'break'], ['build', 8, .6, .85, 'build'], ['drop', 16, .9, .96, 'peak'], ['outro', 16, .45, .08, 'outro']]});

  const quiet = {riser: 0, impact: 0, subdrop: 0, roll: 0, gap: 0, tapestop: 0, stutter: 0, gate: 0, hpbuild: 0, halftime: 0, climb: 0, freeze: 0};

  W.VOID = {name: 'VOID', desc: 'dark minor swing, metal and drones', ref: 'Void', v2: true,
    tempo: [121, 125], swing: [0, .03], modes: {aeolian: 3, phrygian: 1.5}, families: {swing2: 3, oscillate: 1, flip: 1}, colour: [.2, .5], spread: [.5, .8], form: ['club', 'techno'],
    sends: {shim: {feedback: .5, gain: .5, rt60: 7}, reso: {feedback: .97, damp: .4, gain: .3}},
    tracks: {
      pad:   {patch: ['pad_dark', 'mellotron'], voices: 14, db: -5, hp: 160, plate: .1, hall: .4, shim: .25},
      drone: {patch: ['tex_drone'], db: -14, hall: .4},
      bass:  {patch: ['bass_rolling', 'reese'], bus: 'bass', db: -4},
      kick:  drumBus({patch: ['kick_deep', 'kick_909'], db: -5}),
      metal: {patch: ['fm_metal'], voices: 10, db: -12, hp: 400, plate: .2, reso: .5, delay: .15},
      hat:   drumBus({patch: ['hat_808', 'hat_tight'], db: -15, hp: 3500, pan: .1}),
      click: drumBus({patch: ['perc_click'], db: -15, hp: 900, reso: .4}),
      snare: drumBus({patch: ['snare_clap'], db: -12, plate: .25, hall: .1})},
    parts: [
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .55}, on: 0, core: true},
      {part: 'texture', slot: 'drone', opts: {kind: 'drone', level: .5, follow: 'energy'}, on: 0, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'rolling'}, on: .25},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .3, drum: true},
      {part: 'clicks', slot: 'click', opts: {count: 3}, on: .4, drum: true},
      {part: 'lanes', slot: 'metal', opts: {count: 3, primes: [5, 7, 11], rate: 2}, on: .45},
      {part: 'hats', slot: 'hat', opts: {open: .4}, on: .5, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {}, on: .75, drum: true}],
    fx: {plate: {decay: .55, damping: .5, predelay: .008}, hall: {rt60: 6, damp: 2600, predelay: .03}, delay: {beats: .75, feedback: .4, lp: 2400, hp: 500, pingpong: 1}, duck: {bass: 10, ret: 4}, master: {tiltHigh: -2.5}},
    moves: {impact: 1.2, subdrop: 1, down: 1, riser: .8, gap: .9, tapestop: .3}, macros: {chaos: .2}};

  W.TREEMAP = {name: 'TREE MAP', desc: 'a melody that branches into itself', ref: 'Transcendental Tree Map', v2: true,
    tempo: [115, 119], swing: [0, .03], modes: {aeolian: 2, dorian: 2}, families: {planing: 2, three: 1.5, swing2: 1}, colour: [.3, .6], spread: [.5, .85], form: ['emergence', 'swell'],
    alpha: (prog, S, sp) => S.tag === 'outro' ? 1 - sp : Math.min(1, prog * 2),
    sends: {gran: {density: 14, size: .14, spread: 1.5, pitches: [1, 2, .5, 1.5, 1], reverse: .3, gain: .7}},
    tracks: {
      lead:  {patch: ['pluck_soft', 'fm_bongo', 'glass'], voices: 12, db: -4, hp: 200, delay: .25, plate: .2, gran: .3},
      arp:   {patch: ['arp_round', 'fm_bongo'], voices: 10, db: -7, hp: 250, delay: .2, gran: .15},
      pad:   {patch: ['pad_glass', 'pad_breath'], voices: 12, db: -6, hp: 160, hall: .4, gran: .2},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -4},
      kick:  drumBus({patch: ['kick_click', 'kick_round'], db: -9}),
      click: drumBus({patch: ['perc_click'], db: -14, hp: 900, delay: .15}),
      hat:   drumBus({patch: ['hat_tight'], db: -17, hp: 4500, pan: -.15})},
    parts: [
      {part: 'motif', slot: 'lead', opts: {fractal: true, lo: 64, hi: 91, vel: .65}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .5}, on: .2},
      {part: 'arp', slot: 'arp', opts: {lanes: 2, density: .7}, on: .3},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .35},
      {part: 'clicks', slot: 'click', opts: {count: 4}, on: .4, drum: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four', vel: .9}, on: .5, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .2}, on: .65, drum: true}],
    fx: {plate: {decay: .6, damping: .4}, hall: {rt60: 5, damp: 4000}, delay: {beats: .75, feedback: .4, lp: 3500, hp: 400, pingpong: 1}, duck: {bass: 8, ret: 3}, master: {tiltHigh: -2}},
    moves: {riser: .8, freeze: .8, climb: .7}, macros: {chaos: .15, motion: .45}};

  W.BERLIN = {name: 'BERLIN', desc: 'one sequence breathing for minutes', ref: 'Tangerine Dream', v2: true,
    tempo: [118, 130], swing: [0, 0], modes: {phrygian: 1.5, aeolian: 2, dorian: 2}, families: {drone: 2, pedal: 2, oscillate: 1}, colour: [.2, .5], spread: [.5, .8], form: ['longform'],
    sends: {rev: {beats: 1, feedback: .3, gain: .6}},
    tracks: {
      seq:   {patch: ['seq_saw', 'arp_saw'], voices: 10, db: -3, hp: 120, delay: .35, rev: .15},
      pad:   {patch: ['mellotron', 'pad_string'], voices: 14, db: -6, hp: 150, hall: .4, ins: [{type: 'phaser', rate: .08, mix: .35}]},
      lead:  {patch: ['moog_lead'], db: -6, hp: 200, delay: .3, hall: .3},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -5},
      tick:  drumBus({patch: ['shaker'], db: -18, pan: .2}),
      drone: {patch: ['tex_drone'], db: -16, hall: .3}},
    parts: [
      {part: 'texture', slot: 'drone', opts: {kind: 'drone', level: .5, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .5}, on: .05},
      {part: 'seq', slot: 'seq', opts: {lens: [16, 12]}, on: .18, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .35},
      {part: 'shaker', slot: 'tick', opts: {}, on: .45, drum: true, dropBeforePeak: false},
      {part: 'motif', slot: 'lead', opts: {}, on: .7}],
    fx: {plate: {decay: .6, damping: .45}, hall: {rt60: 6, damp: 3000}, delay: {beats: 3, feedback: .55, lp: 2600, hp: 300, pingpong: 1, wow: .0015}, duck: {bass: 4, ret: 1}, master: {tiltHigh: 0}},
    moves: {riser: .6, wash: 1, throw: 1.2, swell: 1, impact: .4, roll: 0, gap: 0, tapestop: .2, stutter: .2, gate: .2, climb: .8}, macros: {chaos: .1, motion: .5}};

  W.NIGHTBUS = {name: 'NIGHT BUS', desc: 'off-grid shuffle, ghost voices, rain', ref: 'Burial', v2: true, aeqFrom: .3,
    tempo: [132, 140], swing: [0, 0], modes: {aeolian: 3, dorian: 1}, families: {oscillate: 2, drone: 1.5, swing2: 1}, colour: [.2, .45], spread: [.5, .8], form: ['nightbus'],
    tracks: {
      kick:  drumBus({patch: ['kick_lofi'], db: -7}),
      snare: drumBus({patch: ['snare_rim', 'snare_soft'], db: -11, hall: .3}),
      perc:  drumBus({patch: ['perc_wood'], db: -15, hall: .2}),
      hat:   drumBus({patch: ['hat_lofi'], db: -16, pan: .15}),
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -4},
      pad:   {patch: ['string_bp'], voices: 12, db: -6, hall: .6},
      vox:   {patch: ['vox_chop'], voices: 8, db: -7, hp: 300, hall: .5, delay: .25},
      tex:   {patch: ['tex_crackle'], db: -22},
      rain:  {patch: ['tex_rain'], db: -26, hall: .2}},
    parts: [
      {part: 'texture', slot: 'tex', opts: {kind: 'crackle', level: .45, follow: 'constant'}, on: 0, core: true},
      {part: 'texture', slot: 'rain', opts: {kind: 'rain', level: .35, follow: 'inverse'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'swell', vel: .5}, on: .1},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub', vel: .8}, on: .3},
      {part: 'twostep', slot: 'kick', opts: {}, on: .35, drum: true},
      {part: 'chops', slot: 'vox', opts: {}, on: .45}],
    fx: {plate: {decay: .7, damping: .5}, hall: {rt60: 8, damp: 2500, predelay: .04}, delay: {beats: .75, feedback: .45, lp: 2200, hp: 400, pingpong: 1, wow: .002}, duck: {bass: 10, ret: 3}, master: {tiltHigh: -1}},
    moves: {gap: 1, tapestop: .8, down: 1, swell: 1.2, wash: 1.2, impact: .3, riser: .3, roll: 0, gate: 0, hpbuild: .3}, macros: {chaos: .3, y: .3, space: .7}};

  W.AIRPORT = {name: 'AIRPORT', desc: 'loops of different lengths drift past each other', ref: 'Music for Airports', v2: true, aeqFrom: .15,
    tempo: [60, 72], swing: [0, 0], modes: {ionian: 2, lydian: 1.5, mixolydian: 1.5}, families: {drone: 2, oscillate: 1}, colour: [.3, .6], spread: [.6, .9], form: ['ambient', 'process'],
    sends: {shim: {feedback: .5, gain: .45, rt60: 9}},
    tracks: {
      loops: {patch: ['choir'], voices: 12, db: -4, hp: 150, hall: .6, delay: .4, shim: .3},
      keys:  {patch: ['fm_rhodes', 'felt'], voices: 10, db: -6, hp: 120, hall: .5, delay: .4, eq: [[320, -3, .9]]},
      tex:   {patch: ['tex_hiss'], db: -26}},
    parts: [
      {part: 'eno', slot: 'loops', opts: {}, on: 0, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .35, follow: 'constant'}, on: 0, core: true},
      {part: 'eno', slot: 'keys', opts: {loops: [13.1, 15.7, 19.3, 22.9], dur: 4}, on: .25}],
    fx: {plate: {decay: .8, damping: .5}, hall: {rt60: 9, damp: 3000, predelay: .05}, delay: {beats: 2, feedback: .45, lp: 3000, hp: 300, pingpong: 1}, duck: {bass: 0, ret: 0}, master: {tiltHigh: -.5}},
    moves: Object.assign({}, quiet, {swell: .5, wash: .6, throw: .3, down: .2, keylift: .2}), macros: {space: .75, motion: .3, chaos: .05}};

  W.ARPRIDE = {name: 'ARP RIDE', desc: 'one arp under a hand-ridden filter', ref: 'Stephan Bodzin', v2: true,
    tempo: [122, 126], swing: [0, .02], modes: {aeolian: 3, phrygian: 1.5}, families: {poploop: 1.5, riff: 2, cinematic: 1, planing: 1}, colour: [.2, .5], spread: [.5, .8], form: ['techno'],
    ride: [{slot: 'arp', bars: 16, depth: 2.4}],
    tracks: {
      kick:  drumBus({patch: ['kick_909'], db: -5}),
      clap:  drumBus({patch: ['snare_clap'], db: -11, plate: .2}),
      hat:   drumBus({patch: ['hat_808'], db: -15, hp: 3500, pan: .1}),
      ride:  drumBus({patch: ['hat_ride'], db: -18, pan: -.2}),
      tom:   drumBus({patch: ['tom'], db: -14, plate: .15}),
      bass:  {patch: ['bass_rolling'], bus: 'bass', db: -4},
      arp:   {patch: ['arp_saw', 'supersaw_stab'], voices: 8, db: -4, hp: 200, delay: .25, hall: .2},
      pad:   {patch: ['supersaw_stab', 'pad_warm'], voices: 10, db: -8, hp: 200, hall: .35},
      lead:  {patch: ['moog_lead', 'lead_soft'], db: -7, hp: 250, hall: .4}},
    parts: [
      {part: 'arp', slot: 'arp', opts: {lanes: 1, density: .9, rate: 1}, on: .2, core: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .3, drum: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'rolling'}, on: .35},
      {part: 'hats', slot: 'hat', opts: {open: .5}, on: .4, drum: true},
      {part: 'toms', slot: 'tom', opts: {}, on: .55, drum: true},
      {part: 'backbeat', slot: 'clap', opts: {}, on: .6, drum: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'gated'}, on: .65},
      {part: 'hats', slot: 'ride', opts: {open: 0}, on: .75, drum: true},
      {part: 'motif', slot: 'lead', opts: {}, on: .82}],
    fx: {plate: {decay: .55, damping: .45}, hall: {rt60: 4, damp: 3500}, delay: {beats: .75, feedback: .35, lp: 3000, hp: 400, pingpong: 1}, duck: {bass: 10, ret: 4}, master: {tiltHigh: -1.5}},
    moves: {riser: 1.3, impact: 1.2, hpbuild: 1.3, gate: 1, roll: 1, gap: 1, subdrop: .8, halftime: .6, climb: .6}, macros: {chaos: .15}};

  W.REICH = {name: 'PHASE', desc: 'two players drift apart and lock again', ref: 'Steve Reich', v2: true, aeqFrom: 0,
    tempo: [150, 176], swing: [0, 0], modes: {ionian: 1, lydian: 1, dorian: 1.5, aeolian: 1}, families: {drone: 3}, colour: [.3, .5], spread: [.5, .8], form: ['process'],
    tracks: {
      mar:   {patch: ['marimba', 'felt', 'fm_bongo'], voices: 16, db: -3, hp: 150, plate: .15, eq: [[300, -2.5, .8], [2800, 2.5, .7]]},
      drone: {patch: ['organ_soft'], voices: 10, db: -12, hp: 100, hall: .3},
      tex:   {patch: ['tex_hiss'], db: -30}},
    parts: [
      {part: 'reich', slot: 'mar', opts: {}, on: 0, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .3, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'drone', opts: {mode: 'swell', vel: .4}, on: .5}],
    fx: {plate: {decay: .45, damping: .5}, hall: {rt60: 2.5, damp: 4000}, delay: {beats: .75, feedback: .2, lp: 3000, hp: 400, pingpong: 1}, duck: {bass: 0, ret: 0}, master: {tiltHigh: 0}},
    moves: Object.assign({}, quiet, {swell: .3, wash: .3, throw: 0, down: 0}), macros: {space: .3, chaos: .05, motion: .5}};

  W.POLYMETER = {name: 'POLYMETER', desc: 'arp lanes of 7, 9, 10, 11, 16 steps', ref: 'Nils Frahm — Says', v2: true,
    tempo: [100, 120], swing: [0, 0], modes: {aeolian: 2, dorian: 2}, families: {drone: 2, pedal: 1}, colour: [.2, .4], spread: [.5, .8], form: ['crescendo', 'longform'],
    tracks: {
      arp:   {patch: ['arp_pulse'], voices: 12, db: -3, hp: 150, delay: .35},
      organ: {patch: ['organ'], voices: 10, db: -9, hp: 120, hall: .3, ins: [{type: 'rotary', fast: false, mix: .7}]},
      keys:  {patch: ['felt'], voices: 10, db: -6, hp: 150, hall: .35},
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -6},
      kick:  drumBus({patch: ['kick_soft'], db: -10}),
      tex:   {patch: ['tex_hiss'], db: -26}},
    parts: [
      {part: 'polyarp', slot: 'arp', opts: {}, on: 0, core: true},
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .3, follow: 'constant'}, on: 0, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub', vel: .8}, on: .4},
      {part: 'pad', slot: 'organ', opts: {mode: 'hold', vel: .5}, on: .7},
      {part: 'motif', slot: 'keys', opts: {lo: 72, hi: 91, vel: .55}, on: .78},
      {part: 'kick', slot: 'kick', opts: {mode: 'sparse', vel: .75}, on: .85, drum: true}],
    fx: {plate: {decay: .7, damping: .4}, hall: {rt60: 5, damp: 3000}, delay: {beats: .75, feedback: .55, lp: 2600, hp: 300, pingpong: 1, wow: .0025}, duck: {bass: 4, ret: 1}, master: {tiltHigh: 0}},
    moves: {riser: .5, swell: 1, wash: .8, throw: 1, impact: .3, roll: 0, gap: .2, tapestop: .3, gate: 0, hpbuild: .3}, macros: {chaos: .1, motion: .45}};

  W.TAPE = {name: 'TAPE MEMORY', desc: 'everything drifts in pitch together, dusty beat', ref: 'Boards of Canada', v2: true,
    tempo: [80, 94], swing: [.08, .14], modes: {mixolydian: 2, ionian: 1.5, dorian: 1}, families: {oscillate: 2, poploop: 1, three: 1}, colour: [.35, .6], spread: [.5, .8], form: ['swell'],
    tracks: {
      pad:   {patch: ['wobble_pad'], voices: 14, db: -4, hp: 140, hall: .4},
      lead:  {patch: ['flute_lead'], db: -7, hp: 250, delay: .3, hall: .3},
      bass:  {patch: ['bass_round', 'fm_bass'], bus: 'bass', db: -5},
      kick:  drumBus({patch: ['kick_lofi'], db: -7}),
      snare: drumBus({patch: ['snare_soft', 'snare_rim'], db: -10, plate: .2}),
      hat:   drumBus({patch: ['hat_lofi'], db: -15, pan: .15}),
      keys:  {patch: ['fm_rhodes'], voices: 10, db: -8, hp: 150, hall: .3},
      tex:   {patch: ['tex_crackle'], db: -22}},
    parts: [
      {part: 'texture', slot: 'tex', opts: {kind: 'crackle', level: .45, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .55}, on: .05, core: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .3},
      {part: 'kick', slot: 'kick', opts: {mode: 'broken'}, on: .35, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {vel: .6}, on: .4, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .2}, on: .45, drum: true},
      {part: 'keys', slot: 'keys', opts: {density: .5, vel: .5}, on: .5},
      {part: 'motif', slot: 'lead', opts: {}, on: .65}],
    fx: {plate: {decay: .6, damping: .55}, hall: {rt60: 4, damp: 2500}, delay: {beats: .75, feedback: .45, lp: 2200, hp: 350, pingpong: 1, wow: .003, flutter: .0003}, duck: {bass: 6, ret: 2}, master: {tiltHigh: -2}},
    moves: {tapestop: 1, swell: .8, wash: .8, throw: .8, gap: .4, riser: .3, impact: .2, roll: 0, gate: 0, hpbuild: .3}, macros: {y: .45, chaos: .15}};

  W.BLOOM = {name: 'BLOOM', desc: 'one character voice, tape echo blooming', ref: 'Rival Consoles', v2: true, aeqFrom: .15,
    tempo: [82, 108], swing: [0, .04], modes: {aeolian: 2, dorian: 2, phrygian: .5}, families: {three: 2, tetra: 1.5, cinematic: 1}, colour: [.3, .6], spread: [.5, .8], form: ['swell'],
    tracks: {
      lead:  {patch: ['cs80_brass', 'pad_warm'], voices: 12, db: -3, hp: 150, delay: .4, hall: .3},
      cello: {patch: ['cello'], voices: 10, db: -8, hp: 120, hall: .4},
      bass:  {patch: ['bass_round'], bus: 'bass', db: -5},
      kick:  drumBus({patch: ['kick_lofi'], db: -7}),
      snare: drumBus({patch: ['snare_brush'], db: -10, hall: .4}),
      shaker:drumBus({patch: ['shaker'], db: -18, pan: -.25}),
      ride:  drumBus({patch: ['hat_ride'], db: -19, pan: .2})},
    parts: [
      {part: 'pad', slot: 'lead', opts: {mode: 'swell', vel: .6, bend: .6}, on: 0, core: true},
      {part: 'pad', slot: 'cello', opts: {mode: 'hold', vel: .45, oct: -1}, on: .25},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .35},
      {part: 'kick', slot: 'kick', opts: {mode: 'broken'}, on: .45, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {mode: 'halftime', vel: .6}, on: .5, drum: true},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .55, drum: true},
      {part: 'hats', slot: 'ride', opts: {open: 0}, on: .75, drum: true}],
    fx: {plate: {decay: .6, damping: .5}, hall: {rt60: 5, damp: 3000}, delay: {beats: .75, feedback: .6, lp: 2400, hp: 300, pingpong: 1, wow: .0015}, duck: {bass: 6, ret: 2}, master: {tiltHigh: 0}},
    moves: {throw: 1.6, wash: 1, swell: 1, impact: .5, riser: .5, tapestop: .3, roll: 0, gap: .3}, macros: {chaos: .12, motion: .45}};

  W.ACID = {name: 'ACID', desc: 'a 303 line that never sits still', ref: 'acid house / Hardfloor', v2: true,
    tempo: [124, 132], swing: [0, .04], modes: {phrygian: 2, aeolian: 2, dorian: 1}, families: {drone: 2, oscillate: 1.5, swing2: 1}, colour: [.15, .4], spread: [.5, .8], form: ['techno', 'club'],
    tracks: {
      acid:  {patch: ['acid303', 'acid_sq'], db: -3, hp: 60, delay: .3, ins: [{type: 'folder', drive: 1.6, mix: .25, lp: 7000}]},
      kick:  drumBus({patch: ['kick_909'], db: -5}),
      clap:  drumBus({patch: ['snare_clap'], db: -12, plate: .2}),
      hat:   drumBus({patch: ['hat_tight', 'hat_808'], db: -15, hp: 4000}),
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -7},
      pad:   {patch: ['pad_dark'], voices: 12, db: -12, hp: 200, hall: .4},
      click: drumBus({patch: ['perc_click'], db: -16, hp: 900})},
    parts: [
      {part: 'acid', slot: 'acid', opts: {}, on: 0, core: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .25, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .5}, on: .35, drum: true},
      {part: 'clicks', slot: 'click', opts: {count: 3}, on: .45, drum: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub', vel: .7}, on: .5},
      {part: 'backbeat', slot: 'clap', opts: {}, on: .6, drum: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .4}, on: .7}],
    fx: {plate: {decay: .5, damping: .5}, hall: {rt60: 4, damp: 3000}, delay: {beats: .75, feedback: .45, lp: 2600, hp: 500, pingpong: 1}, duck: {bass: 8, ret: 3}, master: {tiltHigh: -1}},
    moves: {stutter: 1.4, tapestop: .8, hpbuild: 1, gap: 1, riser: .8, impact: .8, roll: .8, climb: .6}, macros: {chaos: .3}};

  W.BREAKS = {name: 'BREAKS', desc: 'euphoric chords over a broken beat', ref: 'Bicep — Glue', v2: true,
    tempo: [126, 132], swing: [0, .03], modes: {aeolian: 2, dorian: 2}, families: {poploop: 1.5, three: 1.5, riff: 1, planing: 1}, colour: [.3, .55], spread: [.5, .85], form: ['techno'],
    tracks: {
      kick:  drumBus({patch: ['kick_909', 'kick_round'], db: -6}),
      snare: drumBus({patch: ['snare_909'], db: -9, plate: .2}),
      hat:   drumBus({patch: ['hat_tight'], db: -15, hp: 4000, pan: .1}),
      stab:  {patch: ['supersaw_stab', 'stab_juno'], voices: 10, db: -5, hp: 200, hall: .35, delay: .2},
      pad:   {patch: ['choir'], voices: 12, db: -8, hp: 160, hall: .5},
      bass:  {patch: ['bass_sub', 'reese'], bus: 'bass', db: -5},
      vox:   {patch: ['vox_chop'], voices: 8, db: -8, hp: 300, delay: .3, hall: .4},
      arp:   {patch: ['arp_pulse'], voices: 10, db: -7, hp: 250, delay: .3}},
    parts: [
      {part: 'pad', slot: 'pad', opts: {mode: 'swell', vel: .55}, on: 0, core: true},
      {part: 'arp', slot: 'arp', opts: {lanes: 1, density: .7}, on: .25},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .3},
      {part: 'breaks', slot: 'kick', opts: {}, on: .35, drum: true},
      {part: 'chops', slot: 'vox', opts: {}, on: .45},
      {part: 'stab', slot: 'stab', opts: {hits: 12}, on: .55}],
    fx: {plate: {decay: .55, damping: .45}, hall: {rt60: 5, damp: 3500}, delay: {beats: .75, feedback: .4, lp: 3000, hp: 400, pingpong: 1}, duck: {bass: 9, ret: 3}, master: {tiltHigh: -1.5}},
    moves: {riser: 1.2, impact: 1.2, roll: 1, gap: 1, hpbuild: 1, swell: 1, stutter: .8}, macros: {chaos: .2}};

  W.COSMIC = {name: 'COSMIC', desc: 'singing brass, phased strings, wind', ref: 'Jarre / Vangelis', v2: true,
    tempo: [88, 100], swing: [0, .03], modes: {dorian: 2, lydian: 2, aeolian: 1}, families: {cinematic: 2, three: 1.5, tetra: 1}, colour: [.35, .6], spread: [.55, .85], form: ['swell'],
    tracks: {
      pad:   {patch: ['mellotron', 'pad_string'], voices: 14, db: -3, hp: 140, hall: .5, ins: [{type: 'phaser', rate: .1, mix: .35}]},
      brass: {patch: ['cs80_brass'], voices: 10, db: -5, hp: 180, hall: .4},
      bass:  {patch: ['bass_round'], bus: 'bass', db: -6},
      kick:  drumBus({patch: ['kick_soft'], db: -10}),
      hat:   drumBus({patch: ['hat_tight'], db: -19}),
      snare: drumBus({patch: ['snare_soft'], db: -14}),
      arp:   {patch: ['arp_pulse'], voices: 10, db: -8, hp: 250, delay: .3},
      tex:   {patch: ['tex_wind'], db: -22, hall: .3}},
    parts: [
      {part: 'texture', slot: 'tex', opts: {kind: 'wind', level: .45, follow: 'inverse'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .55}, on: 0, core: true},
      {part: 'arp', slot: 'arp', opts: {lanes: 1, density: .6}, on: .25},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub'}, on: .3},
      {part: 'kick', slot: 'kick', opts: {mode: 'broken'}, on: .45, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .1}, on: .5, drum: true},
      {part: 'backbeat', slot: 'snare', opts: {vel: .5}, on: .5, drum: true},
      {part: 'motif', slot: 'brass', opts: {lo: 60, hi: 84}, on: .6}],
    fx: {plate: {decay: .7, damping: .4}, hall: {rt60: 6, damp: 3500}, delay: {beats: .75, feedback: .4, lp: 3000, hp: 300, pingpong: 1}, duck: {bass: 5, ret: 2}, master: {tiltHigh: .3}},
    moves: {riser: 1, swell: 1, keylift: .7, wash: 1, impact: .6}, macros: {chaos: .08, space: .65}};

  W.SAW = {name: 'SAW', desc: 'naive melody, flat-tuned pad, 808 bass', ref: 'Aphex Twin — SAW 85–92', v2: true, aeqFrom: .15,
    tempo: [100, 122], swing: [0, .05], modes: {aeolian: 2, dorian: 1.5, phrygian: 1}, families: {oscillate: 2, swing2: 1.5, flip: 1}, colour: [.2, .5], spread: [.5, .8], form: ['swell'],
    tracks: {
      pad:   {patch: ['fm_strings'], voices: 12, db: -3, hp: 120, hall: .5},
      boom:  {patch: ['boom808'], bus: 'bass', db: -5},
      snare: drumBus({patch: ['snare_rim', 'snare_clap'], db: -11, hall: .4}),
      hat:   drumBus({patch: ['hat_808'], db: -15, hp: 3000}),
      lead:  {patch: ['sq_lead'], voices: 8, db: -6, hp: 250, hall: .3},
      stab:  {patch: ['stab_soft'], voices: 12, db: -9, hp: 200, delay: .3},
      tex:   {patch: ['tex_hiss'], db: -24}},
    parts: [
      {part: 'texture', slot: 'tex', opts: {kind: 'hiss', level: .4, follow: 'constant'}, on: 0, core: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .55}, on: 0, core: true},
      {part: 'boom', slot: 'boom', opts: {}, on: .3},
      {part: 'backbeat', slot: 'snare', opts: {mode: 'broken'}, on: .4, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .45}, on: .4, drum: true},
      {part: 'motif', slot: 'lead', opts: {lo: 64, hi: 86}, on: .55},
      {part: 'stab', slot: 'stab', opts: {hits: 8}, on: .7}],
    fx: {plate: {decay: .7, damping: .6}, hall: {rt60: 3, damp: 2200}, delay: {beats: .5, feedback: .3, lp: 2200, hp: 400, pingpong: 1}, duck: {bass: 0, ret: 2}, master: {tiltHigh: -1.5}},
    moves: {swell: .8, wash: .8, tapestop: .5, riser: .4, impact: .4}, macros: {y: .35, space: .55}};

  W.FOG = {name: 'CHORD FOG', desc: 'one dub chord, endless echoes, weather', ref: 'Basic Channel / dub techno', v2: true,
    tempo: [116, 124], swing: [0, .04], modes: {aeolian: 2, dorian: 2}, families: {fog: 3, drone: 1}, colour: [.4, .6], spread: [.5, .7], form: ['ambient', 'club'],
    sends: {reso: {feedback: .975, damp: .45, gain: .28}},
    tracks: {
      stab:  {patch: ['dub_stab'], voices: 16, db: -3, hp: 100, lp: 4500, delay: .9, plate: .25, ins: [{type: 'phaser', rate: .15, mix: .3}]},
      kick:  drumBus({patch: ['kick_soft', 'kick_round'], db: -7, hall: .35}),
      shaker:drumBus({patch: ['shaker'], db: -18, pan: .3}),
      hat:   drumBus({patch: ['hat_dark'], db: -17, hp: 3000, pan: -.2}),
      bass:  {patch: ['bass_sub'], bus: 'bass', db: -6},
      tex:   {patch: ['tex_crackle'], db: -20, reso: .7},
      rain:  {patch: ['tex_rain'], db: -28, reso: .4}},
    parts: [
      {part: 'texture', slot: 'tex', opts: {kind: 'crackle', level: .5, follow: 'constant'}, on: 0, core: true},
      {part: 'dubstab', slot: 'stab', opts: {}, on: 0, core: true},
      {part: 'kick', slot: 'kick', opts: {mode: 'four', vel: .85}, on: .3, drum: true},
      {part: 'bass', slot: 'bass', opts: {mode: 'sub', vel: .75}, on: .35},
      {part: 'shaker', slot: 'shaker', opts: {}, on: .45, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .3}, on: .55, drum: true},
      {part: 'texture', slot: 'rain', opts: {kind: 'rain', level: .3, follow: 'inverse'}, on: .6}],
    fx: {plate: {decay: .5, damping: .55}, hall: {rt60: 3, damp: 2000}, delay: {beats: .75, feedback: .72, lp: 2200, hp: 450, pingpong: 1, wow: .0012}, duck: {bass: 7, ret: 1}, master: {tiltHigh: -1}},
    moves: {throw: 2, wash: 1.2, swell: .8, gap: .2, impact: 0, subdrop: 0, roll: 0, stutter: 0, tapestop: 0, gate: 0, riser: .2, hpbuild: .6, climb: .3}, macros: {space: .65, chaos: .1}};

  W.PERPETUAL = {name: 'PERPETUAL', desc: 'prime loops, wandering sound design, never the same twice', ref: 'Perpetual Motion', v2: true,
    tempo: [116, 119], swing: [0, .02], modes: {ionian: 2, mixolydian: 1.5, lydian: 1}, families: {perpetual: 3, sus: 1}, colour: [.2, .45], spread: [.5, .8], form: ['crescendo', 'swell'],
    sends: {rev: {beats: .75, feedback: .35, gain: .55}},
    tracks: {
      seq:   {patch: ['arp_saw', 'pluck_soft'], voices: 14, db: -4, hp: 200, delay: .3, rev: .2},
      plonk: drumBus({patch: ['perc_plonk', 'perc_wood'], db: -12, hp: 300, delay: .2}),
      pad:   {patch: ['pad_warm', 'supersaw'], voices: 10, db: -7, hp: 180, hall: .35, ins: [{type: 'rotary', fast: false, mix: .45}]},
      bass:  {patch: ['bass_sub', 'bass_round'], bus: 'bass', db: -4},
      kick:  drumBus({patch: ['kick_909'], db: -5}),
      hat:   drumBus({patch: ['hat_808', 'hat_tight'], db: -15, hp: 3500}),
      click: drumBus({patch: ['perc_click'], db: -15, hp: 900})},
    parts: [
      {part: 'lanes', slot: 'seq', opts: {count: 3, primes: [7, 11, 13]}, on: 0, core: true},
      {part: 'clicks', slot: 'plonk', opts: {count: 3, primes: [5, 7, 11]}, on: .2, drum: true},
      {part: 'pad', slot: 'pad', opts: {mode: 'hold', vel: .5}, on: .25},
      {part: 'bass', slot: 'bass', opts: {mode: 'pulse'}, on: .35},
      {part: 'kick', slot: 'kick', opts: {mode: 'four'}, on: .45, drum: true},
      {part: 'clicks', slot: 'click', opts: {count: 4}, on: .5, drum: true},
      {part: 'hats', slot: 'hat', opts: {open: .4}, on: .6, drum: true}],
    fx: {plate: {decay: .55, damping: .4}, hall: {rt60: 4.5, damp: 3500}, delay: {beats: .75, feedback: .45, lp: 3200, hp: 400, pingpong: 1}, duck: {bass: 9, ret: 3}, master: {tiltHigh: -1.5}},
    moves: {hpbuild: 1.2, climb: 1, throw: 1, stutter: .8, riser: .8, impact: .8}, macros: {chaos: .25, motion: .55}};

  // every world (v1 and v2) gets a transition-FX track; v1 genomes keep their exact random draws because it is added last
  for (const k in W) if (!W[k].tracks.fx) W[k].tracks.fx = {patch: ['fx'], db: -9, hp: 40, hall: .3, plate: .1};
  A.WORLD_LIST = Object.keys(W);
  A.WORLDS_V1 = ['EMERGENCE', 'PRIME', 'REPETITION', 'DRIFT', 'RETRO', 'CRESCENDO', 'FELT', 'INTENSE'];
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_WORLDS2;
