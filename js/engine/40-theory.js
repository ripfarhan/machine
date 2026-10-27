/* Maut ki Awaaz — engine module: harmony.
   Chords are built diatonically (scale-degree stacks) so they always sit in the mode; voicings use explicit register slots
   (research/04 §2.3): SUB root · BASS root/5th · LOW-MID 5th/8ve · MID the 3rd or sus tone (colour) · HIGH 9th/upper tone · AIR.
   Progression families (04 §2.5, 01 §3.1): two-chord oscillation, pedal planing, Resynthesis-style pedal loop, descending
   tetrachord, cinematic, recoloured pop loop, riff, drone, neo-Riemannian walk. */
'use strict';
function AWZ_THEORY(A){
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; A.NOTE = NOTE;
  // modes ordered dark → bright (MOOD ladder)
  A.MODES = {phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11]};
  A.MODE_LADDER = ['phrygian', 'aeolian', 'dorian', 'mixolydian', 'ionian', 'lydian'];
  // chord types as diatonic offsets from the root degree (0 = root, 2 = third, 4 = fifth, 1 = second/ninth, 3 = fourth, 6 = seventh, 5 = sixth)
  A.CHORD = {open: [0, 4], sus2: [0, 1, 4], sus4: [0, 3, 4], add9: [0, 2, 4, 1], tri: [0, 2, 4], sev: [0, 2, 4, 6], nine: [0, 2, 4, 6, 1], quartal: [0, 3, 6], six9: [0, 2, 4, 5, 1], no3add9: [0, 4, 1], m11: [0, 2, 4, 6, 3]};

  A.Key = class { constructor(tonic, mode){ this.set(tonic, mode); }
    set(tonic, mode){ this.tonic = ((tonic | 0) % 12 + 12) % 12; this.mode = A.MODES[mode] ? mode : 'aeolian'; this.sc = A.MODES[this.mode]; }
    pc(deg){ const n = this.sc.length, d = ((deg % n) + n) % n; return (this.tonic + this.sc[d]) % 12; }
    // midi of scale degree `deg` (may exceed the octave) above `base` octave (base = midi of tonic octave, e.g. 48 = C3 region)
    midi(deg, base){ const n = this.sc.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n; return base + 12 * o + this.tonic + this.sc[d]; }
    inScale(m){ return this.sc.indexOf(((m - this.tonic) % 12 + 12) % 12) >= 0; }
    // nearest scale tone at or above / below
    snap(m){ if (this.inScale(m)) return m; return this.inScale(m - 1) ? m - 1 : m + 1; }
    scaleNotes(lo, hi){ const o = []; for (let m = lo; m <= hi; m++) if (this.inScale(m)) o.push(m); return o; }
    pentatonic(lo, hi){ // remove the two "half-step" degrees of the mode for clash-free melody
      const bad = new Set(); const sc = this.sc; for (let i = 0; i < 7; i++){ const nx = (sc[(i + 1) % 7] - sc[i] + 12) % 12; if (nx === 1) bad.add((i + 1) % 7); }
      const keep = [0, 1, 2, 3, 4, 5, 6].filter(i => !bad.has(i)).slice(0, 5); const pcs = new Set(keep.map(i => (this.tonic + sc[i]) % 12)); const o = []; for (let m = lo; m <= hi; m++) if (pcs.has(m % 12)) o.push(m); return o; } };

  // a chord: degree + type in a key → pitch classes with roles
  A.makeChord = function(key, deg, type, extra){ let offs = (A.CHORD[type] || A.CHORD.tri).slice(); const rootPc = key.pc(deg), iv = o => (key.pc(deg + o) - rootPc + 12) % 12;
    // a "9th" must be a whole step above the root (no ♭9); a "4th" must be perfect; otherwise swap or drop the colour tone
    if (offs.indexOf(1) >= 0 && iv(1) !== 2){ offs = offs.filter(o => o !== 1); if (offs.indexOf(3) < 0 && iv(3) === 5 && offs.indexOf(2) < 0) offs.push(3); }
    if (offs.indexOf(3) >= 0 && iv(3) !== 5) offs = offs.filter(o => o !== 3);
    if (offs.indexOf(6) >= 0 && iv(6) === 11 && offs.indexOf(0) >= 0 && type !== 'nine' && type !== 'sev') offs = offs.filter(o => o !== 6);
    if (offs.indexOf(4) >= 0 && iv(4) !== 7) offs = offs.filter(o => o !== 4);                      // no diminished fifths
    if (offs.indexOf(2) >= 0 && offs.indexOf(6) >= 0 && iv(2) === 4 && iv(6) === 10) offs = offs.filter(o => o !== 6);   // no dominant 7ths (tritone 3–♭7)
    if (offs.indexOf(5) >= 0 && (iv(5) !== 9 || iv(2) === 3)) offs = offs.filter(o => o !== 5);      // a "6" must be major, and never on a minor chord (6 vs ♭3 = tritone)
    if (offs.indexOf(5) >= 0 && offs.indexOf(1) >= 0 && (iv(5) - iv(1) + 12) % 12 === 6) offs = offs.filter(o => o !== 5);
    let pedal = extra && extra.pedal !== undefined ? extra.pedal : null;
    let pcs = offs.map(o => key.pc(deg + o));
    if (pedal !== null){ const keep = pcs.filter(p => { const d = (p - pedal + 12) % 12; return d !== 6 && d !== 1; }); if (keep.length >= 2) pcs = keep; else pedal = null; }
    if (pcs.length < 2) pcs.push((rootPc + 7) % 12);
    const ch = {deg, type, root: pcs[0], pcs, fifth: offs.indexOf(4) >= 0 && pcs.indexOf(key.pc(deg + 4)) >= 0 ? key.pc(deg + 4) : null,
      third: offs.indexOf(2) >= 0 && pcs.indexOf(key.pc(deg + 2)) >= 0 ? key.pc(deg + 2) : null, colour: [], pedal};
    ch.colour = pcs.filter(p => p !== ch.root && p !== ch.fifth && p !== ch.third);
    ch.name = A.chordName(ch); return ch; };
  A.chordName = function(ch){ const r = NOTE[ch.root]; const iv = ch.pcs.map(p => (p - ch.root + 12) % 12), has = x => iv.indexOf(x) >= 0;
    let q = ''; if (ch.type === 'open') q = '5'; else if (ch.type === 'sus2') q = 'sus2'; else if (ch.type === 'sus4') q = 'sus4'; else if (ch.type === 'quartal') q = '⁴';
    else { if (has(3) && !has(4)) q = 'm'; if (has(10)) q += '7'; else if (has(11)) q += 'maj7'; if (has(2) && !has(10) && !has(11)) q += 'add9'; else if (has(2)) q = q.replace('7', '9'); if (has(6) && ch.type !== 'quartal') q += '♯11'; if (ch.type === 'no3add9') q = '5add9'; }
    return r + q + (ch.pedal !== null && ch.pedal !== ch.root ? '/' + NOTE[ch.pedal] : ''); };

  // ---------------------------------------------------------------- voicing with register slots and voice-leading
  // returns {sub, bass, notes:[...] (upper voices, sorted), top}
  A.voice = function(ch, prev, o){ o = o || {}; const spread = o.spread === undefined ? .6 : o.spread, r = o.rng || Math.random, bassPc = ch.pedal !== null ? ch.pedal : ch.root;
    const near = (pc, lo, hi, target) => { let best = null, bd = 1e9; for (let m = lo; m <= hi; m++) if (m % 12 === pc){ const d = Math.abs(m - target); if (d < bd){ bd = d; best = m; } } return best; };
    const sub = near(bassPc, 28, 40, 34), bass = near(bassPc, 36, 50, 43);
    // candidate upper pcs in role order: fifth, third/sus tones, colours, root doubling
    const roles = []; if (ch.fifth !== null) roles.push(['lowmid', ch.fifth]); else roles.push(['lowmid', ch.root]);
    const mids = ch.pcs.filter(p => p !== ch.root && p !== ch.fifth); const midTone = ch.third !== null ? ch.third : (mids[0] !== undefined ? mids[0] : ch.root);
    roles.push(['mid', midTone]); const cols = ch.pcs.filter(p => p !== ch.root && p !== ch.fifth && p !== midTone);
    cols.forEach(c => roles.push(['high', c])); if (cols.length === 0) roles.push(['high', spread > .5 && ch.fifth !== null ? ch.fifth : ch.root]);
    const ranges = {lowmid: [50, 62], mid: [55 + Math.round(spread * 3), 71], high: [64 + Math.round(spread * 4), 82]};
    const prevNotes = prev ? prev.notes : null; const out = [];
    roles.forEach(([slot, pc], k) => { const [lo, hi] = ranges[slot]; let target = prevNotes && prevNotes[k] !== undefined ? prevNotes[k] : (lo + hi) / 2 + (slot === 'high' ? 3 : 0);
      let m = near(pc, lo, hi, target); if (m === null) m = near(pc, lo - 6, hi + 6, target); if (m !== null) out.push(m); });
    // keep it airy: no two upper notes within 1 semitone unless the higher one is ≥ 67; no 3rd below 52
    out.sort((a, b) => a - b); for (let pass = 0; pass < 3; pass++){ for (let i = 1; i < out.length; i++) if (out[i] - out[i - 1] < 2){ if (out[i] + 12 <= 86) out[i] += 12; else out[i - 1] -= 12; } out.sort((a, b) => a - b); }
    out.sort((a, b) => a - b); for (let i = out.length - 1; i > 0; i--) if (out[i] === out[i - 1]) out.splice(i, 1);
    // optional AIR doubling of the top colour/fifth when spread is high
    if (spread > .8 && out.length){ const t = out[out.length - 1] + 12; if (t <= 88) out.push(t); }
    return {sub, bass, notes: out, top: out[out.length - 1], chord: ch}; };

  // ---------------------------------------------------------------- progression families
  // each returns [{deg, type, bars}] relative to the key; the loop repeats; `pedal` = degree held in the bass (or null)
  const FAM = {
    oscillate: r => { const pairs = [[0, 5], [0, 3], [0, 2], [0, 6], [5, 0]]; const [a, b] = r.pick(pairs); const len = r.pick([[4, 4], [8, 8], [4, 4], [6, 2], [2, 2]]); return {loop: [{deg: a, bars: len[0]}, {deg: b, bars: len[1]}], pedal: null}; },
    pedal: r => { const seqs = [[0, 6, 5, 6], [0, 5, 6, 0], [0, 3, 5, 4], [0, 1, 0, 6], [0, 6, 3, 5]]; const s = r.pick(seqs), b = r.pick([2, 2, 4]); return {loop: s.map(d => ({deg: d, bars: b})), pedal: 0}; },
    resyn: r => { const seqs = [[0, 5, 3, 5], [0, 5, 0, 3], [5, 3, 0, 4]]; return {loop: r.pick(seqs).map(d => ({deg: d, bars: 2})), pedal: r.pick([0, 0, 4])}; },
    tetra: r => ({loop: [{deg: 0, bars: 2}, {deg: 6, bars: 2}, {deg: 5, bars: 2}, {deg: 4, bars: 2, type: 'sus4'}], pedal: null}),
    cinematic: r => ({loop: [{deg: 5, bars: 4}, {deg: 4, bars: 4}, {deg: 0, bars: 4}, {deg: 4, bars: 4}], pedal: null}),
    poploop: r => ({loop: [0, 5, 2, 6].map(d => ({deg: d, bars: 4})), pedal: r.chance(.7) ? 0 : null}),
    riff: r => ({loop: r.pick([[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4]]).map((d, i) => ({deg: d, bars: 2, type: i === 3 && d === 4 ? 'sus4' : undefined})), pedal: null}),
    drone: r => ({loop: [{deg: 0, bars: 16}], pedal: 0}),
    three: r => ({loop: r.pick([[0, 5, 3], [0, 3, 6], [0, 5, 6], [0, 2, 5]]).map((d, i) => ({deg: d, bars: i === 0 ? 4 : 2})), pedal: r.chance(.5) ? 0 : null})};
  A.FAMILIES = Object.keys(FAM);
  // chord colour per degree, biased by a `colour` amount 0..1 (0 = open fifths/sus, 1 = add9/nine/quartal) — never root-position plain sevenths up front
  A.colourType = function(key, deg, colour, r){ const third = (key.pc(deg + 2) - key.pc(deg) + 12) % 12, fifth = (key.pc(deg + 4) - key.pc(deg) + 12) % 12;
    const fourth = (key.pc(deg + 3) - key.pc(deg) + 12) % 12, sixth = (key.pc(deg + 6) - key.pc(deg + 3) + 12) % 12;
    if (fifth !== 7) return fourth === 5 && sixth === 5 ? 'quartal' : 'sus2';   // diminished-ish degree: avoid the tritone triad
    const okSus4 = fourth === 5, okQuart = fourth === 5 && sixth === 5;
    const w = colour < .25 ? {open: 4, sus2: 3, no3add9: 2, sus4: 1} : colour < .5 ? {sus2: 3, add9: 3, no3add9: 2, open: 1.5, tri: 1, sus4: 1} : colour < .75 ? {add9: 4, sus2: 2, nine: 1.5, six9: 1, quartal: 1, no3add9: 1.5} : {nine: 3, add9: 2.5, quartal: 2, six9: 1.5, m11: 1};
    if (!okSus4){ w.sus2 = (w.sus2 || 0) + (w.sus4 || 0); delete w.sus4; }
    if (!okQuart){ w.add9 = (w.add9 || 0) + (w.quartal || 0); delete w.quartal; }
    return r.weighted(w); };
  A.buildLoop = function(key, family, colour, r){ const f = FAM[family] || FAM.oscillate, plan = f(r);
    const chords = plan.loop.map(c => { let ty = c.type || A.colourType(key, c.deg, colour, r); if (ty === 'sus4' && (key.pc(c.deg + 3) - key.pc(c.deg) + 12) % 12 !== 5) ty = 'sus2';
      const ch = A.makeChord(key, c.deg, ty, {pedal: plan.pedal === null ? null : key.pc(plan.pedal)}); ch.bars = c.bars; return ch; });
    return {chords, family, pedal: plan.pedal}; };
  // substitution (borrowed colour) for one chord of the loop: bVI/bVII/iv↔IV via parallel flip of the third
  A.substitute = function(key, ch, r){ const alt = A.makeChord(key, (ch.deg + r.pick([5, 3, 1, 6])) % 7, r.pick(['sus2', 'add9', 'quartal']), {pedal: ch.pedal}); alt.bars = ch.bars; alt.sub = true; return alt; };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_THEORY;
