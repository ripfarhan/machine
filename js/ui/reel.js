/* Maut ki Awaaz — REEL mode: a 9:16 (1080×1920) composited visual of the live music, recordable straight to a video
   file (canvas.captureStream + the master audio → MediaRecorder). Made for posting. */
'use strict';
class AwaazReel {
  constructor(cv, host){ this.cv = cv; this.c = cv.getContext('2d'); cv.width = 1080; cv.height = 1920; this.host = host; this.on = false; this.rec = null; this.chunks = []; this.sg = document.createElement('canvas'); this.sg.width = 540; this.sg.height = 220; this.sgc = this.sg.getContext('2d'); this.col = this.sgc.createImageData(3, 220); this.rings = []; this.lastBeat = -1; }
  draw(F, t, field){ if (!this.on) return; const c = this.c, W = 1080, H = 1920; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (field && field.width){ const s = Math.max(W / field.width, H / field.height), fw = field.width * s, fh = field.height * s; c.globalAlpha = .9; c.drawImage(field, (W - fw) / 2, (H - fh) / 2, fw, fh); c.globalAlpha = 1; }
    // polar scope: the waveform wrapped around a circle that breathes with the kick
    const L = F.tl, R = F.tr, N = 1024, cx = W / 2, cy = H * .44, r0 = 250 + F.kick * 40 * F.fx + F.bass * 30, amp = 160 / Math.max(.25, F.peakSm); c.globalCompositeOperation = 'lighter';
    for (const [buf, col, k] of [[L, F.hot, 1], [R, F.cyan, -1]]){ for (let pass = 0; pass < 2; pass++){ c.beginPath(); for (let i = 0; i <= N; i++){ const a = i / N * Math.PI * 2 - Math.PI / 2, v = buf[i % N] * amp * k, r = r0 + v; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = VZ.hexA(col, pass ? .9 : .2); c.lineWidth = pass ? 2.5 + F.kick * 3 : 14 + F.kick * 16; c.stroke(); } }
    if (F.beat !== this.lastBeat && F.beat >= 0){ this.lastBeat = F.beat; this.rings.push({t, down: F.beat % 4 === 0}); }
    this.rings = this.rings.filter(r => t - r.t < F.beatSec * 2); for (const r of this.rings){ const q = (t - r.t) / (F.beatSec * 2); c.strokeStyle = VZ.hexA(r.down ? F.hot : '#ffffff', (1 - q) * (r.down ? .7 : .25)); c.lineWidth = r.down ? 4 : 2; c.beginPath(); c.arc(cx, cy, r0 + 30 + VZ.ease(q) * 260 * F.fx, 0, 6.283); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    // spectrogram ribbon
    const g = this.sgc, sp = F.spec, SH = 220; g.drawImage(this.sg, -3, 0); const d = this.col.data; for (let y = 0; y < SH; y++){ const v = Math.pow(sp[Math.floor((1 - y / SH) * 127)], 1.4); const a = VZ.rgb(F.cyan), b = VZ.rgb(F.hot);
      for (let x = 0; x < 3; x++){ const o = (y * 3 + x) * 4; d[o] = (b[0] * (1 - v) + a[0] * v) * 255 * v; d[o + 1] = (b[1] * (1 - v) + a[1] * v) * 255 * v; d[o + 2] = (b[2] * (1 - v) + a[2] * v) * 255 * v; d[o + 3] = 255; } } g.putImageData(this.col, 540 - 3, 0);
    c.globalAlpha = .85; c.drawImage(this.sg, 0, H * .70, W, 300); c.globalAlpha = 1;
    // type
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.save(); c.translate(70, 230); c.scale(1, 1.35); c.font = '800 120px "Barlow Condensed", sans-serif'; c.fillText((F.secName || '').toUpperCase(), 0, 0); c.restore();
    c.font = '600 40px "Barlow Condensed", sans-serif'; c.fillStyle = F.hot; c.fillText((F.worldName || '').toUpperCase(), 72, 300); c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '500 34px "Space Mono", monospace'; c.fillText(F.chordName || '', 72, 350);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '600 30px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText('MAUT KI AWAAZ', W / 2, H - 90); c.font = '500 24px "Space Mono", monospace'; c.fillText(`${F.keyName || ''} · ${F.bpm || ''} BPM`, W / 2, H - 52); }
  startRec(){ const vs = this.cv.captureStream(30), as = this.host.streamDest.stream; const st = new MediaStream([...vs.getVideoTracks(), ...as.getAudioTracks()]);
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']; const type = types.find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    this.chunks = []; this.rec = new MediaRecorder(st, {mimeType: type, videoBitsPerSecond: 12e6, audioBitsPerSecond: 256000}); this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data); this.rec.start(1000); this.type = type; }
  stopRec(){ return new Promise(res => { if (!this.rec) return res(null); this.rec.onstop = () => { const b = new Blob(this.chunks, {type: this.type || 'video/webm'}); this.rec = null; res(b); }; this.rec.stop(); }); } }
