/* Machine Studio — app: state, audio engine, render worker, panels, undo, export, recording, session. */
(function () {
  'use strict';
  const D = window.MachineDSP, Mix = window.MachineMix;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const dbToLin = D.dbToLin, clone = o => JSON.parse(JSON.stringify(o));

  const S = {
    ctx: null, chain: null, lat: null,
    vocal: null, an: null, notes: [], nid: 1, corr: null, hOut: [], hCurves: {},
    tune: D.defaultTune(), mix: Mix.defaults(), voices: [], vid: 1, style: 'pop',
    bufs: {}, beat: null, vStart: 0, bStart: 0,
    sel: new Set(), view: { t0: -0.15, pps: 120, p0: 52, ppst: 18 },
    play: { playing: false, t0: 0, pos0: 0, pos: 0, nodes: [] }, loop: null, loopOn: false, bypass: false,
    peaks: null, rmsMax: 1, autoGain: 0, levelCurve: null, keyCands: [],
    token: 0, seq: 0, rendering: false, renderDirty: false,
    undo: [], redo: [], last: '',
    total() { return Math.max(this.vocal ? this.vStart + this.vocal.x.length / this.vocal.sr : 0, this.beat ? this.bStart + this.beat.buffer.duration : 0); }
  };
  window.MachineStudio = S;                                    // handy in the console and for tests

  // ---------- styles: one-click starting points ----------
  const V = {
    dblL: { name: 'Double L', mode: 'semi', amount: 0, cents: -9, formant: -0.15, level: -9, pan: -0.8, delay: 14 },
    dblR: { name: 'Double R', mode: 'semi', amount: 0, cents: 9, formant: 0.15, level: -9, pan: 0.8, delay: 23 },
    third: { name: '3rd above', mode: 'scale', amount: 2, cents: 4, formant: 0.5, level: -11, pan: -0.4, delay: 9 },
    thirdDn: { name: '3rd below', mode: 'scale', amount: -2, cents: -4, formant: -0.4, level: -11, pan: 0.4, delay: 11 },
    fifth: { name: '5th above', mode: 'scale', amount: 4, cents: 3, formant: 0.8, level: -13, pan: 0.5, delay: 12 },
    sixthDn: { name: '6th below', mode: 'scale', amount: -5, cents: -3, formant: -0.6, level: -12, pan: -0.5, delay: 13 },
    octUp: { name: 'Octave up', mode: 'semi', amount: 12, cents: 0, formant: 1.5, level: -15, pan: 0, delay: 6 },
    octDn: { name: 'Octave down', mode: 'semi', amount: -12, cents: 0, formant: -1.5, level: -10, pan: 0, delay: 6 },
    custom: { name: 'Voice', mode: 'semi', amount: 0, cents: 0, formant: 0, level: -10, pan: 0, delay: 10 }
  };
  const STYLES = [
    { id: 'natural', name: 'Natural — invisible tuning', tune: { retune: 90, humanize: 0.6, flex: 0.35, vibrato: 1, glide: 0 },
      mix: { comp: { thresh: -20, ratio: 3, makeup: 3 }, eq: { presG: 1.5, airG: 2 }, delay: { on: false }, reverb: { type: 'room', decay: 0.9, level: -18 } }, voices: [] },
    { id: 'pop', name: 'Pop polish', tune: { retune: 25, humanize: 0.35, flex: 0, vibrato: 1, glide: 0 },
      mix: { comp: { thresh: -24, ratio: 4, makeup: 5 }, eq: { presG: 2.5, airG: 4 }, delay: { level: -20 }, reverb: { type: 'plate', decay: 1.6, level: -15 } }, voices: ['dblL', 'dblR'] },
    { id: 'hard', name: 'Hard tune — the robot snap', tune: { retune: 0, humanize: 0, flex: 0, vibrato: 0, glide: 0 },
      mix: { comp: { thresh: -26, ratio: 5, makeup: 6 }, eq: { presG: 3, airG: 5 }, delay: { level: -16, fb: 0.35 }, reverb: { type: 'plate', decay: 1.9, level: -14 } }, voices: [] },
    { id: 'trap', name: 'Melodic trap', tune: { retune: 3, humanize: 0, flex: 0, vibrato: 0.35, glide: 0 },
      mix: { comp: { thresh: -26, ratio: 5, makeup: 6 }, eq: { mudG: -3, presG: 3, airG: 5 }, sat: { on: true, drive: 0.22 }, delay: { level: -14, fb: 0.4, sync: '1/4' }, reverb: { type: 'hall', decay: 2.6, level: -13 } }, voices: ['dblL', 'dblR'] },
    { id: 'rnb', name: 'R&B silk', tune: { retune: 55, humanize: 0.5, flex: 0.2, vibrato: 1.1, glide: 40 },
      mix: { comp: { thresh: -22, ratio: 3.5, makeup: 4 }, eq: { lowG: 1, presG: 1.5, airG: 4 }, delay: { level: -19, time: 420 }, reverb: { type: 'plate', decay: 2.1, level: -13 } }, voices: ['third', 'dblL', 'dblR'] },
    { id: 'dark', name: 'Dark / lo-fi', tune: { retune: 12, humanize: 0.1, flex: 0, vibrato: 0.6, glide: 0, formant: -2 },
      mix: { comp: { thresh: -24, ratio: 5, makeup: 5 }, eq: { lowG: 2, presG: 0, airG: -6 }, sat: { on: true, drive: 0.5 }, delay: { level: -16, tone: 1800 }, reverb: { type: 'room', decay: 1.2, tone: 3000, level: -14 } }, voices: ['octDn'] },
    { id: 'stack', name: 'Choir stack', tune: { retune: 30, humanize: 0.3, flex: 0, vibrato: 0.8, glide: 0 },
      mix: { comp: { thresh: -24, ratio: 4, makeup: 4 }, eq: { presG: 2, airG: 3 }, delay: { on: false }, reverb: { type: 'hall', decay: 2.8, level: -12 } }, voices: ['third', 'sixthDn', 'fifth', 'dblL', 'dblR'] },
    { id: 'dry', name: 'Tune only — no effects', tune: { retune: 25, humanize: 0.35, flex: 0, vibrato: 1, glide: 0 },
      mix: { hpf: { on: false }, deess: { on: false }, eq: { on: false }, comp: { on: false }, delay: { on: false }, reverb: { on: false } }, voices: [] }
  ];
  function applyStyle(id, silent) {
    const st = STYLES.find(s => s.id === id); if (!st) return;
    S.style = id;
    const keep = { key: S.tune.key, scale: S.tune.scale, custom: S.tune.custom, ref: S.tune.ref, transpose: S.tune.transpose };
    S.tune = Object.assign(D.defaultTune(), keep, st.tune);
    const m = Mix.defaults();
    for (const k of Object.keys(st.mix)) Object.assign(m[k], st.mix[k]);
    m.vocal = S.mix.vocal; m.beat = S.mix.beat; m.master = S.mix.master; m.input = S.mix.input; m.gate = S.mix.gate; m.rider = S.mix.rider;
    S.mix = m;
    S.voices = st.voices.map(k => Object.assign({ id: 'v' + S.vid++, on: true }, V[k]));
    if (!silent) { syncAll(); renderStack(); applyMix(); requestRender(); commit(); }
  }

  // ---------- audio engine ----------
  let ctxPromise = null;
  function ensureCtx() {
    if (ctxPromise) return ctxPromise;
    ctxPromise = (async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC({ latencyHint: 'interactive' });
      S.lat = await Mix.measure(ctx.sampleRate);
      S.chain = Mix.create(ctx, S.lat);
      const split = ctx.createChannelSplitter(2);
      S.meters = [ctx.createAnalyser(), ctx.createAnalyser()];
      S.meters.forEach((a, i) => { a.fftSize = 1024; split.connect(a, i); });
      S.chain.out.connect(split); S.chain.out.connect(ctx.destination);
      S.ctx = ctx; applyMix();
      return ctx;
    })();
    return ctxPromise;
  }
  const mkBuf = x => { const b = S.ctx.createBuffer(1, x.length, S.ctx.sampleRate); b.copyToChannel(x, 0); return b; };
  function mixEnv() { return { autoGain: S.autoGain, bpm: S.beat && S.beat.bpm }; }
  function applyMix() {
    if (!S.chain) return;
    S.chain.apply(S.mix, mixEnv());
    drawEq();
  }
  function updateLevelCurve() {
    S.levelCurve = null;
    if (S.an && (S.mix.gate.on || S.mix.rider.on)) {
      const db = D.levelCurve(S.an, { gateOn: S.mix.gate.on, gateThresh: S.mix.gate.thresh - S.autoGain, gateRange: S.mix.gate.range, riderOn: S.mix.rider.on, rider: S.mix.rider.amt });
      const lin = new Float32Array(db.length);
      for (let i = 0; i < db.length; i++) lin[i] = dbToLin(db[i]);
      S.levelCurve = lin;
    }
    if (S.play.playing) scheduleGate(S.ctx, S.chain, S.ctx.currentTime + 0.03, currentPos() + 0.03 - S.vStart);
    else if (S.chain) { const p = S.chain.gate.gain; p.cancelScheduledValues(0); p.setValueAtTime(1, S.ctx.currentTime); }
  }
  function scheduleGate(ctx, chain, when, vpos) {
    const p = chain.gate.gain;
    p.cancelScheduledValues(0);
    if (!S.levelCurve) { p.setValueAtTime(1, Math.max(0, ctx.currentTime)); return; }
    const hopSec = S.an.hop / S.an.sr;
    let f = Math.floor(vpos / hopSec), start = when;
    if (f < 0) { start = when - vpos; f = 0; }
    const curve = S.levelCurve.subarray(f);
    if (curve.length < 2) { p.setValueAtTime(1, Math.max(0, ctx.currentTime)); return; }
    p.setValueAtTime(curve[0], Math.max(0, start - 0.001));
    p.setValueCurveAtTime(curve, start, curve.length * hopSec);
  }

  // sources for a transport start at timeline position pos; shared by live playback and export
  function addSources(ctx, chain, when, pos, opt) {
    const nodes = [];
    const add = (buf, dest, at, offset, levelDb, pan, id) => {
      if (!buf || offset >= buf.duration) return;
      const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
      src.buffer = buf; g.gain.value = dbToLin(levelDb); p.pan.value = pan;
      src.connect(g); g.connect(p); p.connect(dest);
      if (offset < 0) src.start(at - offset, 0); else src.start(at, offset);
      nodes.push({ id, src, g, p });
    };
    if (S.vocal && opt.vocal) {
      const vpos = pos - S.vStart;
      add(S.bypass && !opt.offline ? S.bufs.orig : S.bufs.lead, chain.vocalIn, when, vpos, 0, 0, 'lead');
      if (!S.bypass || opt.offline) for (const v of S.voices) if (v.on && S.bufs[v.id]) add(S.bufs[v.id], chain.vocalIn, when + v.delay / 1000, vpos, v.level, v.pan, v.id);
      scheduleGate(ctx, chain, when, vpos);
    }
    if (S.beat && opt.beat) add(S.beat.buffer, chain.beatIn, when, pos - S.bStart, 0, 0, 'beat');
    return nodes;
  }
  function currentPos() {
    const p = S.play;
    return p.playing ? p.pos0 + Math.max(0, S.ctx.currentTime - p.t0) : p.pos;
  }
  function stopSources() {
    const now = S.ctx ? S.ctx.currentTime : 0;
    for (const n of S.play.nodes) { try { n.g.gain.setTargetAtTime(0, now, 0.006); n.src.stop(now + 0.04); } catch (_) {} }
    S.play.nodes = [];
  }
  async function play(from, opt) {
    await ensureCtx();
    if (S.ctx.state !== 'running') await S.ctx.resume();
    if (!S.vocal && !S.beat) return;
    stopSources();
    let pos = from != null ? from : S.play.pos;
    if (pos >= S.total() - 0.03) pos = S.loopOn && S.loop ? S.loop.a : 0;
    const t0 = S.ctx.currentTime + 0.04;
    S.play.playing = true; S.play.t0 = t0; S.play.pos0 = pos; S.play.pos = pos;
    S.play.nodes = addSources(S.ctx, S.chain, t0, pos, opt || { vocal: !rec, beat: true });
    $('btnPlay').textContent = '⏸'; $('btnPlay').classList.add('on');
    tick();
  }
  function pause() {
    if (!S.play.playing) return;
    S.play.pos = currentPos(); S.play.playing = false; stopSources();
    $('btnPlay').textContent = '▶'; $('btnPlay').classList.remove('on');
    editor.draw(); showTime();
  }
  function seek(t) {
    t = D.clamp(t, 0, Math.max(0, S.total()));
    if (S.play.playing) play(t); else { S.play.pos = t; editor.draw(); showTime(); }
  }
  let raf = 0;
  function tick() {
    cancelAnimationFrame(raf);
    const loop = () => {
      if (S.play.playing) {
        let pos = currentPos();
        if (S.loopOn && S.loop && pos >= S.loop.b) { play(S.loop.a); return; }
        if (pos >= S.total()) {
          if (rec) { stopRec(false); return; }
          if (S.loopOn) { play(S.loop ? S.loop.a : 0); return; }
          pause(); S.play.pos = 0; editor.draw(); showTime(); return;
        }
        S.play.pos = pos; editor.follow(); editor.draw(); showTime();
      }
      drawMeters();
      if (S.play.playing || rec) raf = requestAnimationFrame(loop);
      else setTimeout(() => { if (!S.play.playing) drawMeters(true); }, 300);
    };
    raf = requestAnimationFrame(loop);
  }
  const mbuf = new Float32Array(1024);
  function drawMeters(zero) {
    if (!S.meters) return;
    ['meterL', 'meterR'].forEach((id, i) => {
      let pk = 0;
      if (!zero) { S.meters[i].getFloatTimeDomainData(mbuf); for (let k = 0; k < mbuf.length; k++) pk = Math.max(pk, Math.abs(mbuf[k])); }
      $(id).style.width = D.clamp((D.linToDb(pk) + 48) / 48, 0, 1) * 100 + '%';
    });
    const gr = $('grComp');
    if (gr) gr.style.width = (zero ? 0 : D.clamp(-S.chain.comp.reduction / 18, 0, 1) * 100) + '%';
    const gd = $('grDe');
    if (gd) gd.style.width = (zero ? 0 : D.clamp(-S.chain.deComp.reduction / 12, 0, 1) * 100) + '%';
  }
  const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  function showTime() { $('time').textContent = fmtTime(S.play.pos) + ' / ' + fmtTime(S.total()); }
  const status = t => { $('status').textContent = t; };
  function busy(text, p) {
    $('busy').hidden = text == null;
    if (text != null) { $('busyText').textContent = text; $('busyBar').style.width = Math.round((p || 0) * 100) + '%'; }
  }

  // ---------- render worker ----------
  function workerMain() {
    let prep = null, caches = {};
    self.onmessage = e => {
      const m = e.data;
      try {
        if (m.type === 'analyze') {
          const an = D.analyzePitch(m.samples, m.sr, {}, p => self.postMessage({ type: 'progress', token: m.token, stage: 'Reading the pitch…', p: p * 0.85 }));
          prep = D.prepare(m.samples, an, p => self.postMessage({ type: 'progress', token: m.token, stage: 'Finding every vocal period…', p: 0.85 + p * 0.15 }));
          caches = {};
          self.postMessage({ type: 'analysis', token: m.token, an: { f0: an.f0, midi: an.midi, conf: an.conf, rms: an.rms, hop: an.hop, frames: an.frames, sr: an.sr } });
        } else if (m.type === 'render') {
          const res = [], tr = [];
          for (const id of Object.keys(caches)) if (!m.voices.some(v => v.id === id)) delete caches[id];
          for (const v of m.voices) {
            const patches = D.renderVoice(prep, v, caches[v.id] || (caches[v.id] = {}));
            for (const p of patches) tr.push(p.data.buffer);
            res.push({ id: v.id, patches });
          }
          self.postMessage({ type: 'rendered', token: m.token, seq: m.seq, res }, tr);
        }
      } catch (err) { self.postMessage({ type: 'error', message: String((err && err.stack) || err) }); }
    };
  }
  const worker = new Worker(URL.createObjectURL(new Blob([D.workerSource(), '\n(', workerMain.toString(), ')();'], { type: 'application/javascript' })));
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'error') { busy(null); S.rendering = false; status('Engine error: ' + m.message.split('\n')[0]); console.error(m.message); return; }
    if (m.token !== S.token) return;
    if (m.type === 'progress') busy(m.stage, m.p);
    else if (m.type === 'analysis') onAnalysis(m.an);
    else if (m.type === 'rendered') onRendered(m);
  };

  // ---------- loading ----------
  async function decodeFile(file) {
    await ensureCtx();
    const data = await file.arrayBuffer(), keep = data.slice(0);
    const buf = await new Promise((res, rej) => S.ctx.decodeAudioData(data, res, rej));
    return { buf, bytes: keep };
  }
  function toMono(buf) {
    const n = buf.length, x = new Float32Array(n), nch = buf.numberOfChannels;
    for (let c = 0; c < nch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / nch; }
    return x;
  }
  async function loadVocalFile(file) {
    try {
      busy('Decoding ' + file.name + '…', 0);
      const { buf } = await decodeFile(file);
      if (buf.duration > 600) { busy(null); status('That file is over 10 minutes — trim it to the vocal take first.'); return; }
      loadVocal(toMono(buf), buf.sampleRate, file.name);
    } catch (err) { busy(null); status('Could not read that file as audio.'); console.error(err); }
  }
  let restoreNotes = null;
  async function loadVocal(x, sr, name, restore) {
    await ensureCtx();
    pause(); S.token++;
    S.vocal = { x, sr, name }; S.an = null; S.notes = []; S.sel.clear(); S.corr = null; S.hOut = []; S.loop = null;
    S.bufs = { orig: mkBuf(x), lead: mkBuf(x) };
    const nb = 1400, pk = new Float32Array(nb * 2), per = x.length / nb;
    for (let i = 0; i < nb; i++) { let lo = 0, hi = 0; for (let k = Math.floor(i * per); k < Math.floor((i + 1) * per); k++) { if (x[k] < lo) lo = x[k]; if (x[k] > hi) hi = x[k]; } pk[i * 2] = lo; pk[i * 2 + 1] = hi; }
    let mx = 0; for (let i = 0; i < pk.length; i++) mx = Math.max(mx, Math.abs(pk[i]));
    if (mx > 0) for (let i = 0; i < pk.length; i++) pk[i] /= mx;
    S.peaks = pk; S.play.pos = 0;
    restoreNotes = restore || null;
    if (!restore) { S.undo = []; S.redo = []; if (!S.beat) { S.vStart = 0; S.bStart = 0; } }
    $('empty').hidden = true;
    busy('Reading the pitch…', 0);
    const copy = x.slice();
    worker.postMessage({ type: 'analyze', token: S.token, samples: copy, sr }, [copy.buffer]);
    if (!restore) saveVocal();
    renderNotePanel();
  }
  function onAnalysis(an) {
    S.an = an;
    let mx = 0, acc = 0, cnt = 0;
    for (let t = 0; t < an.frames; t++) { if (an.rms[t] > mx) mx = an.rms[t]; if (an.midi[t]) { acc += 20 * Math.log10(an.rms[t] + 1e-9); cnt++; } }
    S.rmsMax = mx || 1;
    S.autoGain = cnt ? D.clamp(-20 - acc / cnt, -12, 30) : 0;
    if (restoreNotes) { S.notes = restoreNotes.filter(n => n.e <= an.frames); S.nid = S.notes.reduce((a, n) => Math.max(a, n.id + 1), 1); detectKey(true); }
    else { detectKey(false); S.notes = []; resegment(); }
    restoreNotes = null;
    busy(null);
    syncAll(); applyMix(); updateLevelCurve();
    editor.fit(); requestRender(true); renderNotePanel(); showTime();
    S.last = snapshot();
    const voiced = cnt * an.hop / an.sr;
    status(cnt ? S.notes.length + ' notes found · key ' + keyName() + ' · ' + fmtTime(S.vocal.x.length / S.vocal.sr) + (S.autoGain > 1 ? ' · level raised ' + S.autoGain.toFixed(0) + ' dB' : '')
      : 'No sung pitch found in this file — is it a vocal?');
    if (voiced < 0.3 && cnt) status('Very little sung pitch found — tuning works on a solo voice, not a full mix.');
  }
  const keyName = () => S.tune.custom ? 'custom' : D.NOTE_NAMES[S.tune.key] + ' ' + D.SCALES[S.tune.scale].name.toLowerCase();
  function detectKey(keepCurrent) {
    if (!S.an) return;
    const vk = D.keysFromChroma(D.chromaFromNotes(D.segmentNotes(S.an.midi)));
    const score = {};
    for (const k of vk) score[k.key + k.scale] = k.score;
    if (S.beat && S.beat.keys) for (const k of S.beat.keys) score[k.key + k.scale] = (score[k.key + k.scale] || 0) + k.score * 1.2;
    const all = vk.map(k => ({ key: k.key, scale: k.scale, score: score[k.key + k.scale] })).sort((a, b) => b.score - a.score);
    S.keyCands = all.slice(0, 4);
    if (!keepCurrent && all.length) { S.tune.key = all[0].key; S.tune.scale = all[0].scale; S.tune.custom = null; }
  }
  async function loadBeatFile(file) {
    try {
      busy('Decoding ' + file.name + '…', 0);
      const { buf, bytes } = await decodeFile(file);
      await setBeat(buf, file.name);
      saveBeat(bytes, file.name);
    } catch (err) { status('Could not read that beat as audio.'); console.error(err); }
    busy(null);
  }
  async function setBeat(buf, name) {
    pause();
    busy('Reading the beat (key, tempo)…', 0.5);
    await new Promise(r => setTimeout(r, 30));
    const mono = toMono(buf);
    const head = mono.subarray(0, Math.min(mono.length, buf.sampleRate * 90));
    S.beat = { buffer: buf, name, keys: D.keysFromChroma(D.chromaFromAudio(head, buf.sampleRate)).slice(0, 6), bpm: D.detectTempo(head, buf.sampleRate) };
    if (S.an) { detectKey(!!S.undo.length); resegment(); requestRender(); }
    applyMix(); syncAll(); editor.fit(); showTime();
    const k = S.beat.keys[0];
    status('Beat loaded · ' + (S.beat.bpm ? S.beat.bpm + ' BPM · ' : '') + 'sounds like ' + D.NOTE_NAMES[k.key] + ' ' + k.scale);
  }
  function loadDemo() {
    ensureCtx().then(ctx => {
      busy('Singing the demo take…', 0.2);
      setTimeout(() => { const { x } = D.synthVocal(ctx.sampleRate, D.demoNotes(), 7); loadVocal(x, ctx.sampleRate, 'Demo take'); }, 30);
    });
  }

  // ---------- notes ----------
  const newNote = n => Object.assign({ id: S.nid++, manual: null, off: false, retune: null, vib: null, formant: 0, gain: 0, edited: false }, n);
  // (re)read the notes from the pitch line, leaving alone every note the user has touched
  function resegment(dropEdits) {
    if (!S.an) return;
    const mask = D.tuneMask(S.tune), kept = dropEdits ? [] : S.notes.filter(n => n.edited).sort((a, b) => a.s - b.s);
    const out = []; let at = 0;
    for (const k of kept.concat([{ s: S.an.frames, e: S.an.frames, end: true }])) {
      if (k.s > at) for (const n of D.segmentRange(S.an.midi, at, k.s, mask, S.tune.ref)) out.push(newNote(n));
      if (!k.end) out.push(k);
      at = Math.max(at, k.e);
    }
    S.notes = out;
    const ids = new Set(out.map(n => n.id));
    for (const id of Array.from(S.sel)) if (!ids.has(id)) S.sel.delete(id);
  }
  const selNotes = () => S.notes.filter(n => S.sel.has(n.id));
  function splitNote(n, f) {
    if (f - n.s < 3 || n.e - f < 3) { status('Too close to the edge of the note to split.'); return; }
    const i = S.notes.indexOf(n), b = newNote(Object.assign({}, n, { id: undefined, s: f }));
    b.id = S.nid++; n.e = f;
    for (const q of [n, b]) { q.center = D.noteCenter(S.an.midi, q.s, q.e); q.manual = null; q.edited = true; }
    S.notes.splice(i + 1, 0, b);
    S.sel.clear(); S.sel.add(b.id);
    requestRender(); commit(); renderNotePanel(); status('Split. Drag either half to its own pitch.');
  }
  function splitAtPlayhead() {
    if (!S.an) return;
    const f = Math.round((S.play.pos - S.vStart) * S.an.sr / S.an.hop), n = S.notes.find(q => f > q.s && f < q.e);
    if (n) splitNote(n, f); else status('Put the playhead inside a note first (click in the editor).');
  }
  function mergeSel() {
    const sel = selNotes(); let did = false;
    for (let i = S.notes.length - 2; i >= 0; i--) {
      const a = S.notes[i], b = S.notes[i + 1];
      if (S.sel.has(a.id) && S.sel.has(b.id) && a.e === b.s) {
        a.e = b.e; a.center = D.noteCenter(S.an.midi, a.s, a.e); a.edited = true;
        S.notes.splice(i + 1, 1); S.sel.delete(b.id); did = true;
      }
    }
    if (did) { requestRender(); commit(); renderNotePanel(); }
    else status(sel.length < 2 ? 'Select two or more touching notes to merge (shift-click or drag a box).' : 'Those notes do not touch — only joined notes can merge.');
  }
  function editSel(fn, label) {
    const sel = selNotes(); if (!sel.length) return;
    sel.forEach(n => { fn(n); n.edited = true; });
    requestRender(); commit(); renderNotePanel(); if (label) status(label);
  }
  function resetSel() {
    const sel = selNotes(); if (!sel.length) return;
    sel.forEach(n => { n.manual = null; n.off = false; n.retune = null; n.vib = null; n.formant = 0; n.gain = 0; n.edited = false; });
    resegment(); requestRender(); commit(); renderNotePanel(); status('Back to automatic.');
  }
  function nudgeSel(steps, mode) {
    if (!S.corr) return;
    const mask = D.tuneMask(S.tune), off = (S.tune.ref || 0) / 100;
    S.notes.forEach((n, i) => {
      if (!S.sel.has(n.id)) return;
      const t = S.corr.targets[i];
      n.manual = mode === 'cents' ? Math.round((t + steps * 0.1) * 100) / 100 : mode === 'oct' ? t + 12 * steps : D.shiftDegrees(t - off, steps, mask) + off;
      n.edited = true; n.off = false;
    });
    requestRender(); commit(); renderNotePanel();
  }

  // ---------- render pipeline ----------
  function computeAll() {
    if (!S.an) return;
    S.corr = D.computeCorrection(S.an, S.notes, S.tune);
    S.hOut = []; S.hCurves = {};
    for (const v of S.voices) if (v.on) { const h = D.harmonyCurves(S.an, S.notes, S.tune, S.corr, v); S.hCurves[v.id] = h; S.hOut.push({ id: v.id, out: h.out }); }
  }
  let renderTimer = 0, renderPending = false;
  function requestRender(now) {
    if (!S.an) return;
    computeAll(); editor.draw();
    clearTimeout(renderTimer); renderPending = true;
    renderTimer = setTimeout(doRender, now ? 0 : 110);
  }
  function doRender() {
    renderPending = false;
    if (!S.an) return;
    if (S.rendering) { S.renderDirty = true; return; }
    S.rendering = true;
    const voices = [{ id: 'lead', st: S.corr.st, fo: S.corr.fo, gain: S.corr.gain }];
    for (const v of S.voices) if (v.on) { const h = S.hCurves[v.id]; voices.push({ id: v.id, st: h.st, fo: h.fo, gain: h.gain }); }
    for (const id of Object.keys(S.bufs)) if (id !== 'orig' && !voices.some(v => v.id === id)) delete S.bufs[id];
    for (const v of voices) if (!S.bufs[v.id]) S.bufs[v.id] = mkBuf(S.vocal.x);
    $('status').classList.add('work');
    worker.postMessage({ type: 'render', token: S.token, seq: ++S.seq, voices });
  }
  function onRendered(m) {
    let changed = false;
    for (const r of m.res) {
      const buf = S.bufs[r.id]; if (!buf) continue;
      const ch = buf.getChannelData(0);
      for (const p of r.patches) { ch.set(p.data, p.start); changed = true; }
    }
    S.rendering = false; $('status').classList.remove('work');
    if (S.renderDirty) { S.renderDirty = false; doRender(); }
    if (changed && S.play.playing && !rec) play(currentPos());
  }
  const renderIdle = () => new Promise(res => { const chk = () => (S.rendering || S.renderDirty || renderPending) ? setTimeout(chk, 50) : res(); chk(); });

  // ---------- undo ----------
  const snapshot = () => JSON.stringify({ tune: S.tune, notes: S.notes, voices: S.voices, mix: S.mix, vStart: S.vStart, bStart: S.bStart, style: S.style });
  function commit() {
    const s = snapshot();
    if (s === S.last) return;
    if (S.last) { S.undo.push(S.last); if (S.undo.length > 120) S.undo.shift(); }
    S.redo = []; S.last = s; saveState();
  }
  function restore(json) {
    const o = JSON.parse(json);
    S.tune = o.tune; S.notes = o.notes; S.voices = o.voices; S.mix = o.mix; S.vStart = o.vStart; S.bStart = o.bStart; S.style = o.style;
    const ids = new Set(S.notes.map(n => n.id));
    for (const id of Array.from(S.sel)) if (!ids.has(id)) S.sel.delete(id);
    S.last = json;
    syncAll(); renderStack(); renderNotePanel(); applyMix(); updateLevelCurve(); requestRender(); saveState();
  }
  function undo() { if (!S.undo.length) return; S.redo.push(S.last); restore(S.undo.pop()); status('Undo'); }
  function redo() { if (!S.redo.length) return; S.undo.push(S.last); restore(S.redo.pop()); status('Redo'); }

  // ---------- panels ----------
  const syncers = [];
  function syncAll() {
    for (const f of syncers) f();
    $('selKey').value = S.tune.key; $('selScale').value = S.tune.custom ? 'custom' : S.tune.scale; $('selStyle').value = S.style;
    $('btnAB').classList.toggle('on', S.bypass); $('btnLoop').classList.toggle('on', S.loopOn);
    drawKeys(); drawEq();
  }
  function changed(kind) {
    if (kind === 'tune' || kind === 'voice' || kind === 'note') requestRender();
    else if (kind === 'scale') { resegment(); requestRender(); renderNotePanel(); }
    else if (kind === 'mix') applyMix();
    else if (kind === 'level') { applyMix(); updateLevelCurve(); }
    else if (kind === 'live') liveVoices();
    else if (kind === 'offset') { editor.draw(); showTime(); if (S.play.playing) play(currentPos()); }
  }
  function slider(host, o) {
    const row = el('label', 'ctl'); if (o.tip) row.title = o.tip;
    const name = el('span', 'n', o.label), inp = el('input'), val = el('span', 'v');
    inp.type = 'range'; inp.min = o.min; inp.max = o.max; inp.step = o.step || 1;
    const show = () => { val.textContent = o.fmt ? o.fmt(+inp.value) : inp.value; };
    const sync = () => { inp.value = o.get(); show(); };
    inp.addEventListener('input', () => { o.set(+inp.value); show(); changed(o.kind); });
    inp.addEventListener('change', commit);
    row.addEventListener('dblclick', e => { if (o.def == null) return; e.preventDefault(); o.set(o.def); sync(); changed(o.kind); commit(); });
    row.append(name, inp, val); host.append(row);
    if (!o.temp) syncers.push(sync);
    sync(); return row;
  }
  function section(host, title, toggle) {
    const sec = el('div', 'sec'), h = el('h3'), t = el('span', null, title);
    h.append(t);
    if (toggle) {
      const cb = el('input', 'tog'); cb.type = 'checkbox';
      const sync = () => { cb.checked = toggle.get(); sec.classList.toggle('off', !cb.checked); };
      cb.addEventListener('change', () => { toggle.set(cb.checked); sec.classList.toggle('off', !cb.checked); changed(toggle.kind); commit(); });
      syncers.push(sync); sync(); h.append(cb);
    }
    sec.append(h); host.append(sec);
    return sec;
  }
  const pct = v => Math.round(v * 100) + '%', dB = v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB', hz = v => v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz';
  const stf = v => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + ' st';
  const T = (k, kind) => ({ get: () => S.tune[k], set: v => { S.tune[k] = v; }, kind: kind || 'tune' });
  const M = (g, k, kind) => ({ get: () => S.mix[g][k], set: v => { S.mix[g][k] = v; }, kind: kind || 'mix' });
  const MT = (g, kind) => ({ get: () => S.mix[g].on, set: v => { S.mix[g].on = v; }, kind: kind || 'mix' });

  let keyBtns = [];
  function buildTune() {
    const host = $('tab-tune');
    let s = section(host, 'Scale notes');
    const keys = el('div', 'keys');
    keyBtns = D.NOTE_NAMES.map((nm, pc) => {
      const b = el('button', [1, 3, 6, 8, 10].includes(pc) ? 'blk' : '', nm);
      b.title = 'Allow or forbid ' + nm + '. Forbidden notes are pulled to the nearest allowed one.';
      b.addEventListener('click', () => {
        const m = D.tuneMask(S.tune); m[pc] = !m[pc];
        if (!m.some(Boolean)) return;
        S.tune.custom = m; syncAll(); changed('scale'); commit();
      });
      keys.append(b); return b;
    });
    s.append(keys);
    const cands = el('div', 'rowb'); cands.id = 'keyCands'; s.append(cands);

    s = section(host, 'Correction');
    slider(s, Object.assign({ label: 'Retune speed', min: 0, max: 400, step: 1, def: 25, fmt: v => v === 0 ? 'hard' : v + ' ms',
      tip: 'How fast the pitch is pulled to the note. 0 = instant, the hard-tune sound. 20-60 = modern pop. 100+ = natural.' }, T('retune')));
    slider(s, Object.assign({ label: 'Humanize', min: 0, max: 1, step: 0.01, def: 0.35, fmt: pct,
      tip: 'Relaxes the pull on the held part of long notes so they do not go flat and lifeless. Short notes stay tight.' }, T('humanize')));
    slider(s, Object.assign({ label: 'Amount', min: 0, max: 1, step: 0.01, def: 1, fmt: pct,
      tip: 'How much of the correction is applied. 0% is the untouched take.' }, T('amount')));
    slider(s, Object.assign({ label: 'Flex', min: 0, max: 1, step: 0.01, def: 0, fmt: pct,
      tip: 'Leaves big bends, slides and scoops alone and only tunes what is already near a note.' }, T('flex')));
    slider(s, Object.assign({ label: 'Note glide', min: 0, max: 250, step: 1, def: 0, fmt: v => v + ' ms',
      tip: 'Slide time between two joined notes. 0 = stepped, the classic effect.' }, T('glide')));

    s = section(host, 'Vibrato');
    slider(s, Object.assign({ label: 'Natural', min: 0, max: 2, step: 0.01, def: 1, fmt: pct,
      tip: 'The singer\'s own vibrato: 0% irons it flat, 100% leaves it, 200% doubles it.' }, T('vibrato')));
    slider(s, Object.assign({ label: 'Add depth', min: 0, max: 100, step: 1, def: 0, fmt: v => v + ' c',
      tip: 'Adds a made vibrato to held notes (cents).' }, T('vibDepth')));
    slider(s, Object.assign({ label: 'Add rate', min: 3, max: 8, step: 0.1, def: 5.5, fmt: v => v.toFixed(1) + ' Hz' }, T('vibRate')));
    slider(s, Object.assign({ label: 'Add after', min: 0, max: 1000, step: 10, def: 250, fmt: v => v + ' ms',
      tip: 'How long a note is held before the added vibrato fades in.' }, T('vibDelay')));

    s = section(host, 'Voice');
    slider(s, Object.assign({ label: 'Transpose', min: -12, max: 12, step: 1, def: 0, fmt: stf,
      tip: 'Moves the whole vocal up or down in semitones, keeping the voice character.' }, T('transpose')));
    slider(s, Object.assign({ label: 'Formant', min: -6, max: 6, step: 0.1, def: 0, fmt: stf,
      tip: 'Throat size. Down = bigger, darker voice. Up = smaller, brighter. Pitch does not change.' }, T('formant')));
    slider(s, Object.assign({ label: 'Tuning ref', min: -50, max: 50, step: 1, def: 0, fmt: v => (v > 0 ? '+' : '') + v + ' c',
      tip: 'Shifts the whole note grid if the beat is not tuned to A = 440 Hz.' }, T('ref', 'scale')));
  }
  function drawKeys() {
    const mask = D.tuneMask(S.tune);
    keyBtns.forEach((b, pc) => { b.classList.toggle('in', mask[pc]); b.classList.toggle('root', !S.tune.custom && pc === S.tune.key); });
    const host = $('keyCands'); if (!host) return;
    host.textContent = '';
    if (!S.keyCands.length) return;
    host.append(el('span', 'lbl', 'heard'));
    const top = S.keyCands[0].score;
    S.keyCands.forEach(k => {
      const b = el('button', 'pill', D.NOTE_NAMES[k.key] + (k.scale === 'minor' ? 'm' : ''));
      b.title = D.NOTE_NAMES[k.key] + ' ' + k.scale + ' — match ' + Math.round(100 * k.score / top) + '% of the best guess';
      if (!S.tune.custom && k.key === S.tune.key && k.scale === S.tune.scale) b.classList.add('on');
      b.addEventListener('click', () => { S.tune.key = k.key; S.tune.scale = k.scale; S.tune.custom = null; syncAll(); changed('scale'); commit(); });
      host.append(b);
    });
  }

  let eqCanvas = null;
  function buildMix() {
    const host = $('tab-mix');
    let s = section(host, 'Levels');
    slider(s, Object.assign({ label: 'Vocal', min: -30, max: 12, step: 0.5, def: 0, fmt: dB }, M('vocal', 'level')));
    slider(s, Object.assign({ label: 'Vocal pan', min: -1, max: 1, step: 0.02, def: 0, fmt: v => Math.abs(v) < 0.01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100) }, M('vocal', 'pan')));
    slider(s, Object.assign({ label: 'Beat', min: -40, max: 6, step: 0.5, def: -4, fmt: dB }, M('beat', 'level')));
    slider(s, { label: 'Vocal start', min: -4, max: 4, step: 0.005, def: 0, kind: 'offset', fmt: v => (v >= 0 ? '+' : '') + v.toFixed(3) + ' s',
      tip: 'Slides the vocal against the beat. Positive = vocal comes in later.',
      get: () => D.clamp(S.vStart - S.bStart, -4, 4), set: v => { if (v >= 0) { S.vStart = v; S.bStart = 0; } else { S.vStart = 0; S.bStart = -v; } } });
    slider(s, Object.assign({ label: 'Input trim', min: -12, max: 12, step: 0.5, def: 0, fmt: dB,
      tip: 'The take is levelled automatically before the chain; this is a manual trim on top.' }, M('input', 'gain')));
    slider(s, Object.assign({ label: 'Master', min: -24, max: 6, step: 0.5, def: 0, fmt: dB }, M('master', 'level')));

    s = section(host, 'Gate — silence between phrases', MT('gate', 'level'));
    slider(s, Object.assign({ label: 'Threshold', min: -70, max: -20, step: 1, def: -48, fmt: v => v + ' dB' }, M('gate', 'thresh', 'level')));
    slider(s, Object.assign({ label: 'Reduce by', min: 6, max: 60, step: 1, def: 30, fmt: v => v + ' dB' }, M('gate', 'range', 'level')));
    s = section(host, 'Level rider — even out phrases', MT('rider', 'level'));
    slider(s, Object.assign({ label: 'Amount', min: 0, max: 1, step: 0.01, def: 0.5, fmt: pct }, M('rider', 'amt', 'level')));

    s = section(host, 'Low cut', MT('hpf'));
    slider(s, Object.assign({ label: 'Frequency', min: 40, max: 250, step: 1, def: 90, fmt: hz }, M('hpf', 'freq')));

    s = section(host, 'De-esser', MT('deess'));
    slider(s, Object.assign({ label: 'Threshold', min: -50, max: -10, step: 1, def: -30, fmt: v => v + ' dB', tip: 'Lower = more s and t taming.' }, M('deess', 'thresh')));
    slider(s, Object.assign({ label: 'Above', min: 3500, max: 9000, step: 50, def: 6200, fmt: hz }, M('deess', 'freq')));
    const gd = el('div', 'gr'); gd.append(Object.assign(el('i'), { id: 'grDe' })); s.append(gd);

    s = section(host, 'EQ', MT('eq'));
    eqCanvas = el('canvas', 'eq'); s.append(eqCanvas);
    slider(s, Object.assign({ label: 'Body', min: -9, max: 9, step: 0.5, def: 0, fmt: dB, tip: 'Low shelf around 180 Hz.' }, M('eq', 'lowG')));
    slider(s, Object.assign({ label: 'Mud', min: -9, max: 6, step: 0.5, def: -2, fmt: dB, tip: 'Cut around 320 Hz to clear boxiness.' }, M('eq', 'mudG')));
    slider(s, Object.assign({ label: 'Presence', min: -6, max: 9, step: 0.5, def: 2, fmt: dB, tip: 'Around 3.8 kHz: pushes the voice forward.' }, M('eq', 'presG')));
    slider(s, Object.assign({ label: 'Presence at', min: 1500, max: 7000, step: 50, def: 3800, fmt: hz }, M('eq', 'presF')));
    slider(s, Object.assign({ label: 'Air', min: -9, max: 9, step: 0.5, def: 3, fmt: dB, tip: 'High shelf from 11 kHz: shine and breath.' }, M('eq', 'airG')));

    s = section(host, 'Compressor', MT('comp'));
    slider(s, Object.assign({ label: 'Threshold', min: -45, max: -5, step: 1, def: -22, fmt: v => v + ' dB' }, M('comp', 'thresh')));
    slider(s, Object.assign({ label: 'Ratio', min: 1.5, max: 12, step: 0.5, def: 3.5, fmt: v => v.toFixed(1) + ' : 1' }, M('comp', 'ratio')));
    slider(s, Object.assign({ label: 'Attack', min: 1, max: 60, step: 1, def: 6, fmt: v => v + ' ms' }, M('comp', 'attack')));
    slider(s, Object.assign({ label: 'Release', min: 30, max: 500, step: 5, def: 140, fmt: v => v + ' ms' }, M('comp', 'release')));
    slider(s, Object.assign({ label: 'Make-up', min: 0, max: 18, step: 0.5, def: 4, fmt: dB }, M('comp', 'makeup')));
    const gc = el('div', 'gr'); gc.title = 'Gain reduction'; gc.append(Object.assign(el('i'), { id: 'grComp' })); s.append(gc);

    s = section(host, 'Saturation', MT('sat'));
    slider(s, Object.assign({ label: 'Drive', min: 0, max: 1, step: 0.01, def: 0.25, fmt: pct }, M('sat', 'drive')));

    s = section(host, 'Delay', MT('delay'));
    const row = el('div', 'rowb');
    ['off', '1/4', '1/8', '1/8d', '1/16'].forEach(k => {
      const b = el('button', 'pill', k === 'off' ? 'free' : k);
      b.title = k === 'off' ? 'Delay time in milliseconds' : 'Locked to the beat tempo (needs a beat loaded)';
      const sync = () => b.classList.toggle('on', S.mix.delay.sync === k);
      b.addEventListener('click', () => { S.mix.delay.sync = k; syncAll(); applyMix(); commit(); if (k !== 'off' && !(S.beat && S.beat.bpm)) status('Tempo sync needs a beat — using the free time until one is loaded.'); });
      syncers.push(sync); row.append(b);
    });
    s.append(row);
    slider(s, Object.assign({ label: 'Time', min: 40, max: 1200, step: 5, def: 340, fmt: v => v + ' ms' }, M('delay', 'time')));
    slider(s, Object.assign({ label: 'Repeats', min: 0, max: 0.85, step: 0.01, def: 0.28, fmt: pct }, M('delay', 'fb')));
    slider(s, Object.assign({ label: 'Tone', min: 600, max: 12000, step: 50, def: 3600, fmt: hz }, M('delay', 'tone')));
    slider(s, Object.assign({ label: 'Level', min: -40, max: 0, step: 0.5, def: -18, fmt: dB }, M('delay', 'level')));

    s = section(host, 'Reverb', MT('reverb'));
    const row2 = el('div', 'rowb');
    ['room', 'plate', 'hall'].forEach(k => {
      const b = el('button', 'pill', k);
      const sync = () => b.classList.toggle('on', S.mix.reverb.type === k);
      b.addEventListener('click', () => { S.mix.reverb.type = k; syncAll(); applyMix(); commit(); });
      syncers.push(sync); row2.append(b);
    });
    s.append(row2);
    slider(s, Object.assign({ label: 'Decay', min: 0.3, max: 6, step: 0.1, def: 1.6, fmt: v => v.toFixed(1) + ' s' }, M('reverb', 'decay')));
    slider(s, Object.assign({ label: 'Pre-delay', min: 0, max: 120, step: 1, def: 25, fmt: v => v + ' ms' }, M('reverb', 'pre')));
    slider(s, Object.assign({ label: 'Tone', min: 1500, max: 14000, step: 100, def: 7000, fmt: hz }, M('reverb', 'tone')));
    slider(s, Object.assign({ label: 'Level', min: -40, max: 0, step: 0.5, def: -15, fmt: dB }, M('reverb', 'level')));

    s = section(host, 'Limiter', { get: () => S.mix.master.limit, set: v => { S.mix.master.limit = v; }, kind: 'mix' });
    s.append(el('p', null, 'Catches peaks on the master so the export does not clip.'));
  }
  function drawEq() {
    if (!eqCanvas || !eqCanvas.clientWidth) return;
    const w = eqCanvas.clientWidth, h = eqCanvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    eqCanvas.width = w * dpr; eqCanvas.height = h * dpr;
    const g = eqCanvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = 160, fr = new Float32Array(n);
    for (let i = 0; i < n; i++) fr[i] = 30 * Math.pow(20000 / 30, i / (n - 1));
    const resp = Mix.eqCurve(S.mix, fr);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2e2538'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.strokeStyle = '#41e6ff'; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * w, y = h / 2 - D.clamp(resp[i], -18, 18) / 18 * (h / 2 - 3); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }

  function renderStack() {
    const host = $('tab-stack'); host.textContent = '';
    const s = el('div', 'sec'); s.append(Object.assign(el('h3'), { textContent: 'Add a voice' }));
    s.append(el('p', null, 'Extra voices are made from your take: doubles for width, harmonies that follow the key.'));
    const row = el('div', 'rowb');
    [['Double', ['dblL', 'dblR']], ['3rd above', ['third']], ['3rd below', ['thirdDn']], ['5th above', ['fifth']], ['6th below', ['sixthDn']], ['Octave up', ['octUp']], ['Octave down', ['octDn']], ['Custom', ['custom']]].forEach(([label, kinds]) => {
      const b = el('button', 'pill', '+ ' + label);
      b.addEventListener('click', () => {
        if (S.voices.length + kinds.length > 8) { status('Eight extra voices is the limit.'); return; }
        kinds.forEach(k => S.voices.push(Object.assign({ id: 'v' + S.vid++, on: true }, V[k])));
        renderStack(); requestRender(); commit();
      });
      row.append(b);
    });
    s.append(row); host.append(s);
    S.voices.forEach(v => {
      const sec = el('div', 'sec voice'), h = el('h3'), nm = el('input'), cb = el('input', 'tog'), x = el('button', 'x', '✕'), right = el('span', 'rowb');
      nm.type = 'text'; nm.value = v.name; nm.addEventListener('change', () => { v.name = nm.value; commit(); });
      cb.type = 'checkbox'; cb.checked = v.on; sec.classList.toggle('off', !v.on);
      cb.addEventListener('change', () => { v.on = cb.checked; sec.classList.toggle('off', !v.on); requestRender(); commit(); });
      x.title = 'Remove this voice';
      x.addEventListener('click', () => { S.voices = S.voices.filter(q => q !== v); renderStack(); requestRender(); commit(); });
      right.append(cb, x); h.append(nm, right); sec.append(h);
      const modes = el('div', 'rowb');
      [['scale', 'follows the key'], ['semi', 'fixed semitones']].forEach(([m, label]) => {
        const b = el('button', 'pill' + (v.mode === m ? ' on' : ''), label);
        b.addEventListener('click', () => { v.mode = m; v.amount = D.clamp(Math.round(v.amount), m === 'scale' ? -7 : -12, m === 'scale' ? 7 : 12); renderStack(); requestRender(); commit(); });
        modes.append(b);
      });
      sec.append(modes);
      const W = (k, kind) => ({ get: () => v[k], set: q => { v[k] = q; }, kind, temp: true });
      slider(sec, Object.assign(v.mode === 'scale'
        ? { label: 'Interval', min: -7, max: 7, step: 1, fmt: q => q === 0 ? 'unison' : (Math.abs(q) + 1) + ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'][Math.abs(q) + 1] + (q > 0 ? ' above' : ' below'), tip: 'Scale steps from the lead note, so the harmony always stays in key.' }
        : { label: 'Interval', min: -12, max: 12, step: 1, fmt: stf }, W('amount', 'voice')));
      slider(sec, Object.assign({ label: 'Detune', min: -30, max: 30, step: 1, def: 0, fmt: q => (q > 0 ? '+' : '') + q + ' c', tip: 'A few cents off makes a double sound like a second take.' }, W('cents', 'voice')));
      slider(sec, Object.assign({ label: 'Formant', min: -4, max: 4, step: 0.05, def: 0, fmt: stf, tip: 'Gives the voice a slightly different throat so it does not sound like a copy.' }, W('formant', 'voice')));
      slider(sec, Object.assign({ label: 'Level', min: -30, max: 3, step: 0.5, def: -10, fmt: dB }, W('level', 'live')));
      slider(sec, Object.assign({ label: 'Pan', min: -1, max: 1, step: 0.02, def: 0, fmt: q => Math.abs(q) < 0.01 ? 'C' : (q < 0 ? 'L' : 'R') + Math.round(Math.abs(q) * 100) }, W('pan', 'live')));
      slider(sec, Object.assign({ label: 'Late by', min: 0, max: 60, step: 1, def: 10, fmt: q => q + ' ms', tip: 'A little lateness sells it as another performance.' }, W('delay', 'offset')));
      host.append(sec);
    });
  }
  function liveVoices() {
    for (const n of S.play.nodes) {
      const v = S.voices.find(q => q.id === n.id); if (!v) continue;
      n.g.gain.setTargetAtTime(dbToLin(v.level), S.ctx.currentTime, 0.02); n.p.pan.setTargetAtTime(v.pan, S.ctx.currentTime, 0.02);
    }
  }

  function renderNotePanel() {
    const host = $('tab-note'); host.textContent = '';
    const sel = selNotes();
    if (!S.an) { host.append(Object.assign(el('div', 'sec'), { innerHTML: '<p>Load a vocal to see its notes.</p>' })); return; }
    const head = el('div', 'sec');
    if (!sel.length) {
      head.append(Object.assign(el('h3'), { textContent: 'No note selected' }));
      head.append(el('p', null, 'Click a note in the editor. Drag it up or down to change its pitch, drag the line between two notes to move the cut, double-click to split.'));
    } else {
      const idx = S.notes.indexOf(sel[0]), off = (S.tune.ref || 0) / 100;
      const names = sel.slice(0, 6).map(n => D.noteName(S.corr.targets[S.notes.indexOf(n)] - off)).join(' ');
      head.append(Object.assign(el('h3'), { textContent: sel.length + (sel.length > 1 ? ' notes' : ' note') }));
      head.append(el('div', 'big', names + (sel.length > 6 ? ' …' : '')));
      const sung = sel[0].center, tg = S.corr.targets[idx];
      head.append(el('p', null, sel.length === 1 ? 'Sung at ' + D.noteName(sung) + ' ' + ((sung - Math.round(sung)) >= 0 ? '+' : '') + Math.round((sung - Math.round(sung)) * 100) + ' cents · moved ' + (tg - sung >= 0 ? '+' : '') + Math.round((tg - sung) * 100) + ' cents' : 'Changes apply to all selected notes.'));
      const row = el('div', 'rowb');
      const btn = (label, tip, fn) => { const b = el('button', 'btn sm', label); b.title = tip; b.addEventListener('click', fn); row.append(b); };
      btn('▲', 'Up one scale note (↑)', () => nudgeSel(1));
      btn('▼', 'Down one scale note (↓)', () => nudgeSel(-1));
      btn(sel.every(n => n.off) ? 'Tune on' : 'Tune off', 'Leave this note exactly as it was sung (Del)', () => { const all = sel.every(n => n.off); editSel(n => { n.off = !all; }); });
      btn('Split', 'Cut the note at the playhead (S) — or double-click the note', splitAtPlayhead);
      btn('Merge', 'Join the selected touching notes (M)', mergeSel);
      btn('Reset', 'Back to automatic (R)', resetSel);
      head.append(row);
    }
    host.append(head);
    if (sel.length) {
      const first = sel[0], apply = fn => { sel.forEach(n => { fn(n); n.edited = true; }); };
      const s = el('div', 'sec'); s.append(Object.assign(el('h3'), { textContent: 'This note' }));
      const N = (get, set) => ({ get, set, kind: 'note', temp: true });
      slider(s, Object.assign({ label: 'Fine pitch', min: -100, max: 100, step: 1, def: 0, fmt: v => (v > 0 ? '+' : '') + v + ' c', tip: 'Cents away from the note. Use it for blue notes and deliberate bends.' },
        N(() => { const t = S.corr.targets[S.notes.indexOf(first)] - (S.tune.ref || 0) / 100; return Math.round((t - Math.round(t)) * 100); },
          v => { S.notes.forEach((n, i) => { if (S.sel.has(n.id)) { const t = S.corr.targets[i] - (S.tune.ref || 0) / 100; n.manual = Math.round(t) + v / 100 + (S.tune.ref || 0) / 100; n.edited = true; n.off = false; } }); })));
      slider(s, Object.assign({ label: 'Retune speed', min: -1, max: 400, step: 1, def: -1, fmt: v => v < 0 ? 'song' : v === 0 ? 'hard' : v + ' ms', tip: 'Own retune speed for this note. Far left = use the song setting.' },
        N(() => first.retune == null ? -1 : first.retune, v => apply(n => { n.retune = v < 0 ? null : v; }))));
      slider(s, Object.assign({ label: 'Vibrato', min: -0.02, max: 2, step: 0.02, def: -0.02, fmt: v => v < 0 ? 'song' : pct(v), tip: 'Own vibrato amount for this note. Far left = use the song setting.' },
        N(() => first.vib == null ? -0.02 : first.vib, v => apply(n => { n.vib = v < 0 ? null : v; }))));
      slider(s, Object.assign({ label: 'Formant', min: -6, max: 6, step: 0.1, def: 0, fmt: stf }, N(() => first.formant, v => apply(n => { n.formant = v; }))));
      slider(s, Object.assign({ label: 'Volume', min: -24, max: 12, step: 0.5, def: 0, fmt: dB, tip: 'Turn one note up or down — fix a shouted or swallowed word.' }, N(() => first.gain, v => apply(n => { n.gain = v; }))));
      host.append(s);
    }
    const g = el('div', 'sec'); g.append(Object.assign(el('h3'), { textContent: 'All notes' }));
    const row = el('div', 'rowb');
    const b1 = el('button', 'btn sm', 'Select all'); b1.addEventListener('click', () => { S.notes.forEach(n => S.sel.add(n.id)); renderNotePanel(); editor.draw(); });
    const b2 = el('button', 'btn sm', 'Read notes again'); b2.title = 'Throws away every manual edit and re-detects the notes';
    b2.addEventListener('click', () => { S.sel.clear(); resegment(true); requestRender(); commit(); renderNotePanel(); status('Notes re-read from the take.'); });
    row.append(b1, b2); g.append(row);
    const edited = S.notes.filter(n => n.edited).length;
    g.append(el('p', null, S.notes.length + ' notes' + (edited ? ' · ' + edited + ' edited by hand' : '')));
    host.append(g);
  }

  // ---------- export ----------
  function download(buf, name) {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportAudio(kind) {
    if (!S.vocal && !(kind === 'mix' && S.beat)) { status('Nothing to export yet.'); return; }
    busy('Rendering…', 0.2);
    await renderIdle();
    const sr = S.ctx.sampleRate, base = (S.vocal ? S.vocal.name : S.beat.name).replace(/\.[^.]+$/, '');
    try {
      if (kind === 'dry') { download(D.encodeWav([S.bufs.lead.getChannelData(0)], sr, 24), base + ' - tuned.wav'); busy(null); status('Exported the tuned vocal (dry).'); return; }
      const out = await renderMix(kind === 'mix');
      download(D.encodeWav(out, sr, 24), base + (kind === 'mix' ? ' - mix.wav' : ' - vocal fx.wav'));
      status('Exported ' + (kind === 'mix' ? 'the full mix.' : 'the vocal with effects.'));
    } catch (err) { console.error(err); status('Export failed: ' + err.message); }
    busy(null);
  }
  async function renderMix(withBeat) {
    const sr = S.ctx.sampleRate, lat = S.lat.total;
    const dur = withBeat ? S.total() : S.vStart + S.vocal.x.length / sr;
    const tail = (S.mix.reverb.on ? S.mix.reverb.decay : 0) + (S.mix.delay.on ? 1.5 : 0) + 0.3;
    const off = new OfflineAudioContext(2, Math.ceil((dur + tail + lat) * sr), sr), ch = Mix.create(off, S.lat);
    ch.apply(S.mix, mixEnv()); ch.out.connect(off.destination);
    addSources(off, ch, 0, 0, { vocal: !!S.vocal, beat: withBeat, offline: true });
    const r = await off.startRendering(), skip = Math.round(lat * sr);
    return [r.getChannelData(0).subarray(skip), r.getChannelData(1).subarray(skip)];
  }
  S.renderMix = renderMix;

  // ---------- recording ----------
  let rec = null, recReady = false;
  const REC_SRC = 'class R extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(2048);this.n=0;this.t=0}process(i){const c=i[0]&&i[0][0];if(c){if(!this.n)this.t=currentTime;this.b.set(c,this.n);this.n+=c.length;if(this.n>=2048){this.port.postMessage({b:this.b.slice(0,this.n),t:this.t});this.n=0}}return true}}registerProcessor("machine-rec",R)';
  async function startRec() {
    if (rec) return;
    try {
      await ensureCtx(); await S.ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      if (!recReady) { await S.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([REC_SRC], { type: 'application/javascript' }))); recReady = true; }
      pause();
      const src = S.ctx.createMediaStreamSource(stream), node = new AudioWorkletNode(S.ctx, 'machine-rec', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 });
      rec = { stream, src, node, chunks: [], t0: 0, len: 0, pos0: S.beat ? S.play.pos : 0, playT0: 0, inLat: (stream.getAudioTracks()[0].getSettings().latency || 0.01) };
      node.port.onmessage = e => {
        if (!rec) return;
        if (!rec.chunks.length) rec.t0 = e.data.t;
        rec.chunks.push(e.data.b); rec.len += e.data.b.length;
        let pk = 0; for (let i = 0; i < e.data.b.length; i++) pk = Math.max(pk, Math.abs(e.data.b[i]));
        $('recMeter').style.width = D.clamp((D.linToDb(pk) + 48) / 48, 0, 1) * 100 + '%';
        $('recTime').textContent = fmtTime(rec.len / S.ctx.sampleRate);
      };
      src.connect(node);
      $('recbox').hidden = false; $('empty').hidden = true;
      if (S.beat) { await play(rec.pos0, { vocal: false, beat: true }); rec.playT0 = S.play.t0; status('Recording over the beat — wear headphones so the beat does not bleed into the mic.'); }
      else { status('Recording… sing, then press Stop.'); tick(); }
    } catch (err) { console.error(err); rec = null; status(err.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the browser address bar and try again.' : 'Could not start recording: ' + err.message); }
  }
  function stopRec(cancel) {
    if (!rec) return;
    const r = rec; rec = null;
    try { r.src.disconnect(); r.node.port.onmessage = null; r.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    pause(); $('recbox').hidden = true;
    if (cancel || r.len < S.ctx.sampleRate * 0.3) { if (!S.vocal) $('empty').hidden = false; status(cancel ? 'Recording discarded.' : 'That was too short to use.'); return; }
    let x = new Float32Array(r.len), o = 0;
    for (const c of r.chunks) { x.set(c, o); o += c.length; }
    const sr = S.ctx.sampleRate;
    if (S.beat) {
      // where on the timeline the first recorded sample belongs: what was playing when it was sung
      const lag = (S.ctx.outputLatency || 0) + (S.ctx.baseLatency || 0) + r.inLat;
      let start = r.pos0 + (r.t0 - r.playT0) - lag;
      if (start < 0) { x = x.subarray(Math.min(x.length, Math.round(-start * sr))); start = 0; }
      const beatAt = start - S.bStart;                         // beat time of vocal sample 0
      if (beatAt >= 0) { S.vStart = beatAt; S.bStart = 0; } else { S.vStart = 0; S.bStart = -beatAt; }
    }
    loadVocal(x.slice(), sr, 'Recording');
  }

  // ---------- session (IndexedDB) ----------
  let db = null;
  const idb = () => new Promise(res => {
    if (db) return res(db);
    try {
      const rq = indexedDB.open('machine-studio', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('s');
      rq.onsuccess = () => { db = rq.result; res(db); };
      rq.onerror = () => res(null);
    } catch (_) { res(null); }
  });
  const put = async (k, v) => { const d = await idb(); if (!d) return; try { d.transaction('s', 'readwrite').objectStore('s').put(v, k); } catch (_) {} };
  const get = async k => { const d = await idb(); if (!d) return null; return new Promise(res => { try { const rq = d.transaction('s').objectStore('s').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (_) { res(null); } }); };
  const saveVocal = () => { if (S.vocal) put('vocal', { x: S.vocal.x, sr: S.vocal.sr, name: S.vocal.name }); };
  const saveBeat = (bytes, name) => put('beat', { bytes, name });
  let saveT = 0;
  function saveState() { clearTimeout(saveT); saveT = setTimeout(() => put('state', S.last), 400); }
  async function restoreSession() {
    const v = await get('vocal'); if (!v || !v.x || !v.x.length) return;
    await ensureCtx();
    if (v.sr !== S.ctx.sampleRate) return;
    const st = await get('state'); let notes = null;
    if (st) { try { const o = JSON.parse(st); S.tune = Object.assign(D.defaultTune(), o.tune); S.voices = o.voices || []; S.vid = S.voices.length + 100; S.vStart = o.vStart || 0; S.bStart = o.bStart || 0; S.style = o.style || 'pop'; const m = Mix.defaults(); for (const k of Object.keys(m)) Object.assign(m[k], (o.mix || {})[k]); S.mix = m; notes = o.notes; } catch (_) {} }
    const b = await get('beat');
    if (b && b.bytes) { try { const buf = await new Promise((res, rej) => S.ctx.decodeAudioData(b.bytes.slice(0), res, rej)); const mono = toMono(buf), head = mono.subarray(0, Math.min(mono.length, buf.sampleRate * 90)); S.beat = { buffer: buf, name: b.name, keys: D.keysFromChroma(D.chromaFromAudio(head, buf.sampleRate)).slice(0, 6), bpm: D.detectTempo(head, buf.sampleRate) }; } catch (_) {} }
    renderStack();
    loadVocal(v.x, v.sr, v.name, notes && notes.length ? notes : null);
    status('Picked up where you left off.');
  }
  async function newSession() {
    pause(); S.token++;
    S.vocal = null; S.an = null; S.notes = []; S.corr = null; S.hOut = []; S.beat = null; S.bufs = {}; S.peaks = null; S.sel.clear(); S.loop = null;
    S.vStart = S.bStart = 0; S.play.pos = 0; S.undo = []; S.redo = []; S.last = '';
    const d = await idb(); if (d) try { d.transaction('s', 'readwrite').objectStore('s').clear(); } catch (_) {}
    $('empty').hidden = false; renderNotePanel(); editor.draw(); showTime(); status('New session.');
  }

  // ---------- wiring ----------
  const editor = window.MachineEditor($('ed'), S, {
    seek, status, commit, requestRender, splitNote,
    recompute() { computeAll(); editor.draw(); },
    selectionChanged() { renderNotePanel(); if (S.sel.size && !$('tab-note').classList.contains('on') && autoTab) showTab('note'); },
    loopChanged() { if (S.loop && S.loop.b - S.loop.a > 0.05) { S.loopOn = true; } else { S.loop = null; } $('btnLoop').classList.toggle('on', S.loopOn); }
  });
  let autoTab = true;
  function showTab(name) {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
    if (name === 'mix') drawEq();
    S.showHarm = name === 'stack'; editor.draw();
  }
  $('tabs').addEventListener('click', e => { const t = e.target.dataset.tab; if (t) { showTab(t); autoTab = t === 'note' || t === 'tune'; } });

  D.NOTE_NAMES.forEach((n, i) => $('selKey').append(new Option(n, i)));
  Object.keys(D.SCALES).forEach(k => $('selScale').append(new Option(D.SCALES[k].name, k)));
  $('selScale').append(new Option('Custom', 'custom'));
  STYLES.forEach(s => $('selStyle').append(new Option(s.name, s.id)));
  $('selKey').addEventListener('change', e => { S.tune.key = +e.target.value; if (S.tune.custom) { S.tune.custom = null; } syncAll(); changed('scale'); commit(); status('Key: ' + keyName()); });
  $('selScale').addEventListener('change', e => { if (e.target.value === 'custom') S.tune.custom = D.tuneMask(S.tune); else { S.tune.scale = e.target.value; S.tune.custom = null; } syncAll(); changed('scale'); commit(); });
  $('selStyle').addEventListener('change', e => { applyStyle(e.target.value); status('Style: ' + STYLES.find(s => s.id === S.style).name); });
  $('btnAutoKey').addEventListener('click', () => { if (!S.an) return; detectKey(false); syncAll(); changed('scale'); commit(); status('Key set to ' + keyName() + '.'); });

  $('btnVocal').addEventListener('click', () => $('fileVocal').click());
  $('emptyLoad').addEventListener('click', () => $('fileVocal').click());
  $('btnBeat').addEventListener('click', () => $('fileBeat').click());
  $('fileVocal').addEventListener('change', e => { if (e.target.files[0]) loadVocalFile(e.target.files[0]); e.target.value = ''; });
  $('fileBeat').addEventListener('change', e => { if (e.target.files[0]) loadBeatFile(e.target.files[0]); e.target.value = ''; });
  $('emptyDemo').addEventListener('click', loadDemo);
  $('btnRec').addEventListener('click', () => rec ? stopRec(false) : startRec());
  $('emptyRec').addEventListener('click', startRec);
  $('recStop').addEventListener('click', () => stopRec(false));
  $('recCancel').addEventListener('click', () => stopRec(true));
  $('btnPlay').addEventListener('click', () => S.play.playing ? pause() : play());
  $('btnStart').addEventListener('click', () => seek(0));
  function toggleLoop() {
    if (S.loopOn) { S.loopOn = false; S.loop = null; }
    else {
      S.loopOn = true;
      const sel = selNotes();
      if (sel.length && S.an) { const k = S.an.hop / S.an.sr; S.loop = { a: S.vStart + Math.min(...sel.map(n => n.s)) * k - 0.15, b: S.vStart + Math.max(...sel.map(n => n.e)) * k + 0.15 }; S.loop.a = Math.max(0, S.loop.a); }
    }
    $('btnLoop').classList.toggle('on', S.loopOn); editor.draw();
    status(S.loopOn ? (S.loop ? 'Looping the selection.' : 'Looping the whole take. Drag on the time ruler to loop a part.') : 'Loop off.');
  }
  $('btnLoop').addEventListener('click', toggleLoop);
  function toggleAB() { S.bypass = !S.bypass; $('btnAB').classList.toggle('on', S.bypass); editor.draw(); if (S.play.playing) play(currentPos()); status(S.bypass ? 'Hearing the original take (still through the mix chain).' : 'Hearing the tuned vocal.'); }
  $('btnAB').addEventListener('click', toggleAB);
  $('btnUndo').addEventListener('click', undo); $('btnRedo').addEventListener('click', redo);
  $('zoomIn').addEventListener('click', () => editor.zoom(1.5)); $('zoomOut').addEventListener('click', () => editor.zoom(1 / 1.5)); $('zoomFit').addEventListener('click', () => editor.fit());
  $('btnExport').addEventListener('click', e => { e.stopPropagation(); $('popExport').hidden = !$('popExport').hidden; });
  $('popExport').addEventListener('click', e => { const k = e.target.dataset.x; $('popExport').hidden = true; if (k === 'new') newSession(); else if (k) exportAudio(k); });
  { const b = el('button', null, 'Start a new session (clears this one)'); b.dataset.x = 'new'; $('popExport').append(b); }
  document.addEventListener('click', () => { $('popExport').hidden = true; });

  const stage = $('stage');
  // with a vocal loaded, the left half of the editor replaces the vocal and the right half loads a beat
  const dropKind = e => { if (!S.vocal) return 'vocal'; const r = stage.getBoundingClientRect(); return e.clientX - r.left < r.width / 2 ? 'vocal' : 'beat'; };
  ['dragenter', 'dragover'].forEach(t => stage.addEventListener(t, e => {
    e.preventDefault(); stage.classList.add('drag');
    stage.dataset.drop = !S.vocal ? 'Drop the vocal' : dropKind(e) === 'vocal' ? '◀ Replace the vocal' : 'Load as the beat ▶';
  }));
  stage.addEventListener('dragleave', e => { if (!stage.contains(e.relatedTarget)) stage.classList.remove('drag'); });
  stage.addEventListener('drop', e => {
    e.preventDefault(); stage.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (dropKind(e) === 'beat') loadBeatFile(f); else loadVocalFile(f);
  });

  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'));
    if (typing) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    if (k === ' ') { e.preventDefault(); S.play.playing ? pause() : play(); }
    else if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (mod && k.toLowerCase() === 'a') { e.preventDefault(); S.notes.forEach(n => S.sel.add(n.id)); renderNotePanel(); editor.draw(); }
    else if (mod) return;
    else if (k === 'Home') seek(0);
    else if (k === 'Escape') { S.sel.clear(); renderNotePanel(); editor.draw(); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { if (!S.sel.size || t.type === 'range') return; e.preventDefault(); nudgeSel(k === 'ArrowUp' ? 1 : -1, e.altKey ? 'cents' : e.shiftKey ? 'oct' : 'scale'); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (t.type === 'range' || !S.notes.length) return; e.preventDefault();
      const cur = S.notes.findIndex(n => S.sel.has(n.id)), nx = D.clamp(cur < 0 ? 0 : cur + (k === 'ArrowRight' ? 1 : -1), 0, S.notes.length - 1);
      S.sel.clear(); S.sel.add(S.notes[nx].id); renderNotePanel(); editor.draw();
    }
    else if (k === 'Delete' || k === 'Backspace') { const sel = selNotes(); if (sel.length) { e.preventDefault(); const all = sel.every(n => n.off); editSel(n => { n.off = !all; }, all ? 'Tuning back on.' : 'Left as sung.'); } }
    else if (k === 's' || k === 'S') splitAtPlayhead();
    else if (k === 'm' || k === 'M') mergeSel();
    else if (k === 'r' || k === 'R') resetSel();
    else if (k === 'l' || k === 'L') toggleLoop();
    else if (k === 'b' || k === 'B') toggleAB();
    else if (k === '+' || k === '=') editor.zoom(1.4);
    else if (k === '-') editor.zoom(1 / 1.4);
  });
  window.addEventListener('beforeunload', () => { if (S.last) put('state', S.last); });

  applyStyle('pop', true);
  buildTune(); buildMix(); renderStack(); renderNotePanel(); syncAll(); showTime();
  editor.resize();
  restoreSession();
})();
