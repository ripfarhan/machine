/* Glitch Reel Machine — Studio: a generative music engine (Web Audio, everything synthesized, seed-reproducible).
   Parameterised from music/analysis/profile.json: tempo range, pulse types, polymetric cycle lengths, section arc, pump shape, spectral tilt. */
'use strict';
const STUDIO = (() => {
  const MODES = {minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], pentMinor: [0, 3, 5, 7, 10]};
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // chord grammars as scale degrees (0-based) — minor-mode cycles that keep moving without resolving hard
  const PROGS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 2, 6, 3], [5, 6, 0, 0], [0, 5, 3, 6], [0, 0, 5, 2], [3, 0, 6, 5]];
  const DEF = {seed: 7, bpm: 118, tonic: 9, mode: 'minor', bars: 112, pulse: 'four', swing: .57, density: .6, poly: .5, pump: .25, cutoff: .55, drive: .3,
    delay: .3, verb: .35, tex: .4, arpRate: 16, motion: .4, sub: .8, humanize: .5,
    layers: {kick: 1, snare: 1, hat: 1, perc: 1, bass: 1, arp: 1, pad: 1, tex: 1}};
  const P = Object.assign({}, DEF, {layers: Object.assign({}, DEF.layers)});
  let model = null, AC2 = null, live = null;

  // ---------------------------------------------------------------- helpers
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function euclid(k, n, rot){ const out = []; let b = 0; for (let i = 0; i < n; i++){ const v = Math.floor((i + 1) * k / n) - Math.floor(i * k / n); out.push(v ? 1 : 0); } return out.map((_, i) => out[(i - rot + n) % n]); }
  const deg2midi = (deg, scale, tonic, oct) => { const n = scale.length; const o = Math.floor(deg / n), d = ((deg % n) + n) % n; return 36 + tonic + 12 * (oct + o) + scale[d]; };

  // ---------------------------------------------------------------- the song model
  function generate(p){
    const r = mulberry32(p.seed * 2654435761 >>> 0 || 1), scale = MODES[p.mode] || MODES.minor;
    const M = {p: JSON.parse(JSON.stringify(p)), scale, steps: 16};
    // structure: long intro, slow build, peak, breakdown, short build, second peak, outro — in 4-bar multiples
    const B = Math.max(16, Math.round(p.bars / 4) * 4);
    const arc = [['intro', .125], ['build', .125], ['peak', .25], ['break', .125], ['build2', .0625], ['peak2', .1875], ['outro', .125]];
    let acc = 0; M.sections = arc.map(([name, f]) => { const bars = Math.max(4, Math.round(f * B / 4) * 4); const s = {name, start: acc, bars}; acc += bars; return s; });
    M.bars = acc;
    // chords: a cycle from the grammar; motion controls whether chords hold for two bars
    const prog = pick(r, PROGS).map(d => d + (r() < .15 ? 7 : 0));
    M.chordCycle = prog; M.chordHold = p.motion < .55 ? 2 : 1;
    // kick: pulse type sets the grid; ghost notes from density
    const kick = new Array(16).fill(0), kv = new Array(16).fill(1);
    if (p.pulse === 'four'){ [0, 4, 8, 12].forEach(i => kick[i] = 1); if (r() < p.density * .7) kick[r() < .5 ? 10 : 14] = .4; }
    else if (p.pulse === 'eighths'){ for (let i = 0; i < 16; i += 2){ kick[i] = 1; kv[i] = i % 4 === 0 ? 1 : .55; } }
    else { const e = euclid(3 + Math.floor(r() * 3), 16, Math.floor(r() * 16)); e.forEach((v, i) => kick[i] = v); kick[0] = 1; }
    M.kick = kick; M.kickVel = kv;
    // snare / clap: backbeat for steady pulses, euclidean for broken
    const sn = new Array(16).fill(0);
    if (p.pulse === 'broken'){ euclid(3, 16, 4 + Math.floor(r() * 4)).forEach((v, i) => sn[i] = v); } else { sn[4] = 1; sn[12] = 1; if (r() < p.density * .5) sn[15] = .35; }
    M.snare = sn; M.snareKind = r() < .5 ? 'clap' : 'snare';
    // hats: cycle length is the polymeter dial — 16 is straight, 12/20/14/10 drift against the bar
    const hatLens = p.poly < .25 ? [16] : p.poly < .55 ? [16, 12, 12, 20] : p.poly < .8 ? [12, 20, 28, 14] : [28, 20, 44, 14, 10];
    const hl = pick(r, hatLens); const hat = []; const accentCycle = pick(r, [3, 5, 4, 7]);
    for (let i = 0; i < hl; i++) hat.push(i % 2 === 0 ? (i % (accentCycle * 2) === 0 ? 1 : .6) : (r() < p.density * .6 ? .35 : 0));
    M.hat = hat; M.hatOpen = euclid(r() < .5 ? 2 : 3, hl, Math.floor(r() * hl));
    // percussion: two odd-length euclidean lines with their own pitches — the polyrhythm fingerprint
    const pa = pick(r, p.poly < .3 ? [8, 16] : [7, 9, 11, 13, 12, 28]), pb = pick(r, p.poly < .3 ? [8, 12] : [5, 6, 10, 7, 20, 44]);
    M.percA = {len: pa, pat: euclid(2 + Math.floor(r() * 3), pa, Math.floor(r() * pa)), freqs: Array.from({length: pa}, () => 900 + r() * 2400)};
    M.percB = {len: pb, pat: euclid(2 + Math.floor(r() * 2), pb, Math.floor(r() * pb)), freqs: Array.from({length: pb}, () => 300 + r() * 700)};
    // arp: a short degree cycle that phases against the bar when its length is odd
    const al = pick(r, p.poly < .3 ? [4, 8] : [3, 5, 7, 5, 6]); const arp = []; let d = Math.floor(r() * 4);
    for (let i = 0; i < al; i++){ arp.push(d); const mv = r(); d += mv < .4 ? 1 : mv < .65 ? -1 : mv < .8 ? 2 : mv < .9 ? 4 : -3; d = clamp(d, -2, 9); }
    M.arp = arp; M.arpOct = r() < .5 ? 2 : 3; M.arpRest = p.density < .5 ? euclid(Math.round(16 * p.density), 16, 0) : null;
    // bass: follows the chord root
    const bass = new Array(16).fill(0);
    if (p.pulse === 'four'){ bass[0] = 1; bass[8] = 1; if (r() < .5) bass[14] = .45; }
    else if (p.pulse === 'eighths'){ for (let i = 0; i < 16; i += 2) bass[i] = i % 4 === 0 ? 1 : .7; }
    else euclid(5, 16, Math.floor(r() * 16)).forEach((v, i) => bass[i] = v);
    M.bass = bass; M.bassOctUp = euclid(3, 16, Math.floor(r() * 16));
    // texture: a wandering band-pass centre per bar
    M.texWalk = Array.from({length: M.bars}, () => 300 + r() * 2600);
    M.pad = {detune: 6 + r() * 8, lfo: .05 + r() * .08};
    M.humanOff = Array.from({length: 256}, () => (r() - .5) * 2);
    return M;
  }

  // section → which layers sound, and how
  function sectionAt(M, bar){
    let s = M.sections[M.sections.length - 1]; for (const q of M.sections) if (bar >= q.start && bar < q.start + q.bars) s = q;
    const k = (bar - s.start) / s.bars, n = s.name, L = M.p.layers;
    const on = {kick: 0, snare: 0, hat: 0, perc: 0, bass: 0, arp: 0, pad: 0, tex: 0, riser: 0}; let cut = .5, pump = 1, dens = 1;
    if (n === 'intro'){ on.pad = 1; on.tex = 1; on.arp = k > .25 ? .7 : 0; on.perc = k > .6 ? .5 : 0; cut = .3 + k * .15; dens = .5; }
    else if (n === 'build' || n === 'build2'){ on.pad = 1; on.tex = 1; on.arp = 1; on.hat = .7; on.perc = .8; on.kick = k > .5 ? 1 : .5; on.riser = 1; on.bass = k > .5 ? .6 : 0; cut = .45 + k * .4; dens = .7 + k * .3; }
    else if (n === 'peak' || n === 'peak2'){ Object.assign(on, {kick: 1, snare: 1, hat: 1, perc: 1, bass: 1, arp: 1, pad: n === 'peak2' ? 1 : .6, tex: .6}); cut = .85; dens = 1; }
    else if (n === 'break'){ on.pad = 1; on.tex = 1; on.arp = .6; on.hat = .3; on.perc = .4; cut = .4; dens = .5; pump = 0; }
    else { on.pad = 1; on.tex = 1; on.arp = k < .5 ? .6 : 0; on.kick = k < .5 ? 1 : 0; on.hat = k < .5 ? .6 : 0; on.bass = k < .5 ? .7 : 0; cut = .5 - k * .25; dens = .5; }
    for (const q in on) if (L[q] === 0) on[q] = 0;
    return {name: n, k, on, cut: cut * (.6 + M.p.cutoff * .8), pump, dens, s};
  }

  // ---------------------------------------------------------------- audio graph
  function graph(ctx, M){
    const g = {ctx}; const p = M.p;
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; g.noise = noise;
    // reverb IR: exponentially decaying noise, slightly decorrelated per channel
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.8, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++){ const t = i / ctx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.4) * (1 - Math.exp(-t * 60)); } }
    g.master = ctx.createGain(); g.master.gain.value = 1.15;
    g.comp = ctx.createDynamicsCompressor(); g.comp.threshold.value = -16; g.comp.ratio.value = 1.8; g.comp.attack.value = .008; g.comp.release.value = .08; g.comp.knee.value = 12;   // glue, not a pump: the kick must not duck the whole mix
    g.drive = ctx.createWaveShaper(); { const n = 1024, c = new Float32Array(n), k = .4 + p.drive * 4; for (let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } g.drive.curve = c; g.drive.oversample = '2x'; }
    g.hp = ctx.createBiquadFilter(); g.hp.type = 'highpass'; g.hp.frequency.value = 28;
    g.tilt = ctx.createBiquadFilter(); g.tilt.type = 'highshelf'; g.tilt.frequency.value = 5200; g.tilt.gain.value = -4.5;
    g.drums = ctx.createGain(); g.tonal = ctx.createGain(); g.pump = ctx.createGain();
    g.verb = ctx.createConvolver(); g.verb.buffer = ir; g.verbSend = ctx.createGain(); g.verbSend.gain.value = p.verb * .5;
    g.delay = ctx.createDelay(2); g.delay.delayTime.value = 60 / p.bpm * .75; g.dfb = ctx.createGain(); g.dfb.gain.value = .38; g.dlp = ctx.createBiquadFilter(); g.dlp.type = 'lowpass'; g.dlp.frequency.value = 2800; g.delaySend = ctx.createGain(); g.delaySend.gain.value = p.delay * .45;
    g.delaySend.connect(g.delay); g.delay.connect(g.dlp); g.dlp.connect(g.dfb); g.dfb.connect(g.delay); g.dlp.connect(g.pump);
    g.verbSend.connect(g.verb); g.verb.connect(g.master);
    g.tonal.connect(g.pump); g.pump.connect(g.drive); g.drums.connect(g.drive); g.drive.connect(g.hp); g.hp.connect(g.tilt); g.tilt.connect(g.comp); g.comp.connect(g.master); g.master.connect(ctx.destination);
    g.padLP = ctx.createBiquadFilter(); g.padLP.type = 'lowpass'; g.padLP.frequency.value = 900; g.padLP.Q.value = .7; g.padLP.connect(g.tonal); g.padLP.connect(g.verbSend);
    g.lfo = ctx.createOscillator(); g.lfo.frequency.value = M.pad.lfo; g.lfoG = ctx.createGain(); g.lfoG.gain.value = 320; g.lfo.connect(g.lfoG); g.lfoG.connect(g.padLP.frequency); g.lfo.start();
    g.texBP = ctx.createBiquadFilter(); g.texBP.type = 'bandpass'; g.texBP.Q.value = 5; g.texG = ctx.createGain(); g.texG.gain.value = 0; g.texBP.connect(g.texG); g.texG.connect(g.tonal); g.texG.connect(g.verbSend);
    { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; src.connect(lp); lp.connect(g.texBP); src.start(); }
    return g;
  }

  // ---------------------------------------------------------------- voices
  function env(gn, t, a, d, peak, floor){ gn.gain.cancelScheduledValues(t); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(Math.max(floor || .0005, .0001), t + a + d); }
  function kick(g, t, vel, long){
    const ctx = g.ctx, o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(128, t); o.frequency.exponentialRampToValueAtTime(46, t + .045); o.frequency.exponentialRampToValueAtTime(40, t + .3);
    env(gn, t, .0015, long ? .34 : .24, vel * 1.45, .0005); o.connect(gn); gn.connect(g.drums); o.start(t); o.stop(t + .5);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = 48; env(g2, t, .0015, .16, vel * .5); o2.connect(g2); g2.connect(g.drums); o2.start(t); o2.stop(t + .3);
    const c = ctx.createBufferSource(), cg = ctx.createGain(), hp = ctx.createBiquadFilter(); c.buffer = g.noise; hp.type = 'highpass'; hp.frequency.value = 2500; env(cg, t, .0005, .012, vel * .5); c.connect(hp); hp.connect(cg); cg.connect(g.drums); c.start(t); c.stop(t + .03);
  }
  function snare(g, t, vel, kind){
    const ctx = g.ctx;
    if (kind === 'clap'){ for (let i = 0; i < 4; i++){ const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gn = ctx.createGain(); n.buffer = g.noise; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2; const tt = t + i * .009; env(gn, tt, .001, i < 3 ? .018 : .16, vel * (i < 3 ? .55 : .7)); n.connect(bp); bp.connect(gn); gn.connect(g.drums); gn.connect(g.verbSend); n.start(tt); n.stop(tt + .25); } return; }
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), gn = ctx.createGain(); n.buffer = g.noise; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = .7; hp.type = 'highpass'; hp.frequency.value = 500;
    env(gn, t, .001, .19, vel * .8); n.connect(bp); bp.connect(hp); hp.connect(gn); gn.connect(g.drums); gn.connect(g.verbSend); n.start(t); n.stop(t + .3);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + .05); env(og, t, .001, .09, vel * .6); o.connect(og); og.connect(g.drums); o.start(t); o.stop(t + .15);
  }
  function hatBuffer(ctx, open){ const sr = ctx.sampleRate, n = Math.floor(sr * (open ? .32 : .09)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); const R = [2, 3, 4.16, 5.43, 6.79, 8.21].map(k => 40 * k);
    const a = Math.exp(-2 * Math.PI * 5000 / sr); const y = [0, 0, 0, 0], x = [0, 0, 0, 0];
    for (let i = 0; i < n; i++){ const t = i / sr; let v = 0; for (const f of R) v += Math.sign(Math.sin(2 * Math.PI * f * t)); v /= 6;
      for (let k = 0; k < 4; k++){ const o = a * (y[k] + v - x[k]); x[k] = v; y[k] = o; v = o; }      // 4 × one-pole highpass ≈ 24 dB/oct at 6.8 kHz
      d[i] = v * Math.exp(-t * (open ? 10 : 38)) * (1 - Math.exp(-t * 4000)); }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); if (pk > 0) for (let i = 0; i < n; i++) d[i] /= pk;
    return b; }
  let hatSeq = 0;
  function hat(g, t, vel, open){
    const ctx = g.ctx; if (!g.hatC){ g.hatC = hatBuffer(ctx, false); g.hatO = hatBuffer(ctx, true); }
    const src = ctx.createBufferSource(), gn = ctx.createGain(), pan = ctx.createStereoPanner(); src.buffer = open ? g.hatO : g.hatC; gn.gain.value = vel * .16; pan.pan.value = (hatSeq++ % 2 ? .85 : -.85) * (open ? .5 : 1);
    src.connect(gn); gn.connect(pan); pan.connect(g.drums); if (open) gn.connect(g.verbSend); src.start(t);
  }
  function perc(g, t, vel, freq, kind){
    const ctx = g.ctx, o = ctx.createOscillator(), gn = ctx.createGain(), pan = ctx.createStereoPanner(); pan.pan.value = (hash1(freq) - .5) * 1.9;
    if (kind === 'tick'){ o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * .55, t + .03); env(gn, t, .001, .06, vel * .45); }
    else { o.type = 'square'; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 3; o.frequency.value = freq; env(gn, t, .001, .09, vel * .4); o.connect(bp); bp.connect(gn); gn.connect(pan); pan.connect(g.drums); gn.connect(g.delaySend); o.start(t); o.stop(t + .12); return; }
    o.connect(gn); gn.connect(pan); pan.connect(g.drums); gn.connect(g.delaySend); o.start(t); o.stop(t + .1);
  }
  function bass(g, t, midi, dur, vel, subAmt){
    const ctx = g.ctx, s = ctx.createOscillator(), sg = ctx.createGain(); s.type = 'sine'; s.frequency.value = mtof(midi - 12); env(sg, t, .03, dur * .95, vel * 1.0 * subAmt); s.connect(sg); sg.connect(g.tonal); s.start(t); s.stop(t + dur + .05);
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), gn = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(midi); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(420, t); lp.frequency.exponentialRampToValueAtTime(140, t + .18);
    env(gn, t, .004, dur * .8, vel * .4); o.connect(lp); lp.connect(gn); gn.connect(g.tonal); o.start(t); o.stop(t + dur + .05);
  }
  function pluck(g, t, midi, dur, vel, cut, panv){
    const ctx = g.ctx, lp = ctx.createBiquadFilter(), gn = ctx.createGain(), pan = ctx.createStereoPanner(); pan.pan.value = panv; lp.type = 'lowpass'; lp.Q.value = 4;
    const c0 = 500 + cut * 5200; lp.frequency.setValueAtTime(c0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(180, c0 * .14), t + .16);
    env(gn, t, .003, Math.max(.3, dur * 1.5), vel * .2); lp.connect(gn); gn.connect(pan); pan.connect(g.tonal); gn.connect(g.delaySend); gn.connect(g.verbSend);
    [-7, 7].forEach((d, i) => { const o = ctx.createOscillator(); o.type = i ? 'square' : 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + .3); });
  }
  function padChord(g, t, midis, dur, detune){
    const ctx = g.ctx;
    midis.forEach((m, i) => { const gn = ctx.createGain(), pan = ctx.createStereoPanner(); pan.pan.value = (i / (midis.length - 1 || 1) - .5) * 1.9;
      gn.gain.setValueAtTime(.0001, t); gn.gain.linearRampToValueAtTime(.05, t + Math.min(1.4, dur * .4)); gn.gain.setValueAtTime(.05, t + dur - .1); gn.gain.linearRampToValueAtTime(.0001, t + dur + 1.6);
      [-detune, 0, detune].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(gn); o.start(t); o.stop(t + dur + 1.7); });
      gn.connect(pan); pan.connect(g.padLP); });
  }
  function riser(g, t, dur, amt){
    const ctx = g.ctx, n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), gn = ctx.createGain(); n.buffer = g.noise; n.loop = true; bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(.18 * amt, t + dur); gn.gain.linearRampToValueAtTime(.0001, t + dur + .05);
    n.connect(bp); bp.connect(gn); gn.connect(g.tonal); gn.connect(g.verbSend); n.start(t); n.stop(t + dur + .1);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur); og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(.08 * amt, t + dur); og.gain.linearRampToValueAtTime(.0001, t + dur + .05); o.connect(og); og.connect(g.tonal); o.start(t); o.stop(t + dur + .1);
  }
  function impact(g, t){ const ctx = g.ctx, o = ctx.createOscillator(), gn = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2); env(gn, t, .005, 1.3, .9); o.connect(gn); gn.connect(g.drums); o.start(t); o.stop(t + 1.5);
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = g.noise; lp.type = 'lowpass'; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(200, t + .8); env(ng, t, .002, .8, .5); n.connect(lp); lp.connect(ng); ng.connect(g.drums); ng.connect(g.verbSend); n.start(t); n.stop(t + 1); }

  // ---------------------------------------------------------------- the step scheduler (shared by live play and offline render)
  function scheduleStep(g, M, step, t0){
    const p = M.p, stepDur = 60 / p.bpm / 4, bar = Math.floor(step / 16), si = step % 16, sec = sectionAt(M, bar), on = sec.on;
    const hum = p.humanize * .006 * M.humanOff[step % 256], swing = si % 2 === 1 ? (p.swing - .5) * 2 * stepDur * .85 : 0;
    const t = t0 + swing + (si % 4 === 0 ? 0 : hum);
    const chordIdx = Math.floor(bar / M.chordHold) % M.chordCycle.length, root = M.chordCycle[chordIdx];
    const velN = () => .88 + .12 * (M.humanOff[(step * 7) % 256] * .5 + .5);
    if (si === 0 && on.pad > 0 && bar % M.chordHold === 0){ const tri = [root, root + 2, root + 4, root + 6]; padChord(g, t, tri.slice(0, 3 + (p.density > .6 ? 1 : 0)).map(d => deg2midi(d, M.scale, p.tonic, 1)), stepDur * 16 * M.chordHold, M.pad.detune); }
    if (si === 0){ g.texBP.frequency.setTargetAtTime(M.texWalk[bar % M.texWalk.length], t, stepDur * 6); g.texG.gain.setTargetAtTime(p.tex * .07 * on.tex, t, .4); }
    if (si === 0 && on.riser && sec.k === 0){ riser(g, t, stepDur * 16 * sec.s.bars, Math.min(1, p.density + .3)); }
    if (si === 0 && sec.k === 0 && (sec.name === 'peak' || sec.name === 'peak2')) impact(g, t);
    // drums
    const kv = M.kick[si]; if (on.kick > 0 && kv > 0 && (kv >= 1 || M.humanOff[(step * 3) % 256] * .5 + .5 < on.kick * kv * 2)){
      if (on.kick >= 1 || si % 8 === 0){ kick(g, t, M.kickVel[si] * velN(), sec.name !== 'intro'); if (sec.pump > 0){ const d = p.pump * sec.pump * (p.pulse === 'broken' ? .4 : 1); g.pump.gain.cancelScheduledValues(t); g.pump.gain.setValueAtTime(1, t); g.pump.gain.linearRampToValueAtTime(1 - d * .6, t + .012); g.pump.gain.setTargetAtTime(1, t + .012, .04 + .04 * (1 - p.density)); } } }
    const sv = M.snare[si]; if (on.snare > 0 && sv > 0 && (sv >= 1 || M.humanOff[(step * 5) % 256] * .5 + .5 < sv)) snare(g, t, velN(), M.snareKind);
    if (sec.name.startsWith('build') && sec.k > .75 && si % (sec.k > .9 ? 1 : 2) === 0) snare(g, t, .5 + sec.k * .5, 'snare');
    const hi = step % M.hat.length, hv = M.hat[hi]; if (on.hat > 0 && hv > 0 && (hv >= .5 || M.humanOff[(step * 11) % 256] * .5 + .5 < on.hat)) hat(g, t + hum, hv * velN(), M.hatOpen[hi] && on.hat >= 1);
    const ai = step % M.percA.len, bi = step % M.percB.len;
    if (on.perc > 0 && M.percA.pat[ai] && M.humanOff[(step * 13) % 256] * .5 + .5 < on.perc * sec.dens * .85) perc(g, t + hum, velN(), M.percA.freqs[ai], 'tick');
    if (on.perc > 0 && M.percB.pat[bi] && M.humanOff[(step * 17) % 256] * .5 + .5 < on.perc * sec.dens * .8) perc(g, t + hum, velN() * .9, M.percB.freqs[bi], 'blip');
    // tonal
    const bv = M.bass[si]; if (on.bass > 0 && bv > 0 && (bv >= 1 || M.humanOff[(step * 19) % 256] * .5 + .5 < bv * on.bass)){ const m = deg2midi(root, M.scale, p.tonic, 0) + (M.bassOctUp[si] && p.pulse !== 'eighths' ? 12 : 0); bass(g, t, m, stepDur * (p.pulse === 'eighths' ? 1.6 : 6), velN(), p.sub); }
    const arpEvery = 16 / p.arpRate; if (on.arp > 0 && si % arpEvery === 0 && (!M.arpRest || M.arpRest[si])){ const ni = Math.floor(step / arpEvery) % M.arp.length;
      if (M.humanOff[(step * 23) % 256] * .5 + .5 < on.arp * (.36 + sec.dens * .4)){ const m = deg2midi(M.arp[ni] + root, M.scale, p.tonic, M.arpOct); pluck(g, t, m, stepDur * arpEvery * 1.6, velN() * (ni === 0 ? 1 : .8), sec.cut, (ni % 2 ? .85 : -.85)); } }
  }

  // ---------------------------------------------------------------- live playback
  function ensure(){ if (!AC2) AC2 = new (window.AudioContext || window.webkitAudioContext)(); if (AC2.state === 'suspended') AC2.resume(); return AC2; }
  let pausedAt = 0;
  function play(fromSec){ if (!model) model = generate(P); stop(); const ctx = ensure(); const g = graph(ctx, model); const stepDur = 60 / model.p.bpm / 4, total = model.bars * 16;
    const from = fromSec === undefined ? pausedAt : Math.max(0, fromSec); let step = Math.min(total - 1, Math.floor(from / stepDur)); let next = ctx.currentTime + .08; const start = next - step * stepDur;
    // the pad holds across a chord, so when starting mid-bar re-trigger the current chord right away
    if (step % 16 !== 0){ const bar = Math.floor(step / 16), sec = sectionAt(model, bar); if (sec.on.pad > 0){ const ci = Math.floor(bar / model.chordHold) % model.chordCycle.length, root = model.chordCycle[ci]; const tri = [root, root + 2, root + 4].map(d => deg2midi(d, model.scale, model.p.tonic, 1)); padChord(g, next, tri, stepDur * (16 - step % 16), model.pad.detune); } }
    const timer = setInterval(() => { while (next < ctx.currentTime + .15 && step < total){ scheduleStep(g, model, step, next); step++; next += stepDur; } if (step >= total && ctx.currentTime > next + 2) stop(); }, 25);
    live = {g, timer, start, stepDur}; return live; }
  function stop(){ if (!live) return; pausedAt = playhead(); clearInterval(live.timer); try { live.g.master.gain.setTargetAtTime(0, live.g.ctx.currentTime, .05); const g = live.g; setTimeout(() => { try { g.master.disconnect(); g.lfo.stop(); } catch(e){} }, 400); } catch(e){} live = null; }
  const playing = () => !!live;
  const playhead = () => live ? Math.max(0, live.g.ctx.currentTime - live.start) : pausedAt;
  const duration = () => model ? model.bars * 16 * 60 / model.p.bpm / 4 : 0;
  function seek(sec){ const d = duration(); sec = Math.max(0, Math.min(d - .05, sec)); if (live) play(sec); else pausedAt = sec; }
  function rewind(){ pausedAt = 0; }

  // ---------------------------------------------------------------- offline render → WAV
  async function render(progress){ if (!model) model = generate(P); const sr = 44100, stepDur = 60 / model.p.bpm / 4, total = model.bars * 16, len = Math.ceil((total * stepDur + 3) * sr);
    const ctx = new OfflineAudioContext(2, len, sr); const g = graph(ctx, model); let t = .05;
    for (let s = 0; s < total; s++){ scheduleStep(g, model, s, t); t += stepDur; if (progress && s % 256 === 0){ progress(s / total * .3); await new Promise(r => setTimeout(r, 0)); } }
    const buf = await ctx.startRendering(); if (progress) progress(1); return buf; }
  function toWav(buf){ const n = buf.length, ch = buf.numberOfChannels, out = new ArrayBuffer(44 + n * ch * 2), v = new DataView(out);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c)); let o = 44; let peak = 0; for (let c = 0; c < ch; c++) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(chans[c][i])); const norm = peak > .98 ? .98 / peak : 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++){ const s = Math.max(-1, Math.min(1, chans[c][i] * norm)); v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
    return new Blob([out], {type: 'audio/wav'}); }

  function describe(M){ return NOTE[M.p.tonic] + ' ' + M.p.mode + ' · ' + M.p.bpm + ' BPM · ' + M.bars + ' bars (' + fmt0(M.bars * 16 * 60 / M.p.bpm / 4) + ') · ' + M.p.pulse + ' kick · hats ' + M.hat.length + ' · perc ' + M.percA.len + '/' + M.percB.len + ' · arp ' + M.arp.length; }
  function recipe(){ return JSON.stringify({v: 1, app: 'glitch-reel-machine-studio', ...P}); }
  function applyRecipe(o){ if (!o || o.app !== 'glitch-reel-machine-studio') throw new Error('not a studio recipe'); for (const k in DEF) if (k in o) P[k] = k === 'layers' ? Object.assign({}, DEF.layers, o.layers) : o[k]; model = generate(P); return P; }

  return {P, DEF, MODES, NOTE, generate: () => { pausedAt = 0; return (model = generate(P)); }, model: () => model, sectionAt, play, stop, playing, playhead, duration, seek, rewind, render, toWav, describe, recipe, applyRecipe};
})();
