/* Maut ki Awaaz — reactive visual components (research/05). One rAF loop in app.js computes features F once per frame;
   every component is draw(F, t, dt). Canvas2D for panels, one WebGL2 context for the background field. */
'use strict';
const VZ = {};
VZ.fit = (cv, maxDpr) => { const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, maxDpr || 2), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; } return {w: r.width, h: r.height, d}; };
VZ.hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
VZ.rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
VZ.ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// ---------------------------------------------------------------- background field (WebGL2): warped contour lines, kick-lit
VZ.Field = class { constructor(cv){ this.cv = cv; const gl = this.gl = cv.getContext('webgl2', {antialias: false, alpha: false, premultipliedAlpha: false}); this.ok = !!gl; if (!gl) return;
    const vs = `#version 300 es\nin vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
    const fs = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec2 R; uniform float T, K, S, E, C, G, B, M, Q; uniform vec3 H1, H2; uniform float SP[16];
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * n(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
void main(){ vec2 q = (uv - .5) * vec2(R.x / R.y, 1.);
  float tear = step(.985 - S * .05, h(vec2(floor(uv.y * 40.), floor(T * 24.)))) * S;  // snare: horizontal slice tears
  q.x += tear * .06 * (h(vec2(floor(uv.y * 40.), 3.)) - .5);
  q += G * .08 * vec2(sin(q.y * 30. + T * 40.), 0.);                                   // section change: smear
  float t = T * (.03 + .05 * E + .04 * M);
  vec2 w = q * (1.6 + .6 * E); w += .6 * vec2(fbm(w * .8 + t), fbm(w * .8 - t + 4.)) * (1. + C);
  float f = fbm(w + t * .7); float band = SP[int(clamp(uv.y * 15.99, 0., 15.))];
  float lines = 12. + 18. * E; float v = fract(f * lines + T * .05); float d = abs(v - .5) * 2.; float w0 = fwidth(f * lines) * 1.4;
  float line = 1. - smoothstep(0., w0 + .02, 1. - d);
  float glow = exp(-pow(length(q) * (1.2 - .4 * B), 2.)) * (.06 + .25 * K + .1 * band);
  vec3 col = mix(H2, H1, smoothstep(.2, .8, f)) * line * (.12 + .5 * K + .35 * band + .2 * E) + mix(H1, H2, .5) * glow;
  col += vec3(1.) * line * K * .08; col *= Q; col = col / (1. + col);
  o = vec4(col + vec3(.012, .012, .02), 1.); }`;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(x)); return x; };
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const k of ['R', 'T', 'K', 'S', 'E', 'C', 'G', 'B', 'M', 'Q', 'H1', 'H2', 'SP']) this.u[k] = gl.getUniformLocation(pr, k); this.scale = .5; }
  draw(F, t){ if (!this.ok) return; const gl = this.gl, cv = this.cv, r = cv.getBoundingClientRect(), s = this.scale * Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * s), h = Math.round(r.height * s);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; } gl.viewport(0, 0, w, h); const u = this.u, m = F.motionScale;
    gl.uniform2f(u.R, w, h); gl.uniform1f(u.T, t * m); gl.uniform1f(u.K, F.kick * F.fx); gl.uniform1f(u.S, F.snare * F.fx * F.tearOK); gl.uniform1f(u.E, F.energy); gl.uniform1f(u.C, F.chaos); gl.uniform1f(u.G, F.glitch * F.fx); gl.uniform1f(u.B, F.bass); gl.uniform1f(u.M, F.motion); gl.uniform1f(u.Q, F.bright);
    gl.uniform3fv(u.H1, F.c1); gl.uniform3fv(u.H2, F.c2); gl.uniform1fv(u.SP, F.sp16); gl.drawArrays(gl.TRIANGLES, 0, 3); } };

// ---------------------------------------------------------------- hero: phosphor scope + log spectrum + scrolling spectrogram + heart ring
VZ.Hero = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.sg = document.createElement('canvas'); this.sg.width = 720; this.sg.height = 180; this.sgc = this.sg.getContext('2d'); this.sgc.fillStyle = '#07070a'; this.sgc.fillRect(0, 0, 720, 180); this.col = this.sgc.createImageData(2, 180); this.peak = new Float32Array(128); this.sm = new Float32Array(128); this.lut = null; this.lutFor = ''; this.ring = []; this.lastBeat = -1; }
  makeLut(F){ const k = F.hot + F.cyan; if (this.lutFor === k) return; this.lutFor = k; const a = VZ.rgb(F.cyan), b = VZ.rgb(F.hot); this.lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++){ const x = i / 255; let r, g, bb; if (x < .45){ const q = x / .45; r = .03 + (b[0] * .5 - .03) * q; g = .03 + (b[1] * .3 - .03) * q; bb = .05 + (b[2] * .5 - .05) * q; } else if (x < .8){ const q = (x - .45) / .35; r = b[0] * .5 + (a[0] - b[0] * .5) * q; g = b[1] * .3 + (a[1] - b[1] * .3) * q; bb = b[2] * .5 + (a[2] - b[2] * .5) * q; } else { const q = (x - .8) / .2; r = a[0] + (1 - a[0]) * q; g = a[1] + (1 - a[1]) * q; bb = a[2] + (1 - a[2]) * q; }
      this.lut[i * 3] = r * 255; this.lut[i * 3 + 1] = g * 255; this.lut[i * 3 + 2] = bb * 255; } }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); this.makeLut(F);
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
    // spectrogram (bottom 42 %): shift 2 px per frame, write one new column of log bands
    const g = this.sgc, SH = this.sg.height, SW = this.sg.width, sp = F.spec; g.drawImage(this.sg, -2, 0); const col = this.col.data;
    for (let y = 0; y < SH; y++){ const v = sp[Math.floor((1 - y / SH) * 127)], i = Math.max(0, Math.min(255, Math.pow(v, 1.5) * 255 | 0)) * 3; for (let x = 0; x < 2; x++){ const o = (y * 2 + x) * 4; col[o] = this.lut[i]; col[o + 1] = this.lut[i + 1]; col[o + 2] = this.lut[i + 2]; col[o + 3] = 255; } }
    g.putImageData(this.col, SW - 2, 0);
    const sy = h * .58, sh = h - sy; c.globalAlpha = .82; c.imageSmoothingEnabled = true; c.drawImage(this.sg, 0, sy, w, sh); c.globalAlpha = 1;
    const gr = c.createLinearGradient(0, sy, 0, sy + 30); gr.addColorStop(0, 'rgba(7,7,10,1)'); gr.addColorStop(1, 'rgba(7,7,10,0)'); c.fillStyle = gr; c.fillRect(0, sy, w, 30);
    // log spectrum outline with peak hold, sitting on the spectrogram's top edge
    c.beginPath(); const base = sy + sh * .1; for (let i = 0; i < 128; i++){ const v = sp[i]; this.sm[i] += (v - this.sm[i]) * (v > this.sm[i] ? .6 : .18); this.peak[i] = Math.max(this.sm[i], this.peak[i] - dt * .35); const x = i / 127 * w, y = base - this.sm[i] * sy * .55; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.lineTo(w, base); c.lineTo(0, base); c.closePath(); const fg = c.createLinearGradient(0, base - sy * .55, 0, base); fg.addColorStop(0, VZ.hexA(F.cyan, .35)); fg.addColorStop(.6, VZ.hexA(F.hot, .16)); fg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = fg; c.fill();
    c.strokeStyle = VZ.hexA(F.cyan, .7); c.lineWidth = 1; c.stroke(); c.fillStyle = 'rgba(236,236,244,.55)'; for (let i = 0; i < 128; i += 2) c.fillRect(i / 127 * w - 1, base - this.peak[i] * sy * .55 - 1, 2, 1.5);
    // triggered stereo scope (phosphor): L hot, R cyan; kick thickens
    const L = F.tl, R = F.tr, N = L.length; let tr = 0; for (let i = 1; i < N / 2; i++) if (L[i - 1] < 0 && L[i] >= 0){ tr = i; break; }
    const span = N / 2, cy = sy * .5, amp = sy * .42 / Math.max(.25, F.peakSm); c.globalCompositeOperation = 'lighter';
    for (const [buf, colr, off] of [[L, F.hot, -1], [R, F.cyan, 1]]){ for (let pass = 0; pass < 2; pass++){ c.beginPath(); for (let i = 0; i < span; i += 2){ const x = i / span * w, y = cy + off * 2 + buf[tr + i] * amp; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = VZ.hexA(colr, pass ? .9 : .18); c.lineWidth = pass ? 1.2 + F.kick * 1.6 * F.fx : 5 + F.kick * 8 * F.fx; c.stroke(); } }
    c.globalCompositeOperation = 'source-over';
    // heart: 16-step ring, beat rings
    const hx = w - 46, hy = 46, rr = 22; for (let s = 0; s < 16; s++){ const a = -Math.PI / 2 + s / 16 * Math.PI * 2, on = s === F.step; c.fillStyle = on ? F.hot : s % 4 === 0 ? 'rgba(236,236,244,.5)' : 'rgba(236,236,244,.18)'; c.beginPath(); c.arc(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr, on ? 3.2 : 1.8, 0, 6.283); c.fill(); }
    if (F.beat !== this.lastBeat && F.beat >= 0){ this.lastBeat = F.beat; this.ring.push({t, down: F.beat % 4 === 0}); }
    this.ring = this.ring.filter(r => t - r.t < F.beatSec); for (const r of this.ring){ const q = (t - r.t) / F.beatSec; c.strokeStyle = VZ.hexA(r.down ? F.hot : F.cyan, (1 - q) * .8); c.lineWidth = r.down ? 2 : 1; c.beginPath(); c.arc(hx, hy, rr + 4 + VZ.ease(q) * 26 * F.fx, 0, 6.283); c.stroke(); } } };

// ---------------------------------------------------------------- voice lanes: what the machine is about to play (future notes ghosted, ignite at the playhead)
VZ.Lanes = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.lanes = []; this.notes = []; this.past = 4.5; this.future = 2.2; }
  setLanes(slots){ this.lanes = slots.map(s => ({slot: s.slot, kind: s.kind, lo: 127, hi: 0, flash: 0})); this.notes = slots.map(() => []); }
  add(lane, t, pitch, vel, dur){ const L = this.lanes[lane]; if (!L) return; if (pitch >= 0){ L.lo = Math.min(L.lo, pitch); L.hi = Math.max(L.hi, pitch); } this.notes[lane].push({t, pitch, vel, dur, lit: false}); }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const n = this.lanes.length; if (!n) return;
    const lh = h / n, px = w * .7, sc = px / this.past, x0 = t - this.past;
    c.font = '600 10px "Barlow Condensed", sans-serif'; c.textBaseline = 'middle';
    for (let i = 0; i < n; i++){ const L = this.lanes[i], y = i * lh, arr = this.notes[i], col = F.laneCol[i % F.laneCol.length];
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(255,255,255,.035)'; c.fillRect(0, y, w, lh);
      while (arr.length && arr[0].t + arr[0].dur < x0 - .5) arr.shift();
      const drum = L.kind !== 'va' && L.kind !== 'mono' && L.kind !== 'bass' && L.kind !== 'modal', span = Math.max(12, L.hi - L.lo + 2);
      for (const e of arr){ const x = (e.t - x0) * sc; if (x > w) break; const fut = e.t > t; if (!fut && !e.lit){ e.lit = true; L.flash = 1; }
        const a = fut ? .28 : Math.max(.25, 1 - (t - e.t) * .25), glow = !fut && t - e.t < .15 ? 1 - (t - e.t) / .15 : 0;
        c.fillStyle = glow > 0 ? `rgba(255,255,255,${.6 * glow + .4})` : VZ.hexA(col, a * (.5 + .5 * Math.min(1, e.vel)));
        if (drum){ const hh = e.pitch === -1 ? lh * .82 : e.pitch === -3 ? lh * .6 : lh * .38; c.fillRect(x - 1, y + (lh - hh) / 2, e.pitch === -1 ? 3 : 2, hh); }
        else { const yy = y + lh - 3 - ((e.pitch - L.lo + 1) / span) * (lh - 6), ww = Math.max(2, e.dur * sc); c.fillRect(x, yy - 1.5, Math.min(ww, w - x), 3); } }
      L.flash = Math.max(0, L.flash - dt * 6);
      c.fillStyle = L.flash > 0 ? VZ.hexA(col, .5 + .5 * L.flash) : 'rgba(236,236,244,.42)'; c.fillText(L.slot.toUpperCase(), 6, y + lh / 2); }
    // playhead + "future" region
    c.fillStyle = VZ.hexA(F.cyan, .05); c.fillRect(px, 0, w - px, h); c.fillStyle = F.hot; c.fillRect(px, 0, 1.5, h);
    } };

// ---------------------------------------------------------------- harmony wheel (circle of fifths; scale outlined, chord filled, sounding notes flash)
VZ.Wheel = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.flash = new Float32Array(12); this.rot = 0; this.rotT = 0; this.chord = []; this.scale = []; this.label = ''; this.tonic = 0; }
  set(info){ this.chord = info.chordPcs || []; this.scale = info.scalePcs || []; this.tonic = info.tonic; const idx = (this.tonic * 7) % 12; this.rotT = -idx / 12 * Math.PI * 2; }
  hit(pc, v){ this.flash[pc] = Math.max(this.flash[pc], Math.min(1, v)); }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h - 24) * .38, r0 = R * .52;
    this.rot += (this.rotT - this.rot) * Math.min(1, dt * 3); const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
    for (let k = 0; k < 12; k++){ const pc = (k * 7) % 12, a0 = this.rot + (k - .5) / 12 * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / 12 - .03; const inS = this.scale.indexOf(pc) >= 0, inC = this.chord.indexOf(pc) >= 0, f = this.flash[pc];
      c.beginPath(); c.arc(cx, cy, R, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath();
      c.fillStyle = inC ? VZ.hexA(F.hot, .35 + .55 * f) : inS ? VZ.hexA(F.cyan, .06 + .4 * f) : `rgba(255,255,255,${.015 + .2 * f})`; c.fill();
      c.strokeStyle = inS ? VZ.hexA(F.cyan, .5) : 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.stroke();
      const am = (a0 + a1) / 2, tx = cx + Math.cos(am) * (R + 11), ty = cy + Math.sin(am) * (R + 11); c.fillStyle = pc === this.tonic ? F.hot : inS ? 'rgba(236,236,244,.8)' : 'rgba(236,236,244,.28)'; c.font = (pc === this.tonic ? '700 ' : '500 ') + '11px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(NOTE[pc], tx, ty);
      this.flash[pc] = Math.max(0, f - dt * 3.5); }
    c.fillStyle = 'rgba(236,236,244,.95)'; c.font = '600 22px "Barlow Condensed", sans-serif'; c.fillText(F.chordName || '', cx, cy - 6); c.fillStyle = VZ.hexA(F.cyan, .85); c.font = '500 10px "Space Mono", monospace'; c.fillText((F.moodWord || '').toUpperCase(), cx, cy + 14); } };

// ---------------------------------------------------------------- macro knob (canvas + real range input for a11y/keyboard)
VZ.Knob = class { constructor(el, def, onChange){ this.el = el; this.def = def; this.v = def.v; this.on = onChange; this.cv = el.querySelector('canvas'); this.c = this.cv.getContext('2d'); this.drag = false; this.act = 0; this.flash = 0; this.mod = 0;
    const inp = this.inp = el.querySelector('input'); inp.value = Math.round(this.v * 100); inp.addEventListener('input', () => this.set(inp.value / 100, true));
    this.cv.addEventListener('pointerdown', e => { this.drag = true; this.y0 = e.clientY; this.v0 = this.v; this.cv.setPointerCapture(e.pointerId); e.preventDefault(); });
    this.cv.addEventListener('pointermove', e => { if (!this.drag) return; const k = e.shiftKey ? .1 : 1; this.set(this.v0 + (this.y0 - e.clientY) / 200 * k, true); });
    const up = () => { this.drag = false; }; this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', up);
    this.cv.addEventListener('dblclick', () => this.set(def.dflt === undefined ? .5 : def.dflt, true));
    this.cv.addEventListener('wheel', e => { e.preventDefault(); this.set(this.v - Math.sign(e.deltaY) * .02, true); }, {passive: false}); }
  set(v, user){ v = Math.max(0, Math.min(1, v)); if (this.def.steps){ const s = this.def.steps - 1, q = Math.round(v * s) / s; if (q !== Math.round(this.v * s) / s) this.flash = 1; } this.v = v; this.inp.value = Math.round(v * 100);
    this.inp.setAttribute('aria-valuetext', this.def.name + ' ' + this.text()); if (user && this.on) this.on(this.def.key, v); this.act = 1; }
  text(){ return this.def.words ? this.def.words(this.v) : String(Math.round(this.v * 100)); }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2 + 2, R = Math.min(w, h) * .38, a0 = Math.PI * .75, span = Math.PI * 1.5, av = a0 + span * this.v;
    const live = F.knobLive ? F.knobLive[this.def.key] || 0 : 0;   // activity of the parts this knob drives
    this.act = Math.max(this.drag ? 1 : 0, this.act - dt * 1.5); this.flash = Math.max(0, this.flash - dt * 16);
    const gl = .12 + .35 * live + .4 * this.act; const gg = c.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.5); gg.addColorStop(0, VZ.hexA(F.hot, gl * .5)); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(0, 0, w, h);
    c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R, a0, a0 + span); c.stroke();
    c.strokeStyle = VZ.hexA(F.cyan, .9); c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R, a0, av); c.stroke();
    const mr = R + 7; c.strokeStyle = VZ.hexA(F.hot, .3 + .6 * live); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, mr, av - .02 - live * .5, av + .02 + live * .5); c.stroke();
    c.fillStyle = this.flash > 0 ? '#fff' : '#ececf4'; c.beginPath(); c.arc(cx + Math.cos(av) * R, cy + Math.sin(av) * R, 4.5, 0, 6.283); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle'; if (this.drag){ c.fillStyle = '#fff'; c.font = '700 30px "Barlow Condensed", sans-serif'; c.fillText(String(Math.round(this.v * 100)), cx, cy); }
    else { c.fillStyle = 'rgba(236,236,244,.82)'; c.font = '600 13px "Barlow Condensed", sans-serif'; c.fillText(this.text().toUpperCase(), cx, cy); } } };

// ---------------------------------------------------------------- morph XY pad (warm ↔ glass, clean ↔ broken)
VZ.XY = class { constructor(cv, onChange){ this.cv = cv; this.c = cv.getContext('2d'); this.x = .5; this.y = .2; this.on = onChange; this.trail = []; this.drag = false;
    const mv = e => { const r = cv.getBoundingClientRect(); this.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); this.y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)); this.on && this.on(this.x, this.y); };
    cv.addEventListener('pointerdown', e => { this.drag = true; cv.setPointerCapture(e.pointerId); mv(e); }); cv.addEventListener('pointermove', e => { if (this.drag) mv(e); }); cv.addEventListener('pointerup', () => this.drag = false); }
  set(x, y){ this.x = x; this.y = y; }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, VZ.hexA(F.hot, .12)); g.addColorStop(1, VZ.hexA(F.cyan, .12)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    // grid that ripples on kicks; distortion grows toward "broken"
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; const kk = F.kick * F.fx * 4;
    for (let i = 1; i < 8; i++){ c.beginPath(); for (let s = 0; s <= 24; s++){ const yy = i / 8 * h, xx = s / 24 * w, j = (Math.sin(s * 1.7 + t * 3 + i) * this.y * 4 + kk * Math.sin(s + i)) ; s ? c.lineTo(xx, yy + j) : c.moveTo(xx, yy + j); } c.stroke(); }
    for (let i = 1; i < 8; i++){ c.beginPath(); c.moveTo(i / 8 * w, 0); c.lineTo(i / 8 * w, h); c.stroke(); }
    c.font = '600 10px "Barlow Condensed", sans-serif'; c.fillStyle = 'rgba(236,236,244,.5)'; c.textBaseline = 'top'; c.textAlign = 'left'; c.fillText('RUST', 6, 6); c.textAlign = 'right'; c.fillText('STATIC', w - 6, 6); c.textBaseline = 'bottom'; c.fillText('GLASS', w - 6, h - 6); c.textAlign = 'left'; c.fillText('WARM', 6, h - 6);
    const px = this.x * w, py = (1 - this.y) * h; this.trail.push([px, py, t]); this.trail = this.trail.filter(p => t - p[2] < 1);
    c.strokeStyle = VZ.hexA(F.hot, .5); c.lineWidth = 2; c.beginPath(); this.trail.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    const rg = c.createRadialGradient(px, py, 0, px, py, 26 + F.kick * 14 * F.fx); rg.addColorStop(0, VZ.hexA(F.hot, .7)); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(px - 50, py - 50, 100, 100);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 5, 0, 6.283); c.fill(); } };

// ---------------------------------------------------------------- goniometer + correlation
VZ.Gonio = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.rho = 1; }
  draw(F){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = 'rgba(7,7,10,.35)'; c.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2 - 5, s = Math.min(w, h) * .4 / Math.max(.3, F.peakSm);
    const L = F.tl, R = F.tr; let sl = 0, sr = 0, slr = 0; c.fillStyle = VZ.hexA(F.cyan, .35); for (let i = 0; i < L.length; i += 2){ const l = L[i], r = R[i]; sl += l * l; sr += r * r; slr += l * r; c.fillRect(cx + (r - l) * .707 * s, cy - (l + r) * .707 * s, 1.4, 1.4); }
    const rho = slr / Math.sqrt(sl * sr + 1e-12); this.rho += (rho - this.rho) * .1; c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(6, h - 8, w - 12, 3); c.fillStyle = this.rho < 0 ? F.warn : F.hot; c.fillRect(w / 2, h - 8, (w / 2 - 6) * this.rho, 3); } };

// ---------------------------------------------------------------- LED meter (master): peak + loudness
VZ.Meter = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.pk = [0, 0]; this.clip = 0; }
  draw(F, t, dt){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const seg = 24, bw = (w - 6) / 2;
    [F.pkL, F.pkR].forEach((p, ch) => { const db = 20 * Math.log10(p + 1e-9); const lv = Math.max(0, Math.min(1, (db + 48) / 48)); this.pk[ch] = Math.max(lv, this.pk[ch] - dt * .6);
      for (let s = 0; s < seg; s++){ const y = h - (s + 1) * (h / seg), on = s / seg < this.pk[ch], dbs = -48 + s / seg * 48; c.fillStyle = dbs > -3 ? (on ? F.hot : 'rgba(255,46,136,.12)') : dbs > -12 ? (on ? '#ececf4' : 'rgba(236,236,244,.1)') : (on ? F.cyan : VZ.hexA(F.cyan, .12)); c.fillRect(ch * (bw + 6), y + 1, bw, h / seg - 2); } }); } };

// ---------------------------------------------------------------- arc timeline: planned sections, energy target, measured loudness, playhead
VZ.Arc = class { constructor(cv){ this.cv = cv; this.c = cv.getContext('2d'); this.plan = null; this.trace = []; }
  setPlan(p){ this.plan = p; this.trace = []; }
  draw(F, t){ const {w, h, d} = VZ.fit(this.cv, 2), c = this.c; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); const P = this.plan; if (!P) return;
    const T = P.total, X = s => 8 + (s / T) * (w - 16); let acc = 0; c.font = '600 10px "Barlow Condensed", sans-serif'; c.textBaseline = 'top';
    const now = t - P.t0, cur = P.sections.findIndex((s, i) => now >= P.starts[i] && now < P.starts[i] + s.bars * P.bar);
    P.sections.forEach((s, i) => { const x0 = X(P.starts[i]), x1 = X(P.starts[i] + s.bars * P.bar), past = now >= P.starts[i] + s.bars * P.bar, isCur = i === cur;
      c.fillStyle = isCur ? VZ.hexA(F.hot, .16) : past ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)'; c.fillRect(x0, 14, x1 - x0 - 2, h - 18);
      if (!past && !isCur){ c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1; c.save(); c.beginPath(); c.rect(x0, 14, x1 - x0 - 2, h - 18); c.clip(); for (let k = -h; k < x1 - x0; k += 6){ c.beginPath(); c.moveTo(x0 + k, h); c.lineTo(x0 + k + h, 14); c.stroke(); } c.restore(); }
      c.fillStyle = isCur ? '#fff' : 'rgba(236,236,244,.5)'; c.fillText(s.name.toUpperCase(), x0 + 4, 2);
      // energy target
      c.strokeStyle = VZ.hexA(F.cyan, .7); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, h - 4 - s.E0 * (h - 22)); c.lineTo(x1 - 2, h - 4 - s.E1 * (h - 22)); c.stroke(); });
    if (now >= 0){ this.trace.push([now, F.loudN]); if (this.trace.length > 4000) this.trace.splice(0, 1000); c.strokeStyle = VZ.hexA(F.hot, .8); c.lineWidth = 1.5; c.beginPath(); this.trace.forEach((p, i) => { const x = X(p[0]), y = h - 4 - p[1] * (h - 22); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
    const px = X(Math.max(0, Math.min(T, now))); c.fillStyle = '#fff'; c.fillRect(px - .5, 12, 2, h - 12);
    if (cur >= 0 && P.sections[cur + 1]){ const left = Math.ceil((P.starts[cur] + P.sections[cur].bars * P.bar - now) / P.bar); c.fillStyle = VZ.hexA(F.cyan, .9); c.textAlign = 'right'; c.font = '500 10px "Space Mono", monospace'; c.fillText(`${P.sections[cur + 1].name.toUpperCase()} IN ${left} BAR${left === 1 ? '' : 'S'}`, w - 8, 2); c.textAlign = 'left'; } } };

// ---------------------------------------------------------------- brain log: decisions revealed at audible time with a scramble-decode
VZ.Brain = class { constructor(el){ this.el = el; this.lines = []; this.max = 16; }
  add(text, kind){ const d = document.createElement('div'); d.className = 'bl ' + (kind || ''); const tm = document.createElement('span'); tm.className = 'bt'; const now = new Date(); tm.textContent = now.toTimeString().slice(3, 8); const tx = document.createElement('span'); tx.className = 'bx'; d.appendChild(tm); d.appendChild(tx);
    this.el.insertBefore(d, this.el.firstChild); while (this.el.children.length > this.max) this.el.removeChild(this.el.lastChild); this.lines.push({tx, text, t0: performance.now()}); }
  tick(F){ const G = '▚▞█▓░/\\|<>', now = performance.now(); this.lines = this.lines.filter(l => { const q = (now - l.t0) / (F.calm ? 1 : 260); if (q >= 1){ l.tx.textContent = l.text; return false; }
      const n = Math.floor(l.text.length * q); let s = l.text.slice(0, n); for (let i = n; i < l.text.length; i++) s += l.text[i] === ' ' ? ' ' : G[(Math.random() * G.length) | 0]; l.tx.textContent = s; return true; }); } };
