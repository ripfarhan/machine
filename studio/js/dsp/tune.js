/* Machine Studio DSP — part 3: the correction curve (what pitch every frame should end up at). */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || (root.MACHINE_DSP_PARTS = []);
  parts.push(function (D) {
    'use strict';

    D.defaultTune = function () {
      return {
        key: 0, scale: 'major', custom: null,        // custom: 12 booleans overriding key+scale
        ref: 0,                                        // cents the grid is shifted by (A4 = 440 Hz at 0)
        retune: 25,                                    // ms. 0 = hard tune
        humanize: 0.35,                                // slower retune on the held part of long notes
        amount: 1,                                     // 0..1 how much of the correction is applied
        flex: 0,                                       // 0..1 leave big bends and slides alone
        vibrato: 1,                                    // 0 = flatten the singer's vibrato, 2 = double it
        glide: 0,                                      // ms of slide between two joined notes
        transpose: 0, formant: 0,
        vibDepth: 0, vibRate: 5.5, vibDelay: 250       // synthetic vibrato (cents, Hz, ms)
      };
    };
    D.tuneMask = function (P) { return P.custom ? P.custom.slice() : D.scaleMask(P.key, P.scale); };
    D.noteTarget = function (note, mask, P) {
      return note.manual != null ? note.manual : D.snapToScale(note.center, mask, P.ref);
    };

    function smoothSteps(vals, bounds, lens, s0, n, halfMax, out) {
      // piecewise-constant per note with raised-cosine ramps of up to halfMax frames at each joint
      let k = 0;
      for (let i = 0; i < n; i++) { while (k + 1 < bounds.length && s0 + i >= bounds[k + 1]) k++; out[i] = vals[k]; }
      for (let j = 1; j < bounds.length; j++) {
        const h = Math.min(halfMax, lens[j - 1] / 2, lens[j] / 2);
        if (h < 0.75) continue;
        const b = bounds[j] - s0, a = vals[j - 1], c = vals[j];
        for (let i = Math.max(0, Math.ceil(b - h)); i < Math.min(n, b + h); i++) {
          const w = 0.5 - 0.5 * Math.cos(Math.PI * (i - (b - h) + 0.5) / (2 * h));
          out[i] = a + (c - a) * w;
        }
      }
    }

    /* computeCorrection: returns per-frame output pitch plus the shift (semitones), formant and gain
       curves the resynthesis needs.
         out = sung + amount * (noteOffset - tracker)
       noteOffset moves the whole note onto its target (keeps every scoop and wobble);
       the tracker follows what is still off-target at the retune speed and removes it.
       Retune 0 pins the pitch to the target (the hard-tune sound), slow retune only centres the note. */
    D.computeCorrection = function (an, notes, P) {
      const T = an.frames, midi = an.midi, dt = an.hop / an.sr;
      const out = new Float32Array(T), st = new Float32Array(T), fo = new Float32Array(T), gain = new Float32Array(T);
      const mask = D.tuneMask(P), targets = new Float32Array(notes.length);
      for (let i = 0; i < notes.length; i++) targets[i] = D.noteTarget(notes[i], mask, P);
      const glideH = (P.glide || 0) / 1000 / dt / 2, joinH = 0.02 / dt;
      let i0 = 0;
      while (i0 < notes.length) {
        let i1 = i0 + 1;
        while (i1 < notes.length && notes[i1].s === notes[i1 - 1].e) i1++;
        const s0 = notes[i0].s, e0 = notes[i1 - 1].e, n = e0 - s0;
        const bounds = [], lens = [], tg = [], of = [];
        for (let i = i0; i < i1; i++) {
          bounds.push(notes[i].s); lens.push(notes[i].e - notes[i].s);
          tg.push(targets[i]); of.push(notes[i].off ? 0 : targets[i] - notes[i].center);
        }
        const tgtG = new Float32Array(n), oS = new Float32Array(n);
        smoothSteps(tg, bounds, lens, s0, n, glideH, tgtG);
        smoothSteps(of, bounds, lens, s0, n, joinH, oS);
        let f = 0, k = i0;
        for (let i = 0; i < n; i++) {
          const t = s0 + i;
          while (t >= notes[k].e) k++;
          const nt = notes[k], p = midi[t];
          if (!p) continue;
          if (nt.off) { out[t] = p; f = 0; continue; }
          const e = p + oS[i] - tgtG[i];
          let w = 1;
          if (P.flex > 0) {
            const a = (Math.abs(e) - 0.25) / 0.9, sm = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
            w = 1 - P.flex * sm;
          }
          const age = (t - nt.s) * dt;
          let tau = nt.retune != null ? nt.retune : P.retune;
          if (P.humanize > 0) {
            const a = (age - 0.08) / 0.22, sm = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
            tau += P.humanize * 320 * sm;
          }
          const alpha = tau < 0.5 ? 1 : 1 - Math.exp(-dt * 1000 / tau);
          f += alpha * (e * w - f);
          out[t] = p + P.amount * (oS[i] - f);
        }
        // vibrato: scale the fast wobble that is left around the target, per note
        for (let i = i0; i < i1; i++) {
          const nt = notes[i], len = nt.e - nt.s;
          if (nt.off) continue;
          const g = nt.vib != null ? nt.vib : P.vibrato;
          if (g !== 1 && len * dt > 0.09) {
            const W = Math.max(2, Math.round(0.085 / dt));
            const r = new Float32Array(len);
            for (let j = 0; j < len; j++) r[j] = out[nt.s + j] ? out[nt.s + j] - tgtG[nt.s + j - s0] : 0;
            for (let j = 0; j < len; j++) {
              if (!out[nt.s + j]) continue;
              const a = Math.max(0, j - W), b = Math.min(len - 1, j + W), h = Math.min(j - a, b - j);
              let acc = 0; for (let q = j - h; q <= j + h; q++) acc += r[q];
              const v = r[j] - acc / (2 * h + 1);
              out[nt.s + j] += (g - 1) * v;
            }
          }
          if (P.vibDepth > 0 && len * dt > P.vibDelay / 1000 + 0.12) {
            const d = P.vibDepth / 100, dl = P.vibDelay / 1000;
            for (let j = 0; j < len; j++) {
              if (!out[nt.s + j]) continue;
              const age = j * dt, left = (len - j) * dt;
              if (age < dl) continue;
              const env = Math.min(1, (age - dl) / 0.18) * Math.min(1, left / 0.08);
              out[nt.s + j] += d * env * Math.sin(2 * Math.PI * P.vibRate * (age - dl));
            }
          }
          for (let t = nt.s; t < nt.e; t++) {
            if (!midi[t]) continue;
            fo[t] = (P.formant || 0) + (nt.formant || 0);
            gain[t] = nt.gain || 0;
          }
        }
        for (let t = s0; t < e0; t++) if (midi[t]) st[t] = D.clamp(out[t] - midi[t] + (P.transpose || 0), -24, 24);
        i0 = i1;
      }
      if (P.transpose) for (let t = 0; t < T; t++) if (out[t]) out[t] += P.transpose;
      return { out, st, fo, gain, targets };
    };

    /* A harmony / double voice: the lead's corrected line moved per note.
       voice = { mode:'scale'|'semi', amount (degrees or semitones), cents, formant } */
    D.harmonyCurves = function (an, notes, P, corr, voice) {
      const T = an.frames, dt = an.hop / an.sr;
      const st = new Float32Array(T), fo = new Float32Array(T), out = new Float32Array(T);
      const mask = D.tuneMask(P), off = (P.ref || 0) / 100, joinH = 0.03 / dt;
      let i0 = 0;
      while (i0 < notes.length) {
        let i1 = i0 + 1;
        while (i1 < notes.length && notes[i1].s === notes[i1 - 1].e) i1++;
        const s0 = notes[i0].s, n = notes[i1 - 1].e - s0, bounds = [], lens = [], hs = [];
        for (let i = i0; i < i1; i++) {
          const tg = corr.targets[i];
          const h = voice.mode === 'scale' ? D.shiftDegrees(tg - off, voice.amount, mask) + off - tg : voice.amount;
          bounds.push(notes[i].s); lens.push(notes[i].e - notes[i].s); hs.push(h);
        }
        const hS = new Float32Array(n);
        smoothSteps(hs, bounds, lens, s0, n, joinH, hS);
        for (let i = 0; i < n; i++) {
          const t = s0 + i;
          if (!an.midi[t]) continue;
          const add = hS[i] + (voice.cents || 0) / 100;
          st[t] = D.clamp(corr.st[t] + add, -24, 24);
          fo[t] = corr.fo[t] + (voice.formant || 0);
          out[t] = corr.out[t] + add;
        }
        i0 = i1;
      }
      return { st, fo, gain: corr.gain, out };
    };

    /* Gate + level rider as one gain curve (dB per frame), played back as volume automation.
       Gate closes between phrases; the rider evens out loud and quiet phrases. */
    D.levelCurve = function (an, opts) {
      const T = an.frames, dt = an.hop / an.sr, db = new Float32Array(T), g = new Float32Array(T);
      for (let t = 0; t < T; t++) db[t] = 20 * Math.log10(Math.max(an.rms[t], 1e-6));
      if (opts.gateOn) {
        const thr = opts.gateThresh, range = -Math.abs(opts.gateRange), hold = Math.round(0.08 / dt);
        const open = new Uint8Array(T); let last = -1e9;
        for (let t = 0; t < T; t++) { if (db[t] > thr || an.midi[t]) last = t; open[t] = t - last <= hold ? 1 : 0; }
        // look ahead a little so the gate is open before the phrase starts
        const la = Math.round(0.02 / dt);
        for (let t = 0; t < T; t++) if (!open[t]) for (let k = 1; k <= la && t + k < T; k++) if (open[t + k]) { open[t] = 2; break; }
        let cur = range; const up = 1 - Math.exp(-dt / 0.006), dn = 1 - Math.exp(-dt / 0.09);
        for (let t = 0; t < T; t++) { const tg = open[t] ? 0 : range; cur += (tg > cur ? up : dn) * (tg - cur); g[t] += cur; }
      }
      if (opts.riderOn && opts.rider > 0) {
        // loudness of sung frames, smoothed over ~0.6 s, pulled toward the take's median
        const vals = []; for (let t = 0; t < T; t++) if (an.midi[t]) vals.push(db[t]);
        if (vals.length > 20) {
          const med = D.median(vals, 0, vals.length), sm = new Float32Array(T);
          let cur = med; const a = 1 - Math.exp(-dt / 0.3);
          for (let t = 0; t < T; t++) { if (an.midi[t]) cur += a * (db[t] - cur); sm[t] = cur; }
          cur = sm[T - 1];
          for (let t = T - 1; t >= 0; t--) { cur += a * (sm[t] - cur); sm[t] = cur; }
          for (let t = 0; t < T; t++) g[t] += D.clamp((med - sm[t]) * opts.rider, -9, 9);
        }
      }
      return g;
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
