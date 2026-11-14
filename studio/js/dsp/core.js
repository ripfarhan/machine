/* Machine Studio DSP — part 1: FFT, helpers, scales, key detection, WAV.
   Every part is a self-contained function of D so the same source runs on the
   page, inside the render worker (rebuilt from Function.toString) and in Node. */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || (root.MACHINE_DSP_PARTS = []);
  parts.push(function (D) {
    'use strict';

    // ---------- FFT (radix-2, in place) ----------
    function FFT(n) {
      this.n = n;
      this.cos = new Float64Array(n >> 1);
      this.sin = new Float64Array(n >> 1);
      for (let i = 0; i < n >> 1; i++) {
        this.cos[i] = Math.cos(2 * Math.PI * i / n);
        this.sin[i] = Math.sin(2 * Math.PI * i / n);
      }
      const bits = Math.round(Math.log2(n));
      this.rev = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        let r = 0;
        for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
        this.rev[i] = r;
      }
    }
    FFT.prototype.transform = function (re, im) {
      const n = this.n, rev = this.rev, cos = this.cos, sin = this.sin;
      for (let i = 0; i < n; i++) {
        const j = rev[i];
        if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
      }
      for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1, step = n / size;
        for (let i = 0; i < n; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const c = cos[k], s = sin[k], xr = re[j + half], xi = im[j + half];
            const tr = xr * c + xi * s, ti = xi * c - xr * s;
            re[j + half] = re[j] - tr; im[j + half] = im[j] - ti;
            re[j] += tr; im[j] += ti;
          }
        }
      }
    };
    FFT.prototype.inverse = function (re, im) {
      this.transform(im, re);
      const n = this.n, k = 1 / n;
      for (let i = 0; i < n; i++) { re[i] *= k; im[i] *= k; }
    };
    D.FFT = FFT;

    // ---------- small helpers ----------
    D.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    D.hzToMidi = hz => 69 + 12 * Math.log2(hz / 440);
    D.midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
    D.dbToLin = db => Math.pow(10, db / 20);
    D.linToDb = v => 20 * Math.log10(Math.max(v, 1e-9));
    D.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    D.noteName = m => { const r = Math.round(m); return D.NOTE_NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); };

    D.median = function (arr, s, e) {
      const tmp = Array.prototype.slice.call(arr, s, e).sort((a, b) => a - b);
      const n = tmp.length;
      if (!n) return 0;
      return n & 1 ? tmp[n >> 1] : 0.5 * (tmp[(n >> 1) - 1] + tmp[n >> 1]);
    };

    // Half-band decimator (x2), 31-tap windowed sinc.
    D.decimate2 = function (x) {
      const taps = 31, mid = 15, h = new Float64Array(taps);
      let sum = 0;
      for (let i = 0; i < taps; i++) {
        const k = i - mid;
        const s = k === 0 ? 0.5 : Math.sin(Math.PI * k * 0.5) / (Math.PI * k);
        const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (taps - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (taps - 1));
        h[i] = s * w; sum += h[i];
      }
      for (let i = 0; i < taps; i++) h[i] /= sum;
      const n = x.length, m = n >> 1, y = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        let acc = 0; const c = 2 * i;
        for (let k = 0; k < taps; k++) {
          const j = c + k - mid;
          if (j >= 0 && j < n) acc += x[j] * h[k];
        }
        y[i] = acc;
      }
      return y;
    };

    // Zero-phase low-pass (biquad run forward then backward).
    D.lowpassZeroPhase = function (x, sr, fc) {
      const w0 = 2 * Math.PI * fc / sr, cs = Math.cos(w0), al = Math.sin(w0) / (2 * 0.7071);
      const a0 = 1 + al, b0 = (1 - cs) / 2 / a0, b1 = (1 - cs) / a0, b2 = b0, a1 = -2 * cs / a0, a2 = (1 - al) / a0;
      const n = x.length, y = new Float32Array(n);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
      }
      x1 = x2 = y1 = y2 = 0;
      for (let i = n - 1; i >= 0; i--) {
        const xi = y[i], v = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = v; y[i] = v;
      }
      return y;
    };

    // ---------- scales ----------
    D.SCALES = {
      major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
      minor: { name: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
      harmMinor: { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11] },
      melMinor: { name: 'Melodic minor', steps: [0, 2, 3, 5, 7, 9, 11] },
      majPent: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9] },
      minPent: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
      blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
      dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
      phrygian: { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
      lydian: { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
      mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
      chromatic: { name: 'Chromatic', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
    };
    // 12 booleans, index = pitch class (C = 0).
    D.scaleMask = function (key, scaleId) {
      const mask = new Array(12).fill(false), sc = D.SCALES[scaleId] || D.SCALES.chromatic;
      for (const s of sc.steps) mask[(key + s) % 12] = true;
      return mask;
    };
    // Nearest allowed note to a (fractional) MIDI pitch. ref = cents the whole grid is shifted by.
    D.snapToScale = function (midi, mask, refCents) {
      const off = (refCents || 0) / 100, m = midi - off;
      let best = Math.round(m), bd = Infinity;
      const base = Math.round(m);
      for (let k = -6; k <= 6; k++) {
        const c = base + k;
        if (!mask[((c % 12) + 12) % 12]) continue;
        const d = Math.abs(c - m);
        if (d < bd - 1e-9) { bd = d; best = c; }
      }
      return best + off;
    };
    // Move an in-scale note by a number of scale degrees (diatonic harmony).
    D.shiftDegrees = function (midi, degrees, mask) {
      if (!degrees) return midi;
      let n = Math.round(midi); const frac = midi - n;
      let guard = 0;
      while (!mask[((n % 12) + 12) % 12] && guard++ < 12) n--;      // off-scale note: lean on the scale note below
      const dir = degrees > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(degrees); i++) {
        guard = 0;
        do { n += dir; } while (!mask[((n % 12) + 12) % 12] && guard++ < 12);
      }
      return n + frac;
    };

    // ---------- key detection (Krumhansl-Kessler profiles) ----------
    const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    function corr(a, b, shift) {
      let ma = 0, mb = 0;
      for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i]; }
      ma /= 12; mb /= 12;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < 12; i++) {
        const x = a[(i + shift) % 12] - ma, y = b[i] - mb;
        num += x * y; da += x * x; db += y * y;
      }
      return num / Math.sqrt(da * db + 1e-12);
    }
    D.keysFromChroma = function (chroma) {
      const out = [];
      for (let k = 0; k < 12; k++) {
        out.push({ key: k, scale: 'major', score: corr(chroma, KK_MAJ, k) });
        out.push({ key: k, scale: 'minor', score: corr(chroma, KK_MIN, k) });
      }
      out.sort((a, b) => b.score - a.score);
      return out;
    };
    // Pitch-class histogram from note blobs: duration weighted, split between the two nearest semitones.
    D.chromaFromNotes = function (notes) {
      const ch = new Array(12).fill(0);
      for (const n of notes) {
        const w = Math.min(n.e - n.s, 260), lo = Math.floor(n.center), f = n.center - lo;
        ch[((lo % 12) + 12) % 12] += w * (1 - f);
        ch[(((lo + 1) % 12) + 12) % 12] += w * f;
      }
      return ch;
    };
    // Chroma of a full mix (for reading the key off a beat).
    D.chromaFromAudio = function (x, sr) {
      let y = x, r = sr;
      while (r > 16000) { y = D.decimate2(y); r /= 2; }
      const N = 8192, fft = new D.FFT(N), re = new Float64Array(N), im = new Float64Array(N);
      const win = new Float64Array(N);
      for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
      const ch = new Array(12).fill(0), hop = N >> 1;
      const bins = [];
      for (let k = 1; k < N / 2; k++) {
        const f = k * r / N;
        if (f < 55 || f > 2000) continue;
        const m = 69 + 12 * Math.log2(f / 440), pc = ((Math.round(m) % 12) + 12) % 12;
        bins.push([k, pc, 1 - 2 * Math.abs(m - Math.round(m))]);
      }
      for (let s = 0; s + N <= y.length; s += hop) {
        for (let i = 0; i < N; i++) { re[i] = y[s + i] * win[i]; im[i] = 0; }
        fft.transform(re, im);
        for (const b of bins) ch[b[1]] += Math.sqrt(re[b[0]] * re[b[0]] + im[b[0]] * im[b[0]]) * b[2];
      }
      return ch;
    };

    // Tempo of a beat: spectral-flux onset envelope -> autocorrelation, 70-180 BPM.
    D.detectTempo = function (x, sr) {
      let y = x, r = sr;
      while (r > 16000) { y = D.decimate2(y); r /= 2; }
      const N = 512, hop = Math.round(r / 100), fft = new D.FFT(N), re = new Float64Array(N), im = new Float64Array(N);
      const prev = new Float64Array(N / 2), env = [];
      for (let s = 0; s + N <= y.length; s += hop) {
        for (let i = 0; i < N; i++) { re[i] = y[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
        fft.transform(re, im);
        let flux = 0;
        for (let k = 1; k < N / 2; k++) {
          const m = Math.log1p(40 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
          if (m > prev[k]) flux += m - prev[k];
          prev[k] = m;
        }
        env.push(flux);
      }
      const n = env.length; if (n < 400) return 0;
      let mean = 0; for (const v of env) mean += v; mean /= n;
      const fps = r / hop;
      const score = bpm => {
        const lag = 60 / bpm * fps; let acc = 0;
        for (const mult of [1, 2, 4]) {
          const L = lag * mult, li = Math.floor(L), fr = L - li; let a = 0;
          for (let i = 0; i + li + 1 < n; i++) a += (env[i] - mean) * ((env[i + li] - mean) * (1 - fr) + (env[i + li + 1] - mean) * fr);
          acc += a / (n - li) / mult;
        }
        return acc * Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));   // mild pull to mid tempos
      };
      let best = 0, bestBpm = 0;
      for (let bpm = 70; bpm <= 180; bpm += 0.5) { const v = score(bpm); if (v > best) { best = v; bestBpm = bpm; } }
      const coarse = bestBpm;
      for (let bpm = coarse - 0.5; bpm <= coarse + 0.5; bpm += 0.05) { const v = score(bpm); if (v > best) { best = v; bestBpm = bpm; } }
      // most beats are made at a whole-number tempo
      return Math.abs(bestBpm - Math.round(bestBpm)) < 0.3 ? Math.round(bestBpm) : Math.round(bestBpm * 10) / 10;
    };

    // ---------- WAV ----------
    D.encodeWav = function (channels, sr, bits) {
      bits = bits || 24;
      const nch = channels.length, n = channels[0].length, bps = bits >> 3;
      const buf = new ArrayBuffer(44 + n * nch * bps), v = new DataView(buf);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n * nch * bps, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * nch * bps, true); v.setUint16(32, nch * bps, true); v.setUint16(34, bits, true);
      str(36, 'data'); v.setUint32(40, n * nch * bps, true);
      let o = 44;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < nch; c++) {
          const s = Math.max(-1, Math.min(1, channels[c][i]));
          if (bits === 16) { v.setInt16(o, Math.round(s * 32767), true); o += 2; }
          else { const q = Math.round(s * 8388607); v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); o += 3; }
        }
      }
      return buf;
    };
    D.decodeWav = function (buf) {
      const v = new DataView(buf); let o = 12, fmt = null, data = null;
      while (o + 8 <= v.byteLength) {
        const id = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
        const sz = v.getUint32(o + 4, true);
        if (id === 'fmt ') fmt = { tag: v.getUint16(o + 8, true), nch: v.getUint16(o + 10, true), sr: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
        else if (id === 'data') { data = { o: o + 8, sz: Math.min(sz, v.byteLength - o - 8) }; break; }
        o += 8 + sz + (sz & 1);
      }
      if (!fmt || !data) throw new Error('not a PCM wav');
      const bps = fmt.bits >> 3, n = Math.floor(data.sz / (bps * fmt.nch)), ch = [];
      for (let c = 0; c < fmt.nch; c++) ch.push(new Float32Array(n));
      let p = data.o;
      for (let i = 0; i < n; i++) for (let c = 0; c < fmt.nch; c++) {
        let s;
        if (fmt.tag === 3) s = v.getFloat32(p, true);
        else if (bps === 2) s = v.getInt16(p, true) / 32768;
        else if (bps === 3) s = ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16))) / 8388608;
        else if (bps === 4) s = v.getInt32(p, true) / 2147483648;
        else s = (v.getUint8(p) - 128) / 128;
        ch[c][i] = s; p += bps;
      }
      return { sr: fmt.sr, channels: ch };
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
