/* Maut ki machine — Studio panel: drives the math synthesiser (js/synth.js).
   Rendering happens in a Web Worker built from SYNTH_CORE's own source, so the page never blocks; playback is a plain
   AudioBuffer, so seeking is instant. The plan (form, chords, sections) is computed on the main thread in milliseconds
   and drawn immediately while the audio renders. */
'use strict';
(() => {
  const $s = id => document.getElementById(id);
  if (!$s('stGen') || typeof SYNTH_CORE !== 'function') return;
  const CORE = SYNTH_CORE(), DEF = CORE.DEF;
  const APP = window.__app || {toast: m => console.log(m), saveBlob: () => false, loadSongFile: async () => { throw new Error('reel engine not loaded'); }, IDB: null};
  const P = JSON.parse(JSON.stringify(DEF));

  // ---------------------------------------------------------------- controls
  CORE.NOTE.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; $s('stKey').append(o); });
  Object.keys(CORE.MODES).forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m.replace(/([A-Z])/g, ' $1').toLowerCase(); $s('stMode').append(o); });
  const LAY = {kick: 'Kick', snare: 'Snare/clap', hat: 'Hats', perc: 'Perc', bass: 'Bass', arp: 'Arp', pad: 'Pad', lead: 'Lead', tex: 'Texture'};
  for (const k in LAY){ const l = document.createElement('label'); l.className = 'chk'; const c = document.createElement('input'); c.type = 'checkbox'; c.dataset.layer = k; c.onchange = () => { P.layers[k] = c.checked ? 1 : 0; changed(); }; l.append(c, ' ' + LAY[k]); $s('stLayers').append(l); }
  const DIALS = [['stTempo', 'bpm', v => String(v | 0)], ['stBars', 'bars', v => v + ' bars'], ['stMotion', 'motion'], ['stColor', 'color'], ['stDevelop', 'develop'], ['stChaos', 'chaos'], ['stPoly', 'poly'], ['stDensity', 'density'],
    ['stBright', 'bright'], ['stMetal', 'metal'], ['stSwing', 'swing'], ['stHuman', 'humanize'], ['stPump', 'pump'], ['stDrive', 'drive'], ['stVerb', 'verb'], ['stDelay', 'delay'], ['stWidth', 'width']];
  DIALS.forEach(([id, key, f]) => { const el = $s(id), out = $s(id + 'Out'); el.oninput = () => { if (out) out.textContent = f ? f(+el.value) : (+el.value).toFixed(2); }; el.onchange = () => { P[key] = +el.value; changed(); }; });
  const SELS = [['stRhythm', 'rhythm'], ['stForm', 'form'], ['stMode', 'mode'], ['stKey', 'tonic', Number], ['stArpRate', 'arpRate', Number]];
  SELS.forEach(([id, key, cast]) => { $s(id).onchange = e => { P[key] = cast ? cast(e.target.value) : e.target.value; changed(); }; });
  const PALS = [['stPalBass', 'bass'], ['stPalArp', 'arp'], ['stPalPad', 'pad'], ['stPalLead', 'lead'], ['stPalPerc', 'perc'], ['stPalTex', 'tex']];
  PALS.forEach(([id, key]) => { $s(id).onchange = e => { P.palette[key] = e.target.value; changed(); }; });
  $s('stSeed').onchange = e => { P.seed = Math.max(1, +e.target.value | 0); P.vary = 0; changed(true); };
  const roll = full => { const o = CORE.randomize(P, full); for (const k in o) P[k] = o[k]; syncUI(); changed(true); };
  $s('stGen').onclick = () => roll(false);
  $s('stRand').onclick = () => roll(true);
  $s('stVary').onclick = () => { P.vary = (P.vary | 0) + 1; changed(true); };
  function syncUI(){ $s('stSeed').value = P.seed; DIALS.forEach(([id, key]) => { $s(id).value = P[key]; $s(id).oninput(); });
    SELS.forEach(([id, key]) => { $s(id).value = String(P[key]); }); PALS.forEach(([id, key]) => { $s(id).value = P.palette[key] || 'auto'; });
    [...$s('stLayers').querySelectorAll('input')].forEach(c => c.checked = !!P.layers[c.dataset.layer]); }

  // ---------------------------------------------------------------- render worker
  let worker = null, jobId = 0, workerOK = true;
  const WSRC = '"use strict";\n' + SYNTH_CORE.toString() + '\nconst CORE = SYNTH_CORE();\nonmessage = e => { const {id, p} = e.data; try { let last = 0;\n' +
    'const r = CORE.render(p, f => { const n = Date.now(); if (n - last > 100){ last = n; postMessage({id, type: "progress", f}); } });\n' +
    'postMessage({id, type: "done", L: r.L, R: r.R, sr: r.sr, meta: r.meta}, [r.L.buffer, r.R.buffer]); } catch (err){ postMessage({id, type: "error", msg: String(err && err.stack || err)}); } };';
  function newWorker(){ try { const url = URL.createObjectURL(new Blob([WSRC], {type: 'text/javascript'})); const w = new Worker(url); URL.revokeObjectURL(url); return w; } catch(e){ workerOK = false; return null; } }
  let cur = null;           // {buf: AudioBuffer-ish {L, R, sr}, meta, wave}
  let planNow = null;       // the plan for the current params (drawn before the audio exists)
  let t0Render = 0;
  function render(){ const id = ++jobId, p = JSON.parse(JSON.stringify(P)); t0Render = performance.now(); status('Rendering 0%');
    if (worker){ worker.terminate(); worker = null; }
    if (workerOK) worker = newWorker();
    if (worker){ worker.onmessage = e => { const d = e.data; if (d.id !== jobId) return; if (d.type === 'progress') status('Rendering ' + Math.round(d.f * 100) + '%'); else if (d.type === 'error'){ status('Render failed'); console.error(d.msg); } else done(d); };
      worker.onerror = e => { console.warn('worker failed, rendering on the page instead', e); workerOK = false; worker = null; render(); };
      worker.postMessage({id, p}); }
    else setTimeout(() => { if (id !== jobId) return; try { const r = CORE.render(p); done({L: r.L, R: r.R, sr: r.sr, meta: r.meta}); } catch(err){ console.error(err); status('Render failed'); } }, 30); }
  function done(d){ const was = playing(), at = playhead();
    cur = {L: d.L, R: d.R, sr: d.sr, meta: d.meta, dur: d.L.length / d.sr, wave: overview(d.L, d.R)}; abuf = null;
    status('Rendered in ' + ((performance.now() - t0Render) / 1000).toFixed(1) + ' s'); info(d.meta); draw();
    if (was) play(Math.min(at, cur.dur - .05)); else offset = Math.min(offset, cur.dur - .05); syncPos(); }
  function overview(L, R){ const W = 1120, o = new Float32Array(W * 2), step = Math.max(1, Math.floor(L.length / W)); for (let x = 0; x < W; x++){ let mn = 0, mx = 0; const a = x * step, b = Math.min(L.length, a + step); for (let i = a; i < b; i += 7){ const v = (L[i] + R[i]) * .5; if (v < mn) mn = v; if (v > mx) mx = v; } o[x * 2] = mn; o[x * 2 + 1] = mx; } return o; }
  let deb = null; function changed(now){ planNow = CORE.plan(P); info(planNow.meta, true); draw(); clearTimeout(deb); deb = setTimeout(render, now ? 0 : 450); }
  function status(t){ $s('stStatus').textContent = t; }
  function info(m, pending){ $s('stInfo').textContent = (P.style ? P.style + ' · ' : '') + m.key + ' · ' + m.bpm + ' BPM · ' + m.rhythm + ' · ' + m.form + ' form · ' + m.bars + ' bars (' + fmt0(m.duration) + ') · bass ' + m.palette.bass + ', arp ' + m.palette.arp + ', pad ' + m.palette.pad + ', lead ' + m.palette.lead + ', perc ' + m.palette.perc + ', texture ' + m.palette.tex + ' · polymeter ' + m.poly + ' · motif ' + m.motif + (pending ? '' : ''); }

  // ---------------------------------------------------------------- playback
  let AC2 = null, src = null, startedAt = 0, offset = 0, abuf = null;
  function ctx(){ if (!AC2) AC2 = new (window.AudioContext || window.webkitAudioContext)(); if (AC2.state === 'suspended') AC2.resume(); return AC2; }
  function audioBuffer(){ if (abuf) return abuf; const c = ctx(); abuf = c.createBuffer(2, cur.L.length, cur.sr); abuf.copyToChannel(cur.L, 0); abuf.copyToChannel(cur.R, 1); return abuf; }
  const playing = () => !!src;
  const playhead = () => src ? Math.min(cur ? cur.dur : 0, AC2.currentTime - startedAt) : offset;
  function play(from){ if (!cur) return; stopSrc(); const c = ctx(), b = audioBuffer(); offset = Math.max(0, Math.min(cur.dur - .02, from === undefined ? offset : from));
    src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0, offset); startedAt = c.currentTime - offset;
    src.onended = () => { if (src && playhead() >= cur.dur - .1){ src = null; offset = 0; btn(); } }; btn(); }
  function stopSrc(){ if (src){ src.onended = null; try { src.stop(); } catch(e){} src.disconnect(); src = null; } }
  function pause(){ offset = playhead(); stopSrc(); btn(); }
  function btn(){ $s('stPlay').innerHTML = playing() ? '&#10074;&#10074;' : '&#9654;'; }
  $s('stPlay').onclick = () => { if (!cur){ status('Still rendering…'); return; } playing() ? pause() : play(); };
  function seek(t, commit){ const d = cur ? cur.dur : (planNow ? planNow.meta.duration : 0); t = Math.max(0, Math.min(d - .05, t)); if (playing() && commit) play(t); else if (!playing()) offset = t; draw(t); syncPos(t); }

  // ---------------------------------------------------------------- the arc: sections, chords, waveform, playhead
  const COL = {intro: '#2b3a55', build: '#7a5416', rise: '#7a5416', swell: '#6b4f1a', peak: '#b0134f', groove: '#5a2f78', bloom: '#8a2a6a', break: '#1f5b56', outro: '#2b3a55'};
  function draw(scrubT){ const c = $s('stArc'), x = c.getContext('2d'), w = c.width, h = c.height, m = (cur && cur.meta) || (planNow && planNow.meta); x.clearRect(0, 0, w, h); if (!m) return;
    const bw = w / m.bars;
    m.sections.forEach(s => { x.fillStyle = COL[s.name] || '#333'; x.fillRect(s.bar0 * bw, 0, s.bars * bw - 2, h); });
    if (cur && cur.wave && Math.abs(cur.meta.bars - m.bars) < 1){ x.fillStyle = 'rgba(255,255,255,.28)'; const mid = h * .62, amp = h * .36; for (let i = 0; i < w; i++){ const a = cur.wave[i * 2], b = cur.wave[i * 2 + 1]; x.fillRect(i, mid - b * amp, 1, Math.max(1, (b - a) * amp)); } }
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '600 22px system-ui'; m.sections.forEach(s => x.fillText(s.name, s.bar0 * bw + 8, 26));
    x.font = '500 17px system-ui'; x.fillStyle = 'rgba(255,255,255,.62)'; m.sections.forEach(s => s.chords.forEach(ch => { const cx = ch.bar * bw + 6; if (ch.bars * bw > 44) x.fillText(ch.name, cx, 50); x.fillRect(ch.bar * bw, 34, 1, 22); }));
    if (!cur || cur.meta.bars !== m.bars){ x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, w, h); }
    const d = cur ? cur.dur : m.duration, t = scrubT !== undefined ? scrubT : playhead(), px = d ? t / d * w : 0;
    x.fillStyle = '#41e6ff'; x.fillRect(px - 2, 0, 4, h); x.beginPath(); x.moveTo(px - 10, 0); x.lineTo(px + 10, 0); x.lineTo(px, 14); x.fill(); }
  function syncPos(override){ const d = cur ? cur.dur : 0, t = override !== undefined ? override : playhead(); $s('stPos').textContent = fmt(t) + ' / ' + fmt0(d); if (document.activeElement !== $s('stSeek')) $s('stSeek').value = d ? Math.round(t / d * 1000) : 0; }
  { const wrap = $s('stArcWrap'), c = $s('stArc'); let drag = false; const at = e => { const r = c.getBoundingClientRect(), d = cur ? cur.dur : 0; return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * d; };
    wrap.style.cursor = 'ew-resize';
    wrap.addEventListener('pointerdown', e => { if (e.button > 0 || !cur) return; drag = true; seek(at(e), !playing()); try { wrap.setPointerCapture(e.pointerId); } catch(err){} e.preventDefault(); });
    wrap.addEventListener('pointermove', e => { if (drag) seek(at(e), false); });
    wrap.addEventListener('pointerup', e => { if (!drag) return; drag = false; seek(at(e), true); });
    wrap.addEventListener('pointercancel', () => { drag = false; });
    const sl = $s('stSeek'); sl.addEventListener('input', () => cur && seek(+sl.value / 1000 * cur.dur, false)); sl.addEventListener('change', () => cur && seek(+sl.value / 1000 * cur.dur, true)); }
  setInterval(() => { if (playing()){ draw(); syncPos(); } }, 100);
  document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !cur) return; const bar = 4 * 60 / P.bpm;
    if (e.key === 'Home') seek(0, true); if (e.key === 'ArrowLeft' && e.altKey) seek(playhead() - 4 * bar, true); if (e.key === 'ArrowRight' && e.altKey) seek(playhead() + 4 * bar, true); });

  // ---------------------------------------------------------------- export, hand-off, recipes
  function wavBlob(){ const n = cur.L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, cur.sr, true); v.setUint32(28, cur.sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    let o = 44; for (let i = 0; i < n; i++){ const l = Math.max(-1, Math.min(1, cur.L[i])), r = Math.max(-1, Math.min(1, cur.R[i])); v.setInt16(o, l < 0 ? l * 32768 : l * 32767, true); v.setInt16(o + 2, r < 0 ? r * 32768 : r * 32767, true); o += 4; }
    return new Blob([b], {type: 'audio/wav'}); }
  const fname = () => 'synth-' + CORE.NOTE[P.tonic].replace('#', 's') + '-' + P.mode + '-' + P.bpm + '-seed' + P.seed + (P.vary ? 'v' + P.vary : '') + '.wav';
  $s('stExport').onclick = () => { if (!cur) return APP.toast('Still rendering'); APP.saveBlob(fname(), wavBlob()); APP.toast('WAV saved'); };
  $s('stUse').onclick = async () => { if (!cur) return APP.toast('Still rendering'); if (playing()) pause(); try { const f = new File([wavBlob()], fname(), {type: 'audio/wav'}); if (APP.IDB) APP.IDB.put('song', 'current', {name: f.name, type: f.type, blob: f}); await APP.loadSongFile(f); APP.toast('Studio track is now the reel song'); } catch(e){ console.error(e); APP.toast('Could not hand the track to the reel: ' + e.message); } };
  const recipe = () => JSON.stringify(Object.assign({app: 'maut-ki-machine-synth', v: 1}, P));
  function applyRecipe(o){ if (!o || (o.app !== 'maut-ki-machine-synth' && o.app !== 'glitch-reel-machine-synth')) /* accepts recipes saved under the old name */ throw new Error('not a synth recipe'); for (const k in DEF) if (k in o) P[k] = k === 'layers' ? Object.assign({}, DEF.layers, o.layers) : k === 'palette' ? Object.assign({}, o.palette) : o[k]; }
  $s('stCopy').onclick = async () => { const code = recipe(); try { await navigator.clipboard.writeText(code); APP.toast('Music recipe copied'); } catch(e){ prompt('Music recipe', code); } };
  $s('stPaste').onclick = () => { const code = prompt('Paste a music recipe'); if (!code) return; try { applyRecipe(JSON.parse(code)); syncUI(); changed(true); APP.toast('Recipe applied'); } catch(e){ APP.toast('That is not a music recipe'); } };
  setInterval(() => { try { localStorage.setItem('grm.synth', recipe()); } catch(e){} }, 4000);
  try { const s0 = localStorage.getItem('grm.synth'); if (s0) applyRecipe(JSON.parse(s0)); } catch(e){}
  syncUI(); changed(true);
  window.__studio = {P, CORE, render, playing, playhead, seek: t => seek(t, true), current: () => cur, play, pause};
})();
