/* ganYEET BARS — audio host: the worklet (scene engine + mic chain + recorder), the mic, offline export. */
'use strict';
const BARS_MODS = [AWZ_UTIL, AWZ_DSP, AWZ_DRUMS, AWZ_SYNTH, AWZ_FX, AWZ_FX2, AWZ_SYNTH2, AWZ_INST, AWZ_MIXER, AWZ_THEORY, AWZ_PARTS, AWZ_PARTS2, AWZ_ACID, AWZ_COMPOSER, AWZ_MOVES, AWZ_TARGET, AWZ_NORM, AWZ_WORLDS, AWZ_WORLDS2, AWZ_GHOSTS, AWZ_AO, AWZ_ENGINE, AWZ_B_VOICES, AWZ_B_SCENES, AWZ_B_ENGINE];
const BA = {}; BARS_MODS.forEach(f => f(BA));
function barsWorkletSource(){ return BARS_MODS.map(f => f.toString()).join('\n') + `\nconst MODS = [${BARS_MODS.map(f => f.name).join(', ')}];\n` + `
class BarsProcessor extends AudioWorkletProcessor {
  constructor(){ super(); const A = this.A = {}; MODS.forEach(f => f(A)); this.e = new A.BeatEngine(sampleRate); this.e.playing = false; this.vc = new A.VoiceChain(sampleRate); this.vl = new Float32Array(128); this.vr = new Float32Array(128); this.mic = false; this.mon = false; this.voxG = 1; this.beatG = 1; this.offline = false; this.q = 0; this.rec = false; this.recAt = -1; this.rL = []; this.rR = []; this.rM = []; this.rN = 0; this.lvl = 0; this.port.onmessage = ev => this.msg(ev.data); }
  msg(m){ const e = this.e; try { switch (m.type){
      case 'load': e.load(m.genome); if (m.dials) for (const k in m.dials) this.dial(k, m.dials[k]); break;
      case 'play': e.playing = !!m.on; break;
      case 'dial': this.dial(m.k, m.v); break;
      case 'section': e.section(m.section); break;
      case 'mute': e.setMute(m.cat, m.on); break;
      case 'listens': e.listens = !!m.on; break;
      case 'mic': this.mic = !!m.on; e.voxOn = !!m.on; break;
      case 'monitor': this.mon = !!m.on; break;
      case 'voxFx': this.vc.setFx(m.fx, m.bpm); break;
      case 'levels': if (m.beat !== undefined) this.beatG = m.beat; if (m.vox !== undefined) this.voxG = m.vox; break;
      case 'rec': if (m.on){ this.rec = true; this.recAt = e.comp ? e.comp.t : 0; this.rL = []; this.rR = []; this.rM = []; this.rN = 0; } else { this.rec = false; this.flush(); this.port.postMessage({type: 'recEnd'}); } break;
      case 'offline': this.offline = true; e.endMode = 'stop'; break; } } catch (err){ this.port.postMessage({type: 'error', msg: String(err && err.stack || err)}); } }
  dial(k, v){ const e = this.e; if (k === 'hard') e.applyHard(v); else if (k === 'dirt') e.applyDirt(v); else if (k === 'bounce') e.setBounce(v); else if (k === 'space') e.setMacro('space', v); }
  flush(){ if (!this.rN) return; const L = new Float32Array(this.rN), R = new Float32Array(this.rN), M = new Float32Array(this.rN); let o = 0; for (let i = 0; i < this.rL.length; i++){ L.set(this.rL[i], o); R.set(this.rR[i], o); M.set(this.rM[i], o); o += this.rL[i].length; } this.rL = []; this.rR = []; this.rM = []; this.rN = 0; this.port.postMessage({type: 'pcm', L, R, M}, [L.buffer, R.buffer, M.buffer]); }
  process(ins, outs){ const o = outs[0], L = o[0], R = o[1] || o[0], n = L.length, e = this.e, inp = ins[0] && ins[0][0], micOn = this.mic && inp && inp.length === n, mic = micOn ? inp : null;
    if (!e.playing || !e.comp){ L.fill(0); R.fill(0); } else { try { const t0 = this.offline ? 0 : Date.now(); e.process(L, R, n); if (!this.offline && e.govern) e.govern(Date.now() - t0, n); } catch (err){ L.fill(0); R.fill(0); if (!this.errSent){ this.errSent = true; this.port.postMessage({type: 'error', msg: String(err && err.stack || err)}); } } }
    if (this.rec && e.playing && e.t > this.recAt){ this.rL.push(L.slice()); this.rR.push(R.slice()); this.rM.push(mic ? mic.slice() : new Float32Array(n)); this.rN += n; if (this.rN >= sampleRate * 2) this.flush(); }
    if (this.beatG !== 1) for (let i = 0; i < n; i++){ L[i] *= this.beatG; R[i] *= this.beatG; }
    if (mic){ let pk = 0; for (let i = 0; i < n; i++){ const a = mic[i] < 0 ? -mic[i] : mic[i]; if (a > pk) pk = a; } this.lvl = Math.max(pk, this.lvl * .985); e.voxTick(this.lvl, n);
      if (this.mon){ const vl = this.vl, vr = this.vr; vl.fill(0); vr.fill(0); this.vc.process(mic, vl, vr, n, this.voxG); for (let i = 0; i < n; i++){ L[i] += vl[i]; R[i] += vr[i]; } } }
    if (!this.offline && ++this.q >= 4){ this.q = 0; const d = e.out.drain(); const vox = micOn ? {lvl: this.lvl, singing: !!e.voxSinging} : null; if (d.notes.length || d.msgs.length || vox) this.port.postMessage({type: 'out', now: currentTime + n / sampleRate, et: e.t, sr: sampleRate, notes: d.notes, msgs: d.msgs, vox, load: e.gov ? e.gov.load : 0}, [d.notes.buffer]); }
    else if (this.offline) e.out.drain();
    return true; } }
registerProcessor('bars', BarsProcessor);`; }
function barsDataURL(src){ const bytes = new TextEncoder().encode(src); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return 'data:application/javascript;base64,' + btoa(bin); }

class BarsHost {
  constructor(){ this.ctx = null; this.node = null; this.handlers = []; this.tsFilt = null; this.micStream = null; this.micSrc = null; this.chunks = null; this.recDone = null; }
  on(fn){ this.handlers.push(fn); }
  emit(m){ for (const h of this.handlers) h(m); }
  async start(steady){ const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C({latencyHint: steady ? 'playback' : 'interactive', sampleRate: 48000}); this.src = barsWorkletSource();
    const blob = URL.createObjectURL(new Blob([this.src], {type: 'application/javascript'})); try { await this.ctx.audioWorklet.addModule(blob); this.url = blob; } catch (err){ this.url = barsDataURL(this.src); await this.ctx.audioWorklet.addModule(this.url); }
    this.node = new AudioWorkletNode(this.ctx, 'bars', {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 1, channelCountMode: 'explicit'}); this.node.connect(this.ctx.destination);
    this.node.port.onmessage = ev => this.recv(ev.data); this.node.onprocessorerror = () => this.emit({type: 'error', msg: 'The audio engine stopped.'}); await this.ctx.resume(); }
  recv(m){ if (m.type === 'pcm'){ if (this.chunks) this.chunks.push(m); return; } if (m.type === 'recEnd'){ if (this.recDone) this.recDone(); return; } if (m.type === 'error') console.error('[bars]', m.msg); this.emit(m); }
  send(m){ if (this.node) this.node.port.postMessage(m); }
  now(){ const c = this.ctx; if (!c) return 0; let t; const ts = c.getOutputTimestamp ? c.getOutputTimestamp() : null; if (ts && ts.performanceTime > 0) t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000; else t = c.currentTime - (c.outputLatency || 0) - (c.baseLatency || 0); this.tsFilt = this.tsFilt === null ? t : Math.max(this.tsFilt, this.tsFilt + (t - this.tsFilt) * .2); return this.tsFilt; }
  async micOn(deviceId){ if (this.micStream) this.micOff(); const audio = {echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, latency: 0}; if (deviceId) audio.deviceId = {exact: deviceId}; const st = await navigator.mediaDevices.getUserMedia({audio}); this.micStream = st; this.micSrc = this.ctx.createMediaStreamSource(st); this.micSrc.connect(this.node); this.micAn = this.ctx.createAnalyser(); this.micAn.fftSize = 2048; this.micSrc.connect(this.micAn); this.send({type: 'mic', on: true}); return st; }
  micOff(){ if (this.micSrc){ try { this.micSrc.disconnect(); } catch (e){} } if (this.micStream) this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; this.micSrc = null; this.micAn = null; this.send({type: 'mic', on: false}); }
  roundTrip(){ const c = this.ctx; if (!c) return 0; let inL = .008; if (this.micStream){ const s = this.micStream.getAudioTracks()[0].getSettings(); if (s.latency) inL = s.latency; } return (c.outputLatency || 0) + (c.baseLatency || 0) + inL; }
  recStart(){ this.chunks = []; this.send({type: 'rec', on: true}); }
  recStop(){ return new Promise(res => { const fin = () => { this.recDone = null; const ch = this.chunks || []; this.chunks = null; let N = 0; for (const c of ch) N += c.L.length; const L = new Float32Array(N), R = new Float32Array(N), M = new Float32Array(N); let o = 0; for (const c of ch){ L.set(c.L, o); R.set(c.R, o); M.set(c.M, o); o += c.L.length; } res({L, R, M, sr: this.ctx.sampleRate, roundTrip: this.roundTrip()}); }; this.recDone = fin; this.send({type: 'rec', on: false}); setTimeout(() => { if (this.recDone) fin(); }, 3000); }); }
  // the whole song, faster than real time
  async renderSong(genome, dials, onProgress){ const sr = 48000, bars = BA.FORMS.rapsong.reduce((a, s) => a + s[1], 0), seconds = bars * 240 / genome.bpm + 6; const oc = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr); await oc.audioWorklet.addModule(this.url); const node = new AudioWorkletNode(oc, 'bars', {numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]}); node.connect(oc.destination);
    node.port.postMessage({type: 'offline'}); node.port.postMessage({type: 'load', genome, dials}); node.port.postMessage({type: 'play', on: true});
    for (let t = 2; t < seconds; t += 2) oc.suspend(t).then(() => { onProgress && onProgress(t / seconds); setTimeout(() => oc.resume(), 0); });
    await new Promise(r => setTimeout(r, 80)); const buf = await oc.startRendering(); onProgress && onProgress(1); return barsWav([buf.getChannelData(0), buf.getChannelData(1)], sr, 16); } }

function barsMixTake(take, nudgeMs, fx, voxGain, bpm){ const sr = take.sr, N = take.L.length, off = Math.round((take.roundTrip + (nudgeMs || 0) / 1000) * sr), vc = new BA.VoiceChain(sr); vc.setFx(fx || 'room', bpm || 90); const L = take.L.slice(), R = take.R.slice(), vocal = new Float32Array(N), bl = new Float32Array(128), br = new Float32Array(128), inp = new Float32Array(128); for (let i = 0; i < N; i++){ const j = i + off; vocal[i] = j >= 0 && j < N ? take.M[j] : 0; }
  for (let p = 0; p < N; p += 128){ const n = Math.min(128, N - p); inp.fill(0); inp.set(vocal.subarray(p, p + n)); bl.fill(0); br.fill(0); vc.process(inp, bl, br, 128, voxGain === undefined ? 1 : voxGain); for (let i = 0; i < n; i++){ L[p + i] += bl[i]; R[p + i] += br[i]; } }
  let pk = 1e-6; for (let i = 0; i < N; i++){ const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; } if (pk > .98){ const k = .98 / pk; for (let i = 0; i < N; i++){ L[i] *= k; R[i] *= k; } } return {L, R, vocal}; }
function barsWav(chans, sr, bits){ const ch = chans.length, N = chans[0].length, by = bits === 24 ? 3 : 2, block = ch * by, b = new ArrayBuffer(44 + N * block), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + N * block, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * block, true); v.setUint16(32, block, true); v.setUint16(34, by * 8, true); w(36, 'data'); v.setUint32(40, N * block, true); let o = 44; const max = by === 3 ? 8388607 : 32767;
  for (let i = 0; i < N; i++) for (let c = 0; c < ch; c++){ const x = Math.max(-max, Math.min(max, Math.round(chans[c][i] * max))); if (by === 3){ v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); } else v.setInt16(o, x, true); o += by; } return new Blob([b], {type: 'audio/wav'}); }
function barsDownload(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); }
function barsPitch(buf, sr){ const N = buf.length; let rms = 0; for (let i = 0; i < N; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / N); if (rms < .012) return 0; const minL = Math.floor(sr / 900), maxL = Math.min(Math.floor(sr / 75), N >> 1); let best = -1, bestL = 0, prev = 0, rising = false; let n0 = 1e-9; for (let i = 0; i < N - maxL; i++) n0 += buf[i] * buf[i]; for (let L = minL; L <= maxL; L++){ let s = 0; for (let i = 0; i < N - maxL; i++) s += buf[i] * buf[i + L]; s /= n0; if (s > prev) rising = true; if (rising && s > best){ best = s; bestL = L; } if (best > .86 && s < best - .12) break; prev = s; } return best > .72 ? sr / bestL : 0; }
