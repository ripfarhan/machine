/* Machine Studio DSP — part 2: pitch tracking (YIN candidates + Viterbi path) and note segmentation. */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || (root.MACHINE_DSP_PARTS = []);
  parts.push(function (D) {
    'use strict';

    /* analyzePitch: mono Float32Array -> per-frame f0.
       Each frame gets up to K period candidates from the YIN difference function (computed with FFTs);
       a Viterbi pass then picks the smoothest path through them, with an explicit unvoiced state.
       That is the pYIN idea, and it is what removes octave jumps and consonant garbage. */
    D.analyzePitch = function (x, sr, opts, onProgress) {
      opts = opts || {};
      const fmin = opts.fmin || 60, fmax = opts.fmax || 1100;
      let xa = x, sra = sr, dec = 1;
      while (sra >= 32000) { xa = D.decimate2(xa); sra /= 2; dec *= 2; }
      const hopA = Math.max(1, Math.round(sra * 0.0058)), hop = hopA * dec;
      const maxLag = Math.ceil(sra / fmin), minLag = Math.max(2, Math.floor(sra / fmax));
      const Wi = Math.round(sra * 0.035), N = Wi + maxLag;
      let M = 1; while (M < N) M <<= 1;
      const fft = new D.FFT(M);
      const re = new Float64Array(M), im = new Float64Array(M), cr = new Float64Array(M), ci = new Float64Array(M);
      const cum = new Float64Array(N + 1), cm = new Float64Array(maxLag + 2);
      const n = xa.length, T = Math.floor(x.length / hop) + 1;
      const K = 5, S = K + 1;
      const candF = new Float32Array(T * K), candC = new Float32Array(T * K), candV = new Float32Array(T * K);
      const nC = new Uint8Array(T), rms = new Float32Array(T);
      const pre = Math.round(Wi / 2 + sra / 400);

      let peak = 0;
      for (let t = 0; t < T; t++) {
        const start = t * hopA - pre;
        for (let j = 0; j < M; j++) { re[j] = 0; im[j] = 0; }
        let e = 0;
        for (let j = 0; j < N; j++) {
          const idx = start + j, v = idx >= 0 && idx < n ? xa[idx] : 0;
          im[j] = v; if (j < Wi) { re[j] = v; e += v * v; }
          cum[j + 1] = cum[j] + v * v;
        }
        rms[t] = Math.sqrt(e / Wi);
        if (rms[t] > peak) peak = rms[t];
        if (rms[t] < 1e-4) { nC[t] = 0; continue; }
        // one FFT for both sequences (a in the real part, b in the imaginary part)
        fft.transform(re, im);
        for (let k = 0; k < M; k++) {
          const k2 = (M - k) & (M - 1);
          const zr = re[k], zi = im[k], wr = re[k2], wi = im[k2];
          const ar = 0.5 * (zr + wr), ai = 0.5 * (zi - wi), br = 0.5 * (zi + wi), bi = -0.5 * (zr - wr);
          cr[k] = ar * br + ai * bi; ci[k] = ar * bi - ai * br;
        }
        fft.inverse(cr, ci);
        const e0 = cum[Wi];
        let run = 0; cm[0] = 1;
        for (let tau = 1; tau <= maxLag; tau++) {
          let d = e0 + (cum[tau + Wi] - cum[tau]) - 2 * cr[tau];
          if (d < 0) d = 0;
          run += d;
          cm[tau] = run > 0 ? d * tau / run : 1;
        }
        // local minima -> candidates. Every multiple of the true period is a minimum too, so both the
        // shortlist and the cost lean a little toward shorter periods (0.02 per octave).
        let cnt = 0; const base = t * K;
        for (let tau = minLag; tau < maxLag; tau++) {
          const v = cm[tau];
          if (v < 0.7 && v <= cm[tau - 1] && v < cm[tau + 1]) {
            const a = cm[tau - 1], b = v, c = cm[tau + 1], den = a - 2 * b + c;
            let off = 0, val = b;
            if (den > 1e-12) { off = 0.5 * (a - c) / den; val = b - 0.25 * (a - c) * off; }
            if (val < 0) val = 0;
            const f = Math.log2(sra / (tau + off)), bv = val - 0.02 * f;
            let pos = cnt < K ? cnt : -1;
            if (cnt >= K) {
              let worst = 0; for (let i = 1; i < K; i++) if (candC[base + i] > candC[base + worst]) worst = i;
              if (bv < candC[base + worst]) pos = worst;
            } else cnt++;
            if (pos >= 0) { candF[base + pos] = f; candV[base + pos] = val; candC[base + pos] = bv; }
          }
        }
        if (cnt) {
          let bi = 0; for (let i = 1; i < cnt; i++) if (candC[base + i] < candC[base + bi]) bi = i;
          const shift = candV[base + bi] - candC[base + bi];
          for (let i = 0; i < cnt; i++) candC[base + i] += shift;
        }
        nC[t] = cnt;
        if (onProgress && (t & 255) === 0) onProgress(t / T);
      }

      // silence gate relative to the loudest part of the take
      const gate = Math.max(1e-4, peak * 0.004);
      for (let t = 0; t < T; t++) if (rms[t] < gate) nC[t] = 0;

      // Viterbi
      const U = opts.unvoicedCost || 0.32, SW = 0.12, W = 3.0, CAP = 0.6;
      const back = new Int8Array(T * S);
      let prev = new Float64Array(S).fill(Infinity), cur = new Float64Array(S);
      for (let i = 0; i < nC[0]; i++) prev[i] = candC[i];
      prev[K] = U;
      for (let t = 1; t < T; t++) {
        const b = t * K, pb = (t - 1) * K, np = nC[t - 1], nc = nC[t];
        for (let s = 0; s < S; s++) cur[s] = Infinity;
        for (let i = 0; i < nc; i++) {
          let best = prev[K] + SW, bp = K;
          const f = candF[b + i];
          for (let p = 0; p < np; p++) {
            let tc = W * Math.abs(f - candF[pb + p]); if (tc > CAP) tc = CAP;
            const c = prev[p] + tc;
            if (c < best) { best = c; bp = p; }
          }
          cur[i] = best + candC[b + i]; back[t * S + i] = bp;
        }
        let best = prev[K], bp = K;
        for (let p = 0; p < np; p++) { const c = prev[p] + SW; if (c < best) { best = c; bp = p; } }
        cur[K] = best + U; back[t * S + K] = bp;
        const tmp = prev; prev = cur; cur = tmp;
      }
      const f0 = new Float32Array(T), conf = new Float32Array(T);
      let s = K, bc = prev[K];
      for (let i = 0; i < nC[T - 1]; i++) if (prev[i] < bc) { bc = prev[i]; s = i; }
      for (let t = T - 1; t >= 0; t--) {
        if (s < K) { f0[t] = Math.pow(2, candF[t * K + s]); conf[t] = 1 - Math.min(1, candV[t * K + s]); }
        s = t > 0 ? back[t * S + s] : s;
      }

      // clean-up: single-frame spikes, tiny voiced islands, tiny holes
      for (let t = 1; t < T - 1; t++) {
        if (f0[t] && f0[t - 1] && f0[t + 1]) {
          const a = Math.log2(f0[t - 1]), b = Math.log2(f0[t]), c = Math.log2(f0[t + 1]);
          const med = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
          if (Math.abs(b - med) > 0.025) f0[t] = Math.pow(2, med);
        }
      }
      // short octave slips inside a voiced stretch: fold them back onto the surrounding line
      for (let t = 1; t < T; t++) {
        if (!f0[t] || !f0[t - 1]) continue;
        const j = Math.log2(f0[t] / f0[t - 1]);
        if (Math.abs(j) < 0.75) continue;
        let e = t + 1, back = false;
        while (e < T && f0[e] && e - t < 22) { if (Math.abs(Math.log2(f0[e] / f0[e - 1]) + j) < 0.2) { back = true; break; } e++; }
        const oct = Math.round(j);
        if (Math.abs(j - oct) < 0.13 && oct !== 0 && (back || e >= T || !f0[e]) && e - t < 22) {
          const k = Math.pow(2, -oct);
          for (let i = t; i < e; i++) f0[i] *= k;
          t = e;
        }
      }
      const minRun = 5;
      for (let t = 0; t < T;) {
        if (!f0[t]) { t++; continue; }
        let e = t; while (e < T && f0[e]) e++;
        if (e - t < minRun) for (let i = t; i < e; i++) { f0[i] = 0; conf[i] = 0; }
        t = e;
      }
      for (let t = 1; t < T;) {
        if (f0[t] || !f0[t - 1]) { t++; continue; }
        let e = t; while (e < T && !f0[e]) e++;
        if (e < T && e - t <= 3 && Math.abs(Math.log2(f0[e] / f0[t - 1])) < 2 / 12) {
          const a = Math.log2(f0[t - 1]), b = Math.log2(f0[e]);
          for (let i = t; i < e; i++) { f0[i] = Math.pow(2, a + (b - a) * (i - t + 1) / (e - t + 1)); conf[i] = 0.5; }
        }
        t = e;
      }
      const midi = new Float32Array(T);
      for (let t = 0; t < T; t++) midi[t] = f0[t] ? 69 + 12 * Math.log2(f0[t] / 440) : 0;
      return { f0, midi, conf, rms, hop, frames: T, sr };
    };

    /* Note segmentation. Inside every voiced stretch a dynamic program fits a staircase whose
       steps are the notes of the current scale: cost = squared distance to the step + a fixed
       price for every change of step. Vibrato stays one note (wobbling is cheaper than switching),
       a real move to another scale note that lasts more than ~30 ms becomes a new note, and two
       notes sung close together but on either side of a scale boundary are still told apart.
       segmentRange works on frames [s, e) so the app can re-read only the parts the user has not edited. */
    D.segmentRange = function (midi, s, e, mask, refCents, opts) {
      opts = opts || {};
      const K = opts.switchCost || 5, minFrames = opts.minFrames || 9, off = (refCents || 0) / 100;
      const notes = [];
      const center = r => D.noteCenter(midi, r.s, r.e);
      const med3 = (a, b) => D.median(midi, a, b);
      let t = s;
      while (t < e) {
        if (!midi[t]) { t++; continue; }
        let end = t; while (end < e && midi[end]) end++;
        const L = end - t;
        let lo = Infinity, hi = -Infinity;
        for (let i = t; i < end; i++) { if (midi[i] < lo) lo = midi[i]; if (midi[i] > hi) hi = midi[i]; }
        const states = [];
        for (let m = Math.floor(lo - off) - 2; m <= Math.ceil(hi - off) + 2; m++) if (mask[((m % 12) + 12) % 12]) states.push(m + off);
        if (!states.length) for (let m = Math.floor(lo) - 1; m <= Math.ceil(hi) + 1; m++) states.push(m);
        const S = states.length, back = new Int16Array(L * S);
        let prev = new Float64Array(S), cur = new Float64Array(S);
        for (let i = 0; i < L; i++) {
          // median of 3 keeps single odd frames from buying a note change
          const a = midi[t + Math.max(0, i - 1)], b = midi[t + i], c = midi[t + Math.min(L - 1, i + 1)];
          const p = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
          let mn = Infinity, mi = 0;
          if (i > 0) for (let k = 0; k < S; k++) if (prev[k] < mn) { mn = prev[k]; mi = k; }
          for (let k = 0; k < S; k++) {
            let d = p - states[k]; d = d * d; if (d > 6) d = 6;
            if (i === 0) { cur[k] = d; continue; }
            if (prev[k] <= mn + K) { cur[k] = prev[k] + d; back[i * S + k] = k; }
            else { cur[k] = mn + K + d; back[i * S + k] = mi; }
          }
          const tmp = prev; prev = cur; cur = tmp;
        }
        let k = 0; for (let j = 1; j < S; j++) if (prev[j] < prev[k]) k = j;
        const st = new Int16Array(L);
        for (let i = L - 1; i >= 0; i--) { st[i] = k; if (i > 0) k = back[i * S + k]; }
        const runs = [];
        for (let i = 0; i < L;) { let j = i; while (j < L && st[j] === st[i]) j++; runs.push({ s: t + i, e: t + j }); i = j; }
        runs.forEach(r => { r.center = center(r); });
        // scoops and slides: a short run whose pitch is still travelling belongs to the note it arrives at
        for (let i = 0; i < runs.length && runs.length > 1;) {
          const r = runs[i], len = r.e - r.s, nx = runs[i + 1], pv = runs[i - 1];
          let merged = false;
          if (len < 16) {
            const q = Math.min(3, len), sp = med3(r.s, r.s + q), ep = med3(r.e - q, r.e);
            if (Math.abs(ep - sp) >= 0.4) {
              if (nx && Math.abs(ep - nx.center) < Math.abs(sp - nx.center)) { nx.s = r.s; runs.splice(i, 1); nx.center = center(nx); merged = true; }
              else if (!nx && pv) { pv.e = r.e; runs.splice(i, 1); pv.center = center(pv); merged = true; }
            }
          }
          if (!merged) i++;
        }
        // fold runs that are too short to be notes into the closer neighbour
        for (;;) {
          if (runs.length < 2) break;
          let si = -1, sl = Infinity;
          runs.forEach((r, i) => { const l = r.e - r.s; if (l < minFrames && l < sl) { sl = l; si = i; } });
          if (si < 0) break;
          const r = runs[si], pv = runs[si - 1], nx = runs[si + 1];
          const into = !pv ? nx : !nx ? pv : Math.abs(nx.center - r.center) <= Math.abs(pv.center - r.center) ? nx : pv;
          if (into === nx) nx.s = r.s; else pv.e = r.e;
          runs.splice(si, 1); into.center = center(into);
        }
        // neighbours that snap to the same scale note are one note
        for (let i = 0; i < runs.length - 1;) {
          if (D.snapToScale(runs[i].center, mask, refCents) === D.snapToScale(runs[i + 1].center, mask, refCents)) {
            runs[i].e = runs[i + 1].e; runs.splice(i + 1, 1); runs[i].center = center(runs[i]);
            if (i > 0) i--;
          } else i++;
        }
        for (const r of runs) notes.push({ s: r.s, e: r.e, center: r.center });
        t = end;
      }
      return notes;
    };
    D.segmentNotes = function (midi, mask, refCents, opts) {
      return D.segmentRange(midi, 0, midi.length, mask || new Array(12).fill(true), refCents || 0, opts);
    };

    // Centre pitch of a frame range (used after the user splits, merges or resizes notes).
    D.noteCenter = function (midi, s, e) {
      const len = e - s, trim = len >= 8 ? Math.floor(len * 0.2) : 0;
      const vals = [];
      for (let i = s + trim; i < e - trim; i++) if (midi[i]) vals.push(midi[i]);
      if (!vals.length) for (let i = s; i < e; i++) if (midi[i]) vals.push(midi[i]);
      return vals.length ? D.median(vals, 0, vals.length) : 60;
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
