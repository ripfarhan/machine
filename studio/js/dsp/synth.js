/* Machine Studio DSP — part 5: a small formant singer. Used for the built-in demo take and for the tests. */
(function (root) {
  'use strict';
  const parts = root.MACHINE_DSP_PARTS || (root.MACHINE_DSP_PARTS = []);
  parts.push(function (D) {
    'use strict';
    const VOWELS = {
      a: [[730, 90], [1090, 110], [2440, 140], [3400, 180]],
      e: [[530, 80], [1840, 110], [2480, 140], [3500, 180]],
      i: [[290, 70], [2290, 110], [3010, 150], [3700, 190]],
      o: [[570, 80], [840, 100], [2410, 140], [3400, 180]],
      u: [[320, 70], [870, 100], [2240, 140], [3400, 180]]
    };
    /* notes: [{t, dur, midi, cents?, vowel?, vib?, scoop?, drift?, cons?}] (seconds).
       Returns { x, truth } where truth is the true pitch (MIDI) per sample, 0 when silent. */
    D.synthVocal = function (sr, notes, seed) {
      let rs = seed || 12345;
      const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
      const total = Math.ceil((notes[notes.length - 1].t + notes[notes.length - 1].dur + 0.4) * sr);
      const pitch = new Float32Array(total), amp = new Float32Array(total), truth = new Float32Array(total);
      const vow = new Uint8Array(total), names = Object.keys(VOWELS);
      const noise = new Float32Array(total);
      notes.forEach((nt, idx) => {
        const s = Math.round(nt.t * sr), e = Math.round((nt.t + nt.dur) * sr);
        const prev = notes[idx - 1], legato = prev && Math.abs(prev.t + prev.dur - nt.t) < 0.005;
        const next = notes[idx + 1], legOut = next && Math.abs(nt.t + nt.dur - next.t) < 0.005;
        const base = nt.midi + (nt.cents || 0) / 100, ph = rnd() * 6.28;
        for (let i = s; i < e && i < total; i++) {
          const age = (i - s) / sr, left = (e - i) / sr;
          let p = base;
          if (nt.scoop && !legato) p -= nt.scoop * Math.exp(-age / 0.035);
          if (nt.drift) p += nt.drift / 100 * Math.sin(2 * Math.PI * 0.7 * age + ph);
          if (nt.vib) p += nt.vib / 100 * Math.min(1, Math.max(0, (age - 0.22) / 0.25)) * Math.sin(2 * Math.PI * 5.6 * age);
          pitch[i] = p;
          amp[i] = Math.min(1, legato ? 1 : age / 0.03) * Math.min(1, legOut ? 1 : left / 0.05) * (nt.amp || 1);
          vow[i] = names.indexOf(nt.vowel || 'a');
        }
        if (nt.cons && !legato) {                                  // a hiss before the note, like an "s"
          const cs = Math.max(0, s - Math.round(0.07 * sr));
          for (let i = cs; i < s; i++) noise[i] = 0.25 * Math.sin(Math.PI * (i - cs) / (s - cs));
        }
      });
      // portamento between joined notes + a little jitter
      let sm = 0, sm2 = 0, jit = 0; const a = 1 - Math.exp(-1 / (0.012 * sr));
      for (let i = 0; i < total; i++) {
        if (!pitch[i]) { sm = 0; continue; }
        if (!sm) { sm = pitch[i]; sm2 = pitch[i]; }
        sm += a * (pitch[i] - sm); sm2 += a * (sm - sm2);
        jit += 0.002 * ((rnd() - 0.5) * 0.6 - jit);
        truth[i] = sm2 + jit;
      }
      // glottal pulses (band-limited), then tilt and formants
      const src = new Float32Array(total + 64);
      let phase = 0;
      for (let i = 0; i < total; i++) {
        if (!truth[i]) { phase = 0; continue; }
        const inc = 440 * Math.pow(2, (truth[i] - 69) / 12) / sr;
        phase += inc;
        if (phase >= 1) {
          phase -= 1;
          const frac = phase / inc, pos = i - frac, ip = Math.floor(pos), fr = pos - ip, g = amp[i] * (1 + 0.04 * (rnd() - 0.5));
          for (let k = -7; k <= 8; k++) {
            const d = k - fr, w = 0.5 + 0.5 * Math.cos(Math.PI * d / 8.5);
            const sc = Math.abs(d) < 1e-9 ? 1 : Math.sin(Math.PI * d * 0.9) / (Math.PI * d * 0.9);
            if (ip + k >= 0) src[ip + k] += g * sc * w;
          }
        }
      }
      const x = new Float32Array(total);
      let l1 = 0, l2 = 0, hp = 0, hpx = 0;
      const k1 = 1 - Math.exp(-2 * Math.PI * 180 / sr), k2 = 1 - Math.exp(-2 * Math.PI * 2200 / sr);
      const st = [0, 0, 0, 0, 0, 0, 0, 0], F = [0, 0, 0, 0], BW = [0, 0, 0, 0], co = new Float64Array(12);
      let curV = -1;
      for (let i = 0; i < total; i++) {
        l1 += k1 * (src[i] * 30 - l1); l2 += k2 * (l1 - l2);
        let v = l2 + (amp[i] ? 0.004 * (rnd() - 0.5) * amp[i] : 0);
        if ((i & 31) === 0) {
          const tv = VOWELS[names[vow[i]]];
          for (let k = 0; k < 4; k++) {
            if (curV < 0) { F[k] = tv[k][0]; BW[k] = tv[k][1]; }
            F[k] += 0.02 * (tv[k][0] - F[k]); BW[k] += 0.02 * (tv[k][1] - BW[k]);
            const C = -Math.exp(-2 * Math.PI * BW[k] / sr), Bc = 2 * Math.exp(-Math.PI * BW[k] / sr) * Math.cos(2 * Math.PI * F[k] / sr);
            co[k * 3] = 1 - Bc - C; co[k * 3 + 1] = Bc; co[k * 3 + 2] = C;
          }
          curV = vow[i];
        }
        for (let k = 0; k < 4; k++) {
          const yv = co[k * 3] * v + co[k * 3 + 1] * st[k * 2] + co[k * 3 + 2] * st[k * 2 + 1];
          st[k * 2 + 1] = st[k * 2]; st[k * 2] = yv; v = yv;
        }
        // lip radiation (gentle high-pass) + consonant hiss
        hp = v - hpx + 0.97 * hp; hpx = v;
        let nz = 0;
        if (noise[i]) { const w = rnd() - 0.5; nz = noise[i] * (w - (i ? x[i - 1] * 0 : 0)); }
        x[i] = hp + nz * 0.5;
      }
      let pk = 0; for (let i = 0; i < total; i++) pk = Math.max(pk, Math.abs(x[i]));
      const g = 0.5 / (pk || 1); for (let i = 0; i < total; i++) x[i] *= g;
      return { x, truth };
    };

    // The demo take: a short phrase in A minor, sung deliberately out of tune.
    D.demoNotes = function () {
      const seq = [
        [57, 0.42, -32, 'a'], [60, 0.42, 28, 'e'], [64, 0.60, -41, 'a'], [62, 0.30, 22, 'o'], [60, 0.85, -26, 'a', 60],
        null,
        [64, 0.36, 35, 'e'], [65, 0.36, -30, 'i'], [67, 0.72, 44, 'a', 45], [65, 0.30, -22, 'o'], [64, 0.30, 31, 'e'], [62, 1.0, -37, 'a', 70],
        null,
        [69, 0.5, -45, 'a'], [67, 0.5, 26, 'o'], [64, 0.5, -33, 'e'], [60, 0.38, 38, 'a'], [62, 0.38, -24, 'o'], [57, 1.4, 30, 'a', 80]
      ];
      const notes = []; let t = 0.3, gap = true;
      for (const s of seq) {
        if (!s) { t += 0.45; gap = true; continue; }
        notes.push({ t, dur: s[1], midi: s[0], cents: s[2], vowel: s[3], vib: s[4] || 0, scoop: gap ? 1.2 : 0, drift: 12, cons: gap });
        t += s[1]; gap = false;
      }
      return notes;
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
