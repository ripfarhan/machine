/* Maut ki Awaaz — app: wiring of host, taste model, controls and the one render loop. */
'use strict';
(function(){
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const host = new AwaazHost(), taste = new AwaazTaste(AWZ);
  const PAL = {EMERGENCE: ['#ff2e88', '#22e5ff'], PRIME: ['#b8ff3c', '#3de8ff'], REPETITION: ['#ff6a2e', '#ffd9b0'], DRIFT: ['#a48cff', '#e8f0ff'],
    RETRO: ['#ffb347', '#ff6fae'], CRESCENDO: ['#ff4f7a', '#ffe066'], FELT: ['#f0dcc0', '#86b4ff'], INTENSE: ['#ff2e88', '#c4ff2e'],
    VOID: ['#8a7dff', '#2ee6c8'], TREEMAP: ['#7dff9b', '#ffe27a'], BERLIN: ['#ff7a3d', '#6fd2ff'], NIGHTBUS: ['#6f8cff', '#c7d0ff'], AIRPORT: ['#f5e6c8', '#9ad7ff'],
    ARPRIDE: ['#ff3d6e', '#41f0ff'], REICH: ['#ffd23f', '#ffffff'], POLYMETER: ['#ff9f43', '#7af5d0'], TAPE: ['#ffc48a', '#9fe3b0'], BLOOM: ['#ff6b8b', '#ffb36b'],
    ACID: ['#d4ff2e', '#ff2ee0'], BREAKS: ['#ff5ecf', '#5effc1'], COSMIC: ['#7aa5ff', '#ffde7a'], SAW: ['#c0b4ff', '#ff8fa3'], FOG: ['#9fc4c8', '#e8d9b5'], PERPETUAL: ['#ffe15e', '#5ec8ff']};
  const MOODW = {phrygian: 'dark · tense', aeolian: 'dark · melancholic', dorian: 'bittersweet', mixolydian: 'warm · open', ionian: 'bright', lydian: 'bright · floating'};
  const MACROS = [
    {key: 'energy', name: 'ENERGY', desc: 'how hard it hits', words: v => v < .2 ? 'whisper' : v < .4 ? 'low' : v < .6 ? 'medium' : v < .8 ? 'high' : 'max'},
    {key: 'mood', name: 'MOOD', desc: 'dark ↔ bright', steps: 6, words: v => AWZ.MODE_LADDER[Math.round(v * 5)]},
    {key: 'space', name: 'SPACE', desc: 'dry ↔ huge', words: v => v < .25 ? 'dry' : v < .5 ? 'room' : v < .75 ? 'hall' : 'cathedral'},
    {key: 'density', name: 'DENSITY', desc: 'sparse ↔ busy', words: v => v < .3 ? 'sparse' : v < .65 ? 'groove' : 'busy'},
    {key: 'chaos', name: 'CHAOS', desc: 'locked ↔ glitch', words: v => v < .2 ? 'locked' : v < .45 ? 'alive' : v < .7 ? 'slipping' : 'glitch'},
    {key: 'motion', name: 'MOTION', desc: 'still ↔ moving', words: v => v < .25 ? 'still' : v < .55 ? 'breathing' : v < .8 ? 'moving' : 'swirling'}];
  const KEYDESC = {energy: 'layers, drums, brightness', mood: 'mode changes at the next chord loop', space: 'reverb size, sends, delay feedback', density: 'more notes and hits per bar', chaos: 'mutations, timing jitter, ratchets, rain', motion: 'filter movement, auto-pan, phase drift'};

  // ---------------------------------------------------------------- state
  const S = {g: null, piece: null, plan: null, info: null, barT0: 0, barSec: 2, playing: false, timed: [], laneKind: [], slots: [], macros: {}, lastMode: '', lastSec: '', pieceT0: 0, loadReason: null, startedAt: 0, rec: false, exporting: false, mode: 'FULL', reel: false, idleT: 0, flashLog: [], pendingNudge: null};
  const F = {tl: new Float32Array(2048), tr: new Float32Array(2048), fd: new Float32Array(4096), spec: new Float32Array(128), sp16: new Float32Array(16), kick: 0, snare: 0, hat: 0, bass: 0, energy: .3, chaos: .2, motion: .4, glitch: 0, fx: 1, motionScale: 1, tearOK: 1, bright: 1,
    hot: '#ff2e88', cyan: '#22e5ff', c1: [1, .18, .53], c2: [.13, .9, 1], warn: '#ffd23f', laneCol: [], peakSm: .5, pkL: 0, pkR: 0, step: -1, beat: -1, beatSec: .5, chordName: '', moodWord: '', loudN: 0, knobLive: {}, secName: '', worldName: '', keyName: '', bpm: 0, calm: false};
  // ---------------------------------------------------------------- components
  const field = new VZ.Field($('#field')), hero = new VZ.Hero($('#heroCv')), lanes = new VZ.Lanes($('#lanes'), rel => { if (S.pos !== null && S.pos !== undefined) seekTo(Math.max(0, Math.floor(S.pos / 4) * 4 + rel)); }), wheel = new VZ.Wheel($('#wheel')), gonio = new VZ.Gonio($('#gonio')), meter = new VZ.Meter($('#meter')), arc = new VZ.Arc($('#arc'), bar => seekTo(bar)), brain = new VZ.Brain($('#brain'));
  const reel = new AwaazReel($('#reelCv'), host), mathV = new AwaazMath($('#math'));
  let mathOn = false; try { mathOn = localStorage.getItem('awaaz.math') === '1'; } catch (e){}
  function setMath(on){ mathOn = on; $('#math').classList.toggle('on', on); $('#mathBtn').classList.toggle('on', on); $('#mathBtn').textContent = on ? '≋ SPECTRUM' : '∑ MATH'; hero.mathOn = on; $('#hero').classList.toggle('mathmode', on); host.send({type: 'math', on}); try { localStorage.setItem('awaaz.math', on ? '1' : '0'); } catch (e){}  }
  const knobs = {}; const mEl = $('#macros');
  for (const d of MACROS){ const el = document.createElement('div'); el.className = 'knob'; el.innerHTML = `<canvas></canvas><input type="range" min="0" max="100" aria-label="${d.name}"><div class="kn">${d.name}</div><div class="kd">${d.desc}</div>`; mEl.appendChild(el);
    knobs[d.key] = new VZ.Knob(el, Object.assign({v: .5}, d), (k, v) => setMacro(k, v)); el.addEventListener('pointerenter', () => { $('#macroHelp').textContent = d.name + ': ' + KEYDESC[d.key]; $('#macroHelp').classList.add('on'); }); el.addEventListener('pointerleave', () => $('#macroHelp').classList.remove('on')); }
  const xy = new VZ.XY($('#xy'), (x, y) => { setMacro('x', x, true); setMacro('y', y, true); });
  let lastMacroMsg = {};
  function setMacro(k, v, quiet){ S.macros[k] = v; const now = performance.now(); if (!lastMacroMsg[k] || now - lastMacroMsg[k] > 4){ host.send({type: 'macro', k, v}); lastMacroMsg[k] = now; } else setTimeout(() => host.send({type: 'macro', k, v: S.macros[k]}), 6);
    if (k === 'mood'){ const m = AWZ.MODE_LADDER[Math.round(v * 5)]; if (m !== S.moodShown){ S.moodShown = m; toast(`MOOD → ${m.toUpperCase()} (${MOODW[m]}) · lands at the next chord loop`); } } }
  // ---------------------------------------------------------------- world chips
  const wEl = $('#worlds'); const auto = document.createElement('button'); auto.textContent = 'AI PICKS'; auto.title = 'let the AI choose the next world'; auto.className = 'pick'; wEl.appendChild(auto);
  auto.addEventListener('click', () => nextPiece('auto'));
  // 24 worlds: the current one as a chip + a WORLDS ▾ grid (v1 originals and v2 additions)
  const curChip = document.createElement('button'); curChip.className = 'cur'; curChip.textContent = '—'; curChip.title = 'current world'; wEl.appendChild(curChip);
  const wBtn = document.createElement('button'); wBtn.id = 'worldsBtn'; wBtn.textContent = `WORLDS (${AWZ.WORLD_LIST.length}) ▾`; wEl.appendChild(wBtn);
  function renderWorldGrid(){ const el = $('#wgrid'); el.innerHTML = ''; const groups = [['ORIGINAL', AWZ.WORLDS_V1 || []], ['NEW', AWZ.WORLD_LIST.filter(w => !(AWZ.WORLDS_V1 || []).includes(w))]];
    for (const [title, list] of groups){ if (!list.length) continue; const h = document.createElement('div'); h.className = 'wh'; h.textContent = title + ' · ' + list.length; el.appendChild(h); const g = document.createElement('div'); g.className = 'wg'; el.appendChild(g);
      for (const w of list){ const W0 = AWZ.WORLDS[w], b = document.createElement('button'); b.dataset.w = w; b.className = 'wi' + (S.g && S.g.world === w ? ' cur' : ''); const pal = PAL[w] || PAL.EMERGENCE;
        b.innerHTML = `<b style="color:${pal[0]}">${W0.name}</b><span>${W0.desc}</span><i>after ${W0.ref}</i>`; b.onclick = () => { $('#wpop').classList.remove('open'); loadWorld(w, 'you picked ' + W0.name); }; g.appendChild(b); } } }
  wBtn.onclick = e => { e.stopPropagation(); renderWorldGrid(); $('#wpop').classList.toggle('open'); }; document.addEventListener('pointerdown', e => { const p = $('#wpop'); if (p && !p.contains(e.target) && e.target !== wBtn) p.classList.remove('open'); });
  const gw = $('#gateWorlds'); let gateWorld = null; const ga = document.createElement('button'); ga.textContent = 'AI PICKS'; ga.className = 'on'; gw.appendChild(ga); ga.onclick = () => { gateWorld = null; $$('#gateWorlds button').forEach(b => b.classList.remove('on')); ga.classList.add('on'); };
  const gsel = document.createElement('select'); // compact: choose via chips row 2
  for (const w of ['EMERGENCE', 'FELT', 'REPETITION', 'DRIFT']){ const b = document.createElement('button'); b.textContent = AWZ.WORLDS[w].name; b.onclick = () => { gateWorld = w; $$('#gateWorlds button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; gw.appendChild(b); }
  $$('#gate [data-m]').forEach(b => b.onclick = () => { $$('#gate [data-m]').forEach(x => x.classList.remove('on')); b.classList.add('on'); setMode(b.dataset.m); });
  // ---------------------------------------------------------------- loading pieces
  // ---------------------------------------------------------------- history: every piece is a genome, so any past piece can be brought back exactly
  const HKEY = 'awaaz.history.v1'; let HIST = []; try { HIST = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e){ HIST = []; }
  if (!HIST.length){ try { (taste.s.recent || []).slice().reverse().forEach(r => { const g = AWZ.makeGenome(r.world, r.seed); ['bpm', 'mode', 'family', 'colour', 'tonic'].forEach(k => { if (r[k] !== undefined) g[k] = r[k]; }); if (r.patches) g.patches = Object.assign({}, g.patches, r.patches); HIST.unshift({genome: g, macros: null, at: 0, liked: false, recovered: true}); }); } catch (e){} }
  function saveHist(){ try { localStorage.setItem(HKEY, JSON.stringify(HIST.slice(0, 40))); } catch (e){} }
  function histAdd(g){ if (HIST[0] && HIST[0].genome.seed === g.seed && HIST[0].genome.world === g.world) return; HIST.unshift({genome: JSON.parse(JSON.stringify(g)), macros: Object.assign({}, S.macros), at: Date.now(), liked: false}); HIST = HIST.slice(0, 40); saveHist(); renderHist(); }
  function histTouch(liked){ if (!HIST[0] || !S.g || HIST[0].genome.seed !== S.g.seed) return; HIST[0].macros = Object.assign({}, S.macros); if (liked) HIST[0].liked = true; saveHist(); renderHist(); }
  function renderHist(){ const el = $('#histList'); if (!el) return; el.innerHTML = ''; if (!HIST.length){ el.innerHTML = '<div class="hi empty">nothing yet</div>'; return; }
    HIST.forEach((h, i) => { const g = h.genome, w = AWZ.WORLDS[g.world], d = document.createElement('button'); d.className = 'hi' + (S.g && S.g.seed === g.seed && S.g.world === g.world ? ' cur' : '');
      const when = h.at ? new Date(h.at).toTimeString().slice(0, 5) : 'earlier'; d.innerHTML = `<b>${h.liked ? '♥ ' : ''}${w ? w.name : g.world}</b><span>${AWZ.NOTE[g.tonic]} ${g.mode} · ${g.bpm} BPM · ${when}${h.recovered ? ' · recovered' : ''}</span>`;
      d.onclick = () => { $('#hist').classList.remove('open'); loadGenome(JSON.parse(JSON.stringify(g)), 'brought back from history', 'pick', h.macros); toast(`bringing back ${w ? w.name : g.world} — same piece, from the start`); }; el.appendChild(d); }); }
  function loadGenome(g, why, kind, macros){ histTouch(false); if (S.g && S.playing){ const sec = host.ctx.currentTime - S.startedAt; if (kind === 'skip') brain.add(taste.skip(S.g, sec, S.plan ? S.plan.total * S.barSec : 300), 'you'); else taste.listened(S.g, sec); }
    S.loadReason = why || ''; host.load(g, macros || undefined); S.expect = g.seed; }
  function loadWorld(w, why){ const g = taste.genomeFor(w); loadGenome(g, why, 'pick'); }
  function nextPiece(mode, kind){ const cur = S.g ? S.g.world : null; const n = taste.next(cur, mode); loadGenome(n.genome, n.why, kind); }
  function queueNext(){ if (!S.g) return; const n = taste.next(S.g.world, 'auto'); S.queued = n; host.send({type: 'queue', genome: n.genome}); }
  // ---------------------------------------------------------------- messages from the engine
  const sr = () => (host.ctx ? host.ctx.sampleRate : 48000);
  const tInsert = e => { const q = S.timed; let i = q.length; while (i > 0 && q[i - 1].t > e.t) i--; q.splice(i, 0, e); };
  host.on(m => { if (m.type === 'error'){ toast('engine error — press NEXT to restart the music', 6000); console.error(m.msg); return; } if (m.type !== 'out') return; const N = m.notes, toCtx = s => m.now + (s - m.et) / m.sr;
    const nowT = host.now(); if (S.timed.length && S.timed[0].t < nowT - 2){ let k = 0; while (k < S.timed.length && S.timed[k].t < nowT - 2) k++; const stale = S.timed.splice(0, k); const lastBar = stale.filter(e => e.k === 'bar').pop(); if (lastBar) onBar(lastBar.x); }   // background tab: drop stale, keep the latest bar
    for (let i = 0; i < N.length; i += 6){ const t = toCtx(N[i]), lane = N[i + 1], pitch = N[i + 2], vel = N[i + 3], dur = N[i + 4] / m.sr; lanes.add(lane, t, pitch, vel, dur); tInsert({t, k: 'n', lane, pitch, vel}); }
    for (const x of m.msgs){ if (x.type === 'bar'){ x.ct = toCtx(x.t0); tInsert({t: x.ct, k: 'bar', x}); } else if (x.type === 'piece'){ x.ct = toCtx(x.t0); S.timed = S.timed.filter(e => e.t < x.ct - .3); lanes.cut(x.ct); onPiece(x); } else if (x.type === 'repeat'){ brain.add('piece finished — playing it again from the start (AT END: REPEAT)', 'ai'); toast('song khatam — wahi gaana phir se shuru (AT END: REPEAT)', 4000); } else if (x.type === 'end'){ brain.add('piece finished — stopped here (AT END: STOP). Press NEXT or pick from HISTORY.', 'ai'); toast('song khatam — ruk gaya (AT END: STOP)', 5000); } else if (x.type === 'math') mathV.feed(x); else if (x.type === 'meters') onMeters(x); else if (x.type === 'voice') onVoice(x); else if (x.type === 'nudge') {} }
  });
  function onPiece(p){ const natural = S.expect !== p.genome.seed; if (natural && S.g){ taste.ended(S.g, S.macros); brain.add(`piece finished — the AI moves on: ${S.queued ? S.queued.why : ''}`, 'ai'); }
    S.expect = null; S.g = p.genome; histAdd(p.genome); S.piece = p; S.startedAt = host.ctx.currentTime; taste.started(p.genome); const w = AWZ.WORLDS[p.genome.world];
    const pal = PAL[p.genome.world] || PAL.EMERGENCE; F.hot = pal[0]; F.cyan = pal[1]; F.c1 = VZ.rgb(pal[0]); F.c2 = VZ.rgb(pal[1]); document.documentElement.style.setProperty('--hot', pal[0]); document.documentElement.style.setProperty('--cyan', pal[1]);
    F.laneCol = p.slots.map((s, i) => mix(pal[0], pal[1], p.slots.length > 1 ? i / (p.slots.length - 1) : 0));
    lanes.setLanes(p.slots); S.slots = p.slots; buildStrips(p.slots);
    const barSec = p.genome.bpm ? 240 / p.genome.bpm : 2; S.barSec = barSec; let acc = 0; const starts = p.sections.map(s => { const v = acc; acc += s.bars * barSec; return v; });
    S.plan = {sections: p.sections.map(s => Object.assign({}, s)), total: p.sections.reduce((a, s) => a + s.bars, 0), t0: p.ct}; arc.setPlan(S.plan); S.pos = null;
    $('#worldName').textContent = w.name + ' · after “' + w.ref + '”'; $('#worldDesc').textContent = w.desc; F.worldName = w.name; F.bpm = p.bpm; F.keyName = p.key + ' ' + p.mode;
    $('#bpm').innerHTML = `<i>BPM</i> ${p.bpm}`; $('#keyTxt').innerHTML = `<i>KEY</i> ${p.key.replace('#', '♯')} ${p.mode}`;
    curChip.textContent = w.name; curChip.style.borderColor = pal[0];
    for (const k in p.macros){ S.macros[k] = p.macros[k]; if (knobs[k]) knobs[k].set(p.macros[k]); } xy.set(p.macros.x, p.macros.y); S.moodShown = AWZ.MODE_LADDER[Math.round(p.macros.mood * 5)];
    brain.add(`NEW PIECE — ${w.name} · ${p.key} ${p.mode} · ${p.bpm} BPM · ${p.sections.length} sections, ${Math.round(acc / 60 * 10) / 10} min`, 'sec');
    brain.add(`chord loop (${p.family}): ${p.loop.map(c => c.name).join(' → ')}`); if (S.loadReason) brain.add('why: ' + S.loadReason, 'ai'); S.loadReason = null;
    brain.add(`sounds: ${p.slots.map(s => s.slot + '=' + s.patch).join(', ')}`); setTimeout(queueNext, 1500); updateLearn(); }
  function mix(a, b, k){ const x = VZ.rgb(a), y = VZ.rgb(b); const c = x.map((v, i) => Math.round((v + (y[i] - v) * k) * 255)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
  function onBar(x){ endWarn(x); S.info = x; S.barT0 = x.ct; S.barSec = x.barN / sr(); S.pos = x.pos; if (x.sections) arc.updateSections(x.sections.map(s => Object.assign({}, s))); F.energy += (x.E - F.energy) * .5;
    const chord = x.chord.replace(/#/g, '♯'); F.chordName = chord; $('#chordNow').textContent = `${chord}  ▸ next ${x.nextChord.replace(/#/g, '♯')}`; wheel.set(x); F.moodWord = MOODW[x.mode] || x.mode;
    if (x.bis === 0 || x.seeked){ $('#secName').textContent = x.section; F.secName = x.section; scrambleTitle(x.section); globalGlitch(); const s = S.plan && S.plan.sections[x.si]; if (x.seeked && s) brain.add(`you jumped to ${x.section.toUpperCase()} · bar ${x.pos + 1}`, 'you');
      if (s) brain.add(`→ ${x.section.toUpperCase()} · ${s.bars} bars · energy ${Math.round(s.E0 * 100)}→${Math.round(s.E1 * 100)}%${s.tag === 'break' ? ' · drums out' : s.tag === 'peak' ? ' · everything opens' : ''}`, 'sec'); }
    if (x.changed && x.changed.length){ const inn = x.changed.filter(c => c[0] === '+').map(c => c.slice(1).toUpperCase()), out = x.changed.filter(c => c[0] === '-').map(c => c.slice(1).toUpperCase());
      brain.add([inn.length ? `${inn.join(', ')} in` : '', out.length ? `${out.join(', ')} out` : ''].filter(Boolean).join(' · ') + ` (energy ${Math.round(x.E * 100)}%)`);
      x.changed.forEach(c => flashStrip(c.slice(1))); }
    if (x.moves && x.moves.length) brain.add('FX: ' + x.moves.join(' · '), 'ai');
    if (S.lastMode && x.mode !== S.lastMode) brain.add(`mood shift → ${x.mode.toUpperCase()} (${MOODW[x.mode]})`, 'ai'); S.lastMode = x.mode;
    if (S.piece && x.chordStart && S.piece.loop.every(c => c.name !== x.chord) && x.mode === S.piece.mode) brain.add(`borrowed colour: ${chord} for one cycle`, 'ai');
    $$('.pan').forEach(p => { p.classList.add('bar-sweep'); }); setTimeout(() => $$('.pan').forEach(p => p.classList.remove('bar-sweep')), 160); }
  function seekTo(bar){ if (!S.g) return; if (S.plan) bar = Math.max(0, Math.min(S.plan.total - 4, Math.round(bar / 4) * 4)); host.send({type: 'seek', bar}); S.pos = bar; S.barT0 = host.now(); const t = host.now(); S.timed = S.timed.filter(e => e.t <= t); lanes.cut(t); arc.cutTrace(bar); toast(`jumping to bar ${bar + 1}`); }
  const END_MODES = ['REPEAT', 'NEXT', 'STOP']; let endMode = 'REPEAT'; try { endMode = localStorage.getItem('awaaz.endMode') || 'REPEAT'; } catch (e){}
  function setEndMode(m){ endMode = m; $('#endMode').textContent = 'AT END: ' + m; $('#endMode').title = m === 'REPEAT' ? 'when the song ends it plays again from the start' : m === 'NEXT' ? 'when the song ends the AI starts a new one' : 'when the song ends it stops'; host.send({type: 'endMode', mode: m.toLowerCase()}); try { localStorage.setItem('awaaz.endMode', m); } catch (e){} }
  function endWarn(x){ const el = $('#endWarn'), left = (x.total || 0) - x.pos; if (left > 0 && left <= 16 && !x.done){ const nxt = endMode === 'REPEAT' ? 'then it plays again' : endMode === 'STOP' ? 'then it stops' : `then a new piece${S.queued ? ' → ' + AWZ.WORLDS[S.queued.genome.world].name : ''}`;
      el.textContent = `SONG ENDS IN ${left} BAR${left === 1 ? '' : 'S'} · ${nxt}`; el.classList.add('on'); if (left === 8 && S.warned !== S.g.seed){ S.warned = S.g.seed; toast(`song 8 bars mein khatam — ${endMode === 'NEXT' ? 'naya gaana aayega (AT END: NEXT)' : endMode === 'REPEAT' ? 'phir se bajega' : 'ruk jaayega'}`, 4000); } }
    else el.classList.remove('on'); }
  function onMeters(x){ S.meters = x; F.loudN = Math.max(0, Math.min(1, (x.lufs + 36) / 28)); }
  function onVoice(x){ const st = S.strips && S.strips[x.slot]; if (!st) return; st.m.classList.toggle('on', x.mute); st.s.classList.toggle('on', x.solo); st.el.querySelector('.sp2').textContent = x.patch; st.f.textContent = x.user === 1 ? 'ON' : x.user === -1 ? 'OFF' : 'AUTO'; st.f.classList.toggle('on', x.user !== 0); }
  // ---------------------------------------------------------------- strips
  function buildStrips(slots){ const el = $('#strips'); el.innerHTML = ''; S.strips = {};
    slots.forEach((s, i) => { const d = document.createElement('div'); d.className = 'strip'; d.innerHTML = `<div><div class="sn">${s.slot.toUpperCase()}</div><div class="sp2">${s.patch}</div></div><canvas></canvas><div class="sb"><button title="mute">M</button><button title="solo">S</button><button title="new sound + new pattern">↻</button><button title="force this part on / off / auto">AUTO</button></div>`; el.appendChild(d);
      const [m, so, rr, f] = d.querySelectorAll('button'); m.onclick = () => host.send({type: 'voice', slot: s.slot, cmd: 'mute'}); so.onclick = () => host.send({type: 'voice', slot: s.slot, cmd: 'solo'});
      rr.onclick = () => { host.send({type: 'voice', slot: s.slot, cmd: 'reroll'}); brain.add(`you rerolled ${s.slot.toUpperCase()} — new sound, new pattern`, 'you'); };
      f.onclick = () => { const st = S.strips[s.slot]; const u = st.user || 0; const nx = u === 0 ? 1 : u === 1 ? -1 : 0; host.send({type: 'voice', slot: s.slot, cmd: nx === 1 ? 'on' : nx === -1 ? 'off' : (u === 1 ? 'on' : 'off')}); st.user = nx; };
      const cv = d.querySelector('canvas'); S.strips[s.slot] = {el: d, cv, c: cv.getContext('2d'), m, s: so, f, i, lvl: 0, user: 0}; }); }
  function flashStrip(slot){ const st = S.strips && S.strips[slot]; if (!st) return; st.el.classList.add('flash'); setTimeout(() => st.el.classList.remove('flash'), 300); setTimeout(() => { st.el.classList.add('flash'); setTimeout(() => st.el.classList.remove('flash'), 150); }, 450); }
  function drawStrips(dt){ if (!S.strips || !S.meters) return; const pk = S.meters.peaks; for (const slot in S.strips){ const st = S.strips[slot], v = pk[st.i] || 0, db = 20 * Math.log10(v + 1e-9), lv = Math.max(0, Math.min(1, (db + 54) / 54)); st.lvl = Math.max(lv, st.lvl - dt * .9);
      st.el.classList.toggle('off', st.lvl < .02); const {w, h, d} = VZ.fit(st.cv, 2), c = st.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const col = F.laneCol[st.i] || F.hot; c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(0, h * (1 - st.lvl), w, h * st.lvl); } }
  // ---------------------------------------------------------------- visual governor / effects
  function globalGlitch(){ const now = performance.now(); S.flashLog = S.flashLog.filter(t => now - t < 1000); if (S.flashLog.length >= 2 || S.mode !== 'FULL') { F.glitch = Math.max(F.glitch, S.mode === 'CALM' ? .3 : 0); return; } S.flashLog.push(now); F.glitch = 1; }
  function scrambleTitle(text){ const el = $('#secName'), G = '▚▞█▓░/\\|', t0 = performance.now(), dur = S.mode === 'STILL' ? 0 : 420; const up = () => { const q = (performance.now() - t0) / dur; if (q >= 1 || !dur){ el.textContent = text; return; } const n = Math.floor(text.length * q); let s = text.slice(0, n); for (let i = n; i < text.length; i++) s += G[(Math.random() * G.length) | 0]; el.textContent = s; requestAnimationFrame(up); }; up(); }
  function setMode(m){ S.mode = m; $('#mode').textContent = m; F.fx = m === 'FULL' ? 1 : m === 'CALM' ? .3 : 0; F.motionScale = m === 'FULL' ? 1 : m === 'CALM' ? .4 : .12; F.tearOK = m === 'FULL' ? 1 : 0; F.calm = m !== 'FULL'; try { localStorage.setItem('awaaz.mode', m); } catch (e){} }
  let tt = 0; function toast(s, ms){ const el = $('#toast'); el.textContent = s; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), ms || 2600); }
  function updateLearn(){ const ex = taste.explain(); const top = ex.worlds.filter(w => w.plays).slice(0, 3); $('#learn').innerHTML = ex.total < 2 ? 'The AI learns what you like: ♥ = more of this, ✕ = skip.' : `<b>learned:</b> ${top.map(w => `${w.name} ${Math.round(w.p * 100)}%`).join(' · ')}${ex.notes.length ? '<br>' + ex.notes.slice(0, 2).join(' · ') : ''}`; }
  // ---------------------------------------------------------------- features (once per frame)
  const NB = 128, bandLo = new Int32Array(NB), bandHi = new Int32Array(NB); let bandsReady = false;
  function features(t, dt){ if (!host.aL) return; host.aL.getFloatTimeDomainData(F.tl); host.aR.getFloatTimeDomainData(F.tr); host.aM.getFloatFrequencyData(F.fd);
    if (!bandsReady){ const binHz = sr() / host.aM.fftSize; for (let i = 0; i < NB; i++){ const f0 = 30 * Math.pow(16000 / 30, i / NB), f1 = 30 * Math.pow(16000 / 30, (i + 1) / NB); bandLo[i] = Math.max(1, Math.floor(f0 / binHz)); bandHi[i] = Math.max(bandLo[i] + 1, Math.ceil(f1 / binHz)); } bandsReady = true; }
    for (let i = 0; i < NB; i++){ let m = -200; for (let b = bandLo[i]; b < bandHi[i]; b++) if (F.fd[b] > m) m = F.fd[b]; const f = 30 * Math.pow(16000 / 30, i / NB), tilt = 3 * Math.log2(f / 1000); F.spec[i] = Math.max(0, Math.min(1, (m + tilt + 92) / 72)); }
    for (let k = 0; k < 16; k++){ let s = 0; for (let j = 0; j < 8; j++) s += F.spec[k * 8 + j]; F.sp16[k] = s / 8; }
    let pk = 0, pl = 0, pr = 0; for (let i = 0; i < 2048; i++){ const a = Math.abs(F.tl[i]), b = Math.abs(F.tr[i]); if (a > pl) pl = a; if (b > pr) pr = b; } pk = Math.max(pl, pr); F.pkL = pl; F.pkR = pr; F.peakSm += (Math.max(.2, pk) - F.peakSm) * (pk > F.peakSm ? .2 : .02);
    F.bass += (F.sp16[1] + F.sp16[2] - F.bass) * .2;
    // timed events (notes, bars) at audible time
    const q = S.timed; while (q.length && q[0].t <= t){ const e = q.shift(); if (e.k === 'bar') onBar(e.x); else { const kind = S.slots[e.lane] ? S.slots[e.lane].kind : '';
        if (e.pitch === -1) F.kick = Math.min(1.2, 1 * e.vel + .2); else if (kind === 'snare') F.snare = Math.max(F.snare, e.vel); else if (kind === 'hat' || kind === 'perc' || kind === 'shaker') F.hat = Math.max(F.hat, e.vel * .7);
        if (e.pitch >= 0) wheel.hit(e.pitch % 12, e.vel); } }
    if (q.length > 4000) q.splice(0, q.length - 4000);
    F.kick *= Math.exp(-dt / .12); F.snare *= Math.exp(-dt / .08); F.hat *= Math.exp(-dt / .06); F.glitch *= Math.exp(-dt / .25);
    F.chaos = S.macros.chaos || .2; F.motion = S.macros.motion || .4;
    if (S.info){ F.barT0Ctx = S.barT0; F.barSec = S.barSec; F.barNo = S.info.pos !== undefined ? S.info.pos : S.info.bar; const sb = (t - S.barT0) / S.barSec; const steps = Math.floor(sb * 16); F.step = ((steps % 16) + 16) % 16; F.beat = Math.floor(sb * 4) + S.info.bar * 4; F.beatSec = S.barSec / 4;
      const bar = S.info.bar + Math.floor(sb); $('#clock').innerHTML = `<i>BAR</i> ${String(Math.max(0, bar) + 1).padStart(3, '0')}:${(Math.floor(sb * 4) % 4 + 4) % 4 + 1}`; }
    F.knobLive = {energy: F.kick, mood: F.bass, space: F.loudN * .5, density: F.hat, chaos: F.hat * F.chaos * 2, motion: .3 + .3 * Math.sin(t * (1 + 3 * F.motion))}; }
  // ---------------------------------------------------------------- loop
  let last = performance.now(), fpsAcc = [];
  function frame(){ const nowp = performance.now(), dt = Math.min(.05, (nowp - last) / 1000); last = nowp; const t = host.now();
    features(t, dt); field.draw(F, nowp / 1000); hero.draw(F, t, dt); lanes.draw(F, t, dt); wheel.draw(F, t, dt); for (const k in knobs) knobs[k].draw(F, t, dt); xy.draw(F, t, dt); gonio.draw(F); meter.draw(F, t, dt); arc.draw(F, t, S.pos === null || S.pos === undefined || !S.info ? null : S.pos + Math.max(0, Math.min(1.5, (t - S.barT0) / S.barSec))); drawStrips(dt); brain.tick(F); if (mathOn) mathV.render(F, S.playing);
    if (S.reel) reel.draw(F, t, $('#field'));
    // dynamic quality: p95 frame time
    fpsAcc.push(dt); if (fpsAcc.length > 90){ const s = fpsAcc.slice().sort((a, b) => a - b), p95 = s[Math.floor(s.length * .95)]; fpsAcc = []; if (p95 > .024 && field.scale > .3) field.scale -= .1; else if (p95 < .018 && field.scale < .5) field.scale += .05; }
    // (idle dimming removed on request — panels stay fully visible)
    requestAnimationFrame(frame); }
  // ---------------------------------------------------------------- controls
  async function start(){ $('#go').textContent = 'LOADING…'; try { await host.start(); } catch (e){ $('#go').textContent = 'AUDIO FAILED — ' + e.message; console.error(e); return; }
    $('#gate').style.display = 'none'; const g = gateWorld ? taste.genomeFor(gateWorld) : taste.next(null, 'auto').genome; S.loadReason = gateWorld ? 'you picked it' : 'first piece — the AI picked'; host.load(g); S.expect = g.seed; setEndMode(endMode); setMath(mathOn); setFx(fxOn); play(true); requestAnimationFrame(frame); }
  // the engine clock stops while paused but AudioContext time runs on: shift everything still to come by the pause length
  function play(on){ if (host.ctx){ if (!on){ S.pausedAt = host.ctx.currentTime; S.pauseT = host.now(); } else if (S.pausedAt !== undefined){ const d = host.ctx.currentTime - S.pausedAt, t = S.pauseT;
        for (const e of S.timed) if (e.t > t){ e.t += d; if (e.x) e.x.ct += d; } lanes.shift(t, d); if (S.plan) S.plan.t0 += d; S.barT0 += d; S.pausedAt = undefined; } }
    S.playing = on; host.play(on); $('#play').textContent = on ? '❚❚ PAUSE' : '▶ PLAY'; $('#play').classList.toggle('on', on); }
  let fxOn = true; try { fxOn = localStorage.getItem('awaaz.fxmoves') !== '0'; } catch (e){}
  function setFx(on){ fxOn = on; $('#fxBtn').textContent = 'FX MOVES: ' + (on ? 'ON' : 'OFF'); $('#fxBtn').classList.toggle('on', on); $('#fxBtn').title = on ? 'v2: risers, impacts, tape stops, stutters, throws, key lifts at the section changes' : 'classic v1 behaviour: no transition moves'; host.send({type: 'v2', on}); try { localStorage.setItem('awaaz.fxmoves', on ? '1' : '0'); } catch (e){} }
  $('#fxBtn').onclick = () => { setFx(!fxOn); toast(fxOn ? 'FX moves ON — transitions get risers, impacts, stutters, throws…' : 'FX moves OFF — classic v1 transitions'); };
  $('#endMode').onclick = () => setEndMode(END_MODES[(END_MODES.indexOf(endMode) + 1) % 3]);
  $('#histBtn').onclick = e => { e.stopPropagation(); renderHist(); $('#hist').classList.toggle('open'); }; document.addEventListener('pointerdown', e => { if (!$('#hist').contains(e.target) && e.target !== $('#histBtn')) $('#hist').classList.remove('open'); });
  $('#mathBtn').onclick = () => setMath(!mathOn);
  $('#math').addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){ $('#math').scrollLeft += e.deltaY; e.preventDefault(); } }, {passive: false});
  $('#go').onclick = start; $('#play').onclick = () => play(!S.playing);
  $('#next').onclick = () => { nextPiece('auto', 'skip'); };
  $('#like').onclick = () => { if (!S.g) return; histTouch(true); brain.add(taste.like(S.g, S.macros), 'you'); toast('♥ the AI will make more like this'); updateLearn(); $('#like').classList.add('on'); setTimeout(() => $('#like').classList.remove('on'), 600); };
  $('#skip').onclick = () => { nextPiece('auto', 'skip'); toast('✕ skipped — learning'); updateLearn(); };
  $('#more').onclick = () => { if (S.g) taste.like(S.g, S.macros); nextPiece('similar'); toast('more like this — new seed, same world'); };
  $('#surprise').onclick = () => { nextPiece('surprise'); toast('surprise!'); };
  $$('#nudges button').forEach(b => b.onclick = () => { const n = b.dataset.n; host.send({type: 'nudge', kind: n}); b.classList.add('q'); setTimeout(() => b.classList.remove('q'), n === 'hold' ? 400 : 2400); brain.add(n === 'hold' ? 'HOLD toggled — the section loops until you press it again' : `${n.toUpperCase()} queued — lands at the next 4-bar phrase`, 'you'); });
  $('#mode').onclick = () => setMode(S.mode === 'FULL' ? 'CALM' : S.mode === 'CALM' ? 'STILL' : 'FULL');
  $('#rec').onclick = async () => { if (!S.rec){ host.recStart(); S.rec = true; $('#rec').classList.add('on'); $('#rec').textContent = '■ STOP REC'; toast('recording what you hear (lossless WAV)…'); }
    else { S.rec = false; $('#rec').classList.remove('on'); $('#rec').textContent = '● REC'; const b = await host.recStop(); awzDownload(b, `maut-ki-awaaz_${S.g ? S.g.world.toLowerCase() : 'take'}_${Date.now()}.wav`); toast('saved WAV'); } };
  $('#export').onclick = async () => { if (!S.g || S.exporting) return; S.exporting = true; const g = JSON.parse(JSON.stringify(S.g)), secs = (S.plan ? S.plan.total * S.barSec : 300) + 8; $('#export').textContent = '⤓ 0%';
    try { const b = await host.renderOffline(g, Object.assign({}, S.macros), secs, p => $('#export').textContent = '⤓ ' + Math.round(p * 100) + '%'); awzDownload(b, `maut-ki-awaaz_${g.world.toLowerCase()}_${g.seed}.wav`); toast('exported the whole piece as WAV'); }
    catch (e){ console.error(e); toast('export failed: ' + e.message, 5000); } S.exporting = false; $('#export').textContent = '⤓ EXPORT'; };
  $('#reelBtn').onclick = () => { S.reel = true; reel.on = true; $('#reel').classList.add('show'); };
  $('#reelExit').onclick = async () => { if (reel.rec) await stopReelRec(); S.reel = false; reel.on = false; $('#reel').classList.remove('show'); };
  async function stopReelRec(){ const b = await reel.stopRec(); $('#reelRec').textContent = '● RECORD VIDEO'; if (b) awzDownload(b, `maut-ki-awaaz_reel_${Date.now()}.${(reel.type || '').includes('mp4') ? 'mp4' : 'webm'}`); }
  $('#reelRec').onclick = async () => { if (reel.rec) await stopReelRec(); else { reel.startRec(); $('#reelRec').textContent = '■ STOP & SAVE'; } };
  // keyboard (research/05 §4.7)
  window.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; const k = e.key.toLowerCase(); S.idleT = performance.now(); document.body.classList.remove('idle');
    if (k === ' '){ e.preventDefault(); if ($('#gate').style.display !== 'none') start(); else play(!S.playing); }
    else if (k === 'm') setMath(!mathOn);
    else if (k === 'n') $('#next').click(); else if (k === 'l') $('#like').click(); else if (k === 'x') $('#skip').click(); else if (k === 'v') $('#mode').click();
    else if (k === 'b') $('[data-n=build]').click(); else if (k === 'p') $('[data-n=peak]').click(); else if (k === 'k') $('[data-n=break]').click(); else if (k === 'h') $('[data-n=hold]').click();
    else if (k === 'r') S.reel ? $('#reelExit').click() : $('#reelBtn').click(); else if (k === 'escape' && S.reel) $('#reelExit').click(); });
  ['pointermove', 'pointerdown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { S.idleT = performance.now(); document.body.classList.remove('idle'); }, {passive: true}));
  let saved = null; try { saved = localStorage.getItem('awaaz.mode'); } catch (e){} if (saved) { setMode(saved); $$('#gate [data-m]').forEach(x => x.classList.toggle('on', x.dataset.m === saved)); }
  else if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches){ setMode('CALM'); $$('#gate [data-m]').forEach(x => x.classList.toggle('on', x.dataset.m === 'CALM')); }
  window.AWAAZ = {host, taste, S, F};   // console access
})();
