/* Maut ki Awaaz — audio host: builds the AudioWorklet from the engine modules (data: URL, works from file://), runs it,
   converts engine sample times to AudioContext time, records the master (lossless WAV) and renders whole pieces offline. */
'use strict';
const AWZ_MODS = [AWZ_UTIL, AWZ_DSP, AWZ_DRUMS, AWZ_SYNTH, AWZ_FX, AWZ_FX2, AWZ_SYNTH2, AWZ_INST, AWZ_MIXER, AWZ_THEORY, AWZ_PARTS, AWZ_PARTS2, AWZ_ACID, AWZ_COMPOSER, AWZ_MOVES, AWZ_TARGET, AWZ_NORM, AWZ_WORLDS, AWZ_WORLDS2, AWZ_ENGINE];
const AWZ = {}; AWZ_MODS.forEach(f => f(AWZ));   // main-thread namespace (genomes, theory, world list)

function awzWorkletSource(){
  const mods = AWZ_MODS.map(f => f.toString()).join('\n');
  return mods + `
const MODS = [${AWZ_MODS.map(f => f.name).join(', ')}];
class AwaazProcessor extends AudioWorkletProcessor {
  constructor(){ super(); const A = this.A = {}; MODS.forEach(f => f(A)); this.e = new A.Engine(sampleRate); this.e.playing = false; this.q = 0; this.rec = false; this.recL = []; this.recR = []; this.recN = 0; this.offline = false;
    this.e.onEnd = () => null; this.port.onmessage = ev => this.msg(ev.data); }
  msg(m){ const e = this.e; try { switch (m.type){
      case 'load': e.load(m.genome); if (m.macros) for (const k in m.macros) e.setMacro(k, m.macros[k]); break;
      case 'queue': e.queue(m.genome); break;
      case 'play': e.playing = !!m.on; break;
      case 'macro': e.setMacro(m.k, m.v); break;
      case 'nudge': e.nudge(m.kind); break;
      case 'voice': e.voice(m.slot, m.cmd); break;
      case 'next': e.next(); break;
      case 'seek': e.seek(m.bar); break;
      case 'auto': e.auto = !!m.on; break;
      case 'math': e.mathOn = !!m.on; break;
      case 'v2': if (e.setV2) e.setV2(m.on); else e.v2 = !!m.on; break;
      case 'endMode': e.endMode = m.mode; break;
      case 'rec': this.rec = !!m.on; if (!m.on){ this.flushRec(); this.port.postMessage({type: 'pcmEnd'}); } break;
      case 'offline': this.offline = true; break; } } catch (err){ this.port.postMessage({type: 'error', msg: String(err && err.stack || err)}); } }
  flushRec(){ if (!this.recN) return; const L = new Float32Array(this.recN), R = new Float32Array(this.recN); let o = 0; for (let i = 0; i < this.recL.length; i++){ L.set(this.recL[i], o); R.set(this.recR[i], o); o += this.recL[i].length; }
    this.recL = []; this.recR = []; this.recN = 0; this.port.postMessage({type: 'pcm', L, R}, [L.buffer, R.buffer]); }
  process(ins, outs){ const o = outs[0], L = o[0], R = o[1] || o[0], n = L.length, e = this.e;
    if (!e.playing || !e.comp){ L.fill(0); R.fill(0); } else { try { const t0 = this.offline ? 0 : Date.now(); e.process(L, R, n); if (!this.offline && e.govern) e.govern(Date.now() - t0, n); } catch (err){ L.fill(0); R.fill(0); if (!this.errSent){ this.errSent = true; this.port.postMessage({type: 'error', msg: String(err && err.stack || err)}); } } }
    if (this.rec && e.playing){ this.recL.push(L.slice()); this.recR.push(R.slice()); this.recN += n; if (this.recN >= sampleRate * 2) this.flushRec(); }
    if (!this.offline && ++this.q >= 4){ this.q = 0; const d = e.out.drain(); if (d.notes.length || d.msgs.length) this.port.postMessage({type: 'out', now: currentTime + n / sampleRate, et: e.t, sr: sampleRate, notes: d.notes, msgs: d.msgs}, [d.notes.buffer]); }
    else if (this.offline) e.out.drain();
    return true; } }
registerProcessor('awaaz', AwaazProcessor);`; }
function awzDataURL(src){ const bytes = new TextEncoder().encode(src); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return 'data:application/javascript;base64,' + btoa(bin); }

class AwaazHost {
  constructor(){ this.ctx = null; this.node = null; this.handlers = []; this.recChunks = null; this.src = null; this.url = null; this.playing = false; this.tsFilt = null; this.avOffset = 0; }
  on(fn){ this.handlers.push(fn); }
  async start(){ const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C({latencyHint: 'playback', sampleRate: 48000});
    this.src = awzWorkletSource(); this.url = awzDataURL(this.src);
    try { await this.ctx.audioWorklet.addModule(this.url); }
    catch (err){ const blob = URL.createObjectURL(new Blob([this.src], {type: 'application/javascript'})); await this.ctx.audioWorklet.addModule(blob); this.url = blob; }
    this.node = new AudioWorkletNode(this.ctx, 'awaaz', {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]});
    this.master = this.ctx.createGain(); this.node.connect(this.master); this.master.connect(this.ctx.destination);
    this.split = this.ctx.createChannelSplitter(2); this.master.connect(this.split);
    this.aL = this.ctx.createAnalyser(); this.aR = this.ctx.createAnalyser(); this.aL.fftSize = this.aR.fftSize = 2048; this.split.connect(this.aL, 0); this.split.connect(this.aR, 1);
    this.aM = this.ctx.createAnalyser(); this.aM.fftSize = 8192; this.aM.smoothingTimeConstant = .5; this.master.connect(this.aM);
    this.streamDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.streamDest);
    this.node.port.onmessage = ev => this.recv(ev.data); this.node.onprocessorerror = () => { for (const h of this.handlers) h({type: 'error', msg: 'audio engine crashed'}); }; await this.ctx.resume(); }
  recv(m){ if (m.type === 'pcm'){ if (this.recChunks) this.recChunks.push(m); return; } if (m.type === 'pcmEnd'){ if (this.recDone) this.recDone(); return; }
    if (m.type === 'error'){ console.error('[engine]', m.msg); }
    for (const h of this.handlers) h(m); }
  send(m){ if (this.node) this.node.port.postMessage(m); }
  load(genome, macros){ this.send({type: 'load', genome, macros}); }
  play(on){ this.playing = on; this.send({type: 'play', on}); if (on && this.ctx.state !== 'running') this.ctx.resume(); }
  // the time the listener hears right now (research/05 §4.3)
  now(){ const c = this.ctx; if (!c) return 0; let t; const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null;
    if (ts && ts.performanceTime > 0) t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000; else t = c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0);
    this.tsFilt = this.tsFilt === null ? t : Math.max(this.tsFilt, this.tsFilt + (t - this.tsFilt) * .2); return this.tsFilt + .016 + this.avOffset; }
  // ---------------------------------------------------------------- recording (lossless, from inside the worklet)
  recStart(){ this.recChunks = []; this.send({type: 'rec', on: true}); }
  recStop(){ return new Promise(res => { const fin = () => { this.recDone = null; const ch = this.recChunks || []; this.recChunks = null; res(awzWav(ch, this.ctx.sampleRate)); }; this.recDone = fin; this.send({type: 'rec', on: false}); setTimeout(() => { if (this.recDone) fin(); }, 3000); }); }
  // ---------------------------------------------------------------- offline render of a whole piece
  async renderOffline(genome, macros, seconds, onProgress){ const sr = 48000, N = Math.ceil(seconds * sr); const oc = new OfflineAudioContext(2, N, sr);
    await oc.audioWorklet.addModule(this.url); const node = new AudioWorkletNode(oc, 'awaaz', {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]}); node.connect(oc.destination);
    node.port.postMessage({type: 'offline'}); node.port.postMessage({type: 'auto', on: false}); node.port.postMessage({type: 'load', genome, macros}); node.port.postMessage({type: 'play', on: true});
    // throttled: after every second of rendered audio, rest as long as that second took (≈50% duty), so a live session playing
    // at the same time keeps its CPU and never stutters while you export
    const step = 1; let last = performance.now(); for (let t = step; t < seconds; t += step) oc.suspend(t).then(() => { onProgress && onProgress(t / seconds); const busy = performance.now() - last; setTimeout(() => { last = performance.now(); oc.resume(); }, this.ctx && this.ctx.state === 'running' ? Math.min(250, busy) : 0); });
    await new Promise(r => setTimeout(r, 50));   // let the port messages land before rendering starts
    const buf = await oc.startRendering(); onProgress && onProgress(1);
    // trim the trailing silence, keep 1 s
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let end = L.length; while (end > sr && Math.abs(L[end - 1]) < 1e-4 && Math.abs(R[end - 1]) < 1e-4) end--; end = Math.min(L.length, end + sr);
    return awzWav([{L: L.subarray(0, end), R: R.subarray(0, end)}], sr); } }

function awzWav(chunks, sr){ let N = 0; for (const c of chunks) N += c.L.length; const b = new ArrayBuffer(44 + N * 4), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + N * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, N * 4, true);
  let o = 44; for (const c of chunks) for (let i = 0; i < c.L.length; i++){ v.setInt16(o, Math.max(-32767, Math.min(32767, c.L[i] * 32767 | 0)), true); v.setInt16(o + 2, Math.max(-32767, Math.min(32767, c.R[i] * 32767 | 0)), true); o += 4; }
  return new Blob([b], {type: 'audio/wav'}); }
function awzDownload(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
