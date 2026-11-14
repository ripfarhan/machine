/* Machine Studio DSP — part 4: pitch-synchronous resynthesis (TD-PSOLA).
   The voice is cut into grains two periods long, centred on pitch marks, and the grains are laid
   back down closer together (higher) or further apart (lower). The grain itself is untouched, so
   the formants - the singer's identity - stay put; resampling the grain moves the formants on purpose.
   Anything unvoiced (breaths, s, t, k) is copied through sample for sample. */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || (root.MACHINE_DSP_PARTS = []);
  parts.push(function (D) {
    'use strict';
    const PAD = 4096, TAPS = 16, PHASES = 512, HALF = TAPS / 2;

    const sincCache = {};
    function sincTable(cut) {
      const key = Math.round(cut * 50);
      if (sincCache[key]) return sincCache[key];
      const c = key / 50, tab = new Float32Array((PHASES + 1) * TAPS);
      for (let p = 0; p <= PHASES; p++) {
        const fr = p / PHASES; let sum = 0;
        for (let k = 0; k < TAPS; k++) {
          const d = k - (HALF - 1) - fr;                       // distance from the wanted position
          const s = Math.abs(d) < 1e-9 ? c : Math.sin(Math.PI * c * d) / (Math.PI * d);
          const wpos = (d + HALF) / TAPS;                       // 0..1 across the window
          const w = wpos <= 0 || wpos >= 1 ? 0 : 0.42 - 0.5 * Math.cos(2 * Math.PI * wpos) + 0.08 * Math.cos(4 * Math.PI * wpos);
          const v = s * w; tab[p * TAPS + k] = v; sum += v;
        }
        for (let k = 0; k < TAPS; k++) tab[p * TAPS + k] /= sum;
      }
      return (sincCache[key] = tab);
    }

    function pad(x) { const y = new Float32Array(x.length + 2 * PAD); y.set(x, PAD); return y; }

    /* prepare: find voiced islands and their pitch marks. Marks are placed one period apart by
       matching each period against the previous one (cross-correlation), so every grain sits at
       the same phase of the waveform. That consistency is what keeps PSOLA clean. */
    D.prepare = function (x, an, onProgress) {
      const sr = an.sr, hop = an.hop, T = an.frames, f0 = an.f0, n = x.length;
      const xp = pad(x), xl = pad(D.lowpassZeroPhase(x, sr, 1500));
      const gapMax = Math.round(0.04 * sr / hop), margin = Math.round(0.018 * sr), edge = Math.round(0.006 * sr);
      const runs = [];
      for (let t = 0; t < T;) { if (!f0[t]) { t++; continue; } let e = t; while (e < T && f0[e]) e++; runs.push([t, e]); t = e; }
      const islands = [];
      for (const r of runs) {
        const last = islands[islands.length - 1];
        if (last && r[0] - last.fe <= gapMax) last.fe = r[1]; else islands.push({ fs: r[0], fe: r[1] });
      }
      const voicedAt = s => { const t = Math.round(s / hop); return t >= 0 && t < T && f0[t] > 0; };

      function refine(m, Tp, dir) {
        const mi = Math.round(m) + PAD, L0 = Math.round(Tp), Dv = Math.max(2, Math.round(Tp * 0.2)), h = Math.max(8, Math.round(Tp * 0.5));
        let e1 = 0; for (let k = -h; k <= h; k++) e1 += xl[mi + k] * xl[mi + k];
        if (e1 < 1e-10) return Tp;
        const lo = Math.max(4, L0 - Dv), hi = L0 + Dv, vals = new Float64Array(hi - lo + 3);
        let best = -2, bl = L0;
        for (let L = lo - 1; L <= hi + 1; L++) {
          const c0 = mi + dir * L; let c = 0, e2 = 0;
          for (let k = -h; k <= h; k++) { const v = xl[c0 + k]; c += xl[mi + k] * v; e2 += v * v; }
          const nc = c / Math.sqrt(e1 * e2 + 1e-12);
          vals[L - lo + 1] = nc;
          if (L >= lo && L <= hi && nc > best) { best = nc; bl = L; }
        }
        if (best < 0.3) return Tp;
        const a = vals[bl - lo], b = vals[bl - lo + 1], c = vals[bl - lo + 2], den = a - 2 * b + c;
        const off = den < -1e-9 ? D.clamp(0.5 * (a - c) / den, -0.5, 0.5) : 0;
        return bl + off;
      }

      islands.forEach((isl, ii) => {
        const len = isl.fe - isl.fs, per = new Float32Array(len);
        // period per frame, holes filled by interpolation
        let lastV = -1;
        for (let i = 0; i < len; i++) {
          const f = f0[isl.fs + i];
          if (f) {
            per[i] = sr / f;
            if (lastV >= 0 && i - lastV > 1) for (let j = lastV + 1; j < i; j++) per[j] = per[lastV] + (per[i] - per[lastV]) * (j - lastV) / (i - lastV);
            lastV = i;
          }
        }
        const periodAt = s => {
          const fi = D.clamp(s / hop - isl.fs, 0, len - 1), i = Math.floor(fi), fr = fi - i;
          return i + 1 < len ? per[i] * (1 - fr) + per[i + 1] * fr : per[i];
        };
        const a = Math.max(0, isl.fs * hop - (hop >> 1)), b = Math.min(n, (isl.fe - 1) * hop + (hop >> 1));
        // anchor on the biggest peak near the loudest frame
        let bt = isl.fs; for (let t = isl.fs; t < isl.fe; t++) if (f0[t] && an.rms[t] > an.rms[bt]) bt = t;
        const c0 = bt * hop, T0 = periodAt(c0);
        let anchor = c0, pk = -1;
        for (let s = Math.round(c0 - T0); s <= c0 + T0; s++) { const v = Math.abs(xl[s + PAD]); if (v > pk) { pk = v; anchor = s; } }
        const fwd = [], bwd = [];
        let m = anchor;
        for (;;) {
          const Tp = periodAt(m); let nx = m + Tp;
          if (nx > b) break;
          if (voicedAt(m) && voicedAt(nx)) nx = m + refine(m, Tp, 1);
          fwd.push(nx); m = nx;
        }
        let Te = periodAt(b); while (m < b + margin + Te) { m += Te; fwd.push(m); }
        m = anchor;
        for (;;) {
          const Tp = periodAt(m); let nx = m - Tp;
          if (nx < a) break;
          if (voicedAt(m) && voicedAt(nx)) nx = m - refine(m, Tp, -1);
          bwd.push(nx); m = nx;
        }
        Te = periodAt(a); while (m > a - margin - Te) { m -= Te; bwd.push(m); }
        bwd.reverse();
        const marks = new Float64Array(bwd.length + 1 + fwd.length);
        marks.set(bwd, 0); marks[bwd.length] = anchor; marks.set(fwd, bwd.length + 1);
        isl.marks = marks; isl.a = a; isl.b = b;
        isl.A = Math.max(0, a - edge); isl.B = Math.min(n, b + edge);
        if (onProgress && (ii & 15) === 0) onProgress(ii / islands.length);
      });
      return { x, xp, sr, hop, frames: T, islands, n };
    };

    // Resynthesize one island with the given per-frame control curves. Returns samples for [isl.A, isl.B).
    D.renderIsland = function (prep, isl, st, fo, gain) {
      const { x, xp, sr, hop, frames } = prep, marks = isl.marks, K = marks.length;
      const A = isl.A, B = isl.B, outN = B - A, out = new Float32Array(outN);
      let maxSp = 0; for (let i = 1; i < K; i++) maxSp = Math.max(maxSp, marks[i] - marks[i - 1]);
      const lo = Math.floor(marks[0] - 2 * maxSp) - 4, hi = Math.ceil(marks[K - 1] + 2 * maxSp) + 4;
      const y = new Float32Array(hi - lo), ws = new Float32Array(hi - lo);
      const ctl = (arr, s) => {
        const fi = s / hop, i = Math.floor(fi);
        if (i < 0) return arr[0]; if (i + 1 >= frames) return arr[frames - 1];
        const fr = fi - i; return arr[i] * (1 - fr) + arr[i + 1] * fr;
      };
      // one grain: analysis mark i, written around output time t with weight g.
      // The read position advances in whole 1/PHASES steps (fixed point) and the Hann window is
      // stepped with a two-term cosine recurrence, so the inner loop is just the 16-tap interpolation.
      const grain = (i, t, f, g, tab) => {
        const L = i > 0 ? marks[i] - marks[i - 1] : marks[1] - marks[0];
        const R = i + 1 < K ? marks[i + 1] - marks[i] : L;
        const stepQ = Math.max(1, Math.round(f * PHASES)), fq = stepQ / PHASES;
        const stepI = Math.floor(stepQ / PHASES), stepP = stepQ - stepI * PHASES;
        const n0 = Math.ceil(t - L / fq), n1 = Math.floor(t + R / fq);
        const pos0 = marks[i] + (n0 - t) * fq;
        let ip = Math.floor(pos0), ph = Math.round((pos0 - ip) * PHASES);
        if (ph === PHASES) { ph = 0; ip++; }
        let xb = ip + PAD - (HALF - 1), o = n0 - lo;
        const nL = Math.min(n1, Math.ceil(t) - 1), copy = ph === 0 && stepP === 0 && stepI === 1;
        for (let half = 0; half < 2; half++) {
          const from = half ? nL + 1 : n0, to = half ? n1 : nL, pi = fq * Math.PI / (half ? R : L);
          if (to < from) continue;
          const a0 = (from - t) * pi, k2 = 2 * Math.cos(pi);
          let c0 = Math.cos(a0), c1 = Math.cos(a0 + pi);
          if (copy) {
            for (let nn = from; nn <= to; nn++) {
              const w = g * (0.5 + 0.5 * c0);
              y[o] += w * xp[xb + HALF - 1]; ws[o] += w; o++; xb++;
              const c2 = k2 * c1 - c0; c0 = c1; c1 = c2;
            }
          } else {
            for (let nn = from; nn <= to; nn++) {
              const w = g * (0.5 + 0.5 * c0), tb = ph * TAPS;
              let sm = 0; for (let k = 0; k < TAPS; k++) sm += xp[xb + k] * tab[tb + k];
              y[o] += w * sm; ws[o] += w; o++;
              xb += stepI; ph += stepP; if (ph >= PHASES) { ph -= PHASES; xb++; }
              const c2 = k2 * c1 - c0; c0 = c1; c1 = c2;
            }
          }
        }
      };
      let t = marks[0], i = 0;
      const end = marks[K - 1];
      while (t <= end + 1e-6) {
        while (i + 1 < K && marks[i + 1] <= t) i++;                // marks[i] <= t < marks[i+1]
        const R = i + 1 < K ? marks[i + 1] - marks[i] : marks[i] - marks[i - 1];
        const r = Math.pow(2, ctl(st, t) / 12), f = Math.pow(2, D.clamp(ctl(fo, t), -12, 12) / 12);
        const tab = sincTable(f > 1 ? 1 / f : 1);
        // blend the two nearest grains: repeating or skipping whole grains is what makes big shifts sound rough
        let al = i + 1 < K ? (t - marks[i]) / R : 0;
        if (al < 0.03) al = 0; else if (al > 0.97) al = 1;       // close enough to one grain: skip the blend
        if (al < 1) grain(i, t, f, 1 - al, tab);
        if (al > 0) grain(i + 1, t, f, al, tab);
        t += Math.max(1, R / r);
      }
      // overlap compensation: divide by sqrt of the smoothed window sum (keeps loudness steady when grains crowd or spread)
      const bw = Math.max(2, Math.round(0.004 * sr)), N = y.length;
      const s1 = new Float32Array(N), s2 = new Float32Array(N);
      const box = (src, dst) => {
        let acc = 0; const h = bw >> 1;
        for (let k = 0; k < Math.min(N, h); k++) acc += src[k];
        for (let k = 0; k < N; k++) {
          if (k + h < N) acc += src[k + h];
          if (k - h - 1 >= 0) acc -= src[k - h - 1];
          dst[k] = acc / (2 * h + 1);
        }
      };
      box(ws, s1); box(s1, s2);
      const xf = Math.max(8, Math.round(0.005 * sr));
      let gPrev = 0, gNext = 0, gf = -1;
      for (let k = 0; k < outN; k++) {
        const s = A + k, w = s2[s - lo];
        let v = y[s - lo];
        if (Math.abs(w - 1) > 1e-4) v /= Math.sqrt(Math.max(w, 0.2));
        const fi = Math.floor(s / hop);
        if (fi !== gf) { gf = fi; gPrev = gain[Math.min(frames - 1, fi)] || 0; gNext = gain[Math.min(frames - 1, fi + 1)] || 0; }
        if (gPrev || gNext) v *= Math.pow(10, (gPrev + (gNext - gPrev) * (s / hop - fi)) / 20);
        let m = 1;
        if (k < xf) m = k / xf; else if (k >= outN - xf) m = (outN - 1 - k) / xf;
        out[k] = m >= 1 ? v : x[s] * (1 - m) + v * m;
      }
      return out;
    };

    function hashCtl(isl, arrs) {
      let h1 = 0x811c9dc5, h2 = 0x1234567;
      for (const a of arrs) {
        const v = new Int32Array(a.buffer, a.byteOffset + isl.fs * 4, isl.fe - isl.fs);
        for (let i = 0; i < v.length; i++) { h1 = Math.imul(h1 ^ v[i], 16777619); h2 = Math.imul(h2 + v[i], 0x9e3779b1) ^ (h2 >>> 13); }
      }
      return (h1 >>> 0) + ':' + (h2 >>> 0);
    }

    /* renderVoice: only islands whose controls changed are recomputed. cache = {} kept by the caller per voice.
       Returns [{start, data}] patches to drop into the voice's buffer. */
    D.renderVoice = function (prep, ctl, cache, onProgress) {
      const patches = [];
      prep.islands.forEach((isl, idx) => {
        const key = hashCtl(isl, [ctl.st, ctl.fo, ctl.gain]);
        if (cache[idx] === key) return;
        cache[idx] = key;
        let flat = true;
        for (let t = isl.fs; t < isl.fe && flat; t++) if (ctl.st[t] || ctl.fo[t] || ctl.gain[t]) flat = false;
        const data = flat ? prep.x.slice(isl.A, isl.B) : D.renderIsland(prep, isl, ctl.st, ctl.fo, ctl.gain);
        patches.push({ start: isl.A, data });
        if (onProgress && (idx & 7) === 0) onProgress(idx / prep.islands.length);
      });
      return patches;
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
