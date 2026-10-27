/* Glitch Reel Machine — Studio panel wiring */
'use strict';
(() => {
  const S = STUDIO, P = S.P;
  const $s = id => document.getElementById(id);
  if (!$s('stGen')) return;
  // selects
  S.NOTE.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; if (i === P.tonic) o.selected = true; $s('stKey').append(o); });
  Object.keys(S.MODES).forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m.replace(/([A-Z])/g, ' $1').toLowerCase(); if (m === P.mode) o.selected = true; $s('stMode').append(o); });
  // layer toggles
  const LAY = {kick: 'Kick', snare: 'Snare/clap', hat: 'Hats', perc: 'Perc', bass: 'Bass', arp: 'Arp', pad: 'Pad', tex: 'Texture'};
  for (const k in LAY){ const l = document.createElement('label'); l.className = 'chk'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!P.layers[k]; c.onchange = () => { P.layers[k] = c.checked ? 1 : 0; regen(); }; l.append(c, ' ' + LAY[k]); $s('stLayers').append(l); }
  // dials
  const dial = (id, key, fmtf) => { const el = $s(id), out = $s(id + 'Out'); const show = () => { if (out) out.textContent = fmtf ? fmtf(+el.value) : (+el.value).toFixed(2); };
    el.oninput = () => { show(); }; el.onchange = () => { P[key] = +el.value; regen(); }; show(); };
  dial('stTempo', 'bpm', v => v | 0); dial('stBars', 'bars', v => v + ' bars'); dial('stPoly', 'poly'); dial('stDensity', 'density'); dial('stSwing', 'swing'); dial('stPump', 'pump'); dial('stCutoff', 'cutoff');
  dial('stDrive', 'drive'); dial('stDelay', 'delay'); dial('stVerb', 'verb'); dial('stTex', 'tex'); dial('stMotion', 'motion'); dial('stSub', 'sub'); dial('stHuman', 'humanize');
  $s('stKey').onchange = e => { P.tonic = +e.target.value; regen(); }; $s('stMode').onchange = e => { P.mode = e.target.value; regen(); };
  $s('stPulse').onchange = e => { P.pulse = e.target.value; regen(); }; $s('stArpRate').onchange = e => { P.arpRate = +e.target.value; regen(); };
  $s('stSeed').onchange = e => { P.seed = Math.max(1, +e.target.value | 0); regen(); };
  $s('stDice').onclick = () => { P.seed = 1 + Math.floor(Math.random() * 999998); $s('stSeed').value = P.seed; regen(); };
  $s('stGen').onclick = () => regen(true);

  const COL = {intro: '#2b3a55', build: '#6a4a16', peak: '#b0134f', break: '#1f4d4a', build2: '#6a4a16', peak2: '#d11a5e', outro: '#2b3a55'};
  function drawArc(M){ const c = $s('stArc'), x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h);
    M.sections.forEach(s => { const x0 = s.start / M.bars * w, x1 = (s.start + s.bars) / M.bars * w; x.fillStyle = COL[s.name]; x.fillRect(x0, 0, x1 - x0 - 1, h); x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '600 13px system-ui'; x.fillText(s.name + ' ' + s.bars, x0 + 6, 20); });
    // layer lanes
    const lanes = ['kick', 'hat', 'perc', 'bass', 'arp', 'pad']; lanes.forEach((L, i) => { for (let b = 0; b < M.bars; b++){ const on = S.sectionAt(M, b).on[L]; if (on > 0){ x.fillStyle = 'rgba(255,255,255,' + (.15 + on * .35) + ')'; x.fillRect(b / M.bars * w, 30 + i * 6, w / M.bars - 1, 4); } } });
    { const t = S.playhead(), tot = M.bars * 16 * 60 / M.p.bpm / 4; x.fillStyle = '#41e6ff'; x.fillRect(t / tot * w - 1, 0, 2, h); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(Math.min(w - 64, t / tot * w + 4), h - 18, 60, 16); x.fillStyle = '#41e6ff'; x.font = '600 12px system-ui'; x.fillText(fmt(t) + ' / ' + fmt0(tot), Math.min(w - 62, t / tot * w + 6), h - 5); } }
  // scrub: click or drag anywhere on the arc
  { const c = $s('stArc'); let drag = false; const at = e => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * S.duration(); };
    c.style.cursor = 'ew-resize'; c.addEventListener('pointerdown', e => { if (!S.model()) regen(); c.setPointerCapture(e.pointerId); drag = true; S.seek(at(e)); drawArc(S.model()); });
    c.addEventListener('pointermove', e => { if (drag){ S.seek(at(e)); drawArc(S.model()); } }); c.addEventListener('pointerup', () => drag = false); c.addEventListener('pointercancel', () => drag = false); }
  function regen(announce){ const M = S.generate(); $s('stInfo').textContent = S.describe(M); drawArc(M); if (S.playing()){ S.stop(); S.play(); } if (announce) toast('Generated · seed ' + P.seed); }
  $s('stPlay').onclick = () => { if (S.playing()){ S.stop(); $s('stPlay').innerHTML = '&#9654;'; } else { if (!S.model()) regen(); S.play(); $s('stPlay').innerHTML = '&#10074;&#10074;'; } };
  setInterval(() => { const M = S.model(); if (M && S.playing()) drawArc(M); else if (M && $s('stPlay').innerHTML.includes('10074')) { $s('stPlay').innerHTML = '&#9654;'; drawArc(M); } }, 120);
  document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if (!S.model()) return;
    if (e.key === 'Home'){ S.seek(0); drawArc(S.model()); } if (e.key === 'ArrowLeft' && e.altKey){ S.seek(S.playhead() - 4 * 60 / S.P.bpm * 4); drawArc(S.model()); } if (e.key === 'ArrowRight' && e.altKey){ S.seek(S.playhead() + 4 * 60 / S.P.bpm * 4); drawArc(S.model()); } });

  async function renderBlob(){ const st = $s('stStatus'); st.textContent = 'Rendering…'; const buf = await S.render(p => st.textContent = 'Rendering ' + Math.round(p * 100) + '%'); st.textContent = 'Encoding…'; const blob = S.toWav(buf); st.textContent = ''; return blob; }
  $s('stExport').onclick = async () => { try { const blob = await renderBlob(); saveBlob('studio-' + S.NOTE[P.tonic].replace('#', 's') + P.mode + '-' + P.bpm + '-seed' + P.seed + '.wav', blob); toast('WAV saved'); } catch(e){ console.error(e); toast('Render failed: ' + e.message); } };
  $s('stUse').onclick = async () => { try { if (S.playing()) $s('stPlay').click(); const blob = await renderBlob(); const f = new File([blob], 'studio-seed' + P.seed + '.wav', {type: 'audio/wav'});
      if (typeof IDB !== 'undefined') IDB.put('song', 'current', {name: f.name, type: f.type, blob: f}); await loadSongFile(f); toast('Studio track is now the reel song'); } catch(e){ console.error(e); toast('Could not hand the track to the reel: ' + e.message); } };
  $s('stCopy').onclick = async () => { const code = S.recipe(); try { await navigator.clipboard.writeText(code); toast('Music recipe copied'); } catch(e){ prompt('Music recipe', code); } };
  $s('stPaste').onclick = () => { const code = prompt('Paste a music recipe'); if (!code) return; try { S.applyRecipe(JSON.parse(code)); syncUI(); regen(true); } catch(e){ toast('That is not a music recipe'); } };
  function syncUI(){ $s('stSeed').value = P.seed; $s('stTempo').value = P.bpm; $s('stBars').value = P.bars; $s('stKey').value = P.tonic; $s('stMode').value = P.mode; $s('stPulse').value = P.pulse; $s('stArpRate').value = P.arpRate;
    for (const [id, k] of [['stPoly', 'poly'], ['stDensity', 'density'], ['stSwing', 'swing'], ['stPump', 'pump'], ['stCutoff', 'cutoff'], ['stDrive', 'drive'], ['stDelay', 'delay'], ['stVerb', 'verb'], ['stTex', 'tex'], ['stMotion', 'motion'], ['stSub', 'sub'], ['stHuman', 'humanize']]){ $s(id).value = P[k]; $s(id).oninput(); }
    [...$s('stLayers').querySelectorAll('input')].forEach((c, i) => c.checked = !!P.layers[Object.keys(LAY)[i]]); }
  // autosave the studio recipe next to the reel's
  setInterval(() => { try { localStorage.setItem('grm.studio', S.recipe()); } catch(e){} }, 4000);
  try { const s0 = localStorage.getItem('grm.studio'); if (s0) S.applyRecipe(JSON.parse(s0)); } catch(e){}
  syncUI(); regen();
  window.__studio = S;
})();
