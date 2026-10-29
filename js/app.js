/* Maut ki machine — main: state, media, sequencer, renderer, export, UI */
(() => {
'use strict';
let W = 720, H = 1280, SC = 1;
const $ = s => document.querySelector(s);
/* =========================================================
   1. SIGNALS: offline audio analysis -> normalized curves at 100 fps
   ========================================================= */
/* =========================================================
   2. MODULATION MATRIX: every dial = base + depth × signal
   ========================================================= */
// [id, group, label, min, max, defaultBase, defaultSrc, defaultDepth, hint]
const P = {}; PARAMS.forEach(p => P[p[0]] = {base: p[5], src: p[6], depth: p[7]});
function applyPreset(key){ if (state.exporting) return;
  PARAMS.forEach(p => P[p[0]] = {base: p[5], src: p[6], depth: p[7]});
  const d = (PRESETS[key] && PRESETS[key].dials) || {};
  for (const k in d){ const v = d[k]; P[k].base = v[0]; if (v.length > 1){ P[k].src = v[1]; P[k].depth = v[2]; } }
  renderGroups();
}
function randomizeDials(){
  const r = Math.random; PARAMS.forEach(p => { const id = p[0]; if (id === 'minHold' || id === 'flkSpeed') return;
    const span = p[4] - p[3]; P[id].base = clamp(p[5] + (r() - .5) * span * .8, p[3], p[4]);
    if (r() < .5) P[id].src = pick(r, SIGNALS.filter(s => !['const','rand','lfo'].includes(s))); P[id].depth = clamp((r() - .3) * 1.2, -1, 1); });
  renderGroups();
}

/* =========================================================
   3. STATE
   ========================================================= */
const state = {
  media: [], preset: 'overdrive', seed: 1312, react: 1, intensity: 1, clarity: .6, exSize: 1080, exQ: 16, exporting: false, fontSet: 'auto', lengthSel: 30, fps: 60, clipFrames: 24,
  wordsOn: false, aspect: 'portrait', src: 'beat', bpm: 100, beatSeed: 7, buffer: null, songBuffer: null, songName: '', songStart: 0, songAn: null, beatAn: null, bpmMul: 1, rIn: null, rOut: null, lenCustom: 20, dropGate: false, gateT: 0, preDrop: false, preCalm: .7, dropAt: null, failed: [], libGen: 0, wordMode: 'random', cues: [], lyOff: 0, lyHow: 'word', lyHold: 4, tapIdx: 0,
  dur: 30, A: null, grid: null, off: 0, score: null, flkPattern: 'burst'
};
function sig(name, t){
  const A = state.A; if (!A) return 0;
  switch (name){
    case 'const': return 1;
    case 'rand': return hash1(Math.floor(t * state.fps) * 1.37 + state.seed);
    case 'lfo': return .5 + .5 * Math.sin(t * 1.5);
    case 'beat': return state.grid ? state.grid.beat[clamp(Math.round(t * AFPS), 0, state.grid.beat.length - 1)] : 0;
    case 'bar': return state.grid ? state.grid.bar[clamp(Math.round(t * AFPS), 0, state.grid.bar.length - 1)] : 0;
  }
  const arr = A[name]; if (!arr) return 0;
  return arr[clamp(Math.round((t + state.off) * AFPS), 0, arr.length - 1)] || 0;
}
// a dial's value at time t
function val(id, t){
  const p = P[id], def = PARAMS.find(q => q[0] === id); let v = p.base;
  if (p.src !== 'const' && p.depth) v += p.depth * (def[4] - def[3]) * sig(p.src, t) * state.react;
  else if (p.src === 'const' && p.depth) v += p.depth * (def[4] - def[3]) * state.react;
  if (DISTORT.has(id)) v *= 1 - state.clarity * .85; else if (id === 'lookMix') v *= 1 - state.clarity * .55; else if (id === 'feedback' || id === 'lookSwap') v *= 1 - state.clarity * .6;
  return clamp(v, def[3], def[4]);
}
const DISTORT = new Set(['warp','displace','tear','melt','pixelSort','kaleido','spin','sliceShift','badTV','pixelate','punchBlur','tone','posterize','pattern','overlapMove','polar','ghost','smear','shockwave','taffy','slitscan','weave','corrupt','led','oilslick']);
const hype = t => sig('hype', t), punch = t => sig('punch', t);

/* =========================================================
   4. MEDIA: images, GIFs (decoded to frames), video clips (sampled to frames)
   ========================================================= */
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// output format: portrait 9:16 (default), square 1:1, landscape 16:9. `short` is the short side (540 / 720 / 1080).
const ASPECTS = {portrait: [9, 16], square: [1, 1], landscape: [16, 9]};
function dimsFor(short){ const [a, b] = ASPECTS[state.aspect] || ASPECTS.portrait; return a <= b ? [short, Math.round(short * b / a / 2) * 2] : [Math.round(short * a / b / 2) * 2, short]; }
function resizeAll(w, h){ if (w === W && h === H) return; W = w; H = h; SC = Math.min(W, H) / 720; [glc, cBase, cOver, cText, cPat].forEach(c => { c.width = W; c.height = H; });
  [texBase, texOver, texText, texPat, fboTex[0], fboTex[1]].forEach(t => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); });
  for (let i = 0; i < 2; i++){ gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); } gl.bindFramebuffer(gl.FRAMEBUFFER, null); patKey = -1; }
function lumOf(src){ const c = mk(12, 20), x = c.getContext('2d'); try { x.drawImage(src, 0, 0, 12, 20); const d = x.getImageData(0, 0, 12, 20).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i]*.299 + d[i+1]*.587 + d[i+2]*.114; return clamp(s / (d.length / 4) / 255, .15, .85); } catch(e){ return .5; } }
async function fitBitmap(src){ let w = src.width || src.videoWidth, h = src.height || src.videoHeight; const mx = 1100;
  if (Math.max(w, h) > mx){ const k = mx / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
  return createImageBitmap(src, {resizeWidth: w, resizeHeight: h, resizeQuality: 'medium'}); }
function thumbOf(m){ const c = mk(72, 128); drawCover(c.getContext('2d'), m, 0, 0, 0, 72, 128, 1, 0, 0, false); return c.toDataURL('image/jpeg', .7); }
function finish(m){ m.lum = lumOf(m.frames[Math.floor(m.frames.length / 2)]); m.w = m.frames[0].width; m.h = m.frames[0].height; m.thumb = thumbOf(m); return m; }
async function addImage(src, name, isSample){ const bmp = await fitBitmap(src); if (!bmp.width) throw new Error('empty'); return finish({type: 'image', frames: [bmp], name, sample: !!isSample}); }
/* GIF decoder (LZW + disposal), compact */
function decodeGIF(buf){
  const d = new Uint8Array(buf); let p = 0; const u16 = () => d[p++] | (d[p++] << 8);
  p = 6; const sw = u16(), sh = u16(), pf = d[p++]; p += 2; let gct = null;
  const readCT = n => { const t = d.subarray(p, p + n * 3); p += n * 3; return t; };
  if (pf & 0x80) gct = readCT(1 << ((pf & 7) + 1));
  const canvas = new Uint8ClampedArray(sw * sh * 4); let prevCanvas = null; const frames = [];
  let disp = 0, trans = -1, delay = 100;
  const sub = () => { const parts = []; let n; while ((n = d[p++]) !== 0 && p < d.length){ parts.push(d.subarray(p, p + n)); p += n; } const tot = parts.reduce((s, q) => s + q.length, 0), o = new Uint8Array(tot); let k = 0; for (const q of parts){ o.set(q, k); k += q.length; } return o; };
  while (p < d.length){
    const b = d[p++];
    if (b === 0x3B) break;
    if (b === 0x21){ const lbl = d[p++]; if (lbl === 0xF9){ p++; const f = d[p++]; delay = u16() * 10 || 100; const ti = d[p++]; p++; disp = (f >> 2) & 7; trans = (f & 1) ? ti : -1; } else sub(); continue; }
    if (b !== 0x2C) break;
    const ix = u16(), iy = u16(), iw = u16(), ih = u16(), fl = d[p++]; let ct = gct; if (fl & 0x80) ct = readCT(1 << ((fl & 7) + 1)); const inter = fl & 0x40;
    const minCode = d[p++], data = sub();
    // LZW
    const clear = 1 << minCode, eoi = clear + 1; let size = minCode + 1, next = eoi + 1, mask = (1 << size) - 1;
    const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), lens = new Uint16Array(4096); for (let i = 0; i < clear; i++){ suffix[i] = i; lens[i] = 1; prefix[i] = -1; }
    const out = new Uint8Array(iw * ih); let op = 0, bits = 0, bv = 0, dp = 0, prev = -1; const tmp = new Uint8Array(4096);
    while (op < out.length){
      while (bits < size && dp < data.length){ bv |= data[dp++] << bits; bits += 8; } if (bits < size) break;
      const code = bv & mask; bv >>>= size; bits -= size;
      if (code === clear){ size = minCode + 1; next = eoi + 1; mask = (1 << size) - 1; prev = -1; continue; }
      if (code === eoi) break;
      let c = code, first; if (code >= next){ if (prev < 0) break; c = prev; }
      let l = 0; while (c >= 0){ tmp[l++] = suffix[c]; c = prefix[c]; } first = tmp[l - 1];
      for (let i = l - 1; i >= 0 && op < out.length; i--) out[op++] = tmp[i];
      if (code >= next && op < out.length) out[op++] = first;
      if (prev >= 0 && next < 4096){ prefix[next] = prev; suffix[next] = first; lens[next] = lens[prev] + 1; next++; if (next > mask && size < 12){ size++; mask = (1 << size) - 1; } }
      prev = code;
    }
    if (disp === 3) prevCanvas = canvas.slice();
    const rows = []; if (inter){ for (const [s, st] of [[0,8],[4,8],[2,4],[1,2]]) for (let y = s; y < ih; y += st) rows.push(y); } else for (let y = 0; y < ih; y++) rows.push(y);
    for (let r = 0; r < ih; r++){ const y = rows[r]; for (let x = 0; x < iw; x++){ const idx = out[r * iw + x]; if (idx === trans) continue; const cx = ix + x, cy = iy + y; if (cx >= sw || cy >= sh) continue;
      const o = (cy * sw + cx) * 4; canvas[o] = ct[idx * 3]; canvas[o + 1] = ct[idx * 3 + 1]; canvas[o + 2] = ct[idx * 3 + 2]; canvas[o + 3] = 255; } }
    frames.push({data: canvas.slice(), delay});
    if (disp === 2){ for (let y = iy; y < iy + ih && y < sh; y++) canvas.fill(0, (y * sw + ix) * 4, (y * sw + Math.min(sw, ix + iw)) * 4); }
    else if (disp === 3 && prevCanvas) canvas.set(prevCanvas);
    if (frames.length > 120) break;
  }
  return {w: sw, h: sh, frames};
}
async function addGIF(file, isSample){
  const g = decodeGIF(await file.arrayBuffer()); if (!g.frames.length) throw new Error('no frames');
  const step = Math.max(1, Math.ceil(g.frames.length / 48)), frames = [];
  for (let i = 0; i < g.frames.length; i += step){ const id = new ImageData(g.frames[i].data, g.w, g.h); frames.push(await fitBitmap(await createImageBitmap(id))); }
  if (frames.length < 2) return finish({type: 'image', frames, name: file.name, sample: !!isSample});
  return finish({type: 'clip', frames, name: file.name, kind: 'gif', sample: !!isSample, fps: 1000 / (g.frames[0].delay || 100)});
}
function addVideo(file, isSample){
  // Bursts: short runs of consecutive frames grabbed from random points in the clip, so cuts can land anywhere and still show real motion.
  // Every wait here is capped: a clip whose metadata, data or seek events never fire must not stall the app.
  return new Promise((res, rej) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
    const url = URL.createObjectURL(file); v.src = url;
    const frames = [], BURST = 6, BFPS = 15; let D = 0, settled = false;
    const close = () => { try { URL.revokeObjectURL(url); } catch(e){} try { v.src = ''; v.load(); } catch(e){} };
    const ok = m => { if (settled) return; settled = true; close(); res(m); };
    const fail = e => { if (settled) return; settled = true; close(); rej(e); };
    const once = (set, ms) => new Promise(r => { let fired = false; const go = v2 => { if (fired) return; fired = true; clearTimeout(tm); r(v2); }; const tm = setTimeout(() => go(true), ms); set(go); });
    // resolves true when the seek never landed; two stalls in a row means this clip will not seek at all
    const seekTo = t => once(go => { v.onseeked = () => go(false); try { v.currentTime = t; } catch(e){ go(true); } }, 2500);
    let stalls = 0;
    const metaTimer = setTimeout(() => fail(new Error('timed out reading ' + file.name)), 15000);
    v.onloadedmetadata = async () => { clearTimeout(metaTimer); try { D = v.duration; if (!isFinite(D) || D <= 0){ D = 2; }
      if (v.readyState < 2) await once(go => { v.onloadeddata = go; }, 8000);
      const total = Math.max(BURST, Math.min(state.clipFrames, Math.round(D * BFPS))), nB = Math.max(1, Math.round(total / BURST)), span = (BURST - 1) / BFPS;
      let seed = 0; for (const ch of file.name) seed = (seed * 31 + ch.charCodeAt(0)) | 0; const r = mulberry32(seed || 1); const bursts = [];
      for (let b = 0; b < nB; b++){ const lo = b / nB * D, hi = (b + 1) / nB * D; bursts.push(clamp(lo + r() * Math.max(0, hi - lo - span), 0, Math.max(0, D - span - .05))); }
      grab: for (const t0 of bursts) for (let i = 0; i < BURST; i++){
        if (await seekTo(Math.min(D - .03, t0 + i / BFPS))){ if (++stalls >= 2) break grab; } else stalls = 0;
        try { frames.push(await fitBitmap(v)); } catch(e){ /* one unreadable frame does not sink the clip */ } }
      // seeks stalled before any frame landed: salvage whatever the decoder is showing so the clip still exists
      if (!frames.length){ try { frames.push(await fitBitmap(v)); } catch(e){} }
      if (!frames.length) return fail(new Error('No readable frames in ' + file.name));
      ok(finish({type: 'clip', frames, name: file.name, kind: 'video', sample: !!isSample, fps: BFPS, burst: BURST, bursts: nB})); } catch(e){ fail(e); } };
    v.onerror = () => { clearTimeout(metaTimer); fail(new Error('Could not read ' + file.name)); };
  });
}
const FALLBACK = (() => { const out = []; const r = mulberry32(99);
  for (let i = 0; i < 3; i++){ const c = mk(360, 640), x = c.getContext('2d'); const p = Object.values(PAL)[i * 3];
    const g = x.createLinearGradient(0, 0, 360, 640); g.addColorStop(0, p[0]); g.addColorStop(.5, p[1]); g.addColorStop(1, p[3]); x.fillStyle = g; x.fillRect(0, 0, 360, 640);
    for (let k = 0; k < 14; k++){ x.fillStyle = p[(r() * 4) | 0]; x.globalAlpha = .6; x.beginPath(); x.arc(r() * 360, r() * 640, 20 + r() * 120, 0, 7); x.fill(); }
    out.push({type: 'image', frames: [c], w: 360, h: 640, lum: .5}); }
  return out; })();
const pool = () => state.media.length ? state.media : FALLBACK;
function frameOf(m, fi){ const n = m.frames.length; return m.frames[((fi % n) + n) % n]; }
function drawCover(ctx, m, fi, x, y, w, h, z, px, py, flip){
  if (!m) return; const img = frameOf(m, fi), mw = img.width, mh = img.height;
  const s = Math.max(w / mw, h / mh) * z, dw = mw * s, dh = mh * s;
  const dx = x + (w - dw) / 2 + px * (dw - w) / 2, dy = y + (h - dh) / 2 + py * (dh - h) / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); if (flip){ ctx.translate(2 * x + w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, dx, dy, dw, dh); ctx.restore();
}

/* =========================================================
   5. AUDIO: built-in beat, song loading, playback
   ========================================================= */
let AC = null, master = null, recDest = null, srcNode = null;
function ensureAC(){ if (!AC){ AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.connect(AC.destination); recDest = AC.createMediaStreamDestination(); master.connect(recDest); } if (AC.state === 'suspended') AC.resume(); return AC; }
async function makeBeat(bpm, dur, seed){
  const sr = 44100, ac = new OfflineAudioContext(2, Math.ceil(sr * (dur + 1)), sr), rng = mulberry32(seed * 31 + 7);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ac.destination);
  const bus = ac.createGain(); bus.gain.value = .7; bus.connect(comp);
  const dly = ac.createDelay(2); dly.delayTime.value = 60 / bpm * .75; const fb = ac.createGain(); fb.gain.value = .36; const wet = ac.createGain(); wet.gain.value = .32; dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(bus);
  const noise = ac.createBuffer(1, sr, sr); const nd = noise.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  const spb = 60 / bpm, st = spb / 4, steps = Math.floor(dur / st);
  const scales = [[0,1,4,5,7,8,11],[0,2,3,5,7,8,10],[0,1,3,5,7,8,10]], sc = scales[(rng() * 3) | 0], root = 38 + ((rng() * 7) | 0);
  const prog = [[0,3,4,0],[0,5,3,4],[0,1,0,4],[0,4,5,3]][(rng() * 4) | 0], kp = [[0,8],[0,7,10],[0,6,8,14],[0,3,8,11]][(rng() * 4) | 0];
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12), deg = (d, oct = 0) => { const L = sc.length, o = Math.floor(d / L); return root + sc[((d % L) + L) % L] + 12 * (o + oct); };
  const env = (g, t, a, peak, rel) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); };
  const kick = (t, v) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .13); env(g, t, .004, v, .38); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .45); };
  const nz = (t, v, type, f, q, rel) => { const s = ac.createBufferSource(); s.buffer = noise; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); env(g, t, .002, v, rel); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * .5); s.stop(t + rel + .05); };
  const snare = (t, v) => { nz(t, v * .55, 'bandpass', 1900, .8, .19); const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 185; env(g, t, .002, v * .3, .09); o.connect(g); g.connect(bus); o.start(t); o.stop(t + .15); };
  const hat = (t, v, open) => nz(t, v * .22, 'highpass', 7600, .7, open ? .22 : .045);
  const bass = (t, n, len) => { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(n); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + len); env(g, t, .01, .32, len); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + len + .05); };
  const pad = (t, notes, len, lvl) => { notes.forEach(n => [-7, 7].forEach(dt => { const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; f.type = 'lowpass'; f.frequency.value = 600 + 350 * lvl; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.028, t + len * .35); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + len + .05); })); };
  const pluck = (t, n) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = mtof(n); env(g, t, .003, .11, .26); o.connect(g); g.connect(bus); g.connect(dly); o.start(t); o.stop(t + .32); };
  for (let s = 0; s < steps; s++){
    const t = s * st, u = t / dur, sec = u < .12 ? 0 : u < .4 ? 1 : u < .55 ? 2 : u < .9 ? 3 : 4; // 2 = pre-drop dip, 3 = drop
    const pos = s % 16, bar = Math.floor(s / 16), ch = prog[bar % 4];
    if ((sec === 1 || sec === 3) && kp.includes(pos)) kick(t, sec === 3 ? 1 : .8);
    if (sec === 2 && pos === 0) kick(t, .5); if (sec === 2 && bar % 2 === 1 && pos >= 8 && pos % 2 === 0) snare(t, .3 + (pos - 8) * .09);
    if (sec === 4 && pos === 0) kick(t, .8);
    if (sec === 3 && (pos === 4 || pos === 12)) snare(t, 1);
    if (sec === 3 && bar % 2 === 1 && pos >= 12) snare(t, .35 + .15 * (pos - 12));
    if ((pos % 2 === 0 || sec === 3) && sec !== 2) hat(t, (pos % 4 === 2 ? .55 : .3) * (sec === 0 ? .6 : 1), pos === 14 && sec >= 2);
    if ((sec === 1 || sec === 3) && (pos === 0 || pos === 6 || pos === 10)) bass(t, deg(ch), st * (pos === 0 ? 5 : 3));
    if (pos === 0) pad(t, [deg(ch, 1), deg(ch + 2, 1), deg(ch + 4, 1)], st * 16, sec === 3 ? 1 : .3);
    if (sec === 3 && rng() < .7) pluck(t, deg(ch + [0, 2, 4, 7][s % 4], 2));
    if (sec === 2 && pos % 4 === 0) pluck(t, deg(ch + bar % 7, 3));
  }
  return ac.startRendering();
}
async function rebuildAudio(){
  const lenSel = state.lengthSel;
  if (state.src === 'beat' || !state.songBuffer){
    const dur = lenSel || 30;
    if (!state.beatAn || state.beatAn.key !== state.bpm + '/' + state.beatSeed + '/' + dur){
      state.buffer = await makeBeat(state.bpm, dur, state.beatSeed); const A = await analyzeBuffer(state.buffer); A.bpm = state.bpm; state.beatAn = {key: state.bpm + '/' + state.beatSeed + '/' + dur, A, buffer: state.buffer};
    } else state.buffer = state.beatAn.buffer;
    state.A = state.beatAn.A; state.dur = dur; state.off = 0;
  } else {
    const B = state.songBuffer, full = B.duration, start = clamp(state.songStart, 0, Math.max(0, full - 4));
    state.dur = lenSel ? Math.min(lenSel, full - start) : full - start; state.buffer = B; state.A = state.songAn; state.off = start;
  }
  const A = state.A, bpm = A.bpm * state.bpmMul; const Awin = Object.assign({}, A, {bpm});
  state.grid = beatGrid(Awin, state.off, state.off + state.dur);
  // make grid arrays index from window start
  $('#stBpm').textContent = Math.round(bpm); const drops = (A.dropTimes || []).filter(d => d >= state.off && d < state.off + state.dur);
  $('#stDrops').textContent = (A.dropTimes || []).length + (drops.length !== (A.dropTimes || []).length ? ' (' + drops.length + ' in range)' : '');
  $('#stPeak').textContent = fmt0(A.peakAt); $('#bpmInfo').textContent = Math.round(bpm) + ' BPM' + (state.src === 'song' ? ' detected' : '');
  drawSig();
}

/* =========================================================
   6. SEQUENCER: cuts, flicker triggers and words from the signals
   ========================================================= */
function triggers(src, thr, gap){ const out = []; const A = state.A; if (!A) return out; const dt = 1 / AFPS; let last = -9, prev = 0;
  for (let t = 0; t < state.dur; t += dt){ const v = sig(src, t); if (v > thr && prev <= thr && t - last > gap){ out.push(t); last = t; } prev = v; } return out; }
function buildScore(){
  if (!state.A) return;
  const r = mulberry32(state.seed * 7919 + 13), dur = state.dur, fps = state.fps, dt = 1 / fps, media = pool(), nM = media.length;
  const getP = () => state.preset === 'chaos' ? PRESETS[pick(r, STYLE_KEYS)] : PRESETS[state.preset];
  const per = state.grid.per, beats = state.grid.beats;
  // drop gate: the reel-time moment flashes are allowed to start (first drop; else first hype>=.75; else 0 = no gate)
  { let g = 0; const dd = ((state.A.dropTimes) || []).map(d => d - state.off).filter(x => x >= .5 && x < dur); if (dd.length) g = dd[0];
    else { for (let q = 0; q < dur; q += .1){ if (sig('hype', q) >= .75){ g = q; break; } } }
    if (state.dropAt !== null && state.dropAt > 0) g = clamp(state.dropAt, 0, dur); state.gateT = g; }
  const cuts = []; let t = 0, lastM = -1, prevCut = null, flashReturn = null;
  const isClip = i => media[((i % nM) + nM) % nM].type === 'clip';
  const cw = val('clipWeight', dur / 2); // clips weighted up to 5x photos in the pick
  // shuffle-bag ("deck"): every item is dealt once before any repeats; a fresh shuffle never starts with the last few dealt.
  // Seeded by seed + style, so a new style or a reroll deals a different order, and preview == export.
  const dr = mulberry32(((state.seed * 2654435761) ^ [...String(state.preset)].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7)) >>> 0);
  // two decks: main cuts and the secondary layers (inserts, pip cards, overlap layers) draw separately, so layers never eat the main order
  const mkDeck = () => { let deck = [], recent = [];
    const refill = () => { const a = [...Array(nM).keys()]; for (let i = a.length - 1; i > 0; i--){ const j = (dr() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
      const avoid = Math.min(recent.length, Math.floor(nM / 3)); for (let k = 0; k < avoid; k++){ const bad = recent[recent.length - 1 - k], idx = a.lastIndexOf(bad); if (idx >= a.length - avoid){ const sw = (dr() * (a.length - avoid)) | 0; [a[idx], a[sw]] = [a[sw], a[idx]]; } }
      deck = a; };
    return exclude => { if (nM <= 1) return 0; if (!deck.length) refill();
      // clip priority (only matters when photos and clips are mixed): reach a little further into the deck for a clip
      let at = deck.length - 1; const cwN = val('clipWeight', 0); if (cwN > 0 && !isClip(deck[at])){ for (let k = deck.length - 2; k >= Math.max(0, deck.length - 1 - Math.round(cwN * 6)); k--) if (isClip(deck[k])){ at = k; break; } }
      if (deck[at] === exclude && deck.length > 1) at = at === 0 ? 1 : at - 1;
      const m = deck.splice(at, 1)[0]; recent.push(m); if (recent.length > 64) recent.shift(); return m; }; };
  const deal = mkDeck(), deal2 = mkDeck();
  const other = m => { if (nM <= 1) return 0; return deal2(m); };
  const otherWeighted = m => { if (nM <= 1) return 0; let tot = 0; const ws = []; for (let i = 0; i < nM; i++){ const w = i === m ? 0 : (isClip(i) ? 1 + cw * 4 : 1); ws.push(w); tot += w; }
    let x = r() * tot; for (let i = 0; i < nM; i++){ x -= ws[i]; if (x <= 0) return i; } return (m + 1) % nM; };
  function newCut(start, m, isFlash){
    const Pz = getP(), I = (.4 + hype(start)) * state.intensity, col = val('collage', start), coll = (isFlash ? .3 : 1) * col;
    const lay = {full: 1}; for (const k in Pz.layouts) if (k !== 'full') lay[k] = Pz.layouts[k] * coll * 1.2; if (Pz.layouts.full) lay.full = Pz.layouts.full * (1.2 - coll);
    const cl = val('clones', start); const tot = Object.values(lay).reduce((x, y) => x + y, 0); lay.stack = tot * cl * .7;
    const layout = pickW(r, lay), mm = media[m];
    const c = {start, end: start, P: Pz, m, layout, I, isFlash,
      lookA: LOOK[pick(r, Pz.looks)], palA: pick(r, Pz.pals), lookB: LOOK[pick(r, Pz.looksB || Pz.looks)], palB: pick(r, Pz.palsB || Pz.pals), look2: LOOK[pick(r, Pz.looks)], pal2: pick(r, Pz.pals),
      z0: rr(r, 1, 1.08), z1: rr(r, 1.05, 1.35), px0: rr(r, -.6, .6), py0: rr(r, -.6, .6), px1: rr(r, -.6, .6), py1: rr(r, -.6, .6), flip: r() < .25,
      blockSize: pick(r, [16, 24, 32, 48, 64]), hue0: r() * 6.28, cyc0: r(), reps: r() < .35 ? 2 : 1, seed: r() * 1000, kseg: pick(r, [4, 6, 8, 10]),
      m2: other(m), clipStart: (r() * 1000) | 0, clipDir: r() < .25 ? -1 : 1, clipRate: rr(r, .6, 1.6), deco: []};
    if (layout === 'pip' && Pz.pipRect){ const q = Pz.pipRect, lw = W >= H; const R0 = lw ? [.2, .22, .6, .56] : q; c.rects = [{x: (R0[0] + rr(r, -.02, .02)) * W, y: (R0[1] + rr(r, -.03, .03)) * H, w: R0[2] * W, h: R0[3] * H, m: other(m), z0: rr(r, 1, 1.1), z1: rr(r, 1.05, 1.25), px: rr(r, -.4, .4), py: rr(r, -.4, .4), shadow: null}]; }
    else if (layout === 'pip'){
      const T = [[[.06,.07,.62,.3],[.32,.6,.62,.3]], [[.12,.2,.76,.5]], [[.05,.06,.52,.27],[.43,.37,.52,.27],[.08,.67,.52,.27]], [[.08,.52,.84,.38]], [[.1,.1,.8,.36],[.1,.54,.8,.36]]];
      c.rects = pick(r, T).map(q => ({x: (q[0] + rr(r, -.03, .03)) * W, y: (q[1] + rr(r, -.03, .03)) * H, w: q[2] * W, h: q[3] * H, m: other(m), z0: rr(r, 1, 1.2), z1: rr(r, 1.1, 1.45), px: rr(r, -.7, .7), py: rr(r, -.7, .7),
        shadow: Pz.name === 'Bazaar VHS' && r() < .7 ? {dx: rr(r, 10, 26), dy: rr(r, 10, 26), color: pick(r, ['#ff2ea6', '#7a00ff', '#00e5ff', '#ff3d00'])} : null}));
    } else if (layout === 'tile'){ c.cols = pick(r, [3, 4]); c.card = {x: .12 * W, y: .13 * H, w: .76 * W, h: .62 * H, m: other(m), z0: 1, z1: 1.15, px: 0, py: rr(r, -.4, .4), shadow: {dx: 18, dy: 22, color: pick(r, ['#ff2ea6', '#7a00ff', '#ff3d00'])}}; }
    else if (layout === 'shards'){ c.polys = []; const n = 2 + ((r() * 3) | 0); for (let i = 0; i < n; i++){ const cx = rr(r, .1, .9) * W, cy = rr(r, .1, .9) * H, rad = rr(r, .3, .75) * W, k = r() < .6 ? 3 : 4, a0 = r() * 6.28;
      const pts = []; for (let j = 0; j < k; j++){ const a = a0 + j * 6.28 / k + rr(r, -.4, .4); pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 1.3]); } c.polys.push({pts, cx, cy, m: other(m), z: rr(r, 1, 1.4), spin: rr(r, -.08, .08)}); } }
    // grid mix: a share of the cuts become a grid of different clips (1×2 … 3×3), the rest stay full frame
    if (!isFlash && Pz.gridMix && r() < Pz.gridMix){ c.layout = 'grid'; const land = W >= H;
      const G = land ? [[2,1],[3,1],[4,1],[2,2],[2,2],[3,2],[4,2],[3,3]] : [[1,2],[1,3],[1,4],[2,2],[2,2],[2,3],[1,2],[3,3]]; const [gx, gy] = pick(r, G);
      c.gx = gx; c.gy = gy; c.cells = []; for (let i = 0; i < gx * gy; i++) c.cells.push({m: i === 0 ? m : other(m), fo: (r() * 9) | 0, z: rr(r, 1, 1.15), px: rr(r, -.4, .4), py: rr(r, -.4, .4)}); }
    else if (layout === 'trip'){ c.nPan = W >= H ? 4 : 3; c.panFo = []; const fs = pick(r, [4, 6, 8]); for (let i = 0; i < c.nPan; i++) c.panFo.push(i * fs); c.panFlip = r() < .25; }
    else if (layout === 'mgrid'){ c.gx = W >= H ? 4 : 2; c.gy = W >= H ? 2 : 3; c.gStep = pick(r, [2, 3, 4]); }
    else if (layout === 'stack'){ const n = pick(r, [2, 3, 3, 4]); c.strips = []; for (let i = 0; i < n; i++) c.strips.push({py: rr(r, -.9, .9), flip: r() < .4, z: rr(r, 1.2, 2.2), fo: (r() * 4) | 0}); c.stripDir = r() < .8 ? 'h' : 'v'; }
    else if (layout === 'bands'){ const n = 2 + ((r() * 3) | 0), ys = [0]; for (let i = 1; i < n; i++) ys.push(rr(r, .15, .85)); ys.sort(); ys.push(1); c.bands = []; for (let i = 0; i < n; i++) c.bands.push({y0: ys[i] * H, y1: ys[i + 1] * H, m: i % 2 ? other(m) : m, dx: rr(r, -.1, .1) * W}); }
    // overlap: N extra images stacked on the base, each with its own blend mode, opacity, motion and a signal that breathes its opacity
    const ov = val('overlap', start) * (isFlash ? .5 : 1), nL = Math.min(5, Math.floor(ov * 4.2 + r() * .9)); c.layers = [];
    const MODES = ['screen','difference','difference','multiply','lighten','overlay','exclusion','hard-light','color-dodge','hue','luminosity','color','soft-light'];
    for (let i = 0; i < nL; i++) c.layers.push({m: other(m), fo: (r() * 7) | 0, mode: pick(r, MODES), alpha: rr(r, .25, .7), z: rr(r, 1, 1.7), px: rr(r, -.8, .8), py: rr(r, -.8, .8), flip: r() < .4,
      dx: rr(r, -.5, .5), dy: rr(r, -.3, .3), sig: pick(r, ['const','const','punch','bass','hype','beat','lfo','high','snare']), gate: r() < .3,
      filter: r() < .35 ? pick(r, ['invert(1)', 'hue-rotate(90deg)', 'hue-rotate(180deg)', 'saturate(3)', 'contrast(2.2)', 'grayscale(1) contrast(1.6)', 'sepia(1) saturate(4)']) : 'none'});
    // decorations: ink / spiral from the old reels, plus motif arrangements scaled by the Motifs dial
    const mo = val('motifs', start);
    for (const k in (Pz.deco || {})){ const isMotif = ARRANGE[k] !== undefined; const p = Pz.deco[k] * Math.min(1.3, I) * (isMotif ? mo * 1.6 : 1); if (r() < p) c.deco.push({type: k, seed: r() * 1e4}); }
    if (!c.deco.length && r() < mo * .5) c.deco.push({type: pick(r, ARRANGE_KEYS), seed: r() * 1e4});
    c.patKind = r() < (Pz.patMotif === undefined ? .6 : Pz.patMotif) ? 'motif' : 'words';
    return c;
  }
  let cur = newCut(0, deal(-1), false); cuts.push(cur); lastM = cur.m;
  let bi = 0, holdFrames = 0;
  for (t = dt; t < dur; t += dt){
    holdFrames++;
    const hy = hype(t), pu = punch(t), I = state.intensity;
    const curClip = isClip(cur.m), clipH = curClip ? val('clipHold', t) : 0;
    const cutRate = val('cutRate', t) * I / (1 + clipH * 1.2), flash = val('flashCuts', t) * I, minHold = Math.round(val('minHold', t) * (1 + clipH * 3));
    let doCut = false, isFlash = false;
    // beat crossings
    while (bi < beats.length && beats[bi] <= t){ const isBar = Math.round((bi - state.grid.downbeatOffset) % 4 + 4) % 4 === 0; if (isBar && r() < .6 + cutRate * .4) doCut = true; else if (r() < cutRate * (.25 + hy * .9)) doCut = true; bi++; }
    // onset-driven cut
    if (!doCut && sig('kick', t) > .55 && sig('kick', t - dt) <= .55 && r() < cutRate * (.2 + hy)) doCut = true;
    // free-running probability, grows with hype
    if (!doCut && r() < cutRate * cutRate * (.02 + hy * hy * .35)) doCut = true;
    // max hold: never sit still longer than this
    if (!doCut && holdFrames > fps * per * (hy > .6 ? 1 : 2.5) * (1 + clipH * 1.5)) doCut = true;
    // flash cuts: 1-3 frame insert then return
    if (flashReturn !== null){ if (t >= flashReturn){ flashReturn = null; cur.end = t; const back = prevCut; cur = Object.assign({}, back, {start: t, end: t, isFlash: false, clipStart: back.clipStart + 3}); cuts.push(cur); holdFrames = 0; } continue; }
    if (!doCut && flash > 0 && pu > .7 && hy > .35 && !((state.dropGate || state.preDrop) && t < state.gateT) && r() < flash * flash * (hy + pu) * .45){ isFlash = true; doCut = true; }
    if (doCut && !isFlash && holdFrames < minHold) doCut = false;
    if (doCut){
      cur.end = t; prevCut = cur; const m = isFlash ? deal2(lastM) : deal(lastM); cur = newCut(t, m, isFlash); cuts.push(cur); holdFrames = 0; lastM = isFlash ? lastM : m;
      if (isFlash) flashReturn = t + dt * (1 + ((r() * 3) | 0));
    }
  }
  cur.end = dur;
  // flicker trigger lists (times), per source actually used by flicker dials
  const trig = {}; for (const id of ['invertFlk', 'whiteFlash', 'blackBlink', 'strobe']){ const s = P[id].src; if (!trig[s]) trig[s] = triggers(s, .5, .07); }
  if (!trig.kick) trig.kick = triggers('kick', .5, .07);
  // words
  const texts = [], words = state.wordsOn ? parseWords() : []; let wi = 0;   // words off: no text events in any style
  const mkEv = (t0, t1, word, word2) => { const c = cutAt(cuts, t0), Pz = c.P, style = word2 ? 'stack' : pick(r, Pz.textStyles.filter(x => x !== 'stack').length ? Pz.textStyles.filter(x => x !== 'stack') : Pz.textStyles); const fset = FONT_SETS[state.fontSet] || Pz.fonts || ['narrow', 'anton'];
    return {start: t0, end: Math.min(dur, t1), style, word, word2: word2 || null, color: pick(r, BRIGHTS), color2: pick(r, BRIGHTS), mode: pick(r, Pz.textModes), stretch: rr(r, .8, 1.25), y: rr(r, .25, .75), x: rr(r, .15, .85), rot: rr(r, -.12, .12), side: r() < .5 ? .14 : .86, lower: r() < .5, seed: r() * 1e4, font: pick(r, fset)}; };
  if (state.wordsOn && state.wordMode === 'lyrics'){
    // timed lyrics: each line owns the window from its cue to the next cue (capped by max hold); shown whole, or one word per beat across the window
    const cues = state.cues.filter(q => q.t !== null && q.text.trim()).map(q => ({t: q.t + state.lyOff, text: q.text.trim()})).sort((a, b) => a.t - b.t);
    for (let i = 0; i < cues.length; i++){ const t0 = cues[i].t; if (t0 >= dur || t0 < -.5) continue; const next = i + 1 < cues.length ? cues[i + 1].t : dur; const t1 = Math.min(next, t0 + state.lyHold, dur); if (t1 - t0 < .05) continue;
      if (state.lyHow === 'line'){ texts.push(mkEv(Math.max(0, t0), t1, cues[i].text)); continue; }
      const ws = cues[i].text.split(/\s+/).filter(Boolean); if (!ws.length) continue;
      let grid = beats.filter(b => b >= t0 - .02 && b < t1); if (grid.length < ws.length){ const half = []; for (const b of beats) if (b >= t0 - .02 && b < t1){ half.push(b, b + per / 2); } grid = half.filter(b => b < t1); }
      if (grid.length < ws.length){ grid = ws.map((_, k) => t0 + k * (t1 - t0) / ws.length); } // denser than the grid: spread evenly
      if (!grid.length || grid[0] > t0 + .25) grid.unshift(t0);
      const every = Math.max(1, Math.floor(grid.length / ws.length));
      ws.forEach((w, k) => { const gi = Math.min(grid.length - 1, k * every); const a = Math.max(0, grid[gi]), b = k + 1 < ws.length ? Math.max(a + .08, grid[Math.min(grid.length - 1, (k + 1) * every)]) : t1; texts.push(mkEv(a, Math.min(b, t1), w)); }); }
    texts.sort((a, b) => a.start - b.start);
  } else if (words.length){
    // random-words mode, made deliberate: each line of the words box is a phrase; a phrase starts on a bar line and plays its words in order
    // on a steady grid (rate picks bar / half-bar / beat), with ONE style, font, colour and position for the whole phrase, then rests a bar
    const lines = lyricLines().map(l => l.split(/\s+/).filter(Boolean)).filter(l => l.length); let li = 0, k = 4;
    const ANCH = [{style: 'tall', y: .5}, {style: 'small', x: .5, y: .78}, {style: 'small', x: .5, y: .22}, {style: 'vertical'}, {style: 'tall', y: .62}];
    while (k < beats.length && lines.length){ const bt = beats[k]; if (bt > dur - .5) break; const rate = val('wordRate', bt);
      if (rate < .05 || hype(bt) < .12){ k += 4; continue; }
      const step = rate < .3 ? 4 : rate < .6 ? 2 : 1, line = lines[li++ % lines.length], c0 = cutAt(cuts, bt), Pz = c0.P;
      const allowed = Pz.textStyles && Pz.textStyles.length ? Pz.textStyles : ['tall'], an = ANCH.filter(a => allowed.includes(a.style)), A0 = an.length ? pick(r, an) : {style: allowed[0], x: .5, y: .5};
      const fset = FONT_SETS[state.fontSet] || Pz.fonts || ['narrow', 'anton'], font = pick(r, fset), color = r() < .55 ? '#ffffff' : pick(r, BRIGHTS), mode = pick(r, Pz.textModes), seed = r() * 1e4, side = r() < .5 ? .14 : .86;
      let kk = k; for (let wi2 = 0; wi2 < line.length && kk < beats.length; wi2++, kk += step){ const t0 = beats[kk]; if (t0 > dur - .25) break; const t1 = kk + step < beats.length ? beats[kk + step] : t0 + per * step;
        texts.push({start: t0, end: Math.min(dur, t0 + (t1 - t0) * .92), style: A0.style, word: line[wi2], word2: null, color, color2: color, mode, stretch: 1, y: A0.y === undefined ? .5 : A0.y, x: A0.x === undefined ? .5 : A0.x, rot: 0, side, lower: false, seed, font}); }
      k = Math.ceil((kk + 4) / 4) * 4; } }
  state.score = {cuts, texts, trig}; state.score.strip = buildIceStrip(dur, trig.kick || []); patKey = -1; drawStrip();
}
// ice strip timeline (from the blue reference reel): one state per 30 fps frame. Measured there: half the states last a single frame,
// a few hold 10–30 frames; about a third are black; a glowing inset, solid panels, a stripe frame and the bare band fill the rest.
// Energy tilts it (hype → more panels and insets, quiet → more black) and every kick lands on a lit frame.
const ICE_PANEL = ['#46e3ff', '#0a16f2', '#cdf3ff', '#f2f8ff', '#1e8bff'];
function buildIceStrip(dur, kicks){ const r = mulberry32(state.seed * 4111 + 7), n = Math.ceil(dur * 30) + 2, out = new Array(n); const rect = (x0, y0, w, h) => [x0, y0, Math.min(1, x0 + w), Math.min(1, y0 + h)];
  const mkState = (mode, t) => { const w = rr(r, .52, .78), h = rr(r, .6, .82), x0 = rr(r, .04, Math.max(.05, .96 - w)), y0 = (1 - h) / 2 + rr(r, -.05, .05), R = rect(x0, y0, w, h);
    const ex = rr(r, .02, .07), ey = rr(r, .08, .14), O = [Math.max(0, R[0] - ex), Math.max(0, R[1] - ey), Math.min(1, R[2] + ex), Math.min(1, R[3] + ey)];
    const zr = r(), Z = zr < .55 ? [Math.min(.99, R[2] + rr(r, 0, .02)), 0, Math.min(1, R[2] + rr(r, .06, .22)), 1] : zr < .75 ? [0, 0, Math.max(.01, R[0] - rr(r, 0, .02)), 1] : [0, 0, 0, 0];
    const P1 = pick(r, ICE_PANEL), P2 = r() < .4 ? '#000000' : pick(r, ICE_PANEL), inv = r() < .45 ? 1 : 0;
    return {mode, R, O, Z, X: rr(r, .3, .62), quad: r() < .35 ? 1 : 0, P1, P2, inv, tint: r() < .6 ? 0 : r() < .62 ? 1 : 2, row: r(), lit: inv ? .95 : .45, line: r() < .35 ? 1 : 0}; };
  let f = 0; while (f < n){ const t = f / 30, hy = hype(t), pu = punch(t), u = r();
    const L = u < .48 ? 1 : u < .62 ? 2 : u < .7 ? 3 : u < .87 ? 4 + ((r() * 6) | 0) : 10 + ((r() * 20) | 0);
    let mode; if (L >= 8) mode = r() < .72 ? 0 : 4; else mode = +pickW(r, {0: .24 + hy * .1, 1: .07 + pu * .1, 2: .12, 3: Math.max(.16, .4 - hy * .16), 4: .06, 5: .06 + pu * .04, 6: .02});
    const st = mkState(mode, t); for (let k = 0; k < L && f + k < n; k++) out[f + k] = st; f += L; }
  for (const kt of kicks){ const fi = Math.round(kt * 30); if (fi < 0 || fi >= n || r() > .5) continue; const st = mkState(r() < .5 ? 1 : 5, kt); st.P1 = pick(r, ['#f2f8ff', '#46e3ff', '#cdf3ff']); out[fi] = st; }
  return out; }
function cutAt(cuts, t){ let lo = 0, hi = cuts.length - 1; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (cuts[m].start <= t) lo = m; else hi = m - 1; } return cuts[lo]; }
function textAt(t){ const T = state.score.texts; let lo = 0, hi = T.length - 1, ans = null; while (lo <= hi){ const m = (lo + hi) >> 1; if (T[m].start <= t){ ans = T[m]; lo = m + 1; } else hi = m - 1; } return ans && t < ans.end ? ans : null; }
function lastTrig(list, t){ let lo = 0, hi = list.length - 1, ans = -1; while (lo <= hi){ const m = (lo + hi) >> 1; if (list[m] <= t){ ans = m; lo = m + 1; } else hi = m - 1; } return ans; }
function parseWords(){ return $('#lyrics').value.split(/\s+/).map(w => w.trim()).filter(Boolean); }
// flicker state at time t for one dial: returns 0..1 (pattern value × gate)
function flicker(id, t, pattern){
  const list = state.score.trig[P[id].src] || []; const i = lastTrig(list, t); if (i < 0) return 0;
  const amt = val(id, list[i]) * state.intensity; if (hash1(i * 7.3 + state.seed + id.length) > amt) return 0;
  const step = Math.floor((t - list[i]) * state.fps / Math.max(1, Math.round(val('flkSpeed', t))));
  return step < pattern.length ? pattern[step] : 0;
}

/* =========================================================
   7. RENDERER: 2D layers -> WebGL effect chain
   ========================================================= */
const cBase = mk(), cOver = mk(), cText = mk(), cPat = mk();
const xBase = cBase.getContext('2d'), xOver = cOver.getContext('2d'), xText = cText.getContext('2d'), xPat = cPat.getContext('2d');
const glc = $('#gl'); const gl = glc.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false, powerPreference: 'high-performance', desynchronized: false});
if (!gl){ $('#badge').hidden = false; $('#badge').textContent = 'This browser has no WebGL2'; }
let prog, progCopy, U = {}, texBase, texOver, texText, texPat, fbo = [], fboTex = [], cur = 0;
function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function link(vs, fs){ const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
function mkTex(){ const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return t; }
function gpuName(){ try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); return String(r).replace(/ANGLE \((.*)\)/, '$1'); } catch(e){ return 'unknown'; } }
function initGL(){
  prog = link(VS, FS); progCopy = link(VS, FS_COPY);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  texBase = mkTex(); texOver = mkTex(); texText = mkTex(); texPat = mkTex();
  for (let i = 0; i < 2; i++){ fboTex[i] = mkTex(); fbo[i] = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex[i], 0); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++){ const info = gl.getActiveUniform(prog, i); U[info.name.replace('[0]', '')] = gl.getUniformLocation(prog, info.name); }
  gl.useProgram(prog); [['tBase',0],['tOver',1],['tText',2],['tPrev',3],['tPat',4]].forEach(([k,v]) => U[k] && gl.uniform1i(U[k], v)); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
}
function upload(tex, unit, canvas){ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); }
function bindOnly(tex, unit){ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

/* text + deco layers */
const DEVA = DEVA_RE;
function drawWord(ctx, word, fontKey, cx, cy, targetW, maxH, stretch, color, scale){
  const S = 200, F = fontForWord(fontKey, word); ctx.font = F.css.replace('{S}', S); const w = Math.max(1, ctx.measureText(word).width), sx = Math.min(targetW / w, 6), sy = Math.min(stretch * sx, maxH / (S * .78));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sx * scale, sy * scale); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(word, 0, 0); ctx.restore();
}
function drawText(ev, t, pulse){
  const ctx = xText, k = t - ev.start, size = .55 + val('wordSize', t) * .6, pop = size * (1 + .14 * Math.exp(-k * 9)), g = val('wordGlitch', t), st = ev.stretch * (1 + val('stretch', t) * 3);
  const jx = g * pulse > .3 ? (hash1(ev.seed + Math.floor(t * 30)) - .5) * 40 * g * SC : 0, col = ev.mode === 0 ? ev.color : '#ffffff';
  let w = ev.word; if (!DEVA.test(w)) w = ev.style === 'small' ? (ev.lower ? w.toLowerCase() : w) : w.toUpperCase();
  if (g > .6 && hash1(ev.seed * 3 + Math.floor(t * 20)) < g * .25) w = w.split('').map((ch, i) => hash1(i + t * 50) < .3 ? '#@%&*'[(hash1(i * 9 + t) * 5) | 0] : ch).join('');
  if (ev.style === 'tall') drawWord(ctx, w, ev.font, W / 2 + jx, ev.y * H, W * .92, H * .7, st, col, pop);
  else if (ev.style === 'stack'){ let w2 = ev.word2 || ''; if (!DEVA.test(w2)) w2 = w2.toUpperCase(); drawWord(ctx, w, ev.font, W / 2 + jx, H * .3, W * .92, H * .45, st, col, pop); drawWord(ctx, w2, ev.font, W / 2 - jx, H * .7, W * .92, H * .45, st, ev.mode === 0 ? ev.color2 : col, pop); }
  else if (ev.style === 'vertical'){ ctx.save(); ctx.translate(ev.side * W + jx, H / 2); ctx.rotate(ev.side < .5 ? -Math.PI / 2 : Math.PI / 2); drawWord(ctx, w, ev.font, 0, 0, H * .88, W * .34, Math.min(st, 1.6), col, pop); ctx.restore(); }
  else { ctx.save(); ctx.translate(ev.x * W + jx, ev.y * H); ctx.rotate(ev.rot); drawWord(ctx, w, ev.font, 0, 0, W * rr(mulberry32(ev.seed | 0), .45, .8), H * .22, Math.min(st, 1.5), col, pop); ctx.restore(); }
}
const decoColor = r => { const k = r(); return k < .4 ? '#ffffff' : k < .65 ? '#000000' : pick(r, BRIGHTS); };
// camera HUD: dashed edge ticks at mid-height and a square reticle on the split line
function drawHud(rx, ry){ const ctx = xText, u = Math.min(W, H) / 360, lw = Math.max(2, u * 1.2); ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = lw;
  for (const ex of [.06, .94]){ const x = ex * W - u * 1.6; for (let k = 0; k < 4; k++) ctx.fillRect(x, H * .5 - u * 14 + k * u * 7.5, u * 3.2, u * 5); }
  const s = u * 15, cx = rx * W, cy = (1 - ry) * H; ctx.strokeRect(cx - s / 2, cy - s / 2, s, s); ctx.beginPath(); ctx.moveTo(cx - s / 2, cy); ctx.lineTo(cx - s / 2 + s * .32, cy); ctx.stroke(); ctx.restore(); }
// type wall: two of your words tiled as a wallpaper — big word in one column, the smaller one stacked beside it — one row lit per pulse
function drawWall(pk, palKey){ const ws = parseWords(), list = ws.length ? ws : ['MAUT', 'KI', 'MACHINE']; const a = list[(pk >> 3) % list.length], b = list[((pk >> 3) + 1) % list.length];
  const ctx = xText, cols = 4, cw = W / cols, big = cw * .42, small = big * .52, rowH = big * 1.35, rows = Math.ceil(H / rowH) + 1, lit = pk % rows, pal = PAL[palKey] || PAL.jelly;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(1, W / 540);
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++){ const x = col * cw + cw * .08, y = r * rowH + rowH * .5, isBig = col % 2 === 0, on = r === lit;
    if (isBig){ const f = fontForWord('mono', a); ctx.font = f.css.replace('{S}', Math.round(big * (on ? 1.06 : 1))); if (on){ ctx.fillStyle = pal[2]; ctx.fillText(a, x, y); } else { ctx.strokeStyle = pal[3]; ctx.globalAlpha = .75; ctx.strokeText(a, x, y); ctx.globalAlpha = 1; } }
    else { const f = fontForWord('mono', b); ctx.font = f.css.replace('{S}', Math.round(small)); for (let k = 0; k < 2; k++){ const yy = y + (k - .5) * small * 1.15; if (on){ ctx.fillStyle = pal[2]; ctx.fillText(b, x, yy); } else { ctx.strokeStyle = pal[2]; ctx.globalAlpha = .6; ctx.strokeText(b, x, yy); ctx.globalAlpha = 1; } } } }
  ctx.restore(); }
function drawDeco(c, t, pulse){
  const ctx = xText;
  for (const d of c.deco){ const r = mulberry32(d.seed | 0);
    if (ARRANGE[d.type]){ ARRANGE[d.type](ctx, W, H, SC, r, t - c.start, pulse, decoColor); continue; }
    if (d.type === 'splat'){ const cx = r() * W, cy = r() * H * .8; ctx.fillStyle = r() < .6 ? '#000' : pick(r, BRIGHTS); for (let i = 0; i < 26; i++){ const a = r() * 6.28, dd = Math.pow(r(), 1.8) * 230 * SC, rad = ((1 - dd / (240 * SC)) * 26 * r() + 3) * SC; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, rad, 0, 7); ctx.fill(); } for (let i = 0; i < 5; i++){ const x = cx + (r() - .5) * 160 * SC, len = (40 + r() * 180) * SC; ctx.fillRect(x, cy, (4 + r() * 6) * SC, len * Math.min(1, (t - c.start) * 3)); } }
    else if (d.type === 'spiral'){ ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 * SC; const s0 = 340 * SC, cx = W * .5, cy = H * .62; let x = cx - s0 / 2, y = cy - s0 * .309, s = s0 * .618; ctx.strokeRect(cx - s0 / 2, cy - s0 * .309, s0, s0 * .618); ctx.beginPath(); ctx.arc(cx, cy, s0 * .55, 0, 7); ctx.stroke(); let ang = 0; for (let i = 0; i < 7; i++){ ctx.beginPath(); ctx.arc(x + s, y + s, s, Math.PI + ang, Math.PI * 1.5 + ang); ctx.stroke(); s *= .618; ang += Math.PI / 2; x += s * .6; y += s * .2; } ctx.restore(); } }
}
let patKey = -1;
function drawPattern(c){
  const r = mulberry32((c.seed * 13) | 0), ws = parseWords(), words = (ws.length ? ws : ['NOISE', 'RANG', '80S', 'POP', 'ART', 'CHAOS']).map(w => DEVA.test(w) ? w : w.toUpperCase());
  xPat.clearRect(0, 0, W, H); if (c.patKind === 'motif'){ drawWallpaper(xPat, W, H, SC, r, decoColor); upload(texPat, 4, cPat); return; }
  let y = 40, wi = (r() * words.length) | 0;
  while (y < H + 60){ const size = (70 + r() * 50) * SC; let x = -r() * 120; while (x < W){ const w = words[wi++ % words.length]; xPat.save(); xPat.translate(x, y); xPat.rotate((r() - .5) * .3);
    const pf = fontForWord(pick(r, c.P.fonts || ['anton']), w); xPat.font = pf.css.replace('{S}', size); xPat.fillStyle = r() < .65 ? '#ffffff' : pick(r, BRIGHTS); xPat.textBaseline = 'middle'; xPat.fillText(w, 0, 0); x += xPat.measureText(w).width * .92 + 8 * SC; xPat.restore(); } y += size * .82; }
  upload(texPat, 4, cPat);
}
function clipFrame(c, m, t){ if (m.frames.length < 2) return 0; const sp = val('clipSpeed', t) * c.clipRate, st = val('stutter', t);
  const start = m.burst ? (c.clipStart % Math.max(1, m.bursts)) * m.burst : c.clipStart;
  let f = (t - c.start) * (m.fps || 12) * sp * c.clipDir; if (st > 0){ const q = Math.max(1, Math.round(2 + st * 6)); const fi = Math.floor(f); f = Math.floor(fi / q) * q + (hash1(fi + c.seed) < st ? 0 : fi % q); } return start + Math.floor(f); }
const lastSig = {};
function renderAt(t){
  if (!state.score || !gl) return;
  const S = state.score, c = cutAt(S.cuts, t), media = pool(), dur = Math.max(.001, c.end - c.start);
  const chop = val('chop', t), tq = chop > .02 ? (q => Math.floor(t * q) / q)(lerp(14, 3.5, chop)) : t; // chopped clock for motion only
  const k = ease(clamp((tq - c.start) / dur, 0, 1));
  const preK = state.preDrop && t < (state.gateT || 0) ? state.preCalm : 0; // build-up: damp everything before the drop
  const pu = punch(t), hy = hype(t), I = state.intensity * (1 - preK * .6), bp = sig('beat', tq), pulse = Math.exp(-bp * 6) * (bp > 0 ? 1 : 0);
  const M = i => media[i % media.length], v = id => val(id, t);
  // clean hits: for a few frames after each kick the effect stack drops away and the raw footage shows
  let fxMul = 1; { const cl = v('cleanHits'); if (cl > 0){ const L = S.trig.kick || []; const i = lastTrig(L, tq); if (i >= 0) fxMul = 1 - cl * .9 * Math.exp(-(tq - L[i]) * 16); } }
  fxMul *= 1 - preK * .8;
  const clarityOv = 1 - state.clarity * .4;
  const fGate = (state.dropGate || state.preDrop) && t < (state.gateT || 0) ? 0 : 1; // flashes held back until the drop
  const zoom = v('zoomPunch') * I, punchZ = 1 + .06 * zoom * pulse;
  xBase.fillStyle = '#000'; xBase.fillRect(0, 0, W, H);
  const fi = clipFrame(c, M(c.m), tq);
  const mech = (id, k) => { const a = v(id); return a > 0 && hash1(c.seed * 7.31 + k * 13.7) < a; };
  const mStrip = mech('iceStrip', 7) && S.strip, mSplit = !mStrip && mech('splitTint', 1), mQuad = !mStrip && !mSplit && mech('quadGrid', 2), mInset = !mStrip && !mQuad && mech('inset', 3), mErode = !mStrip && !mQuad && !mSplit && mech('erode', 4), mPin = !mStrip && !mQuad && !mSplit && !mErode && mech('pinwheel', 9), mBand = !mStrip && !mSplit && !mQuad && !mErode && !mPin && mech('bandMap', 10), mLoupe = !mStrip && !mQuad && !mPin && !mBand && mech('loupe', 11), mRef = !mStrip && c.P && c.P.refMode && mech('refFx', 12), mFlick = mech('palFlick', 8), mHud = mech('hud', 5), mWall = state.wordsOn && mech('typeWall', 6);
  const pulseLen = Math.max(.08, (state.grid ? state.grid.per : .5) * lerp(2, .33, v('tintRate'))), pk = Math.floor(t / pulseLen);
  const palsS = c.P && c.P.pals && c.P.pals.length ? c.P.pals : ['mint', 'olive', 'thermo', 'slate'], palS = palsS[Math.floor(hash1(pk * 3.7 + c.seed) * palsS.length) % palsS.length];
  const splitX = .5 + (hash1(c.seed * 3.3) - .5) * .16, splitDir = c.P && c.P.twin ? (W >= H ? 0 : 1) : hash1(c.seed * 5.1) < .65 ? 1 : 0, splitSide = hash1(c.seed * 9.2) < .5 ? 1 : 0;
  // twin split (landscape reference reel): two different clips side by side; the tinted half is drawn in the base pass below
  const twinOn = mSplit && c.P && c.P.twin && media.length > 1, twinA = splitDir ? (splitSide ? [0, splitX * H, W, H - splitX * H] : [0, 0, W, splitX * H]) : (splitSide ? [splitX * W, 0, W - splitX * W, H] : [0, 0, splitX * W, H]);
  const twinB = splitDir ? (splitSide ? [0, 0, W, splitX * H] : [0, splitX * H, W, H - splitX * H]) : (splitSide ? [0, 0, splitX * W, H] : [splitX * W, 0, W - splitX * W, H]);
  if (c.layout === 'tile'){ const cw = W / c.cols, chh = cw * 16 / 9 * .55; let row = 0; for (let y = -((tq * 30) % chh); y < H; y += chh, row++) for (let i = -1; i < c.cols + 1; i++) drawCover(xBase, M(c.m), fi, i * cw + (row % 2) * cw / 2, y, cw, chh, 1, 0, 0, (i + row) % 2 === 1); }
  else if (c.layout === 'bands'){ for (const b of c.bands){ xBase.save(); xBase.beginPath(); xBase.rect(0, b.y0, W, b.y1 - b.y0); xBase.clip(); drawCover(xBase, M(b.m), fi, b.dx * k, 0, W, H, lerp(c.z0, c.z1, k) * punchZ, lerp(c.px0, c.px1, k), lerp(c.py0, c.py1, k), c.flip); xBase.restore(); } }
  else if (c.layout === 'stack'){ const n = c.strips.length; c.strips.forEach((st, i) => { const x = c.stripDir === 'h' ? 0 : i * W / n, y = c.stripDir === 'h' ? i * H / n : 0, w = c.stripDir === 'h' ? W : W / n, h = c.stripDir === 'h' ? H / n : H;
      drawCover(xBase, M(c.m), fi + st.fo, x, y, w, h, st.z * punchZ, lerp(c.px0, c.px1, k) * .5, st.py, st.flip !== c.flip); }); }
  else if (c.layout === 'grid'){ const gx = c.gx, gy = c.gy, gap = Math.max(2, Math.round(Math.min(W, H) * .008)), cw2 = (W - gap * (gx + 1)) / gx, ch2 = (H - gap * (gy + 1)) / gy;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++){ const q = c.cells[j * gx + i], x = gap + (cw2 + gap) * i, y = gap + (ch2 + gap) * j; xBase.save(); xBase.beginPath(); xBase.rect(x, y, cw2, ch2); xBase.clip();
      drawCover(xBase, M(q.m), clipFrame(c, M(q.m), tq) + q.fo, x, y, cw2, ch2, q.z * punchZ, q.px * (k - .5), q.py * (k - .5), false); xBase.restore(); } }
  else if (c.layout === 'trip'){ const n = c.nPan, gap = Math.max(2, Math.round(W * .012)), pw = (W - gap * (n + 1)) / n, lit = Math.floor(hash1(pk * 2.1 + c.seed) * n);
    for (let i = 0; i < n; i++){ const x = gap + (pw + gap) * i; xBase.save(); xBase.beginPath(); xBase.rect(x, gap, pw, H - 2 * gap); xBase.clip();
      if (i !== lit && 'filter' in xBase) xBase.filter = 'brightness(.55) saturate(.65)';
      drawCover(xBase, M(c.m), fi + c.panFo[i], x, gap, pw, H - 2 * gap, lerp(c.z0, c.z1, k) * punchZ, 0, lerp(c.py0, c.py1, k) * .3, c.panFlip && i % 2 === 1); xBase.restore(); }
    xBase.fillStyle = '#000'; const shh = Math.max(3, Math.round(H * .012)), sww = Math.max(4, Math.round(W * .016));
    for (let x = gap * 2; x < W - gap; x += sww * 2.6){ xBase.fillRect(x, gap * 2.2, sww, shh); xBase.fillRect(x, H - gap * 2.2 - shh, sww, shh); } }
  else if (c.layout === 'mgrid'){ const gx = c.gx, gy = c.gy, gap = Math.max(2, Math.round(W * .008)), cw2 = (W - gap * (gx + 1)) / gx, ch2 = (H - gap * (gy + 1)) / gy, lit = Math.floor(hash1(pk * 3.3 + c.seed) * gx * gy);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++){ const idx = j * gx + i, x = gap + (cw2 + gap) * i, y = gap + (ch2 + gap) * j;
      xBase.save(); xBase.beginPath(); xBase.rect(x, y, cw2, ch2); xBase.clip();
      if ('filter' in xBase && idx !== lit) xBase.filter = hash1(idx * 3.7 + c.seed) < .14 ? 'invert(1)' : 'grayscale(1) brightness(.6) contrast(1.25)';
      drawCover(xBase, M(c.m), fi + idx * c.gStep, x, y, cw2, ch2, 1.03, 0, 0, false); xBase.restore(); } }
  else if (twinOn){ drawCover(xBase, M(c.m), fi, ...twinA, lerp(c.z0, c.z1, k) * punchZ, lerp(c.px0, c.px1, k) * .5, lerp(c.py0, c.py1, k) * .5, c.flip); drawCover(xBase, M(c.m2), fi + 7, ...twinB, lerp(c.z0, c.z1, k), 0, 0, false); }
  else drawCover(xBase, M(c.m), fi, 0, 0, W, H, lerp(c.z0, c.z1, k) * punchZ, lerp(c.px0, c.px1, k), lerp(c.py0, c.py1, k), c.flip);
  if (c.layers && c.layers.length){ const mv = v('overlapMove'); for (const L of c.layers){ let a = L.alpha * clarityOv * fxMul * (L.sig === 'const' ? 1 : .35 + .75 * sig(L.sig, t)); if (L.gate && mv > .3 && hash1(Math.floor(t * 20) + L.fo + c.id) < mv * .5) a = 0; if (a <= .02) continue;
      xBase.save(); xBase.globalCompositeOperation = L.mode; xBase.globalAlpha = clamp(a, 0, 1); if (L.filter !== 'none' && 'filter' in xBase) xBase.filter = L.filter;
      drawCover(xBase, M(L.m), fi + L.fo, 0, 0, W, H, L.z * punchZ, L.px + L.dx * k * mv + Math.sin(tq * 2.3 + L.fo) * mv * .15, L.py + L.dy * k * mv, L.flip); xBase.restore(); } }
  xOver.clearRect(0, 0, W, H); let overOn = 0, blendMode = 0;
  const card = q => { if (q.shadow){ xOver.fillStyle = q.shadow.color; xOver.fillRect(q.x + q.shadow.dx, q.y + q.shadow.dy, q.w, q.h); } drawCover(xOver, M(q.m), fi + 5, q.x, q.y, q.w, q.h, lerp(q.z0, q.z1, k), q.px * (k - .5), q.py * (k - .5), false); };
  if (c.layout === 'pip'){ c.rects.forEach(card); overOn = 1; } else if (c.layout === 'tile'){ card(c.card); overOn = 1; }
  else if (c.layout === 'shards'){ overOn = 1; for (const p of c.polys){ xOver.save(); xOver.translate(p.cx, p.cy); xOver.rotate(p.spin * k); xOver.translate(-p.cx, -p.cy); xOver.beginPath(); p.pts.forEach((q, i) => i ? xOver.lineTo(q[0], q[1]) : xOver.moveTo(q[0], q[1])); xOver.closePath(); xOver.clip(); drawCover(xOver, M(p.m), fi + 3, 0, 0, W, H, p.z, 0, 0, false); xOver.restore(); } }
  // frame mechanisms: each dial is the chance this cut uses it; inside a cut, treatments flip on a fixed visual pulse (not the beat)
  xText.clearRect(0, 0, W, H); if (mWall) drawWall(pk, palS); drawDeco(c, t, pulse); const ev = textAt(t); if (ev) drawText(ev, t, pu);
  if (mHud) drawHud(mSplit ? (splitDir ? .5 : splitX) : .5, mSplit && splitDir ? 1 - splitX : .5);
  const pat = !state.wordsOn && c.patKind !== 'motif' ? 0 : v('pattern'); if (pat > .02 && patKey !== c.id){ drawPattern(c); patKey = c.id; }
  // flicker
  const inv = flicker('invertFlk', t, FLK_PATTERNS[state.flkPattern] || FLK_PATTERNS.burst);
  let flash = 0; { const L = S.trig[P.whiteFlash.src] || [], i = lastTrig(L, t); if (i >= 0){ const a = v('whiteFlash') * I; if (hash1(i * 5.1 + state.seed) < a) flash = Math.exp(-(t - L[i]) * 30) * Math.min(.92, a); } }
  let black = 0; { const L = S.trig[P.blackBlink.src] || [], i = lastTrig(L, t); if (i >= 0 && t - L[i] < 1.5 / state.fps && hash1(i * 2.3 + state.seed) < v('blackBlink') * I) black = 1; }
  const strobeA = v('strobe') * I; let strobe = 0; if (strobeA > .05){ const f = Math.floor(t * state.fps), burst = Math.floor(f / 12); if (hash1(burst + state.seed) < strobeA * .35 && (f % 3) === 0) strobe = .85; }
  const lookSwap = (() => { const a = v('lookSwap'); const L = S.trig[P.lookSwap.src] || (S.trig[P.lookSwap.src] = triggers(P.lookSwap.src, .5, .1)); const i = lastTrig(L, t); if (i < 0) return 0; return hash1(i * 1.9 + state.seed + c.id) < a ? (Math.floor((t - L[i]) * 8) % 2 === 0 ? 1 : 0) : 0; })();
  // GL
  gl.useProgram(prog); upload(texBase, 0, cBase); if (overOn) upload(texOver, 1, cOver); else bindOnly(texOver, 1);
  const textOn = (ev || c.deco.length || mHud || mWall) ? 1 : 0; if (textOn) upload(texText, 2, cText); else bindOnly(texText, 2);
  bindOnly(fboTex[1 - cur], 3); bindOnly(texPat, 4);
  const f1 = (n, x) => U[n] && gl.uniform1f(U[n], x), i1 = (n, x) => U[n] && gl.uniform1i(U[n], x);
  gl.uniform2f(U.uRes, W, H);
  f1('uTime', tq); f1('uPulse', pulse); f1('uHue', c.hue0 + v('hueShift') * 6.28 * (sig('bar', t) + t * .05)); f1('uCycle', c.cyc0 + t * .2 * v('hueShift')); f1('uReps', c.reps);
  f1('uSplit', v('rgbSplit') * I * fxMul); f1('uTear', clamp(v('tear') * I * fxMul, 0, 1)); f1('uPix', v('pixelate') * fxMul > .03 ? 4 + v('pixelate') * 40 : 0); f1('uBlur', v('punchBlur') * I * pulse * fxMul); f1('uDisp', v('displace') * fxMul); f1('uLeak', v('lightLeak') * fxMul); f1('uBlendAmt', c.blendAmt || 1); f1('uTone', v('tone') * fxMul); i1('uBlendMode', blendMode); f1('uTextAlpha', (mHud || mWall) && !ev ? 1 : v('wordOpacity'));
  f1('uScan', v('scanlines')); f1('uGrain', v('grain')); f1('uFeed', clamp(v('feedback') * fxMul, 0, 1)); f1('uRings', v('rings') * fxMul); f1('uGlow', v('glow') * fxMul); f1('uWarp', v('warp') * fxMul);
  f1('uThresh', M(c.m).lum || .5); f1('uPattern', pat * fxMul); f1('uPatInv', (M(c.m).lum || .5) > .55 ? 1 : (M(c.m).lum || .5) < .4 ? 0 : (c.seed % 1 < .5 ? 1 : 0)); f1('uTextSplit', ev ? v('wordGlitch') * 1.5 : .3);
  f1('uMirror', v('mirror')); f1('uSeed', c.seed); f1('uDim', c.layout === 'pip' && !(c.P && c.P.noDim) ? .5 : 0); f1('uOverOn', overOn); f1('uTextOn', textOn);
  f1('uSat', v('saturate')); f1('uCon', v('contrast')); f1('uPoster', v('posterize') * fxMul); f1('uLookMix', v('lookMix') * fxMul); f1('uSlice', v('sliceShift') * I * fxMul); f1('uSort', v('pixelSort') * fxMul); f1('uRoll', v('badTV') * fxMul);
  f1('uMelt', v('melt') * fxMul); f1('uZoom', zoom * pulse); f1('uShake', v('shake') * I * (.3 + pu)); f1('uKaleido', v('kaleido') * fxMul); f1('uSpin', v('spin') * fxMul); f1('uEdges', v('edges') * fxMul); f1('uPolar', v('polar') * fxMul); f1('uGhost', v('ghost') * fxMul); f1('uBands', v('bands') * I * fxMul * fGate);
  { const L = S.trig.kick || [], ki = lastTrig(L, tq); f1('uShock', v('shockwave') * I * fxMul); f1('uShockT', ki >= 0 ? tq - L[ki] : 9); f1('uShockN', ki); }
  f1('uVar', c.seed); f1('uVar2', c.seed + Math.floor(tq * 2.3) * .137); f1('uSmear', v('smear') * I * fxMul); f1('uSmearA', c.seed * 2.39996); f1('uTaffy', v('taffy') * I * fxMul); f1('uSlit', v('slitscan') * fxMul); f1('uWeave', v('weave') * fxMul);
  f1('uCorrupt', v('corrupt') * I * fxMul); f1('uOil', v('oilslick') * fxMul); f1('uContour', v('contour') * fxMul); f1('uLed', v('led')); f1('uVeil', v('staticveil') * fxMul); f1('uHalf', v('halftone')); f1('uDither', v('dither')); f1('uLookSwap', lookSwap * fxMul);
  f1('uSplitOn', mSplit ? 1 : 0); f1('uSplitX', splitX); f1('uSplitDir', splitDir); f1('uSplitSide', splitSide); f1('uSplitPost', hash1(pk * 1.7 + c.seed) < .3 ? 1 : 0);
  if (U.uPalS) gl.uniform3fv(U.uPalS, PAL[palS].flatMap(hexRgb));
  f1('uQuadOn', mQuad ? 1 : 0); if (U.uQuadT){ const pm = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--){ const j = Math.floor(hash1(pk * 2.9 + c.seed + i * 1.13) * (i + 1)); const x = pm[i]; pm[i] = pm[j]; pm[j] = x; } gl.uniform4f(U.uQuadT, pm[0], pm[1], pm[2], pm[3]); }
  f1('uInsetOn', mInset ? 1 : 0); if (U.uInsetR){ const iw = .45 + hash1(c.seed * 4.1) * .35, ih = .12 + hash1(c.seed * 6.7) * .2, ix = hash1(c.seed * 8.3) * (1 - iw), iy = .1 + hash1(c.seed * 2.2) * (.8 - ih); gl.uniform4f(U.uInsetR, ix, iy, ix + iw, iy + ih); }
  f1('uInsetT', [0, 2, 1, 4, 2, 5][Math.floor(hash1(pk * 1.3 + c.seed * .7) * 6)]);
  f1('uErodeOn', mErode ? 1 : 0); if (U.uErodeM) gl.uniform2f(U.uErodeM, .06 + hash1(c.seed * 3.9) * .08, .1 + hash1(c.seed * 7.7) * .1); f1('uErodeB', hash1(c.seed * 5.5));
  f1('uStripOn', mStrip ? 1 : 0); if (mStrip){ const st = S.strip[clamp(Math.floor(t * 30), 0, S.strip.length - 1)] || S.strip[0];
    f1('uStripMode', st.mode); f1('uStripH', W >= H ? .82 : Math.min(1, W / H * 9 / 16)); f1('uStripX', st.X); f1('uStripQuad', st.quad); f1('uStripRow', st.row); f1('uStripInv', st.inv); f1('uStripTint', st.tint);
    f1('uStripGlow', v('iceGlow') * (st.inv ? 1 : .6)); f1('uStripLit', st.lit); f1('uStripLine', st.line); if (U.uStripR) gl.uniform4f(U.uStripR, ...st.R); if (U.uStripO) gl.uniform4f(U.uStripO, ...st.O); if (U.uStripZ) gl.uniform4f(U.uStripZ, ...st.Z);
    if (U.uStripC) gl.uniform3fv(U.uStripC, PAL[(c.P && c.P.icePal) || 'glacier'].flatMap(hexRgb)); if (U.uStripP1) gl.uniform3f(U.uStripP1, ...hexRgb(st.P1)); if (U.uStripP2) gl.uniform3f(U.uStripP2, ...hexRgb(st.P2)); }
  i1('uLookA', c.lookA); i1('uLookB', c.lookB); i1('uLook2', c.look2); i1('uTextMode', ev ? ev.mode : 0);
  // palette flicker (landscape reference reel, opening): the shot holds while its gradient map swaps every frame or two
  let palA = c.palA; if (mFlick){ const pls = c.P && c.P.pals && c.P.pals.length ? c.P.pals : ['acid', 'ember', 'olive'], stepF = Math.round(lerp(4, 1, v('flickRate'))), fk = Math.floor(t * 30 / stepF);
    palA = pls[Math.floor(hash1(fk * 1.37 + c.seed * .11) * pls.length) % pls.length];
    if (c.P && c.P.flickLook){ const lks = c.P.looks; i1('uLookA', LOOK[lks[Math.floor(hash1(fk * 2.9 + c.seed * .7) * lks.length) % lks.length]]); }
    else i1('uLookA', LOOK[c.P && c.P.looks && c.P.looks[0] === 'gmap' ? 'gmap' : 'duo']); }
  f1('uPinOn', mPin ? 1 : 0); if (mPin){ f1('uPinN', [6, 8, 8, 10][Math.floor(hash1(c.seed * 1.9) * 4)]); f1('uPinR', .26 + hash1(c.seed * 2.7) * .14); f1('uPinRot', t * (hash1(c.seed * 3.1) < .5 ? -.35 : .35) + c.seed); f1('uPinFold', hash1(c.seed * 4.3)); f1('uPinChunk', hash1(Math.floor(t * 4) + c.seed)); if (U.uPinM) gl.uniform2f(U.uPinM, .05 + hash1(c.seed * 5.9) * .05, .08 + hash1(c.seed * 6.3) * .06); }
  f1('uGridOn', c.layout === 'grid' ? 1 : 0); if (c.layout === 'grid' && U.uGridN){ gl.uniform2f(U.uGridN, c.gx, c.gy); const gPh = Math.floor(t * 30 / Math.round(lerp(5, 2, v('flickRate')))); f1('uGridPh', gPh * .173 + c.seed); }
  f1('uBandOn', mBand ? 1 : 0); if (mBand){ const bn = [6, 8, 10, 12][Math.floor(hash1(c.seed * 2.3) * 4)]; f1('uBandN', bn);
    const bPh = Math.floor(t * 30 / Math.round(lerp(5, 2, v('flickRate')))); f1('uBandPh', bPh * .137 + c.seed); f1('uBandLit', Math.floor(hash1(bPh * 1.7 + c.seed) * bn)); }
  f1('uLoupeOn', mLoupe ? 1 : 0); if (mLoupe){ const lx = .5 + Math.sin(t * .4 + c.seed * 9) * .16, ly = .48 + Math.cos(t * .31 + c.seed * 5) * .14;
    U.uLoupeC && gl.uniform2f(U.uLoupeC, lx, ly); f1('uLoupeR', .16 + hash1(c.seed * 7.3) * .1); f1('uLoupeMag', 1.7 + hash1(c.seed * 9.1) * 1.2); }
  { const ph = v('pixHold'); let e = 0, row = .5; if (ph > 0){ const L = S.trig.kick || [], i = lastTrig(L, tq);
      if (i >= 0 && hash1(i * 3.9 + state.seed) < ph){ e = Math.exp(-(tq - L[i]) * 14) * Math.min(1, ph * 1.6); row = .3 + hash1(i * 1.3 + c.seed) * .4; } }
    f1('uPixHold', e > .04 ? Math.min(1, e) : 0); f1('uPixRow', row); }
  f1('uRefOn', mRef ? 1 : 0); if (mRef){ const md = c.P.refMode, h = x => hash1(pk * x + c.seed * 1.7); f1('uRefMode', md); f1('uRefT', pk);
    if (U.uRefC) gl.uniform3fv(U.uRefC, (md === 1 ? ['#0e0024', '#3a0fb0', '#08b35a', '#ffd400', '#ff2a00'] : md === 2 ? ['#fff35c', '#0d1a8c', '#ffffff', '#5a1a8c', '#ff7a3d'] : md === 3 ? ['#ffe9a8', '#7dff8a', '#ff2a00', '#3cf2ff', '#ffffff'] : ['#d8c46a', '#2a1fa8', '#ffffff', '#000000', '#000000']).flatMap(hexRgb));
    // thermal: the white slab lands on a kick and holds ~4 frames
    let hit = 0; if (md === 1){ const L = S.trig.kick || [], i = lastTrig(L, tq); hit = i >= 0 && tq - L[i] < .14 && hash1(i * 4.1 + c.seed) < .55 ? 1 : 0; } f1('uRefHit', hit);
    f1('uRefAlt', md === 2 ? (h(2.3) < .3 ? 1 : 0) : 0);
    const iw = .5 + h(1.1) * .3, ih = md === 1 ? .2 + h(1.9) * .12 : .55 + h(1.9) * .25, ix = .08 + h(2.7) * (.84 - iw), iy = md === 1 ? .55 + h(3.1) * .2 - ih : .12 + h(3.1) * (.76 - ih);
    if (U.uRefR) gl.uniform4f(U.uRefR, ix, iy, ix + iw, iy + ih);
    f1('uRefX', md === 3 ? .42 + h(4.3) * .2 : h(4.3) < .5 ? .35 : 0); f1('uRefX2', md === 3 ? .15 + h(5.7) * .7 : h(5.7) < .35 ? .3 : 0);
    if (md === 3){ const box = (a, b) => { const w = .14 + hash1(pk * a) * .3, hh = (.1 + hash1(pk * b) * .3), x = hash1(pk * a + 3) * (1 - w), y = hash1(pk * b + 3) * (1 - hh); return [x, y, x + w, y + hh]; };
      U.uRefB0 && gl.uniform4f(U.uRefB0, ...box(7.1, 8.3)); U.uRefB1 && gl.uniform4f(U.uRefB1, ...box(9.7, 10.9)); U.uRefB2 && gl.uniform4f(U.uRefB2, ...(hash1(pk * 13.3) < .5 ? box(11.3, 12.1) : [2, 2, 2, 2])); } }
  { const pf = v('panelFlash'), f30 = Math.floor(t * 30), blk = Math.floor(f30 / 2), on = pf > 0 && hash1(blk * 3.3 + state.seed) < pf * .22; f1('uPanelOn', on ? 1 : 0);
    if (on && U.uPanelR){ const kind = Math.floor(hash1(blk * 5.7) * 4), R = kind === 0 ? [0, 0, .5, 1] : kind === 1 ? [.5, 0, 1, 1] : kind === 2 ? [0, .5, 1, 1] : [.1, .3, .9, .7]; gl.uniform4f(U.uPanelR, ...R); gl.uniform3f(U.uPanelC, ...hexRgb(hash1(blk * 7.1) < .7 ? '#8d8d8d' : '#b9b9b9')); } }
  gl.uniform3fv(U.uPalA, PAL[palA].flatMap(hexRgb)); gl.uniform3fv(U.uPalB, PAL[c.palB].flatMap(hexRgb)); gl.uniform3fv(U.uPal2, PAL[c.pal2].flatMap(hexRgb));
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]); gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(progCopy); bindOnly(fboTex[cur], 0); gl.uniform1i(gl.getUniformLocation(progCopy, 't'), 0); gl.uniform1f(gl.getUniformLocation(progCopy, 'fInvert'), inv * fGate); gl.uniform1f(gl.getUniformLocation(progCopy, 'fFlash'), Math.max(flash, strobe) * fGate); gl.uniform1f(gl.getUniformLocation(progCopy, 'fBlack'), black * fGate); gl.drawArrays(gl.TRIANGLES, 0, 3); cur = 1 - cur;
  // meters
  ['sub','bass','kick','snare','hat','mid','high','punch','hype'].forEach((n, i) => { const el = meterEls[i]; if (el) el.style.height = (2 + sig(n, t) * 56) + 'px'; });
}
const meterEls = []; (() => { const box = $('#meters'); for (let i = 0; i < 9; i++){ const e = document.createElement('i'); box.append(e); meterEls.push(e); } })();

/* strips */
const stripC = $('#stripc'), sx = stripC.getContext('2d');
function drawStrip(){
  const w = stripC.width, h = stripC.height, S = state.score; if (!S) return;
  sx.fillStyle = '#16111c'; sx.fillRect(0, 0, w, h);
  for (const c of S.cuts){ const x0 = c.start / state.dur * w, x1 = c.end / state.dur * w; sx.fillStyle = LOOK_COLOR[c.lookA]; sx.globalAlpha = c.isFlash ? 1 : .3 + .5 * Math.min(1, c.I / 1.3); sx.fillRect(x0, 0, Math.max(1, x1 - x0 - 1), c.isFlash ? 38 : 30); }
  sx.globalAlpha = 1; sx.fillStyle = 'rgba(182,255,0,.35)'; sx.beginPath(); sx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2){ const v = sig('hype', x / w * state.dur); sx.lineTo(x, h - 2 - v * (h - 46)); } sx.lineTo(w, h); sx.fill();
  sx.strokeStyle = '#f2ecf5'; sx.lineWidth = 1; sx.globalAlpha = .7; sx.beginPath(); for (let x = 0; x < w; x += 2){ const v = sig('loud', x / w * state.dur), y = h - 2 - v * (h - 46); x ? sx.lineTo(x, y) : sx.moveTo(x, y); } sx.stroke(); sx.globalAlpha = 1;
  sx.fillStyle = '#ff3d8b'; (state.A.dropTimes || []).forEach(d => { const t = d - state.off; if (t >= 0 && t < state.dur){ sx.fillRect(t / state.dur * w - 1, 0, 3, h); } });
  sx.fillStyle = 'rgba(242,236,245,.5)'; for (const e of S.texts) sx.fillRect(e.start / state.dur * w, 40, 2, 8);
  if ((state.dropGate || state.preDrop) && state.gateT > 0){ sx.fillStyle = '#41e6ff'; sx.fillRect(state.gateT / state.dur * w - 1, 0, 2, h); }
  if (typeof drawRegion === 'function') drawRegion();
}
const sigC = $('#sigc'), sgx = sigC.getContext('2d');
function drawSig(){ const w = sigC.width, h = sigC.height, A = state.A; if (!A) return; sgx.fillStyle = '#0d0a11'; sgx.fillRect(0, 0, w, h);
  const bands = [['sub', '#ff3d8b'], ['mid', '#41e6ff'], ['high', '#b6ff00']]; const n = A.frames;
  bands.forEach(([k, col], bi) => { sgx.fillStyle = col; sgx.globalAlpha = .55; for (let x = 0; x < w; x += 2){ const i = Math.floor(x / w * n); let m = 0; for (let j = i; j < Math.min(n, i + Math.ceil(n / w * 2)); j++) m = Math.max(m, A[k][j]); const hh = m * (h / 3 - 2); sgx.fillRect(x, (bi + 1) * h / 3 - hh, 2, hh); } });
  sgx.globalAlpha = 1; sgx.fillStyle = '#ff3d8b'; (A.dropTimes || []).forEach(d => sgx.fillRect(d / A.duration * w - 1, 0, 2, h));
  sgx.fillStyle = 'rgba(255,255,255,.25)'; sgx.fillRect(state.off / A.duration * w, 0, Math.max(2, state.dur / A.duration * w), 3);
}

/* =========================================================
   8. TRANSPORT + EXPORT
   ========================================================= */
let playing = false, startAt = 0, offset = 0, recording = null;
const now = () => playing ? AC.currentTime - startAt : offset;
const region = () => { const a = state.rIn === null ? 0 : clamp(state.rIn, 0, state.dur), b = state.rOut === null ? state.dur : clamp(state.rOut, 0, state.dur); return b - a > .1 ? [a, b] : [0, state.dur]; };
function play(){ ensureAC(); if (!state.buffer) return; { const [a, b] = region(); if (offset < a || offset >= b - .02) offset = a; } srcNode = AC.createBufferSource(); srcNode.buffer = state.buffer; srcNode.connect(master); startAt = AC.currentTime - offset; srcNode.start(0, state.off + offset); playing = true; $('#play').innerHTML = '&#10074;&#10074;'; $('#play').setAttribute('aria-label', 'Pause'); $('#fsPlay').innerHTML = '&#10074;&#10074;'; }
function pause(){ if (playing){ offset = now(); try { srcNode.stop(); } catch(e){} srcNode.disconnect(); } playing = false; $('#play').innerHTML = '&#9654;'; $('#play').setAttribute('aria-label', 'Play'); $('#fsPlay').innerHTML = '&#9654;'; }
function seek(t){ const was = playing; if (was) pause(); offset = clamp(t, 0, state.dur - .01); if (was) play(); else frame(); }
function frame(){ if (recording && recording.stopping) return; let t = now();
  const [ra, rb] = region();
  if (t >= (recording ? state.dur : rb)){ if (recording){ finishRecording(); t = state.dur - .001; } else { pause(); offset = ra; play(); t = ra; } }
  renderAt(t); $('#time').textContent = fmt(t) + ' / ' + fmt0(state.dur) + (rb - ra < state.dur - .05 ? '  ·  region ' + fmt(ra) + '–' + fmt(rb) : ''); $('#head').style.left = (t / state.dur * 100) + '%'; $('#fsFill').style.width = (t / state.dur * 100) + '%'; $('#fsTime').textContent = fmt(t) + ' / ' + fmt0(state.dur); if (recording) $('#badge').textContent = 'Recording ' + fmt(t) + ' / ' + fmt0(state.dur); }
function loop(){ if (playing || recording) frame(); requestAnimationFrame(loop); }
let dl = null; (async () => { try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch(e){ dl = null; } })();
function toast(msg){ const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3400); }
async function saveBlob(name, blob){ if (dl){ try { await dl.save({filename: name, data: blob}); toast('Saved ' + name); return true; } catch(e){ if (e && e.code === 'declined'){ toast('Save cancelled'); return false; } } }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch(e){} return false; }
function pickMime(){ const L = ['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1.42E01F,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']; return L.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''; }
async function startRecording(){
  if (recording) return; ensureAC(); const mime = pickMime(); if (!window.MediaRecorder || !glc.captureStream){ toast('This browser cannot record video. Try Chrome or Edge.'); return; }
  pause(); offset = 0; const vs = glc.captureStream(state.fps), stream = new MediaStream([...vs.getVideoTracks(), ...recDest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, {mimeType: mime || undefined, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192000}); const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  recording = {rec, chunks, mime: rec.mimeType || mime};
  rec.onstop = async () => { const type = recording.mime.split(';')[0] || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm'; const blob = new Blob(chunks, {type}), name = 'reel-' + state.preset + '-' + state.seed + '.' + ext;
    recording = null; $('#badge').hidden = true; $('#badge').classList.remove('rec'); $('#export').disabled = false; showResult(blob, name, ext); await saveBlob(name, blob); };
  $('#export').disabled = true; $('#badge').hidden = false; $('#badge').classList.add('rec'); rec.start(250); play();
}
function finishRecording(){ if (!recording || recording.stopping) return; recording.stopping = true; pause(); offset = 0; recording.rec.stop(); }
function showResult(blob, name, ext){ const box = $('#result'); box.hidden = false; box.innerHTML = ''; const v = document.createElement('video'); v.src = URL.createObjectURL(blob); v.controls = true; v.playsInline = true;
  const p = document.createElement('p'); p.className = 'note'; p.textContent = name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB)' + (ext === 'webm' ? '. This browser records WebM; Instagram wants MP4, so convert it or export from Chrome.' : '');
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Save again'; b.onclick = () => saveBlob(name, blob); const row = document.createElement('div'); row.className = 'row'; row.append(b, p); box.append(v, row); v.scrollIntoView({block: 'nearest'}); }


/* =========================================================
   8b. OFFLINE EXPORT: WebCodecs H.264 (+AAC or PCM) -> flat MP4, written here (no library)
   ========================================================= */
async function encodeAudio(t0 = 0, len = state.dur){
  const b = state.buffer, sr = b.sampleRate, s0 = Math.floor((state.off + t0) * sr), n = Math.floor(len * sr), ch = 2;
  const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L;
  let aacOK = false; try { aacOK = window.AudioEncoder && (await AudioEncoder.isConfigSupported({codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000})).supported; } catch(e){}
  if (aacOK){
    const samples = []; let asc = null;
    const enc = new AudioEncoder({output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) asc = new Uint8Array(meta.decoderConfig.description.slice ? meta.decoderConfig.description : meta.decoderConfig.description.buffer); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({data: d}); }, error: e => console.error(e)});
    enc.configure({codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000});
    const step = 4096; for (let i = 0; i < n; i += step){ const len = Math.min(step, n - i); const data = new Float32Array(len * ch); for (let k = 0; k < len; k++){ data[k] = L[s0 + i + k] || 0; data[len + k] = R[s0 + i + k] || 0; }
      enc.encode(new AudioData({format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round(i / sr * 1e6), data})); }
    await enc.flush(); enc.close();
    if (asc && samples.length) return {kind: 'aac', sr, ch, asc, samples};
  }
  const pcm = new Int16Array(n * ch); for (let i = 0; i < n; i++){ pcm[i * 2] = clamp(L[s0 + i] || 0, -1, 1) * 32767; pcm[i * 2 + 1] = clamp(R[s0 + i] || 0, -1, 1) * 32767; }
  return {kind: 'pcm', sr, ch, pcm};
}
async function exportVideo(){
  if (state.exporting || recording) return;
  if (!window.VideoEncoder || !window.VideoFrame){ toast('No frame encoder in this browser; recording live instead'); return startRecording(); }
  ensureAC(); pause(); const [ra, rb] = region(); const fps = state.fps, [exW, exH] = dimsFor(state.exSize === 1080 ? 1080 : 720), n = Math.round((rb - ra) * fps);
  const cfg = await pickVideoCodec(exW, exH, fps, state.exQ * 1e6); if (!cfg){ toast('H.264 encoding not available here; recording live instead'); return startRecording(); }
  state.exporting = true; lockUI(true); $('#export').disabled = true; const badge = $('#badge'); badge.hidden = false; badge.classList.add('rec'); badge.textContent = 'Preparing…';
  const prevW = W, prevH = H, prevOffset = offset; let blob = null; $('#exNote').textContent = 'Rendering ' + exW + '×' + exH + ' at ' + fps + ' fps. The preview shows each frame as it is encoded.';
  try {
    const audioP = encodeAudio(ra, rb - ra);
    resizeAll(exW, exH); buildScore();
    for (let k = Math.min(12, Math.round(ra * fps)); k > 0; k--) renderAt(ra - k / fps); // pre-roll primes trails and feedback
    const samples = []; let avcC = null, err = null, encBytes = 0, restarts = 0;
    const onChunk = (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC){ const d = meta.decoderConfig.description; avcC = new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)); } const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); encBytes += d.length; samples.push({data: d, key: chunk.type === 'key'}); };
    const mkEnc = soft => { const c2 = Object.assign({}, cfg, soft ? {hardwareAcceleration: 'prefer-software'} : {}); const e2 = new VideoEncoder({output: onChunk, error: e => { err = err || e; }}); e2.configure(c2); return e2; };
    let enc = mkEnc(false);
    const t0 = performance.now();
    for (let i = 0; i < n; i++){
      renderAt(ra + i / fps);
      const vf = new VideoFrame(glc, {timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps)});
      let key = i % (fps * 2) === 0;
      if (err || enc.state === 'closed'){ // the encoder died mid-run: restart it (software) on a keyframe and keep going
        const why = String((err && err.message) || err || 'closed'); err = null; restarts++;
        if (restarts > 3){ vf.close(); throw new Error('the video encoder kept failing: ' + why); }
        try { enc.close(); } catch(e2){}
        enc = mkEnc(true); key = true; badge.textContent = 'Encoder hiccup — restarted, continuing (' + why.slice(0, 48) + ')';
      }
      try { enc.encode(vf, {keyFrame: key}); }
      catch(e1){ restarts++; if (restarts > 3){ vf.close(); throw e1; } err = null; try { enc.close(); } catch(e2){} enc = mkEnc(true); enc.encode(vf, {keyFrame: true}); }
      vf.close();
      if (encBytes > 15e8) throw new Error('this export passed 1.5 GB of video: use a shorter region, 30 fps, or a lower quality');
      if (i % 4 === 0){ const el = (performance.now() - t0) / 1000, eta = el / (i + 1) * (n - i - 1); badge.textContent = 'Rendering ' + (i + 1) + ' / ' + n + '  ·  ' + Math.round(eta) + ' s left'; $('#head').style.left = ((ra + i / fps) / state.dur * 100) + '%'; }
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (i % 600 === 599) await enc.flush(); // periodic drain keeps long hardware encodes from souring
      if (i % 2 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    badge.textContent = 'Encoding…'; await enc.flush(); enc.close(); const audio = await audioP;
    if (!avcC) throw new Error('encoder gave no stream header');
    badge.textContent = 'Writing file…'; blob = mp4Mux({w: exW, h: exH, fps, avcC, samples}, audio);
  } catch(e){ console.error(e); toast('Export failed: ' + (e.message || e)); }
  resizeAll(prevW, prevH); buildScore(); offset = prevOffset; frame();
  badge.hidden = true; badge.classList.remove('rec'); $('#export').disabled = false; state.exporting = false; lockUI(false);
  if (blob){ const name = 'reel-' + state.preset + '-' + state.seed + '-' + exW + 'p' + (rb - ra < state.dur - .05 ? '-' + ra.toFixed(1) + '-' + rb.toFixed(1) + 's' : '') + '.mp4'; showResult(blob, name, 'mp4'); await saveBlob(name, blob); }
}
/* =========================================================
   9. UI
   ========================================================= */
function renderPresets(){ const box = $('#presets'); box.innerHTML = '';
  for (const k of [...STYLE_KEYS, 'chaos']){ const Pz = PRESETS[k], p = PAL[Pz.sw]; const b = document.createElement('button'); b.className = 'preset'; b.setAttribute('aria-pressed', String(state.preset === k));
    b.innerHTML = '<span class="sw" style="background:linear-gradient(90deg,' + p.join(',') + ')"></span><span class="tx"><span class="nm">' + Pz.name + (Pz.fx ? ' <small style="font:600 9px var(--mono);color:var(--cyan);letter-spacing:.08em">FX</small>' : '') + '</span></span>';
    b.onclick = () => { state.preset = k; state.flkPattern = (Pz.flk) || 'burst'; applyPreset(k === 'chaos' ? 'overdrive' : k); $('#flkPat') && ($('#flkPat').value = state.flkPattern); renderPresets(); rebuild(); }; box.append(b); } }
$('#fontSet').onchange = e => { state.fontSet = e.target.value; rebuild(); };
function renderGroups(){
  const box = $('#groups'); const openState = {}; box.querySelectorAll('details').forEach(d => openState[d.dataset.g] = d.open); box.innerHTML = '';
  for (const g of GROUP_ORDER){ const d = document.createElement('details'); d.className = 'sec'; d.dataset.g = g; d.open = openState[g] !== undefined ? openState[g] : (g === 'Cutting' || g === 'Flicker');
    const sum = document.createElement('summary'); sum.innerHTML = '<h2>' + g + '</h2>'; d.append(sum);
    const head = document.createElement('div'); head.className = 'mhead'; head.innerHTML = '<span>dial</span><span>base</span><span>source</span><span>depth</span>'; d.append(head);
    const list = document.createElement('div'); list.className = 'mods';
    if (g === 'Flicker'){ const row = document.createElement('div'); row.className = 'mod'; row.innerHTML = '<span class="nm">Pattern<small>on/off sequence</small></span>'; const sel = document.createElement('select'); sel.id = 'flkPat'; sel.style.gridColumn = '2 / span 3';
      for (const k in FLK_PATTERNS){ const o = document.createElement('option'); o.value = k; o.textContent = k + '  ' + FLK_PATTERNS[k].join(''); sel.append(o); } sel.value = state.flkPattern; sel.onchange = () => { state.flkPattern = sel.value; if (!playing) frame(); }; row.append(sel); list.append(row); }
    for (const p of PARAMS.filter(q => q[1] === g)){ const id = p[0], st = P[id]; const row = document.createElement('div'); row.className = 'mod';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.title = p[8]; nm.innerHTML = p[2] + (p[8] ? '<small>' + p[8] + '</small>' : ''); row.append(nm);
      const base = document.createElement('input'); base.type = 'range'; base.min = p[3]; base.max = p[4]; base.step = (p[4] - p[3]) > 10 ? 1 : .01; base.value = st.base; base.id = 'b_' + id; base.setAttribute('aria-label', p[2] + ' base');
      base.oninput = () => { st.base = +base.value; valEl.textContent = fmtVal(st); }; base.onchange = () => rebuildIf(id); row.append(base);
      const sel = document.createElement('select'); sel.id = 's_' + id; sel.setAttribute('aria-label', p[2] + ' source'); SIGNALS.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.append(o); }); sel.value = st.src; sel.onchange = () => { st.src = sel.value; rebuildIf(id); }; row.append(sel);
      const dp = document.createElement('input'); dp.type = 'range'; dp.className = 'dp'; dp.min = -1; dp.max = 1; dp.step = .05; dp.value = st.depth; dp.id = 'd_' + id; dp.setAttribute('aria-label', p[2] + ' depth'); dp.oninput = () => { st.depth = +dp.value; valEl.textContent = fmtVal(st); }; dp.onchange = () => rebuildIf(id); row.append(dp);
      const valEl = document.createElement('span'); valEl.className = 'val'; valEl.textContent = fmtVal(st); valEl.style.gridColumn = '2 / span 3'; row.append(valEl);
      list.append(row); }
    d.append(list); box.append(d); }
}
const fmtVal = st => (+st.base).toFixed(2).replace(/\.?0+$/, '') + (st.src !== 'const' && st.depth ? ' ' + (st.depth > 0 ? '+' : '') + st.depth.toFixed(2) + '×' + st.src : '');
const SEQ_IDS = new Set(['cutRate','clipWeight','clipHold','flashCuts','minHold','collage','overlap','clones','motifs','invertFlk','whiteFlash','blackBlink','strobe','wordRate','lookSwap']);
function rebuildIf(id){ if (SEQ_IDS.has(id)) rebuild(); else if (!playing) frame(); }
function renderThumbs(){ const box = $('#thumbs'); box.innerHTML = '';
  state.media.forEach((m, i) => { const d = document.createElement('div'); d.className = 'thumb'; d.style.backgroundImage = 'url(' + m.thumb + ')'; const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove');
    x.onclick = () => { const [gone] = state.media.splice(i, 1); if (gone && gone.key) IDB.del('media', gone.key); renderThumbs(); rebuild(); }; d.append(x); if (m.type === 'clip'){ const v = document.createElement('span'); v.className = 'v'; v.textContent = m.kind === 'gif' ? 'GIF ' + m.frames.length : 'CLIP ' + (m.bursts || 1) + '×' + (m.burst || m.frames.length); d.append(v); } box.append(d); });
  (state.failed || []).forEach(F => { const d = document.createElement('div'); d.className = 'thumb bad'; d.title = F.name + ' — did not load';
    const lab = document.createElement('span'); lab.className = 'v'; lab.textContent = F.name.slice(0, 14); d.append(lab);
    const rt = document.createElement('button'); rt.className = 'x rt'; rt.textContent = '↻'; rt.setAttribute('aria-label', 'Retry ' + F.name);
    rt.onclick = async () => { rt.textContent = '…'; const gen = state.libGen;
      try { const rows = await IDB.all('media') || []; const row = rows.find(r => r.key === F.key);
        if (!row) throw new Error('gone');
        const m = await loadOne(new File([row.val.blob], row.val.name, {type: row.val.type})); m.key = F.key;
        if (gen !== state.libGen) return;
        state.media.push(m); state.failed = state.failed.filter(z => z.key !== F.key); renderThumbs(); rebuild(); toast(F.name + ' loaded'); }
      catch(e){ rt.textContent = '↻'; toast(F.name + ' still will not decode'); } };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Delete ' + F.name);
    x.onclick = () => { state.failed = state.failed.filter(z => z.key !== F.key); IDB.del('media', F.key); renderThumbs(); };
    d.append(rt, x); box.append(d); });
  const nf = (state.failed || []).length;
  $('#mediaCount').textContent = (state.media.length ? state.media.length + ' item' + (state.media.length > 1 ? 's' : '') : 'none') + (nf ? ' · ' + nf + ' not loaded' : '');
  $('#sampleNote').hidden = !state.media.some(m => m.sample); }

/* ---- local library: footage and song persist across reloads (IndexedDB holds the files themselves) ---- */
const IDB = {
  _db: null,
  open(){ if (this._db) return this._db; // one connection, reused: a new one per call leaked handles until writes started failing
    this._db = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('no idb')); const q = indexedDB.open('glitch-reel-machine', 1);   // storage name kept from the old project name: renaming it would orphan saved footage and songs
      q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains('media')) d.createObjectStore('media'); if (!d.objectStoreNames.contains('song')) d.createObjectStore('song'); };
      q.onsuccess = () => { q.result.onclose = () => { IDB._db = null; }; res(q.result); }; q.onerror = () => { IDB._db = null; rej(q.error); }; });
    return this._db; },
  async tx(store, mode, fn){ try { const d = await this.open(); return await new Promise((res, rej) => { const tx = d.transaction(store, mode); const out = fn(tx.objectStore(store)); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error); }); } catch(e){ console.warn('library', e); return null; } },
  async txStrict(store, mode, fn){ const d = await this.open(); return await new Promise((res, rej) => { const tx = d.transaction(store, mode); const out = fn(tx.objectStore(store)); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); }); },
  put(store, key, val){ return this.tx(store, 'readwrite', os => os.put(val, key)); },
  del(store, key){ return this.tx(store, 'readwrite', os => os.delete(key)); },
  clear(store){ return this.tx(store, 'readwrite', os => os.clear()); },
  async all(store){ const rows = []; await this.tx(store, 'readonly', os => { const c = os.openCursor(); c.onsuccess = () => { const cur = c.result; if (cur){ rows.push({key: cur.key, val: cur.value}); cur.continue(); } }; }); return rows; },
};
async function loadOne(f){ if (/gif/i.test(f.type) || /\.gif$/i.test(f.name)) return addGIF(f); if (f.type.startsWith('video') || /\.(mp4|mov|webm)$/i.test(f.name)) return addVideo(f); return addImage(await createImageBitmap(f), f.name); }
async function addFiles(files){ if (state.exporting){ toast('Export in progress — drop files after it finishes'); return; }
  const list = [...files].filter(f => /^(image|video)\//.test(f.type) || /\.(gif|mp4|mov|webm|png|jpe?g|webp)$/i.test(f.name)); if (!list.length) return;
  if (state.media.some(m => m.sample)) state.media = state.media.filter(m => !m.sample);
  toast('Reading ' + list.length + ' file' + (list.length > 1 ? 's' : '') + '…');
  const gen = state.libGen;
  let n = 0; for (const f of list){
    try { const m = await loadOne(f);
      if (gen !== state.libGen) return; // footage was cleared while this import was running: drop it, do not resurrect it
      m.key = Date.now() + '-' + (n++) + '-' + f.name; state.media.push(m);
      await IDB.put('media', m.key, {name: f.name, type: f.type, blob: f, order: Date.now() + n}); }
    catch(e){ console.warn(e); toast('Skipped ' + f.name + ': the browser could not read it'); }
    if (gen !== state.libGen) return;
    renderThumbs(); }
  rebuild();
}
function rebuild(){ if (state.exporting) return; buildScore(); if (!playing) frame(); }
// while an export renders, every control is locked: the file is made from the settings at the moment Export was pressed
function lockUI(on){ const fm = $('#aspect'); if (fm) fm.disabled = on; ['#visualRack', '#audioRack', '#exportSettings'].forEach(sel => { const el = $(sel); if (!el) return; if (on){ el.setAttribute('inert', ''); el.classList.add('locked'); } else { el.removeAttribute('inert'); el.classList.remove('locked'); } }); }
async function rebuildAll(){ const was = playing; pause(); await rebuildAudio(); offset = Math.min(offset, state.dur - .01); buildScore(); if (was) play(); else frame(); }

$('#mediaIn').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('#clearMedia').onclick = async () => {
  state.libGen++; state.media = []; state.failed = []; renderThumbs();
  let left = -1;
  try { await IDB.txStrict('media', 'readwrite', os => os.clear());
    left = await new Promise(async r => { const d = await IDB.open(); const q = d.transaction('media', 'readonly').objectStore('media').count(); q.onsuccess = () => r(q.result); q.onerror = () => r(-1); });
  } catch(e){ console.warn('clear', e); }
  if (left > 0){ toast('Could not clear the library — ' + left + ' left. Close other tabs of this app and try again.'); return; }
  await loadSamples(); renderThumbs(); rebuild();
  toast(left === 0 ? 'Footage cleared; samples loaded' : 'Footage cleared from this session');
};
[$('#drop'), $('#screen')].forEach(el => { el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag'); }); el.addEventListener('dragleave', () => el.classList.remove('drag')); el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag'); addFiles(e.dataTransfer.files); }); });
$('#clipFrames').oninput = e => { state.clipFrames = +e.target.value; $('#cfOut').textContent = e.target.value; };
$('#play').onclick = () => { if (recording) return; playing ? pause() : play(); };
// full screen preview with its own play / seek bar
{ const scr = $('#screen'); let idleT = 0;
  const wake = () => { scr.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (playing) scr.classList.add('idle'); }, 2200); };
  const toggleFS = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (scr.requestFullscreen) scr.requestFullscreen().then(wake).catch(() => toast('Full screen is not allowed here')); };
  $('#fullscreen').onclick = toggleFS; $('#fsExit').onclick = e => { e.stopPropagation(); toggleFS(); };
  $('#fsPlay').onclick = e => { e.stopPropagation(); $('#play').click(); wake(); };
  scr.addEventListener('mousemove', wake); scr.addEventListener('dblclick', toggleFS);
  scr.addEventListener('click', e => { if (document.fullscreenElement && e.target.tagName === 'CANVAS'){ $('#play').click(); wake(); } });
  const fsSeek = $('#fsSeek'); let dragging = false; const seekAt = e => { const r = fsSeek.getBoundingClientRect(); seek(clamp((e.clientX - r.left) / r.width, 0, 1) * state.dur); };
  fsSeek.addEventListener('pointerdown', e => { e.stopPropagation(); dragging = true; fsSeek.setPointerCapture(e.pointerId); seekAt(e); wake(); });
  fsSeek.addEventListener('pointermove', e => { if (dragging) seekAt(e); }); fsSeek.addEventListener('pointerup', () => { dragging = false; });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) scr.classList.remove('idle'); frame(); });
  document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !state.exporting) toggleFS(); }); }
$('#reroll').onclick = () => { state.seed = 1 + Math.floor(Math.random() * 999998); $('#seed').value = state.seed; rebuild(); };
$('#seed').onchange = e => { state.seed = clamp(parseInt(e.target.value) || 1, 1, 999999); rebuild(); };
$('#react').oninput = e => { state.react = +e.target.value; $('#reactOut').textContent = state.react.toFixed(1); }; $('#react').onchange = rebuild;
$('#clarity').oninput = e => { state.clarity = +e.target.value; $('#clarOut').textContent = state.clarity.toFixed(2).replace(/0$/, ''); }; $('#clarity').onchange = () => { if (!playing) frame(); };
$('#intensity').oninput = e => { state.intensity = +e.target.value; $('#intOut').textContent = state.intensity.toFixed(1); }; $('#intensity').onchange = rebuild;
$('#randDials').onclick = () => { randomizeDials(); rebuild(); }; $('#resetDials').onclick = () => { applyPreset(state.preset === 'chaos' ? 'overdrive' : state.preset); rebuild(); };
$('#length').onchange = e => { const v = +e.target.value; $('#lenCustom').hidden = v !== -1; state.lengthSel = v === -1 ? state.lenCustom : v; setRegion(null, null); rebuildAll(); };
$('#lenCustom').onchange = e => { state.lenCustom = clamp(+e.target.value || 20, 3, 600); e.target.value = state.lenCustom; state.lengthSel = state.lenCustom; setRegion(null, null); rebuildAll(); };
$('#fps').onchange = e => { state.fps = +e.target.value; rebuild(); };
$('#exSize').onchange = e => { state.exSize = +e.target.value; };
$('#pvSize').onchange = e => { if (state.exporting) return; state.pvSize = +e.target.value; const [w, h] = dimsFor(state.pvSize); resizeAll(w, h); rebuild(); };
function setAspect(a){ if (state.exporting || !ASPECTS[a]) return; state.aspect = a; const [x, y] = ASPECTS[a], ar = x / y; const [w, h] = dimsFor(state.pvSize || 720); resizeAll(w, h);
  document.documentElement.style.setProperty('--ar', ar); document.documentElement.style.setProperty('--arc', x + ' / ' + y); document.documentElement.style.setProperty('--sw', a === 'portrait' ? '520px' : '100%');
  const sel = $('#aspect'); if (sel) sel.value = a; const lab = (sh) => { const [ww, hh] = dimsFor(sh); return ww + ' × ' + hh; };
  [['#pvSize', [540, 720]], ['#exSize', [720, 1080]]].forEach(([id, vals]) => { const el = $(id); if (el) [...el.options].forEach((o, i) => { o.textContent = lab(vals[i]) + (id === '#pvSize' && i === 0 ? ' (fast)' : ''); }); });
  if (state.score) rebuild(); }
$('#aspect').onchange = e => { setAspect(e.target.value); autosave(); }; $('#exQ').onchange = e => { state.exQ = +e.target.value; };
let lyrT; $('#lyrics').oninput = () => { clearTimeout(lyrT); lyrT = setTimeout(rebuild, 350); };
$('#bpm').oninput = e => { $('#bpmOut').textContent = e.target.value; }; $('#bpm').onchange = e => { state.bpm = +e.target.value; rebuildAll(); };
$('#newBeat').onclick = () => { state.beatSeed = 1 + Math.floor(Math.random() * 9999); rebuildAll(); };
const setSrc = s => { state.src = s; $('#srcBeat').setAttribute('aria-pressed', String(s === 'beat')); $('#srcSong').setAttribute('aria-pressed', String(s === 'song')); $('#beatBox').hidden = s !== 'beat'; $('#songBox').hidden = s !== 'song'; $('#soundName').textContent = s === 'beat' ? 'Built-in beat' : (state.songName || 'No song yet'); };
$('#srcBeat').onclick = () => { setSrc('beat'); rebuildAll(); }; $('#srcSong').onclick = () => { setSrc('song'); if (state.songBuffer) rebuildAll(); };
$('#songIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; IDB.put('song', 'current', {name: f.name, type: f.type, blob: f}); await loadSongFile(f); };
async function loadSongFile(f){ if (state.exporting){ toast('Export in progress — drop files after it finishes'); return; }
  try { ensureAC(); toast('Decoding…'); const buf = await AC.decodeAudioData(await f.arrayBuffer()); state.songBuffer = buf; state.songName = f.name.replace(/\.[^.]+$/, ''); state.songStart = 0; state.bpmMul = 1;
    const badge = $('#badge'); badge.hidden = false; badge.textContent = 'Analyzing 0%'; state.songAn = await analyzeBuffer(buf, p => badge.textContent = 'Analyzing ' + Math.round(p * 100) + '%'); badge.hidden = true;
    $('#songStart').max = Math.max(0, Math.floor(buf.duration - 3)); $('#songStart').value = 0; $('#startNum').value = '0.0'; $('#startOut').textContent = '0:00'; renderDropBtns(); $('#startWrap').hidden = false; $('#tempoFix').hidden = false; $('#toDrop').hidden = !state.songAn.dropTimes.length;
    setSrc('song'); offset = 0; await rebuildAll(); toast('Analyzed: ' + Math.round(state.songAn.bpm) + ' BPM, ' + state.songAn.dropTimes.length + ' drop' + (state.songAn.dropTimes.length === 1 ? '' : 's') + ' found');
  } catch(err){ console.warn(err); $('#badge').hidden = true; toast('Could not read that file. Try an mp3, wav or m4a.'); } }
function setSongStart(v){ if (!state.songBuffer) return; const max = Math.max(0, state.songBuffer.duration - 3); state.songStart = clamp(+(+v).toFixed(2), 0, max); $('#songStart').value = state.songStart; $('#startNum').value = state.songStart.toFixed(1); $('#startOut').textContent = fmt(state.songStart); offset = 0; setRegion(null, null); rebuildAll(); }
$('#songStart').oninput = e => { $('#startOut').textContent = fmt(+e.target.value); $('#startNum').value = (+e.target.value).toFixed(1); }; $('#songStart').onchange = e => setSongStart(e.target.value);
$('#startNum').onchange = e => setSongStart(e.target.value);
document.querySelectorAll('[data-nudge]').forEach(b => b.onclick = () => { const n = b.dataset.nudge, per = 60 / ((state.songAn ? state.songAn.bpm : state.bpm) * state.bpmMul); setSongStart(state.songStart + (n === 'beat' ? per : n === '-beat' ? -per : +n)); });
function renderDropBtns(){ const box = $('#dropBtns'); box.innerHTML = ''; const D = (state.songAn && state.songAn.dropTimes) || []; D.slice(0, 6).forEach((d, i) => { const b = document.createElement('button'); b.className = 'btn ghost sm'; b.textContent = 'Drop ' + (i + 1) + ' @ ' + fmt0(d) + ' (start 8 s before)'; b.onclick = () => setSongStart(Math.max(0, d - 8)); box.append(b); }); }
$('#half').onclick = () => { state.bpmMul /= 2; rebuildAll(); }; $('#double').onclick = () => { state.bpmMul *= 2; rebuildAll(); };
$('#toDrop').onclick = () => { const d = state.songAn.dropTimes[0]; setSongStart(Math.max(0, d - 8)); };
$('#export').onclick = () => exportVideo();
$('#still').onclick = () => { renderAt(now()); glc.toBlob(b => b && saveBlob('frame-' + state.seed + '-' + now().toFixed(1) + 's.png', b), 'image/png'); };
const strip = $('#strip'); let scrubbing = false, marking = null; const tAt = e => { const r = strip.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * state.dur; }; const scrubTo = e => seek(tAt(e));
strip.addEventListener('pointerdown', e => { if (recording || state.exporting) return; strip.setPointerCapture(e.pointerId); if (e.shiftKey){ marking = tAt(e); setRegion(marking, marking); } else { scrubbing = true; scrubTo(e); } });
strip.addEventListener('pointermove', e => { if (marking !== null){ const t = tAt(e); setRegion(Math.min(marking, t), Math.max(marking, t), true); } else if (scrubbing) scrubTo(e); });
strip.addEventListener('pointerup', () => { if (marking !== null){ marking = null; const [a, b] = region(); if (b - a < .15) setRegion(null, null); else seek(a); } scrubbing = false; });
function setRegion(a, b, live){ state.rIn = a === null ? null : +(+a).toFixed(2); state.rOut = b === null ? null : +(+b).toFixed(2); if (state.rIn !== null && state.rOut !== null && state.rOut < state.rIn){ const x = state.rIn; state.rIn = state.rOut; state.rOut = x; } drawRegion(); }
function drawRegion(){ const has = state.rIn !== null || state.rOut !== null, [a, b] = region(), real = has && b - a < state.dur - .05;
  $('#shadeL').style.width = real ? (a / state.dur * 100) + '%' : '0'; $('#shadeR').style.width = real ? ((state.dur - b) / state.dur * 100) + '%' : '0';
  $('#shadeL').style.borderRightWidth = real ? '2px' : '0'; $('#shadeR').style.borderLeftWidth = real ? '2px' : '0';
  if (document.activeElement !== $('#rIn')) $('#rIn').value = real ? a.toFixed(1) : ''; if (document.activeElement !== $('#rOut')) $('#rOut').value = real ? b.toFixed(1) : '';
  $('#regionInfo').textContent = real ? (b - a).toFixed(1) + ' s · ' + Math.round((b - a) * state.fps) + ' frames' : 'whole reel'; }
$('#setIn').onclick = () => { const t = now(); setRegion(t, state.rOut === null || state.rOut <= t ? state.dur : state.rOut); };
$('#setOut').onclick = () => { const t = now(); setRegion(state.rIn === null || state.rIn >= t ? 0 : state.rIn, t); };
$('#clearRegion').onclick = () => setRegion(null, null);
$('#dropGate').onchange = e => { state.dropGate = e.target.checked; rebuild(); };
$('#preDrop').onchange = e => { state.preDrop = e.target.checked; rebuild(); };
/* ---- timed lyrics ---- */
function lyricLines(){ return $('#lyrics').value.split(/\n/).map(l => l.trim()).filter(Boolean); }
function syncCues(){ // keep timings for lines that still exist (matched by text, then by position)
  const lines = lyricLines(), old = state.cues.slice(); const used = new Set();
  state.cues = lines.map((text, i) => { let m = old.findIndex((q, j) => !used.has(j) && q.text === text); if (m < 0 && old[i] && !used.has(i) && old[i].text !== text && old.filter(q => q.text === old[i].text).length === 1) m = -1; if (m >= 0){ used.add(m); return {text, t: old[m].t}; } return {text, t: null}; });
  state.tapIdx = Math.min(state.tapIdx, state.cues.length); renderCues(); }
function setWordMode(m){ state.wordMode = m; $('#wmRandom').setAttribute('aria-pressed', m === 'random'); $('#wmLyrics').setAttribute('aria-pressed', m === 'lyrics'); $('#lyricBox').hidden = m !== 'lyrics'; if (m === 'lyrics') syncCues(); rebuild(); }
// master switch: off = no words anywhere (word hits, timed lyrics, type wall, word pattern fills), in every style
function setWordsOn(on){ state.wordsOn = !!on; const b = $('#wordsOn'); if (b){ b.setAttribute('aria-pressed', state.wordsOn); b.textContent = state.wordsOn ? 'Words: ON' : 'Words: OFF'; } const box = $('#wordsBody'); if (box) box.classList.toggle('off', !state.wordsOn); }
$('#wordsOn').onclick = () => { setWordsOn(!state.wordsOn); rebuild(); autosave(); };
$('#wmRandom').onclick = () => setWordMode('random'); $('#wmLyrics').onclick = () => setWordMode('lyrics');
$('#lyrics').addEventListener('input', () => { if (state.wordMode === 'lyrics') syncCues(); });
function renderCues(){ const box = $('#lyCues'); if (!box) return; box.innerHTML = '';
  state.cues.forEach((q, i) => { const d = document.createElement('div'); d.className = 'cue' + (q.t === null ? ' unset' : '') + (i === state.tapIdx ? ' next' : '');
    const tin = document.createElement('input'); tin.className = 'num'; tin.type = 'number'; tin.step = '0.05'; tin.min = '0'; tin.placeholder = '–'; tin.value = q.t === null ? '' : q.t.toFixed(2); tin.setAttribute('aria-label', 'Time for line ' + (i + 1));
    tin.onchange = () => { q.t = tin.value === '' ? null : clamp(+tin.value, 0, state.dur); renderCues(); rebuild(); };
    const mk = (txt, title, fn) => { const b = document.createElement('button'); b.className = 'btn sm ghost'; b.textContent = txt; b.title = title; b.onclick = fn; return b; };
    const back = mk('◀', '−¼ s', () => { q.t = Math.max(0, (q.t === null ? now() : q.t) - .25); renderCues(); rebuild(); });
    const fwd = mk('▶', '+¼ s', () => { q.t = Math.min(state.dur, (q.t === null ? now() : q.t) + .25); renderCues(); rebuild(); });
    const here = mk('●', 'Set to playhead', () => { q.t = +now().toFixed(2); state.tapIdx = i + 1; renderCues(); rebuild(); });
    const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = (i + 1) + '. ' + q.text; txt.title = q.text; txt.onclick = () => { if (q.t !== null) seek(q.t + state.lyOff); };
    d.append(tin, back, fwd, here, txt); box.append(d); });
  const nx = box.querySelector('.cue.next'); if (nx) nx.scrollIntoView({block: 'nearest'}); }
function tapLyric(){ if (state.wordMode !== 'lyrics' || !state.cues.length) return; if (state.tapIdx >= state.cues.length) state.tapIdx = 0; state.cues[state.tapIdx].t = +now().toFixed(2); state.tapIdx++; renderCues(); rebuild(); toast('Line ' + state.tapIdx + ' @ ' + fmt(now())); }
$('#lySpread').onclick = () => { if (!state.cues.length) syncCues(); const n = state.cues.length; if (!n) return; const a = $('#lyFrom').value === '' ? 0 : clamp(+$('#lyFrom').value, 0, state.dur), b = $('#lyTo').value === '' ? state.dur : clamp(+$('#lyTo').value, 0, state.dur); const lo = Math.min(a, b), hi = Math.max(a, b);
  state.cues.forEach((q, i) => { let t = lo + (hi - lo) * i / n; const bt = state.grid && state.grid.beats; if (bt && bt.length){ let best = t, bd = 1e9; for (const x of bt){ const dd = Math.abs(x - t); if (dd < bd){ bd = dd; best = x; } } t = best; } q.t = +t.toFixed(2); }); state.tapIdx = 0; renderCues(); rebuild(); toast('Spread ' + n + ' lines ' + fmt(lo) + '–' + fmt(hi)); };
$('#lyReset').onclick = () => { state.cues.forEach(q => q.t = null); state.tapIdx = 0; renderCues(); rebuild(); };
$('#lyOff').oninput = e => { state.lyOff = +e.target.value; $('#lyOffOut').textContent = (state.lyOff >= 0 ? '+' : '') + state.lyOff.toFixed(2) + ' s'; }; $('#lyOff').onchange = () => rebuild();
$('#lyHow').onchange = e => { state.lyHow = e.target.value; rebuild(); };
$('#lyHold').oninput = e => { state.lyHold = +e.target.value; $('#lyHoldOut').textContent = state.lyHold.toFixed(1) + ' s'; }; $('#lyHold').onchange = () => rebuild();
$('#preCalm').oninput = e => { state.preCalm = +e.target.value; $('#preCalmOut').textContent = state.preCalm.toFixed(2); };
$('#preCalm').onchange = () => { if (!playing) frame(); };
$('#dropAt').onchange = e => { state.dropAt = e.target.value === '' ? null : clamp(+e.target.value, 0, state.dur); e.target.value = state.dropAt === null ? '' : state.dropAt; rebuild(); };
$('#dropNow').onclick = () => { state.dropAt = +now().toFixed(2); $('#dropAt').value = state.dropAt; rebuild(); };
$('#rIn').onchange = e => { const v = e.target.value === '' ? null : clamp(+e.target.value, 0, state.dur); setRegion(v, state.rOut === null && v !== null ? state.dur : state.rOut); };
$('#rOut').onchange = e => { const v = e.target.value === '' ? null : clamp(+e.target.value, 0, state.dur); setRegion(state.rIn === null && v !== null ? 0 : state.rIn, v); };
document.addEventListener('keydown', e => { if (state.exporting || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; const k = e.key.toLowerCase(); if (k === 'i') $('#setIn').click(); else if (k === 'o') $('#setOut').click(); else if (k === 'x') $('#clearRegion').click(); });
document.addEventListener('keydown', e => { if (state.exporting || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if (e.code === 'Space'){ e.preventDefault(); $('#play').click(); } if (e.key === 'r' || e.key === 'R') $('#reroll').click(); if (e.key === 'l' || e.key === 'L') tapLyric(); });


/* ---- recipes: the whole setup as a small JSON ---- */
function recipe(){ return {v: 2, app: 'maut-ki-machine', preset: state.preset, seed: state.seed, react: state.react, intensity: state.intensity, clarity: state.clarity, flkPattern: state.flkPattern, fontSet: state.fontSet, dropGate: state.dropGate, preDrop: state.preDrop, preCalm: state.preCalm, dropAt: state.dropAt, aspect: state.aspect, wordsOn: state.wordsOn, wordMode: state.wordMode, cues: state.cues, lyOff: state.lyOff, lyHow: state.lyHow, lyHold: state.lyHold,
  lengthSel: state.lengthSel, fps: state.fps, bpm: state.bpm, beatSeed: state.beatSeed, words: $('#lyrics').value, dials: JSON.parse(JSON.stringify(P))}; }
function applyRecipe(R){
  if (!R || !R.dials) throw new Error('not a recipe');
  if (PRESETS[R.preset]) state.preset = R.preset; state.seed = +R.seed || state.seed; state.react = +R.react || 1; state.intensity = +R.intensity || 1; state.clarity = R.clarity === undefined ? .5 : +R.clarity;
  state.flkPattern = FLK_PATTERNS[R.flkPattern] ? R.flkPattern : state.flkPattern; state.fontSet = FONT_SETS[R.fontSet] !== undefined ? R.fontSet : 'auto'; if (R.lengthSel !== undefined) state.lengthSel = +R.lengthSel; if (R.fps) state.fps = +R.fps;
  if (R.bpm) state.bpm = +R.bpm; if (R.beatSeed) state.beatSeed = +R.beatSeed; if (typeof R.words === 'string') $('#lyrics').value = R.words;
  state.dropGate = !!R.dropGate; const dg = $('#dropGate'); if (dg) dg.checked = state.dropGate;
  if (Array.isArray(R.cues)) state.cues = R.cues.map(q => ({text: String(q.text || ''), t: q.t === null || q.t === undefined ? null : +q.t})); state.lyOff = +R.lyOff || 0; state.lyHow = R.lyHow === 'line' ? 'line' : 'word'; state.lyHold = R.lyHold ? clamp(+R.lyHold, 1, 10) : 4;
  { const o = $('#lyOff'); if (o){ o.value = state.lyOff; o.oninput({target: o}); } const hw = $('#lyHow'); if (hw) hw.value = state.lyHow; const hd = $('#lyHold'); if (hd){ hd.value = state.lyHold; hd.oninput({target: hd}); } }
  setWordsOn(R.wordsOn === true); if (ASPECTS[R.aspect] && R.aspect !== state.aspect) setAspect(R.aspect);
  if (R.wordMode === 'lyrics' || R.wordMode === 'random') setWordMode(R.wordMode); else renderCues();
  state.preDrop = !!R.preDrop; state.preCalm = R.preCalm === undefined ? .7 : clamp(+R.preCalm || 0, 0, 1); state.dropAt = (R.dropAt === undefined || R.dropAt === null) ? null : Math.max(0, +R.dropAt || 0);
  { const a = $('#preDrop'); if (a) a.checked = state.preDrop; const c = $('#preCalm'); if (c){ c.value = state.preCalm; $('#preCalmOut').textContent = state.preCalm.toFixed(2); } const d = $('#dropAt'); if (d) d.value = state.dropAt === null ? '' : state.dropAt; }
  for (const id in R.dials){ if (P[id] && typeof R.dials[id] === 'object'){ const d = R.dials[id]; P[id] = {base: +d.base || 0, src: SIGNALS.includes(d.src) ? d.src : 'const', depth: +d.depth || 0}; } }
  $('#seed').value = state.seed; $('#react').value = state.react; $('#reactOut').textContent = state.react.toFixed(1); $('#intensity').value = state.intensity; $('#intOut').textContent = state.intensity.toFixed(1); $('#clarity').value = state.clarity; $('#clarOut').textContent = state.clarity.toFixed(2).replace(/0$/, '');
  { const opt = [...$('#length').options].some(o => +o.value === state.lengthSel); $('#length').value = opt ? String(state.lengthSel) : '-1'; $('#lenCustom').hidden = opt; if (!opt){ state.lenCustom = state.lengthSel; $('#lenCustom').value = state.lengthSel; } } $('#fps').value = String(state.fps); $('#fontSet').value = state.fontSet; $('#bpm').value = state.bpm; $('#bpmOut').textContent = state.bpm;
  renderPresets(); renderGroups(); $('#flkPat') && ($('#flkPat').value = state.flkPattern);
}
const recipeCode = () => btoa(unescape(encodeURIComponent(JSON.stringify(recipe())))).replace(/=+$/, '');
const decodeRecipe = s => { s = s.trim(); if (s.startsWith('{')) return JSON.parse(s); return JSON.parse(decodeURIComponent(escape(atob(s.replace(/\s+/g, ''))))); };
$('#recSave').onclick = () => { const name = 'recipe-' + state.preset + '-' + state.seed + '.json'; saveBlob(name, new Blob([JSON.stringify(recipe(), null, 1)], {type: 'application/json'})); };
$('#recLoad').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { applyRecipe(JSON.parse(await f.text())); await rebuildAll(); toast('Recipe loaded: ' + f.name); } catch(err){ toast('That file is not a recipe'); } };
$('#recCopy').onclick = async () => { const code = recipeCode(); $('#recCode').value = code; try { await navigator.clipboard.writeText(code); toast('Recipe code copied'); } catch(e){ $('#recCode').select(); toast('Copy the code from the box'); } };
$('#recApply').onclick = async () => { try { applyRecipe(decodeRecipe($('#recCode').value)); await rebuildAll(); toast('Recipe applied'); } catch(e){ toast('Could not read that code'); } };
function autosave(){ try { localStorage.setItem('grm.last', JSON.stringify(recipe())); } catch(e){} }
setInterval(autosave, 4000);
$('#recRestore').onclick = async () => { try { const s = localStorage.getItem('grm.last'); if (!s) return toast('Nothing saved in this browser yet'); applyRecipe(JSON.parse(s)); await rebuildAll(); toast('Last session restored'); } catch(e){ toast('Could not restore'); } };

/* boot */
async function loadSamples(){ for (const [name, url] of SAMPLES){ try { if (url.startsWith('data:image/gif')){ const blob = await (await fetch(url)).blob(); state.media.push(await addGIF(new File([blob], name, {type: 'image/gif'}), true)); } else { const img = new Image(); img.src = url; await img.decode(); state.media.push(await addImage(img, name, true)); } } catch(e){ console.warn('sample', name, e); } } }
async function boot(){
  if (!gl) return; try { initGL(); } catch(e){ $('#badge').hidden = false; $('#badge').textContent = 'Shader error'; console.error(e); return; }
  applyPreset('overdrive'); state.flkPattern = 'burst'; renderPresets();
  { const g = gpuName(), el = $('#gpuName'); el.textContent = g; const integrated = /Intel|UHD|Iris|Radeon\(TM\) Graphics|Vega \d\b/i.test(g) && !/NVIDIA|GeForce|RTX|GTX|Radeon RX/i.test(g); $('#gpuHint').hidden = !integrated; }
  try { await Promise.race([Promise.all(FONT_PRELOAD.map(f => document.fonts.load(f).catch(() => {}))), new Promise(r => setTimeout(r, 3000))]); } catch(e){}
  // restore the user's own library first; samples only when it is empty
  let restored = 0; try { const rows = (await IDB.all('media')) || []; rows.sort((a, b) => (a.val.order || 0) - (b.val.order || 0));
    if (rows.length){ $('#badge').hidden = false; $('#badge').textContent = 'Loading your footage… 0/' + rows.length; }
    let n = 0, slow = 0;
    for (const {key, val} of rows){ $('#badge').textContent = 'Loading your footage… ' + (++n) + '/' + rows.length + ' · ' + val.name;
      try { const f = new File([val.blob], val.name, {type: val.type});
        // hard cap per file: a clip that will not decode cannot hold up the whole app
        const m = await Promise.race([loadOne(f), new Promise((_, rj) => setTimeout(() => rj(new Error('SLOW')), 30000))]);
        m.key = key; state.media.push(m); restored++; }
      catch(e){ // never delete the user's footage here: a file that would not decode this time is kept and shown as retryable
        slow++; console.warn('restore failed, keeping the file:', val.name, e); state.failed.push({key, name: val.name}); } }
    if (slow) setTimeout(() => toast(slow + ' file' + (slow > 1 ? 's' : '') + ' did not load — still in your library, tap ↻ to retry'), 1200); } catch(e){ console.warn(e); }
  if (!restored) await loadSamples();
  renderThumbs();
  try { const saved = localStorage.getItem('grm.last'); if (saved) applyRecipe(JSON.parse(saved)); } catch(e){}
  let songRow = null; try { const rows = (await IDB.all('song')) || []; songRow = rows.length ? rows[0].val : null; } catch(e){}
  if (songRow){ $('#badge').hidden = true; await loadSongFile(new File([songRow.blob], songRow.name, {type: songRow.type})); }
  else { $('#badge').hidden = true; await rebuildAudio(); buildScore(); } offset = +(state.dur * .62).toFixed(2); frame(); requestAnimationFrame(loop);
  document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { patKey = -1; if (!playing) frame(); });
}
window.__reel = { state, P, renderAt, setAspect, dimsFor, __val: val, exportVideo, mp4Mux, resizeAll, buildScore, rebuildAudio, applyPreset, analyzeBuffer, decodeGIF, addFiles, set(o){ Object.assign(state, o); },
  wav(){ const b = state.buffer, sr = b.sampleRate, s0 = Math.floor(state.off * sr), n = Math.floor(state.dur * sr), ch = 2; const buf = new ArrayBuffer(44 + n * ch * 2), v = new DataView(buf), ws = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L; let o = 44; for (let i = 0; i < n; i++){ for (const C of [L, R]){ v.setInt16(o, clamp(C[s0 + i] || 0, -1, 1) * 32767, true); o += 2; } }
    let bin = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(bin); }, ready: null };
// the few app functions other panels need; app.js keeps everything else private
window.__app = {toast, saveBlob, loadSongFile, IDB};
window.__reel.ready = boot();
})();
