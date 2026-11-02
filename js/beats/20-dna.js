/* ganYEET BARS — the DNA. Each artist is a source of genes for one role of a beat: groove, kit, pocket, bass, harmony, main
   instrument, hook, spice, dust. A beat is a crossover: every role is drawn from the mix, so the drums can be Cole's while the 808 is
   Stan's and the keys are Smino's. Averaging would give mush; crossing keeps each idea whole. Basis and limits: research/10-rap.md.
   Numbers for pockets and tempos are production judgement, not measurements of the records. */
'use strict';
function AWZ_B_DNA(A){
  const clamp = A.clamp;
  A.ARTISTS = {
    kendrick: {name: 'Kendrick Lamar', short: 'Kendrick'}, cole: {name: 'J. Cole', short: 'Cole'}, smino: {name: 'Smino', short: 'Smino'}, seige: {name: 'The Seige', short: 'Seige'},
    stan: {name: 'MC Stan', short: 'Stan'}, vijay: {name: 'Vijay DK', short: 'Vijay DK'}, kai: {name: 'whysoKai', short: 'whysoKai'}};
  A.ARTIST_KEYS = Object.keys(A.ARTISTS);
  A.ROLES = ['groove', 'kit', 'pocket', 'bass', 'harmony', 'main', 'hook', 'spice', 'dust'];
  A.ROLE_NAME = {groove: 'Drum pattern', kit: 'Drum sounds', pocket: 'Pocket', bass: 'Bass', harmony: 'Chords', main: 'Main sound', hook: 'Hook sound', spice: 'Spice', dust: 'Dust'};
  // genes: artist → variants
  A.GENES = {
    groove: {kendrick: ['bounce', 'jazz', 'hardmin'], cole: ['boombap'], smino: ['neo'], seige: ['anthem'], stan: ['trap'], vijay: ['drill'], kai: ['sparse']},
    kit: {kendrick: ['west', 'live'], cole: ['dusty'], smino: ['found'], seige: ['big'], stan: ['trap'], vijay: ['drill'], kai: ['soft']},
    pocket: {kendrick: ['kendrick'], cole: ['cole'], smino: ['smino'], seige: ['seige'], stan: ['stan'], vijay: ['vijay'], kai: ['kai']},
    bass: {kendrick: ['walk', 'hard808'], cole: ['sub'], smino: ['neo'], seige: ['stomp'], stan: ['808'], vijay: ['drill808'], kai: ['deep']},
    harmony: {kendrick: ['kendrick'], cole: ['cole'], smino: ['smino'], seige: ['seige'], stan: ['stan'], vijay: ['vijay'], kai: ['kai']},
    main: {kendrick: ['pianoK', 'chopJazz'], cole: ['chopSoul', 'chopGospel'], smino: ['rhodes'], seige: ['anthem'], stan: ['pluck'], vijay: ['chopBand'], kai: ['felt']},
    hook: {kendrick: ['sax'], cole: ['strings'], smino: ['vchop'], seige: ['saw'], stan: ['flute'], vijay: ['horn'], kai: ['feltTop']},
    spice: {kendrick: ['snap'], cole: ['stutter'], smino: ['found'], seige: ['primal'], stan: ['ratchet'], vijay: ['dhol'], kai: ['air']},
    dust: {kendrick: ['hiss'], cole: ['crackle'], smino: ['crackle'], seige: ['none'], stan: ['none'], vijay: ['none'], kai: ['rain']}};
  A.GENE_NAME = {bounce: 'West Coast bounce', jazz: 'live jazz kit', hardmin: 'hard and minimal', boombap: 'boom bap', neo: 'stuttering neo-soul', anthem: 'stadium stomp', trap: 'trap with hat rolls', drill: 'drill', sparse: 'sparse, room for words',
    west: 'tight claps and snaps', live: 'played kit', dusty: '12-bit dusty kit', found: 'objects as drums', big: 'huge, primal', soft: 'soft and close',
    kendrick: 'loose but locked', cole: 'late snare, swung hats', smino: 'drunk and swung', seige: 'dead straight', stan: 'quantised', vijay: 'tight, pushed snare', kai: 'behind the beat',
    walk: 'funk bass line', hard808: 'short dry 808', sub: 'short clean sub', stomp: 'distorted stomp', 808: 'long gliding 808', drill808: 'sliding drill 808', deep: 'one long low note',
    pianoK: 'dissonant piano riff', chopJazz: 'chopped jazz record', chopSoul: 'chopped soul record', chopGospel: 'chopped gospel record', rhodes: 'Rhodes on the off-beats', pluck: 'sad plucked loop', chopBand: 'chopped procession band', felt: 'felt piano',
    sax: 'tenor sax', strings: 'high strings', vchop: 'vocal chops', saw: 'big saw riff', flute: 'bansuri', horn: 'procession horn', feltTop: 'high felt notes',
    snap: 'finger snaps', stutter: 'record stutters', primal: 'floor toms', ratchet: 'hat and tom ratchets', dhol: 'dhol and tasha', air: 'empty air', hiss: 'tape hiss', crackle: 'vinyl crackle', none: 'clean', rain: 'rain in the room'};

  A.HARM_NAME = {kendrick: 'dark jazz loop', cole: 'soul sevenths and ninths', smino: 'neo-soul movement', seige: 'big minor anthem', stan: 'sad minor loop', vijay: 'tense half-step', kai: 'quiet and inward'};
  A.POCKET_NAME = {kendrick: 'loose but locked', cole: 'late snare, swung hats', smino: 'drunk and swung', seige: 'dead straight', stan: 'quantised', vijay: 'tight, pushed snare', kai: 'behind the beat'};
  A.GROOVES = {
    boombap: {tempo: [84, 96], kicks: [[0, 7, 10], [0, 10, 11], [0, 6, 10], [0, 3, 10], [0, 7, 9]], snare: [4, 12], ghost: [7, 15, 9, 1], hat: 'eight', open: [14], fill: 'drag'},
    bounce: {tempo: [90, 104], kicks: [[0, 3, 6, 10], [0, 6, 8, 11], [0, 3, 8, 10, 14]], snare: [4, 12], ghost: [], hat: 'eight', open: [6], fill: 'kickrun'},
    jazz: {tempo: [78, 96], kicks: [[0, 10], [0, 7], [0, 5, 10]], snare: [4, 12], ghost: [3, 6, 9, 11, 14], hat: 'ride', open: [], fill: 'drag'},
    hardmin: {tempo: [72, 88], kicks: [[0, 8], [0, 11], [0, 3, 8]], snare: [4, 12], ghost: [], hat: 'sixteen', open: [], fill: 'cut'},
    neo: {tempo: [78, 94], kicks: [[0, 3, 5, 10, 13], [0, 2, 6, 11, 14], [0, 3, 7, 10, 11], [0, 5, 6, 11, 14]], snare: [4, 12], ghost: [7, 15], hat: 'eight', open: [10], fill: 'stutter'},
    anthem: {tempo: [72, 88], kicks: [[0, 8], [0, 3, 8, 11], [0, 6, 10]], snare: [4, 12], ghost: [], hat: 'eight', open: [6, 14], fill: 'tom'},
    trap: {tempo: [66, 80], kicks: [[0, 6, 10], [0, 3, 10, 11], [0, 7, 10, 13], [0, 3, 7, 11]], snare: [4, 12], ghost: [], hat: 'roll', open: [], fill: 'roll'},
    drill: {tempo: [70, 73], kicks: [[0, 5, 10], [0, 3, 9, 14], [0, 7, 10], [0, 5, 8, 13]], snare: [6, 12], ghost: [15], hat: 'triplet', open: [], fill: 'roll'},
    sparse: {tempo: [70, 86], kicks: [[0, 10], [0, 7], [0, 8, 11]], snare: [8], ghost: [], hat: 'off', open: [], fill: 'none'}};

  A.KITS = {
    dusty: {kick: 'kick_dust', snare: 'snare_crack', clap: 'snare_shot', hat: 'hat_dust', crush: {bits: 12, rate: 26000, lp: 11000, mix: .85}, room: .12, kickDb: -6, snareDb: -7, clapDb: -12, hatDb: -4},
    west: {kick: 'kick_tight', snare: 'clap_tight', clap: 'clap_snap', hat: 'hat_dust', crush: {bits: 14, rate: 32000, lp: 13000, mix: .4}, room: .1, kickDb: -6, snareDb: -7, clapDb: -12, hatDb: -4},
    live: {kick: 'kick_live', snare: 'snare_live', clap: null, hat: 'hat_jazz', room: .24, kickDb: -6, snareDb: -7, clapDb: 0, hatDb: -6},
    found: {kick: 'kick_box', snare: 'snare_shot', clap: 'clap_snap', hat: 'found_kit', room: .2, kickDb: -5, snareDb: -8, clapDb: -11, hatDb: -5},
    big: {kick: 'kick_big', snare: 'snare_crack', clap: 'clap_big', hat: 'hat_crisp', room: .34, kickDb: -6, snareDb: -7, clapDb: -8, hatDb: -4},
    trap: {kick: 'kick_trap', snare: 'snare_trap', clap: 'clap_tight', hat: 'hat_crisp', room: .06, kickDb: -7, snareDb: -7, clapDb: -10, hatDb: -4},
    drill: {kick: 'kick_trap', snare: 'snare_shot', clap: 'clap_tight', hat: 'hat_crisp', room: .08, kickDb: -7, snareDb: -7, clapDb: -11, hatDb: -4},
    soft: {kick: 'kick_soft', snare: 'snare_rim', clap: null, hat: 'hat_dark', room: .16, kickDb: -6, snareDb: -11, clapDb: 0, hatDb: -7}};

  // kick/snare/hat/keys in ms relative to the grid, sw = delay of the odd 16ths in steps (58 % swing ≈ .16), loose = random ms
  A.POCKETS = {
    kendrick: {sw: .1, kick: 2, snare: 10, hat: 0, keys: 4, bass: 3, loose: 5}, cole: {sw: .16, kick: 8, snare: 20, hat: 6, keys: 10, bass: 8, loose: 3}, smino: {sw: .3, kick: -8, snare: 26, hat: 10, keys: 14, bass: 2, loose: 7},
    seige: {sw: 0, kick: 0, snare: 0, hat: 0, keys: 0, bass: 0, loose: 1.5}, stan: {sw: 0, kick: 0, snare: 0, hat: 0, keys: 0, bass: 0, loose: 1}, vijay: {sw: .04, kick: 0, snare: -3, hat: 0, keys: 0, bass: 0, loose: 1.5}, kai: {sw: .1, kick: 4, snare: 14, hat: 6, keys: 12, bass: 5, loose: 4}};

  // ---------------------------------------------------------------- harmony: semitones from the tonic + chord quality. Hip-hop needs the sevenths, ninths and dominants the Cooper engine deliberately forbids
  A.QUAL = {m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], M7: [0, 4, 7, 11], M9: [0, 4, 7, 11, 14], six9: [0, 4, 7, 9, 14], d7: [0, 4, 7, 10], d9: [0, 4, 7, 10, 14], d13: [0, 4, 10, 14, 21], d7s9: [0, 4, 7, 10, 15], sus: [0, 5, 7, 10], sus9: [0, 5, 7, 10, 14], dim7: [0, 3, 6, 9], madd9: [0, 3, 7, 14], add9: [0, 4, 7, 14], five: [0, 7, 12], M7s11: [0, 4, 7, 11, 18]};
  A.QNAME = {m: 'm', M: '', m7: 'm7', m9: 'm9', m11: 'm11', M7: 'maj7', M9: 'maj9', six9: '6/9', d7: '7', d9: '9', d13: '13', d7s9: '7♯9', sus: '7sus', sus9: '9sus', dim7: 'dim7', madd9: 'm(add9)', add9: 'add9', five: '5', M7s11: 'maj7♯11'};
  A.PROGS = {
    cole: [{s: 'aeolian', c: [[0, 'm9'], [5, 'm9']]}, {s: 'aeolian', c: [[0, 'm9'], [8, 'M7'], [3, 'M7'], [10, 'd9']]}, {s: 'ionian', c: [[0, 'M9'], [9, 'm9'], [2, 'm9'], [7, 'd13']]}, {s: 'ionian', c: [[5, 'M9'], [4, 'm7'], [2, 'm9'], [7, 'd7s9']]}],
    kendrick: [{s: 'dorian', c: [[0, 'm9'], [5, 'd9']]}, {s: 'phrygian', c: [[0, 'm7'], [8, 'M7'], [1, 'M7']]}, {s: 'harmonic', c: [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'd7']]}, {s: 'dorian', c: [[0, 'm11'], [3, 'M9'], [5, 'd9'], [10, 'd13']]}],
    smino: [{s: 'ionian', c: [[2, 'm11'], [7, 'sus9'], [0, 'M9'], [9, 'm9']]}, {s: 'ionian', c: [[5, 'M9'], [4, 'm9'], [2, 'm11'], [7, 'd13']]}, {s: 'dorian', c: [[0, 'm9'], [5, 'd13']]}, {s: 'lydian', c: [[0, 'M7s11'], [1, 'M9']]}],
    seige: [{s: 'aeolian', c: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']]}, {s: 'harmonic', c: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']]}, {s: 'aeolian', c: [[0, 'five'], [5, 'm'], [8, 'M'], [10, 'M']]}],
    stan: [{s: 'aeolian', c: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']]}, {s: 'harmonic', c: [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']]}, {s: 'aeolian', c: [[0, 'madd9'], [8, 'M7']]}, {s: 'phrygian', c: [[0, 'm'], [1, 'M']]}],
    vijay: [{s: 'phrygian', c: [[0, 'm'], [1, 'M']]}, {s: 'harmonic', c: [[0, 'm'], [8, 'M'], [7, 'M']]}, {s: 'phrygdom', c: [[0, 'M'], [1, 'M'], [10, 'm'], [1, 'M']]}, {s: 'aeolian', c: [[0, 'madd9'], [10, 'M'], [8, 'M7'], [10, 'M']]}],
    kai: [{s: 'aeolian', c: [[0, 'madd9'], [8, 'M7'], [3, 'M'], [7, 'm7']]}, {s: 'aeolian', c: [[0, 'm7'], [5, 'm9']]}, {s: 'aeolian', c: [[8, 'M7'], [10, 'M'], [0, 'm7'], [0, 'm7']]}]};
  const barsFor = n => n === 2 ? [2, 2] : n === 3 ? [2, 1, 1] : n === 4 ? [1, 1, 1, 1] : [4];
  A.makeLoop = function(tonic, prog){ const B = barsFor(prog.c.length); return prog.c.map(([semi, q], i) => { const iv = A.QUAL[q], root = (tonic + semi) % 12; return {semi, q, root, iv, pcs: iv.map(x => (root + x) % 12), bars: B[i], name: A.NOTE[root] + A.QNAME[q], fifth: (root + 7) % 12}; }); };
  // voicings: rootless for jazz keys, close triad for trap keys, open for anthems; each chord is led from the previous one
  A.voiceChord = function(ch, style, prev){ let iv = ch.iv.slice(), lo = 52, hi = 74;
    if (style === 'rootless'){ const noRoot = iv.filter(x => x % 12 !== 0); const no5 = noRoot.filter(x => x % 12 !== 7); iv = no5.length >= 3 ? no5.slice(0, 4) : noRoot.slice(0, 4); lo = 50; hi = 72; }
    else if (style === 'triad'){ iv = iv.filter(x => x < 12).slice(0, 3); if (ch.iv.indexOf(14) >= 0) iv[iv.length - 1] = ch.iv.indexOf(7) >= 0 ? 7 : iv[iv.length - 1]; lo = 55; hi = 74; }
    else if (style === 'open'){ const third = iv.find(x => x === 3 || x === 4 || x === 5); const o = [0, 7, 12]; if (third !== undefined) o.push(third + 12); else o.push(19); iv = o; lo = 46; hi = 76; const base0 = (ch.root - lo % 12 + 120) % 12 + lo; return {notes: iv.map(x => base0 + x), style}; }
    const pcs = iv.map(x => (ch.root + x) % 12); let best = null, bc = 1e9; const center = prev && prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : (lo + hi) / 2;
    for (let rot = 0; rot < pcs.length; rot++){ for (let base = lo; base <= lo + 11; base++){ if (base % 12 !== pcs[rot]) continue; const o = [base]; for (let k = 1; k < pcs.length; k++){ let m = o[k - 1] + 1; while (m % 12 !== pcs[(rot + k) % pcs.length]) m++; o.push(m); } if (o[o.length - 1] > hi + 3) continue;
        let c = Math.abs(o.reduce((a, b) => a + b, 0) / o.length - center); if (prev && prev.length) c += o.reduce((a, m) => a + Math.min(...prev.map(q => Math.abs(q - m))), 0) * .4; if (c < bc){ bc = c; best = o; } } }
    return {notes: best || pcs.map(p => lo + ((p - lo % 12 + 12) % 12)), style}; };

  // ---------------------------------------------------------------- crossover
  const BASS_FIT = {hard: {walk: .3, sub: .5, deep: .7, neo: .5}, soft: {808: .7, drill808: .3, stomp: .55}};
  const HARD = {trap: 1, drill: 1, anthem: 1, hardmin: 1};
  const VOICING = {pianoK: 'triad', chopJazz: 'rootless', chopSoul: 'rootless', chopGospel: 'rootless', rhodes: 'rootless', anthem: 'open', pluck: 'triad', chopBand: 'triad', felt: 'rootless'};
  const CRATE = {chopSoul: {kind: 'soul', semis: 3}, chopGospel: {kind: 'gospel', semis: 4}, chopJazz: {kind: 'jazz', semis: 0}, chopBand: {kind: 'band', semis: 1}};
  A.isChop = main => !!CRATE[main];
  // pick each role for one scene. The weight of an artist falls each time it wins, so a balanced mix stays a mix; a single artist at full stays pure
  function crossScene(sceneKey, seed, blend, locks, rerolls, avoid){ const out = {}; const w = {}; let tot = 0; for (const k of A.ARTIST_KEYS){ w[k] = Math.max(0, blend[k] === undefined ? 1 : blend[k]); tot += w[k]; } if (tot <= 0) A.ARTIST_KEYS.forEach(k => w[k] = 1);
    for (const role of A.ROLES){ const r = A.rng(A.hash(seed, sceneKey, role, rerolls && rerolls[role] || 0)); const L = locks && locks[role]; let artist = L ? L.a : null, variant = L ? L.v : null;
      if (!artist){ const ww = Object.assign({}, w); if (avoid && avoid[role] && Object.values(ww).filter(x => x > 0).length > 1) ww[avoid[role]] *= .08; artist = r.weighted(ww); }
      if (!variant){ let vs = A.GENES[role][artist]; if (role === 'bass' && out.groove){ const fit = BASS_FIT[HARD[out.groove.v] ? 'hard' : 'soft'], o = {}; vs.forEach(v => o[v] = fit[v] === undefined ? 1 : fit[v]); variant = r.weighted(o); } else variant = r.pick(vs); }
      out[role] = {a: artist, v: variant}; w[artist] *= .42; }
    return out; }
  A.beatGenome = function(o){ o = o || {}; const seed = (o.seed >>> 0) || 1, blend = o.blend || {}, g = {world: 'BEAT', seed, blend: Object.assign({}, blend), locks: o.locks || {}, rerolls: o.rerolls || {}, jitter: .6, patches: {}};
    const A0 = crossScene('A', seed, blend, g.locks, g.rerolls), avoid = {}; for (const k of ['groove', 'kit', 'main', 'hook', 'bass']) avoid[k] = A0[k].a;
    const B0 = crossScene('B', seed, blend, o.locksB || {}, g.rerolls, avoid); const r = A.rng(A.hash(seed, 'beat')), GA = A.GROOVES[A0.groove.v];
    g.bpm = o.bpm || Math.round(r.range(GA.tempo[0], GA.tempo[1])); g.tonic = o.tonic === undefined ? r.pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) : o.tonic; g.genes = {A: A0, B: B0};
    const pickProg = (art, key, rr) => { const list = A.PROGS[art], R = A.rng(A.hash(seed, 'prog', key, rr || 0)); return R.int(0, list.length - 1); };
    g.progA = o.progA === undefined ? pickProg(A0.harmony.a, 'A', g.rerolls.harmony) : o.progA; g.progB = o.progB === undefined ? pickProg(B0.harmony.a, 'B', g.rerolls.harmony) : o.progB;
    const P0 = A.PROGS[A0.harmony.a][g.progA]; g.mode = P0.s; g.formName = o.formName || 'song'; g.swingMul = o.swingMul === undefined ? 1 : o.swingMul;
    return g; };
  // the record(s) a genome needs, pressed before the engine loads (they take a moment: the host does it off the audio thread)
  A.recordSpecs = function(g){ const out = {}; for (const key of ['A', 'B']){ const G = g.genes[key], crate = CRATE[G.main.v]; if (!crate) continue; const prog = key === 'A' ? A.PROGS[G.harmony.a][g.progA] : A.PROGS[G.harmony.a][g.progB]; const loop = A.makeLoop(g.tonic, prog); let prev = null;
      const chords = loop.map(ch => { const v = A.voiceChord(ch, VOICING[G.main.v] || 'rootless', prev); prev = v.notes; return {notes: v.notes, bars: ch.bars}; }); out[key] = {kind: crate.kind, semis: crate.semis, seed: A.hash(g.seed, key), bpm: g.bpm, chords}; }
    return out; };
  A.pressRecords = function(g, sr){ const specs = A.recordSpecs(g), out = {}; for (const k in specs) out[k] = A.pressRecord(specs[k], sr); return out; };

  // ---------------------------------------------------------------- the world object the engine expects (tracks + fx), built from a genome
  const DRUMBUS = o => Object.assign({bus: 'drums'}, o);
  const MAIN_TRACK = {
    pianoK: {patch: ['piano_honk'], voices: 14, db: -3, hp: 140, plate: .14, hall: .08, delay: .06, voicing: 'triad'},
    rhodes: {patch: ['ep_tine'], voices: 18, db: 1, hp: 130, chorus: {mode: 1, mix: .35}, plate: .14, delay: .08, ins: 'trem', voicing: 'rootless'},
    anthem: {patch: ['stab_anthem'], voices: 18, db: -2, hp: 160, chorus: {mode: 2, mix: .25}, plate: .16, hall: .14, delay: .08, voicing: 'open'},
    pluck: {patch: ['harp_pluck'], voices: 12, db: -3, hp: 180, plate: .18, delay: .2, voicing: 'triad'},
    felt: {patch: ['felt_soft'], voices: 16, db: -1, hp: 110, plate: .2, hall: .12, voicing: 'rootless'}};
  const HOOK_TRACK = {
    sax: {patch: ['sax_tenor'], db: -7, hp: 180, plate: .22, delay: .16}, strings: {patch: ['strings_hi'], voices: 10, db: -7, hp: 260, plate: .25, hall: .2}, vchop: {patch: ['vox_chop'], voices: 8, db: -6, hp: 280, plate: .18, delay: .28},
    saw: {patch: ['saw_big'], db: -9, hp: 220, chorus: {mode: 3, mix: .4}, plate: .2, hall: .15, delay: .14}, flute: {patch: ['bansuri'], db: -11, hp: 300, plate: .28, delay: .22, hall: .12}, horn: {patch: ['horn_lead'], db: -7, hp: 240, plate: .16, delay: .1}, feltTop: {patch: ['felt_soft'], voices: 8, db: -6, hp: 320, plate: .28, hall: .18, delay: .16}};
  const BASS_TRACK = {walk: 'bass_funk', hard808: 'boom_drill', sub: 'bass_short', neo: 'bass_neo', stomp: 'bass_stomp', 808: 'boom_long', drill808: 'boom_drill', deep: 'boom_soft'};
  const BASS_DB = {walk: -9, hard808: -8, sub: -8, neo: -8, stomp: -10, 808: -7, drill808: -8, deep: -8};
  A.beatWorld = function(g){ const tracks = {}, parts = [], scenes = {}; const seen = {};
    const slotFor = (base, key, patchSig) => { const sig = base + '|' + patchSig; if (seen[sig]) return seen[sig]; const name = tracks[base] ? base + key : base; seen[sig] = name; return name; };
    const addT = (slot, spec, patch) => { if (!tracks[slot]){ tracks[slot] = Object.assign({}, spec, {patch: [patch]}); g.patches[slot] = patch; } return slot; };
    for (const key of ['A', 'B']){ const G = g.genes[key], kit = A.KITS[G.kit.v], crush = kit.crush ? [{type: 'crush', o: kit.crush}] : null, S = {};
      S.kick = addT(slotFor('kick', key, kit.kick), DRUMBUS({db: kit.kickDb, hall: kit.room * .25, plate: kit.room * .25, ins: crush}), kit.kick);
      S.snare = addT(slotFor('snare', key, kit.snare), DRUMBUS({db: kit.snareDb, plate: kit.room, hall: kit.room * .5, ins: crush}), kit.snare);
      if (kit.clap) S.clap = addT(slotFor('clap', key, kit.clap), DRUMBUS({db: kit.clapDb, plate: kit.room * 1.2, pan: .06, ins: crush}), kit.clap);
      S.hat = addT(slotFor('hat', key, kit.hat), DRUMBUS({db: kit.hatDb, hp: kit.hat === 'found_kit' ? 400 : 3000, pan: .1, plate: kit.room * .25, ins: crush}), kit.hat);
      const bp = BASS_TRACK[G.bass.v]; S.bass = addT(slotFor('bass', key, bp + G.bass.v), {bus: 'bass', db: BASS_DB[G.bass.v]}, bp);
      const crate = CRATE[G.main.v]; if (crate){ S.main = addT('main' + key, {db: -3, hp: 170, eq: [[420, -3.5, .8]], plate: .05, hall: .03, delay: .03, record: key, voicing: VOICING[G.main.v]}, 'chop_main'); }
      else { const M = MAIN_TRACK[G.main.v]; S.main = addT(slotFor('main', key, G.main.v), M, M.patch[0]); }
      const H = HOOK_TRACK[G.hook.v]; S.hook = addT(slotFor('hook', key, G.hook.v), H, H.patch[0]);
      const sp = G.spice.v; if (sp === 'found') S.sp1 = addT(slotFor('sp1', key, sp), DRUMBUS({db: -14, hp: 400, plate: .22, delay: .12}), 'found_kit');
      else if (sp === 'snap') S.sp1 = addT(slotFor('sp1', key, sp), DRUMBUS({db: -14, hp: 800, plate: .3, delay: .14}), 'clap_snap');
      else if (sp === 'primal'){ S.sp1 = addT(slotFor('sp1', key, sp), DRUMBUS({db: -7, hp: 45, plate: .24, hall: .22}), 'tom_floor'); }
      else if (sp === 'dhol'){ S.sp1 = addT(slotFor('sp1', key, sp), DRUMBUS({db: -8, hp: 50, plate: .12}), 'dhol_low'); S.sp2 = addT(slotFor('sp2', key, sp), DRUMBUS({db: -12, hp: 180, plate: .12, pan: -.2}), 'dhol_high'); S.sp3 = addT(slotFor('sp3', key, sp), DRUMBUS({db: -17, hp: 500, plate: .08, pan: .25}), 'tasha'); }
      else if (sp === 'ratchet') S.sp1 = addT(slotFor('sp1', key, sp), DRUMBUS({db: -15, hp: 3000, pan: -.15, plate: .08}), 'hat_crisp');
      else if (sp === 'stutter') S.sp1 = addT(slotFor('sp1', key, sp), {db: -10, hp: 400, delay: .24, plate: .12}, 'vox_chop');
      const d = G.dust.v; if (d !== 'none') S.dust = addT(slotFor('dust', key, d), {db: d === 'rain' ? -30 : d === 'hiss' ? -34 : -27, hp: 300, plate: 0}, d === 'rain' ? 'tex_rain' : d === 'hiss' ? 'tex_hiss' : 'tex_crackle');
      scenes[key] = S; }
    tracks.fx = {patch: ['fx'], db: -10, hp: 60, plate: .08, hall: .2}; g.patches.fx = 'fx';
    const GA = g.genes.A, big = GA.kit.v === 'big' || GA.groove.v === 'anthem', hard808 = GA.bass.v === '808' || GA.bass.v === 'drill808' || GA.bass.v === 'hard808' || GA.bass.v === 'deep';
    return {name: 'BEAT', desc: '', ref: '', tracks, scenes, parts, fx: {plate: {decay: big ? .68 : .52, damping: .45, predelay: .014, inHP: 240, outLP: 7500}, hall: {rt60: big ? 3.2 : 2.2, damp: 3800, predelay: .02}, delay: {beats: .75, feedback: .34, lp: 3000, hp: 380, pingpong: 1}, duck: {bass: hard808 ? 3 : 6, ret: 1.5}, master: {tiltHigh: 0}}}; };
  A.scaleOf = function(g, sceneKey){ const G = g.genes[sceneKey || 'A'], P0 = A.PROGS[G.harmony.a][sceneKey === 'B' ? g.progB : g.progA]; return P0.s; };
}
if (typeof module !== 'undefined' && module.exports) module.exports = AWZ_B_DNA;
